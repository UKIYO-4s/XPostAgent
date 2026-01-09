# XPostAgent Cloudflare Worker

セレクタ管理・セルフヒーリング API

---

## 概要

このWorkerは以下の機能を提供します：

- **セレクタ取得**: Chrome拡張機能にDOMセレクタを提供
- **差分検証**: DOM構造の変更を検知
- **セルフヒーリング**: AI（Llama）による新セレクタ自動生成
- **バージョン管理**: セレクタの履歴管理

---

## セットアップ手順

### 1. 前提条件

- Node.js 18+ インストール済み
- Cloudflare アカウント作成済み

### 2. Wrangler インストール

```bash
npm install -g wrangler
```

### 3. Cloudflare ログイン

```bash
wrangler login
```

ブラウザが開くので、Cloudflareアカウントで認証してください。

### 4. 依存関係インストール

```bash
cd worker
npm install
```

### 5. KV Namespace 作成

```bash
# 本番用
wrangler kv:namespace create "SELECTORS"

# プレビュー用（ローカル開発）
wrangler kv:namespace create "SELECTORS" --preview
```

出力されたIDをメモしてください：
```
⛅️ wrangler
🌀 Creating namespace with title "xpostagent-worker-SELECTORS"
✨ Success!
Add the following to your configuration file:
[[kv_namespaces]]
binding = "SELECTORS"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  ← このID
```

### 6. wrangler.toml 更新

`wrangler.toml` の以下の部分を実際のIDに置き換え：

```toml
[[kv_namespaces]]
binding = "SELECTORS"
id = "YOUR_KV_NAMESPACE_ID"          # ← 本番用ID
preview_id = "YOUR_PREVIEW_KV_ID"    # ← プレビュー用ID
```

### 7. KV 初期データ投入

```bash
npm run kv:init
```

### 8. ローカル開発

```bash
npm run dev
```

http://localhost:8787 でWorkerが起動します。

### 9. デプロイ

```bash
# 開発環境
npm run deploy

# 本番環境
npm run deploy:prod
```

---

## API エンドポイント

### ヘルスチェック

```
GET /api/health
```

レスポンス:
```json
{
  "success": true,
  "status": "healthy",
  "version": "1.0.0",
  "kv": { "connected": true, "currentVersion": "1.0.0" }
}
```

### セレクタ取得

```
POST /api/selectors/get
```

リクエスト:
```json
{
  "action": "composer"  // オプション: 特定カテゴリのみ取得
}
```

レスポンス:
```json
{
  "success": true,
  "version": "1.0.0",
  "selectors": { ... }
}
```

### 差分検証

```
POST /api/selectors/validate
```

リクエスト:
```json
{
  "currentDOM": "<html>...</html>",
  "version": "1.0.0",
  "failedSelectors": ["textArea", "postButton"]
}
```

レスポンス:
```json
{
  "success": true,
  "isValid": false,
  "hasDOMChange": true,
  "needsHealing": true
}
```

### セルフヒーリング

```
POST /api/selectors/heal
```

リクエスト:
```json
{
  "currentDOM": "<html>...</html>",
  "failedSelectors": ["textArea", "postButton"]
}
```

レスポンス:
```json
{
  "success": true,
  "version": "1.0.1",
  "newSelectors": {
    "textArea": { "primary": "...", "fallback": [...] }
  }
}
```

### セレクタ更新（管理用）

```
POST /api/selectors/update
```

リクエスト:
```json
{
  "version": "1.1.0",
  "selectors": { ... },
  "domSnapshot": "<html>...</html>"
}
```

---

## KV 構造

| Key | 説明 |
|-----|------|
| `selectors:current` | 現在有効なセレクタ（JSON） |
| `selectors:v{version}` | バージョン別セレクタ履歴 |
| `selectors:current:version` | 現在のバージョン番号 |
| `dom:baseline` | 基準DOM構造 |
| `dom:hash` | DOMハッシュ値 |

---

## ローカルテスト

```bash
# ヘルスチェック
curl http://localhost:8787/api/health

# セレクタ取得
curl -X POST http://localhost:8787/api/selectors/get \
  -H "Content-Type: application/json" \
  -d '{}'

# 特定カテゴリのみ
curl -X POST http://localhost:8787/api/selectors/get \
  -H "Content-Type: application/json" \
  -d '{"action": "composer"}'
```

---

## トラブルシューティング

### KV が接続できない

1. `wrangler.toml` のIDが正しいか確認
2. `wrangler kv:key list --binding SELECTORS` でアクセス確認

### AI が動作しない

- Cloudflare Workers AI は有料プランまたはFree Tierの制限内で利用可能
- フォールバックセレクタが自動的に使用されます

### ログ確認

```bash
wrangler tail
```

---

## ディレクトリ構造

```
worker/
├── src/
│   └── index.js           # メインWorkerコード
├── scripts/
│   ├── init-kv.js         # KV初期化スクリプト
│   └── initial-selectors.json  # 初期セレクタデータ
├── wrangler.toml          # Wrangler設定
├── package.json
└── README.md
```
