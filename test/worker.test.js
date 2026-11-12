// Cloudflare Worker(試用モードプロキシ)の信頼済みネットワーク判定のテスト。
// 上流の DeepSeek API は globalThis.fetch を差し替えてスタブする。
/* eslint-disable no-console */
import assert from 'assert';
import worker, {isTrustedIp} from '../worker/index.js';

const ORIGIN = 'https://champierre.github.io';
const TRUSTED = '203.0.113.7';
const OTHER = '198.51.100.9';
const env = {
    ALLOWED_ORIGINS: ORIGIN,
    TRIAL_PASSWORD: 'secret-pass',
    TRUSTED_IPS: ` ${TRUSTED} , 203.0.113.8`,
    DEEPSEEK_API_KEY: 'sk-upstream'
};

const upstreamCalls = [];
globalThis.fetch = async (url, init) => {
    upstreamCalls.push({url, init});
    return new Response('{"ok":true}', {status: 200, headers: {'content-type': 'application/json'}});
};

const req = (path, {ip, method = 'GET', token, body} = {}) => new Request(`https://proxy.example${path}`, {
    method,
    headers: {
        Origin: ORIGIN,
        ...(ip ? {'CF-Connecting-IP': ip} : {}),
        ...(token ? {Authorization: `Bearer ${token}`} : {}),
        ...(body ? {'content-type': 'application/json'} : {})
    },
    body: body ? JSON.stringify(body) : undefined
});
const chat = (model, opts) => req('/chat/completions', {method: 'POST', body: {model, messages: []}, ...opts});

const main = async () => {
    // --- isTrustedIp: 完全一致のみ・空設定は常に false ---
    assert.strictEqual(isTrustedIp(TRUSTED, env.TRUSTED_IPS), true);
    assert.strictEqual(isTrustedIp('203.0.113.8', env.TRUSTED_IPS), true);
    assert.strictEqual(isTrustedIp(OTHER, env.TRUSTED_IPS), false);
    assert.strictEqual(isTrustedIp('203.0.113.70', env.TRUSTED_IPS), false);
    assert.strictEqual(isTrustedIp('', env.TRUSTED_IPS), false);
    assert.strictEqual(isTrustedIp(null, env.TRUSTED_IPS), false);
    assert.strictEqual(isTrustedIp(TRUSTED, undefined), false);
    assert.strictEqual(isTrustedIp('', ''), false);

    // --- GET /network: パスワードなしで trusted を返す ---
    let res = await worker.fetch(req('/network', {ip: TRUSTED}), env);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), {trusted: true});
    res = await worker.fetch(req('/network', {ip: OTHER}), env);
    assert.deepStrictEqual(await res.json(), {trusted: false});
    res = await worker.fetch(req('/network'), env);
    assert.deepStrictEqual(await res.json(), {trusted: false});

    // --- 信頼済みIP: パスワードなしで v4-flash が通る ---
    upstreamCalls.length = 0;
    res = await worker.fetch(chat('deepseek-v4-flash', {ip: TRUSTED}), env);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(upstreamCalls.length, 1);
    assert.strictEqual(upstreamCalls[0].init.headers.authorization, 'Bearer sk-upstream');
    // ダミーのトークンが付いていても通る(フロントは 'trusted-network' を送る)
    res = await worker.fetch(chat('deepseek-v4-flash', {ip: TRUSTED, token: 'trusted-network'}), env);
    assert.strictEqual(res.status, 200);
    // 信頼済みでも v4-flash 以外は拒否(高コストな v4-pro を含む)
    upstreamCalls.length = 0;
    for (const model of ['deepseek-v4-pro', 'gpt-5']) {
        res = await worker.fetch(chat(model, {ip: TRUSTED}), env);
        assert.strictEqual(res.status, 400, model);
    }
    assert.strictEqual(upstreamCalls.length, 0);

    // --- それ以外のIP: 従来どおり(パスワード必須・v4-flash のみ) ---
    upstreamCalls.length = 0;
    res = await worker.fetch(chat('deepseek-v4-flash', {ip: OTHER}), env);
    assert.strictEqual(res.status, 401);
    res = await worker.fetch(chat('deepseek-v4-flash', {ip: OTHER, token: 'trusted-network'}), env);
    assert.strictEqual(res.status, 401);
    assert.strictEqual(upstreamCalls.length, 0);
    res = await worker.fetch(chat('deepseek-v4-flash', {ip: OTHER, token: 'secret-pass'}), env);
    assert.strictEqual(res.status, 200);
    res = await worker.fetch(chat('deepseek-v4-pro', {ip: OTHER, token: 'secret-pass'}), env);
    assert.strictEqual(res.status, 400);

    // --- TRUSTED_IPS 未設定なら誰も信頼済みにならない ---
    const noTrust = {...env, TRUSTED_IPS: undefined};
    res = await worker.fetch(chat('deepseek-v4-flash', {ip: TRUSTED}), noTrust);
    assert.strictEqual(res.status, 401);

    console.log('worker.test.js: OK');
};

main().catch(e => { console.error(e); process.exit(1); });
