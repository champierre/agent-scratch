import React from 'react';
import '../api-key-modal/api-key-modal.css';

// 初回起動時に表示する説明ダイアログ(AI利用の開示)
const DisclosureModal = ({onAccept}) => (
    <div className="as-modal-overlay">
        <div className="as-modal">
            <div className="as-modal-header">はじめにお読みください</div>
            <div className="as-modal-body">
                <p>
                    右側の「AI アシスタント」とおしゃべりする相手は、
                    人間ではなく <strong>AI(Anthropic社の Claude)</strong>です。
                </p>
                <ul className="as-modal-list">
                    <li>18歳未満の人は、<strong>保護者や先生などの大人といっしょに</strong>使ってください</li>
                    <li>入力した内容は AI のサーバ(Anthropic)に送られます。<strong>名前・住所などの個人情報は入力しない</strong>でください</li>
                    <li>AI の答えはまちがっていることもあります</li>
                </ul>
            </div>
            <div className="as-modal-footer">
                <button className="as-modal-button as-modal-save" onClick={onAccept}>
                    わかりました
                </button>
            </div>
        </div>
    </div>
);

export default DisclosureModal;
