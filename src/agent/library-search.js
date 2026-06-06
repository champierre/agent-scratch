// Scratch標準ライブラリ(スプライト/コスチューム/音/背景)の検索
import spriteLibrary from '@scratch/scratch-gui/sprites';
import costumeLibrary from '@scratch/scratch-gui/costumes';
import soundLibrary from '@scratch/scratch-gui/sounds';
import backdropLibrary from '@scratch/scratch-gui/backdrops';

// 日本語クエリ → 英語キーワードの変換辞書
// (「検索は英語で」というプロンプト指示が守られなくても検索できるようにする)
const JA_TO_EN = {
    ネコ: 'cat', 猫: 'cat', ねこ: 'cat',
    イヌ: 'dog', 犬: 'dog', いぬ: 'dog',
    ネズミ: 'mouse', ねずみ: 'mouse',
    ウサギ: 'rabbit', うさぎ: 'rabbit',
    クマ: 'bear', くま: 'bear', 熊: 'bear',
    サル: 'monkey', さる: 'monkey', 猿: 'monkey',
    トリ: 'bird', 鳥: 'bird', とり: 'bird',
    サカナ: 'fish', 魚: 'fish', さかな: 'fish',
    サメ: 'shark', さめ: 'shark',
    タコ: 'octopus', たこ: 'octopus',
    カニ: 'crab', かに: 'crab',
    ペンギン: 'penguin',
    フクロウ: 'owl',
    チョウ: 'butterfly', 蝶: 'butterfly', ちょうちょ: 'butterfly',
    ヘビ: 'snake', へび: 'snake', 蛇: 'snake',
    カエル: 'frog', かえる: 'frog',
    馬: 'horse', ウマ: 'horse',
    ライオン: 'lion',
    ゾウ: 'elephant', 象: 'elephant',
    恐竜: 'dinosaur', キョウリュウ: 'dinosaur',
    ドラゴン: 'dragon', 竜: 'dragon',
    ユニコーン: 'unicorn',
    オバケ: 'ghost', おばけ: 'ghost', お化け: 'ghost', ゆうれい: 'ghost', 幽霊: 'ghost',
    ロボット: 'robot',
    モンスター: 'monster',
    ヒーロー: 'hero',
    魔女: 'witch', まじょ: 'witch',
    妖精: 'fairy',
    王女: 'princess', プリンセス: 'princess', お姫様: 'princess',
    ボール: 'ball', たま: 'ball', 玉: 'ball',
    バスケットボール: 'basketball',
    サッカーボール: 'soccer ball', サッカー: 'soccer',
    野球: 'baseball',
    バナナ: 'banana',
    リンゴ: 'apple', りんご: 'apple', 林檎: 'apple',
    イチゴ: 'strawberry', いちご: 'strawberry', 苺: 'strawberry',
    オレンジ: 'orange',
    スイカ: 'watermelon', すいか: 'watermelon',
    ケーキ: 'cake',
    ドーナツ: 'donut',
    ピザ: 'pizza',
    パドル: 'paddle',
    ボタン: 'button',
    ハート: 'heart',
    ホシ: 'star', 星: 'star', ほし: 'star',
    矢印: 'arrow', やじるし: 'arrow',
    車: 'car', くるま: 'car',
    ロケット: 'rocket',
    飛行機: 'airplane', ひこうき: 'airplane',
    傘: 'umbrella', かさ: 'umbrella',
    帽子: 'hat', ぼうし: 'hat',
    メガネ: 'glasses', めがね: 'glasses', 眼鏡: 'glasses',
    王冠: 'crown',
    鍵: 'key', カギ: 'key', かぎ: 'key',
    剣: 'sword',
    宇宙: 'space', うちゅう: 'space',
    宇宙船: 'spaceship',
    月: 'moon', つき: 'moon',
    太陽: 'sun', たいよう: 'sun',
    地球: 'earth',
    森: 'forest', もり: 'forest',
    海: 'underwater', うみ: 'beach',
    ビーチ: 'beach', 浜辺: 'beach',
    山: 'mountain', やま: 'mountain',
    城: 'castle', しろ: 'castle', お城: 'castle',
    街: 'city', 都市: 'city',
    学校: 'school', 教室: 'classroom',
    部屋: 'room', へや: 'room',
    夜: 'night', よる: 'night',
    雪: 'snow', ゆき: 'snow', 冬: 'winter',
    ニャー: 'meow', にゃー: 'meow', 鳴き声: 'meow',
    ワン: 'dog', ワンワン: 'dog bark',
    ポップ: 'pop',
    ジャンプ: 'jump',
    バウンド: 'boing', ボヨン: 'boing', ボイン: 'boing',
    笑い: 'laugh', わらい: 'laugh',
    拍手: 'clap', はくしゅ: 'clap',
    ベル: 'bell', 鐘: 'bell',
    ドラム: 'drum', タイコ: 'drum', 太鼓: 'drum',
    ピアノ: 'piano',
    ギター: 'guitar',
    コイン: 'coin',
    爆発: 'boom', ばくはつ: 'boom',
    レーザー: 'laser',
    魔法: 'magic', まほう: 'magic',
    勝ち: 'win', 勝利: 'win',
    ゲームオーバー: 'lose'
};

// 日本語(非ASCII)クエリを英語キーワード候補に変換する
// 完全一致 → 部分一致(クエリに辞書キーが含まれる)の順で探す
export const translateQuery = query => {
    const q = String(query).trim();
    if (!q || /^[\x20-\x7e]*$/.test(q)) return []; // ASCIIのみなら変換不要
    if (JA_TO_EN[q]) return [JA_TO_EN[q]];
    const hits = [];
    for (const [ja, en] of Object.entries(JA_TO_EN)) {
        if (q.includes(ja) && !hits.includes(en)) hits.push(en);
    }
    return hits;
};

const matches = (item, query) => {
    const q = query.toLowerCase();
    if (item.name.toLowerCase().includes(q)) return true;
    return (item.tags || []).some(tag => tag.toLowerCase().includes(q));
};

// 元クエリで0件なら日本語→英語変換した候補で再検索する
const searchWithFallback = (library, query, limit, toResult) => {
    const direct = library.filter(item => matches(item, query));
    if (direct.length > 0) return direct.slice(0, limit).map(toResult);
    const results = [];
    const seen = new Set();
    for (const en of translateQuery(query)) {
        for (const item of library.filter(it => matches(it, en))) {
            if (seen.has(item.name)) continue;
            seen.add(item.name);
            results.push(toResult(item));
            if (results.length >= limit) return results;
        }
    }
    return results;
};

const spriteResult = item => ({
    name: item.name,
    tags: item.tags,
    costumes: item.costumes.map(c => c.name),
    sounds: (item.sounds || []).map(s => s.name)
});
const simpleResult = item => ({name: item.name, tags: item.tags});

export const searchSprites = (query, limit = 10) =>
    searchWithFallback(spriteLibrary, query, limit, spriteResult);

export const findSpriteByName = name =>
    spriteLibrary.find(item => item.name.toLowerCase() === name.toLowerCase());

export const searchCostumes = (query, limit = 10) =>
    searchWithFallback(costumeLibrary, query, limit, simpleResult);

export const findCostumeByName = name =>
    costumeLibrary.find(item => item.name.toLowerCase() === name.toLowerCase());

export const searchSounds = (query, limit = 10) =>
    searchWithFallback(soundLibrary, query, limit, simpleResult);

export const findSoundByName = name =>
    soundLibrary.find(item => item.name.toLowerCase() === name.toLowerCase());

export const searchBackdrops = (query, limit = 10) =>
    searchWithFallback(backdropLibrary, query, limit, simpleResult);

export const findBackdropByName = name =>
    backdropLibrary.find(item => item.name.toLowerCase() === name.toLowerCase());
