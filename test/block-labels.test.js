// 日本語ブロック名 → opcode 逆引き(findOpcodeByJaName)のテスト
/* eslint-disable no-console */
import assert from 'assert';
import {findOpcodeByJaName, isRedundantJaAnnotation, fillBlockLabel, getBlockLabel, BLOCK_LABELS, BLOCK_LABELS_JA} from '../src/agent/block-labels';

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

// ---- 入力欄への値の差し込み(fillBlockLabel) ----
// 差し込めない入力は null を返し、呼び出し側が既定ラベルにフォールバックできること
const L = op => BLOCK_LABELS_JA[op];
const fillCases = [
    // 差し込める
    [L('motion_movesteps'), '5', '(5) 歩動かす'],
    [L('control_repeat'), '4', '(4) 回繰り返す\n\nend'],           // C字型も先頭行だけ変わる
    [L('motion_gotoxy'), '0, 100', 'x座標を (0) 、y座標を (100) にする'],
    [L('looks_sayforsecs'), 'やあ, 3', '[やあ] と (3) 秒言う'],
    [L('looks_say'), 'こんにちは、世界', '[こんにちは、世界] と言う'], // 欄が1つなら読点で割らない
    [L('motion_pointindirection'), '-90', '(-90) 度に向ける'],
    [L('operator_round'), '3.7', '((3.7) を四捨五入)'],
    [BLOCK_LABELS.motion_movesteps, '5', 'move (5) steps'],           // 英語ラベルも同じ
    // 差し込まない(null → 既定ラベルにフォールバック)
    [L('motion_movesteps'), 'たくさん', null],   // 数値欄に非数値
    [L('motion_gotoxy'), '5', null],             // 欄の数と値の数が不一致
    [L('looks_hide'), '5', null],                // 入力欄がない
    [L('operator_not'), '5', null],              // 空の () はブロックを入れる穴で入力欄ではない
    [L('event_whenkeypressed'), 'a', null],      // ドロップダウンのみ
    [L('looks_say'), 'a[b]c', null],             // DSLを壊す文字
    [L('motion_movesteps'), '', null]            // 空値
];
for (const [label, arg, expect] of fillCases) {
    const got = fillBlockLabel(label, arg);
    const ok = got === expect;
    if (!ok) failed++;
    console.log(ok ? 'OK ' : 'NG ', `差し込み(${JSON.stringify(label)}, ${JSON.stringify(arg)})`, '→', JSON.stringify(got), ok ? '' : `(期待: ${JSON.stringify(expect)})`);
}
assert.strictEqual(failed, 0, `${failed}件失敗`);

// 日英でスロット数がずれていると、同じ書き方が言語によって効いたり効かなかったりする。
// 差し込みが成功する値の個数を 1〜6 で探って、日英が一致することを確かめる。
const slotCount = label => {
    for (let n = 1; n <= 6; n++) {
        if (fillBlockLabel(label, Array(n).fill('1').join(','))) return n;
    }
    return 0;
};
for (const opcode of Object.keys(BLOCK_LABELS)) {
    const en = slotCount(getBlockLabel(opcode, 'en'));
    const ja = slotCount(getBlockLabel(opcode, 'ja'));
    if (en !== ja) { failed++; console.log('NG ', `日英のスロット数が不一致: ${opcode} (en=${en} ja=${ja})`); }
}
assert.strictEqual(failed, 0, `${failed}件失敗`);
console.log('OK  日英ラベルのスロット数が全opcodeで一致');

console.log('block-labels ALL TESTS PASSED');
