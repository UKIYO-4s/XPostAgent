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
  // F-006: アンケート関連
  pollSection: document.getElementById('pollSection'),
  pollOption1: document.getElementById('pollOption1'),
  pollOption2: document.getElementById('pollOption2'),
  pollOption3: document.getElementById('pollOption3'),
  pollOption4: document.getElementById('pollOption4'),
  pollDays: document.getElementById('pollDays'),
  pollHours: document.getElementById('pollHours'),
  btnRemovePoll: document.getElementById('btnRemovePoll'),
  // F-007: 絵文字関連
  emojiPicker: document.getElementById('emojiPicker'),
  emojiGrid: document.getElementById('emojiGrid'),
};

// 状態
const state = {
  isConnected: false,
  isProcessing: false,
  currentTab: null,
  mediaFiles: [], // 添付メディアファイル
  threadTexts: [], // ツリー投稿のテキスト配列
  // F-006: アンケート状態
  isPollEnabled: false,
  // F-007: 絵文字ピッカー状態
  isEmojiPickerOpen: false,
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

  // オプションボタン
  elements.btnGif.addEventListener('click', () => showNotImplemented('GIF添付'));
  elements.btnSchedule.addEventListener('click', () => showNotImplemented('予約投稿（Premiumが必要）'));

  // F-006: アンケート機能
  elements.btnPoll.addEventListener('click', togglePoll);
  elements.btnRemovePoll.addEventListener('click', removePoll);

  // F-007: 絵文字機能
  elements.btnEmoji.addEventListener('click', toggleEmojiPicker);
  setupEmojiButtons();
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
  const hasPoll = state.isPollEnabled;

  if (!mainText && state.mediaFiles.length === 0) return;

  // アンケート付き投稿のバリデーション
  if (hasPoll) {
    const pollOptions = getPollOptions();
    if (pollOptions.length < 2) {
      setStatus('error', 'アンケートには最低2つの選択肢が必要です');
      setTimeout(() => setStatus('ready', '準備完了'), 2000);
      return;
    }
  }

  // ツリー投稿のテキストを収集
  const threadTexts = hasThread
    ? [mainText, ...state.threadTexts.filter(t => t.trim().length > 0)]
    : null;

  XPostAgentLogger.info('Popup', '投稿開始', {
    textLength: mainText.length,
    mediaCount: state.mediaFiles.length,
    threadCount: threadTexts?.length || 0,
    hasPoll,
  });

  try {
    state.isProcessing = true;
    const statusMsg = hasPoll ? 'アンケート投稿中...' : (hasThread ? 'ツリー投稿中...' : '投稿中...');
    setStatus('processing', statusMsg);
    elements.btnPost.disabled = true;

    let response;

    if (hasPoll) {
      // F-006: アンケート付き投稿
      response = await chrome.runtime.sendMessage({
        type: 'POLL_POST_REQUEST',
        payload: {
          text: mainText,
          pollOptions: getPollOptions(),
          pollLength: getPollLength(),
          audience: elements.audience.value,
        },
      });
    } else if (hasThread) {
      // ツリー投稿
      response = await chrome.runtime.sendMessage({
        type: 'THREAD_POST_REQUEST',
        payload: {
          text: mainText,
          threadTexts,
          audience: elements.audience.value,
          mediaFiles: state.mediaFiles,
        },
      });
    } else {
      // 通常投稿
      response = await chrome.runtime.sendMessage({
        type: 'POST_REQUEST',
        payload: {
          text: mainText,
          audience: elements.audience.value,
          mediaFiles: state.mediaFiles,
        },
      });
    }

    if (response.success) {
      XPostAgentLogger.info('Popup', '投稿完了');
      setStatus('ready', '投稿完了!');
      elements.postText.value = '';
      clearMedia();
      clearThread();
      if (hasPoll) removePoll();
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

// ========================================
// F-006: アンケート機能
// ========================================

/**
 * アンケート表示/非表示を切り替え
 */
function togglePoll() {
  state.isPollEnabled = !state.isPollEnabled;

  if (state.isPollEnabled) {
    elements.pollSection.style.display = 'block';
    elements.btnPoll.classList.add('active');
    // メディアとアンケートは同時に使用不可（X仕様）
    if (state.mediaFiles.length > 0) {
      clearMedia();
      setStatus('ready', 'アンケート使用時は画像添付できません');
    }
    // ツリーとアンケートは同時に使用不可
    if (state.threadTexts.length > 0) {
      clearThread();
      setStatus('ready', 'アンケート使用時はツリー投稿できません');
    }
    XPostAgentLogger.info('Popup', 'アンケート有効化');
  } else {
    removePoll();
  }

  updatePostButton();
}

/**
 * アンケートを削除
 */
function removePoll() {
  state.isPollEnabled = false;
  elements.pollSection.style.display = 'none';
  elements.btnPoll.classList.remove('active');
  // 入力をクリア
  elements.pollOption1.value = '';
  elements.pollOption2.value = '';
  elements.pollOption3.value = '';
  elements.pollOption4.value = '';
  elements.pollDays.value = '1';
  elements.pollHours.value = '0';
  XPostAgentLogger.info('Popup', 'アンケート削除');
  updatePostButton();
}

/**
 * アンケートオプションを取得
 */
function getPollOptions() {
  const options = [
    elements.pollOption1.value.trim(),
    elements.pollOption2.value.trim(),
    elements.pollOption3.value.trim(),
    elements.pollOption4.value.trim(),
  ].filter(opt => opt.length > 0);
  return options;
}

/**
 * アンケート期間を取得（分単位）
 */
function getPollLength() {
  const days = parseInt(elements.pollDays.value) || 1;
  const hours = parseInt(elements.pollHours.value) || 0;
  return {
    days,
    hours,
    minutes: 0,
    totalMinutes: (days * 24 * 60) + (hours * 60),
  };
}

// ========================================
// F-007: 絵文字機能
// ========================================

/**
 * 絵文字ピッカー表示/非表示を切り替え
 */
function toggleEmojiPicker() {
  state.isEmojiPickerOpen = !state.isEmojiPickerOpen;

  if (state.isEmojiPickerOpen) {
    elements.emojiPicker.style.display = 'block';
    elements.btnEmoji.classList.add('active');
  } else {
    elements.emojiPicker.style.display = 'none';
    elements.btnEmoji.classList.remove('active');
  }
}

/**
 * 絵文字ボタンのイベント設定
 */
function setupEmojiButtons() {
  const emojiButtons = elements.emojiGrid.querySelectorAll('.emoji-btn');
  emojiButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.getAttribute('data-emoji');
      insertEmojiToText(emoji);
    });
  });
}

/**
 * テキストエリアに絵文字を挿入
 */
function insertEmojiToText(emoji) {
  const textarea = elements.postText;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;

  // カーソル位置に挿入
  textarea.value = text.substring(0, start) + emoji + text.substring(end);

  // カーソルを絵文字の後ろに移動
  const newPos = start + emoji.length;
  textarea.setSelectionRange(newPos, newPos);
  textarea.focus();

  // 文字数カウント更新
  handleTextInput();

  // ピッカーを閉じる
  toggleEmojiPicker();

  XPostAgentLogger.debug('Popup', '絵文字挿入', { emoji });
}

// 初期化実行
document.addEventListener('DOMContentLoaded', init);
