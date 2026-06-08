// 各ツール呼び出し → scratch-vm への反映
import {buildScripts, dslFromBlocks, uid, BuildError} from './block-builder';
import {
    searchSprites, findSpriteByName,
    searchCostumes, findCostumeByName,
    searchSounds, findSoundByName,
    searchBackdrops, findBackdropByName
} from './library-search';

// fetch_url ツール用のプロキシベース URL(試用モードと同じ Worker を兼用)
const WORKER_BASE_URL = (() => {
    const raw = process.env.TRIAL_PROXY_URL || '';
    return raw.replace(/\/(v1\/)?chat\/completions$/, '').replace(/\/$/, '');
})();

const TRIAL_TOKEN_KEY = 'agent-scratch-trial-token';
const getTrialToken = () => localStorage.getItem(TRIAL_TOKEN_KEY) || '';

// 直接 fetch の取得上限(コンテキスト溢れ防止)
const FETCH_URL_MAX_CHARS = 200 * 1024;

// GitHub の URL を CORS 許可のある取得先に変換する(該当しなければ null)
// - github.com/{o}/{r}/blob/{branch}/{path} → raw.githubusercontent.com
// - github.com/{o}/{r} (リポジトリルート) → api.github.com の README(raw)
export const toCorsFetchable = url => {
    const blob = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
    if (blob) {
        return {url: `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}/${blob[4]}`};
    }
    const root = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)\/?$/);
    if (root) {
        return {
            url: `https://api.github.com/repos/${root[1]}/${root[2]}/readme`,
            headers: {Accept: 'application/vnd.github.raw+json'}
        };
    }
    if (url.startsWith('https://raw.githubusercontent.com/') ||
        url.startsWith('https://api.github.com/')) {
        return {url};
    }
    return null;
};

// set_scripts 1回で組めるブロック数の上限(段階的な構築を強制)
const MAX_BLOCKS_PER_CALL = 50;

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

const blockGuard = blocksEnabled => {
    if (!blocksEnabled) throw new ToolError('ブロック操作は現在オフになっています。');
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
        blockGuard(blocksEnabled);
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
        blockGuard(blocksEnabled);
        const t = findTarget(vm, target);
        if (t.isStage) throw new ToolError('ステージは削除できません');
        vm.deleteSprite(t.id);
        return {deleted: target};
    },

    rename_sprite: ({target, new_name}) => {
        blockGuard(blocksEnabled);
        const t = findTarget(vm, target);
        if (t.isStage) throw new ToolError('ステージの名前は変更できません');
        vm.renameSprite(t.id, new_name);
        return {renamed: new_name};
    },

    add_costume: async ({target, costume_name}) => {
        blockGuard(blocksEnabled);
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
        blockGuard(blocksEnabled);
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
        blockGuard(blocksEnabled);
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

    set_scripts: async ({target, scripts, append}) => {
        blockGuard(blocksEnabled);
        const t = findTarget(vm, target);
        const resolveVariable = makeVariableResolver(vm, t);

        // スクリプト内に pen_ ブロックが含まれていたらペン拡張を自動ロード
        const scriptJson = JSON.stringify(scripts);
        // 注意: runtime 直下の「_extensions」は存在しない(CLAUDE.md「よくあるハマりポイント」参照)。
        // 必ず vm.extensionManager.isExtensionLoaded を使うこと(過去2回退行・test/static-checks.js で検出)
        if (scriptJson.includes('"pen_') && !vm.extensionManager.isExtensionLoaded('pen')) {
            await vm.extensionManager.loadExtensionURL('pen');
        }

        // メニュー/フィールドの動的許可値(実在するスプライト名・コスチューム名など)
        const stage = vm.runtime.getTargetForStage();
        const dynamicValues = {
            sprites: vm.runtime.targets
                .filter(x => x.isOriginal && !x.isStage)
                .map(x => x.getName()),
            costumes: t.getCostumes().map(c => c.name),
            sounds: t.getSounds().map(snd => snd.name),
            backdrops: stage ? stage.getCostumes().map(c => c.name) : []
        };

        // 失敗時ロールバック用スナップショット
        const blocksSnapshot = {...t.blocks._blocks};
        const scriptsSnapshot = [...t.blocks._scripts];
        try {
            const newBlocks = buildScripts(scripts, {resolveVariable, dynamicValues});

            // 一度に組める量を制限(巨大スクリプトの一括生成を防ぎ、段階的な構築を強制する)
            const realCount = Object.values(newBlocks).filter(b => !b.shadow).length;
            if (realCount > MAX_BLOCKS_PER_CALL) {
                throw new ToolError(
                    `一度に組むブロックが多すぎます(${realCount}個 / 上限${MAX_BLOCKS_PER_CALL}個)。` +
                    'スクリプトを分けて、2回目以降は append: true で追加してください');
            }

            // 旧ブロックを参照する実行中スレッドを止めてから差し替える
            // (残っていると _updateGlows が消えたブロックIDを光らせようとして
            //  "Tried to glow block that does not exist" が毎フレーム発生する)
            vm.runtime.stopForTarget(t);
            if (append) {
                // 既存スクリプトの下に新しいスクリプトを配置する
                const existingTops = t.blocks.getScripts()
                    .map(id => t.blocks.getBlock(id))
                    .filter(Boolean);
                const offsetY = existingTops.length
                    ? Math.max(...existingTops.map(b => b.y || 0)) + 320
                    : 0;
                for (const block of Object.values(newBlocks)) {
                    if (block.topLevel) block.y = (block.y || 0) + offsetY;
                }
            } else {
                t.blocks.deleteAllBlocks();
            }
            for (const block of Object.values(newBlocks)) {
                t.blocks.createBlock(block);
            }
            // 前フレームのグロー参照に旧ブロックIDが残らないようクリア
            vm.runtime._scriptGlowsPreviousFrame = [];
            vm.setEditingTarget(t.id);
            vm.emitWorkspaceUpdate();
            const scriptCount = t.blocks.getScripts().length;
            return {ok: true, target: t.getName(), appended: !!append, script_count: scriptCount};
        } catch (e) {
            t.blocks._blocks = blocksSnapshot;
            t.blocks._scripts = scriptsSnapshot;
            t.blocks.resetCache();
            if (e instanceof BuildError) throw new ToolError(e.message);
            throw e;
        }
    },

    set_sprite_properties: ({target, x, y, size, direction, visible}) => {
        blockGuard(blocksEnabled);
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
        blockGuard(blocksEnabled);
        vm.greenFlag();
        return {ok: true, message: '緑の旗を押しました(プロジェクト実行中)'};
    },

    stop_project: () => {
        blockGuard(blocksEnabled);
        vm.stopAll();
        return {ok: true};
    },

    fetch_url: async ({url}) => {
        if (!url) throw new ToolError('url が必要です');

        // GitHub の URL は CORS 許可のあるエンドポイントに変換してブラウザから直接取得する
        // (Worker プロキシはお試しトークンが必要なため、自分のキーのユーザーでも動くように)
        const direct = toCorsFetchable(url);
        const token = getTrialToken();
        const useProxy = !direct && WORKER_BASE_URL && token;

        let endpoint;
        let headers;
        if (direct) {
            endpoint = direct.url;
            headers = direct.headers;
        } else if (useProxy) {
            // GitHub 以外の URL はプロキシ経由(お試しトークンがある場合のみ)
            endpoint = `${WORKER_BASE_URL}/fetch-url?url=${encodeURIComponent(url)}`;
            headers = {Authorization: `Bearer ${token}`};
        } else {
            // 直接 fetch を試す(CORS許可のあるサイトなら成功する)
            endpoint = url;
        }

        let res;
        try {
            res = await fetch(endpoint, headers ? {headers} : undefined);
        } catch (e) {
            throw new ToolError(
                `ネットワークエラー: ${e.message}` +
                (direct || useProxy ? '' : '(このサイトはブラウザから直接取得できない可能性があります)'));
        }
        if (!res.ok) {
            let errMsg = `HTTP ${res.status}`;
            try { const body = await res.json(); errMsg = body.error || errMsg; } catch { /* ignore */ }
            throw new ToolError(`取得失敗: ${errMsg} (${endpoint})`);
        }
        let data;
        if (useProxy) {
            data = await res.json();
        } else {
            const text = (await res.text()).slice(0, FETCH_URL_MAX_CHARS);
            data = {text, truncated: text.length >= FETCH_URL_MAX_CHARS};
        }
        return {
            url,
            text: data.text,
            truncated: data.truncated || false
        };
    }
});
