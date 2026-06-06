// ブロック操作トグルのリグレッションテスト(jsdom + RTL)
// 「オフにしたあとオンに戻すと、送信時に blocksEnabled が false のまま」という
// 二重管理バグ(#34で修正)が再発しないことを検証する。
// agent-loop は tools/run-ui-test.mjs により stub に差し替えられ、runAgent への
// 引数(blocksEnabled)を記録する。
/* eslint-disable no-console */
import assert from 'assert';
import {JSDOM} from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {url: 'http://localhost/'});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.localStorage = dom.window.localStorage;
global.IS_REACT_ACT_ENVIRONMENT = true;
// 初回説明ダイアログは既読にしておく(トグル/送信操作の邪魔をしないため)
global.localStorage.setItem('agent-scratch-disclosure-accepted', '1');

const React = require('react');
const {render, fireEvent, cleanup, act} = require('@testing-library/react');
const ChatPanel = require('../src/containers/chat-panel.jsx').default;
const stub = require('./stubs/agent-loop-stub.js');

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

// React StrictMode でラップして二重実行下でも壊れないことを確認する
// (旧実装は setState updater 内で ref を書き換えており、StrictMode の
//  二重実行で ref が state と逆転し、このテストで再現・検出できた)
const renderPanel = () => render(
    React.createElement(React.StrictMode, null,
        React.createElement(ChatPanel, {vm: {}, collapsed: false, onToggleCollapse() {}}))
);

const sendText = async (container, text) => {
    const input = container.querySelector('.as-chat-input');
    fireEvent.change(input, {target: {value: text}});
    fireEvent.click(container.querySelector('.as-chat-send'));
    await flush();
};

const main = async () => {
    // --- テスト1: トグルをオフ→オンに戻したら、送信時 blocksEnabled=true ---
    {
        stub.__reset();
        const {container} = renderPanel();
        const toggle = container.querySelector('.as-chat-toggle-switch');
        await act(async () => { fireEvent.click(toggle); }); // on -> off
        await act(async () => { fireEvent.click(toggle); }); // off -> on
        await sendText(container, 'ネコの色を変えて');
        const args = stub.__getLastRunAgentArgs();
        assert.ok(args, 'runAgent が呼ばれる');
        assert.strictEqual(args.blocksEnabled, true,
            'オフ→オンに戻したら送信時 blocksEnabled は true でなければならない');
        cleanup();
        console.log('test1 OK: オフ→オンで blocksEnabled=true');
    }

    // --- テスト2: トグルをオフにしたまま送信したら blocksEnabled=false ---
    {
        stub.__reset();
        const {container} = renderPanel();
        const toggle = container.querySelector('.as-chat-toggle-switch');
        await act(async () => { fireEvent.click(toggle); }); // on -> off
        await sendText(container, 'ネコの色を変えて');
        assert.strictEqual(stub.__getLastRunAgentArgs().blocksEnabled, false,
            'オフのまま送信したら blocksEnabled は false');
        cleanup();
        console.log('test2 OK: オフのまま blocksEnabled=false');
    }

    // --- テスト3: 初期状態(オン)で送信したら blocksEnabled=true ---
    {
        stub.__reset();
        const {container} = renderPanel();
        await sendText(container, 'ネコの色を変えて');
        assert.strictEqual(stub.__getLastRunAgentArgs().blocksEnabled, true,
            '初期オンで送信したら blocksEnabled は true');
        cleanup();
        console.log('test3 OK: 初期オンで blocksEnabled=true');
    }

    console.log('chat-panel-toggle ALL TESTS PASSED');
};

main().catch(e => { console.error(e); process.exit(1); });
