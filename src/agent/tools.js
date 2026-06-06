// Anthropic Messages API に渡すツール定義(input_schema)
// 順序は固定(prompt caching のため変更しないこと)

const SCRIPTS_SCHEMA = {
    type: 'array',
    description: 'DSL形式のスクリプト配列。各要素は {x?, y?, blocks: [...]}',
    items: {
        type: 'object',
        properties: {
            x: {type: 'number'},
            y: {type: 'number'},
            blocks: {type: 'array', items: {type: 'object'}}
        },
        required: ['blocks']
    }
};

// blocksEnabled=false のとき除外するツール名の集合
// (get_project_state / search_library / fetch_url は読み取り専用なので常に使用可)
export const BLOCK_TOOL_NAMES = new Set([
    'add_sprite',
    'delete_sprite',
    'rename_sprite',
    'add_costume',
    'add_sound',
    'add_backdrop',
    'set_scripts',
    'set_sprite_properties',
    'start_project',
    'stop_project'
]);

export const TOOLS = [
    {
        name: 'get_project_state',
        description: '現在のプロジェクトの状態(全ターゲットのスプライト情報・コスチューム・音・変数・スクリプト)をDSL形式で取得する。作業前に必ず呼んで現状を把握すること。',
        input_schema: {type: 'object', properties: {}}
    },
    {
        name: 'search_library',
        description: 'Scratch標準ライブラリからスプライト/コスチューム/音/背景を検索する。queryは英語(例: dog, ball, jump, forest)。',
        input_schema: {
            type: 'object',
            properties: {
                kind: {type: 'string', enum: ['sprite', 'costume', 'sound', 'backdrop']},
                query: {type: 'string', description: '英語の検索キーワード'}
            },
            required: ['kind', 'query']
        }
    },
    {
        name: 'add_sprite',
        description: '標準ライブラリからスプライトを追加する。nameはライブラリ上の正確な名前(search_libraryで確認)。',
        input_schema: {
            type: 'object',
            properties: {
                name: {type: 'string', description: 'ライブラリのスプライト名(例: Dog2, Ball)'}
            },
            required: ['name']
        }
    },
    {
        name: 'delete_sprite',
        description: 'スプライトを削除する。',
        input_schema: {
            type: 'object',
            properties: {
                target: {type: 'string', description: 'スプライト名'}
            },
            required: ['target']
        }
    },
    {
        name: 'rename_sprite',
        description: 'スプライトの名前を変更する。',
        input_schema: {
            type: 'object',
            properties: {
                target: {type: 'string'},
                new_name: {type: 'string'}
            },
            required: ['target', 'new_name']
        }
    },
    {
        name: 'add_costume',
        description: '標準ライブラリからコスチュームをスプライトに追加する。',
        input_schema: {
            type: 'object',
            properties: {
                target: {type: 'string', description: 'スプライト名'},
                costume_name: {type: 'string', description: 'ライブラリのコスチューム名'}
            },
            required: ['target', 'costume_name']
        }
    },
    {
        name: 'add_sound',
        description: '標準ライブラリから音をスプライトまたはステージに追加する。',
        input_schema: {
            type: 'object',
            properties: {
                target: {type: 'string', description: 'スプライト名または "Stage"'},
                sound_name: {type: 'string', description: 'ライブラリの音名(例: Meow, Pop)'}
            },
            required: ['target', 'sound_name']
        }
    },
    {
        name: 'add_backdrop',
        description: '標準ライブラリから背景をステージに追加する。',
        input_schema: {
            type: 'object',
            properties: {
                backdrop_name: {type: 'string', description: 'ライブラリの背景名'}
            },
            required: ['backdrop_name']
        }
    },
    {
        name: 'set_scripts',
        description: 'ターゲットのスクリプト(ブロック)全体をDSLで置き換える。そのターゲットの既存スクリプトはすべて消えて新しい内容になるので、残したいスクリプトも含めて全部を指定すること。',
        input_schema: {
            type: 'object',
            properties: {
                target: {type: 'string', description: 'スプライト名または "Stage"'},
                scripts: SCRIPTS_SCHEMA
            },
            required: ['target', 'scripts']
        }
    },
    {
        name: 'set_sprite_properties',
        description: 'スプライトの位置・大きさ・向き・表示状態を直接設定する(初期配置に便利)。',
        input_schema: {
            type: 'object',
            properties: {
                target: {type: 'string'},
                x: {type: 'number'},
                y: {type: 'number'},
                size: {type: 'number', description: 'パーセント(100が標準)'},
                direction: {type: 'number', description: '90が右向き'},
                visible: {type: 'boolean'}
            },
            required: ['target']
        }
    },
    {
        name: 'start_project',
        description: '緑の旗を押してプロジェクトを実行する(動作確認用)。',
        input_schema: {type: 'object', properties: {}}
    },
    {
        name: 'stop_project',
        description: 'プロジェクトの実行を止める。',
        input_schema: {type: 'object', properties: {}}
    },
    {
        name: 'fetch_url',
        description: 'URLのページ内容(テキスト/HTML/Markdown)を取得する。GitHubのREADMEやWebページを参照して内容を説明するときに使う。',
        input_schema: {
            type: 'object',
            properties: {
                url: {type: 'string', description: '取得するURL(http/https)'}
            },
            required: ['url']
        }
    }
];

// ツール入力の生成中(ストリーミング中)にUIへ出す進捗ラベル
export const draftingLabel = name => {
    switch (name) {
    case 'set_scripts': return 'ブロックを書いています';
    case 'add_sprite': return 'スプライトを選んでいます';
    case 'search_library': return 'ライブラリを探しています';
    case 'set_sprite_properties': return 'スプライトを配置しています';
    case 'fetch_url': return 'ページを取得しています';
    default: return '次の操作を準備しています';
    }
};

// チャットUIに表示するツール実行サマリ
export const summarizeToolCall = (name, input) => {
    switch (name) {
    case 'get_project_state': return 'プロジェクトの状態を確認';
    case 'search_library': return `ライブラリ検索: ${input.kind} "${input.query}"`;
    case 'add_sprite': return `スプライト追加: ${input.name}`;
    case 'delete_sprite': return `スプライト削除: ${input.target}`;
    case 'rename_sprite': return `名前変更: ${input.target} → ${input.new_name}`;
    case 'add_costume': return `コスチューム追加: ${input.costume_name} → ${input.target}`;
    case 'add_sound': return `音追加: ${input.sound_name} → ${input.target}`;
    case 'add_backdrop': return `背景追加: ${input.backdrop_name}`;
    case 'set_scripts': return `ブロックを組む: ${input.target}`;
    case 'set_sprite_properties': return `プロパティ設定: ${input.target}`;
    case 'start_project': return 'プロジェクトを実行';
    case 'stop_project': return 'プロジェクトを停止';
    case 'fetch_url': return `URLを取得: ${input.url}`;
    default: return name;
    }
};
