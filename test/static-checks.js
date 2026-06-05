// 過去に繰り返し混入したバグパターンの静的チェック
// (CLAUDE.md「よくあるハマりポイント」と対応)
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const errors = [];

const checkFile = (relPath, forbidden, reason) => {
    const content = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    for (const pattern of forbidden) {
        if (content.includes(pattern)) {
            errors.push(`${relPath}: 禁止パターン "${pattern}" が含まれています — ${reason}`);
        }
    }
};

// ペン拡張ロードAPI: vm.runtime._extensions は存在しない(PR #11 で修正後、#16 で退行した実績あり)
checkFile(
    'src/agent/tool-handlers.js',
    ['runtime._extensions'],
    '正しくは vm.extensionManager.isExtensionLoaded() を使う'
);

if (errors.length > 0) {
    console.error('static-checks FAILED:');
    for (const e of errors) console.error(' -', e);
    process.exit(1);
}
console.log('static-checks OK');
