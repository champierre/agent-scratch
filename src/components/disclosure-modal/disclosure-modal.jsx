import React from 'react';
import '../api-key-modal/api-key-modal.css';

// 初回起動時に表示する説明ダイアログ(AI利用の開示)。
// 太字の強調を保つため、言語ごとに本文 JSX を用意する。
const BODY = {
    ja: {
        title: 'はじめにお読みください',
        accept: 'わかりました',
        content: (
            <>
                <p>
                    右側の「AI アシスタント」とおしゃべりする相手は、
                    人間ではなく <strong>AI</strong>です。
                </p>
                <ul className="as-modal-list">
                    <li>18歳未満の人は、<strong>保護者や先生などの大人といっしょに</strong>使ってください</li>
                    <li>入力した内容は AI のサーバに送られます。<strong>名前・住所などの個人情報は入力しない</strong>でください</li>
                    <li>AI の答えはまちがっていることもあります</li>
                </ul>
            </>
        )
    },
    en: {
        title: 'Please read this first',
        accept: 'Got it',
        content: (
            <>
                <p>
                    The "AI Assistant" on the right that you chat with is
                    not a human but an <strong>AI</strong>.
                </p>
                <ul className="as-modal-list">
                    <li>If you are under 18, please use it <strong>together with an adult such as a parent or teacher</strong></li>
                    <li>What you type is sent to the AI's server. <strong>Do not enter personal information such as your name or address</strong></li>
                    <li>The AI's answers can sometimes be wrong</li>
                </ul>
            </>
        )
    }
};

const DisclosureModal = ({lang = 'ja', onAccept}) => {
    const b = BODY[lang] || BODY.ja;
    return (
        <div className="as-modal-overlay">
            <div className="as-modal">
                <div className="as-modal-header">{b.title}</div>
                <div className="as-modal-body">
                    {b.content}
                </div>
                <div className="as-modal-footer">
                    <button className="as-modal-button as-modal-save" onClick={onAccept}>
                        {b.accept}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DisclosureModal;
