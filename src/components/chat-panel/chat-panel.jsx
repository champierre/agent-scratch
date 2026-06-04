import React, {useEffect, useRef, useState} from 'react';
import './chat-panel.css';

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
    return (
        <div className={`as-chat-message ${message.role === 'user' ? 'as-chat-user' : 'as-chat-assistant'}`}>
            {message.text}
        </div>
    );
};

const ChatPanel = ({
    messages,
    running,
    hasApiKey,
    onSend,
    onStop,
    onOpenSettings
}) => {
    const [input, setInput] = useState('');
    const historyRef = useRef(null);

    useEffect(() => {
        const el = historyRef.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages]);

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
            </div>
            <div className="as-chat-input-area">
                {!hasApiKey && (
                    <div className="as-chat-no-key" onClick={onOpenSettings}>
                        ⚙️ をクリックして Anthropic API キーを設定してください
                    </div>
                )}
                <textarea
                    className="as-chat-input"
                    value={input}
                    placeholder="指示を入力..."
                    rows={3}
                    disabled={!hasApiKey}
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
                        disabled={!hasApiKey || !input.trim()}
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
