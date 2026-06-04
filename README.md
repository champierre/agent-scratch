# Agent Scratch

自然言語の指示から Scratch のブロックを自動で組み立てる、AIエージェント内蔵の Scratch mod です。

エディタ右側のプロンプト欄に「ネコが旗をクリックしたら右に動き続けるようにして」のように日本語で指示すると、Claude がエージェンティックに(tool use ループで)スプライトの追加・ブロックの組み立て・音や背景の追加を行い、ブロックが順に組み上がっていく様子をエディタ上で見ることができます。

[live-scratch](https://github.com/champierre/live-scratch)(project.json を外部AIエージェントに編集させる方式)の発展形として、エージェントをエディタ自体に組み込んだものです。

## 特徴

- **Scratch 本体は無改造**: [@scratch/scratch-gui](https://www.npmjs.com/package/@scratch/scratch-gui) を npm 依存として利用し、同一の VM インスタンスをエージェントと共有する薄いラッパー構成
- **エージェンティック逐次編集**: Claude の tool use ループで 1 ツール呼び出しごとに VM へ反映。ブロックが組み上がっていく過程が見える
- **簡易DSL + ローカル変換**: Claude は shadow ブロックや blockId を知らなくてよい簡易DSLでスクリプトを記述し、ローカルの変換器(`block-builder.js`)が正確な Scratch ブロック構造へ変換・検証する
- **標準ライブラリ対応**: Scratch 標準ライブラリのスプライト・コスチューム・音・背景を検索して追加できる
- **サーバ不要**: Anthropic API をブラウザから直接呼び出す純フロントエンド構成。API キーはブラウザの localStorage にのみ保存

## 使い方

```bash
npm install
npm start
# → http://localhost:8602 を開く
```

1. 右パネルの ⚙️ から Anthropic API キーを設定([Anthropic Console](https://console.anthropic.com/settings/keys) で取得)
2. 使用モデルを選択(デフォルト: Claude Opus 4.8)
3. プロンプト欄に作りたいものを日本語で入力して送信

### 指示の例

- ネコが旗をクリックしたら右に動き続けるようにして
- ボールを追加して、ネコがボールに触れたらスコアが増えるゲームにして
- 宇宙を背景にしてシューティングゲームを作って

## 開発

```bash
npm test          # block-builder(DSL→ブロック変換)の単体テスト
npm run build     # プロダクションビルド(build/)
```

ブラウザで `?selftest=1` を付けて開くと、Claude なしでVMツールハンドラの通しテストが走ります(コンソールに `[selftest]` ログ)。

## アーキテクチャ

```
src/
├── index.jsx / app.jsx       # 自前VM生成 → <GUI vm={vm}> + チャットパネルの2カラム
├── agent/
│   ├── agent-loop.js         # Anthropic Messages API の手動 tool use ループ + prompt caching
│   ├── tools.js              # ツール定義(input_schema)
│   ├── tool-handlers.js      # 各ツール → scratch-vm への反映(ロールバック付き)
│   ├── block-builder.js      # DSL → ランタイムブロック変換・検証・逆変換
│   ├── block-specs.js        # 主要 opcode の引数仕様テーブル
│   ├── library-search.js     # 標準ライブラリ検索
│   └── system-prompt.js      # システムプロンプト(opcode仕様はspecsから自動生成)
├── components/
│   ├── chat-panel/           # チャットUI
│   └── api-key-modal/        # APIキー・モデル設定
└── containers/
    └── chat-panel.jsx        # UIとエージェントループの接続
```

### エージェントのツール

| ツール | 説明 |
|---|---|
| `get_project_state` | 全ターゲットの状態をDSL形式で取得 |
| `search_library` | 標準ライブラリの検索(sprite/costume/sound/backdrop) |
| `add_sprite` / `delete_sprite` / `rename_sprite` | スプライト管理 |
| `add_costume` / `add_sound` / `add_backdrop` | アセット追加 |
| `set_scripts` | ターゲットのスクリプトをDSLで全置換 |
| `set_sprite_properties` | 位置・大きさ・向き・表示の直接設定 |
| `start_project` / `stop_project` | 実行・停止 |

## ライセンス

[AGPL-3.0-only](LICENSE)

本プロジェクトが依存・バンドルする [@scratch/scratch-gui](https://www.npmjs.com/package/@scratch/scratch-gui) および scratch-vm 等の関連パッケージは AGPL-3.0-only でライセンスされているため、本プロジェクトも同ライセンスに従います。

なお、Scratch の名称・ロゴ・Scratchキャット等は Scratch Foundation の商標であり、本プロジェクトは Scratch Foundation と無関係の非公式 mod です。
