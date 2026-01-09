# XPostAgent ドキュメント一覧

**最終更新**: 2025-01-10
**プロジェクトステータス**: 全機能実装完了

---

## プロジェクト概要

**XPostAgent** は、Chrome 拡張機能を通じて X（旧 Twitter）への投稿を自動化するシステムです。
Cloudflare 上のセルフヒーリング機能により、X の DOM 構造変更にも自動対応します。

---

## 実装済み機能一覧

| ID | 機能 | 説明 | ステータス |
|----|------|------|-----------|
| F-001 | テキスト投稿 | 280文字以内のテキスト投稿 | ✅ 完了 |
| F-002 | 公開範囲設定 | 返信可能ユーザーの制限 | ✅ 完了 |
| F-003 | 画像添付 | 最大4枚の画像添付 | ✅ 完了 |
| F-006 | アンケート作成 | 2-4選択肢、期間設定付き | ✅ 完了 |
| F-007 | 絵文字挿入 | ピッカーから絵文字選択 | ✅ 完了 |
| F-011 | ツリー投稿 | 複数ツイートのスレッド投稿 | ✅ 完了 |
| F-012 | 投稿完了確認 | Toast通知による完了検知 | ✅ 完了 |

---

## システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  Popup   │  │  Background  │  │    Content Script     │  │
│  │  (UI)    │──│   (SW)       │──│  (DOM操作)            │  │
│  └──────────┘  └──────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 Cloudflare Worker                            │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │   API Endpoints  │  │        Self-Healing Engine       │ │
│  │  /api/selectors  │  │  (AI による DOM 解析・修復)      │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│              ┌──────────────────┐                           │
│              │   Cloudflare KV  │                           │
│              │  (セレクタ保存)   │                           │
│              └──────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

---

## ドキュメント構成

```
docs/
├── README.md              # 本ファイル（プロジェクト概要）
├── requirements.md        # 要件定義書 v1.1.0
├── architecture.md        # アーキテクチャ設計書
├── functional-spec.md     # 機能仕様書
├── dom-selectors.md       # DOM セレクタ仕様書 v2.1.0
├── LESSONS_LEARNED.md     # 実装ノート・注意事項
├── CONSISTENCY_REPORT.md  # 仕様・実装 整合性レポート
├── TEST_RESULTS.md        # 機能テスト結果
└── archive/               # 旧バージョンドキュメント
```

---

## ドキュメント一覧

| ドキュメント | ファイル | バージョン | 説明 |
|-------------|----------|-----------|------|
| 要件定義書 | [requirements.md](./requirements.md) | v1.1.0 | 機能要件、非機能要件 |
| アーキテクチャ設計書 | [architecture.md](./architecture.md) | - | システム構成、データフロー |
| 機能仕様書 | [functional-spec.md](./functional-spec.md) | - | 各機能の詳細仕様 |
| セレクタ仕様書 | [dom-selectors.md](./dom-selectors.md) | v2.1.0 | DOM セレクタ、KV構造 |
| 実装ノート | [LESSONS_LEARNED.md](./LESSONS_LEARNED.md) | - | ベストプラクティス |
| テスト結果 | [TEST_RESULTS.md](./TEST_RESULTS.md) | - | 機能テスト結果 |

---

## DOM セレクタ (v2.1.0)

### 投稿コンポーザー

| 要素 | セレクタ |
|------|---------|
| テキストエリア | `[data-testid="tweetTextarea_0"]` |
| 投稿ボタン | `[data-testid="tweetButton"]` |
| スレッド追加 | `[data-testid="addButton"]` |

### アンケート (Poll)

| 要素 | セレクタ |
|------|---------|
| Pollボタン | `[data-testid="createPollButton"]` |
| 選択肢入力 | `input[name="Choice1"]` 〜 `Choice4` |
| 選択肢追加 | `[data-testid="addPollChoice"]` |
| Poll削除 | `[data-testid="removePollButton"]` |
| Days | `[data-testid="selectPollDays"]` |
| Hours | `[data-testid="selectPollHours"]` |
| Minutes | `[data-testid="selectPollMinutes"]` |

### 絵文字ピッカー

| 要素 | セレクタ |
|------|---------|
| 絵文字ボタン | `[aria-label="Add emoji"]` |
| 検索入力 | `input[placeholder="Search emojis"]` |

---

## デプロイ情報

| 項目 | 値 |
|------|-----|
| Worker URL | https://xpostagent-worker.menu-simulator.workers.dev |
| KV Namespace | `47f7b0893343475db560e3a1dbcfc7b0` |
| KV Version | v2.1.0 |

---

## ファイル構成

```
XPostAgent/
├── docs/                          # ドキュメント
│   ├── README.md                  # プロジェクト概要
│   ├── requirements.md            # 要件定義書
│   ├── architecture.md            # アーキテクチャ設計書
│   ├── functional-spec.md         # 機能仕様書
│   ├── dom-selectors.md           # セレクタ仕様書
│   ├── LESSONS_LEARNED.md         # 実装ノート
│   ├── CONSISTENCY_REPORT.md      # 整合性レポート
│   └── TEST_RESULTS.md            # テスト結果
├── extension/                     # Chrome 拡張機能
│   ├── manifest.json              # 拡張機能マニフェスト
│   ├── popup/
│   │   ├── popup.html             # ポップアップUI
│   │   ├── popup.css              # スタイル
│   │   └── popup.js               # UIロジック
│   ├── background/
│   │   └── service-worker.js      # バックグラウンド処理
│   ├── content/
│   │   └── content.js             # DOM操作
│   ├── lib/
│   │   ├── api.js                 # Worker API クライアント
│   │   └── logger.js              # ログユーティリティ
│   └── icons/                     # 拡張機能アイコン
├── worker/                        # Cloudflare Worker
│   ├── src/
│   │   └── index.js               # Worker エントリポイント
│   ├── wrangler.toml              # Wrangler 設定
│   └── package.json
└── README.md                      # プロジェクト README
```

---

## 開発フェーズ

| Phase | 内容 | ステータス |
|-------|------|-----------|
| Phase 0 | 設計・仕様策定 | ✅ 完了 |
| Phase 1 | 基本投稿機能 (F-001, F-012) | ✅ 完了 |
| Phase 2 | 拡張機能 (F-002, F-003, F-006, F-007, F-011) | ✅ 完了 |
| Phase 3 | Cloudflare Worker、セルフヒーリング | ✅ 完了 |
| Phase 4 | テスト、ドキュメント整備 | ✅ 完了 |

---

## テストアカウント

| 項目 | 値 |
|------|-----|
| URL | https://x.com/UKi_yo4 |
| 用途 | 開発・テスト専用 |

---

## 更新履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-01-09 | 初版作成（全ドキュメント） |
| 2025-01-09 | Cloudflare Worker デプロイ完了 |
| 2025-01-09 | Chrome 拡張機能 Phase 1 実装完了 |
| 2025-01-10 | dom-selectors.md v2.0.0 作成 |
| 2025-01-10 | F-001〜F-004 機能テスト完了 |
| 2025-01-10 | F-006 アンケート機能、F-007 絵文字機能 実装完了 |
| 2025-01-10 | dom-selectors.md v2.1.0 (Poll/Emoji セレクタ追加) |
| 2025-01-10 | requirements.md v1.1.0 (不要機能削除、全機能完了) |
