/**
 * XPostAgent Cloudflare Worker
 * セレクタ管理・セルフヒーリング API
 */

// ログユーティリティ
const Logger = {
  info: (action, data) => console.log(`[Worker][INFO] ${action}`, JSON.stringify(data)),
  warn: (action, data) => console.log(`[Worker][WARN] ${action}`, JSON.stringify(data)),
  error: (action, data) => console.error(`[Worker][ERROR] ${action}`, JSON.stringify(data)),
  debug: (action, data) => console.log(`[Worker][DEBUG] ${action}`, JSON.stringify(data)),
};

// CORS ヘッダー
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  'Content-Type': 'application/json',
};

// レスポンスヘルパー
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}

function errorResponse(message, status = 400) {
  Logger.error('Response Error', { message, status });
  return jsonResponse({ success: false, error: message }, status);
}

// メインハンドラー
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    Logger.info('Request received', { method, path });

    // CORS プリフライト
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // ルーティング
      switch (path) {
        case '/api/health':
          return handleHealth(env);

        case '/api/selectors/get':
          if (method !== 'POST') return errorResponse('Method not allowed', 405);
          return handleGetSelectors(request, env);

        case '/api/selectors/validate':
          if (method !== 'POST') return errorResponse('Method not allowed', 405);
          return handleValidateSelectors(request, env);

        case '/api/selectors/heal':
          if (method !== 'POST') return errorResponse('Method not allowed', 405);
          return handleHealSelectors(request, env);

        case '/api/selectors/update':
          if (method !== 'POST') return errorResponse('Method not allowed', 405);
          return handleUpdateSelectors(request, env);

        default:
          return errorResponse('Not found', 404);
      }
    } catch (error) {
      Logger.error('Unhandled error', { message: error.message, stack: error.stack });
      return errorResponse('Internal server error', 500);
    }
  },
};

/**
 * ヘルスチェック
 */
async function handleHealth(env) {
  const kvStatus = await checkKVStatus(env);

  return jsonResponse({
    success: true,
    status: 'healthy',
    version: env.API_VERSION || '1.0.0',
    environment: env.ENVIRONMENT || 'development',
    kv: kvStatus,
    timestamp: new Date().toISOString(),
  });
}

async function checkKVStatus(env) {
  try {
    const version = await env.SELECTORS.get('selectors:current:version');
    return { connected: true, currentVersion: version || 'not initialized' };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

/**
 * セレクタ取得
 */
async function handleGetSelectors(request, env) {
  try {
    const body = await request.json();
    const { action } = body;

    Logger.info('Get selectors', { action });

    // 現在のセレクタを取得
    const selectorsJson = await env.SELECTORS.get('selectors:current');

    if (!selectorsJson) {
      Logger.warn('Selectors not found', { action });
      return jsonResponse({
        success: false,
        error: 'Selectors not initialized',
        needsInit: true,
      });
    }

    const selectors = JSON.parse(selectorsJson);

    // 特定のアクションのセレクタのみ返す場合
    if (action && selectors.selectors[action]) {
      return jsonResponse({
        success: true,
        version: selectors.version,
        selectors: selectors.selectors[action],
      });
    }

    // 全セレクタを返す
    return jsonResponse({
      success: true,
      version: selectors.version,
      updatedAt: selectors.updatedAt,
      selectors: selectors.selectors,
    });

  } catch (error) {
    Logger.error('Get selectors failed', { error: error.message });
    return errorResponse('Failed to get selectors: ' + error.message);
  }
}

/**
 * DOM 差分検証
 */
async function handleValidateSelectors(request, env) {
  try {
    const body = await request.json();
    const { currentDOM, version, failedSelectors } = body;

    Logger.info('Validate selectors', { version, failedSelectorsCount: failedSelectors?.length });

    // 保存されている DOM ハッシュを取得
    const storedHash = await env.SELECTORS.get('dom:hash');
    const currentHash = await hashDOM(currentDOM);

    const hasDifference = storedHash !== currentHash;

    if (hasDifference) {
      Logger.warn('DOM difference detected', { storedHash, currentHash });
    }

    return jsonResponse({
      success: true,
      isValid: !hasDifference && (!failedSelectors || failedSelectors.length === 0),
      hasDOMChange: hasDifference,
      hasFailedSelectors: failedSelectors && failedSelectors.length > 0,
      needsHealing: hasDifference || (failedSelectors && failedSelectors.length > 0),
      currentVersion: version,
    });

  } catch (error) {
    Logger.error('Validate selectors failed', { error: error.message });
    return errorResponse('Failed to validate: ' + error.message);
  }
}

/**
 * セルフヒーリング
 */
async function handleHealSelectors(request, env) {
  try {
    const body = await request.json();
    const { currentDOM, failedSelectors } = body;

    Logger.info('Heal selectors', { failedSelectors });

    if (!failedSelectors || failedSelectors.length === 0) {
      return errorResponse('No failed selectors specified');
    }

    // 現在のセレクタを取得
    const selectorsJson = await env.SELECTORS.get('selectors:current');
    const currentSelectors = selectorsJson ? JSON.parse(selectorsJson) : null;

    // AI を使用して新しいセレクタを生成
    const newSelectors = await generateSelectorsWithAI(env, currentDOM, failedSelectors, currentSelectors);

    if (!newSelectors.success) {
      Logger.error('AI healing failed', { error: newSelectors.error });
      return jsonResponse({
        success: false,
        error: 'Failed to generate new selectors',
        details: newSelectors.error,
      });
    }

    // 新バージョンを計算
    const newVersion = incrementVersion(currentSelectors?.version || '1.0.0');

    // 新しいセレクタを保存
    const updatedSelectors = {
      version: newVersion,
      updatedAt: new Date().toISOString(),
      selectors: {
        ...currentSelectors?.selectors,
        ...newSelectors.selectors,
      },
      healingHistory: [
        ...(currentSelectors?.healingHistory || []),
        {
          timestamp: new Date().toISOString(),
          healed: failedSelectors,
          previousVersion: currentSelectors?.version,
        },
      ],
    };

    // KV に保存
    await env.SELECTORS.put('selectors:current', JSON.stringify(updatedSelectors));
    await env.SELECTORS.put(`selectors:v${newVersion}`, JSON.stringify(updatedSelectors));
    await env.SELECTORS.put('dom:hash', await hashDOM(currentDOM));

    Logger.info('Healing completed', { newVersion, healedSelectors: Object.keys(newSelectors.selectors) });

    return jsonResponse({
      success: true,
      version: newVersion,
      newSelectors: newSelectors.selectors,
      message: 'Selectors healed successfully',
    });

  } catch (error) {
    Logger.error('Heal selectors failed', { error: error.message });
    return errorResponse('Failed to heal selectors: ' + error.message);
  }
}

/**
 * セレクタ更新（管理用）
 */
async function handleUpdateSelectors(request, env) {
  try {
    const body = await request.json();
    const { selectors, version, domSnapshot } = body;

    Logger.info('Update selectors', { version });

    if (!selectors || !version) {
      return errorResponse('selectors and version are required');
    }

    const selectorData = {
      version,
      updatedAt: new Date().toISOString(),
      selectors,
    };

    // KV に保存
    await env.SELECTORS.put('selectors:current', JSON.stringify(selectorData));
    await env.SELECTORS.put(`selectors:v${version}`, JSON.stringify(selectorData));
    await env.SELECTORS.put('selectors:current:version', version);

    if (domSnapshot) {
      await env.SELECTORS.put('dom:baseline', domSnapshot);
      await env.SELECTORS.put('dom:hash', await hashDOM(domSnapshot));
    }

    Logger.info('Selectors updated', { version });

    return jsonResponse({
      success: true,
      version,
      message: 'Selectors updated successfully',
    });

  } catch (error) {
    Logger.error('Update selectors failed', { error: error.message });
    return errorResponse('Failed to update selectors: ' + error.message);
  }
}

/**
 * AI によるセレクタ生成
 */
async function generateSelectorsWithAI(env, currentDOM, failedSelectors, currentSelectors) {
  try {
    // AI バインディングが利用可能か確認
    if (!env.AI) {
      Logger.warn('AI binding not available, using fallback');
      return generateFallbackSelectors(failedSelectors, currentSelectors);
    }

    const prompt = `あなたはWebページのDOM解析エキスパートです。

【タスク】
X（Twitter）の投稿画面において、以下の要素を特定するCSSセレクタを提案してください。

【現在のDOM構造（一部）】
${currentDOM.slice(0, 5000)}

【特定したい要素】
${failedSelectors.join(', ')}

【以前のセレクタ（動作しなくなった）】
${JSON.stringify(currentSelectors?.selectors || {}, null, 2).slice(0, 2000)}

【出力形式】
以下のJSON形式で返してください。他のテキストは含めないでください。
{
  "selectors": {
    "要素名": {
      "primary": "プライマリセレクタ",
      "fallback": ["フォールバック1", "フォールバック2"]
    }
  }
}`;

    const response = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
      prompt,
      max_tokens: 1000,
    });

    // レスポンスからJSONを抽出
    const jsonMatch = response.response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI response does not contain valid JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return { success: true, selectors: parsed.selectors };

  } catch (error) {
    Logger.error('AI generation failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * フォールバックセレクタ生成
 */
function generateFallbackSelectors(failedSelectors, currentSelectors) {
  const fallbackMap = {
    textArea: {
      primary: '[data-testid="tweetTextarea_0"]',
      fallback: ['[role="textbox"][aria-label="Post text"]', 'div[contenteditable="true"]'],
    },
    postButton: {
      primary: '[data-testid="tweetButton"]',
      fallback: ['[data-testid="tweetButtonInline"]', 'button[type="submit"]'],
    },
    fileInput: {
      primary: '[data-testid="fileInput"]',
      fallback: ['input[type="file"][accept*="image"]'],
    },
    gifButton: {
      primary: '[data-testid="gifSearchButton"]',
      fallback: ['[aria-label="Add a GIF"]'],
    },
    pollButton: {
      primary: '[data-testid="createPollButton"]',
      fallback: ['[aria-label="Add poll"]'],
    },
    scheduleButton: {
      primary: '[data-testid="scheduleOption"]',
      fallback: ['[aria-label="Schedule post"]'],
    },
  };

  const result = {};
  for (const selector of failedSelectors) {
    if (fallbackMap[selector]) {
      result[selector] = fallbackMap[selector];
    }
  }

  return { success: true, selectors: result };
}

/**
 * DOM ハッシュ生成
 */
async function hashDOM(dom) {
  const encoder = new TextEncoder();
  const data = encoder.encode(dom);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * バージョン番号インクリメント
 */
function incrementVersion(version) {
  const parts = version.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join('.');
}
