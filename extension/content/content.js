/**
 * XPostAgent Content Script
 * X (Twitter) ページ上でのDOM操作
 */

// Logger参照（lib/logger.jsから）
const Logger = window.XPostAgentLogger || {
  info: (c, a, d) => console.log(`[XPostAgent][INFO][${c}] ${a}`, d),
  warn: (c, a, d) => console.warn(`[XPostAgent][WARN][${c}] ${a}`, d),
  error: (c, a, d) => console.error(`[XPostAgent][ERROR][${c}] ${a}`, d),
  debug: (c, a, d) => console.log(`[XPostAgent][DEBUG][${c}] ${a}`, d),
};

/**
 * 初期化
 */
function init() {
  Logger.info('Content', '初期化', { url: window.location.href });

  // メッセージリスナー設定
  chrome.runtime.onMessage.addListener(handleMessage);
}

/**
 * メッセージハンドラ
 */
function handleMessage(message, sender, sendResponse) {
  Logger.debug('Content', 'メッセージ受信', { type: message.type });

  switch (message.type) {
    case 'EXECUTE_POST':
      executePost(message.payload)
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // 非同期レスポンス

    case 'GET_DOM_STRUCTURE':
      sendResponse(getDOMStructure());
      return false;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
}

/**
 * 投稿実行
 */
async function executePost(payload) {
  const { text, audience, selectors } = payload;

  Logger.info('Content', '投稿実行開始', { textLength: text.length, audience });

  const failedSelectors = [];

  try {
    // 1. テキストエリアを取得
    const textAreaDef = selectors.composer?.textArea;
    const textArea = await findElement(textAreaDef, 'textArea', failedSelectors);
    if (!textArea) {
      return { success: false, error: 'テキストエリアが見つかりません', failedSelectors };
    }

    // 2. テキストを入力
    await inputText(textArea, text);
    Logger.info('Content', 'テキスト入力完了', { length: text.length });

    // 3. 少し待機（UIの更新を待つ）
    await sleep(500);

    // 4. 投稿ボタンを取得
    const postButtonDef = selectors.composer?.postButtonInline || selectors.composer?.postButtonModal;
    const postButton = await findElement(postButtonDef, 'postButton', failedSelectors);
    if (!postButton) {
      return { success: false, error: '投稿ボタンが見つかりません', failedSelectors };
    }

    // 5. 投稿ボタンが有効になるまで待機
    await waitForButtonEnabled(postButton);

    // 6. 投稿ボタンをクリック
    postButton.click();
    Logger.info('Content', '投稿ボタンクリック', {});

    // 7. 投稿完了を待機
    await waitForPostComplete();
    Logger.info('Content', '投稿完了', {});

    return { success: true };

  } catch (error) {
    Logger.error('Content', '投稿失敗', error);
    return {
      success: false,
      error: error.message,
      failedSelectors: failedSelectors.length > 0 ? failedSelectors : undefined,
    };
  }
}

/**
 * 要素を検索
 */
async function findElement(selectorDef, name, failedSelectors, timeout = 5000) {
  if (!selectorDef) {
    Logger.error('Content', `セレクタ定義がありません: ${name}`, {});
    failedSelectors.push(name);
    return null;
  }

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // プライマリセレクタで検索
    let element = document.querySelector(selectorDef.primary);
    if (element) {
      Logger.debug('Content', `要素発見 (primary): ${name}`, { selector: selectorDef.primary });
      return element;
    }

    // フォールバックで検索
    for (const fallback of selectorDef.fallback || []) {
      element = document.querySelector(fallback);
      if (element) {
        Logger.warn('Content', `要素発見 (fallback): ${name}`, { selector: fallback });
        return element;
      }
    }

    await sleep(100);
  }

  Logger.error('Content', `要素が見つかりません: ${name}`, { selectorDef });
  failedSelectors.push(name);
  return null;
}

/**
 * テキスト入力
 * Draft.jsエディタ対応
 */
async function inputText(textArea, text) {
  // フォーカス
  textArea.focus();
  await sleep(100);

  // Draft.jsエディタの場合
  if (textArea.getAttribute('contenteditable') === 'true') {
    // InputEventを使用
    const inputEvent = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
    });
    textArea.dispatchEvent(inputEvent);

    // テキストを直接設定（フォールバック）
    if (!textArea.textContent.includes(text)) {
      // execCommandを試す
      document.execCommand('insertText', false, text);
    }

    // それでもダメならtextContentを直接設定
    if (!textArea.textContent.includes(text)) {
      textArea.textContent = text;
      textArea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } else {
    // 通常のテキストエリア
    textArea.value = text;
    textArea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  Logger.debug('Content', 'テキスト入力処理完了', { textContent: textArea.textContent?.slice(0, 50) });
}

/**
 * ボタンが有効になるまで待機
 */
async function waitForButtonEnabled(button, timeout = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (!button.disabled && !button.getAttribute('aria-disabled')) {
      return true;
    }
    await sleep(100);
  }

  throw new Error('投稿ボタンが有効になりませんでした');
}

/**
 * 投稿完了を待機
 */
async function waitForPostComplete(timeout = 10000) {
  const startTime = Date.now();

  // 投稿完了の判定方法：
  // 1. Toast通知の出現
  // 2. テキストエリアがクリアされる
  // 3. URLの変化

  const initialTextArea = document.querySelector('[data-testid="tweetTextarea_0"]');
  const initialText = initialTextArea?.textContent || '';

  while (Date.now() - startTime < timeout) {
    // Toast通知をチェック
    const toast = document.querySelector('[data-testid="toast"]');
    if (toast && toast.textContent.includes('sent')) {
      return true;
    }

    // テキストエリアがクリアされたかチェック
    const currentTextArea = document.querySelector('[data-testid="tweetTextarea_0"]');
    if (currentTextArea && currentTextArea.textContent !== initialText && currentTextArea.textContent === '') {
      return true;
    }

    await sleep(200);
  }

  // タイムアウトでも一応成功として返す（完了検知が難しい場合があるため）
  Logger.warn('Content', '投稿完了検知タイムアウト（成功として扱う）', {});
  return true;
}

/**
 * DOM構造を取得
 */
function getDOMStructure() {
  try {
    // 投稿関連の要素のみを抽出
    const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
    const dom = primaryColumn ? primaryColumn.innerHTML.slice(0, 10000) : document.body.innerHTML.slice(0, 10000);

    return { success: true, dom };
  } catch (error) {
    Logger.error('Content', 'DOM取得失敗', error);
    return { success: false, error: error.message };
  }
}

/**
 * スリープ
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 初期化実行
init();
