// 日本語ブロック名 → opcode 逆引き(findOpcodeByJaName)のテスト
/* eslint-disable no-console */
import assert from 'assert';
import {findOpcodeByJaName, isRedundantJaAnnotation} from '../src/agent/block-labels';

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
// 画像直後の括弧書きが冗長(同じブロックの言い換え)かの判定
const annotationCases = [
    ['緑の旗が押されたとき', 'event_whenflagclicked', true],
    ['ずっと', 'control_forever', true],
    ['10歩動かす', 'motion_movesteps', true],
    ['もし端についたら跳ね返る', 'motion_ifonedgebounce', true],
    ['回転方法を「左右に反転」にする', 'motion_setrotationstyle', true], // メニュー値入り
    ['きっかけ', 'event_whenflagclicked', false],          // 補足説明は残す
    ['足をパタパタさせるため', 'looks_nextcostume', false], // 説明文は残す
    ['10歩動かす', 'control_forever', false]               // 別ブロックの名前は残す
];
for (const [text, opcode, expect] of annotationCases) {
    const got = isRedundantJaAnnotation(text, opcode);
    const ok = got === expect;
    if (!ok) failed++;
    console.log(ok ? 'OK ' : 'NG ', `冗長判定(${JSON.stringify(text)}, ${opcode})`, '→', got, ok ? '' : `(期待: ${expect})`);
}
assert.strictEqual(failed, 0, `${failed}件失敗`);
console.log('block-labels ALL TESTS PASSED');
