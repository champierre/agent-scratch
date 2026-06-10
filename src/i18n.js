// UI 文言の集約と言語判定ヘルパー。
//
// 単一の真実は Scratch の言語(vm.getLocale())。日本語系(ja / ja-Hira)は
// 'ja'、それ以外はすべて 'en' に畳む。state/ref に二重管理せず、表示・送信時に
// この lang を引数で明示的に渡す(CLAUDE.md の設計方針)。

// Scratch の locale コード('ja' / 'ja-Hira' / 'en' / 'fr' …) → 'ja' | 'en'
export const localeToLang = locale => (String(locale || '').startsWith('ja') ? 'ja' : 'en');

export const STRINGS = {
    ja: {
        // チャットパネル
        headerTitle: 'AI アシスタント',
        openAssistant: 'AI アシスタントを開く',
        closeAssistant: 'AI アシスタントを閉じる',
        settings: 'APIキー設定',
        placeholderLine1: '作りたいものを日本語で指示してください。',
        placeholderExample: '例:「ネコが旗をクリックしたら右に動き続けるようにして」',
        inputPlaceholder: '指示を入力...',
        send: '送信',
        stop: '■ 停止',
        thinking: '考え中...',
        toggleBlocks: 'ブロック操作',
        navMode: 'ナビ',
        driverMode: 'ドライバー',
        toggleDisabledTitle: 'お試しモードではブロック操作は使えません。⚙️ から自分の API キーを設定すると使えます',
        toolCopy: 'コピー',
        toolCopied: 'コピーしました ✓',
        toolErrorTitle: 'クリックでエラー内容を表示',
        trialBanner: '🎁 お試しモードで利用中(DeepSeek V3・制限あり)。⚙️ から自分の API キーを設定できます',
        noKey: '⚙️ をクリックして API キーを設定してください',
        // コンテナのエラー文言
        vmNotReady: 'Scratch エディタの読み込みが完了していません。',
        authInvalid: 'APIキーが無効です。設定し直してください。',
        stopped: '(停止しました)',
        // API キー / モデル設定モーダル
        modalTitle: 'API キー / モデル設定',
        modalModelLabel: '使用モデル',
        modalCancel: 'キャンセル',
        modalSave: '保存',
        keyStoredNote: 'キーはこのブラウザの localStorage にのみ保存されます。',
        anthropicDesc: 'Claude を利用するための Anthropic API キーを入力してください。',
        deepseekDesc: 'DeepSeek API キーを入力してください。',
        openaiDesc: 'OpenAI API キーを入力してください。',
        geminiDesc: 'Google Gemini API キーを入力してください。',
        hintPrefix: 'API キーは ',
        hintSuffix: ' で取得できます。'
    },
    en: {
        // Chat panel
        headerTitle: 'AI Assistant',
        openAssistant: 'Open AI assistant',
        closeAssistant: 'Close AI assistant',
        settings: 'API key settings',
        placeholderLine1: 'Tell me in English what you want to make.',
        placeholderExample: 'e.g. "Make the cat move right when the green flag is clicked"',
        inputPlaceholder: 'Type your instruction...',
        send: 'Send',
        stop: '■ Stop',
        thinking: 'Thinking...',
        toggleBlocks: 'Block editing',
        navMode: 'Nav',
        driverMode: 'Driver',
        toggleDisabledTitle: 'Block editing is not available in trial mode. Set your own API key from ⚙️ to enable it',
        toolCopy: 'Copy',
        toolCopied: 'Copied ✓',
        toolErrorTitle: 'Click to show the error details',
        trialBanner: '🎁 Using trial mode (DeepSeek V3, with limits). You can set your own API key from ⚙️',
        noKey: 'Click ⚙️ to set your API key',
        // Container error messages
        vmNotReady: 'The Scratch editor has not finished loading yet.',
        authInvalid: 'The API key is invalid. Please set it again.',
        stopped: '(Stopped)',
        // API key / model settings modal
        modalTitle: 'API Key / Model Settings',
        modalModelLabel: 'Model',
        modalCancel: 'Cancel',
        modalSave: 'Save',
        keyStoredNote: 'The key is stored only in this browser\'s localStorage.',
        anthropicDesc: 'Enter your Anthropic API key to use Claude.',
        deepseekDesc: 'Enter your DeepSeek API key.',
        openaiDesc: 'Enter your OpenAI API key.',
        geminiDesc: 'Enter your Google Gemini API key.',
        hintPrefix: 'You can get an API key at ',
        hintSuffix: '.'
    }
};

// ツール入力生成中の進捗末尾(「(120文字)」/「(120 chars)」)
export const draftingChars = (lang, chars) =>
    (chars > 0 ? (lang === 'ja' ? ` (${chars}文字)` : ` (${chars} chars)`) : '');

// 実行時エラーの接頭辞
export const errorPrefix = (lang, msg) => (lang === 'ja' ? `エラー: ${msg}` : `Error: ${msg}`);

// 料金表リンクのラベル
export const pricingLabel = (lang, providerLabel) =>
    (lang === 'ja' ? `${providerLabel} の料金表(API利用料)` : `${providerLabel} pricing (API usage)`);

// サジェスト(例文ボタン)。en は日本語特有の題材(nekonige 等)を避けた汎用例。
export const SUGGESTIONS_BY_LANG = {
    ja: [
        {label: 'ネコ逃げゲームを教えて', text: 'https://github.com/champierre/nekonige で紹介しているネコ逃げゲームの作り方を教えて', disableBlocks: true},
        {label: 'ネコを動かして', text: 'ネコが旗をクリックしたら右に動き続けるようにして'}
    ],
    en: [
        {label: 'Make the cat move', text: 'Make the cat move right continuously when the green flag is clicked'},
        {label: 'Make a chase game', text: 'Make a simple game where the cat follows the mouse pointer'}
    ]
};
