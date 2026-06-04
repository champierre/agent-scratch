// block-builder の単体テスト: DSL → runtime blocks を実際の scratch-vm Blocks
// コンテナに投入し、toXML(全構造を再帰走査)が壊れないことを確認する
/* eslint-disable no-console */
import assert from 'assert';
import {buildScripts, dslFromBlocks, uid} from '../src/agent/block-builder';

// exports フィールドの制限を回避するため相対パスで参照
const Runtime = require('../node_modules/@scratch/scratch-vm/src/engine/runtime');
const Blocks = require('../node_modules/@scratch/scratch-vm/src/engine/blocks');

const variables = {};
const resolveVariable = (name, type) => {
    const key = `${type}:${name}`;
    if (!variables[key]) variables[key] = {id: uid(), name};
    return variables[key];
};

// --- テスト1: 旗クリック → ずっと動く ---
const dsl1 = [
    {blocks: [
        {opcode: 'event_whenflagclicked'},
        {opcode: 'control_forever', substack: [
            {opcode: 'motion_movesteps', inputs: {STEPS: 10}},
            {opcode: 'motion_ifonedgebounce'}
        ]}
    ]}
];
const blocks1 = buildScripts(dsl1, {resolveVariable});
const container1 = new Blocks(new Runtime());
for (const b of Object.values(blocks1)) container1.createBlock(b);
assert.strictEqual(container1.getScripts().length, 1, 'スクリプトは1本');
const xml1 = container1.toXML();
assert.ok(xml1.includes('motion_movesteps'), 'XMLにopcodeが含まれる');
assert.ok(xml1.includes('math_number'), '数値shadowが生成される');
console.log('test1 OK: 基本スタック+forever');

// --- テスト2: 変数・条件分岐・ネスト演算・メニュー ---
const dsl2 = [
    {x: 100, y: 100, blocks: [
        {opcode: 'event_whenkeypressed', fields: {KEY_OPTION: 'space'}},
        {opcode: 'data_setvariableto', fields: {VARIABLE: 'スコア'}, inputs: {VALUE: 0}},
        {opcode: 'control_if_else',
            inputs: {CONDITION: {opcode: 'operator_gt',
                inputs: {
                    OPERAND1: {opcode: 'data_variable', fields: {VARIABLE: 'スコア'}},
                    OPERAND2: 10
                }}},
            substack: [
                {opcode: 'looks_say', inputs: {MESSAGE: '勝ち!'}}
            ],
            substack2: [
                {opcode: 'motion_goto', inputs: {TO: '_random_'}},
                {opcode: 'data_changevariableby', fields: {VARIABLE: 'スコア'}, inputs: {VALUE: 1}}
            ]},
        {opcode: 'event_broadcast', inputs: {BROADCAST_INPUT: 'ゲーム終了'}},
        {opcode: 'control_stop', fields: {STOP_OPTION: 'all'}}
    ]}
];
const blocks2 = buildScripts(dsl2, {resolveVariable});
const container2 = new Blocks(new Runtime());
for (const b of Object.values(blocks2)) container2.createBlock(b);
assert.strictEqual(container2.getScripts().length, 1);
const xml2 = container2.toXML();
assert.ok(xml2.includes('operator_gt'), '条件ネスト');
assert.ok(xml2.includes('スコア'), '変数名');
assert.ok(xml2.includes('motion_goto_menu'), 'メニューshadow');
assert.ok(xml2.includes('event_broadcast_menu'), 'broadcastメニュー');
assert.ok(xml2.includes('mutation'), 'control_stopのmutation');
// 変数が型別に解決されている
assert.ok(variables[':スコア'], '変数が作成された');
assert.ok(variables['broadcast_msg:ゲーム終了'], 'ブロードキャストが作成された');
console.log('test2 OK: 変数・if_else・ネスト・メニュー・mutation');

// --- テスト3: 逆変換(round-trip) ---
const roundTrip = dslFromBlocks(container2);
assert.strictEqual(roundTrip.length, 1);
const rtBlocks = roundTrip[0].blocks;
assert.strictEqual(rtBlocks[0].opcode, 'event_whenkeypressed');
assert.strictEqual(rtBlocks[0].fields.KEY_OPTION, 'space');
assert.strictEqual(rtBlocks[1].inputs.VALUE, '0');
assert.strictEqual(rtBlocks[2].inputs.CONDITION.opcode, 'operator_gt');
assert.strictEqual(rtBlocks[2].inputs.CONDITION.inputs.OPERAND1.opcode, 'data_variable');
assert.strictEqual(rtBlocks[2].substack[0].opcode, 'looks_say');
assert.strictEqual(rtBlocks[2].substack2.length, 2);
console.log('test3 OK: DSL逆変換');

// --- テスト4: エラー検出 ---
const expectError = (scripts, pattern, label) => {
    try {
        buildScripts(scripts, {resolveVariable});
        assert.fail(`${label}: エラーになるべき`);
    } catch (e) {
        assert.ok(e.message.includes(pattern), `${label}: ${e.message}`);
    }
};
expectError([{blocks: [{opcode: 'motion_movestepsss'}]}], '未知のopcode', '未知opcode');
expectError([{blocks: [{opcode: 'operator_add'}]}], '値ブロック', 'reporterをスタックに');
expectError(
    [{blocks: [{opcode: 'control_if', inputs: {CONDITION: {opcode: 'motion_xposition'}}, substack: []}]}],
    '六角形', 'boolean入力にreporter');
expectError(
    [{blocks: [{opcode: 'motion_movesteps'}, {opcode: 'event_whenflagclicked'}]}],
    'ハットブロック', 'hatが途中');
console.log('test4 OK: バリデーションエラー');

console.log('ALL TESTS PASSED');
