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
    currentModel: 'deepseek-chat',
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

console.log('chat-panel-ui ALL TESTS PASSED');
