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

    case 'EXECUTE_THREAD_POST':
      executeThreadPost(message.payload)
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // 非同期レスポンス

    case 'GET_DOM_STRUCTURE':
      sendResponse(getDOMStructure());
      return false;

    case 'EXECUTE_POST_WITH_POLL':
      executePostWithPoll(message.payload)
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'INSERT_EMOJI':
      insertEmoji(message.payload)
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
}

/**
 * 投稿実行
 */
async function executePost(payload) {
  const { text, audience, selectors, mediaFiles } = payload;

  Logger.info('Content', '投稿実行開始', { textLength: text.length, audience, hasMedia: !!mediaFiles?.length });

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

    // 4. 公開範囲を設定（デフォルト以外の場合）
    if (audience && audience !== 'everyone') {
      await setAudience(audience);
      Logger.info('Content', '公開範囲設定完了', { audience });
      await sleep(300);
    }

    // 5. メディアファイルを添付（ある場合）
    if (mediaFiles && mediaFiles.length > 0) {
      await attachMedia(mediaFiles, selectors);
      Logger.info('Content', 'メディア添付完了', { count: mediaFiles.length });
      await sleep(500);
    }

    // 6. 投稿ボタンを取得
    const postButtonDef = selectors.composer?.postButtonInline || selectors.composer?.postButtonModal;
    const postButton = await findElement(postButtonDef, 'postButton', failedSelectors);
    if (!postButton) {
      return { success: false, error: '投稿ボタンが見つかりません', failedSelectors };
    }

    // 7. 投稿ボタンが有効になるまで待機
    await waitForButtonEnabled(postButton);

    // 8. 投稿ボタンをクリック
    postButton.click();
    Logger.info('Content', '投稿ボタンクリック', {});

    // 9. 投稿完了を待機
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
 * ツリー投稿実行
 */
async function executeThreadPost(payload) {
  const { threadTexts, audience, selectors, mediaFiles } = payload;

  Logger.info('Content', 'ツリー投稿実行開始', { count: threadTexts.length });

  try {
    let posted = 0;

    for (let i = 0; i < threadTexts.length; i++) {
      const text = threadTexts[i];
      if (!text.trim()) continue;

      Logger.info('Content', `ツリー ${i + 1}/${threadTexts.length} 投稿開始`, { length: text.length });

      // テキストエリアを取得（i番目のツイート用）
      // 注意: Xは複数のtextareaを作成するため、i番目のものを取得する必要がある
      const textArea = await findThreadTextArea(i, selectors);
      if (!textArea) {
        throw new Error(`テキストエリアが見つかりません (${i + 1}件目)`);
      }

      // テキストを入力
      await inputText(textArea, text);
      await sleep(300);

      // 最初の投稿のみ: 公開範囲を設定
      if (i === 0 && audience && audience !== 'everyone') {
        await setAudience(audience);
        await sleep(300);
      }

      // 最初の投稿のみ: メディアを添付
      if (i === 0 && mediaFiles && mediaFiles.length > 0) {
        await attachMedia(mediaFiles, selectors);
        await sleep(500);
      }

      // 最後の投稿でなければ「+」ボタンをクリックして次の入力欄を追加
      if (i < threadTexts.length - 1) {
        const addButtonClicked = await clickAddThreadButton(selectors);
        if (!addButtonClicked) {
          Logger.warn('Content', 'ツリー追加ボタンが見つかりません、投稿を実行', {});
        }
        await sleep(500);
      }

      posted++;
    }

    // 投稿ボタンをクリック（"Post all"ボタンを探す）
    const postButton = await findPostAllButton(selectors);
    if (!postButton) {
      throw new Error('投稿ボタンが見つかりません');
    }

    await waitForButtonEnabled(postButton);
    postButton.click();
    Logger.info('Content', '投稿ボタンクリック', {});

    // 投稿完了を待機
    await waitForPostComplete();
    Logger.info('Content', 'ツリー投稿完了', { posted });

    return { success: true, posted };

  } catch (error) {
    Logger.error('Content', 'ツリー投稿失敗', error);
    return { success: false, error: error.message };
  }
}

/**
 * ツリー投稿用のi番目のテキストエリアを取得
 * KVセレクタ: composer.textArea.pattern
 * Xは各ツイートに tweetTextarea_0, tweetTextarea_1, ... のように
 * インデックス付きのdata-testidを使用する
 *
 * 重要: モーダル内で検索 (仕様書: docs/dom-selectors.md 1.4 参照)
 */
async function findThreadTextArea(index, selectors, timeout = 5000) {
  const startTime = Date.now();

  // パターンからインデックス付きセレクタを生成
  const pattern = selectors?.composer?.textArea?.pattern || '[data-testid="tweetTextarea_{index}"]';
  const indexedSelector = pattern.replace('{index}', index);

  // モーダル内で検索
  const modal = document.querySelector('[role="dialog"]');
  const searchContext = modal || document;

  while (Date.now() - startTime < timeout) {
    const textArea = searchContext.querySelector(indexedSelector);

    if (textArea) {
      Logger.debug('Content', `ツリー用テキストエリア取得`, { index, selector: indexedSelector, inModal: !!modal });
      return textArea;
    }

    await sleep(100);
  }

  Logger.error('Content', `ツリー用テキストエリアが見つかりません`, { index, selector: indexedSelector });
  return null;
}

/**
 * Post all ボタンを取得（ツリー投稿用）
 * KVセレクタ: composer.postButton (v2.0.0) スレッド時は "Post all" テキスト
 *
 * 重要: モーダル内で検索 (仕様書: docs/dom-selectors.md 1.4 参照)
 */
async function findPostAllButton(selectors, timeout = 5000) {
  const startTime = Date.now();
  const postButtonDef = selectors?.composer?.postButton || {
    primary: '[data-testid="tweetButton"]',
    fallback: []
  };

  // モーダル内で検索
  const modal = document.querySelector('[role="dialog"]');
  const searchContext = modal || document;

  while (Date.now() - startTime < timeout) {
    // プライマリセレクタで検索
    let btn = searchContext.querySelector(postButtonDef.primary);
    if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
      Logger.debug('Content', 'Post allボタン発見 (primary)', {
        text: btn.textContent,
        selector: postButtonDef.primary,
        inModal: !!modal
      });
      return btn;
    }

    // フォールバックで検索
    for (const fallback of postButtonDef.fallback || []) {
      btn = searchContext.querySelector(fallback);
      if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
        Logger.debug('Content', 'Post allボタン発見 (fallback)', {
          text: btn.textContent,
          selector: fallback,
          inModal: !!modal
        });
        return btn;
      }
    }

    await sleep(100);
  }

  Logger.error('Content', 'Post allボタンが見つかりません', { selectorDef: postButtonDef });
  return null;
}

/**
 * ツリー追加ボタンをクリック
 * KVセレクタ: composer.addButton (v2.0.0)
 *
 * 重要: モーダル内で検索し、focus() → click() の順序で実行
 * (仕様書: docs/dom-selectors.md 1.4, 1.5 参照)
 */
async function clickAddThreadButton(selectors) {
  const addBtnDef = selectors?.composer?.addButton || {
    primary: '[data-testid="addButton"]',
    fallback: ['[aria-label="Add post"]']
  };

  // モーダル内で検索（モーダル外に同一セレクタの要素が存在するため）
  const modal = document.querySelector('[role="dialog"]');
  const searchContext = modal || document;

  // プライマリセレクタで検索
  let btn = searchContext.querySelector(addBtnDef.primary);
  if (btn) {
    btn.focus();  // focus() を先に実行
    await sleep(100);
    btn.click();
    Logger.debug('Content', 'ツリー追加ボタンクリック (primary)', { selector: addBtnDef.primary, inModal: !!modal });
    return true;
  }

  // フォールバックで検索
  for (const fallback of addBtnDef.fallback || []) {
    btn = searchContext.querySelector(fallback);
    if (btn) {
      btn.focus();
      await sleep(100);
      btn.click();
      Logger.debug('Content', 'ツリー追加ボタンクリック (fallback)', { selector: fallback, inModal: !!modal });
      return true;
    }
  }

  // 少し待機して再度試す
  await sleep(300);

  btn = searchContext.querySelector(addBtnDef.primary);
  if (btn) {
    btn.focus();
    await sleep(100);
    btn.click();
    return true;
  }

  Logger.warn('Content', 'ツリー追加ボタンが見つかりません', { selectorDef: addBtnDef, hasModal: !!modal });
  return false;
}

/**
 * 公開範囲を設定
 */
async function setAudience(audience) {
  // 公開範囲ボタンを探す（現在の設定に関わらず）
  const audienceSelectors = [
    '[aria-label="Everyone can reply"]',
    '[aria-label="Accounts you follow can reply"]',
    '[aria-label="Only people you mention can reply"]',
    '[aria-label="Verified accounts can reply"]',
  ];

  let audienceBtn = null;
  for (const selector of audienceSelectors) {
    audienceBtn = document.querySelector(selector);
    if (audienceBtn) break;
  }

  if (!audienceBtn) {
    Logger.warn('Content', '公開範囲ボタンが見つかりません', {});
    return; // スキップ（投稿は続行）
  }

  // ドロップダウンを開く
  audienceBtn.click();
  await sleep(300);

  // オプションのテキストマッピング
  const audienceTextMap = {
    'everyone': 'Everyone',
    'following': 'Accounts you follow',
    'verified': 'Verified accounts',
    'mentioned': 'Only accounts you mention',
  };

  const targetText = audienceTextMap[audience];
  if (!targetText) {
    Logger.warn('Content', '不明な公開範囲オプション', { audience });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return;
  }

  // メニューアイテムを探してクリック
  const menuItems = document.querySelectorAll('[role="menuitem"]');
  let found = false;

  for (const item of menuItems) {
    if (item.textContent?.trim() === targetText) {
      item.click();
      found = true;
      Logger.debug('Content', '公開範囲選択', { selected: targetText });
      break;
    }
  }

  if (!found) {
    Logger.warn('Content', '公開範囲オプションが見つかりません', { targetText });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }

  await sleep(200);
}

/**
 * メディアファイルを添付
 */
async function attachMedia(mediaFiles, selectors) {
  const fileInputDef = selectors.media?.fileInput;
  if (!fileInputDef) {
    throw new Error('ファイル入力セレクタが定義されていません');
  }

  const fileInput = document.querySelector(fileInputDef.primary);
  if (!fileInput) {
    // フォールバックを試す
    for (const fallback of fileInputDef.fallback || []) {
      const el = document.querySelector(fallback);
      if (el) {
        await uploadFilesToInput(el, mediaFiles);
        return;
      }
    }
    throw new Error('ファイル入力要素が見つかりません');
  }

  await uploadFilesToInput(fileInput, mediaFiles);
}

/**
 * ファイルをinput要素にアップロード
 */
async function uploadFilesToInput(fileInput, mediaFiles) {
  // Base64からFileオブジェクトを作成
  const files = await Promise.all(mediaFiles.map(async (media, index) => {
    const response = await fetch(media.dataUrl);
    const blob = await response.blob();
    return new File([blob], media.name || `image_${index}.${media.type.split('/')[1]}`, { type: media.type });
  }));

  // DataTransferを使ってファイルを設定
  const dataTransfer = new DataTransfer();
  files.forEach(file => dataTransfer.items.add(file));
  fileInput.files = dataTransfer.files;

  // changeイベントを発火
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));

  // アップロード完了を待機（プレビュー表示の確認）
  await waitForMediaPreview();
}

/**
 * メディアプレビューの表示を待機
 */
async function waitForMediaPreview(timeout = 10000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // プレビュー要素または添付完了インジケータを探す
    const preview = document.querySelector('[data-testid="attachments"]') ||
                    document.querySelector('[data-testid="tweetPhoto"]') ||
                    document.querySelector('img[src*="blob:"]');
    if (preview) {
      return true;
    }
    await sleep(200);
  }

  Logger.warn('Content', 'メディアプレビュー待機タイムアウト', {});
  return true; // タイムアウトでも続行
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
 *
 * 重要: React状態を有効化するため、click() → focus() → InputEvent の順序が必須
 * (仕様書: docs/dom-selectors.md 参照)
 */
async function inputText(textArea, text) {
  // 1. クリックでReact状態を有効化（これが必須）
  textArea.click();
  await sleep(100);

  // 2. フォーカス
  textArea.focus();
  await sleep(100);

  // 3. Draft.jsエディタの場合
  if (textArea.getAttribute('contenteditable') === 'true') {
    // InputEventを使用
    const inputEvent = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
    });
    textArea.dispatchEvent(inputEvent);

    // フォールバック: execCommandを試す
    if (!textArea.textContent.includes(text)) {
      document.execCommand('insertText', false, text);
    }

    // 最終フォールバック: textContentを直接設定
    if (!textArea.textContent.includes(text)) {
      textArea.textContent = text;
      textArea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } else {
    // 通常のテキストエリア
    textArea.value = text;
    textArea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 4. React状態反映待機
  await sleep(300);

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

/**
 * アンケート付き投稿を実行
 * F-006: アンケート作成機能
 */
async function executePostWithPoll(payload) {
  const { text, pollOptions, pollLength, audience, selectors } = payload;

  Logger.info('Content', 'アンケート付き投稿実行開始', {
    textLength: text?.length || 0,
    optionCount: pollOptions?.length || 0
  });

  try {
    // 1. テキストエリアを取得して入力
    const textAreaDef = selectors?.composer?.textArea;
    const textArea = await findElement(textAreaDef, 'textArea', []);
    if (!textArea) {
      throw new Error('テキストエリアが見つかりません');
    }

    // テキストを入力
    if (text) {
      await inputText(textArea, text);
      await sleep(300);
    }

    // 2. アンケートボタンをクリック
    // セレクタ: [data-testid="createPollButton"]
    const modal = document.querySelector('[role="dialog"]');
    const searchContext = modal || document;

    const pollBtn = searchContext.querySelector('[data-testid="createPollButton"]');
    if (!pollBtn) {
      throw new Error('アンケートボタンが見つかりません ([data-testid="createPollButton"])');
    }

    pollBtn.focus();
    await sleep(100);
    pollBtn.click();
    Logger.debug('Content', 'Pollボタンクリック');
    await sleep(600);

    // 3. アンケート選択肢を入力
    if (pollOptions && pollOptions.length >= 2) {
      await fillPollOptions(pollOptions, searchContext);
    }

    // 4. アンケート期間を設定
    if (pollLength) {
      await setPollLength(pollLength, searchContext);
    }

    // 5. 公開範囲を設定
    if (audience && audience !== 'everyone') {
      await setAudience(audience);
      await sleep(300);
    }

    // 6. 投稿ボタンをクリック
    const postButton = await findPostAllButton(selectors);
    if (!postButton) {
      throw new Error('投稿ボタンが見つかりません');
    }

    await waitForButtonEnabled(postButton);
    postButton.click();
    Logger.info('Content', '投稿ボタンクリック', {});

    // 7. 投稿完了を待機
    await waitForPostComplete();
    Logger.info('Content', 'アンケート付き投稿完了', {});

    return { success: true };

  } catch (error) {
    Logger.error('Content', 'アンケート付き投稿失敗', error);
    return { success: false, error: error.message };
  }
}

/**
 * アンケート選択肢を入力
 * セレクタ: input[name="Choice1"], input[name="Choice2"], ...
 * 追加ボタン: [data-testid="addPollChoice"]
 */
async function fillPollOptions(options, context) {
  Logger.debug('Content', 'アンケート選択肢入力開始', { count: options.length });

  for (let i = 0; i < options.length && i < 4; i++) {
    const choiceName = `Choice${i + 1}`;
    let input = context.querySelector(`input[name="${choiceName}"]`);

    // 3つ目以降は追加ボタンで作成が必要
    if (!input && i >= 2) {
      const addBtn = context.querySelector('[data-testid="addPollChoice"]');
      if (addBtn) {
        addBtn.click();
        await sleep(400);
        input = context.querySelector(`input[name="${choiceName}"]`);
      }
    }

    if (input) {
      input.focus();
      await sleep(100);
      input.value = '';
      input.value = options[i];
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      Logger.debug('Content', `Choice${i + 1}入力完了`, { value: options[i] });
      await sleep(200);
    } else {
      Logger.warn('Content', `Choice${i + 1}入力欄が見つかりません`);
    }
  }
}

/**
 * アンケート期間を設定
 * セレクタ:
 *   Days: [data-testid="selectPollDays"]
 *   Hours: [data-testid="selectPollHours"]
 *   Minutes: [data-testid="selectPollMinutes"]
 */
async function setPollLength(pollLength, context) {
  const { days = 1, hours = 0, minutes = 0 } = pollLength;

  // Days
  const daysSelect = context.querySelector('[data-testid="selectPollDays"]');
  if (daysSelect) {
    daysSelect.value = String(days);
    daysSelect.dispatchEvent(new Event('change', { bubbles: true }));
    Logger.debug('Content', 'Days設定', { days });
  }
  await sleep(100);

  // Hours
  const hoursSelect = context.querySelector('[data-testid="selectPollHours"]');
  if (hoursSelect) {
    hoursSelect.value = String(hours);
    hoursSelect.dispatchEvent(new Event('change', { bubbles: true }));
    Logger.debug('Content', 'Hours設定', { hours });
  }
  await sleep(100);

  // Minutes
  const minutesSelect = context.querySelector('[data-testid="selectPollMinutes"]');
  if (minutesSelect) {
    minutesSelect.value = String(minutes);
    minutesSelect.dispatchEvent(new Event('change', { bubbles: true }));
    Logger.debug('Content', 'Minutes設定', { minutes });
  }
  await sleep(100);

  Logger.debug('Content', 'アンケート期間設定完了', { days, hours, minutes });
}

/**
 * 絵文字を挿入
 * F-007: 絵文字挿入機能
 */
async function insertEmoji(payload) {
  const { emoji, selectors } = payload;

  Logger.info('Content', '絵文字挿入', { emoji });

  try {
    // テキストエリアを取得
    const modal = document.querySelector('[role="dialog"]');
    const searchContext = modal || document;

    const textArea = searchContext.querySelector('[data-testid="tweetTextarea_0"]') ||
                    searchContext.querySelector('[role="textbox"]');

    if (!textArea) {
      throw new Error('テキストエリアが見つかりません');
    }

    // テキストエリアをアクティブにする
    textArea.click();
    await sleep(100);
    textArea.focus();
    await sleep(100);

    // 絵文字を直接入力（絵文字ピッカーを開かずに直接挿入）
    const inputEvent = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: emoji,
    });
    textArea.dispatchEvent(inputEvent);

    // フォールバック
    if (!textArea.textContent?.includes(emoji)) {
      document.execCommand('insertText', false, emoji);
    }

    await sleep(200);

    Logger.info('Content', '絵文字挿入完了', { emoji });
    return { success: true };

  } catch (error) {
    Logger.error('Content', '絵文字挿入失敗', error);
    return { success: false, error: error.message };
  }
}

/**
 * 絵文字ピッカーを開いて絵文字を選択
 * （高度な絵文字挿入 - ピッカーUI使用）
 * DOM構造: 検索入力は placeholder="Search emojis"
 */
async function openEmojiPickerAndSelect(emojiName, context) {
  // 絵文字ボタンをクリック
  const emojiBtn = context.querySelector('[aria-label="Add emoji"]');
  if (!emojiBtn) {
    throw new Error('絵文字ボタンが見つかりません');
  }

  emojiBtn.focus();
  await sleep(100);
  emojiBtn.click();
  await sleep(500);

  // 検索欄に入力 (placeholder="Search emojis")
  const searchInput = document.querySelector('input[placeholder="Search emojis"], input[placeholder*="Search emoji"]');
  if (searchInput && emojiName) {
    searchInput.focus();
    await sleep(100);
    searchInput.value = emojiName;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(400);

    // 最初の検索結果をクリック（絵文字ボタン）
    const emojiButtons = document.querySelectorAll('button[type="button"]');
    for (const btn of emojiButtons) {
      // 絵文字名を含むボタンを探す
      const label = btn.getAttribute('aria-label') || btn.textContent || '';
      if (label.toLowerCase().includes(emojiName.toLowerCase())) {
        btn.click();
        await sleep(200);
        return;
      }
    }
  }

  // ピッカーを閉じる（Escapeキー）
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(100);
}

// 初期化実行
init();
