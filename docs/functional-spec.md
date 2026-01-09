# XPostAgent 機能仕様書

**作成日**: 2025-01-09
**バージョン**: 1.0.0
**ステータス**: 設計完了

---

## 1. 概要

本書は XPostAgent の各機能の詳細仕様を定義します。

---

## 2. 投稿機能

### 2.1 テキスト投稿 (F-001)

#### 仕様
| 項目 | 内容 |
|------|------|
| 文字数制限 | 最大 280 文字（X の制限に準拠） |
| 対応文字 | Unicode 全般（絵文字含む） |
| 改行 | 対応 |
| メンション | @ユーザー名 形式で対応 |
| ハッシュタグ | #タグ名 形式で対応 |
| URL | 自動短縮（X 側で処理） |

#### 処理フロー
```
1. ユーザーがテキストを入力
      │
      ▼
2. 文字数カウント・バリデーション
      │
      ▼
3. Content Script がテキストエリアに入力
   - セレクタ: [data-testid="tweetTextarea_0"]
   - Draft.js エディタへのイベントディスパッチ
      │
      ▼
4. 入力完了を確認
```

#### DOM 操作詳細
```javascript
// Draft.js への入力方法
async function inputText(text) {
  const textArea = document.querySelector('[data-testid="tweetTextarea_0"]');

  // フォーカス
  textArea.focus();

  // テキストを挿入（execCommand または InputEvent）
  document.execCommand('insertText', false, text);

  // または InputEvent を使用
  const inputEvent = new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: text
  });
  textArea.dispatchEvent(inputEvent);
}
```

---

### 2.2 公開範囲設定 (F-002)

#### 仕様
| 選択肢 | 説明 |
|--------|------|
| Everyone | 全員が返信可能（デフォルト） |
| Accounts you follow | フォロー中のアカウントのみ |
| Verified accounts | 認証済みアカウントのみ |
| Only people you mention | メンションした人のみ |

#### 処理フロー
```
1. 公開範囲ボタンをクリック
   - セレクタ: [aria-label="Everyone can reply"]
      │
      ▼
2. ドロップダウンメニューが表示
      │
      ▼
3. 希望の選択肢をクリック
      │
      ▼
4. メニューが閉じ、選択が反映
```

---

### 2.3 画像添付 (F-003)

#### 仕様
| 項目 | 内容 |
|------|------|
| 対応形式 | JPEG, PNG, WebP, GIF |
| 最大枚数 | 4枚 |
| 最大サイズ | 5MB/枚（X の制限に準拠） |
| 解像度 | 最大 4096x4096 |

#### 処理フロー
```
1. ファイル入力要素を取得
   - セレクタ: [data-testid="fileInput"]
      │
      ▼
2. DataTransfer API でファイルを設定
      │
      ▼
3. change イベントを発火
      │
      ▼
4. アップロード完了を待機
      │
      ▼
5. プレビュー表示を確認
```

#### DOM 操作詳細
```javascript
async function uploadImage(file) {
  const fileInput = document.querySelector('[data-testid="fileInput"]');

  // DataTransfer を使用してファイルを設定
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;

  // change イベントを発火
  const changeEvent = new Event('change', { bubbles: true });
  fileInput.dispatchEvent(changeEvent);

  // アップロード完了を待機（プレビュー要素の出現で判定）
  await waitForElement({ primary: '[data-testid="attachments"]' });
}
```

---

### 2.4 動画添付 (F-004)

#### 仕様
| 項目 | 内容 |
|------|------|
| 対応形式 | MP4, QuickTime (MOV) |
| 最大サイズ | 512MB |
| 最大長さ | 2分20秒 |
| 解像度 | 最大 1920x1200 |

#### 処理
画像添付と同様の処理フロー。fileInput が動画形式も受け付ける。

---

### 2.5 GIF 添付 (F-005)

#### 仕様
- X 内蔵の GIF 検索機能を使用
- 外部 GIF ファイルのアップロードも可能

#### 処理フロー
```
1. GIF ボタンをクリック
   - セレクタ: [data-testid="gifSearchButton"]
      │
      ▼
2. GIF 検索パネルが表示
      │
      ▼
3. 検索キーワードを入力 または カテゴリ選択
      │
      ▼
4. GIF を選択
      │
      ▼
5. 投稿に添付
```

---

### 2.6 アンケート作成 (F-006)

#### 仕様
| 項目 | 内容 |
|------|------|
| 選択肢数 | 2〜4個 |
| 文字数 | 各選択肢 25文字以内 |
| 投票期間 | 5分〜7日 |

#### 処理フロー
```
1. アンケートボタンをクリック
   - セレクタ: [data-testid="createPollButton"]
      │
      ▼
2. アンケートフォームが表示
      │
      ▼
3. 選択肢を入力
      │
      ▼
4. 投票期間を設定
      │
      ▼
5. 完了
```

---

### 2.7 絵文字挿入 (F-007)

#### 処理フロー
```
1. 絵文字ボタンをクリック
   - セレクタ: [aria-label="Add emoji"]
      │
      ▼
2. 絵文字ピッカーが表示
      │
      ▼
3. 絵文字を選択
      │
      ▼
4. テキストエリアに挿入
```

---

### 2.8 予約投稿 (F-008)

#### 仕様
| 項目 | 内容 |
|------|------|
| 最短予約 | 現在時刻から5分後 |
| 最長予約 | 18ヶ月先まで |
| タイムゾーン | ユーザーのローカル時間 |

#### 処理フロー
```
1. スケジュールボタンをクリック
   - セレクタ: [data-testid="scheduleOption"]
      │
      ▼
2. 日時選択ダイアログが表示
      │
      ▼
3. 日付・時間を選択
      │
      ▼
4. 「確認」をクリック
      │
      ▼
5. 投稿ボタンが「Schedule」に変化
```

---

### 2.9 位置タグ付与 (F-009)

#### 処理フロー
```
1. 位置タグボタンをクリック
   - セレクタ: [data-testid="geoButton"]
      │
      ▼
2. 位置検索ダイアログが表示
      │
      ▼
3. 場所を検索・選択
      │
      ▼
4. 投稿に位置情報が追加
```

---

### 2.10 Grok 強化 (F-010)

#### 仕様
- AI による画像生成・テキスト強化
- Premium 機能の可能性あり

#### 処理フロー
```
1. Grok ボタンをクリック
   - セレクタ: [data-testid="grokImgGen"]
      │
      ▼
2. Grok パネルが表示
      │
      ▼
3. プロンプトを入力
      │
      ▼
4. 生成結果を投稿に適用
```

---

### 2.11 ツリー投稿 (F-011)

#### 仕様
- 連続した複数の投稿をスレッドとして投稿
- 各投稿は通常の投稿制限に準拠

#### 処理フロー
```
1. 1つ目の投稿内容を入力
      │
      ▼
2. 「+」ボタンをクリック（テキスト入力後に表示）
      │
      ▼
3. 2つ目の入力欄が追加
      │
      ▼
4. 繰り返し
      │
      ▼
5. 「Post all」で一括投稿
```

---

### 2.12 投稿完了確認 (F-012)

#### 検知方法
1. **Toast 通知の検出**
   - 「Your post was sent」等のメッセージ

2. **タイムラインへの出現**
   - セレクタ: `[data-testid="tweet"]`
   - 投稿内容との一致確認

3. **URL 変化の検出**
   - 投稿成功時に投稿 ID を含む URL に遷移

#### 処理フロー
```
1. 投稿ボタンをクリック後、監視開始
      │
      ▼
2. 以下のいずれかを検知:
   - Toast 通知
   - タイムラインに新規投稿出現
   - URL 変化
      │
      ▼
3. 成功/失敗を判定
      │
      ▼
4. ユーザーに通知
```

---

## 3. セルフヒーリング機能

### 3.1 DOM 差分検知 (H-001)

#### 処理フロー
```
1. Content Script が現在の DOM 構造を取得
      │
      ▼
2. Cloudflare Worker に送信
      │
      ▼
3. KV に保存された基準 DOM と比較
      │
      ▼
4. 差分の有無を判定
   - 差分なし → 通常処理を続行
   - 差分あり → セルフヒーリング開始
```

#### 比較対象
- 投稿関連要素の構造
- data-testid 属性の変化
- aria-label 属性の変化
- 要素階層の変化

---

### 3.2 セレクタバージョン管理 (H-002)

#### KV 構造
```
selectors:current     → 現在有効なセレクタ
selectors:v1.0.0     → バージョン 1.0.0
selectors:v1.0.1     → バージョン 1.0.1
...
```

#### バージョニングルール
- パッチ: 軽微な修正（1.0.0 → 1.0.1）
- マイナー: セレクタ追加（1.0.0 → 1.1.0）
- メジャー: 大幅な構造変更（1.0.0 → 2.0.0）

---

### 3.3 AI による新セレクタ生成 (H-003)

#### 使用 AI
Cloudflare AI (Meta Llama)

#### プロンプト構造
```
あなたは Web ページの DOM 解析エキスパートです。

【タスク】
X（Twitter）の投稿画面において、以下の要素を特定する
CSS セレクタを提案してください。

【現在の DOM 構造】
{currentDOM}

【特定したい要素】
{targetElements}

【以前のセレクタ（動作しなくなった）】
{failedSelectors}

【出力形式】
JSON 形式で、各要素のセレクタを返してください。
信頼度スコア（0-100）も付与してください。
```

#### レスポンス例
```json
{
  "textArea": {
    "selector": "[data-testid='tweetTextarea_0']",
    "confidence": 95,
    "alternatives": [
      "[role='textbox'][aria-label='Post text']"
    ]
  },
  "postButton": {
    "selector": "[data-testid='tweetButton']",
    "confidence": 90,
    "alternatives": []
  }
}
```

---

### 3.4 セレクタ自動更新 (H-004)

#### 処理フロー
```
1. AI が新セレクタを生成
      │
      ▼
2. Content Script で検証
   - 要素が見つかるか
   - 正しい要素か（属性確認）
      │
      ▼
3. 検証成功 → KV に保存
   - 新バージョンとして登録
   - current を更新
      │
      ▼
4. 検証失敗 → エラー通知
   - 手動対応を要求
```

---

### 3.5 フォールバックセレクタ (H-005)

#### 優先順位
1. Primary セレクタ（data-testid）
2. Fallback 1（aria-label）
3. Fallback 2（role + その他属性）
4. Fallback 3（構造的セレクタ）

#### 実装
```javascript
function findElement(selectorDef) {
  // Primary
  let el = document.querySelector(selectorDef.primary);
  if (el) return { element: el, usedFallback: false };

  // Fallbacks
  for (let i = 0; i < selectorDef.fallback.length; i++) {
    el = document.querySelector(selectorDef.fallback[i]);
    if (el) return { element: el, usedFallback: true, fallbackIndex: i };
  }

  return { element: null, error: 'Element not found' };
}
```

---

## 4. UI 仕様

### 4.1 ポップアップ UI レイアウト

```
┌─────────────────────────────────────┐
│  XPostAgent                    [×] │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │      テキスト入力エリア       │   │
│  │                             │   │
│  │                      0/280  │   │
│  └─────────────────────────────┘   │
│                                     │
│  [📷] [GIF] [📊] [😊] [📅] [📍]    │
│                                     │
│  公開範囲: [Everyone ▼]            │
│                                     │
│  [+ ツリー追加]                     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │         投稿する             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ステータス: 待機中                 │
│                                     │
└─────────────────────────────────────┘
```

### 4.2 ステータス表示

| ステータス | 説明 | 色 |
|-----------|------|-----|
| 待機中 | 入力待ち | グレー |
| 処理中 | 投稿処理実行中 | 青 |
| 完了 | 投稿成功 | 緑 |
| エラー | 投稿失敗 | 赤 |
| 修復中 | セルフヒーリング中 | 黄 |

---

## 5. エラーケース

### 5.1 エラー一覧

| コード | エラー | 対応 |
|--------|--------|------|
| E001 | テキスト未入力 | 入力を促す |
| E002 | 文字数超過 | 文字数を減らすよう促す |
| E003 | セレクタ不一致 | セルフヒーリング実行 |
| E004 | ネットワークエラー | リトライ（最大3回） |
| E005 | X ログインなし | ログインを促す |
| E006 | ファイルサイズ超過 | サイズ制限を通知 |
| E007 | 非対応ファイル形式 | 対応形式を通知 |
| E008 | API レート制限 | 待機後リトライ |
| E009 | セルフヒーリング失敗 | 手動対応を要求 |

---

## 6. 更新履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2025-01-09 | 1.0.0 | 初版作成 |
