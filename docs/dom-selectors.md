# X (Twitter) DOM セレクタ仕様書 v2.1

**作成日**: 2025-01-10
**バージョン**: 2.1.0

---

## 1. 基本原則

### 1.1 セレクタベース操作の徹底

- **全ての要素操作はCSSセレクタで特定**: `data-testid` または `aria-label` を使用
- **KV管理**: セレクタは Cloudflare KV で一元管理し、セルフヒーリングに対応
- **要素の特定方法**: `document.querySelector(selector)` でDOM要素を取得

### 1.2 React/Draft.js 対応

X は React + Draft.js を使用しているため、以下の点に注意:

1. **テキスト入力の有効化**: テキストエリアは `focus()` だけでなく、DOMの `element.click()` メソッドが必要
2. **状態の反映待機**: 入力後は React の状態更新を待つため適切な待機が必要
3. **ADDボタンの出現条件**: テキスト入力が React 状態に反映されて初めて表示される

### 1.3 重要: テキストエリアの事前クリック必須

**テキストエリアは入力前に必ず `element.click()` を実行する必要がある。**

- `focus()` のみでは React の内部状態が有効化されない
- `click()` なしで `InputEvent` を発火しても、入力内容が React 状態に反映されない
- 結果として ADDボタンが表示されない、投稿ボタンが有効にならない等の問題が発生

```javascript
// 正しい順序
textArea.click();   // 1. 必須: React状態を有効化
textArea.focus();   // 2. フォーカス
// 3. InputEvent発火
```

この仕様は X の Draft.js 実装に起因するもので、通常の HTML textarea とは異なる挙動である。

### 1.4 重要: モーダル内要素のスコープ限定

**compose/post ページではモーダル外にも同一セレクタの要素が存在する。**

- ホーム画面の投稿エリアとモーダルの投稿エリアで同じ `data-testid` が使われる
- 必ず `[role="dialog"]` (モーダル) 内で要素を検索する

```javascript
// 正しい方法
const modal = document.querySelector('[role="dialog"]');
const textArea = modal.querySelector('[data-testid="tweetTextarea_0"]');
const addButton = modal.querySelector('[data-testid="addButton"]');
```

### 1.5 重要: ボタンクリック前のフォーカス

**ADDボタン等をクリックする前に `focus()` を実行する。**

```javascript
// 正しい順序
addButton.focus();  // 1. フォーカス
addButton.click();  // 2. クリック
```

これによりReactのイベントハンドラが正しく発火する。

---

## 2. セレクタ定義

### 2.1 投稿コンポーザー

| 要素 | プライマリセレクタ | フォールバック | 備考 |
|------|-------------------|---------------|------|
| テキストエリア (1件目) | `[data-testid="tweetTextarea_0"]` | `[role="textbox"]` | Draft.js エディタ |
| テキストエリア (N件目) | `[data-testid="tweetTextarea_{N}"]` | - | 0始まりインデックス |
| スレッド追加ボタン | `[data-testid="addButton"]` | `[aria-label="Add post"]` | テキスト入力後に出現 |
| スレッド削除ボタン | `[aria-label="Remove post"]` | - | 各スレッドアイテムに付属 |
| 投稿ボタン (インライン) | `[data-testid="tweetButtonInline"]` | - | ホーム画面用 |
| 投稿ボタン (モーダル) | `[data-testid="tweetButton"]` | - | スレッド時は "Post all" |
| ツールバー | `[data-testid="toolBar"]` | - | ボタン群の親要素 |

### 2.2 メディア

| 要素 | プライマリセレクタ | フォールバック |
|------|-------------------|---------------|
| ファイル入力 | `[data-testid="fileInput"]` | `input[type="file"]` |
| メディア追加ボタン | `[aria-label="Add photos or video"]` | - |
| GIF ボタン | `[data-testid="gifSearchButton"]` | `[aria-label="Add a GIF"]` |

### 2.3 投稿オプション

| 要素 | プライマリセレクタ | フォールバック |
|------|-------------------|---------------|
| アンケート | `[data-testid="createPollButton"]` | `[aria-label="Add poll"]` |
| 絵文字 | `[aria-label="Add emoji"]` | - |
| スケジュール | `[data-testid="scheduleOption"]` | `[aria-label="Schedule post"]` |
| 位置情報 | `[data-testid="geoButton"]` | `[aria-label="Tag location"]` |

### 2.4 アンケート (Poll) UI

| 要素 | セレクタ | 備考 |
|------|---------|------|
| Pollボタン | `[data-testid="createPollButton"]` | Poll UI 起動 |
| 選択肢1入力 | `input[name="Choice1"]` | 必須 |
| 選択肢2入力 | `input[name="Choice2"]` | 必須 |
| 選択肢3入力 | `input[name="Choice3"]` | 任意（追加後に出現） |
| 選択肢4入力 | `input[name="Choice4"]` | 任意（追加後に出現） |
| 選択肢追加ボタン | `[data-testid="addPollChoice"]` | aria-label="Add a choice" |
| Poll削除ボタン | `[data-testid="removePollButton"]` | Poll UI 削除 |
| 期間: Days | `[data-testid="selectPollDays"]` | select要素 (0-7) |
| 期間: Hours | `[data-testid="selectPollHours"]` | select要素 (0-23) |
| 期間: Minutes | `[data-testid="selectPollMinutes"]` | select要素 (0-59) |

### 2.5 絵文字ピッカー (Emoji) UI

| 要素 | セレクタ | 備考 |
|------|---------|------|
| 絵文字ボタン | `[aria-label="Add emoji"]` | Picker 起動 |
| 検索入力 | `input[placeholder="Search emojis"]` | 絵文字検索 |
| 絵文字ボタン | `button[aria-label="..."]` | 各絵文字（例: "Waving hand"） |

### 2.6 確認・通知

| 要素 | プライマリセレクタ | フォールバック |
|------|-------------------|---------------|
| Toast通知 | `[data-testid="toast"]` | - |
| 投稿アイテム | `[data-testid="tweet"]` | `article[role="article"]` |

---

## 3. 操作フロー

### 3.1 単一投稿

```
1. テキストエリア取得: document.querySelector('[data-testid="tweetTextarea_0"]')
2. テキストエリア有効化: element.click() + element.focus()  ※DOMメソッド
3. テキスト入力: InputEvent + execCommand('insertText')
4. 待機: 300-500ms (React状態反映)
5. 投稿ボタン取得: document.querySelector('[data-testid="tweetButton"]')
6. ボタン有効化待機: disabled === false を確認
7. ボタン実行: button.click()  ※DOMメソッド
```

### 3.2 スレッド投稿

```
1. テキストエリア[0]取得・有効化・入力
2. 待機: 500ms
3. ADDボタン取得: document.querySelector('[data-testid="addButton"]')
4. ADDボタン実行: button.click()  ※DOMメソッド
5. 待機: 500ms (新テキストエリア生成)
6. テキストエリア[1]取得: document.querySelector('[data-testid="tweetTextarea_1"]')
7. テキストエリア[1]有効化・入力
8. (必要に応じて3-7を繰り返し)
9. Post allボタン取得・実行
```

### 3.3 テキスト入力の詳細手順

```javascript
async function activateAndInputText(textArea, text) {
  // 1. DOMのclickメソッドでReact状態を有効化
  textArea.click();  // ※セレクタで取得した要素のDOMメソッド
  await sleep(100);

  // 2. フォーカス
  textArea.focus();
  await sleep(100);

  // 3. InputEventでテキスト入力
  const inputEvent = new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: text
  });
  textArea.dispatchEvent(inputEvent);

  // 4. フォールバック: execCommand
  if (!textArea.textContent.includes(text)) {
    document.execCommand('insertText', false, text);
  }

  // 5. 状態反映待機
  await sleep(300);
}
```

---

## 4. KV データ構造

```json
{
  "version": "2.1.0",
  "updatedAt": "2025-01-10T00:00:00Z",
  "selectors": {
    "composer": {
      "textArea": {
        "primary": "[data-testid=\"tweetTextarea_0\"]",
        "fallback": ["[role=\"textbox\"]"],
        "pattern": "[data-testid=\"tweetTextarea_{index}\"]"
      },
      "addButton": {
        "primary": "[data-testid=\"addButton\"]",
        "fallback": ["[aria-label=\"Add post\"]"]
      },
      "removeButton": {
        "primary": "[aria-label=\"Remove post\"]",
        "fallback": []
      },
      "postButton": {
        "primary": "[data-testid=\"tweetButton\"]",
        "fallback": []
      },
      "postButtonInline": {
        "primary": "[data-testid=\"tweetButtonInline\"]",
        "fallback": []
      }
    },
    "media": {
      "fileInput": {
        "primary": "[data-testid=\"fileInput\"]",
        "fallback": ["input[type=\"file\"]"]
      }
    },
    "poll": {
      "createButton": {
        "primary": "[data-testid=\"createPollButton\"]",
        "fallback": ["[aria-label=\"Add poll\"]"]
      },
      "choiceInputs": {
        "pattern": "input[name=\"Choice{index}\"]",
        "note": "index is 1-based (Choice1, Choice2, Choice3, Choice4)"
      },
      "addChoiceButton": {
        "primary": "[data-testid=\"addPollChoice\"]",
        "fallback": ["[aria-label=\"Add a choice\"]"]
      },
      "removeButton": {
        "primary": "[data-testid=\"removePollButton\"]",
        "fallback": []
      },
      "durationDays": {
        "primary": "[data-testid=\"selectPollDays\"]",
        "fallback": []
      },
      "durationHours": {
        "primary": "[data-testid=\"selectPollHours\"]",
        "fallback": []
      },
      "durationMinutes": {
        "primary": "[data-testid=\"selectPollMinutes\"]",
        "fallback": []
      }
    },
    "emoji": {
      "openButton": {
        "primary": "[aria-label=\"Add emoji\"]",
        "fallback": []
      },
      "searchInput": {
        "primary": "input[placeholder=\"Search emojis\"]",
        "fallback": []
      }
    },
    "confirmation": {
      "toast": {
        "primary": "[data-testid=\"toast\"]",
        "fallback": []
      }
    }
  }
}
```

---

## 5. 重要な注意事項

### 5.1 ADDボタンの出現条件

- テキストエリアにテキストが入力され、**React の内部状態に反映された場合のみ**表示される
- `textContent` を直接設定しただけでは不十分
- `element.click()` → `element.focus()` → `InputEvent` の順序が重要

### 5.2 セレクタ検索の優先順位

1. `data-testid` - 最も安定（X内部テスト用）
2. `aria-label` - アクセシビリティ用で比較的安定
3. `role` 属性 - WAI-ARIA ベース
4. クラス名 - **使用禁止**（ビルドごとに変更される）

### 5.3 禁止事項

- クラス名によるセレクタ
- ハードコードされたタイムアウト値（設定可能にする）

---

## 6. 用語の明確化

| 用語 | 意味 |
|------|------|
| `element.click()` | CSSセレクタで取得したDOM要素の `click()` メソッド呼び出し |
| `document.querySelector(selector)` | CSSセレクタで要素を取得 |
| `element.focus()` | DOM要素にフォーカスを当てる |
| `element.dispatchEvent(event)` | DOM要素にイベントを発火 |

**全ての操作はセレクタで要素を特定してから実行する**

---

## 7. 更新履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2025-01-10 | 2.0.0 | 新規作成。セレクタベース操作を明確化 |
| 2025-01-10 | 2.1.0 | Poll UI、Emoji UI セレクタ追加。KVデータ構造更新 |
