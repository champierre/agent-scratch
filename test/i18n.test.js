/* eslint-disable no-console */
import assert from 'assert';
import {localeToLang, STRINGS, SUGGESTIONS_BY_LANG, draftingChars, errorPrefix, pricingLabel} from '../src/i18n.js';

// --- localeToLang: 日本語系は ja、それ以外は en ---
assert.strictEqual(localeToLang('ja'), 'ja');
assert.strictEqual(localeToLang('ja-Hira'), 'ja');
assert.strictEqual(localeToLang('en'), 'en');
assert.strictEqual(localeToLang('en-US'), 'en');
assert.strictEqual(localeToLang('fr'), 'en');
assert.strictEqual(localeToLang('zh-cn'), 'en');
assert.strictEqual(localeToLang(''), 'en');
assert.strictEqual(localeToLang(null), 'en');
assert.strictEqual(localeToLang(undefined), 'en');

// --- STRINGS: ja/en が同じキー集合を持つ(片方だけ更新する事故を防ぐ) ---
const jaKeys = Object.keys(STRINGS.ja).sort();
const enKeys = Object.keys(STRINGS.en).sort();
assert.deepStrictEqual(jaKeys, enKeys, 'STRINGS.ja と STRINGS.en のキー集合は一致すること');
for (const k of jaKeys) {
    assert.ok(STRINGS.ja[k] && typeof STRINGS.ja[k] === 'string', `ja.${k} は非空文字列`);
    assert.ok(STRINGS.en[k] && typeof STRINGS.en[k] === 'string', `en.${k} は非空文字列`);
    assert.notStrictEqual(STRINGS.ja[k], STRINGS.en[k], `ja.${k} と en.${k} は異なる訳であること`);
}

// --- サジェストは両言語で同数。en は日本語特有の題材(nekonige)を含まない ---
assert.strictEqual(SUGGESTIONS_BY_LANG.ja.length, SUGGESTIONS_BY_LANG.en.length);
for (const s of SUGGESTIONS_BY_LANG.en) {
    assert.ok(!/nekonige|ネコ逃げ/.test(s.text), 'en サジェストは nekonige を含まない');
    assert.ok(!/[ぁ-んァ-ヶ一-龯]/.test(s.label + s.text), 'en サジェストは日本語を含まない');
}

// --- ヘルパー関数 ---
assert.strictEqual(draftingChars('ja', 0), '');
assert.strictEqual(draftingChars('ja', 12), ' (12文字)');
assert.strictEqual(draftingChars('en', 12), ' (12 chars)');
assert.strictEqual(errorPrefix('ja', 'X'), 'エラー: X');
assert.strictEqual(errorPrefix('en', 'X'), 'Error: X');
assert.ok(pricingLabel('ja', 'Anthropic').includes('料金表'));
assert.ok(pricingLabel('en', 'Anthropic').includes('pricing'));

console.log('i18n ALL TESTS PASSED');
