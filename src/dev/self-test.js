// ?selftest=1 でVMツールハンドラをClaudeなしで通しで検証する開発用スクリプト
// ?agenttest=1 でお試しモード(プロキシ)経由のエージェントループをE2E検証する
/* eslint-disable no-console */
import {createToolHandlers} from '../agent/tool-handlers';
import {runAgent, isTrialAvailable} from '../agent/agent-loop';

export const maybeRunAgentTest = vm => {
    if (!new URLSearchParams(window.location.search).has('agenttest')) return;
    const run = async () => {
        console.log('[agenttest] start (trial available:', isTrialAvailable(), ')');
        let deltaCount = 0;
        let firstDeltaAt = null;
        const startedAt = Date.now();
        try {
            await runAgent({
                apiKey: '',
                vm,
                userText: 'ネコが旗をクリックしたら右に動き続けるようにして',
                apiMessages: [],
                onAssistantStart: () => console.log('[agenttest] turn start at', Date.now() - startedAt, 'ms'),
                onAssistantDelta: delta => {
                    deltaCount++;
                    if (!firstDeltaAt) {
                        firstDeltaAt = Date.now() - startedAt;
                        console.log('[agenttest] first delta at', firstDeltaAt, 'ms:', JSON.stringify(delta));
                    }
                },
                onAssistantText: t => console.log('[agenttest] text:', t),
                onToolStart: s => console.log('[agenttest] tool start:', s),
                onToolEnd: ok => console.log('[agenttest] tool end:', ok),
                onUsage: cost => console.log('[agenttest] usage cost: $' + cost.toFixed(5))
            });
            console.log('[agenttest] PASSED. deltas:', deltaCount, 'elapsed:', Date.now() - startedAt, 'ms');
        } catch (e) {
            console.error('[agenttest] FAILED:', e.message);
        }
    };
    setTimeout(run, 4000);
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export const maybeRunSelfTest = vm => {
    if (!new URLSearchParams(window.location.search).has('selftest')) return;
    const handlers = createToolHandlers(vm);

    const run = async () => {
        console.log('[selftest] start');
        try {
            // ライブラリ検索
            const found = handlers.search_library({kind: 'sprite', query: 'ball'});
            console.log('[selftest] search:', found.results.map(r => r.name).join(', '));

            // スプライト追加
            const added = await handlers.add_sprite({name: 'Ball'});
            console.log('[selftest] add_sprite:', JSON.stringify(added));

            // Ballにスクリプト
            handlers.set_scripts({
                target: 'Ball',
                scripts: [
                    {blocks: [
                        {opcode: 'event_whenflagclicked'},
                        {opcode: 'control_forever', substack: [
                            {opcode: 'motion_glideto', inputs: {SECS: 1, TO: '_random_'}}
                        ]}
                    ]}
                ]
            });
            await delay(500);

            // ネコ(Sprite1)に変数つきスクリプト
            handlers.set_scripts({
                target: 'Sprite1',
                scripts: [
                    {blocks: [
                        {opcode: 'event_whenflagclicked'},
                        {opcode: 'data_setvariableto', fields: {VARIABLE: 'スコア'}, inputs: {VALUE: 0}},
                        {opcode: 'control_forever', substack: [
                            {opcode: 'motion_movesteps', inputs: {STEPS: 10}},
                            {opcode: 'motion_ifonedgebounce'},
                            {opcode: 'control_if',
                                inputs: {CONDITION: {opcode: 'sensing_touchingobject',
                                    inputs: {TOUCHINGOBJECTMENU: 'Ball'}}},
                                substack: [
                                    {opcode: 'data_changevariableby', fields: {VARIABLE: 'スコア'}, inputs: {VALUE: 1}},
                                    {opcode: 'looks_sayforsecs', inputs: {MESSAGE: 'あたった!', SECS: 1}}
                                ]}
                        ]}
                    ]}
                ]
            });

            // プロパティ設定
            handlers.set_sprite_properties({target: 'Ball', x: 150, y: 100, size: 80});

            // 状態取得(逆変換の確認)
            const state = handlers.get_project_state();
            console.log('[selftest] project state:', JSON.stringify(state, null, 1));
            console.log('[selftest] PASSED');
        } catch (e) {
            console.error('[selftest] FAILED:', e);
        }
    };

    // プロジェクト読み込み完了を待ってから実行
    setTimeout(run, 4000);
};
