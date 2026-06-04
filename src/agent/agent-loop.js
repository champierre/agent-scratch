// Anthropic Messages API の手動 tool use ループ
import Anthropic from '@anthropic-ai/sdk';
import {TOOLS, summarizeToolCall, draftingLabel} from './tools';
import {SYSTEM_PROMPT} from './system-prompt';
import {createToolHandlers, ToolError} from './tool-handlers';

export class AuthError extends Error {}

// 試用モード: キー未入力時に使うプロキシURL(ビルド時に注入。空なら無効)
const TRIAL_PROXY_URL = process.env.TRIAL_PROXY_URL;
export const isTrialAvailable = () => Boolean(TRIAL_PROXY_URL);

const MODEL_STORAGE_KEY = 'agent-scratch-model';
export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'; // 最安モデルをデフォルトに
export const getModel = () => localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL;
export const setModel = model => localStorage.setItem(MODEL_STORAGE_KEY, model);

// 100万トークンあたりのUSD単価(概算用)。キャッシュ書込は入力の1.25倍、読出は0.1倍
const PRICING = {
    'claude-opus-4-8': {input: 5, output: 25},
    'claude-sonnet-4-6': {input: 3, output: 15},
    'claude-haiku-4-5-20251001': {input: 1, output: 5}
};

export const estimateCost = (model, usage) => {
    const price = PRICING[model] || PRICING[DEFAULT_MODEL];
    return (
        ((usage.input_tokens || 0) * price.input) +
        ((usage.cache_creation_input_tokens || 0) * price.input * 1.25) +
        ((usage.cache_read_input_tokens || 0) * price.input * 0.1) +
        ((usage.output_tokens || 0) * price.output)
    ) / 1e6;
};

const MAX_ITERATIONS = 30;
const MAX_TOKENS = 16000;
const REQUEST_TIMEOUT_MS = 180000; // 1回のAPI呼び出しの上限(ストリーミングなので通常は当たらない保険)

// 会話の末尾に cache_control を付け直す(移動式ブレークポイント)
const moveCacheMarker = messages => {
    for (const message of messages) {
        if (!Array.isArray(message.content)) continue;
        for (const block of message.content) {
            if (block.cache_control) delete block.cache_control;
        }
    }
    const last = messages[messages.length - 1];
    if (last && Array.isArray(last.content) && last.content.length > 0) {
        const lastBlock = last.content[last.content.length - 1];
        if (['text', 'tool_result', 'tool_use'].includes(lastBlock.type)) {
            lastBlock.cache_control = {type: 'ephemeral'};
        }
    }
};

/**
 * エージェントループを実行する。
 * apiMessages は呼び出し側が保持する会話履歴(Anthropic形式)で、in-place に更新される。
 */
export const runAgent = async ({
    apiKey,
    vm,
    userText,
    apiMessages,
    signal,
    onAssistantStart,
    onAssistantDelta,
    onAssistantText,
    onToolStart,
    onToolEnd,
    onToolDrafting,
    onUsage
}) => {
    // キー未入力なら試用プロキシ経由(キーはWorker側のSecretが使われる)
    const useTrial = !apiKey && isTrialAvailable();
    // お試しモードは最安のHaikuに固定(Worker側でも同じ制限をかけている)
    const model = useTrial ? DEFAULT_MODEL : getModel();
    const client = new Anthropic({
        apiKey: useTrial ? 'trial-mode' : apiKey,
        ...(useTrial ? {baseURL: TRIAL_PROXY_URL} : {}),
        dangerouslyAllowBrowser: true,
        defaultHeaders: {'anthropic-dangerous-direct-browser-access': 'true'},
        timeout: REQUEST_TIMEOUT_MS,
        maxRetries: 1
    });
    const handlers = createToolHandlers(vm);

    // システムプロンプトとツール定義は固定 → prompt caching
    const system = [{type: 'text', text: SYSTEM_PROMPT, cache_control: {type: 'ephemeral'}}];
    const tools = TOOLS.map((tool, i) =>
        (i === TOOLS.length - 1 ? {...tool, cache_control: {type: 'ephemeral'}} : tool)
    );

    apiMessages.push({role: 'user', content: [{type: 'text', text: userText}]});

    let useThinking = true;
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        if (signal && signal.aborted) return;
        moveCacheMarker(apiMessages);

        let response;
        try {
            // ストリーミングで呼び出し、textの増分をUIへ逐次反映する
            if (onAssistantStart) onAssistantStart();
            const stream = client.messages.stream({
                model,
                max_tokens: MAX_TOKENS,
                system,
                tools,
                messages: apiMessages,
                ...(useThinking ? {thinking: {type: 'adaptive'}} : {})
            }, {signal});
            if (onAssistantDelta) {
                stream.on('text', delta => onAssistantDelta(delta));
            }
            // ツール入力(JSON)の生成中は本文テキストが流れないため、
            // 「○○を書いています...(n文字)」の進捗をUIへ送る
            if (onToolDrafting) {
                let draftLabel = null;
                let draftChars = 0;
                stream.on('streamEvent', event => {
                    if (event.type === 'content_block_start' &&
                        event.content_block.type === 'tool_use') {
                        draftLabel = draftingLabel(event.content_block.name);
                        draftChars = 0;
                        onToolDrafting(draftLabel, 0);
                    } else if (event.type === 'content_block_delta' &&
                        event.delta.type === 'input_json_delta' && draftLabel) {
                        draftChars += event.delta.partial_json.length;
                        onToolDrafting(draftLabel, draftChars);
                    } else if (event.type === 'content_block_stop' && draftLabel) {
                        draftLabel = null;
                        onToolDrafting(null, 0);
                    }
                });
            }
            // 完全なMessage(thinking/tool_useブロック込み)を取得
            response = await stream.finalMessage();
        } catch (e) {
            if (e instanceof Anthropic.AuthenticationError) {
                throw new AuthError(e.message);
            }
            if (e instanceof Anthropic.RateLimitError) {
                throw new Error('混み合っています。少し待ってからもう一度試してください。');
            }
            // adaptive thinking 未対応モデルへのフォールバック
            if (useThinking && e instanceof Anthropic.BadRequestError &&
                String(e.message).includes('thinking')) {
                useThinking = false;
                iteration--;
                continue;
            }
            if (e instanceof Anthropic.BadRequestError &&
                String(e.message).includes('model not allowed')) {
                throw new Error('お試しモードでは使えないモデルです。⚙️ から自分のAPIキーを設定してください。');
            }
            if (e instanceof Anthropic.APIConnectionTimeoutError) {
                throw new Error('時間がかかりすぎたため中断しました。タスクを小さく分けて指示してみてください(例:「まずボールとパドルだけ作って」)。');
            }
            if (e instanceof Anthropic.APIUserAbortError) {
                return; // ユーザーによる停止
            }
            if (e instanceof Anthropic.APIConnectionError) {
                throw new Error('Anthropic API に接続できませんでした。ネットワークを確認してください。');
            }
            throw e;
        }

        apiMessages.push({role: 'assistant', content: response.content});

        if (onUsage && response.usage) {
            onUsage(estimateCost(model, response.usage));
        }

        if (response.stop_reason !== 'tool_use') {
            if (response.stop_reason === 'max_tokens') {
                onAssistantText('(出力が長すぎて途中で切れました。続きを指示してください)');
            }
            return;
        }

        // ツール実行
        const toolResults = [];
        for (const block of response.content) {
            if (block.type !== 'tool_use') continue;
            if (signal && signal.aborted) return;
            onToolStart(summarizeToolCall(block.name, block.input));
            let result;
            let isError = false;
            try {
                const handler = handlers[block.name];
                if (!handler) throw new ToolError(`未知のツール: ${block.name}`);
                result = await handler(block.input);
            } catch (e) {
                isError = true;
                result = {error: e.message};
                if (!(e instanceof ToolError)) {
                    // 想定外の例外はコンソールにも出す
                    console.error(`tool ${block.name} failed:`, e); // eslint-disable-line no-console
                }
            }
            onToolEnd(!isError);
            toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result),
                ...(isError ? {is_error: true} : {})
            });
            // ブロックが組まれていく様子を見せるための小休止
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        apiMessages.push({role: 'user', content: toolResults});
    }

    onAssistantText('(ツール実行回数の上限に達したため停止しました。続きが必要なら指示してください)');
};
