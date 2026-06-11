// テスト用 agent-loop スタブ。runAgent への引数(特に blocksEnabled)を記録する。
// 実APIを呼ばずに container のロジックだけを検証するために使う。
export class AuthError extends Error {}

let lastRunAgentArgs = null;
export const __getLastRunAgentArgs = () => lastRunAgentArgs;
export const __reset = () => { lastRunAgentArgs = null; };

export const runAgent = async opts => { lastRunAgentArgs = opts; };

export const getModel = () => 'deepseek-chat';
export const setModel = () => {};
export const isTrialAvailable = () => false;
export const getDeepSeekApiKey = () => 'dummy-key';
export const setDeepSeekApiKey = () => {};
export const isDeepSeekModel = m => !!m && m.startsWith('deepseek-');
export const getOpenAIApiKey = () => '';
export const setOpenAIApiKey = () => {};
export const isOpenAIModel = m => !!m && m.startsWith('gpt-');
export const getGeminiApiKey = () => '';
export const setGeminiApiKey = () => {};
export const isGeminiModel = m => !!m && m.startsWith('gemini-');
export const LOCAL_MODEL = 'Qwen3-Coder-480B-A35B-Instruct-FP8';
export const getLocalApiKey = () => '';
export const setLocalApiKey = () => {};
export const isLocalModel = m => m === LOCAL_MODEL;
export const initTrialToken = () => {};
export const DEV_ANTHROPIC_KEY = '';
