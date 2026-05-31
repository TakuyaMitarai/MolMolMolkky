# CLAUDE.md

このリポジトリで作業する際のガイド。**Super Mölkky** — SwiftUI 製モルックアプリ
（`../superMolkky`）を Vue に移植し、GitHub Pages で運用する Web アプリ。

## アプリ概要

モルック（Mölkky）の対戦スコア記録 ＆ 個人成績の統計アプリ。複数チーム・複数プレイヤーで
対戦し、各投擲を記録して投げ方別の統計を可視化する。

### モルックのルール（ゲームロジックの基準）
- 目標 **50 点**。1投で 1〜12 点、または失投(0)。
- 加点で **50 超過 → 25 点に戻る**。**ちょうど 50 で勝利**。
- **失投3連続でそのチームは脱落**（現ゲーム得点0・脱落フラグ）。
- 残り1チームになればそのチームの勝利。
- 50到達時の勝者は **cumulativeScore（過去ゲーム合計＋現ゲーム）が最大のアクティブチーム**。
- チーム内は全チーム一巡ごとに「最後に投げてからのターン数が最大」のプレイヤーを自動選択（手動切替も可）。
- ちょうど50で勝利した投擲も `turnHistory` に記録され、スコアボードに表示される。
- 連戦: ゲーム終了 → チーム順序を再設定 → 次ゲーム（gameNumber++、累計は保持）。
- **Undo**: チーム切替（=1投の確定境界）ごとにスナップショットを保存し、1投ずつ戻す。
  戻した投擲が登録ユーザーのものなら投擲記録も連動削除。
- **投擲編集**: スコアボードの確定済みマスをタップすると編集モーダルが開き、得点/失投を修正できる
  （`editTurn`）。編集後は全チームを `turnHistory` から再計算し、ライブと**同じルール**で
  失投3連続＝脱落を判定。勝敗（50到達/最後の1チーム）も再評価し、勝ち投げを消せばゲームは未終了に戻る。
  編集は履歴を書き換えるため、Undo スタックは編集後の状態からやり直す（編集をまたいだ Undo は不可）。
  なお投擲編集はゲーム内スコアのみを対象とし、統計用の投擲記録は変更しない（そちらは投擲記録画面で削除）。

## アーキテクチャ

- **Vue 3**（Composition API / `<script setup>`） + **Vite** + **Pinia** + **Vue Router**。
- ルーターは **hash history**（`createWebHashHistory`）。GitHub Pages でリロード時の 404 を回避するため。
- スタイルは **プレーンCSS**。グローバルテーマ `src/assets/styles/theme.css`（紺 `--navy` × 白）。

```
src/
  main.js                 エントリ（Pinia/Router/theme.css）
  App.vue                 .app-frame(全画面紺) > .app-shell(モバイル幅) のレスポンシブ枠
  router/index.js         hash ルーティング
  stores/dataStore.js     DataManager 相当（state + actions、localStorage 自動保存、CSV I/O）
  lib/                    UI から独立した純粋ロジック
    models.js             ファクトリ関数（User/Team/Player/GameRecord/...）と既定投げ方
    gameEngine.js         モルックのルール（純関数。recordScore など）
    recommendations.js    スキットル推薦
    csv.js                単一CSV の直列化/パース（RFC4180 風）
    persistence.js        localStorage load/save/clear
  views/                  画面（ルートに対応）
  components/             モーダル（ThrowDetails/Recommendations/PlayerSelection/TeamOrder）
```

### 元 Swift ファイル → Vue 対応表
| Swift | Vue |
|---|---|
| DataManager.swift | `stores/dataStore.js` ＋ `lib/*.js` |
| ContentView.swift | `views/HomeView.vue` |
| UserRegistrationView.swift | `views/UserRegistrationView.vue` |
| GameSetupView.swift | `views/GameSetupView.vue` |
| TeamOrderSelectionView.swift | `components/TeamOrderModal.vue` |
| GameView.swift | `views/GameView.vue` ＋ `components/PlayerSelectionModal.vue` |
| ThrowDetailsView.swift | `components/ThrowDetailsModal.vue` |
| RecommendationsView.swift | `components/RecommendationsModal.vue` |
| StatisticsView.swift | `views/StatisticsView.vue` |
| ThrowTypeManagementView.swift | `views/ThrowTypeManagementView.vue` |
| ThrowRecordingView.swift | `views/ThrowRecordingView.vue` |

## 永続化モデル（重要）

Swift は端末の Documents に JSON 保存していたが、GitHub Pages にはファイルシステムが無い。
2層で代替する:

1. **localStorage（自動保存）** — `persistence.js`。users / currentGame / gameHistory /
   throwTypes をキー `molmolmolkky:v1` に保存。リロードしても状態を失わない透過的キャッシュ。
   store の各 mutating action が `persist()` を呼ぶ。
2. **単一CSV（明示的・可搬）** — `csv.js`。ホーム画面の「エクスポート/インポート」。
   端末/ブラウザをまたいで戦績を持ち運ぶための公式手段。

### CSV 仕様（範囲＝ユーザー＋投擲記録）
ヘッダー: `name,registrationDate,recordDate,throwTypeName,distance,score,isSuccessful,notes`
- 1行＝1投擲記録。
- 投擲ゼロの登録ユーザーは `recordDate` 以降が空の「ユーザーのみ行」で1行出力し、復元時も保持。
- 日付は ISO 8601。カンマ/引用符/改行は RFC4180 風にクォートエスケープ。
- `gameHistory` とカスタム投げ方は CSV 対象外（localStorage のみ）。

## レスポンシブ / デザイン

- スマホ最優先。`.app-shell`（`max-width:430px`）を中央寄せし、PC では疑似端末フレームとして
  同じ見た目を維持。背景の紺グラデは全画面。
- セーフエリア（`env(safe-area-inset-*)`）・`100dvh`・viewport `viewport-fit=cover` 対応。
- ボタンは `:active { transform: scale(.95) }` で SwiftUI の押下感を再現。
- スコアボード等の横長要素は `.scroll-x` で横スクロール。

## 開発コマンド

```bash
npm install      # 依存インストール
npm run dev      # 開発サーバ（Vite）
npm run build    # 本番ビルド → dist/
npm run preview  # ビルド成果物のプレビュー
npm run test     # Vitest（gameEngine / csv のユニットテスト）
```

## デプロイ（GitHub Pages）

- `.github/workflows/deploy.yml` が `main` への push で `npm ci && npm run build` し、
  `dist` を GitHub Pages（公式 Pages Actions）へ公開。
- リポジトリ設定 → Pages → Source を **GitHub Actions** にする。
- 公開 URL: `https://<user>.github.io/MolMolMolkky/`。
- **注意**: `vite.config.js` の `base` は **リポジトリ名と一致**させること
  （現在 `/MolMolMolkky/`）。リネーム時は要更新。

## コーディング規約

- Vue は `<script setup>` + Composition API。
- ゲームのルールや CSV など**ロジックは `lib/` に純関数**で置き、UI（views/components）から分離する。
  新しいルール変更はまず `lib/gameEngine.js` に入れ、必要なら `__tests__` にテストを追加。
- 状態は Pinia store 経由でのみ更新し、変更後は `persist()` で localStorage 同期。
- 日付は ISO 文字列、ID は `crypto.randomUUID()`。
