// 各ツール呼び出し → scratch-vm への反映
import {buildScripts, dslFromBlocks, uid, BuildError} from './block-builder';
import {
    searchSprites, findSpriteByName,
    searchCostumes, findCostumeByName,
    searchSounds, findSoundByName,
    searchBackdrops, findBackdropByName
} from './library-search';

export class ToolError extends Error {}

// name または id でターゲット(スプライト/ステージ)を探す
const findTarget = (vm, nameOrId) => {
    if (!nameOrId || /^(stage|ステージ)$/i.test(nameOrId)) {
        const stage = vm.runtime.getTargetForStage();
        if (stage) return stage;
    }
    const byId = vm.runtime.getTargetById(nameOrId);
    if (byId) return byId;
    const byName = vm.runtime.targets.find(
        t => t.isOriginal && t.getName() === nameOrId
    );
    if (!byName) {
        const names = vm.runtime.targets.filter(t => t.isOriginal).map(t => t.getName());
        throw new ToolError(`ターゲット "${nameOrId}" が見つかりません。存在するターゲット: ${names.join(', ')}`);
    }
    return byName;
};

// 変数/リスト/ブロードキャストの解決(なければ作成)。
// 変数・リストはステージ(グローバル)に作る。
const makeVariableResolver = (vm, target) => (name, type) => {
    const stage = vm.runtime.getTargetForStage();
    const existing = target.lookupVariableByNameAndType(name, type, false) ||
        stage.lookupVariableByNameAndType(name, type, true);
    if (existing) return {id: existing.id, name: existing.name};
    const id = uid();
    stage.createVariable(id, name, type);
    return {id, name};
};

const targetSummary = target => {
    const summary = {
        name: target.getName(),
        is_stage: target.isStage,
        costumes: target.getCostumes().map(c => c.name),
        current_costume: target.getCostumes()[target.currentCostume] ?
            target.getCostumes()[target.currentCostume].name : null,
        sounds: target.getSounds().map(s => s.name),
        scripts: dslFromBlocks(target.blocks)
    };
    if (!target.isStage) {
        summary.x = Math.round(target.x);
        summary.y = Math.round(target.y);
        summary.size = target.size;
        summary.direction = target.direction;
        summary.visible = target.visible;
    }
    const variables = {};
    for (const v of Object.values(target.variables)) {
        if (v.type === '') variables[v.name] = v.value;
        else if (v.type === 'list') variables[v.name] = {list: v.value};
    }
    if (Object.keys(variables).length > 0) summary.variables = variables;
    return summary;
};

export const createToolHandlers = (vm, {blocksEnabled = true} = {}) => ({

    get_project_state: () => ({
        targets: vm.runtime.targets
            .filter(t => t.isOriginal)
            .map(targetSummary)
    }),

    search_library: ({kind, query}) => {
        if (!query) throw new ToolError('query が必要です');
        switch (kind) {
        case 'sprite': return {results: searchSprites(query)};
        case 'costume': return {results: searchCostumes(query)};
        case 'sound': return {results: searchSounds(query)};
        case 'backdrop': return {results: searchBackdrops(query)};
        default: throw new ToolError('kind は sprite / costume / sound / backdrop のいずれかです');
        }
    },

    add_sprite: async ({name}) => {
        const item = findSpriteByName(name);
        if (!item) {
            const candidates = searchSprites(name, 5).map(s => s.name);
            throw new ToolError(
                `ライブラリにスプライト "${name}" がありません。` +
                (candidates.length ? `候補: ${candidates.join(', ')}` : 'search_library で探してください'));
        }
        await vm.addSprite(JSON.stringify(item));
        const target = vm.editingTarget;
        return {
            added: target.getName(),
            costumes: target.getCostumes().map(c => c.name),
            sounds: target.getSounds().map(s => s.name)
        };
    },

    delete_sprite: ({target}) => {
        const t = findTarget(vm, target);
        if (t.isStage) throw new ToolError('ステージは削除できません');
        vm.deleteSprite(t.id);
        return {deleted: target};
    },

    rename_sprite: ({target, new_name}) => {
        const t = findTarget(vm, target);
        if (t.isStage) throw new ToolError('ステージの名前は変更できません');
        vm.renameSprite(t.id, new_name);
        return {renamed: new_name};
    },

    add_costume: async ({target, costume_name}) => {
        const t = findTarget(vm, target);
        const item = findCostumeByName(costume_name);
        if (!item) {
            const candidates = searchCostumes(costume_name, 5).map(c => c.name);
            throw new ToolError(
                `ライブラリにコスチューム "${costume_name}" がありません。` +
                (candidates.length ? `候補: ${candidates.join(', ')}` : 'search_library で探してください'));
        }
        const costume = {...item, randomizeName: false};
        await vm.addCostume(item.md5ext, costume, t.id);
        return {added: costume_name, costumes: t.getCostumes().map(c => c.name)};
    },

    add_sound: async ({target, sound_name}) => {
        const t = findTarget(vm, target);
        const item = findSoundByName(sound_name);
        if (!item) {
            const candidates = searchSounds(sound_name, 5).map(s => s.name);
            throw new ToolError(
                `ライブラリに音 "${sound_name}" がありません。` +
                (candidates.length ? `候補: ${candidates.join(', ')}` : 'search_library で探してください'));
        }
        await vm.addSound({...item}, t.id);
        return {added: sound_name, sounds: t.getSounds().map(s => s.name)};
    },

    add_backdrop: async ({backdrop_name}) => {
        const item = findBackdropByName(backdrop_name);
        if (!item) {
            const candidates = searchBackdrops(backdrop_name, 5).map(b => b.name);
            throw new ToolError(
                `ライブラリに背景 "${backdrop_name}" がありません。` +
                (candidates.length ? `候補: ${candidates.join(', ')}` : 'search_library で探してください'));
        }
        await vm.addBackdrop(item.md5ext, {...item});
        return {added: backdrop_name};
    },

    set_scripts: async ({target, scripts}) => {
        if (!blocksEnabled) {
            throw new ToolError('ブロック操作は現在オフになっています。');
        }
        const t = findTarget(vm, target);
        const resolveVariable = makeVariableResolver(vm, t);

        // スクリプト内に pen_ ブロックが含まれていたらペン拡張を自動ロード
        const scriptJson = JSON.stringify(scripts);
        // 注意: runtime 直下の「_extensions」は存在しない(CLAUDE.md「よくあるハマりポイント」参照)。
        // 必ず vm.extensionManager.isExtensionLoaded を使うこと(過去2回退行・test/static-checks.js で検出)
        if (scriptJson.includes('"pen_') && !vm.extensionManager.isExtensionLoaded('pen')) {
            await vm.extensionManager.loadExtensionURL('pen');
        }

        // 失敗時ロールバック用スナップショット
        const blocksSnapshot = {...t.blocks._blocks};
        const scriptsSnapshot = [...t.blocks._scripts];
        try {
            const newBlocks = buildScripts(scripts, {resolveVariable});
            // 旧ブロックを参照する実行中スレッドを止めてから差し替える
            // (残っていると _updateGlows が消えたブロックIDを光らせようとして
            //  "Tried to glow block that does not exist" が毎フレーム発生する)
            vm.runtime.stopForTarget(t);
            t.blocks.deleteAllBlocks();
            for (const block of Object.values(newBlocks)) {
                t.blocks.createBlock(block);
            }
            // 前フレームのグロー参照に旧ブロックIDが残らないようクリア
            vm.runtime._scriptGlowsPreviousFrame = [];
            vm.setEditingTarget(t.id);
            vm.emitWorkspaceUpdate();
            const scriptCount = t.blocks.getScripts().length;
            return {ok: true, target: t.getName(), script_count: scriptCount};
        } catch (e) {
            t.blocks._blocks = blocksSnapshot;
            t.blocks._scripts = scriptsSnapshot;
            t.blocks.resetCache();
            if (e instanceof BuildError) throw new ToolError(e.message);
            throw e;
        }
    },

    set_sprite_properties: ({target, x, y, size, direction, visible}) => {
        const t = findTarget(vm, target);
        if (t.isStage) throw new ToolError('ステージには位置などのプロパティを設定できません');
        if (typeof x === 'number' || typeof y === 'number') {
            t.setXY(typeof x === 'number' ? x : t.x, typeof y === 'number' ? y : t.y);
        }
        if (typeof size === 'number') t.setSize(size);
        if (typeof direction === 'number') t.setDirection(direction);
        if (typeof visible === 'boolean') t.setVisible(visible);
        return {ok: true, x: t.x, y: t.y, size: t.size, direction: t.direction, visible: t.visible};
    },

    start_project: () => {
        vm.greenFlag();
        return {ok: true, message: '緑の旗を押しました(プロジェクト実行中)'};
    },

    stop_project: () => {
        vm.stopAll();
        return {ok: true};
    }
});
