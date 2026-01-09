/**
 * XPostAgent Background Service Worker
 * 拡張機能のコア処理・メッセージング管理
 */

const API_BASE_URL = 'https://xpostagent-worker.menu-simulator.workers.dev';

// ログユーティリティ
const Logger = {
  info: (action, data) => console.log(`[XPostAgent][INFO][Background] ${action}`, data),
  warn: (action, data) => console.warn(`[XPostAgent][WARN][Background] ${action}`, data),
  error: (action, data) => console.error(`[XPostAgent][ERROR][Background] ${action}`, data),
  debug: (action, data) => console.log(`[XPostAgent][DEBUG][Background] ${action}`, data),
};

// 状態管理
const state = {
  selectors: null,
  selectorsVersion: null,
};

/**
 * 初期化
 */
async function init() {
  Logger.info('初期化開始', {});

  // セレクタを取得してキャッシュ
  await fetchAndCacheSelectors();

  Logger.info('初期化完了', { version: state.selectorsVersion });
}

/**
 * セレクタ取得・キャッシュ
 */
async function fetchAndCacheSelectors() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/selectors/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    if (data.success) {
      state.selectors = data.selectors;
      state.selectorsVersion = data.version;
      Logger.info('セレクタ取得成功', { version: data.version });
    } else {
      throw new Error(data.error || 'Failed to get selectors');
    }
  } catch (error) {
    Logger.error('セレクタ取得失敗', { error: error.message });
  }
}

/**
 * メッセージハンドラ
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  Logger.debug('メッセージ受信', { type: message.type, sender: sender.tab?.id });

  // 非同期処理のためtrueを返す
  handleMessage(message, sender).then(sendResponse);
  return true;
});

/**
 * メッセージ処理
 */
async function handleMessage(message, sender) {
  switch (message.type) {
    case 'POST_REQUEST':
      return await handlePostRequest(message.payload, sender);

    case 'GET_SELECTORS':
      return {
        success: true,
        selectors: state.selectors,
        version: state.selectorsVersion,
      };

    case 'REPORT_SELECTOR_FAILURE':
      return await handleSelectorFailure(message.payload);

    default:
      Logger.warn('未知のメッセージタイプ', { type: message.type });
      return { success: false, error: 'Unknown message type' };
  }
}

/**
 * 投稿リクエスト処理
 */
async function handlePostRequest(payload, sender) {
  Logger.info('投稿リクエスト', { textLength: payload.text.length });

  try {
    // 現在のタブを取得
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error('アクティブなタブがありません');
    }

    // Xのページかチェック
    if (!tab.url.includes('x.com') && !tab.url.includes('twitter.com')) {
      throw new Error('Xのページを開いてください');
    }

    // セレクタが未取得なら取得
    if (!state.selectors) {
      await fetchAndCacheSelectors();
    }

    // Content Scriptに投稿を実行させる
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'EXECUTE_POST',
      payload: {
        text: payload.text,
        audience: payload.audience,
        selectors: state.selectors,
      },
    });

    if (response.success) {
      Logger.info('投稿成功', {});
      return { success: true };
    } else {
      // セレクタ失敗の場合はセルフヒーリングを試みる
      if (response.failedSelectors && response.failedSelectors.length > 0) {
        Logger.warn('セレクタ失敗、ヒーリング開始', { failed: response.failedSelectors });
        return await attemptHealing(tab.id, payload, response.failedSelectors);
      }
      throw new Error(response.error || '投稿に失敗しました');
    }

  } catch (error) {
    Logger.error('投稿処理失敗', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * セルフヒーリング試行
 */
async function attemptHealing(tabId, payload, failedSelectors) {
  Logger.info('セルフヒーリング開始', { failedSelectors });

  try {
    // Content ScriptからDOM構造を取得
    const domResponse = await chrome.tabs.sendMessage(tabId, {
      type: 'GET_DOM_STRUCTURE',
    });

    if (!domResponse.success) {
      throw new Error('DOM構造の取得に失敗');
    }

    // Workerにヒーリングをリクエスト
    const healResponse = await fetch(`${API_BASE_URL}/api/selectors/heal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentDOM: domResponse.dom,
        failedSelectors,
      }),
    });

    const healData = await healResponse.json();

    if (healData.success) {
      // 新しいセレクタでリトライ
      state.selectors = { ...state.selectors, ...healData.newSelectors };
      state.selectorsVersion = healData.version;

      Logger.info('ヒーリング成功、リトライ', { newVersion: healData.version });

      // 再度投稿を試みる
      const retryResponse = await chrome.tabs.sendMessage(tabId, {
        type: 'EXECUTE_POST',
        payload: {
          text: payload.text,
          audience: payload.audience,
          selectors: state.selectors,
        },
      });

      return retryResponse;
    } else {
      throw new Error(healData.error || 'Healing failed');
    }

  } catch (error) {
    Logger.error('セルフヒーリング失敗', { error: error.message });
    return { success: false, error: `ヒーリング失敗: ${error.message}` };
  }
}

/**
 * セレクタ失敗報告処理
 */
async function handleSelectorFailure(payload) {
  Logger.warn('セレクタ失敗報告', payload);

  // 今後の分析用にログを記録
  // 必要に応じてWorkerに報告することも可能

  return { success: true };
}

/**
 * インストール時の処理
 */
chrome.runtime.onInstalled.addListener((details) => {
  Logger.info('拡張機能インストール', { reason: details.reason });
  init();
});

/**
 * 起動時の処理
 */
chrome.runtime.onStartup.addListener(() => {
  Logger.info('拡張機能起動', {});
  init();
});

// 初期化実行
init();
