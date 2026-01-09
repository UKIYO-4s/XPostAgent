/**
 * XPostAgent Popup Script
 */

// DOM要素
const elements = {
  postText: document.getElementById('postText'),
  charCount: document.getElementById('charCount'),
  btnPost: document.getElementById('btnPost'),
  btnMedia: document.getElementById('btnMedia'),
  mediaInput: document.getElementById('mediaInput'),
  mediaPreview: document.getElementById('mediaPreview'),
  mediaList: document.getElementById('mediaList'),
  btnClearMedia: document.getElementById('btnClearMedia'),
  btnGif: document.getElementById('btnGif'),
  btnPoll: document.getElementById('btnPoll'),
  btnEmoji: document.getElementById('btnEmoji'),
  btnSchedule: document.getElementById('btnSchedule'),
  btnAddThread: document.getElementById('btnAddThread'),
  threadList: document.getElementById('threadList'),
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
  mediaFiles: [], // 添付メディアファイル
  threadTexts: [], // ツリー投稿のテキスト配列
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

  // メディア添付
  elements.btnMedia.addEventListener('click', () => elements.mediaInput.click());
  elements.mediaInput.addEventListener('change', handleMediaSelect);
  elements.btnClearMedia.addEventListener('click', clearMedia);

  // ツリー追加
  elements.btnAddThread.addEventListener('click', addThreadItem);

  // オプションボタン（今後実装予定）
  elements.btnGif.addEventListener('click', () => showNotImplemented('GIF添付'));
  elements.btnPoll.addEventListener('click', () => showNotImplemented('アンケート'));
  elements.btnEmoji.addEventListener('click', () => showNotImplemented('絵文字'));
  elements.btnSchedule.addEventListener('click', () => showNotImplemented('予約投稿'));
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
  const hasContent = text.length > 0 || state.mediaFiles.length > 0;
  const isValid = hasContent && text.length <= 280;
  const canPost = isValid && state.isConnected && !state.isProcessing;

  elements.btnPost.disabled = !canPost;
}

/**
 * 投稿処理
 */
async function handlePost() {
  if (state.isProcessing) return;

  const mainText = elements.postText.value.trim();
  const hasThread = state.threadTexts.length > 0;

  if (!mainText && state.mediaFiles.length === 0) return;

  // ツリー投稿のテキストを収集
  const threadTexts = hasThread
    ? [mainText, ...state.threadTexts.filter(t => t.trim().length > 0)]
    : null;

  XPostAgentLogger.info('Popup', '投稿開始', {
    textLength: mainText.length,
    mediaCount: state.mediaFiles.length,
    threadCount: threadTexts?.length || 0
  });

  try {
    state.isProcessing = true;
    setStatus('processing', hasThread ? 'ツリー投稿中...' : '投稿中...');
    elements.btnPost.disabled = true;

    // Background Scriptに投稿リクエストを送信
    const response = await chrome.runtime.sendMessage({
      type: hasThread ? 'THREAD_POST_REQUEST' : 'POST_REQUEST',
      payload: {
        text: mainText,
        threadTexts,
        audience: elements.audience.value,
        mediaFiles: state.mediaFiles,
      },
    });

    if (response.success) {
      XPostAgentLogger.info('Popup', '投稿完了');
      setStatus('ready', '投稿完了!');
      elements.postText.value = '';
      clearMedia();
      clearThread();
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
  setStatus('ready', `${feature}は今後実装予定`);
  XPostAgentLogger.info('Popup', '未実装機能', { feature });

  // 2秒後に元に戻す
  setTimeout(() => {
    if (!state.isProcessing) {
      setStatus('ready', '準備完了');
    }
  }, 2000);
}

/**
 * メディア選択ハンドラ
 */
async function handleMediaSelect(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  // 最大4枚まで
  const maxFiles = 4;
  if (state.mediaFiles.length + files.length > maxFiles) {
    setStatus('error', `画像は最大${maxFiles}枚まで`);
    setTimeout(() => setStatus('ready', '準備完了'), 2000);
    return;
  }

  XPostAgentLogger.info('Popup', 'メディア選択', { count: files.length });

  for (const file of files) {
    // サイズチェック (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setStatus('error', `${file.name} は5MBを超えています`);
      continue;
    }

    // Base64に変換
    const dataUrl = await fileToDataUrl(file);
    state.mediaFiles.push({
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl,
    });
  }

  updateMediaPreview();
  updatePostButton();

  // ファイル入力をリセット
  elements.mediaInput.value = '';
}

/**
 * ファイルをDataURLに変換
 */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * メディアプレビュー更新
 */
function updateMediaPreview() {
  if (state.mediaFiles.length === 0) {
    elements.mediaPreview.style.display = 'none';
    return;
  }

  elements.mediaPreview.style.display = 'block';
  elements.mediaList.innerHTML = '';

  state.mediaFiles.forEach((media, index) => {
    const item = document.createElement('div');
    item.className = 'media-item';
    item.innerHTML = `
      <img src="${media.dataUrl}" alt="${media.name}">
      <button type="button" class="remove-btn" data-index="${index}">×</button>
    `;

    // 削除ボタン
    item.querySelector('.remove-btn').addEventListener('click', () => {
      removeMedia(index);
    });

    elements.mediaList.appendChild(item);
  });
}

/**
 * メディアを削除
 */
function removeMedia(index) {
  state.mediaFiles.splice(index, 1);
  updateMediaPreview();
  updatePostButton();
  XPostAgentLogger.debug('Popup', 'メディア削除', { index, remaining: state.mediaFiles.length });
}

/**
 * 全メディアをクリア
 */
function clearMedia() {
  state.mediaFiles = [];
  updateMediaPreview();
  updatePostButton();
  XPostAgentLogger.debug('Popup', 'メディアクリア', {});
}

/**
 * ツリーアイテムを追加
 */
function addThreadItem() {
  // 最大10件まで
  if (state.threadTexts.length >= 9) {
    setStatus('error', 'ツリーは最大10件まで');
    setTimeout(() => setStatus('ready', '準備完了'), 2000);
    return;
  }

  state.threadTexts.push('');
  updateThreadList();
  XPostAgentLogger.debug('Popup', 'ツリー追加', { count: state.threadTexts.length });
}

/**
 * ツリーリストを更新
 */
function updateThreadList() {
  elements.threadList.innerHTML = '';

  state.threadTexts.forEach((text, index) => {
    const item = document.createElement('div');
    item.className = 'thread-item';
    item.innerHTML = `
      <div class="thread-item-header">
        <span class="thread-item-number">${index + 2}件目</span>
        <button type="button" class="thread-item-remove" data-index="${index}">×</button>
      </div>
      <textarea rows="2" maxlength="280" placeholder="続きを入力...">${text}</textarea>
      <div class="char-count">${text.length}/280</div>
    `;

    // テキスト入力イベント
    const textarea = item.querySelector('textarea');
    textarea.addEventListener('input', (e) => {
      state.threadTexts[index] = e.target.value;
      item.querySelector('.char-count').textContent = `${e.target.value.length}/280`;
      updatePostButton();
    });

    // 削除ボタンイベント
    item.querySelector('.thread-item-remove').addEventListener('click', () => {
      removeThreadItem(index);
    });

    elements.threadList.appendChild(item);
  });

  // 投稿ボタンのテキストを更新
  updatePostButtonText();
}

/**
 * ツリーアイテムを削除
 */
function removeThreadItem(index) {
  state.threadTexts.splice(index, 1);
  updateThreadList();
  updatePostButton();
  XPostAgentLogger.debug('Popup', 'ツリー削除', { index, remaining: state.threadTexts.length });
}

/**
 * 全ツリーをクリア
 */
function clearThread() {
  state.threadTexts = [];
  updateThreadList();
  updatePostButton();
}

/**
 * 投稿ボタンのテキストを更新
 */
function updatePostButtonText() {
  const hasThread = state.threadTexts.length > 0;
  elements.btnPost.textContent = hasThread
    ? `${state.threadTexts.length + 1}件を投稿`
    : '投稿する';
}

// 初期化実行
document.addEventListener('DOMContentLoaded', init);
