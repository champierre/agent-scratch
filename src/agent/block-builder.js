// 簡易DSL → scratch-vm のランタイムブロック形式への変換と、その逆変換
//
// DSL形式:
//   scripts: [
//     {x?, y?, blocks: [
//       {"opcode": "event_whenflagclicked"},
//       {"opcode": "control_forever", "substack": [
//         {"opcode": "motion_movesteps", "inputs": {"STEPS": 10}}
//       ]}
//     ]}
//   ]
// inputs の値はリテラル(数値/文字列)か、ネストしたブロックオブジェクト({"opcode": ...})。
// fields の値は文字列(ドロップダウン選択肢、変数名など)。

import {BLOCK_SPECS, LITERAL_SHADOWS} from './block-specs';

const SOUP = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const uid = () => Array.from(
    {length: 20}, () => SOUP[Math.floor(Math.random() * SOUP.length)]
).join('');

export class BuildError extends Error {}

const isBlockDef = v => v !== null && typeof v === 'object' && typeof v.opcode === 'string';

/**
 * DSLのscripts配列をランタイムブロック形式(idをキーとするマップ)へ変換する。
 * @param {Array} scripts DSLのスクリプト配列
 * @param {object} ctx
 * @param {function(string, string): {id: string, name: string}} ctx.resolveVariable
 *        変数/リスト/ブロードキャスト名 → {id, name}(存在しなければ作成)
 * @returns {object} {id: runtimeBlock} のマップ
 */
export const buildScripts = (scripts, ctx) => {
    if (!Array.isArray(scripts)) {
        throw new BuildError('scripts は配列である必要があります');
    }
    const blocks = {};
    scripts.forEach((script, i) => {
        const stack = Array.isArray(script) ? script : script.blocks;
        if (!Array.isArray(stack) || stack.length === 0) {
            throw new BuildError(`scripts[${i}] に blocks 配列がありません`);
        }
        const topId = buildStack(stack, null, blocks, ctx, `scripts[${i}]`);
        const top = blocks[topId];
        top.topLevel = true;
        top.x = typeof script.x === 'number' ? script.x : 60 + (i % 2) * 380;
        top.y = typeof script.y === 'number' ? script.y : 60 + Math.floor(i / 2) * 320;
    });
    return blocks;
};

// ブロック列を構築して先頭ブロックidを返す(next/parentを結線)
const buildStack = (defs, parentId, blocks, ctx, path) => {
    let firstId = null;
    let prevId = null;
    defs.forEach((def, i) => {
        const id = buildBlock(def, blocks, ctx, `${path}.blocks[${i}]`);
        const block = blocks[id];
        const spec = BLOCK_SPECS[def.opcode];
        if (spec.shape === 'reporter' || spec.shape === 'boolean') {
            throw new BuildError(
                `${path}.blocks[${i}]: ${def.opcode} は値ブロックなのでスタックに直接置けません(inputs の中で使ってください)`);
        }
        if (i > 0 && spec.shape === 'hat') {
            throw new BuildError(
                `${path}.blocks[${i}]: ハットブロック ${def.opcode} はスクリプトの先頭にのみ置けます`);
        }
        if (prevId !== null) {
            blocks[prevId].next = id;
            block.parent = prevId;
        } else {
            block.parent = parentId;
            firstId = id;
        }
        prevId = id;
    });
    return firstId;
};

// 単一ブロック(+shadow、ネストブロック、substack)を構築してidを返す
const buildBlock = (def, blocks, ctx, path) => {
    if (!isBlockDef(def)) {
        throw new BuildError(`${path}: ブロックは {"opcode": ...} 形式のオブジェクトである必要があります`);
    }
    const spec = BLOCK_SPECS[def.opcode];
    if (!spec) {
        throw new BuildError(`${path}: 未知のopcode "${def.opcode}" です。利用可能なopcode一覧から選んでください`);
    }
    const id = uid();
    const block = {
        id,
        opcode: def.opcode,
        inputs: {},
        fields: {},
        next: null,
        parent: null,
        shadow: false,
        topLevel: false
    };
    blocks[id] = block;

    const givenInputs = def.inputs || {};
    const givenFields = def.fields || {};

    // 引数(inputs)
    for (const [name, argType] of Object.entries(spec.args || {})) {
        // Claudeが inputs/fields どちらに書いても受け付ける
        const value = givenInputs[name] !== undefined ? givenInputs[name] : givenFields[name];
        block.inputs[name] = buildInput(name, argType, value, id, blocks, ctx, `${path}.inputs.${name}`);
    }

    // フィールド(ドロップダウン・変数参照)
    for (const [name, fieldSpec] of Object.entries(spec.fields || {})) {
        const value = givenFields[name] !== undefined ? givenFields[name] : givenInputs[name];
        if (value === undefined || value === null) {
            throw new BuildError(`${path}: ${def.opcode} には fields.${name} が必要です`);
        }
        if (typeof value === 'object') {
            throw new BuildError(`${path}.fields.${name}: フィールドにはブロックを入れられません(文字列を指定してください)`);
        }
        block.fields[name] = buildField(name, fieldSpec, String(value), ctx);
    }

    // C型ブロックの内包スタック
    const substackCount = spec.substacks || 0;
    if (substackCount >= 1) {
        const sub = def.substack || def.SUBSTACK;
        if (Array.isArray(sub) && sub.length > 0) {
            const subId = buildStack(sub, id, blocks, ctx, `${path}.substack`);
            block.inputs.SUBSTACK = {name: 'SUBSTACK', block: subId, shadow: null};
        }
    }
    if (substackCount >= 2) {
        const sub2 = def.substack2 || def.else || def.SUBSTACK2;
        if (Array.isArray(sub2) && sub2.length > 0) {
            const sub2Id = buildStack(sub2, id, blocks, ctx, `${path}.substack2`);
            block.inputs.SUBSTACK2 = {name: 'SUBSTACK2', block: sub2Id, shadow: null};
        }
    }

    // control_stop の mutation
    if (spec.mutationStop) {
        const stopOption = block.fields.STOP_OPTION ? block.fields.STOP_OPTION.value : 'all';
        block.mutation = {
            tagName: 'mutation',
            children: [],
            hasnext: stopOption === 'other scripts in sprite' ? 'true' : 'false'
        };
    }

    return id;
};

// 1つのinput(リテラルshadow / メニューshadow / ネストブロック)を構築
const buildInput = (name, argType, value, parentId, blocks, ctx, path) => {
    // boolean入力: ネストブロックのみ、shadowなし
    if (argType === 'boolean') {
        if (value === undefined || value === null) {
            return {name, block: null, shadow: null};
        }
        if (!isBlockDef(value)) {
            throw new BuildError(`${path}: 真偽値入力にはブロック({"opcode": ...})が必要です`);
        }
        const nestedId = buildReporter(value, parentId, blocks, ctx, path, true);
        return {name, block: nestedId, shadow: null};
    }

    // メニュー入力: メニューshadow(+任意でネストブロック)
    if (typeof argType === 'object' && argType.menu) {
        const isNested = isBlockDef(value);
        const menuValue = isNested || value === undefined || value === null ?
            argType.default :
            String(value);
        const shadowId = uid();
        blocks[shadowId] = {
            id: shadowId,
            opcode: argType.menu,
            inputs: {},
            fields: {[argType.field]: {name: argType.field, value: menuValue}},
            next: null,
            parent: parentId,
            shadow: true,
            topLevel: false
        };
        if (isNested) {
            const nestedId = buildReporter(value, parentId, blocks, ctx, path, false);
            return {name, block: nestedId, shadow: shadowId};
        }
        return {name, block: shadowId, shadow: shadowId};
    }

    // ブロードキャスト入力
    if (argType === 'broadcast') {
        if (value === undefined || value === null || isBlockDef(value)) {
            throw new BuildError(`${path}: ブロードキャスト名(文字列)が必要です`);
        }
        const broadcast = ctx.resolveVariable(String(value), 'broadcast_msg');
        const shadowId = uid();
        blocks[shadowId] = {
            id: shadowId,
            opcode: 'event_broadcast_menu',
            inputs: {},
            fields: {
                BROADCAST_OPTION: {
                    name: 'BROADCAST_OPTION',
                    value: broadcast.name,
                    id: broadcast.id,
                    variableType: 'broadcast_msg'
                }
            },
            next: null,
            parent: parentId,
            shadow: true,
            topLevel: false
        };
        return {name, block: shadowId, shadow: shadowId};
    }

    // リテラル入力(数値・文字列・色)
    const literalSpec = LITERAL_SHADOWS[argType];
    if (!literalSpec) {
        throw new BuildError(`${path}: 不明な引数タイプ ${JSON.stringify(argType)}`);
    }
    const isNested = isBlockDef(value);
    const shadowValue = isNested || value === undefined || value === null ? '' : String(value);
    const shadowId = uid();
    blocks[shadowId] = {
        id: shadowId,
        opcode: literalSpec.opcode,
        inputs: {},
        fields: {[literalSpec.field]: {name: literalSpec.field, value: shadowValue}},
        next: null,
        parent: parentId,
        shadow: true,
        topLevel: false
    };
    if (isNested) {
        const nestedId = buildReporter(value, parentId, blocks, ctx, path, false);
        return {name, block: nestedId, shadow: shadowId};
    }
    return {name, block: shadowId, shadow: shadowId};
};

// input内にネストされる値ブロックを構築
const buildReporter = (def, parentId, blocks, ctx, path, requireBoolean) => {
    const spec = BLOCK_SPECS[def.opcode];
    if (!spec) {
        throw new BuildError(`${path}: 未知のopcode "${def.opcode}" です`);
    }
    if (spec.shape !== 'reporter' && spec.shape !== 'boolean') {
        throw new BuildError(`${path}: ${def.opcode} は値ブロックではないので入力に使えません`);
    }
    if (requireBoolean && spec.shape !== 'boolean') {
        throw new BuildError(`${path}: 真偽値入力には六角形(boolean)ブロックが必要です(${def.opcode} は不可)`);
    }
    const id = buildBlock(def, blocks, ctx, path);
    blocks[id].parent = parentId;
    return id;
};

// フィールド値を構築(変数系はid解決)
const buildField = (name, fieldSpec, value, ctx) => {
    if (fieldSpec.variable !== undefined) {
        const variable = ctx.resolveVariable(value, fieldSpec.variable);
        return {name, value: variable.name, id: variable.id, variableType: fieldSpec.variable};
    }
    return {name, value};
};

// ---- 逆変換: ランタイムブロック → DSL(get_project_state 用の要約) ----

/**
 * targetのBlocksコンテナをDSL形式に逆変換する。
 * @param {object} blocksContainer target.blocks
 * @returns {Array} DSLのscripts配列
 */
export const dslFromBlocks = blocksContainer => {
    const all = blocksContainer._blocks;
    return blocksContainer.getScripts().map(topId => {
        const top = all[topId];
        return {
            x: top.x,
            y: top.y,
            blocks: stackToDsl(topId, all)
        };
    });
};

const stackToDsl = (startId, all) => {
    const result = [];
    let id = startId;
    while (id) {
        const block = all[id];
        if (!block) break;
        result.push(blockToDsl(block, all));
        id = block.next;
    }
    return result;
};

const blockToDsl = (block, all) => {
    const def = {opcode: block.opcode};
    const inputs = {};
    for (const [name, input] of Object.entries(block.inputs || {})) {
        if (name === 'SUBSTACK' || name === 'SUBSTACK2') {
            const key = name === 'SUBSTACK' ? 'substack' : 'substack2';
            if (input.block) def[key] = stackToDsl(input.block, all);
            continue;
        }
        if (!input.block) continue;
        const child = all[input.block];
        if (!child) continue;
        if (child.shadow) {
            // shadowブロック → リテラル値
            const field = Object.values(child.fields || {})[0];
            if (field) inputs[name] = field.value;
        } else {
            inputs[name] = blockToDsl(child, all);
        }
    }
    if (Object.keys(inputs).length > 0) def.inputs = inputs;
    const fields = {};
    for (const [name, field] of Object.entries(block.fields || {})) {
        fields[name] = field.value;
    }
    if (Object.keys(fields).length > 0) def.fields = fields;
    return def;
};
