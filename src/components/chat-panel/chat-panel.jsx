import React, {useEffect, useRef, useState} from 'react';
import './chat-panel.css';

// **太字** と `コード` だけの簡易マークダウン描画(HTMLは使わずReact要素に変換)
const renderMarkdownLite = text => {
    const parts = [];
    text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).forEach((seg, i) => {
        if (/^\*\*[^*]+\*\*$/.test(seg)) {
            parts.push(<strong key={i}>{seg.slice(2, -2)}</strong>);
        } else if (/^`[^`]+`$/.test(seg)) {
            parts.push(<code key={i}>{seg.slice(1, -1)}</code>);
        } else if (seg) {
            parts.push(seg);
        }
    });
    return parts;
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
    onSend,
    onStop,
    onOpenSettings
}) => {
    const canSend = hasApiKey || trialMode;
    const [input, setInput] = useState('');
    const historyRef = useRef(null);

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
        setInput('');
        onSend(text);
    };

    const handleKeyDown = e => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
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
                        🎁 お試しモードで利用中(Haiku・制限あり)。⚙️ から自分の API キーを設定できます
                    </div>
                )}
                {!canSend && (
                    <div className="as-chat-no-key" onClick={onOpenSettings}>
                        ⚙️ をクリックして Anthropic API キーを設定してください
                    </div>
                )}
                <textarea
                    className="as-chat-input"
                    value={input}
                    placeholder="指示を入力..."
                    rows={3}
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
