// UIテスト用ランナー: esbuild で jsdom 向けにバンドルして node で実行する。
// scratchblocks(UMD)と CSS はテストに不要なので stub / 空ローダーで差し替える。
import * as esbuild from 'esbuild';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const entry = process.argv[2];
const out = path.join(root, '.tmp-ui-test.cjs');

// 'scratchblocks' 本体のみ stub に差し替える(locales/*.json は素通し)
const stubScratchblocks = {
    name: 'stub-scratchblocks',
    setup(build) {
        build.onResolve({filter: /^scratchblocks$/}, () => ({path: 'sb', namespace: 'sbstub'}));
        build.onLoad({filter: /.*/, namespace: 'sbstub'}, () => ({
            contents: 'export function loadLanguages(){}\n' +
                'export function parse(){return {};}\n' +
                'export function render(){return document.createElementNS("http://www.w3.org/2000/svg","svg");}\n' +
                'export default {loadLanguages, parse, render};'
        }));
    }
};

await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: out,
    loader: {'.js': 'jsx', '.css': 'empty'},
    plugins: [stubScratchblocks],
    external: ['jsdom'],
    logLevel: 'error'
});

try {
    execFileSync('node', [out], {stdio: 'inherit'});
} finally {
    try { (await import('node:fs')).rmSync(out, {force: true}); } catch { /* ignore */ }
}
