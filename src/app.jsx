import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useDispatch} from 'react-redux';
import GUI, {AppStateHOC, setProjectId, defaultProjectId} from '@scratch/scratch-gui';
import ChatPanel from './containers/chat-panel.jsx';
import {maybeRunSelfTest, maybeRunAgentTest} from './dev/self-test';
import {localeToLang, STRINGS} from './i18n';
import './app.css';

// Scratch の言語(vm.getLocale())を単一の真実として 'ja' | 'en' を返すフック。
// VM は locale 変更イベントを出さないため軽量ポーリングで監視し、
// 値が変わったときだけ state を更新する(無駄な再描画を避ける)。
const useScratchLang = vm => {
    const [lang, setLang] = useState('ja');
    const langRef = useRef('ja');
    useEffect(() => {
        if (!vm || typeof vm.getLocale !== 'function') return undefined;
        const read = () => {
            const next = localeToLang(vm.getLocale());
            if (next !== langRef.current) {
                langRef.current = next;
                setLang(next);
                document.documentElement.lang = next;
            }
        };
        read();
        const id = setInterval(read, 1000);
        return () => clearInterval(id);
    }, [vm]);
    return lang;
};

// HashParserHOC 相当: マウント時にデフォルトプロジェクト(ネコ入り)を読み込む
const DefaultProjectHOC = WrappedComponent => {
    const DefaultProjectLoader = props => {
        const dispatch = useDispatch();
        useEffect(() => {
            dispatch(setProjectId(defaultProjectId));
        }, [dispatch]);
        return <WrappedComponent {...props} />;
    };
    return DefaultProjectLoader;
};

const WrappedGui = AppStateHOC(DefaultProjectHOC(GUI));

const App = () => {
    const [vm, setVm] = useState(null);
    const [chatCollapsed, setChatCollapsed] = useState(false);
    const lang = useScratchLang(vm);
    const handleVmInit = useCallback(newVm => {
        window.vm = newVm; // デバッグ用
        setVm(newVm);
        maybeRunSelfTest(newVm);
        maybeRunAgentTest(newVm);
    }, []);

    // パネル開閉で GUI 領域の幅が変わるが、Scratch(Blockly)は resize
    // イベントでしか再レイアウトしないため、開閉のたびに明示的に発火させる
    // (発火しないとブロックエリア横に古い幅の余白が残る)
    useEffect(() => {
        window.dispatchEvent(new Event('resize'));
        const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
        return () => clearTimeout(t);
    }, [chatCollapsed]);

    return (
        <div className="as-app">
            <div className="as-gui-wrapper">
                <WrappedGui
                    canEditTitle
                    backpackVisible={false}
                    canSave={false}
                    onVmInit={handleVmInit}
                />
            </div>
            {chatCollapsed && (
                <button
                    className="as-chat-reopen"
                    title={STRINGS[lang].openAssistant}
                    onClick={() => setChatCollapsed(false)}
                >💬<span className="as-chat-reopen-label">AI</span></button>
            )}
            <ChatPanel
                vm={vm}
                lang={lang}
                collapsed={chatCollapsed}
                onToggleCollapse={() => setChatCollapsed(c => !c)}
            />
        </div>
    );
};

export default App;
