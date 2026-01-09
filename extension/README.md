# XPostAgent Chrome 拡張機能

X (Twitter) への投稿を自動化する Chrome 拡張機能

## インストール方法（開発版）

### 1. アイコンを準備

`icons/` フォルダに以下のファイルを配置してください：
- `icon16.png` (16x16px)
- `icon48.png` (48x48px)
- `icon128.png` (128x128px)

仮のアイコンは https://favicon.io/ で生成できます。

### 2. Chrome に読み込み

1. Chrome で `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」をONにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `extension` フォルダを選択

### 3. 使用方法

1. X (https://x.com) にログイン
2. ツールバーの XPostAgent アイコンをクリック
3. テキストを入力して「投稿する」をクリック

## ファイル構成

```
extension/
├── manifest.json          # 拡張機能マニフェスト
├── popup/
│   ├── popup.html         # ポップアップUI
│   ├── popup.css          # スタイル
│   └── popup.js           # UIロジック
├── background/
│   └── service-worker.js  # バックグラウンド処理
├── content/
│   └── content.js         # X上でのDOM操作
├── lib/
│   ├── logger.js          # ログユーティリティ
│   ├── api.js             # Cloudflare Worker通信
│   └── selectors.js       # セレクタ管理
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 機能

### Phase 1（実装済み）
- [x] テキスト投稿
- [x] 文字数カウント
- [x] Worker接続確認
- [x] 基本的なエラーハンドリング

### Phase 2（未実装）
- [ ] 画像添付
- [ ] GIF添付
- [ ] アンケート
- [ ] 絵文字
- [ ] 予約投稿
- [ ] ツリー投稿

## デバッグ

### ログ確認

1. **Popup**: 右クリック → 検証 → Console
2. **Background**: `chrome://extensions/` → XPostAgent → 「Service Worker」をクリック
3. **Content Script**: X のページで F12 → Console

### フィルタ

コンソールで `[XPostAgent]` でフィルタすると関連ログのみ表示されます。

## トラブルシューティング

### 「Workerに接続できません」

- インターネット接続を確認
- https://xpostagent-worker.menu-simulator.workers.dev/api/health にアクセスして確認

### 「テキストエリアが見つかりません」

- X にログインしているか確認
- ページをリロードして再試行
- セルフヒーリング機能が自動で修復を試みます

### 投稿が完了しない

- X の画面で手動投稿が可能か確認
- Content Script のログを確認
