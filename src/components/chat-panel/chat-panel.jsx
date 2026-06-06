import React, {useEffect, useRef, useState} from 'react';
import scratchblocks from 'scratchblocks';
import jaLocale from 'scratchblocks/locales/ja.json';
import jaHiraLocale from 'scratchblocks/locales/ja-Hira.json';
import {BLOCK_LABELS, getBlockLabel, findOpcodeByJaName, isRedundantJaAnnotation} from '../../agent/block-labels.js';
import {isDeepSeekModel, isOpenAIModel, isGeminiModel} from '../../agent/agent-loop';
import './chat-panel.css';

// 日本語ロケールを登録
scratchblocks.loadLanguages({'ja': jaLocale, 'ja-Hira': jaHiraLocale});

// ブラウザの言語設定からscratchblocksに渡すlanguagesを決定
const getSbLanguages = () => {
    const lang = (navigator.language || 'en').toLowerCase();
    if (lang.startsWith('ja')) return ['ja', 'en'];
    return ['en'];
};

// opcode を scratchblocks SVG に変換するコンポーネント
//
// 検出パターンは「登録済み opcode(BLOCK_LABELS のキー)の完全一致リスト」から
// 自動生成する。汎用の識別子パターン推測ではないため、登録済み opcode の
// 取りこぼし(数字入り・複数アンダースコア等)が構造的に起きず、
// opcode を追加すれば自動で検出対象になる。
// 長いキー優先で並べ、前後が単語文字でないことを lookaround で保証する
// (例: control_if_else の中の control_if に誤マッチしない)。
const OPCODE_RE = new RegExp(
    `(?<![A-Za-z0-9_])(${
        Object.keys(BLOCK_LABELS)
            .sort((a, b) => b.length - a.length)
            .join('|')
    })(?![A-Za-z0-9_])`,
    'g'
);
const SB_LANGUAGES = getSbLanguages();

const BlockImage = ({opcode, keyStr}) => {
    const ref = useRef(null);
    const lang = navigator.language || 'en';
    const label = getBlockLabel(opcode, lang);

    useEffect(() => {
        if (!ref.current || !label) return;
        ref.current.innerHTML = '';
        const doc = scratchblocks.parse(label, {inline: true, languages: SB_LANGUAGES});
        const svg = scratchblocks.render(doc, {style: 'scratch3', scale: 0.65});
        ref.current.appendChild(svg);
    }, [label]);

    // フック呼び出しの後で early return する(Reactのフック順序を守る)
    if (!label) return <code key={keyStr}>{opcode}</code>;

    return (
        <span
            ref={ref}
            style={{display: 'inline-block', verticalAlign: 'middle', margin: '0 1px'}}
            title={opcode}
        />
    );
};

// テキスト中の opcode を BlockImage に変換
// 「ずっと」「10歩動かす」のようにカギ括弧で書かれた日本語ブロック名を
// ブロック画像に変換する(opcodeで書かないモデルへのロジック側の救済)
const JA_QUOTED_RE = /「([^「」]{2,40})」/g;

// ブロック画像の直後に「(同じブロックの日本語名)」が続く場合は冗長なので読み飛ばす
// 例: motion_movesteps(10歩動かす) → 画像のみ表示
const PAREN_ANNOTATION_RE = /^\s*[（(]([^（）()]{1,50})[）)]/;
const skipRedundantAnnotation = (text, pos, opcode) => {
    const m = text.slice(pos).match(PAREN_ANNOTATION_RE);
    if (m && isRedundantJaAnnotation(m[1], opcode)) return pos + m[0].length;
    return pos;
};

const renderJaQuotedBlocks = (text, keyPrefix) => {
    const parts = [];
    let last = 0;
    let match;
    JA_QUOTED_RE.lastIndex = 0;
    while ((match = JA_QUOTED_RE.exec(text)) !== null) {
        const opcode = findOpcodeByJaName(match[1]);
        if (!opcode) continue;
        if (match.index > last) parts.push(text.slice(last, match.index));
        parts.push(<BlockImage key={`${keyPrefix}-ja-${match.index}`} opcode={opcode} keyStr={`${keyPrefix}-ja-${match.index}`} />);
        last = skipRedundantAnnotation(text, match.index + match[0].length, opcode);
        JA_QUOTED_RE.lastIndex = last;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length > 0 ? parts : [text];
};

const renderWithBlocks = (text, keyPrefix) => {
    const parts = [];
    let last = 0;
    let match;
    OPCODE_RE.lastIndex = 0;
    while ((match = OPCODE_RE.exec(text)) !== null) {
        const opcode = match[1];
        if (!BLOCK_LABELS[opcode]) continue;
        if (match.index > last) parts.push(...renderJaQuotedBlocks(text.slice(last, match.index), `${keyPrefix}-${last}`));
        parts.push(<BlockImage key={`${keyPrefix}-blk-${match.index}`} opcode={opcode} keyStr={`${keyPrefix}-${match.index}`} />);
        last = skipRedundantAnnotation(text, match.index + match[0].length, opcode);
        OPCODE_RE.lastIndex = last;
    }
    if (last < text.length) parts.push(...renderJaQuotedBlocks(text.slice(last), `${keyPrefix}-${last}`));
    return parts.length > 0 ? parts : [text];
};

// 行内マークダウン(**太字** と `コード`) + opcode ブロック画像 をReact要素に変換
const renderInline = (text, keyPrefix) => {
    const parts = [];
    text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).forEach((seg, i) => {
        if (/^\*\*[^*]+\*\*$/.test(seg)) {
            parts.push(<strong key={`${keyPrefix}-${i}`}>{renderWithBlocks(seg.slice(2, -2), `${keyPrefix}-${i}`)}</strong>);
        } else if (/^`[^`]+`$/.test(seg)) {
            // バッククォート内は opcode として扱いブロック画像に変換
            const inner = seg.slice(1, -1);
            if (BLOCK_LABELS[inner]) {
                parts.push(<BlockImage key={`${keyPrefix}-${i}`} opcode={inner} keyStr={`${keyPrefix}-${i}`} />);
            } else {
                parts.push(<code key={`${keyPrefix}-${i}`}>{inner}</code>);
            }
        } else if (seg) {
            parts.push(...renderWithBlocks(seg, `${keyPrefix}-${i}`));
        }
    });
    return parts;
};

// 行単位のブロック要素(見出し・リスト・区切り線・コードブロック)も処理するマークダウン描画
const renderMarkdownLite = text => {
    // コードブロック(```...```)を先に分割し、その中はプレーンテキストとして扱う
    const segments = text.split(/(```[\s\S]*?```)/g);
    const result = [];

    segments.forEach((seg, segIdx) => {
        if (/^```[\s\S]*```$/.test(seg)) {
            // フェンスと言語指定行を除いた中身をそのまま表示
            const inner = seg.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
            result.push(
                <pre key={`pre-${segIdx}`} style={{
                    background: '#f5f5f5', borderRadius: '4px', padding: '6px 8px',
                    fontSize: '11px', overflowX: 'auto', margin: '4px 0', whiteSpace: 'pre-wrap'
                }}>{inner}</pre>
            );
            return;
        }

        const lines = seg.split('\n');
        let listItems = [];

        const flushList = () => {
            if (listItems.length > 0) {
                result.push(<ul key={`ul-${result.length}`} style={{margin: '4px 0', paddingLeft: '18px'}}>{listItems}</ul>);
                listItems = [];
            }
        };

        lines.forEach((line, i) => {
            const key = `${segIdx}-${i}`;
            const h2 = line.match(/^##\s+(.+)/);
            const h3 = line.match(/^###\s+(.+)/);
            const li = line.match(/^[-*]\s+(.+)/);
            const ol = line.match(/^\d+\.\s+(.+)/);
            const hr = /^---+$/.test(line.trim());

            if (h2) {
                flushList();
                result.push(<strong key={key} style={{display: 'block', fontSize: '14px', marginTop: '6px'}}>{renderInline(h2[1], key)}</strong>);
            } else if (h3) {
                flushList();
                result.push(<strong key={key} style={{display: 'block', marginTop: '4px'}}>{renderInline(h3[1], key)}</strong>);
            } else if (li) {
                listItems.push(<li key={key}>{renderInline(li[1], key)}</li>);
            } else if (ol) {
                listItems.push(<li key={key}>{renderInline(ol[1], key)}</li>);
            } else if (hr) {
                flushList();
                result.push(<hr key={key} style={{border: 'none', borderTop: '1px solid #ddd', margin: '6px 0'}} />);
            } else {
                flushList();
                if (line === '') {
                    result.push(<br key={key} />);
                } else {
                    result.push(<span key={key} style={{display: 'block'}}>{renderInline(line, key)}</span>);
                }
            }
        });
        flushList();
    });

    return result;
};

// ツール行(エラー時はクリックで詳細を開閉し、コピーできる)
const ToolRow = ({message}) => {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const hasDetail = message.status === 'error' && message.detail;

    const copyDetail = e => {
        e.stopPropagation();
        navigator.clipboard.writeText(message.detail).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <div className="as-chat-tool-wrap">
            <div
                className={`as-chat-message as-chat-tool${hasDetail ? ' as-chat-tool-clickable' : ''}`}
                title={hasDetail ? 'クリックでエラー内容を表示' : undefined}
                onClick={hasDetail ? () => setExpanded(v => !v) : undefined}
            >
                <span className="as-chat-tool-icon">🔧</span>
                <span className="as-chat-tool-text">{message.text}</span>
                {message.status === 'running' && <span className="as-chat-tool-spinner" />}
                {message.status === 'error' && <span className="as-chat-tool-status">⚠️</span>}
                {message.status === 'done' && <span className="as-chat-tool-status">✓</span>}
            </div>
            {expanded && hasDetail && (
                <div className="as-chat-tool-detail">
                    <pre className="as-chat-tool-detail-text">{message.detail}</pre>
                    <button className="as-chat-tool-copy" onClick={copyDetail}>
                        {copied ? 'コピーしました ✓' : 'コピー'}
                    </button>
                </div>
            )}
        </div>
    );
};

const MessageRow = ({message}) => {
    if (message.role === 'tool') {
        return <ToolRow message={message} />;
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

// モデルのプロバイダごとの料金ページ(コスト概算は誤差が大きいため、公式料金表へのリンクを示す)
const PRICING_PAGES = {
    anthropic: {label: 'Anthropic', url: 'https://docs.claude.com/en/docs/about-claude/pricing'},
    deepseek: {label: 'DeepSeek', url: 'https://api-docs.deepseek.com/quick_start/pricing'},
    openai: {label: 'OpenAI', url: 'https://platform.openai.com/docs/pricing'},
    gemini: {label: 'Google Gemini', url: 'https://ai.google.dev/gemini-api/docs/pricing'}
};
const pricingPageFor = model => {
    if (isDeepSeekModel(model)) return PRICING_PAGES.deepseek;
    if (isOpenAIModel(model)) return PRICING_PAGES.openai;
    if (isGeminiModel(model)) return PRICING_PAGES.gemini;
    return PRICING_PAGES.anthropic;
};

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

const SUGGESTIONS = [
    {label: 'ネコ逃げゲームを教えて', text: 'https://github.com/champierre/nekonige で紹介しているネコ逃げゲームの作り方を教えて', disableBlocks: true},
    {label: 'ネコを動かして', text: 'ネコが旗をクリックしたら右に動き続けるようにして'}
];

const ChatPanel = ({
    messages,
    running,
    drafting,
    hasApiKey,
    trialMode,
    currentModel,
    blocksEnabled,
    onSend,
    onStop,
    onOpenSettings,
    onToggleBlocks,
    onSetBlocksEnabled
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
                {currentModel && (
                    <div className="as-chat-cost">
                        <span style={{marginRight: '6px', opacity: 0.7}}>[{currentModel}]</span>
                        <a href={pricingPageFor(currentModel).url} target="_blank" rel="noreferrer">
                            {pricingPageFor(currentModel).label} の料金表(API利用料)
                        </a>
                    </div>
                )}
                {trialMode && (
                    <div className="as-chat-trial" onClick={onOpenSettings}>
                        🎁 お試しモードで利用中(DeepSeek V3・制限あり)。⚙️ から自分の API キーを設定できます
                    </div>
                )}
                {!canSend && (
                    <div className="as-chat-no-key" onClick={onOpenSettings}>
                        ⚙️ をクリックして API キーを設定してください
                    </div>
                )}
                <div
                    className="as-chat-toggle-row"
                    title={trialMode ? 'お試しモードではブロック操作は使えません。⚙️ から自分の API キーを設定すると使えます' : undefined}
                >
                    <span className="as-chat-toggle-desc">ブロック操作</span>
                    <span
                        className={`as-chat-toggle-switch${!trialMode && blocksEnabled ? ' as-chat-toggle-on' : ''}${trialMode ? ' as-chat-toggle-disabled' : ''}`}
                        onClick={trialMode ? undefined : onToggleBlocks}
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
                {!running && (
                    <div className="as-chat-suggestions">
                        {SUGGESTIONS.map(s => (
                            <button
                                key={s.label}
                                className="as-chat-suggestion-badge"
                                disabled={!canSend}
                                onClick={() => {
                                    if (!canSend) return;
                                    if (s.disableBlocks && blocksEnabled && onSetBlocksEnabled) {
                                        onSetBlocksEnabled(false);
                                    }
                                    onSend(s.text);
                                }}
                            >{s.label}</button>
                        ))}
                    </div>
                )}
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
