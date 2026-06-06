// Anthropic Messages API の手動 tool use ループ
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {TOOLS, BLOCK_TOOL_NAMES, summarizeToolCall, draftingLabel} from './tools';
import {SYSTEM_PROMPT, getBlockOperationPrompt} from './system-prompt';
import {createToolHandlers, ToolError} from './tool-handlers';

export class AuthError extends Error {}

// 試用モード: キー未入力時に使うプロキシURL(ビルド時に注入。空なら無効)
const TRIAL_PROXY_URL = process.env.TRIAL_PROXY_URL;

const TRIAL_TOKEN_KEY = 'agent-scratch-trial-token';

// URLパラメータ ?p=xxx からトークンを読み取り localStorage に保存する(起動時に呼ぶ)
export const initTrialToken = () => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('p');
    if (p) {
        localStorage.setItem(TRIAL_TOKEN_KEY, p);
        // URL からパラメータを除去(リロード後も残らないよう)
        params.delete('p');
        const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
        window.history.replaceState({}, '', newUrl);
    }
};

export const getTrialToken = () => localStorage.getItem(TRIAL_TOKEN_KEY) || '';

// TRIAL_PROXY_URL が設定されており、かつトークンが保存済みの場合のみ試用モード有効
export const isTrialAvailable = () => Boolean(TRIAL_PROXY_URL && getTrialToken());

const MODEL_STORAGE_KEY = 'agent-scratch-model';
const DEEPSEEK_API_KEY_STORAGE_KEY = 'agent-scratch-deepseek-api-key';
const OPENAI_API_KEY_STORAGE_KEY = 'agent-scratch-openai-api-key';
const GEMINI_API_KEY_STORAGE_KEY = 'agent-scratch-gemini-api-key';

// ローカル開発用キー(.env から webpack DefinePlugin で注入。未設定なら空文字)
export const DEV_ANTHROPIC_KEY = process.env.DEV_ANTHROPIC_API_KEY || '';
const DEV_DEEPSEEK_KEY = process.env.DEV_DEEPSEEK_API_KEY || '';
const DEV_OPENAI_KEY = process.env.DEV_OPENAI_API_KEY || '';
const DEV_GEMINI_KEY = process.env.DEV_GEMINI_API_KEY || '';

export const DEFAULT_MODEL = 'deepseek-chat'; // デフォルトモデル
export const TRIAL_MODEL = 'deepseek-chat';   // お試しモードで使うモデル
export const getModel = () => localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL;
export const setModel = model => localStorage.setItem(MODEL_STORAGE_KEY, model);
export const getDeepSeekApiKey = () => localStorage.getItem(DEEPSEEK_API_KEY_STORAGE_KEY) || DEV_DEEPSEEK_KEY;
export const setDeepSeekApiKey = key => localStorage.setItem(DEEPSEEK_API_KEY_STORAGE_KEY, key);
export const isDeepSeekModel = model => model && model.startsWith('deepseek-');
export const getOpenAIApiKey = () => localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || DEV_OPENAI_KEY;
export const setOpenAIApiKey = key => localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, key);
export const isOpenAIModel = model => model && model.startsWith('gpt-');
export const getGeminiApiKey = () => localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || DEV_GEMINI_KEY;
export const setGeminiApiKey = key => localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, key);
export const isGeminiModel = model => model && model.startsWith('gemini-');

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

// Anthropic形式のツール定義 → OpenAI形式に変換
const toOpenAITools = tools => tools.map(({name, description, input_schema}) => ({
    type: 'function',
    function: {name, description, parameters: input_schema}
}));

// OpenAI形式の会話履歴をAnthropicのapiMessagesに追加するためのアダプタ
// ここではOpenAI形式のメッセージ配列を別途管理する
const anthropicToOpenAIMessages = messages => {
    const result = [];
    for (const msg of messages) {
        if (msg.role === 'user') {
            // tool_result を含む場合 → tool メッセージ群に変換
            const toolResults = Array.isArray(msg.content)
                ? msg.content.filter(b => b.type === 'tool_result')
                : [];
            const textBlocks = Array.isArray(msg.content)
                ? msg.content.filter(b => b.type === 'text')
                : [];
            for (const tr of toolResults) {
                result.push({role: 'tool', tool_call_id: tr.tool_use_id, content: tr.content});
            }
            if (textBlocks.length > 0) {
                result.push({role: 'user', content: textBlocks.map(b => b.text).join('\n')});
            }
        } else if (msg.role === 'assistant') {
            const textBlocks = Array.isArray(msg.content)
                ? msg.content.filter(b => b.type === 'text')
                : [];
            const toolUses = Array.isArray(msg.content)
                ? msg.content.filter(b => b.type === 'tool_use')
                : [];
            const text = textBlocks.map(b => b.text).join('\n') || null;
            const tool_calls = toolUses.length > 0
                ? toolUses.map(b => ({
                    id: b.id,
                    type: 'function',
                    function: {name: b.name, arguments: JSON.stringify(b.input)}
                }))
                : undefined;
            result.push({role: 'assistant', content: text, ...(tool_calls ? {tool_calls} : {})});
        }
    }
    return result;
};

// OpenAI SDK が自動付与する x-stainless-* ヘッダの除去指定。
// Google の OpenAI 互換エンドポイントはこれらを CORS で許可しておらず、
// 付いているとプリフライトが 403 になり "Connection error." で失敗する
const STRIP_STAINLESS_HEADERS = {
    'x-stainless-arch': null,
    'x-stainless-lang': null,
    'x-stainless-os': null,
    'x-stainless-package-version': null,
    'x-stainless-retry-count': null,
    'x-stainless-runtime': null,
    'x-stainless-runtime-version': null,
    'x-stainless-timeout': null,
    'x-stainless-helper-method': null
};

/**
 * OpenAI互換 (DeepSeek / OpenAI / Gemini 共用) エージェントループ
 */
const runOpenAICompatAgent = async ({
    apiKey: compatApiKey,
    baseURL,
    stripSdkHeaders,
    model: modelOverride,
    vm,
    userText,
    apiMessages,
    signal,
    blocksEnabled,
    onAssistantStart,
    onAssistantDelta,
    onAssistantText,
    onToolStart,
    onToolEnd,
    onToolDrafting
}) => {
    const model = modelOverride || getModel();
    const isOpenAI = isOpenAIModel(model);
    const client = new OpenAI({
        apiKey: compatApiKey,
        baseURL: baseURL || 'https://api.deepseek.com',
        dangerouslyAllowBrowser: true,
        timeout: REQUEST_TIMEOUT_MS,
        maxRetries: 2, // 503等の一時エラーに耐えるため(指数バックオフで自動再試行)
        ...(stripSdkHeaders ? {defaultHeaders: STRIP_STAINLESS_HEADERS} : {})
    });
    const handlers = createToolHandlers(vm, {blocksEnabled});
    const activeTools = blocksEnabled ? TOOLS : TOOLS.filter(t => !BLOCK_TOOL_NAMES.has(t.name));
    const oaiTools = toOpenAITools(activeTools);
    const systemMessages = [
        {role: 'system', content: SYSTEM_PROMPT},
        {role: 'system', content: getBlockOperationPrompt(blocksEnabled)}
    ];

    apiMessages.push({role: 'user', content: [{type: 'text', text: userText}]});

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        if (signal && signal.aborted) return;

        const oaiMessages = anthropicToOpenAIMessages(apiMessages);

        let assistantText = '';
        let toolCalls = [];

        try {
            if (onAssistantStart) onAssistantStart();
            const stream = await client.chat.completions.create({
                model,
                // GPT-5系は max_tokens 非対応(max_completion_tokens を使う)。
                // ストリーミング時の usage 取得も OpenAI は明示オプトインが必要
                ...(isOpenAI
                    ? {max_completion_tokens: MAX_TOKENS}
                    : {max_tokens: MAX_TOKENS}),
                messages: [...systemMessages, ...oaiMessages],
                tools: oaiTools,
                tool_choice: 'auto',
                stream: true
            }, {signal});

            // ストリーミングでテキストとtool_callsを収集
            const partialToolCalls = {};
            for await (const chunk of stream) {
                if (signal && signal.aborted) return;
                const delta = chunk.choices[0]?.delta;
                if (!delta) continue;

                if (delta.content) {
                    assistantText += delta.content;
                    if (onAssistantDelta) onAssistantDelta(delta.content);
                }
                if (delta.tool_calls) {
                    for (const tc of delta.tool_calls) {
                        if (!partialToolCalls[tc.index]) {
                            partialToolCalls[tc.index] = {id: '', type: 'function', function: {name: '', arguments: ''}};
                            if (onToolDrafting && tc.function?.name) {
                                onToolDrafting(draftingLabel(tc.function.name), 0);
                            }
                        }
                        const p = partialToolCalls[tc.index];
                        if (tc.id) p.id += tc.id;
                        if (tc.function?.name) p.function.name += tc.function.name;
                        if (tc.function?.arguments) {
                            p.function.arguments += tc.function.arguments;
                            if (onToolDrafting) {
                                onToolDrafting(draftingLabel(p.function.name), p.function.arguments.length);
                            }
                        }
                    }
                }
                if (chunk.choices[0]?.finish_reason && onToolDrafting) {
                    onToolDrafting(null, 0);
                }

            }
            toolCalls = Object.values(partialToolCalls);
        } catch (e) {
            if (e?.status === 401 || e?.code === 'invalid_api_key') throw new AuthError(e.message);
            if (e?.status === 429) throw new Error('混み合っています。少し待ってからもう一度試してください。');
            if (e?.status >= 500) {
                // Gemini等で頻発する一時的なサーバ過負荷(503など)
                throw new Error(
                    `AIサーバが混み合っているか一時的に不調です(${e.status})。` +
                    '少し待ってから、同じ内容をもう一度送ってください。');
            }
            if (e?.name === 'AbortError' || e?.name === 'APIUserAbortError') return;
            throw e;
        }

        // apiMessages に assistant の応答を追記 (Anthropic形式で統一管理)
        const assistantContent = [];
        if (assistantText) assistantContent.push({type: 'text', text: assistantText});
        for (const tc of toolCalls) {
            let input = {};
            try { input = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
            assistantContent.push({type: 'tool_use', id: tc.id, name: tc.function.name, input});
        }
        apiMessages.push({role: 'assistant', content: assistantContent});

        if (toolCalls.length === 0) return;

        // ツール実行
        const toolResults = [];
        for (const tc of toolCalls) {
            if (signal && signal.aborted) return;
            let input = {};
            try { input = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
            onToolStart(summarizeToolCall(tc.function.name, input));
            let result;
            let isError = false;
            try {
                const handler = handlers[tc.function.name];
                if (!handler) throw new ToolError(`未知のツール: ${tc.function.name}`);
                result = await handler(input);
            } catch (e) {
                isError = true;
                result = {error: e.message};
                if (!(e instanceof ToolError)) {
                    console.error(`tool ${tc.function.name} failed:`, e); // eslint-disable-line no-console
                }
            }
            onToolEnd(!isError, isError ? String(result.error) : undefined);
            toolResults.push({
                type: 'tool_result',
                tool_use_id: tc.id,
                content: JSON.stringify(result),
                ...(isError ? {is_error: true} : {})
            });
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        apiMessages.push({role: 'user', content: toolResults});
    }

    onAssistantText('(ツール実行回数の上限に達したため停止しました。続きが必要なら指示してください)');
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
    blocksEnabled = true,
    onAssistantStart,
    onAssistantDelta,
    onAssistantText,
    onToolStart,
    onToolEnd,
    onToolDrafting
}) => {
    const model = getModel();

    // お試しモード: キー未入力 + プロキシURL設定済み + トークン保存済み → DeepSeek プロキシ経由
    const useTrial = !apiKey && !getDeepSeekApiKey() && !getOpenAIApiKey() && !getGeminiApiKey() && isTrialAvailable();
    if (useTrial) {
        return runOpenAICompatAgent({
            apiKey: getTrialToken(),
            baseURL: TRIAL_PROXY_URL,
            model: TRIAL_MODEL,
            // お試しモードはブロック操作不可(説明・解説モード固定)
            vm, userText, apiMessages, signal, blocksEnabled: false,
            onAssistantStart, onAssistantDelta, onAssistantText,
            onToolStart, onToolEnd, onToolDrafting
        });
    }

    // DeepSeekモデルが選択されている場合はOpenAI互換ループへ
    if (isDeepSeekModel(model)) {
        const deepseekApiKey = getDeepSeekApiKey();
        if (!deepseekApiKey) throw new AuthError('DeepSeek APIキーが設定されていません。⚙️ から設定してください。');
        return runOpenAICompatAgent({
            apiKey: deepseekApiKey, vm, userText, apiMessages, signal, blocksEnabled,
            onAssistantStart, onAssistantDelta, onAssistantText,
            onToolStart, onToolEnd, onToolDrafting
        });
    }

    // OpenAI (GPT) モデルが選択されている場合もOpenAI互換ループへ
    if (isOpenAIModel(model)) {
        const openaiApiKey = getOpenAIApiKey();
        if (!openaiApiKey) throw new AuthError('OpenAI APIキーが設定されていません。⚙️ から設定してください。');
        return runOpenAICompatAgent({
            apiKey: openaiApiKey,
            baseURL: 'https://api.openai.com/v1',
            vm, userText, apiMessages, signal, blocksEnabled,
            onAssistantStart, onAssistantDelta, onAssistantText,
            onToolStart, onToolEnd, onToolDrafting
        });
    }

    // Google Gemini モデルもOpenAI互換エンドポイント経由で同じループへ
    if (isGeminiModel(model)) {
        const geminiApiKey = getGeminiApiKey();
        if (!geminiApiKey) throw new AuthError('Gemini APIキーが設定されていません。⚙️ から設定してください。');
        return runOpenAICompatAgent({
            apiKey: geminiApiKey,
            baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
            stripSdkHeaders: true,
            vm, userText, apiMessages, signal, blocksEnabled,
            onAssistantStart, onAssistantDelta, onAssistantText,
            onToolStart, onToolEnd, onToolDrafting
        });
    }

    // Anthropic モデル
    const effectiveModel = model;
    const client = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true,
        defaultHeaders: {'anthropic-dangerous-direct-browser-access': 'true'},
        timeout: REQUEST_TIMEOUT_MS,
        maxRetries: 1
    });
    const handlers = createToolHandlers(vm, {blocksEnabled});

    // システムプロンプトとツール定義は固定 → prompt caching
    const system = [
        {type: 'text', text: SYSTEM_PROMPT, cache_control: {type: 'ephemeral'}},
        {type: 'text', text: getBlockOperationPrompt(blocksEnabled)}
    ];
    const activeTools = blocksEnabled ? TOOLS : TOOLS.filter(t => !BLOCK_TOOL_NAMES.has(t.name));
    const tools = activeTools.map((tool, i) =>
        (i === activeTools.length - 1 ? {...tool, cache_control: {type: 'ephemeral'}} : tool)
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
                model: effectiveModel,
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
            if (e instanceof Anthropic.InternalServerError) {
                throw new Error(
                    `AIサーバが混み合っているか一時的に不調です(${e.status})。` +
                    '少し待ってから、同じ内容をもう一度送ってください。');
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
            onToolEnd(!isError, isError ? String(result.error) : undefined);
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
