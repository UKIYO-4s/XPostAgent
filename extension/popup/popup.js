/**
 * XPostAgent Popup Script
 */

// DOM要素
const elements = {
  postText: document.getElementById('postText'),
  charCount: document.getElementById('charCount'),
  btnPost: document.getElementById('btnPost'),
  btnMedia: document.getElementById('btnMedia'),
  btnGif: document.getElementById('btnGif'),
  btnPoll: document.getElementById('btnPoll'),
  btnEmoji: document.getElementById('btnEmoji'),
  btnSchedule: document.getElementById('btnSchedule'),
  btnAddThread: document.getElementById('btnAddThread'),
  audience: document.getElementById('audience'),
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.getElementById('statusText'),
  connectionDot: document.getElementById('connectionDot'),
  connectionText: document.getElementById('connectionText'),
};

// 状態
const state = {
  isConnected: false,
  isProcessing: false,
  currentTab: null,
};

/**
 * 初期化
 */
async function init() {
  XPostAgentLogger.info('Popup', '初期化開始');

  // イベントリスナー設定
  setupEventListeners();

  // Worker接続確認
  await checkWorkerConnection();

  // 現在のタブを取得
  await getCurrentTab();

  XPostAgentLogger.info('Popup', '初期化完了');
}

/**
 * イベントリスナー設定
 */
function setupEventListeners() {
  // テキスト入力
  elements.postText.addEventListener('input', handleTextInput);

  // 投稿ボタン
  elements.btnPost.addEventListener('click', handlePost);

  // オプションボタン（未実装・Phase 2）
  elements.btnMedia.addEventListener('click', () => showNotImplemented('メディア添付'));
  elements.btnGif.addEventListener('click', () => showNotImplemented('GIF添付'));
  elements.btnPoll.addEventListener('click', () => showNotImplemented('アンケート'));
  elements.btnEmoji.addEventListener('click', () => showNotImplemented('絵文字'));
  elements.btnSchedule.addEventListener('click', () => showNotImplemented('予約投稿'));
  elements.btnAddThread.addEventListener('click', () => showNotImplemented('ツリー追加'));
}

/**
 * テキスト入力ハンドラ
 */
function handleTextInput() {
  const text = elements.postText.value;
  const length = text.length;

  // 文字数表示更新
  elements.charCount.textContent = length;

  // 文字数に応じたスタイル変更
  const countEl = elements.charCount.parentElement;
  countEl.classList.remove('warning', 'error');
  if (length > 260) {
    countEl.classList.add('error');
  } else if (length > 240) {
    countEl.classList.add('warning');
  }

  // 投稿ボタンの有効/無効
  updatePostButton();
}

/**
 * 投稿ボタン状態更新
 */
function updatePostButton() {
  const text = elements.postText.value.trim();
  const isValid = text.length > 0 && text.length <= 280;
  const canPost = isValid && state.isConnected && !state.isProcessing;

  elements.btnPost.disabled = !canPost;
}

/**
 * 投稿処理
 */
async function handlePost() {
  if (state.isProcessing) return;

  const text = elements.postText.value.trim();
  if (!text) return;

  XPostAgentLogger.info('Popup', '投稿開始', { textLength: text.length });

  try {
    state.isProcessing = true;
    setStatus('processing', '投稿中...');
    elements.btnPost.disabled = true;

    // Background Scriptに投稿リクエストを送信
    const response = await chrome.runtime.sendMessage({
      type: 'POST_REQUEST',
      payload: {
        text,
        audience: elements.audience.value,
      },
    });

    if (response.success) {
      XPostAgentLogger.info('Popup', '投稿完了');
      setStatus('ready', '投稿完了!');
      elements.postText.value = '';
      handleTextInput(); // 文字数リセット
    } else {
      throw new Error(response.error || '投稿に失敗しました');
    }

  } catch (error) {
    XPostAgentLogger.error('Popup', '投稿失敗', error);
    setStatus('error', `エラー: ${error.message}`);
  } finally {
    state.isProcessing = false;
    updatePostButton();
  }
}

/**
 * Worker接続確認
 */
async function checkWorkerConnection() {
  try {
    const result = await XPostAgentApi.health();

    if (result.success) {
      state.isConnected = true;
      elements.connectionDot.classList.add('connected');
      elements.connectionText.textContent = `Worker: v${result.version}`;
      setStatus('ready', '準備完了');
      XPostAgentLogger.info('Popup', 'Worker接続成功', result);
    } else {
      throw new Error('Health check failed');
    }
  } catch (error) {
    state.isConnected = false;
    elements.connectionDot.classList.add('disconnected');
    elements.connectionText.textContent = 'Worker: 接続エラー';
    setStatus('error', 'Workerに接続できません');
    XPostAgentLogger.error('Popup', 'Worker接続失敗', error);
  }

  updatePostButton();
}

/**
 * 現在のタブを取得
 */
async function getCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.currentTab = tab;

    // Xのページかどうか確認
    if (!tab.url.includes('x.com') && !tab.url.includes('twitter.com')) {
      setStatus('error', 'X のページを開いてください');
      XPostAgentLogger.warn('Popup', 'X以外のページ', { url: tab.url });
    }
  } catch (error) {
    XPostAgentLogger.error('Popup', 'タブ取得失敗', error);
  }
}

/**
 * ステータス表示更新
 */
function setStatus(type, message) {
  elements.statusIndicator.className = 'status-indicator ' + type;
  elements.statusText.textContent = message;
}

/**
 * 未実装機能の通知
 */
function showNotImplemented(feature) {
  setStatus('ready', `${feature}は Phase 2 で実装予定`);
  XPostAgentLogger.info('Popup', '未実装機能', { feature });

  // 2秒後に元に戻す
  setTimeout(() => {
    if (!state.isProcessing) {
      setStatus('ready', '準備完了');
    }
  }, 2000);
}

// 初期化実行
document.addEventListener('DOMContentLoaded', init);
