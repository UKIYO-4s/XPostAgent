# XPostAgent アーキテクチャ設計書

## 1. システム概要

XPostAgentは、Chrome拡張機能を通じてX（旧Twitter）への投稿を自動化するシステムです。
Cloudflare上のセルフヒーリング機能により、XのDOM構造変更にも自動対応します。

---

## 2. システム構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                         ユーザー環境                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Chrome ブラウザ                         │  │
│  │  ┌─────────────────┐    ┌─────────────────────────────┐  │  │
│  │  │  Chrome拡張機能   │    │      X (twitter.com)        │  │  │
│  │  │  ┌───────────┐  │    │                             │  │  │
│  │  │  │  Popup UI │  │    │  ┌─────────────────────┐   │  │  │
│  │  │  └─────┬─────┘  │    │  │   Content Script    │   │  │  │
│  │  │        │        │    │  │   (DOM操作実行)      │   │  │  │
│  │  │  ┌─────┴─────┐  │    │  └─────────────────────┘   │  │  │
│  │  │  │ Background │◄─┼────┼──────────────────────────►│  │  │
│  │  │  │  Service   │  │    │                             │  │  │
│  │  │  └─────┬─────┘  │    └─────────────────────────────┘  │  │
│  │  └────────┼────────┘                                      │  │
│  └───────────┼───────────────────────────────────────────────┘  │
└──────────────┼──────────────────────────────────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Cloudflare Worker                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │
│  │  │ DOM差分検知  │  │ セレクタ提供 │  │ セルフヒーリング │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │   │
│  │         │                │                  │           │   │
│  │         ▼                ▼                  ▼           │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │              Cloudflare KV                        │   │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  │   │   │
│  │  │  │ DOM構造情報 │  │ セレクタ定義│  │ バージョン  │  │   │   │
│  │  │  └────────────┘  └────────────┘  └────────────┘  │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼ (差分検知時のみ)                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Cloudflare AI (Llama)                       │   │
│  │              新セレクタ解析・提案                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. コンポーネント詳細

### 3.1 Chrome拡張機能

#### ディレクトリ構造
```
extension/
├── manifest.json          # 拡張機能マニフェスト (Manifest V3)
├── popup/
│   ├── popup.html         # ポップアップUI
│   ├── popup.css          # スタイル
│   └── popup.js           # UIロジック
├── background/
│   └── service-worker.js  # バックグラウンド処理
├── content/
│   └── content.js         # X上でのDOM操作
├── lib/
│   └── api.js             # Cloudflare Worker通信
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

#### 3.1.1 Popup UI (`popup/`)
**責務**: ユーザーインターフェース

| 機能 | 説明 |
|------|------|
| 投稿テキスト入力 | テキストエリアで投稿内容を入力 |
| 公開範囲選択 | 全員/フォロワー/サークル等 |
| メディア添付 | 画像ファイル選択・プレビュー |
| オプション選択 | GIF/アンケート/絵文字/スケジュール |
| ツリー追加 | 複数投稿の連結 |
| 実行ボタン | 投稿処理の開始 |
| ステータス表示 | 処理状況・結果表示 |

#### 3.1.2 Background Service Worker (`background/`)
**責務**: 拡張機能のコア処理

| 機能 | 説明 |
|------|------|
| Cloudflare通信 | セレクタ取得・差分報告 |
| Content Script制御 | メッセージング管理 |
| 状態管理 | 処理フロー制御 |
| エラーハンドリング | リトライ・フォールバック |

#### 3.1.3 Content Script (`content/`)
**責務**: X上でのDOM操作実行

| 機能 | 説明 |
|------|------|
| 要素特定 | セレクタによるDOM要素取得 |
| テキスト入力 | 投稿欄への文字入力 |
| クリック操作 | ボタン・オプション選択 |
| ファイルアップロード | 画像・メディア添付 |
| 完了検知 | 投稿成功の確認 |
| DOM構造取得 | 現在のHTML構造を取得 |

---

### 3.2 Cloudflare Worker

#### エンドポイント設計
```
POST /api/selectors/get      # 現在のセレクタ定義を取得
POST /api/selectors/validate # DOM構造の差分チェック
POST /api/selectors/heal     # セルフヒーリング実行
GET  /api/health             # ヘルスチェック
```

#### 3.2.1 セレクタ取得 (`/api/selectors/get`)
```typescript
// Request
{ action: "post" | "media" | "schedule" | ... }

// Response
{
  version: "1.0.0",
  selectors: {
    postButton: "div[data-testid='tweetButton']",
    textArea: "div[data-testid='tweetTextarea_0']",
    mediaButton: "input[data-testid='fileInput']",
    // ...
  }
}
```

#### 3.2.2 差分検知 (`/api/selectors/validate`)
```typescript
// Request
{
  currentDOM: "<html>...</html>",  // 現在のDOM構造（関連部分のみ）
  version: "1.0.0"
}

// Response
{
  isValid: boolean,
  differences: [...],  // 差分があった場合の詳細
  needsHealing: boolean
}
```

#### 3.2.3 セルフヒーリング (`/api/selectors/heal`)
```typescript
// Request
{
  currentDOM: "<html>...</html>",
  failedSelectors: ["postButton", "textArea"]
}

// Response
{
  success: boolean,
  newSelectors: {
    postButton: "新しいセレクタ",
    textArea: "新しいセレクタ"
  },
  version: "1.0.1"
}
```

---

### 3.3 Cloudflare KV スキーマ

| Key | Value | 説明 |
|-----|-------|------|
| `selectors:current` | JSON | 現在有効なセレクタ定義 |
| `selectors:v{version}` | JSON | バージョン別セレクタ（履歴） |
| `dom:baseline` | HTML | 基準となるDOM構造 |
| `dom:hash` | String | DOMハッシュ値（差分検知用） |
| `config:meta` | JSON | 設定・メタ情報 |

#### セレクタ定義フォーマット
```json
{
  "version": "1.0.0",
  "updatedAt": "2025-01-09T10:00:00Z",
  "selectors": {
    "composer": {
      "container": "div[data-testid='primaryColumn']",
      "textArea": "div[data-testid='tweetTextarea_0']",
      "postButton": "div[data-testid='tweetButton']"
    },
    "media": {
      "uploadButton": "input[data-testid='fileInput']",
      "gifButton": "div[aria-label='GIF']",
      "emojiButton": "div[aria-label='Emoji']"
    },
    "options": {
      "audience": "div[data-testid='replySettings']",
      "schedule": "div[data-testid='scheduleOption']",
      "poll": "div[data-testid='pollOption']"
    },
    "thread": {
      "addButton": "div[data-testid='addTweetButton']"
    },
    "confirmation": {
      "successIndicator": "div[data-testid='toast']"
    }
  }
}
```

---

## 4. データフロー

### 4.1 通常投稿フロー

```
[ユーザー] ─→ [Popup UI] ─→ [Background SW] ─→ [Cloudflare Worker]
    │              │               │                    │
    │         入力データ      セレクタ要求         セレクタ返却
    │              │               │                    │
    │              │               ▼                    │
    │              │        [Content Script] ◄──────────┘
    │              │               │
    │              │          DOM操作実行
    │              │               │
    │              │               ▼
    │              │         [X ページ]
    │              │               │
    │              │          投稿完了検知
    │              │               │
    ◄──────────────┴───────────────┘
         結果表示
```

### 4.2 セルフヒーリングフロー

```
[Content Script] ──セレクタ失敗──→ [Background SW]
        │                               │
        │                          差分報告
        │                               ▼
        │                      [Cloudflare Worker]
        │                               │
        │                          差分検知
        │                               ▼
        │                      [Cloudflare AI]
        │                        (Llama解析)
        │                               │
        │                         新セレクタ生成
        │                               │
        │                               ▼
        │                        [Cloudflare KV]
        │                          KV更新
        │                               │
        ◄───────新セレクタ返却───────────┘
        │
    再試行実行
```

---

## 5. セルフヒーリングロジック

### 5.1 処理フロー詳細

```
1. Content ScriptがDOM操作を試行
        │
        ▼
2. セレクタで要素が見つからない
        │
        ▼
3. Background SWがCloudflare Workerに差分報告
   - 現在のDOM構造（関連部分）
   - 失敗したセレクタ
        │
        ▼
4. Workerが保存済みDOMと比較
        │
   ┌────┴────┐
   │         │
 差分なし   差分あり
   │         │
   ▼         ▼
5a. エラー  5b. Cloudflare AI呼び出し
   返却        - DOM解析依頼
              - 新セレクタ候補生成
                   │
                   ▼
              6. 新セレクタをKVに保存
                   │
                   ▼
              7. 新セレクタを拡張機能に返却
                   │
                   ▼
              8. Content Scriptが再試行
                   │
              ┌────┴────┐
              │         │
            成功       失敗
              │         │
              ▼         ▼
           完了     エラー通知
                  (手動対応要求)
```

### 5.2 Cloudflare AI プロンプト設計

```
あなたはWebページのDOM解析エキスパートです。

【タスク】
X（Twitter）の投稿画面において、以下の要素を特定するCSSセレクタを提案してください。

【現在のDOM構造】
{currentDOM}

【特定したい要素】
- 投稿テキストエリア
- 投稿ボタン
- メディアアップロードボタン
...

【出力形式】
JSON形式で、各要素のセレクタを返してください。
複数候補がある場合は優先度順にリストで返してください。
```

---

## 6. セキュリティ考慮事項

| 項目 | 対策 |
|------|------|
| API認証 | Worker側でAPIキー検証 |
| CORS | 拡張機能オリジンのみ許可 |
| Rate Limiting | Cloudflare設定で制限 |
| データ保護 | 投稿内容はWorkerに送信しない |
| XSS対策 | Content Script内でのサニタイズ |

---

## 7. エラーハンドリング

| エラー種別 | 対応 |
|-----------|------|
| セレクタ不一致 | セルフヒーリング実行 |
| ネットワークエラー | リトライ（3回まで） |
| AI解析失敗 | フォールバックセレクタ使用 |
| 投稿失敗 | ユーザーに通知・手動対応案内 |
| KV読み書き失敗 | ローカルキャッシュ使用 |

---

## 8. ロギング戦略

エラー解析を迅速に行うため、各コンポーネントで詳細なログを出力します。

### 8.1 ログレベル定義

| レベル | 用途 | 出力例 |
|--------|------|--------|
| `DEBUG` | 詳細なデバッグ情報 | 変数値、DOM要素の状態 |
| `INFO` | 正常な処理の進行状況 | 処理開始・完了 |
| `WARN` | 警告（処理は継続） | リトライ発生、フォールバック使用 |
| `ERROR` | エラー（処理失敗） | セレクタ不一致、API失敗 |

### 8.2 ログフォーマット

```javascript
// 統一フォーマット
const LOG_PREFIX = '[XPostAgent]';

const Logger = {
  debug: (component, action, data) => {
    console.log(`${LOG_PREFIX}[DEBUG][${component}] ${action}`, data);
  },
  info: (component, action, data) => {
    console.info(`${LOG_PREFIX}[INFO][${component}] ${action}`, data);
  },
  warn: (component, action, data) => {
    console.warn(`${LOG_PREFIX}[WARN][${component}] ${action}`, data);
  },
  error: (component, action, error) => {
    console.error(`${LOG_PREFIX}[ERROR][${component}] ${action}`, error);
  }
};
```

### 8.3 コンポーネント別ログ出力ポイント

#### Popup UI (`popup.js`)
```javascript
// ユーザーアクション
Logger.info('Popup', 'ボタンクリック', { button: 'post', text: inputText });
Logger.debug('Popup', 'オプション選択', { options: selectedOptions });
Logger.error('Popup', '入力バリデーション失敗', { field: 'text', reason: 'empty' });
```

#### Background Service Worker (`service-worker.js`)
```javascript
// API通信
Logger.info('Background', 'セレクタ取得開始', { action: 'post' });
Logger.debug('Background', 'API レスポンス', { status: 200, data: selectors });
Logger.warn('Background', 'リトライ実行', { attempt: 2, maxAttempts: 3 });
Logger.error('Background', 'API通信失敗', { url: endpoint, error: err.message });

// メッセージング
Logger.debug('Background', 'Content Scriptへ送信', { type: 'EXECUTE_POST', payload });
Logger.info('Background', 'Content Scriptから受信', { type: 'POST_COMPLETE', success: true });
```

#### Content Script (`content.js`)
```javascript
// DOM操作
Logger.info('Content', 'DOM操作開始', { action: 'findTextArea' });
Logger.debug('Content', '要素検索', { selector: 'div[data-testid="tweetTextarea_0"]' });
Logger.debug('Content', '要素発見', { element: element.tagName, found: true });
Logger.warn('Content', '要素未発見', { selector, retrying: true });
Logger.error('Content', 'セレクタ失敗', { selector, dom: document.body.innerHTML.slice(0, 500) });

// 処理フロー
Logger.info('Content', 'テキスト入力完了', { length: text.length });
Logger.info('Content', 'メディアアップロード開始', { files: fileNames });
Logger.debug('Content', 'クリック実行', { target: 'postButton' });
Logger.info('Content', '投稿完了検知', { success: true, tweetId: detectedId });
```

#### Cloudflare Worker
```javascript
// リクエスト処理
console.log('[Worker][INFO] リクエスト受信', { endpoint, method });
console.log('[Worker][DEBUG] KV読み取り', { key: 'selectors:current', found: true });
console.log('[Worker][WARN] DOM差分検知', { differences: diffList });
console.log('[Worker][INFO] AI解析開始', { model: 'llama', prompt: promptSummary });
console.log('[Worker][DEBUG] AI解析結果', { newSelectors });
console.log('[Worker][ERROR] KV書き込み失敗', { key, error: err.message });
```

### 8.4 重要なログ出力ポイント一覧

| 処理 | ログレベル | 出力内容 |
|------|-----------|----------|
| 拡張機能起動 | INFO | バージョン、設定状態 |
| ユーザー入力受付 | DEBUG | 入力値、選択オプション |
| API呼び出し前 | INFO | エンドポイント、リクエスト内容 |
| API呼び出し後 | DEBUG | ステータス、レスポンスデータ |
| セレクタ検索前 | DEBUG | 使用セレクタ |
| セレクタ検索後 | DEBUG/WARN | 結果（成功/失敗） |
| DOM操作実行 | INFO | 操作種別、対象要素 |
| リトライ発生 | WARN | 試行回数、理由 |
| セルフヒーリング開始 | INFO | 失敗したセレクタ |
| AI解析実行 | DEBUG | プロンプト概要、結果 |
| 処理完了 | INFO | 成功/失敗、所要時間 |
| エラー発生 | ERROR | エラー内容、スタックトレース |

### 8.5 デバッグモード

開発時は詳細ログを有効化し、本番では必要最小限に抑えます。

```javascript
// config.js
const Config = {
  DEBUG_MODE: true,  // 開発時: true, 本番: false
  LOG_LEVEL: 'DEBUG' // DEBUG | INFO | WARN | ERROR
};

// Logger拡張
const Logger = {
  debug: (component, action, data) => {
    if (Config.DEBUG_MODE && Config.LOG_LEVEL === 'DEBUG') {
      console.log(`[XPostAgent][DEBUG][${component}] ${action}`, data);
    }
  },
  // ...
};
```

### 8.6 エラー発生時の詳細ログ

エラー時は周辺情報も含めて出力し、原因特定を容易にします。

```javascript
// エラー発生時の詳細ログ
function logDetailedError(component, action, error, context) {
  console.error(`[XPostAgent][ERROR][${component}] ${action}`, {
    message: error.message,
    stack: error.stack,
    context: {
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      ...context
    }
  });
}

// 使用例
try {
  const element = document.querySelector(selector);
  if (!element) throw new Error('Element not found');
} catch (err) {
  logDetailedError('Content', 'セレクタ検索', err, {
    selector: selector,
    documentReady: document.readyState,
    bodyLength: document.body.innerHTML.length
  });
}
```

### 8.7 Chrome DevToolsでのフィルタリング

コンソールで効率的にログを確認するためのフィルタパターン：

| フィルタ | 用途 |
|---------|------|
| `[XPostAgent]` | 全ログ表示 |
| `[XPostAgent][ERROR]` | エラーのみ |
| `[XPostAgent][Content]` | Content Scriptのみ |
| `[XPostAgent][DEBUG][Content]` | Content Scriptのデバッグログ |

---

## 9. 今後の拡張性

- **複数アカウント対応**: プロファイル管理機能
- **予約投稿管理**: スケジュール一覧・編集
- **分析機能**: 投稿履歴・統計
- **他プラットフォーム**: Instagram, Facebook等への拡張

---

## 10. 技術スタック

| レイヤー | 技術 |
|---------|------|
| 拡張機能 | Chrome Extension (Manifest V3), JavaScript/TypeScript |
| バックエンド | Cloudflare Workers (JavaScript/TypeScript) |
| ストレージ | Cloudflare KV |
| AI | Cloudflare AI (Llama) |
| 通信 | HTTPS, Fetch API |

---

## 11. 開発フェーズ

### Phase 1: 基本機能
- Chrome拡張機能の骨格作成
- シンプルなテキスト投稿機能

### Phase 2: 機能拡充
- メディア添付
- 公開範囲設定
- ツリー投稿

### Phase 3: セルフヒーリング
- Cloudflare Worker構築
- KV設計・実装
- AI連携

### Phase 4: 安定化
- テスト・デバッグ
- エラーハンドリング強化
- ドキュメント整備
