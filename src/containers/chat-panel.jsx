import React, {useCallback, useRef, useState} from 'react';
import ChatPanelComponent from '../components/chat-panel/chat-panel.jsx';
import ApiKeyModal from '../components/api-key-modal/api-key-modal.jsx';
import {runAgent, AuthError} from '../agent/agent-loop';

const STORAGE_KEY = 'agent-scratch-api-key';

const ChatPanel = ({vm}) => {
    const [messages, setMessages] = useState([]);
    const [running, setRunning] = useState(false);
    const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
    const [showModal, setShowModal] = useState(false);

    // Anthropic API 形式の会話履歴(マルチターン対応)
    const apiMessagesRef = useRef([]);
    const abortRef = useRef(null);

    const appendMessage = useCallback(m => {
        setMessages(prev => [...prev, m]);
    }, []);

    // 直近の実行中ツール表示を done/error に更新する
    const finishLastTool = useCallback(ok => {
        setMessages(prev => {
            const next = [...prev];
            for (let i = next.length - 1; i >= 0; i--) {
                if (next[i].role === 'tool' && next[i].status === 'running') {
                    next[i] = {...next[i], status: ok ? 'done' : 'error'};
                    break;
                }
            }
            return next;
        });
    }, []);

    const handleSend = useCallback(async text => {
        if (!vm) {
            appendMessage({role: 'error', text: 'Scratch エディタの読み込みが完了していません。'});
            return;
        }
        appendMessage({role: 'user', text});
        setRunning(true);
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            await runAgent({
                apiKey,
                vm,
                userText: text,
                apiMessages: apiMessagesRef.current,
                signal: controller.signal,
                onAssistantText: t => appendMessage({role: 'assistant', text: t}),
                onToolStart: summary => appendMessage({role: 'tool', text: summary, status: 'running'}),
                onToolEnd: ok => finishLastTool(ok)
            });
        } catch (e) {
            if (e instanceof AuthError) {
                appendMessage({role: 'error', text: 'APIキーが無効です。設定し直してください。'});
                setShowModal(true);
            } else if (e.name === 'AbortError' || controller.signal.aborted) {
                appendMessage({role: 'assistant', text: '(停止しました)'});
            } else {
                appendMessage({role: 'error', text: `エラー: ${e.message}`});
            }
        } finally {
            setRunning(false);
            abortRef.current = null;
        }
    }, [vm, apiKey, appendMessage, finishLastTool]);

    const handleStop = useCallback(() => {
        if (abortRef.current) abortRef.current.abort();
    }, []);

    const handleSaveApiKey = useCallback(key => {
        localStorage.setItem(STORAGE_KEY, key);
        setApiKey(key);
        setShowModal(false);
    }, []);

    return (
        <>
            <ChatPanelComponent
                messages={messages}
                running={running}
                hasApiKey={!!apiKey}
                onSend={handleSend}
                onStop={handleStop}
                onOpenSettings={() => setShowModal(true)}
            />
            {showModal && (
                <ApiKeyModal
                    initialApiKey={apiKey}
                    onSave={handleSaveApiKey}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    );
};

export default ChatPanel;
