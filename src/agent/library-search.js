// Scratch標準ライブラリ(スプライト/コスチューム/音/背景)の検索
import spriteLibrary from '@scratch/scratch-gui/sprites';
import costumeLibrary from '@scratch/scratch-gui/costumes';
import soundLibrary from '@scratch/scratch-gui/sounds';
import backdropLibrary from '@scratch/scratch-gui/backdrops';

const matches = (item, query) => {
    const q = query.toLowerCase();
    if (item.name.toLowerCase().includes(q)) return true;
    return (item.tags || []).some(tag => tag.toLowerCase().includes(q));
};

export const searchSprites = (query, limit = 10) =>
    spriteLibrary
        .filter(item => matches(item, query))
        .slice(0, limit)
        .map(item => ({
            name: item.name,
            tags: item.tags,
            costumes: item.costumes.map(c => c.name),
            sounds: (item.sounds || []).map(s => s.name)
        }));

export const findSpriteByName = name =>
    spriteLibrary.find(item => item.name.toLowerCase() === name.toLowerCase());

export const searchCostumes = (query, limit = 10) =>
    costumeLibrary
        .filter(item => matches(item, query))
        .slice(0, limit)
        .map(item => ({name: item.name, tags: item.tags}));

export const findCostumeByName = name =>
    costumeLibrary.find(item => item.name.toLowerCase() === name.toLowerCase());

export const searchSounds = (query, limit = 10) =>
    soundLibrary
        .filter(item => matches(item, query))
        .slice(0, limit)
        .map(item => ({name: item.name, tags: item.tags}));

export const findSoundByName = name =>
    soundLibrary.find(item => item.name.toLowerCase() === name.toLowerCase());

export const searchBackdrops = (query, limit = 10) =>
    backdropLibrary
        .filter(item => matches(item, query))
        .slice(0, limit)
        .map(item => ({name: item.name, tags: item.tags}));

export const findBackdropByName = name =>
    backdropLibrary.find(item => item.name.toLowerCase() === name.toLowerCase());
