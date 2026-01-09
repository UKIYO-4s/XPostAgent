# X (Twitter) DOM セレクタ定義書

**調査日**: 2025-01-09
**対象URL**: https://x.com/home
**バージョン**: 1.0.0

---

## 1. 概要

このドキュメントは、XPostAgent が X の投稿機能を操作するために使用する DOM セレクタを定義します。
X の UI 変更に対応するため、セルフヒーリング機能と連携して管理されます。

---

## 2. セレクタ一覧

### 2.1 投稿コンポーザー

| 要素 | セレクタ (優先順) | 説明 |
|------|------------------|------|
| テキストエリア | `[data-testid="tweetTextarea_0"]` | 投稿文入力欄 |
| テキストエリアラベル | `[data-testid="tweetTextarea_0_label"]` | 入力欄のラベル |
| テキストエリアコンテナ | `[data-testid="tweetTextarea_0RichTextInputContainer"]` | リッチテキスト入力コンテナ |
| 投稿ボタン (インライン) | `[data-testid="tweetButtonInline"]` | ホーム画面の投稿ボタン |
| 投稿ボタン (モーダル) | `[data-testid="tweetButton"]` | モーダル内の投稿ボタン |
| ツールバー | `[data-testid="toolBar"]` | ボタン群の親要素 |

### 2.2 メディア・添付

| 要素 | セレクタ (優先順) | フォールバック | 説明 |
|------|------------------|---------------|------|
| ファイル入力 | `[data-testid="fileInput"]` | `input[type="file"][accept*="image"]` | 画像/動画アップロード |
| 写真/動画ボタン | `[aria-label="Add photos or video"]` | - | UI表示用ボタン |
| GIFボタン | `[data-testid="gifSearchButton"]` | `[aria-label="Add a GIF"]` | GIF検索 |

**対応ファイル形式** (fileInput の accept 属性):
```
image/jpeg, image/png, image/webp, image/gif, video/mp4, video/quicktime
```

### 2.3 投稿オプション

| 要素 | セレクタ (優先順) | フォールバック | 説明 |
|------|------------------|---------------|------|
| 公開範囲 | `[aria-label="Everyone can reply"]` | - | 返信可能ユーザー設定 |
| アンケート | `[data-testid="createPollButton"]` | `[aria-label="Add poll"]` | アンケート作成 |
| 絵文字 | `[aria-label="Add emoji"]` | - | 絵文字ピッカー |
| スケジュール | `[data-testid="scheduleOption"]` | `[aria-label="Schedule post"]` | 予約投稿 |
| 位置タグ | `[data-testid="geoButton"]` | `[aria-label="Tag location"]` | 位置情報追加 |
| Grok強化 | `[data-testid="grokImgGen"]` | `[aria-label="Enhance your post with Grok"]` | AI画像生成 |

### 2.4 モーダル専用

| 要素 | セレクタ | 説明 |
|------|---------|------|
| 閉じるボタン | `[data-testid="app-bar-close"]` | モーダルを閉じる |
| 下書きボタン | `[data-testid="unsentButton"]` | 下書き保存・表示 |
| マスク | `[data-testid="mask"]` | モーダル背景 |
| プログレスバー | `[data-testid="progressBar-bar"]` | 文字数インジケーター |
| ユーザーアバター | `[data-testid^="UserAvatar-Container-"]` | 投稿者アイコン |

### 2.5 ナビゲーション

| 要素 | セレクタ | 説明 |
|------|---------|------|
| 新規投稿リンク | `[data-testid="SideNav_NewTweet_Button"]` | サイドナビの投稿ボタン |
| アカウント切替 | `[data-testid="SideNav_AccountSwitcher_Button"]` | アカウント切替ボタン |
| メインカラム | `[data-testid="primaryColumn"]` | メインコンテンツエリア |

### 2.6 投稿完了検知

| 要素 | セレクタ | 説明 |
|------|---------|------|
| Toast通知 | `[data-testid="toast"]` | 投稿完了通知 |
| 投稿アイテム | `[data-testid="tweet"]` | 投稿されたツイート |
| 投稿テキスト | `[data-testid="tweetText"]` | ツイート本文 |
| 投稿画像 | `[data-testid="tweetPhoto"]` | ツイート添付画像 |

### 2.7 インタラクション

| 要素 | セレクタ | 説明 |
|------|---------|------|
| 返信ボタン | `[data-testid="reply"]` | 返信アクション |
| リポストボタン | `[data-testid="retweet"]` | リポスト/引用 |

---

## 3. JSON 形式セレクタ定義

Cloudflare KV に保存する形式:

```json
{
  "version": "1.0.0",
  "updatedAt": "2025-01-09T00:00:00Z",
  "selectors": {
    "composer": {
      "textArea": {
        "primary": "[data-testid=\"tweetTextarea_0\"]",
        "fallback": ["[role=\"textbox\"][aria-label=\"Post text\"]", "div[contenteditable=\"true\"].public-DraftEditor-content"]
      },
      "postButtonInline": {
        "primary": "[data-testid=\"tweetButtonInline\"]",
        "fallback": ["button[data-testid=\"tweetButton\"]"]
      },
      "postButtonModal": {
        "primary": "[data-testid=\"tweetButton\"]",
        "fallback": []
      },
      "toolbar": {
        "primary": "[data-testid=\"toolBar\"]",
        "fallback": []
      }
    },
    "media": {
      "fileInput": {
        "primary": "[data-testid=\"fileInput\"]",
        "fallback": ["input[type=\"file\"][accept*=\"image\"]"]
      },
      "addMediaButton": {
        "primary": "[aria-label=\"Add photos or video\"]",
        "fallback": []
      },
      "gifButton": {
        "primary": "[data-testid=\"gifSearchButton\"]",
        "fallback": ["[aria-label=\"Add a GIF\"]"]
      }
    },
    "options": {
      "pollButton": {
        "primary": "[data-testid=\"createPollButton\"]",
        "fallback": ["[aria-label=\"Add poll\"]"]
      },
      "emojiButton": {
        "primary": "[aria-label=\"Add emoji\"]",
        "fallback": []
      },
      "scheduleButton": {
        "primary": "[data-testid=\"scheduleOption\"]",
        "fallback": ["[aria-label=\"Schedule post\"]"]
      },
      "locationButton": {
        "primary": "[data-testid=\"geoButton\"]",
        "fallback": ["[aria-label=\"Tag location\"]"]
      },
      "grokButton": {
        "primary": "[data-testid=\"grokImgGen\"]",
        "fallback": ["[aria-label=\"Enhance your post with Grok\"]"]
      },
      "replySettings": {
        "primary": "[aria-label=\"Everyone can reply\"]",
        "fallback": ["button:has-text('Everyone can reply')"]
      }
    },
    "modal": {
      "closeButton": {
        "primary": "[data-testid=\"app-bar-close\"]",
        "fallback": ["button[aria-label=\"Close\"]"]
      },
      "draftsButton": {
        "primary": "[data-testid=\"unsentButton\"]",
        "fallback": []
      },
      "mask": {
        "primary": "[data-testid=\"mask\"]",
        "fallback": []
      },
      "progressBar": {
        "primary": "[data-testid=\"progressBar-bar\"]",
        "fallback": []
      }
    },
    "navigation": {
      "newTweetButton": {
        "primary": "[data-testid=\"SideNav_NewTweet_Button\"]",
        "fallback": ["a[href=\"/compose/post\"]"]
      },
      "primaryColumn": {
        "primary": "[data-testid=\"primaryColumn\"]",
        "fallback": []
      }
    },
    "confirmation": {
      "toast": {
        "primary": "[data-testid=\"toast\"]",
        "fallback": []
      },
      "tweet": {
        "primary": "[data-testid=\"tweet\"]",
        "fallback": ["article[role=\"article\"]"]
      },
      "tweetText": {
        "primary": "[data-testid=\"tweetText\"]",
        "fallback": []
      }
    }
  }
}
```

---

## 4. セレクタ検索の優先順位

1. **data-testid** - 最も安定（X が内部テスト用に使用）
2. **aria-label** - アクセシビリティ用で比較的安定
3. **role 属性** - WAI-ARIA ロールベース
4. **class 名** - 最も不安定（ビルドごとに変更される可能性）

---

## 5. 要素取得ヘルパー関数

```javascript
/**
 * 優先順位付きセレクタで要素を検索
 * @param {Object} selectorDef - { primary: string, fallback: string[] }
 * @returns {Element|null}
 */
function findElement(selectorDef) {
  // プライマリセレクタで検索
  let element = document.querySelector(selectorDef.primary);
  if (element) {
    Logger.debug('Content', '要素発見 (primary)', { selector: selectorDef.primary });
    return element;
  }

  // フォールバックで検索
  for (const fallback of selectorDef.fallback || []) {
    element = document.querySelector(fallback);
    if (element) {
      Logger.warn('Content', '要素発見 (fallback)', { selector: fallback });
      return element;
    }
  }

  Logger.error('Content', '要素未発見', { selectorDef });
  return null;
}

/**
 * 要素の出現を待機
 * @param {Object} selectorDef
 * @param {number} timeout - ミリ秒
 * @returns {Promise<Element>}
 */
async function waitForElement(selectorDef, timeout = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const element = findElement(selectorDef);
    if (element) return element;
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`Element not found: ${JSON.stringify(selectorDef)}`);
}
```

---

## 6. 注意事項

### 6.1 動的要素
- テキストエリアは Draft.js ベースのリッチテキストエディタ
- 直接 `value` を設定できないため、入力イベントをシミュレートする必要あり

### 6.2 ファイルアップロード
- `fileInput` は hidden 要素
- プログラムでファイルを設定するには `DataTransfer` API を使用

### 6.3 モーダル投稿
- `/compose/post` に遷移するとモーダルが開く
- モーダル内のセレクタは `tweetButton` (Inline ではない)

### 6.4 公開範囲設定
- `data-testid` が存在せず、`aria-label` で特定
- デフォルト値: `"Everyone can reply"`
- クリックするとドロップダウンメニューが表示される
- 選択肢: Everyone / Accounts you follow / Verified accounts / Only people you mention

### 6.5 ツリー投稿（スレッド）
- テキスト入力後に「+」ボタンが表示される
- 現時点で専用の `data-testid` は確認できず
- 投稿ボタン横のUI変化で検出する必要あり

---

## 7. 更新履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2025-01-09 | 1.0.0 | 初版作成 |
