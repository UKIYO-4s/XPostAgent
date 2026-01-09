# XPostAgent ドキュメント一覧

**最終更新**: 2025-01-09
**プロジェクトステータス**: 設計完了 → 実装準備

---

## プロジェクト概要

**XPostAgent** は、Chrome 拡張機能を通じて X（旧 Twitter）への投稿を自動化するシステムです。
Cloudflare 上のセルフヒーリング機能により、X の DOM 構造変更にも自動対応します。

---

## ドキュメント構成

```
docs/
├── README.md              # 本ファイル（ドキュメント一覧）
├── requirements.md        # 要件定義書
├── architecture.md        # アーキテクチャ設計書
├── functional-spec.md     # 機能仕様書
└── selectors.md           # DOM セレクタ定義書
```

---

## ドキュメント一覧

| ドキュメント | ファイル | 説明 | ステータス |
|-------------|----------|------|-----------|
| 要件定義書 | [requirements.md](./requirements.md) | プロジェクト目的、機能要件、非機能要件 | 完了 |
| アーキテクチャ設計書 | [architecture.md](./architecture.md) | システム構成、データフロー、技術スタック | 完了 |
| 機能仕様書 | [functional-spec.md](./functional-spec.md) | 各機能の詳細仕様、処理フロー | 完了 |
| セレクタ定義書 | [selectors.md](./selectors.md) | X の DOM セレクタ一覧、取得方法 | 完了 |

---

## 各ドキュメントの内容

### 1. 要件定義書 (requirements.md)

- プロジェクト概要・目的
- スコープ（対象範囲・対象外）
- 機能要件一覧（優先度・フェーズ付き）
- 非機能要件（パフォーマンス、セキュリティ等）
- 制約条件・前提条件
- テストアカウント情報
- 実行フロー概要

### 2. アーキテクチャ設計書 (architecture.md)

- システム構成図
- コンポーネント詳細
  - Chrome 拡張機能（Popup, Background, Content Script）
  - Cloudflare Worker
  - Cloudflare KV
  - Cloudflare AI
- API エンドポイント設計
- データフロー図
- セルフヒーリングロジック
- ロギング戦略
- セキュリティ考慮事項
- 開発フェーズ計画

### 3. 機能仕様書 (functional-spec.md)

- 投稿機能詳細（12機能）
  - テキスト投稿
  - 公開範囲設定
  - メディア添付（画像・動画・GIF）
  - オプション（アンケート、絵文字、スケジュール等）
  - ツリー投稿
  - 投稿完了確認
- セルフヒーリング機能詳細（5機能）
- UI 仕様・レイアウト
- エラーケース一覧

### 4. セレクタ定義書 (selectors.md)

- DOM セレクタ一覧（7カテゴリ）
  - 投稿コンポーザー
  - メディア・添付
  - 投稿オプション
  - モーダル専用
  - ナビゲーション
  - 投稿完了検知
  - インタラクション
- JSON 形式セレクタ定義（KV 保存用）
- ヘルパー関数
- 注意事項（Draft.js、ファイルアップロード等）

---

## 開発フェーズ

| Phase | 内容 | ステータス |
|-------|------|-----------|
| Phase 0 | 設計・仕様策定 | **完了** |
| Phase 1 | Chrome 拡張機能の骨格、基本投稿機能 | 未着手 |
| Phase 2 | メディア添付、公開範囲、ツリー投稿 | 未着手 |
| Phase 3 | Cloudflare Worker、セルフヒーリング | 未着手 |
| Phase 4 | テスト、安定化、ドキュメント整備 | 未着手 |

---

## テストアカウント

| 項目 | 値 |
|------|-----|
| URL | https://x.com/UKi_yo4 |
| 用途 | 開発・テスト専用 |

---

## ファイル構成（予定）

```
XPostAgent/
├── docs/                          # ドキュメント
│   ├── README.md
│   ├── requirements.md
│   ├── architecture.md
│   ├── functional-spec.md
│   └── selectors.md
├── extension/                     # Chrome 拡張機能
│   ├── manifest.json
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── background/
│   │   └── service-worker.js
│   ├── content/
│   │   └── content.js
│   ├── lib/
│   │   ├── api.js
│   │   ├── logger.js
│   │   └── selectors.js
│   └── icons/
├── worker/                        # Cloudflare Worker
│   ├── src/
│   │   └── index.js
│   ├── wrangler.toml
│   └── package.json
├── siyou.ini                      # 元仕様（参照用）
├── test-account.md                # テストアカウント情報
└── README.md                      # プロジェクト README
```

---

## 注意事項

- 仕様変更時は該当ドキュメントを更新し、更新履歴に記録すること
- 完全に不要になったファイルは `archive/` フォルダに移動
- 実装前に必ず計画を立て、計画完了後に実装を開始

---

## 更新履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-01-09 | 初版作成（全ドキュメント） |
