// opcode → scratchblocks 表示テキストのマッピング
// 引数は [] で省略表現。実際の値は不要（ブロックの形が伝わればよい）

const EN = {
    // ---- イベント ----
    event_whenflagclicked: 'when flag clicked',
    event_whenkeypressed: 'when [space v] key pressed',
    event_whenthisspriteclicked: 'when this sprite clicked',
    event_whenstageclicked: 'when stage clicked',
    event_whenbackdropswitchesto: 'when backdrop switches to [backdrop1 v]',
    event_whengreaterthan: 'when [loudness v] > (10)',
    event_whenbroadcastreceived: 'when I receive [message1 v]',
    event_broadcast: 'broadcast [message1 v]',
    event_broadcastandwait: 'broadcast [message1 v] and wait',

    // ---- 動き ----
    motion_movesteps: 'move (10) steps',
    motion_turnright: 'turn cw (15) degrees',
    motion_turnleft: 'turn ccw (15) degrees',
    motion_goto: 'go to [random position v]',
    motion_gotoxy: 'go to x: (0) y: (0)',
    motion_glideto: 'glide (1) secs to [random position v]',
    motion_glidesecstoxy: 'glide (1) secs to x: (0) y: (0)',
    motion_pointindirection: 'point in direction (90)',
    motion_pointtowards: 'point towards [mouse-pointer v]',
    motion_changexby: 'change x by (10)',
    motion_setx: 'set x to (0)',
    motion_changeyby: 'change y by (10)',
    motion_sety: 'set y to (0)',
    motion_ifonedgebounce: 'if on edge, bounce',
    motion_setrotationstyle: 'set rotation style [left-right v]',
    motion_xposition: '(x position)',
    motion_yposition: '(y position)',
    motion_direction: '(direction)',

    // ---- 見た目 ----
    looks_sayforsecs: 'say [Hello!] for (2) seconds',
    looks_say: 'say [Hello!]',
    looks_thinkforsecs: 'think [Hmm...] for (2) seconds',
    looks_think: 'think [Hmm...]',
    looks_switchcostumeto: 'switch costume to [costume1 v]',
    looks_nextcostume: 'next costume',
    looks_switchbackdropto: 'switch backdrop to [backdrop1 v]',
    looks_nextbackdrop: 'next backdrop',
    looks_changesizeby: 'change size by (10)',
    looks_setsizeto: 'set size to (100) %',
    looks_changeeffectby: 'change [color v] effect by (25)',
    looks_seteffectto: 'set [color v] effect to (0)',
    looks_cleargraphiceffects: 'clear graphic effects',
    looks_show: 'show',
    looks_hide: 'hide',
    looks_gotofrontback: 'go to [front v] layer',
    looks_goforwardbackwardlayers: 'go [forward v] (1) layers',
    looks_costumenumbername: '(costume [number v])',
    looks_backdropnumbername: '(backdrop [number v])',
    looks_size: '(size)',

    // ---- 音 ----
    sound_playuntildone: 'play sound [Meow v] until done',
    sound_play: 'start sound [Meow v]',
    sound_stopallsounds: 'stop all sounds',
    sound_changeeffectby: 'change [pitch v] effect by (10)',
    sound_seteffectto: 'set [pitch v] effect to (100)',
    sound_cleareffects: 'clear sound effects',
    sound_changevolumeby: 'change volume by (-10)',
    sound_setvolumeto: 'set volume to (100) %',
    sound_volume: '(volume)',

    // ---- 制御 ----
    control_wait: 'wait (1) seconds',
    control_repeat: 'repeat (10)',
    control_forever: 'forever',
    control_if: 'if <> then',
    control_if_else: 'if <> then {} else',
    control_wait_until: 'wait until <>',
    control_repeat_until: 'repeat until <>',
    control_stop: 'stop [all v]',
    control_start_as_clone: 'when I start as a clone',
    control_create_clone_of: 'create clone of [myself v]',
    control_delete_this_clone: 'delete this clone',

    // ---- 調べる ----
    sensing_touchingobject: '<touching [mouse-pointer v] ?>',
    sensing_touchingcolor: '<touching color [#ff0000] ?>',
    sensing_coloristouchingcolor: '<color [#ff0000] is touching [#0000ff] ?>',
    sensing_distanceto: '(distance to [mouse-pointer v])',
    sensing_askandwait: 'ask [What\'s your name?] and wait',
    sensing_answer: '(answer)',
    sensing_keypressed: '<key [space v] pressed?>',
    sensing_mousedown: '<mouse down?>',
    sensing_mousex: '(mouse x)',
    sensing_mousey: '(mouse y)',
    sensing_setdragmode: 'set drag mode [draggable v]',
    sensing_loudness: '(loudness)',
    sensing_timer: '(timer)',
    sensing_resettimer: 'reset timer',
    sensing_dayssince2000: '(days since 2000)',
    sensing_username: '(username)',

    // ---- 演算 ----
    operator_add: '((1) + (2))',
    operator_subtract: '((1) - (2))',
    operator_multiply: '((1) * (2))',
    operator_divide: '((1) / (2))',
    operator_random: '(pick random (1) to (10))',
    operator_gt: '<(1) > (2)>',
    operator_lt: '<(1) < (2)>',
    operator_equals: '<(1) = (2)>',
    operator_and: '<<> and <>>',
    operator_or: '<<> or <>>',
    operator_not: '<not <>>',
    operator_join: '(join [hello ] [world])',
    operator_letter_of: '(letter (1) of [apple])',
    operator_length: '(length of [apple])',
    operator_contains: '<[apple] contains [a]?>',
    operator_mod: '((10) mod (3))',
    operator_round: '(round (3.4))',
    operator_mathop: '([sqrt v] of (9))',

    // ---- 変数 ----
    data_variable: '(my variable)',
    data_setvariableto: 'set [my variable v] to (0)',
    data_changevariableby: 'change [my variable v] by (1)',
    data_showvariable: 'show variable [my variable v]',
    data_hidevariable: 'hide variable [my variable v]',

    // ---- リスト ----
    data_listcontents: '(my list)',
    data_addtolist: 'add [thing] to [my list v]',
    data_deleteoflist: 'delete (1) of [my list v]',
    data_deletealloflist: 'delete all of [my list v]',
    data_insertatlist: 'insert [thing] at (1) of [my list v]',
    data_replaceitemoflist: 'replace item (1) of [my list v] with [thing]',
    data_itemoflist: '(item (1) of [my list v])',
    data_itemnumoflist: '(item # of [thing] in [my list v])',
    data_lengthoflist: '(length of [my list v])',
    data_listcontainsitem: '<[my list v] contains [thing]?>',
    data_showlist: 'show list [my list v]',
    data_hidelist: 'hide list [my list v]',

    // ---- ペン拡張 ----
    pen_clear: 'erase all',
    pen_stamp: 'stamp',
    pen_penDown: 'pen down',
    pen_penUp: 'pen up',
    pen_setPenColorToColor: 'set pen color to [#ff0000]',
    pen_changePenColorParamBy: 'change pen [color v] by (10)',
    pen_setPenColorParamTo: 'set pen [color v] to (50)',
    pen_changePenSizeBy: 'change pen size by (1)',
    pen_setPenSizeTo: 'set pen size to (1)'
};

const JA = {
    // ---- イベント ----
    event_whenflagclicked: '@greenFlag が押されたとき',
    event_whenkeypressed: '[スペース v] キーが押されたとき',
    event_whenthisspriteclicked: 'このスプライトが押されたとき',
    event_whenstageclicked: 'ステージが押されたとき',
    event_whenbackdropswitchesto: '背景が [backdrop1 v] になったとき',
    event_whengreaterthan: '[音量 v] > (10) のとき',
    event_whenbroadcastreceived: '[メッセージ1 v] を受け取ったとき',
    event_broadcast: '[メッセージ1 v] を送る',
    event_broadcastandwait: '[メッセージ1 v] を送って待つ',

    // ---- 動き ----
    motion_movesteps: '(10) 歩動かす',
    motion_turnright: '@turnRight (15) 度回す',
    motion_turnleft: '@turnLeft (15) 度回す',
    motion_goto: '[ランダムな位置 v] へ行く',
    motion_gotoxy: 'x座標を (0) 、y座標を (0) にする',
    motion_glideto: '(1) 秒で [ランダムな位置 v] へ行く',
    motion_glidesecstoxy: '(1) 秒でx座標を (0) に、y座標を (0) に変える',
    motion_pointindirection: '(90) 度に向ける',
    motion_pointtowards: '[マウスのポインター v] へ向ける',
    motion_changexby: 'x座標を (10) ずつ変える',
    motion_setx: 'x座標を (0) にする',
    motion_changeyby: 'y座標を (10) ずつ変える',
    motion_sety: 'y座標を (0) にする',
    motion_ifonedgebounce: 'もし端に着いたら、跳ね返る',
    motion_setrotationstyle: '回転方法を [左右のみ v] にする',
    motion_xposition: '(x座標 :: motion)',
    motion_yposition: '(y座標 :: motion)',
    motion_direction: '(向き :: motion)',

    // ---- 見た目 ----
    looks_sayforsecs: '[こんにちは！] と (2) 秒言う',
    looks_say: '[こんにちは！] と言う',
    looks_thinkforsecs: '[うーん…] と (2) 秒考える',
    looks_think: '[うーん…] と考える',
    looks_switchcostumeto: 'コスチュームを [コスチューム1 v] にする',
    looks_nextcostume: '次のコスチュームにする',
    looks_switchbackdropto: '背景を [背景1 v] にする',
    looks_nextbackdrop: '次の背景にする :: looks',
    looks_changesizeby: '大きさを (10) ずつ変える',
    looks_setsizeto: '大きさを (100) %にする',
    looks_changeeffectby: '[色 v] の効果を (25) ずつ変える',
    looks_seteffectto: '[色 v] の効果を (0) にする',
    looks_cleargraphiceffects: '画像効果をなくす',
    looks_show: '表示する',
    looks_hide: '隠す',
    looks_gotofrontback: '[前 v] へ移動する',
    looks_goforwardbackwardlayers: '(1) 層 [前 v]',
    looks_costumenumbername: '(コスチュームの [番号 v])',
    looks_backdropnumbername: '(背景の [番号 v])',
    looks_size: '(大きさ :: looks)',

    // ---- 音 ----
    sound_playuntildone: '終わるまで [ニャー v] の音を鳴らす :: sound',
    sound_play: '[ニャー v] の音を鳴らす :: sound',
    sound_stopallsounds: 'すべての音を止める :: sound',
    sound_changeeffectby: '[ピッチ v] の効果を (10) ずつ変える :: sound',
    sound_seteffectto: '[ピッチ v] の効果を (100) にする :: sound',
    sound_cleareffects: '音の効果をなくす :: sound',
    sound_changevolumeby: '音量を (-10) ずつ変える :: sound',
    sound_setvolumeto: '音量を (100) %にする :: sound',
    sound_volume: '(音量 :: sound)',

    // ---- 制御 ----
    control_wait: '(1) 秒待つ',
    control_repeat: '(10) 回繰り返す',
    control_forever: 'ずっと',
    control_if: 'もし <> なら',
    control_if_else: 'もし <> なら {} でなければ',
    control_wait_until: '<> まで待つ',
    control_repeat_until: '<> まで繰り返す',
    control_stop: ' [すべてを止める v]',
    control_start_as_clone: 'クローンされたとき',
    control_create_clone_of: '[自分自身 v] のクローンを作る',
    control_delete_this_clone: 'このクローンを削除する',

    // ---- 調べる ----
    sensing_touchingobject: '<[マウスのポインター v] に触れた>',
    sensing_touchingcolor: '<[#ff0000] 色に触れた>',
    sensing_coloristouchingcolor: '<[#ff0000] 色が [#0000ff] 色に触れた>',
    sensing_distanceto: '([マウスのポインター v] までの距離)',
    sensing_askandwait: '[名前はなんですか？] と聞いて待つ',
    sensing_answer: '(答え)',
    sensing_keypressed: '<[スペース v] キーが押された>',
    sensing_mousedown: '<マウスが押された>',
    sensing_mousex: '(マウスのx座標)',
    sensing_mousey: '(マウスのy座標)',
    sensing_setdragmode: 'ドラッグ [できる v] ようにする',
    sensing_loudness: '(音量 :: sensing)',
    sensing_timer: '(タイマー)',
    sensing_resettimer: 'タイマーをリセット',
    sensing_dayssince2000: '(2000年からの日数)',
    sensing_username: '(ユーザー名)',

    // ---- 演算 ----
    operator_add: '((1) + (2))',
    operator_subtract: '((1) - (2))',
    operator_multiply: '((1) * (2))',
    operator_divide: '((1) / (2))',
    operator_random: '((1) から (10) までの乱数)',
    operator_gt: '<(1) > (2)>',
    operator_lt: '<(1) < (2)>',
    operator_equals: '<(1) = (2)>',
    operator_and: '<<> かつ <>>',
    operator_or: '<<> または <>>',
    operator_not: '<() ではない>',
    operator_join: '([こんにちは ] と [世界])',
    operator_letter_of: '([りんご] の (1) 番目の文字)',
    operator_length: '([りんご] の長さ)',
    operator_contains: '<[りんご] に [り] が含まれる>',
    operator_mod: '((10) を (3) で割った余り)',
    operator_round: '((3.4) を四捨五入)',
    operator_mathop: '([sqrt v] の (9))',

    // ---- 変数 ----
    data_variable: '(変数)',
    data_setvariableto: '[変数 v] を (0) にする',
    data_changevariableby: '[変数 v] を (1) ずつ変える',
    data_showvariable: '変数 [変数 v] を表示する',
    data_hidevariable: '変数 [変数 v] を隠す',

    // ---- リスト ----
    data_listcontents: '(リスト)',
    data_addtolist: '[もの] を [リスト v] に追加する',
    data_deleteoflist: '[リスト v] の (1) 番目を削除する',
    data_deletealloflist: '[リスト v] のすべてを削除する',
    data_insertatlist: '[リスト v] の (1) 番目に [もの] を挿入する',
    data_replaceitemoflist: '[リスト v] の (1) 番目を [もの] で置き換える',
    data_itemoflist: '([リスト v] の (1) 番目)',
    data_itemnumoflist: '([リスト v] の中の [もの] の場所)',
    data_lengthoflist: '([リスト v] の長さ)',
    data_listcontainsitem: '<[リスト v] に [もの] が含まれる>',
    data_showlist: 'リスト [リスト v] を表示する',
    data_hidelist: 'リスト [リスト v] を隠す',

    // ---- ペン拡張 ----
    pen_clear: '全部消す',
    pen_stamp: 'スタンプ',
    pen_penDown: 'ペンを下ろす',
    pen_penUp: 'ペンを上げる',
    pen_setPenColorToColor: 'ペンの色を [#ff0000] にする',
    pen_changePenColorParamBy: 'ペンの [色 v] を (10) ずつ変える',
    pen_setPenColorParamTo: 'ペンの [色 v] を (50) にする',
    pen_changePenSizeBy: 'ペンの太さを (1) ずつ変える',
    pen_setPenSizeTo: 'ペンの太さを (1) にする'
};

export const BLOCK_LABELS = EN;
export const BLOCK_LABELS_JA = JA;

export const getBlockLabel = (opcode, lang) => {
    if (lang && lang.startsWith('ja')) {
        return JA[opcode] || EN[opcode];
    }
    return EN[opcode];
};

// ---- 日本語ブロック名 → opcode の逆引き ----
// AI が opcode でなく日本語名(「ずっと」「10歩動かす」等)でブロックに言及した
// 場合でもブロック画像に変換できるよう、JA ラベルから逆引き辞書を自動生成する。
// (システムプロンプトの「opcodeで書く」指示が守られないモデルへのロジック側の救済)

// 表記ゆれの吸収: アイコン参照・引数プレースホルダ・数字・空白・句読点を除去
const normalizeJaName = s => String(s)
    .replace(/@\w+/g, '')          // @greenFlag 等のアイコン参照
    .replace(/\[[^\]]*\]/g, '')    // [スペース v] 等のメニュー
    .replace(/\([^)]*\)/g, '')     // (10) 等の引数
    .replace(/[0-9０-９]+/g, '')   // ラベル外に書かれた数値(「10歩動かす」等)
    .replace(/[\s　、。，．,.!?！？「」『』:：;；・〜~ー-]/g, '')
    .toLowerCase();

// モデルが書きがちな言い換え(正規化後のJAラベルと一致しない表現)
const JA_NAME_ALIASES = {
    '緑の旗がクリックされたとき': 'event_whenflagclicked',
    '旗がクリックされたとき': 'event_whenflagclicked',
    '緑の旗が押されたとき': 'event_whenflagclicked',
    'スペースキーが押されたとき': 'event_whenkeypressed',
    'もし端についたら跳ね返る': 'motion_ifonedgebounce',
    '端についたら跳ね返る': 'motion_ifonedgebounce',
    '端に着いたら跳ね返る': 'motion_ifonedgebounce',
    'ずっと繰り返す': 'control_forever',
    'クローンされたとき': 'control_start_as_clone',
    '自分自身のクローンを作る': 'control_create_clone_of'
};

const JA_NAME_TO_OPCODE = (() => {
    const map = {};
    // エイリアスを優先登録
    for (const [name, opcode] of Object.entries(JA_NAME_ALIASES)) {
        map[normalizeJaName(name)] = opcode;
    }
    // JAラベルから自動生成(先勝ち)
    for (const [opcode, label] of Object.entries(JA)) {
        const key = normalizeJaName(label);
        if (key.length >= 2 && !map[key]) map[key] = opcode;
    }
    return map;
})();

// 日本語のブロック名らしき文字列から opcode を引く(該当なしは null)
export const findOpcodeByJaName = text => {
    const key = normalizeJaName(text);
    return (key && JA_NAME_TO_OPCODE[key]) || null;
};
