import React, {useState} from 'react';
import './api-key-modal.css';

const MODELS = [
    {id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5(最速・最安/デフォルト)'},
    {id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6(バランス型)'},
    {id: 'claude-opus-4-8', label: 'Claude Opus 4.8(最高性能・高コスト)'}
];

const ApiKeyModal = ({initialApiKey, initialModel, onSave, onClose}) => {
    const [value, setValue] = useState(initialApiKey || '');
    const [model, setModelValue] = useState(initialModel || MODELS[0].id);

    const save = () => {
        onSave(value.trim(), model);
    };

    return (
        <div className="as-modal-overlay" onClick={onClose}>
            <div className="as-modal" onClick={e => e.stopPropagation()}>
                <div className="as-modal-header">Anthropic API キー設定</div>
                <div className="as-modal-body">
                    <p>
                        Claude を利用するための API キーを入力してください。
                        キーはこのブラウザの localStorage にのみ保存されます。
                    </p>
                    <input
                        type="password"
                        className="as-modal-input"
                        placeholder="sk-ant-..."
                        value={value}
                        autoFocus
                        onChange={e => setValue(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') save();
                        }}
                    />
                    <p className="as-modal-hint">
                        API キーは <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">Anthropic Console</a> で取得できます。
                    </p>
                    <label className="as-modal-label">
                        使用モデル
                        <select
                            className="as-modal-select"
                            value={model}
                            onChange={e => setModelValue(e.target.value)}
                        >
                            {MODELS.map(m => (
                                <option key={m.id} value={m.id}>{m.label}</option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="as-modal-footer">
                    <button className="as-modal-button as-modal-cancel" onClick={onClose}>キャンセル</button>
                    <button
                        className="as-modal-button as-modal-save"
                        disabled={!value.trim()}
                        onClick={save}
                    >保存</button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;
