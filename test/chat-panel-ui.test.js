// AIアシスタントの折りたたみUIのテスト(jsdom + React Testing Library)
// 既存の「esbuild でバンドル → node 実行」方式に乗せる
/* eslint-disable no-console */
import assert from 'assert';
import {JSDOM} from 'jsdom';

// React のレンダリング前に DOM 環境(window/document)を用意する
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url: 'http://localhost/'});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.IS_REACT_ACT_ENVIRONMENT = true;
// 開発キー注入のためのダミー(agent-loop が参照)
process.env.DEV_ANTHROPIC_API_KEY = process.env.DEV_ANTHROPIC_API_KEY || '';

const React = require('react');
const {render, screen, fireEvent, cleanup} = require('@testing-library/react');
const ChatPanel = require('../src/components/chat-panel/chat-panel.jsx').default;

// 必須propsの最小セット(コールバックは記録用スパイ)
const baseProps = () => ({
    messages: [],
    running: false,
    drafting: null,
    hasApiKey: true,
    trialMode: false,
    currentModel: 'deepseek-v4-flash',
    blocksEnabled: true,
    onSend: () => {},
    onStop: () => {},
    onOpenSettings: () => {},
    onToggleBlocks: () => {},
    onSetBlocksEnabled: () => {},
    onToggleCollapse: () => {}
});

// --- テスト1: collapsed=true ではパネルを描画しない ---
{
    const {container} = render(React.createElement(ChatPanel, {...baseProps(), collapsed: true}));
    assert.strictEqual(container.querySelector('.as-chat-panel'), null, 'collapsed時はパネル非表示');
    cleanup();
    console.log('test1 OK: collapsed=true でパネル非表示');
}

// --- テスト2: collapsed=false ではパネルとタイトルを描画する ---
{
    const {container} = render(React.createElement(ChatPanel, {...baseProps(), collapsed: false}));
    assert.ok(container.querySelector('.as-chat-panel'), 'パネルが描画される');
    assert.ok(container.textContent.includes('AI アシスタント'), 'タイトルが表示される');
    cleanup();
    console.log('test2 OK: collapsed=false でパネル表示');
}

// --- テスト3: 折りたたみボタン(▶)クリックで onToggleCollapse が呼ばれる ---
{
    let toggled = 0;
    const {container} = render(React.createElement(ChatPanel, {
        ...baseProps(), collapsed: false, onToggleCollapse: () => { toggled++; }
    }));
    const btn = container.querySelector('.as-chat-collapse-button');
    assert.ok(btn, '折りたたみボタンが存在する');
    fireEvent.click(btn);
    assert.strictEqual(toggled, 1, 'クリックで onToggleCollapse が1回呼ばれる');
    cleanup();
    console.log('test3 OK: ▶ クリックで onToggleCollapse 発火');
}

// --- テスト4: lang='en' では英語UI(タイトル・送信ボタン)を描画する ---
{
    const {container} = render(React.createElement(ChatPanel, {...baseProps(), collapsed: false, lang: 'en'}));
    assert.ok(container.textContent.includes('AI Assistant'), '英語タイトルが表示される');
    assert.ok(!container.textContent.includes('AI アシスタント'), '日本語タイトルは出ない');
    assert.ok(container.querySelector('.as-chat-send').textContent.includes('Send'), '送信ボタンが英語');
    assert.ok(!container.textContent.includes('ブロック操作'), 'トグル文言も英語化される');
    cleanup();
    console.log('test4 OK: lang=en で英語UI');
}

// --- テスト5: opcode(値) が入力欄に値の入ったブロック画像になる ---
// 「motion_movesteps を置いて数字を5にする」ではなく、完成形の (5) 歩動かす を見せたい
{
    globalThis.__sbParsed = [];
    const {container} = render(React.createElement(ChatPanel, {
        ...baseProps(),
        collapsed: false,
        messages: [{role: 'assistant', text: 'motion_movesteps(5) をつなげます'}]
    }));
    assert.ok(globalThis.__sbParsed.includes('(5) 歩動かす'),
        `入力欄に5が入ったラベルで描画される (実際: ${JSON.stringify(globalThis.__sbParsed)})`);
    // 値の括弧は画像に取り込まれ、本文には残らない
    assert.ok(!container.textContent.includes('(5)'), '本文に (5) が二重表示されない');
    assert.ok(!container.textContent.includes('motion_movesteps'), 'opcode が生のまま残らない');
    cleanup();
    console.log('test5 OK: opcode(値) が値入りブロック画像になる');
}

// --- テスト6: 差し込めない値では既定ラベルに戻り、括弧は本文に残す ---
{
    globalThis.__sbParsed = [];
    const {container} = render(React.createElement(ChatPanel, {
        ...baseProps(),
        collapsed: false,
        messages: [{role: 'assistant', text: 'motion_movesteps(たくさん) です'}]
    }));
    assert.ok(globalThis.__sbParsed.includes('(10) 歩動かす'), '既定ラベルにフォールバックする');
    assert.ok(container.textContent.includes('たくさん'), '解釈できない括弧は本文に残す');
    cleanup();
    console.log('test6 OK: 差し込めない値は既定ラベルにフォールバック');
}

// --- テスト7: 従来どおり「日本語名の括弧書き」は冗長として読み飛ばす ---
{
    globalThis.__sbParsed = [];
    const {container} = render(React.createElement(ChatPanel, {
        ...baseProps(),
        collapsed: false,
        messages: [{role: 'assistant', text: 'motion_movesteps(10歩動かす) を置く'}]
    }));
    assert.ok(globalThis.__sbParsed.includes('(10) 歩動かす'), '既定ラベルで描画される');
    assert.ok(!container.textContent.includes('10歩動かす'), '同じ名前の括弧書きは消える');
    cleanup();
    console.log('test7 OK: 日本語名の括弧書きは従来どおり読み飛ばす');
}

console.log('chat-panel-ui ALL TESTS PASSED');
// React scheduler / jsdom がイベントループにハンドルを残しプロセスが
// 自然終了しないため、明示的に終了する(CIのハング防止)
process.exit(0);
