import React, {useCallback, useRef, useState} from 'react';
import ChatPanelComponent from '../components/chat-panel/chat-panel.jsx';
import ApiKeyModal from '../components/api-key-modal/api-key-modal.jsx';
import DisclosureModal from '../components/disclosure-modal/disclosure-modal.jsx';
import {runAgent, AuthError, getModel, setModel, isTrialAvailable, getDeepSeekApiKey, setDeepSeekApiKey, isDeepSeekModel, getOpenAIApiKey, setOpenAIApiKey, isOpenAIModel, DEV_ANTHROPIC_KEY} from '../agent/agent-loop';

const STORAGE_KEY = 'agent-scratch-api-key';
const COST_STORAGE_KEY = 'agent-scratch-total-cost';
const DISCLOSURE_STORAGE_KEY = 'agent-scratch-disclosure-accepted';

const ChatPanel = ({vm}) => {
    const [messages, setMessages] = useState([]);
    const [running, setRunning] = useState(false);
    const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) || DEV_ANTHROPIC_KEY || '');
    const [deepseekApiKey, setDeepseekApiKeyState] = useState(() => getDeepSeekApiKey());
    const [openaiApiKey, setOpenaiApiKeyState] = useState(() => getOpenAIApiKey());
    const [blocksEnabled, setBlocksEnabled] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDisclosure, setShowDisclosure] = useState(
        () => !localStorage.getItem(DISCLOSURE_STORAGE_KEY)
    );
    // ツール入力生成中の進捗表示("ブロックを書いています (1200文字)" など)
    const [drafting, setDrafting] = useState(null);
    const [currentModel, setCurrentModel] = useState(() => getModel());
    const [sessionCost, setSessionCost] = useState(0);
    const [totalCost, setTotalCost] = useState(
        () => parseFloat(localStorage.getItem(COST_STORAGE_KEY)) || 0
    );

    // Anthropic API 形式の会話履歴(マルチターン対応)
    const apiMessagesRef = useRef([]);
    const abortRef = useRef(null);
    // blocksEnabled の最新値を ref でも保持 — useCallback の依存配列遅延を回避するため
    const blocksEnabledRef = useRef(blocksEnabled);

    const appendMessage = useCallback(m => {
        setMessages(prev => [...prev, m]);
    }, []);

    // ストリーミング: 次のdeltaで新しいassistant行を開始する合図
    const pendingNewAssistant = useRef(false);
    const startAssistant = useCallback(() => {
        pendingNewAssistant.current = true;
    }, []);

    // textの増分を末尾のstreaming行に追記(なければ新規作成)
    const appendAssistantDelta = useCallback(delta => {
        setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (pendingNewAssistant.current || !last || last.role !== 'assistant' || !last.streaming) {
                pendingNewAssistant.current = false;
                next.push({role: 'assistant', text: delta, streaming: true});
            } else {
                next[next.length - 1] = {...last, text: last.text + delta};
            }
            return next;
        });
    }, []);

    // 実行終了時にstreamingフラグを落とす(「考え中...」表示判定用)
    const finishStreaming = useCallback(() => {
        setMessages(prev => prev.map(m => (m.streaming ? {...m, streaming: false} : m)));
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

    const handleUsage = useCallback(cost => {
        setSessionCost(prev => prev + cost);
        setTotalCost(prev => {
            const next = prev + cost;
            localStorage.setItem(COST_STORAGE_KEY, String(next));
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
                blocksEnabled: blocksEnabledRef.current,
                onAssistantStart: startAssistant,
                onAssistantDelta: appendAssistantDelta,
                onAssistantText: t => appendMessage({role: 'assistant', text: t}),
                onToolStart: summary => {
                    setDrafting(null);
                    appendMessage({role: 'tool', text: summary, status: 'running'});
                },
                onToolEnd: ok => finishLastTool(ok),
                onToolDrafting: (label, chars) => {
                    setDrafting(label ? {label, chars} : null);
                },
                onUsage: handleUsage
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
            setDrafting(null);
            finishStreaming();
            abortRef.current = null;
        }
    }, [vm, apiKey, appendMessage, finishLastTool, handleUsage, startAssistant, appendAssistantDelta, finishStreaming]);

    const handleStop = useCallback(() => {
        if (abortRef.current) abortRef.current.abort();
    }, []);

    const handleSaveApiKey = useCallback((key, model, dsKey, oaKey) => {
        localStorage.setItem(STORAGE_KEY, key);
        setApiKey(key);
        if (model) { setModel(model); setCurrentModel(model); }
        if (dsKey !== undefined) {
            setDeepSeekApiKey(dsKey);
            setDeepseekApiKeyState(dsKey);
        }
        if (oaKey !== undefined) {
            setOpenAIApiKey(oaKey);
            setOpenaiApiKeyState(oaKey);
        }
        setShowModal(false);
    }, []);

    return (
        <>
            <ChatPanelComponent
                messages={messages}
                running={running}
                drafting={drafting}
                hasApiKey={
                    isDeepSeekModel(getModel()) ? !!deepseekApiKey :
                        isOpenAIModel(getModel()) ? !!openaiApiKey : !!apiKey
                }
                trialMode={!apiKey && !deepseekApiKey && !openaiApiKey && isTrialAvailable()}
                currentModel={currentModel}
                sessionCost={sessionCost}
                totalCost={totalCost}
                blocksEnabled={blocksEnabled}
                onSend={handleSend}
                onStop={handleStop}
                onOpenSettings={() => setShowModal(true)}
                onToggleBlocks={() => setBlocksEnabled(v => { blocksEnabledRef.current = !v; return !v; })}
                onSetBlocksEnabled={v => { blocksEnabledRef.current = v; setBlocksEnabled(v); }}
            />
            {showDisclosure && (
                <DisclosureModal
                    onAccept={() => {
                        localStorage.setItem(DISCLOSURE_STORAGE_KEY, '1');
                        setShowDisclosure(false);
                    }}
                />
            )}
            {showModal && (
                <ApiKeyModal
                    initialApiKey={apiKey}
                    initialDeepSeekApiKey={deepseekApiKey}
                    initialOpenAIApiKey={openaiApiKey}
                    initialModel={getModel()}
                    onSave={handleSaveApiKey}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    );
};

export default ChatPanel;
