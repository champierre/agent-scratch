// Anthropic Messages API の手動 tool use ループ
import Anthropic from '@anthropic-ai/sdk';
import {TOOLS, summarizeToolCall} from './tools';
import {SYSTEM_PROMPT} from './system-prompt';
import {createToolHandlers, ToolError} from './tool-handlers';

export class AuthError extends Error {}

const MODEL_STORAGE_KEY = 'agent-scratch-model';
export const DEFAULT_MODEL = 'claude-opus-4-8';
export const getModel = () => localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL;
export const setModel = model => localStorage.setItem(MODEL_STORAGE_KEY, model);

const MAX_ITERATIONS = 30;
const MAX_TOKENS = 16000;

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
    onAssistantText,
    onToolStart,
    onToolEnd
}) => {
    const client = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true,
        defaultHeaders: {'anthropic-dangerous-direct-browser-access': 'true'}
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
            response = await client.messages.create({
                model: getModel(),
                max_tokens: MAX_TOKENS,
                system,
                tools,
                messages: apiMessages,
                ...(useThinking ? {thinking: {type: 'adaptive'}} : {})
            }, {signal});
        } catch (e) {
            if (e instanceof Anthropic.AuthenticationError) {
                throw new AuthError(e.message);
            }
            if (e instanceof Anthropic.RateLimitError) {
                throw new Error('レート制限に達しました。しばらく待ってからもう一度試してください。');
            }
            // adaptive thinking 未対応モデルへのフォールバック
            if (useThinking && e instanceof Anthropic.BadRequestError &&
                String(e.message).includes('thinking')) {
                useThinking = false;
                iteration--;
                continue;
            }
            if (e instanceof Anthropic.APIConnectionError) {
                throw new Error('Anthropic API に接続できませんでした。ネットワークを確認してください。');
            }
            throw e;
        }

        apiMessages.push({role: 'assistant', content: response.content});

        // テキスト部分をUIへ
        for (const block of response.content) {
            if (block.type === 'text' && block.text.trim()) {
                onAssistantText(block.text);
            }
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
