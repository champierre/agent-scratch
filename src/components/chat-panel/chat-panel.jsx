import React, {useEffect, useRef, useState} from 'react';
import './chat-panel.css';

// 行内マークダウン(**太字** と `コード`) をReact要素に変換
const renderInline = (text, keyPrefix) => {
    const parts = [];
    text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).forEach((seg, i) => {
        if (/^\*\*[^*]+\*\*$/.test(seg)) {
            parts.push(<strong key={`${keyPrefix}-${i}`}>{seg.slice(2, -2)}</strong>);
        } else if (/^`[^`]+`$/.test(seg)) {
            parts.push(<code key={`${keyPrefix}-${i}`}>{seg.slice(1, -1)}</code>);
        } else if (seg) {
            parts.push(seg);
        }
    });
    return parts;
};

// 行単位のブロック要素(見出し・リスト・区切り線)も処理するマークダウン描画
const renderMarkdownLite = text => {
    const lines = text.split('\n');
    const result = [];
    let listItems = [];

    const flushList = () => {
        if (listItems.length > 0) {
            result.push(<ul key={`ul-${result.length}`} style={{margin: '4px 0', paddingLeft: '18px'}}>{listItems}</ul>);
            listItems = [];
        }
    };

    lines.forEach((line, i) => {
        const h2 = line.match(/^##\s+(.+)/);
        const h3 = line.match(/^###\s+(.+)/);
        const li = line.match(/^[-*]\s+(.+)/);
        const ol = line.match(/^\d+\.\s+(.+)/);
        const hr = /^---+$/.test(line.trim());

        if (h2) {
            flushList();
            result.push(<strong key={i} style={{display: 'block', fontSize: '14px', marginTop: '6px'}}>{renderInline(h2[1], i)}</strong>);
        } else if (h3) {
            flushList();
            result.push(<strong key={i} style={{display: 'block', marginTop: '4px'}}>{renderInline(h3[1], i)}</strong>);
        } else if (li) {
            listItems.push(<li key={i}>{renderInline(li[1], i)}</li>);
        } else if (ol) {
            listItems.push(<li key={i}>{renderInline(ol[1], i)}</li>);
        } else if (hr) {
            flushList();
            result.push(<hr key={i} style={{border: 'none', borderTop: '1px solid #ddd', margin: '6px 0'}} />);
        } else {
            flushList();
            if (line === '') {
                result.push(<br key={i} />);
            } else {
                result.push(<span key={i} style={{display: 'block'}}>{renderInline(line, i)}</span>);
            }
        }
    });
    flushList();
    return result;
};

const MessageRow = ({message}) => {
    if (message.role === 'tool') {
        return (
            <div className="as-chat-message as-chat-tool">
                <span className="as-chat-tool-icon">🔧</span>
                <span className="as-chat-tool-text">{message.text}</span>
                {message.status === 'running' && <span className="as-chat-tool-spinner" />}
                {message.status === 'error' && <span className="as-chat-tool-status">⚠️</span>}
                {message.status === 'done' && <span className="as-chat-tool-status">✓</span>}
            </div>
        );
    }
    if (message.role === 'error') {
        return <div className="as-chat-message as-chat-error">{message.text}</div>;
    }
    if (message.role === 'assistant') {
        return (
            <div className="as-chat-message as-chat-assistant">
                {renderMarkdownLite(message.text)}
            </div>
        );
    }
    return (
        <div className="as-chat-message as-chat-user">
            {message.text}
        </div>
    );
};

const formatCost = cost => (cost >= 0.01 ? `$${cost.toFixed(2)}` : `$${cost.toFixed(4)}`);

// 応答待ちインジケータ(ツール入力の生成中はその進捗を表示)
const ThinkingRow = ({drafting}) => (
    <div className="as-chat-message as-chat-tool">
        <span className="as-chat-tool-spinner" />
        <span className="as-chat-tool-text">
            {drafting ?
                `${drafting.label}...${drafting.chars > 0 ? ` (${drafting.chars}文字)` : ''}` :
                '考え中...'}
        </span>
    </div>
);

const ChatPanel = ({
    messages,
    running,
    drafting,
    hasApiKey,
    trialMode,
    sessionCost,
    totalCost,
    blocksEnabled,
    onSend,
    onStop,
    onOpenSettings,
    onToggleBlocks
}) => {
    const canSend = hasApiKey || trialMode;
    const [input, setInput] = useState('');
    const historyRef = useRef(null);
    const sentHistory = useRef([]);   // 送信済みテキストの履歴
    const historyIndex = useRef(-1);  // -1 = 現在の入力、0以上 = 履歴参照中
    const savedInput = useRef('');    // 履歴をたどる前の入力を退避

    useEffect(() => {
        const el = historyRef.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages, running]);

    // ストリーミング表示中・ツール実行中は「考え中...」を重ねて出さない
    // (ただしツール入力の生成中(drafting)は進捗として常に表示)
    const lastMessage = messages[messages.length - 1];
    const showThinking = running && (drafting || !(
        (lastMessage && lastMessage.role === 'assistant' && lastMessage.streaming) ||
        (lastMessage && lastMessage.role === 'tool' && lastMessage.status === 'running')
    ));

    const submit = () => {
        const text = input.trim();
        if (!text || running) return;
        sentHistory.current = [text, ...sentHistory.current].slice(0, 100);
        historyIndex.current = -1;
        savedInput.current = '';
        setInput('');
        onSend(text);
    };

    const handleKeyDown = e => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
            return;
        }
        const history = sentHistory.current;
        if (e.key === 'ArrowUp' && e.target.selectionStart === 0 && history.length > 0) {
            e.preventDefault();
            if (historyIndex.current === -1) savedInput.current = input;
            const next = Math.min(historyIndex.current + 1, history.length - 1);
            historyIndex.current = next;
            setInput(history[next]);
        } else if (e.key === 'ArrowDown' && historyIndex.current >= 0) {
            e.preventDefault();
            const next = historyIndex.current - 1;
            historyIndex.current = next;
            setInput(next === -1 ? savedInput.current : history[next]);
        }
    };

    return (
        <div className="as-chat-panel">
            <div className="as-chat-header">
                <span className="as-chat-title">AI アシスタント</span>
                <button
                    className="as-chat-settings-button"
                    title="APIキー設定"
                    onClick={onOpenSettings}
                >⚙️</button>
            </div>
            <div className="as-chat-history" ref={historyRef}>
                {messages.length === 0 && (
                    <div className="as-chat-placeholder">
                        作りたいものを日本語で指示してください。<br />
                        例:「ネコが旗をクリックしたら右に動き続けるようにして」
                    </div>
                )}
                {messages.map((m, i) => <MessageRow key={i} message={m} />)}
                {showThinking && <ThinkingRow drafting={drafting} />}
            </div>
            <div className="as-chat-input-area">
                {hasApiKey && (
                    <div className="as-chat-cost" title="トークン使用量から計算した概算です">
                        コスト(概算): このセッション {formatCost(sessionCost)} / 累計 {formatCost(totalCost)}
                    </div>
                )}
                {trialMode && (
                    <div className="as-chat-trial" onClick={onOpenSettings}>
                        🎁 お試しモードで利用中(DeepSeek V3・制限あり)。⚙️ から自分の API キーを設定できます
                    </div>
                )}
                {!canSend && (
                    <div className="as-chat-no-key" onClick={onOpenSettings}>
                        ⚙️ をクリックして Anthropic API キーを設定してください
                    </div>
                )}
                <div className="as-chat-toggle-row">
                    <span className="as-chat-toggle-desc">ブロック操作</span>
                    <span
                        className={`as-chat-toggle-switch${blocksEnabled ? ' as-chat-toggle-on' : ''}`}
                        onClick={onToggleBlocks}
                    >
                        <span className="as-chat-toggle-knob" />
                    </span>
                </div>
                <textarea
                    className="as-chat-input"
                    value={input}
                    placeholder="指示を入力..."
                    rows={5}
                    disabled={!canSend}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                {running ? (
                    <button className="as-chat-button as-chat-stop" onClick={onStop}>
                        ■ 停止
                    </button>
                ) : (
                    <button
                        className="as-chat-button as-chat-send"
                        disabled={!canSend || !input.trim()}
                        onClick={submit}
                    >
                        送信
                    </button>
                )}
            </div>
        </div>
    );
};

export default ChatPanel;
