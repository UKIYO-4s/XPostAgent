# XPostAgent 実装ノート・注意事項

**作成日**: 2025-01-09
**対象フェーズ**: Phase 0〜2（設計・Cloudflareデプロイまで）

---

## 1. 発生した問題と解決策

### 1.1 node_modules が Git に含まれそうになった

**問題**:
`npm install` 後に `git add -A` を実行したところ、`node_modules/` が大量にステージされた。

**原因**:
`.gitignore` を事前に作成していなかった。

**解決策**:
```bash
# .gitignore を作成
echo "node_modules/" > worker/.gitignore

# ステージを解除して再追加
git reset HEAD
git add -A
```

**教訓**:
- `npm install` の**前に** `.gitignore` を作成すること
- プロジェクト初期化時に必ず `.gitignore` を用意する

**推奨 .gitignore（worker用）**:
```
node_modules/
.wrangler/
.dev.vars
*.log
dist/
```

---

### 1.2 Wrangler バージョン警告

**問題**:
全てのwranglerコマンドで以下の警告が表示された：
```
▲ [WARNING] The version of Wrangler you are using is now out-of-date.
  Run `npm install --save-dev wrangler@4` to update to the latest version.
```

**原因**:
`package.json` で `wrangler: "^3.0.0"` を指定していたため、古いバージョンがインストールされた。

**解決策**:
```bash
npm install --save-dev wrangler@latest
```

**教訓**:
- `package.json` では最新バージョンを指定する
- 定期的に `npm outdated` でバージョン確認

**推奨 package.json**:
```json
{
  "devDependencies": {
    "wrangler": "^4.0.0"
  }
}
```

---

### 1.3 KV Namespace ID の手動設定

**問題**:
`wrangler kv:namespace create` で作成したIDを手動で `wrangler.toml` に設定する必要があった。

**原因**:
Wranglerは自動でtomlを更新しないため、出力されたIDを手動でコピー＆ペーストする必要がある。

**解決策**:
作成コマンドの出力を注意深く確認してIDをコピー：
```bash
wrangler kv:namespace create "SELECTORS"
# 出力例:
# id = "47f7b0893343475db560e3a1dbcfc7b0"  ← このIDをコピー
```

**教訓**:
- KV作成直後にIDをメモまたはコピーしておく
- スクリプト化する場合は出力をパースして自動設定も可能

---

### 1.4 curl コマンドの改行問題

**問題**:
複数行のcurlコマンドでエラーが発生：
```bash
curl -s -X POST https://... \
  -H "Content-Type: application/json" \
  -d '{}'
# エラー: curl: option : blank argument where content is expected
```

**原因**:
シェル環境によってはバックスラッシュでの改行が正しく解釈されない。

**解決策**:
1行で書く：
```bash
curl -s -X POST https://... -H "Content-Type: application/json" -d '{}'
```

**教訓**:
- CI/CDやスクリプトでは1行で書くか、ヒアドキュメントを使用
- ターミナル上での複数行コマンドは環境依存に注意

---

### 1.5 ファイル配置ミス

**問題**:
`siyou.ini` と `test-account.md` がルートから `docs/` フォルダに移動してしまった。

**原因**:
ディレクトリ構造を確認せずにファイル作成・移動を行った。

**解決策**:
```bash
mv docs/siyou.ini ./
mv docs/test-account.md ./
```

**教訓**:
- ファイル操作前に `ls` で現在の構造を確認
- 元ファイルと新規ファイルの配置を明確に区別

---

## 2. スムーズに進めるためのベストプラクティス

### 2.1 プロジェクト初期化の推奨順序

```bash
# 1. ディレクトリ構造を先に作成
mkdir -p docs worker/src worker/scripts extension

# 2. .gitignore を最初に作成
cat > .gitignore << 'EOF'
node_modules/
.wrangler/
.dev.vars
*.log
dist/
.DS_Store
EOF

cat > worker/.gitignore << 'EOF'
node_modules/
.wrangler/
.dev.vars
*.log
EOF

# 3. Git 初期化
git init
git add .gitignore
git commit -m "Initial commit: .gitignore"

# 4. その他のファイルを作成
```

### 2.2 Cloudflare Worker デプロイチェックリスト

| # | 確認項目 | コマンド |
|---|---------|---------|
| 1 | Wrangler ログイン確認 | `npx wrangler whoami` |
| 2 | .gitignore 存在確認 | `cat worker/.gitignore` |
| 3 | npm install 実行 | `cd worker && npm install` |
| 4 | KV Namespace 作成 | `npx wrangler kv:namespace create "NAME"` |
| 5 | wrangler.toml ID更新 | 手動編集 |
| 6 | ローカルテスト | `npm run dev` |
| 7 | デプロイ | `npm run deploy` |
| 8 | ヘルスチェック | `curl <URL>/api/health` |
| 9 | KV 初期データ投入 | `npx wrangler kv:key put ...` |
| 10 | Git コミット＆プッシュ | `git add -A && git commit && git push` |

### 2.3 デバッグ時の便利コマンド

```bash
# Worker ログをリアルタイム監視
npx wrangler tail

# KV のキー一覧を確認
npx wrangler kv:key list --binding SELECTORS

# 特定のキーの値を取得
npx wrangler kv:key get --binding SELECTORS "selectors:current:version"

# ローカル開発（ホットリロード）
npm run dev
```

---

## 3. 環境情報

### 3.1 デプロイ済み環境

| 項目 | 値 |
|------|-----|
| Worker URL | https://xpostagent-worker.menu-simulator.workers.dev |
| KV Namespace ID | `47f7b0893343475db560e3a1dbcfc7b0` |
| KV Namespace Name | `xpostagent-worker-SELECTORS` |
| Cloudflare Account | shoeigoto.sd@gmail.com |

### 3.2 ローカル開発環境

| 項目 | 値 |
|------|-----|
| Node.js | 18+ 推奨 |
| Wrangler | 4.x 推奨 |
| ローカルURL | http://localhost:8787 |

---

## 4. 今後の注意事項

### 4.1 セキュリティ

- `wrangler.toml` にシークレットを書かない
- API キーは `wrangler secret put` で設定
- KV Namespace ID は公開しても問題ないが、不要な露出は避ける

### 4.2 バージョン管理

- セレクタ更新時は必ずバージョンを上げる
- `selectors:v{version}` で履歴を保持
- 重大な変更時はメジャーバージョンを上げる

### 4.3 デプロイ

- 本番デプロイ前にローカルで十分テスト
- `npm run deploy:prod` で本番環境にデプロイ
- デプロイ後は必ずヘルスチェックを確認

---

## 5. 関連リソース

- [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)
- [Wrangler CLI リファレンス](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare KV ドキュメント](https://developers.cloudflare.com/kv/)
- [Cloudflare AI ドキュメント](https://developers.cloudflare.com/workers-ai/)

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-01-09 | 初版作成（Phase 0〜2 完了時点） |
