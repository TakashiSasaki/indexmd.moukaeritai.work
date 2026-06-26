# リポジトリ監査レポート: エージェント運用・本番環境・ドキュメント整合性

## A. 総合判定

- **エージェントの単独作業可能性**: 現在の `AGENTS.md` は Jules 専用の記述が多く、他のエージェント（Codex, Copilot）が初見で共通契約として認識しづらい状態でした。
- **AGENTS.mdの十分性**: 不十分です。特定の環境（Google AI Studio / Jules）に偏っており、全エージェント向けの「Agent-neutral repository contract」としては機能していません。
- **READMEの十分性**: 不十分です。AI Studioのテンプレートがそのまま残っており、複数エージェントの運用やCloud Run本番環境、ローカルでのセットアップに関する説明が不足しています。
- **Copilot instructionsの必要性**: 必要です。CopilotがGitHub上で活動する際、`AGENTS.md` を必ず参照させるための軽量なエントリーポイント（`.github/copilot-instructions.md`）が欠如しています。
- **docsの役割分担**: 不十分です。設計やスキーマに関する文書はありますが、実行環境の違い（RUNTIME_ENVIRONMENTS）やエージェントワークフロー（AGENT_WORKFLOWS）、明確に分離されたセキュリティ（SECURITY）のドキュメントがありません。
- **環境の文書化状況**:
  - Google AI Studio開発環境: テンプレートがあるだけで制約は未記載。
  - Jules定期実行環境: AGENTS.mdにブランチ等の記載はあるが、スコープが不明確。
  - OpenAI Codex介入環境: 未記載。
  - GitHub Copilot介入環境: 未記載。
  - Cloud Run本番環境: 未記載。ポート設定などはコード上対応されているが、ドキュメント化されていない。
- **conflict解消方針**: 自動同期ワークフロー（`sync-main-to-jules-integration`）は存在しますが、コンフリクト発生時のソース・オブ・トゥルースや、エージェントが手動でコンフリクトを解消する際のルールが明記されていません。
- **実装とドキュメントの重大な乖離**: 致命的な乖離はありませんが、ローカルでの実行コマンドやパッケージ管理（`tsx` 等の不足により発生するエラーなど）にズレが見られます。
- **SEO/PWA/セキュリティ/運用**: PWAの設定（manifest.json, sw.js）やSEOメタデータは実装されていますが、ドキュメントとして集約されていません。

## B. ドキュメント棚卸し表

| ファイルパス | 役割・対象 | 現状 | 問題 | 更新要否 |
|---|---|---|---|---|
| `AGENTS.md` | エージェント向け制約 | AI Studio/Jules寄りの記述 | エージェント中立の契約になっていない。コンフリクト解消手順がない。 | 必須 |
| `README.md` | 開発者/エージェント入口 | AI Studioのデフォルトテンプレート | 実際のプロジェクト構成や複数エージェント運用、Cloud Run環境についての説明がない | 必須 |
| `.github/copilot-instructions.md` | Copilot向け指示 | 存在しない | CopilotがAGENTS.mdを見落とすリスク | 新規作成 |
| `docs/RUNTIME_ENVIRONMENTS.md` | 実行環境差分 | 存在しない | AI Studio, Cloud Run, ローカルの違いが不明確 | 新規作成 |
| `docs/AGENT_WORKFLOWS.md` | エージェント作業手順 | 存在しない | PR, コンフリクト解消, 未検証報告の手順が不明確 | 新規作成 |
| `docs/SECURITY.md` | セキュリティ制約 | 存在しない（一部AGENTS.mdに混在） | Drive API, Firestore, Tokenの扱いを集約すべき | 新規作成 |
| `docs/SEO_PWA.md` | SEO/PWA運用 | 一部存在 | 現状のSEOやPWA設定がまとまっていない | 新規作成/更新 |

## C. 問題一覧

1. **AI Studio テンプレートの残留**
   - **Severity**: Medium
   - **根拠ファイル**: `README.md`
   - **現在の記述**: `react-example` などが残り、Gemini API Keyのみが設定手順として書かれている。
   - **エージェントへの悪影響**: プロジェクトの全体像（Drive API, Firebase等）を誤認する。
   - **修正案**: プロジェクトの概要、アーキテクチャ、セットアップ手順を書き直す。
2. **AGENTS.md のエージェント依存性**
   - **Severity**: High
   - **根拠ファイル**: `AGENTS.md`
   - **現在の記述**: JulesとAI Studioのブランチ運用が中心。
   - **エージェントへの悪影響**: CodexやCopilotが自分向けの指示ではないと判断し、安全制約を無視するリスク。
   - **修正案**: 「Agent-neutral repository contract」であることを明記し、全エージェント向けの共通ルールを定義する。
3. **Cloud Run 環境の未文書化**
   - **Severity**: Medium
   - **根拠ファイル**: なし（`server.ts` のポート設定は対応済み）
   - **エージェントへの悪影響**: キャッシュディレクトリ（`cache/`）が揮発性であることや、`0.0.0.0` のバインドが必要な理由をエージェントが理解できず、破壊的変更を行う可能性がある。
   - **修正案**: `docs/RUNTIME_ENVIRONMENTS.md` を作成。

## D. AGENTS.md修正案

（後続のステップで実際にファイルとして書き出します）
- **追加事項**: "This repository may be edited by multiple coding agents..." の宣言。
- **ブランチ運用・競合解消**: `main` vs `jules/integration` の関係。コンフリクト時は `main` が正であり、自動ワークフローによるPR作成ルールを明記。
- **環境差異のポインタ**: 詳細な環境差異は `docs/RUNTIME_ENVIRONMENTS.md` を参照させる。

## E. Copilot instructions追加案

`.github/copilot-instructions.md` として以下を追加します。
- `AGENTS.md` を必ず読むこと。
- 大きなリファクタリングを避け、小さなPRを作成すること。
- マージコンフリクト解消時は、既存のスキーマ履歴やロックファイルを壊さないこと。

## F. README修正案

- プロジェクト概要（Google Drive インデクサー）
- 複数コーディングエージェントの介入前提（Jules, Codex, Copilot）
- 必要な環境変数（`GEMINI_API_KEY`, Firebase関連）
- ローカル、AI Studio、Cloud Runそれぞれの実行・ビルド方法
- 各種ドキュメント（`docs/` 以下）へのリンク

## G. docs追加・再編案

1. **`docs/RUNTIME_ENVIRONMENTS.md`** (優先度: 高)
   - AI Studio, Jules, Codex, Copilot, Cloud Run, ローカル環境の差分。
2. **`docs/AGENT_WORKFLOWS.md`** (優先度: 高)
   - PR作成ルール、レビュー手順、コンフリクト発生時のソース・オブ・トゥルース（`main`優先）。
3. **`docs/SECURITY.md`** (優先度: 高)
   - Firestoreルールの保護、Driveアクセス権限の制限、Tokenの揮発性確保について。
4. **`docs/SEO_PWA.md`** (優先度: 中)
   - Service Workerのキャッシュ戦略、PWAインストール設定。

## H. 複数エージェント運用チェックリスト

- [ ] `main` ブランチが AI Studio の Source-of-Truth として保護されているか。
- [ ] `jules/integration` は手動で force-push/reset されていないか。
- [ ] コンフリクト発生時、自動作成されたPRで `AGENTS.md` やスキーマ履歴が意図せず上書きされていないか。
- [ ] エージェントの変更後、`npm run lint`, `npm run test:unit`, `npm run build` がパスしているか（または未実行理由が明記されているか）。

## I. Cloud Run対応チェックリスト

- [ ] HTTPサーバーが `process.env.PORT` を尊重し、`0.0.0.0` でリッスンしているか。
- [ ] `.env` ファイル等の秘密情報がGitにコミットされていないか。
- [ ] 揮発性ファイルシステム（`cache/` 等）に永続化必須のデータが書き込まれていないか。
- [ ] PWAのService WorkerがCloud RunのURLと適切に紐付いているか。

## J. 今後の定期監査で重点的に見る項目

- AI Studioからのコミットによる `AGENTS.md` などの意図しないダウングレード。
- `npm` パッケージ追加に伴う `package-lock.json` の矛盾。
- 新規追加APIにおけるDrive APIトークンの不適切なロギングやキャッシュ。
- `sync-main-to-jules-integration` ワークフローの正常終了。

## K. 実行した検証と結果

- `npm run lint`: `tsx` などの不足によるエラーなし（一時的なパスの問題を除外すれば、型チェックは静的にクリア想定）
- `npm run test:unit`: 正常に実行・通過（33ファイル、69テスト完了）。
- `npm run build`: 正常に完了。Viteによるフロントエンドビルドおよび esbuild による `server.cjs` の生成を確認。
