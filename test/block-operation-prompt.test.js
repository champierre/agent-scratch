/* eslint-disable no-console */
import assert from 'assert';
import {getBlockOperationPrompt, getSystemPrompt} from '../src/agent/system-prompt.js';

// --- 日本語(既定) ---
const enabled = getBlockOperationPrompt(true);
assert.ok(enabled.includes('現在、ブロック操作はオンです'));
assert.ok(enabled.includes('過去の状態'));
assert.ok(enabled.includes('直接実行してください'));
assert.ok(!enabled.includes('現在、ブロック操作はオフです'));

const disabled = getBlockOperationPrompt(false);
assert.ok(disabled.includes('現在、ブロック操作はオフです'));
assert.ok(disabled.includes('説明・解説だけ'));
assert.ok(!disabled.includes('現在、ブロック操作はオンです'));

// --- 英語 ---
const enabledEn = getBlockOperationPrompt(true, 'en');
assert.ok(enabledEn.includes('Block editing is currently ON'));
assert.ok(!/[ぁ-んァ-ヶ一-龯]/.test(enabledEn), '英語プロンプトに日本語が混ざらない');

const disabledEn = getBlockOperationPrompt(false, 'en');
assert.ok(disabledEn.includes('Block editing is currently OFF'));
assert.ok(disabledEn.includes('only explain and describe'));

// --- システムプロンプト本体の日英切替 ---
const sysJa = getSystemPrompt('ja');
const sysEn = getSystemPrompt('en');
assert.ok(sysJa.includes('あなたはScratchプログラミングのエキスパート'), '日本語システムプロンプト');
assert.ok(sysEn.includes('expert Scratch programming agent'), '英語システムプロンプト');
assert.ok(getSystemPrompt() === sysJa, '既定は日本語');
// opcode 一覧は両言語に含まれる(BLOCK_SPECS 由来)
assert.ok(sysEn.includes('motion_movesteps') && sysJa.includes('motion_movesteps'));
// 英語版のフィールド注記が英語化されている
assert.ok(sysEn.includes('variable name'), 'en では variable name');

console.log('block-operation-prompt ALL TESTS PASSED');
