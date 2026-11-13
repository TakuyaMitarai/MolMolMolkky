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
- **同じチームで得点をリセット**: ゲーム終了時のもう一つの続け方。チームとプレイヤーはそのまま、
  ゲーム得点・過去ゲーム結果・累計をすべて 0 に戻し、**順番決め画面から** gameNumber=1 で再開する
  （`resetWithSameTeams`）。終了した対戦は `finishGame` と同様に `gameHistory` へ保存してから
  新しい `GameRecord` に差し替える（`store.restartWithSameTeams`）。投擲の統計レコードは消えない。
- **Undo（進捗順）**: スナップショットではなく、**ゲーム進捗上の最後の投擲**（全チームの中で
  `TurnRecord.seq` が最大＝最新のターン）を1つ取り消す（`undoLastThrow`）。`seq` は投擲ごとの単調増加
  インデックス（古い保存データには無いので timestamp でフォールバック）。Undo は `store.currentGame` 由来の
  ターン履歴から計算するため、**統計画面へ遷移して戻っても消えない**。3ターン前を編集した直後に Undo しても、
  編集ではなく進捗上の直前投擲が戻る。取り消したターンが統計レコード(`throwRecordId`)を持てば連動削除。
- **ターン↔統計の紐付け**: 詳細記録を保存した登録ユーザーの投擲は、`TurnRecord.throwRecordId` で
  対応する `User.throwRecords` のレコードと結び付く。編集時はそのレコードを上書き、Undo時は id 基準で削除し、
  統計レコードを持たない投擲（ゲスト・詳細スキップ）は誤って消さない。
- **投擲編集**: スコアボードの確定済みマスをタップ→編集モーダル（`editTurn`）。
  編集後は全チームを `turnHistory` から再計算し、ライブと**同じルール**で失投3連続＝脱落を判定。
  勝敗（50到達/最後の1チーム）も再評価し、勝ち投げを消せばゲームは未終了に戻る。
  - **登録ユーザー＋記録ありのターン**: 元の投擲記録（投げ方・距離・成功/失敗・得点）を
    **プリフィル表示**し、全項目を編集して統計レコードを**上書き**できる。失投(0)・ガシャの分岐も
    `ThrowDetailsModal` と同様に再現。詳細は `TurnRecord.details` に保持され、スナップショットに
    含まれるため Undo で得点・詳細とも元に戻る。
  - **ゲスト/記録なしのターン**: 得点/失投のみの簡易編集。

## アーキテクチャ

- **Vue 3**（Composition API / `<script setup>`） + **Vite** + **Pinia** + **Vue Router**。
- ルーターは **hash history**（`createWebHashHistory`）。GitHub Pages でリロード時の 404 を回避するため。
- スタイルは **プレーンCSS**。グローバルテーマ `src/assets/styles/theme.css`
  （空色 `--sky` × 白 × 紺 `--navy` の3色。詳細は「レスポンシブ / デザイン」）。

```
src/
  main.js                 エントリ（Pinia/Router/theme.css）
  App.vue                 .app-frame(全画面の空色) > .app-shell(モバイル幅) のレスポンシブ枠
  router/index.js         hash ルーティング
  stores/dataStore.js     DataManager 相当（state + actions、localStorage 自動保存、CSV I/O）
  lib/                    UI から独立した純粋ロジック
    models.js             ファクトリ関数（User/Team/Player/GameRecord/...）と既定投げ方
    gameEngine.js         モルックのルール（純関数。recordScore / resetWithSameTeams など）
    teamLabel.js          チーム表示名（全プレイヤー名を & で連結）
    recommendations.js    スキットル推薦
    csv.js                単一CSV の直列化/パース（RFC4180 風）
    persistence.js        localStorage load/save/clear
  views/                  画面（ルートに対応）
  components/
    AppIcon.vue           線画アイコン集（絵文字は使わない。アイコンはすべてここ）
    PageHeader.vue        各画面共通の上部バー（左に戻る、タイトル）
    BottomSheet.vue       全モーダル共通の下から出るシート（タイトル固定・中身スクロール・フッター固定）
    ConfirmDialog.vue     確認/お知らせダイアログ（ブラウザの confirm()/alert は使わない）
    DistancePicker.vue    距離 4〜12m の1タップ選択
    SkittleFormation.vue  ホームの紋章（スキットル12本の初期配置）
    TeamOrderModal.vue    投げる順番（矢印で入替 / シャッフル演出）
    ThrowDetails / EditTurn / PlayerSelection / Recommendations … 各モーダル
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
   - **インポートはマージ（非破壊）**: `mergeUsers` がユーザー名で突き合わせ、投擲記録は
     `recordKey`（日時＋投げ方＋距離＋得点＋成否＋メモ）で重複判定して新規分のみ追加。
     CSVに無い既存ユーザーは保持。上書きが必要なら `replaceFromCsv` を使う。

### CSV 仕様（範囲＝ユーザー＋投擲記録）
ヘッダー: `name,registrationDate,recordDate,throwTypeName,distance,score,isSuccessful,notes`
- 1行＝1投擲記録。
- 投擲ゼロの登録ユーザーは `recordDate` 以降が空の「ユーザーのみ行」で1行出力し、復元時も保持。
- 日付は ISO 8601。カンマ/引用符/改行は RFC4180 風にクォートエスケープ。
- `gameHistory` とカスタム投げ方は CSV 対象外（localStorage のみ）。

## レスポンシブ / デザイン

### 色（3色のみ）
- ベースは **空色 `#8ECAE6`（`--sky`）・白 `#FFFFFF`・紺 `#1D3557`（`--navy`）** の3色。
  それ以外の値（`--sky-50〜300`、`--ink-2`、`--line` など）はすべてこの3色を白と混ぜた濃淡で、
  `theme.css` の先頭に定義している。**新しい色相（赤・黄・緑など）は足さない。**
- 状態は色ではなく **形・塗り・言葉** で表す: 失投は得点板で `×`、失投回数は塗りつぶした丸、
  脱落は「脱落」タグと取り消し線、勝者はトロフィーのアイコンと「勝ち」タグ。
- コントラスト: 紺×白 12.5:1、紺×空色 6.9:1。**空色の上に白文字は置かない**（1.8:1）。

### 文字・アイコン
- 英数字は同梱フォント **Jost**（`@fontsource-variable/jost`、外部通信なし）、日本語は端末のゴシック。
- **絵文字は使わない。** アイコンは `AppIcon.vue` の線画に追加して使う。

### レイアウト
- スマホ最優先。`.app-shell`（`max-width:430px`）を中央寄せし、PC では空色の背景の上に同じ幅で表示。
- 各画面は `.page`（上部固定 → `.page-body` がスクロール → 下部固定）。`.app-shell` 自体はスクロールしない。
- セーフエリア（`env(safe-area-inset-*)`）は各画面の上下バーが自分で余白を取る。`100dvh` 対応。
- 対戦画面は **「投げる人」を上に、得点キーとメニューを下に固定**（`.game-top` / `.dock` / `.actions`）。
  チーム数が多いときや背の低い画面では間（累計カードと得点板）だけがスクロールし、次に投げるチームの
  カードと行が見えるよう自動で送る（`followCurrentTeam`）。
- 得点キーは **スキットルの初期配置**（7 9 8 / 5 11 12 6 / 3 10 4 / 1 2、ホームの紋章と同じ）で並べる
  （`.rack`。半キー幅の列で各段をずらす）。投擲詳細スイッチと失投ボタンは最前列の左右に置く。
- 累計カードは **このゲームの得点を大きく**、累計を下の小さな枠に出す。
- 得点板は横スクロール。次に入力するマスが見えるよう自動で送る（`scrollBoardToCurrent`）。
- モーダルは `BottomSheet`、確認は `ConfirmDialog` に統一。
- 動きは「操作への返事」に限る。唯一の演出は **順番シャッフル**（カードを裏返して束ね、
  数回切ってから番号の枠へ配って表に返す）。結果は演出の前に Fisher–Yates で確定している。
  `prefers-reduced-motion` では演出を省いて結果だけ反映する。

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
- UI は `theme.css` の共通クラス（`.btn` `.chip` `.seg` `.pin-key` `.card` `.field` など）を使い、
  画面ごとの `<style scoped>` には固有のレイアウトだけを書く。色は必ず CSS 変数で指定する。
- 日付は ISO 文字列、ID は `crypto.randomUUID()`。
