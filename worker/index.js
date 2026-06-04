// agent-scratch 試用モード用の Anthropic API プロキシ (Cloudflare Worker)
//
// APIキーは Worker の Secret (ANTHROPIC_API_KEY) に保持し、クライアントには渡さない。
// デプロイ:
//   cd worker
//   npx wrangler deploy
//   npx wrangler secret put ANTHROPIC_API_KEY   # 支出上限付きのキーを推奨

// お試しモードは最安のHaikuのみ許可
const ALLOWED_MODELS = [
    'claude-haiku-4-5-20251001'
];

const MAX_TOKENS_LIMIT = 16000;

const corsHeaders = (request, allowedOrigins) => {
    const origin = request.headers.get('Origin') || '';
    const allowed = allowedOrigins.includes(origin);
    return {
        allowed,
        headers: {
            'Access-Control-Allow-Origin': allowed ? origin : allowedOrigins[0],
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            // SDKが付ける x-stainless-* 等を通すため、preflightの要求ヘッダをそのまま許可
            'Access-Control-Allow-Headers':
                request.headers.get('Access-Control-Request-Headers') || '*',
            'Access-Control-Max-Age': '86400',
            Vary: 'Origin'
        }
    };
};

export default {
    async fetch(request, env) {
        const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
        const cors = corsHeaders(request, allowedOrigins);

        if (request.method === 'OPTIONS') {
            return new Response(null, {status: 204, headers: cors.headers});
        }
        if (!cors.allowed) {
            return Response.json({error: 'origin not allowed'}, {status: 403, headers: cors.headers});
        }

        const url = new URL(request.url);
        if (request.method !== 'POST' || url.pathname !== '/v1/messages') {
            return Response.json({error: 'not found'}, {status: 404, headers: cors.headers});
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return Response.json({error: 'invalid json'}, {status: 400, headers: cors.headers});
        }

        if (!ALLOWED_MODELS.includes(body.model)) {
            return Response.json({error: 'model not allowed'}, {status: 400, headers: cors.headers});
        }
        body.max_tokens = Math.min(body.max_tokens || MAX_TOKENS_LIMIT, MAX_TOKENS_LIMIT);
        body.stream = false; // ストリーミングは未対応

        const upstream = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': env.ANTHROPIC_API_KEY,
                'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01'
            },
            body: JSON.stringify(body)
        });

        return new Response(upstream.body, {
            status: upstream.status,
            headers: {...cors.headers, 'content-type': 'application/json'}
        });
    }
};
