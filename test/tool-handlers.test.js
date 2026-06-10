// tool-handlers の create_variable ハンドラの単体テスト。
// 最小限のフェイク VM を用意し、変数/リストの作成・スコープ・二重作成防止・
// blocksEnabled ガードを検証する。
/* eslint-disable no-console */
import assert from 'assert';
import {createToolHandlers, ToolError} from '../src/agent/tool-handlers';

// VM の Target 風オブジェクト(必要なメソッドだけ実装)
const makeTarget = ({name, isStage}) => {
    const vars = {};
    return {
        isStage,
        isOriginal: true,
        getName: () => name,
        // 第3引数(skipStage)はフェイクでは無視し、自分の変数だけを見る。
        // グローバル重複チェックはハンドラ側の stage.lookup で別途担保される。
        lookupVariableByNameAndType: (n, type) =>
            Object.values(vars).find(v => v.name === n && v.type === type) || null,
        createVariable: (id, n, type) => { vars[id] = {id, name: n, type}; },
        _vars: vars
    };
};

const makeVm = () => {
    const stage = makeTarget({name: 'Stage', isStage: true});
    const sprite = makeTarget({name: 'Sprite1', isStage: false});
    const state = {workspaceUpdates: 0, stage, sprite};
    const vm = {
        runtime: {
            targets: [stage, sprite],
            getTargetForStage: () => stage,
            getTargetById: () => null
        },
        emitWorkspaceUpdate: () => { state.workspaceUpdates++; }
    };
    return {vm, state};
};

// --- テスト1: 変数をグローバル(ステージ)に作成 ---
{
    const {vm, state} = makeVm();
    const handlers = createToolHandlers(vm, {blocksEnabled: true});
    const res = handlers.create_variable({name: 'aaa'});
    assert.strictEqual(res.created, true);
    assert.strictEqual(res.kind, 'variable');
    assert.strictEqual(res.scope, 'global');
    const made = Object.values(state.stage._vars);
    assert.strictEqual(made.length, 1);
    assert.strictEqual(made[0].name, 'aaa');
    assert.strictEqual(made[0].type, '');
    assert.strictEqual(state.workspaceUpdates, 1, 'パレット更新が呼ばれる');
}

// --- テスト2: リストを作成 ---
{
    const {vm, state} = makeVm();
    const handlers = createToolHandlers(vm, {blocksEnabled: true});
    const res = handlers.create_variable({name: 'mylist', kind: 'list'});
    assert.strictEqual(res.created, true);
    assert.strictEqual(res.kind, 'list');
    const made = Object.values(state.stage._vars);
    assert.strictEqual(made[0].type, 'list');
}

// --- テスト3: スプライトのローカル変数として作成 ---
{
    const {vm, state} = makeVm();
    const handlers = createToolHandlers(vm, {blocksEnabled: true});
    const res = handlers.create_variable({name: 'ccc', target: 'Sprite1'});
    assert.strictEqual(res.created, true);
    assert.strictEqual(res.scope, 'Sprite1');
    assert.strictEqual(Object.values(state.sprite._vars).length, 1, 'スプライト側に作られる');
    assert.strictEqual(Object.values(state.stage._vars).length, 0, 'ステージには作られない');
}

// --- テスト4: 同名再作成は二重作成しない ---
{
    const {vm, state} = makeVm();
    const handlers = createToolHandlers(vm, {blocksEnabled: true});
    handlers.create_variable({name: 'aaa'});
    const res = handlers.create_variable({name: 'aaa'});
    assert.strictEqual(res.created, false);
    assert.strictEqual(Object.values(state.stage._vars).length, 1, '重複作成されない');
}

// --- テスト5: blocksEnabled=false では ToolError ---
{
    const {vm} = makeVm();
    const handlers = createToolHandlers(vm, {blocksEnabled: false});
    assert.throws(() => handlers.create_variable({name: 'aaa'}), ToolError);
}

// --- テスト6: name 未指定は ToolError ---
{
    const {vm} = makeVm();
    const handlers = createToolHandlers(vm, {blocksEnabled: true});
    assert.throws(() => handlers.create_variable({}), ToolError);
}

console.log('tool-handlers ALL TESTS PASSED');
