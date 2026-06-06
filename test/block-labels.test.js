// 日本語ブロック名 → opcode 逆引き(findOpcodeByJaName)のテスト
/* eslint-disable no-console */
import assert from 'assert';
import {findOpcodeByJaName} from '../src/agent/block-labels';

// AIが実際に書きがちな表現(スクリーンショット由来の実例を含む)
const cases = [
    ['緑の旗がクリックされたとき', 'event_whenflagclicked'],
    ['ずっと', 'control_forever'],
    ['10歩動かす', 'motion_movesteps'],
    ['もし端についたら、跳ね返る', 'motion_ifonedgebounce'],
    ['もし端に着いたら、跳ね返る', 'motion_ifonedgebounce'],
    ['次のコスチュームにする', 'looks_nextcostume'],
    ['x座標を10ずつ変える', 'motion_changexby'],
    ['スペースキーが押されたとき', 'event_whenkeypressed'],
    // マッチしてはいけないもの
    ['こんにちは', null],
    ['ネコを追加して', null]
];

let failed = 0;
for (const [input, expect] of cases) {
    const got = findOpcodeByJaName(input);
    const ok = got === expect;
    if (!ok) failed++;
    console.log(ok ? 'OK ' : 'NG ', JSON.stringify(input), '→', got, ok ? '' : `(期待: ${expect})`);
}
assert.strictEqual(failed, 0, `${failed}件失敗`);
console.log('block-labels ALL TESTS PASSED');
