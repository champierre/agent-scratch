import React, {useCallback, useRef, useState} from 'react';
import ChatPanelComponent from '../components/chat-panel/chat-panel.jsx';
import ApiKeyModal from '../components/api-key-modal/api-key-modal.jsx';
import DisclosureModal from '../components/disclosure-modal/disclosure-modal.jsx';
import {runAgent, AuthError, getModel, setModel, isTrialAvailable, getDeepSeekApiKey, setDeepSeekApiKey, isDeepSeekModel, getOpenAIApiKey, setOpenAIApiKey, isOpenAIModel, getGeminiApiKey, setGeminiApiKey, isGeminiModel, DEV_ANTHROPIC_KEY} from '../agent/agent-loop';

const STORAGE_KEY = 'agent-scratch-api-key';
const DISCLOSURE_STORAGE_KEY = 'agent-scratch-disclosure-accepted';

const ChatPanel = ({vm}) => {
    const [messages, setMessages] = useState([]);
    const [running, setRunning] = useState(false);
    const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) || DEV_ANTHROPIC_KEY || '');
    const [deepseekApiKey, setDeepseekApiKeyState] = useState(() => getDeepSeekApiKey());
    const [openaiApiKey, setOpenaiApiKeyState] = useState(() => getOpenAIApiKey());
    const [geminiApiKey, setGeminiApiKeyState] = useState(() => getGeminiApiKey());
    const [blocksEnabled, setBlocksEnabled] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDisclosure, setShowDisclosure] = useState(
        () => !localStorage.getItem(DISCLOSURE_STORAGE_KEY)
    );
    // ツール入力生成中の進捗表示("ブロックを書いています (1200文字)" など)
    const [drafting, setDrafting] = useState(null);
    const [currentModel, setCurrentModel] = useState(() => getModel());

    // Anthropic API 形式の会話履歴(マルチターン対応)
    const apiMessagesRef = useRef([]);
    const abortRef = useRef(null);

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

    // 直近の実行中ツール表示を done/error に更新する(エラー時は詳細も保持)
    const finishLastTool = useCallback((ok, detail) => {
        setMessages(prev => {
            const next = [...prev];
            for (let i = next.length - 1; i >= 0; i--) {
                if (next[i].role === 'tool' && next[i].status === 'running') {
                    next[i] = {
                        ...next[i],
                        status: ok ? 'done' : 'error',
                        ...(detail ? {detail} : {})
                    };
                    break;
                }
            }
            return next;
        });
    }, []);

    const handleSend = useCallback(async (text, opts = {}) => {
        if (!vm) {
            appendMessage({role: 'error', text: 'Scratch エディタの読み込みが完了していません。'});
            return;
        }
        // ブロック操作の有効/無効は state(単一の真実)を使う。
        // サジェスト等で一時的に無効化したい場合は呼び出し時に明示指定する
        // (state 更新は非同期なので、ここで引数として確実に受け取る)
        const effectiveBlocksEnabled = opts.forceBlocksDisabled ? false : blocksEnabled;
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
                blocksEnabled: effectiveBlocksEnabled,
                onAssistantStart: startAssistant,
                onAssistantDelta: appendAssistantDelta,
                onAssistantText: t => appendMessage({role: 'assistant', text: t}),
                onToolStart: summary => {
                    setDrafting(null);
                    appendMessage({role: 'tool', text: summary, status: 'running'});
                },
                onToolEnd: (ok, detail) => finishLastTool(ok, detail),
                onToolDrafting: (label, chars) => {
                    setDrafting(label ? {label, chars} : null);
                }
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
    }, [vm, apiKey, blocksEnabled, appendMessage, finishLastTool, startAssistant, appendAssistantDelta, finishStreaming]);

    const handleStop = useCallback(() => {
        if (abortRef.current) abortRef.current.abort();
    }, []);

    const handleSaveApiKey = useCallback((key, model, dsKey, oaKey, gemKey) => {
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
        if (gemKey !== undefined) {
            setGeminiApiKey(gemKey);
            setGeminiApiKeyState(gemKey);
        }
        setShowModal(false);
    }, []);

    const trialModeNow = !apiKey && !deepseekApiKey && !openaiApiKey && !geminiApiKey && isTrialAvailable();

    return (
        <>
            <ChatPanelComponent
                messages={messages}
                running={running}
                drafting={drafting}
                hasApiKey={
                    isDeepSeekModel(getModel()) ? !!deepseekApiKey :
                        isOpenAIModel(getModel()) ? !!openaiApiKey :
                            isGeminiModel(getModel()) ? !!geminiApiKey : !!apiKey
                }
                trialMode={trialModeNow}
                currentModel={currentModel}
                blocksEnabled={trialModeNow ? false : blocksEnabled}
                onSend={handleSend}
                onStop={handleStop}
                onOpenSettings={() => setShowModal(true)}
                onToggleBlocks={() => setBlocksEnabled(v => !v)}
                onSetBlocksEnabled={v => setBlocksEnabled(v)}
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
                    initialGeminiApiKey={geminiApiKey}
                    initialModel={getModel()}
                    onSave={handleSaveApiKey}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    );
};

export default ChatPanel;
