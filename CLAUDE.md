# Agent Scratch 開発ガイド

## プロジェクト概要

Scratch エディタに組み込まれた AI エージェント。ユーザーの自然言語指示から Scratch プロジェクトを自動生成する。

- **フロントエンド**: React + webpack、Scratch GUI を組み込み
- **AI**: Anthropic Claude API / DeepSeek API / OpenAI API / Google Gemini API（Anthropic 以外は OpenAI 互換ループを共用。Gemini は generativelanguage.googleapis.com の OpenAI 互換エンドポイント）
- **試用モード**: Cloudflare Worker プロキシ経由（DeepSeek deepseek-chat）
- **デプロイ**: GitHub Pages（`npm run build` → `build/` ディレクトリ）

## 開発環境のセットアップ

```sh
cp .env.example .env   # APIキーを設定
npm install
npm start              # http://localhost:8602/
```

`.env` に `DEV_DEEPSEEK_API_KEY`・`DEV_ANTHROPIC_API_KEY`・`DEV_OPENAI_API_KEY`・`DEV_GEMINI_API_KEY` を設定するとブラウザへの手動入力が不要になる。本番ビルドにはキーは含まれない。

## ブランチ・PRルール

- **`main` への直接 push は禁止**（ブランチ保護ルール）。必ず PR を作成する
- **PR を勝手にマージしない**。マージはユーザーのレビュー・明示的な指示があってから行う（AI エージェントは PR 作成までで止めること）
- マージ済みの PR のブランチには push しない。新しいブランチを切って PR を作る
- ブランチ命名: `feat/`, `fix/`, `refactor/` などのプレフィックスを使う

## 設計方針

### ロジックで確実に(システムプロンプト頼みにしない)

AI の挙動はシステムプロンプトの指示だけに頼るとランダム性が残る。**強制できることはアルゴリズム(コード)で強制する**こと。

- 守らせたい制約は、プロンプトのお願いではなく検証・変換・ガードで担保する。例:
  - メニュー/フィールドの許可値・アセット実在チェック → `block-builder` で検証しエラーで自己修正させる(`block-specs` の `values` / `dynamic`)
  - 1回のブロック数上限 → `set_scripts` で物理的に制限
  - 日本語クエリ → `library-search` で英語へ自動変換
  - `blocksEnabled=false` → ツール除外 + プロンプト + ハンドラ ToolError の3重ガード
- プロンプトに残すのは、生成内容そのもの(文体・説明の構成など)アルゴリズム化できないものだけ。
- **UI 状態の二重管理を避ける**。同じ値を state と ref / localStorage に二重に持つと「表示はオンなのに実際はオフ」のようなズレが起きる。単一の真実(source of truth)を1つに決め、送信時の値は引数で明示的に渡す(state 更新の非同期性に依存しない)。

## アーキテクチャ

### エージェントループ (`src/agent/agent-loop.js`)

- Anthropic ループと OpenAI 互換ループ（`runOpenAICompatAgent`）の2実装。DeepSeek と OpenAI(GPT) は互換ループを共用
- 会話履歴は **Anthropic 形式** で統一管理し、OpenAI 互換 API に渡す際に変換
- GPT-5系は `max_tokens` 非対応のため `max_completion_tokens` を使用。ストリーミングの usage 取得は `stream_options: {include_usage: true}` でオプトイン
- `blocksEnabled=false` のとき:
  1. ツールリストから `set_scripts` を除外
  2. システムプロンプトにブロック操作禁止の制約を追加
  3. ハンドラ側でも `ToolError` を投げて物理的にブロック（3重ガード）

### ツールハンドラ (`src/agent/tool-handlers.js`)

- `createToolHandlers(vm, {blocksEnabled})` — `blocksEnabled` を受け取る
- `set_scripts` ではペン拡張の自動ロード: `vm.extensionManager.isExtensionLoaded('pen')`（`vm.runtime._extensions` は存在しないので使わない）

### ブロック画像表示 (`src/components/chat-panel/chat-panel.jsx`)

- AI の返答中の opcode（`looks_hide` 等）を scratchblocks SVG に変換
- ブラウザ言語が `ja` の場合は日本語ラベルで表示
- 日本語ラベルは `src/agent/block-labels.js` の `JA` オブジェクトで管理
- AI が opcode でなく日本語名(「ずっと」等)で書いた場合も、カギ括弧内の文字列を `findOpcodeByJaName`(JA ラベルからの自動生成逆引き+エイリアス)で解決してブロック画像化する。よくある言い換えは `JA_NAME_ALIASES` に追加する
- **重要**: 日本語ラベルは scratchblocks ロケールファイル（`locales/ja.json`）の文字列と正確に一致させること。`@greenFlag`、`@turnRight` などのアイコン参照も含める

### システムプロンプト (`src/agent/system-prompt.js`)

- `BLOCK_SPECS` から opcode 仕様を動的生成（prompt caching のため揮発値を入れない）
- ブロックに言及するときは opcode で書くよう AI に指示（UI が自動的にブロック画像に変換するため）
- `blocksEnabled=false` 時は末尾に禁止制約を追記

## Cloudflare Worker（試用モードプロキシ）

- `/v1/chat/completions` と `/chat/completions` の両パスを受け付ける
  - OpenAI SDK は `baseURL` に `/v1` なしで渡すと `/chat/completions` にリクエストを送る
- Secret: `DEEPSEEK_API_KEY`（旧: `ANTHROPIC_API_KEY`）
- 変更後は `cd worker && npx wrangler deploy` で再デプロイ必要

## よくあるハマりポイント

### React `useCallback` の依存配列
state を使うコールバックは依存配列に忘れずに追加する。`blocksEnabled` を追加し忘れるとトグルが効かない。依存配列の遅延を避けるために ref で二重持ちするのは禁止(state とズレてバグる)。`handleSend` は `blocksEnabled` を依存配列に入れて state を直読みし、一時的な無効化は `onSend(text, {forceBlocksDisabled})` のように引数で渡す。

### scratchblocks の日本語ロケール
`loadLanguages` で登録しても、テキストがロケールファイルの文字列と完全一致しないと色が正しく割り当てられない。`ja.json` の値をそのまま使い、`%1` を `(10)` などに置き換える。

### ペン拡張のロード API
- 正しい: `vm.extensionManager.isExtensionLoaded('pen')`
- 誤り: `vm.runtime._extensions.isExtensionLoaded('pen')` → `_extensions` は存在しない

### CI（GitHub Actions）
`actions/checkout`, `actions/setup-node`, `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages` を Node.js 24 対応バージョンで保つ。

## テスト・確認方法

ローカルで UI の動作確認には Chrome の DevTools Protocol を使うと便利:

```sh
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless=new --disable-gpu --no-sandbox \
  --remote-debugging-port=9222 --remote-allow-origins="*" \
  "http://localhost:8602/" &
```

Python の websocket-client でページ操作・スクリーンショット取得が可能。ただしヘッドレス Chrome は WebGL 非対応のため Scratch のステージ描画は崩れる。ブロック画像（scratchblocks SVG）の確認は可能。
