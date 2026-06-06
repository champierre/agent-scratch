/* eslint-disable no-console */
import assert from 'assert';
import {getBlockOperationPrompt} from '../src/agent/system-prompt.js';

const enabled = getBlockOperationPrompt(true);
assert.ok(enabled.includes('現在、ブロック操作はオンです'));
assert.ok(enabled.includes('過去の状態'));
assert.ok(enabled.includes('直接実行してください'));
assert.ok(!enabled.includes('現在、ブロック操作はオフです'));

const disabled = getBlockOperationPrompt(false);
assert.ok(disabled.includes('現在、ブロック操作はオフです'));
assert.ok(disabled.includes('説明・解説だけ'));
assert.ok(!disabled.includes('現在、ブロック操作はオンです'));

console.log('block-operation-prompt ALL TESTS PASSED');
