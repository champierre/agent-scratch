import React, {useState} from 'react';
import {isDeepSeekModel, isOpenAIModel} from '../../agent/agent-loop';
import './api-key-modal.css';

const MODELS = [
    {id: 'deepseek-chat', label: 'DeepSeek V3(低コスト・高性能) ★推奨', provider: 'deepseek'},
    {id: 'deepseek-reasoner', label: 'DeepSeek R1(推論特化)', provider: 'deepseek'},
    {id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5(最速・最安)', provider: 'anthropic'},
    {id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6(バランス型)', provider: 'anthropic'},
    {id: 'claude-opus-4-8', label: 'Claude Opus 4.8(最高性能・高コスト)', provider: 'anthropic'},
    {id: 'gpt-5.1', label: 'GPT-5.1(高性能)', provider: 'openai'},
    {id: 'gpt-5-mini', label: 'GPT-5 mini(低コスト)', provider: 'openai'},
    {id: 'gpt-5-nano', label: 'GPT-5 nano(最速・最安)', provider: 'openai'}
];

const ApiKeyModal = ({initialApiKey, initialDeepSeekApiKey, initialOpenAIApiKey, initialModel, onSave, onClose}) => {
    const [value, setValue] = useState(initialApiKey || '');
    const [deepseekValue, setDeepseekValue] = useState(initialDeepSeekApiKey || '');
    const [openaiValue, setOpenaiValue] = useState(initialOpenAIApiKey || '');
    const [model, setModelValue] = useState(initialModel || MODELS[0].id);

    const needsDeepSeek = isDeepSeekModel(model);
    const needsOpenAI = isOpenAIModel(model);
    const canSave = needsDeepSeek ? deepseekValue.trim() :
        needsOpenAI ? openaiValue.trim() : value.trim();

    const save = () => {
        if (!canSave) return;
        onSave(value.trim(), model, deepseekValue.trim(), openaiValue.trim());
    };

    return (
        <div className="as-modal-overlay" onClick={onClose}>
            <div className="as-modal" onClick={e => e.stopPropagation()}>
                <div className="as-modal-header">API キー / モデル設定</div>
                <div className="as-modal-body">
                    <label className="as-modal-label">
                        使用モデル
                        <select
                            className="as-modal-select"
                            value={model}
                            onChange={e => setModelValue(e.target.value)}
                        >
                            <optgroup label="DeepSeek">
                                {MODELS.filter(m => m.provider === 'deepseek').map(m => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Anthropic (Claude)">
                                {MODELS.filter(m => m.provider === 'anthropic').map(m => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                            </optgroup>
                            <optgroup label="OpenAI (GPT)">
                                {MODELS.filter(m => m.provider === 'openai').map(m => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                            </optgroup>
                        </select>
                    </label>

                    {!needsDeepSeek && !needsOpenAI && (
                        <>
                            <p style={{marginTop: '12px'}}>
                                Claude を利用するための Anthropic API キーを入力してください。
                                キーはこのブラウザの localStorage にのみ保存されます。
                            </p>
                            <input
                                type="password"
                                className="as-modal-input"
                                placeholder="sk-ant-..."
                                value={value}
                                autoFocus
                                onChange={e => setValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') save(); }}
                            />
                            <p className="as-modal-hint">
                                API キーは <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">Anthropic Console</a> で取得できます。
                            </p>
                        </>
                    )}

                    {needsDeepSeek && (
                        <>
                            <p style={{marginTop: '12px'}}>
                                DeepSeek API キーを入力してください。
                                キーはこのブラウザの localStorage にのみ保存されます。
                            </p>
                            <input
                                type="password"
                                className="as-modal-input"
                                placeholder="sk-..."
                                value={deepseekValue}
                                autoFocus
                                onChange={e => setDeepseekValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') save(); }}
                            />
                            <p className="as-modal-hint">
                                API キーは <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">DeepSeek Platform</a> で取得できます。
                            </p>
                        </>
                    )}

                    {needsOpenAI && (
                        <>
                            <p style={{marginTop: '12px'}}>
                                OpenAI API キーを入力してください。
                                キーはこのブラウザの localStorage にのみ保存されます。
                            </p>
                            <input
                                type="password"
                                className="as-modal-input"
                                placeholder="sk-..."
                                value={openaiValue}
                                autoFocus
                                onChange={e => setOpenaiValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') save(); }}
                            />
                            <p className="as-modal-hint">
                                API キーは <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">OpenAI Platform</a> で取得できます。
                            </p>
                        </>
                    )}
                </div>
                <div className="as-modal-footer">
                    <button className="as-modal-button as-modal-cancel" onClick={onClose}>キャンセル</button>
                    <button
                        className="as-modal-button as-modal-save"
                        disabled={!canSave}
                        onClick={save}
                    >保存</button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;
