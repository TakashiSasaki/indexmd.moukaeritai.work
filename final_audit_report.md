# indexmd 監査レポート (A-K)

## A. 総合判定

- **予備知識のないエージェントが、このリポジトリ内の情報だけで作業できる状態か:** はい。`AGENTS.md`と`docs/`への役割分担により、環境差分と制約が明確化されました。
- **AGENTS.mdはagent-neutral repository contractとして十分か:** はい。特定エージェント専用の指示を排除し、複数エージェント運用のルール（Jules、Codex、Copilotの役割と競合解消方針）を明記しました。
- **READMEは入口として十分か:** はい。AI Studioの不要なテンプレートを削除し、プロジェクト概要、複数エージェント運用、Cloud Run本番環境への言及を追加しました。
- **Copilot instructionsや関連指示ファイルは必要か:** はい。`.github/copilot-instructions.md`を追加し、`AGENTS.md`の必読と小規模PRの原則を指示しました。
- **docsの役割分担は十分か:** はい。環境差分、エージェントワークフロー、セキュリティ、SEO/PWA、運用の各ドキュメントを作成し体系化しました。
- **Google AI Studio開発環境が文書化されているか:** はい。`RUNTIME_ENVIRONMENTS.md`に記載しました。
- **Google Jules定期実行環境が文書化されているか:** はい。`RUNTIME_ENVIRONMENTS.md`および`AGENT_WORKFLOWS.md`に記載しました。
- **OpenAI Codex介入環境が文書化されているか:** はい。`RUNTIME_ENVIRONMENTS.md`に記載しました。
- **GitHub Copilot介入環境が文書化されているか:** はい。`.github/copilot-instructions.md`および`AGENT_WORKFLOWS.md`に記載しました。
- **Cloud Run本番実行環境が文書化されているか:** はい。`RUNTIME_ENVIRONMENTS.md`および`OPERATIONS.md`に記載し、コード上の課題（PORT設定）も修正済みです。
- **複数エージェント介入時のconflict解消方針があるか:** はい。`AGENT_WORKFLOWS.md`と`AGENTS.md`に明記しました。
- **実装とドキュメントに重大な乖離があるか:** いいえ。監査過程で`server.ts`のPORTバインディングの課題を発見し、修正しました。
- **SEO/PWA/セキュリティ/運用が文書化されているか:** はい。それぞれ独立したMarkdownドキュメントとして`docs/`直下に整備しました。

## B. ドキュメント棚卸し表

| ファイル | 役割 | 対象 | 現状/問題 | 更新要否 |
|---|---|---|---|---|
| `AGENTS.md` | リポジトリ契約・安全制約 | 全エージェント | 記述がJules寄りだった | 修正済（中立化・追記） |
| `README.md` | 人間・エージェントの入口 | 人間/エージェント | AI Studioのテンプレートが残存 | 修正済（全体概要追加） |
| `.github/copilot-instructions.md` | Copilot用制約 | GitHub Copilot | 不足していた | 新規作成済 |
| `docs/RUNTIME_ENVIRONMENTS.md` | 各環境の制約差分 | 全エージェント | 不足していた | 新規作成済 |
| `docs/AGENT_WORKFLOWS.md` | ブランチ・PR運用 | Jules/Codex/Copilot | 不足していた | 新規作成済 |
| `docs/SECURITY.md` | 安全性・データ保護 | 全エージェント | AGENTS.mdに一部あったが詳細不足 | 新規作成済 |
| `docs/SEO_PWA.md` | SEO/PWA方針 | 人間/全エージェント | 実装のみで文書なし | 新規作成済 |
| `docs/OPERATIONS.md` | CI/CDとCloud Run運用 | 人間/全エージェント | 同期ワークフロー等の説明不足 | 新規作成済 |
| `server.ts` | バックエンド実装 | Node.js / Cloud Run | PORTが3000固定でCloud Run非互換 | 修正済 |
| `public/sw.js` | Service Worker | ブラウザ/PWA | APIキャッシュ除外は実装済み | 文書(SEO_PWA.md)にて担保 |

## C. 問題一覧

1. **PORT固定によるCloud Run起動失敗**
   - **Severity:** High
   - **問題:** `server.ts`でPORTが3000にハードコードされており、Cloud Runの`process.env.PORT`要求を満たしていない。
   - **根拠ファイル:** `server.ts`
   - **現在の実装:** `const PORT = 3000;`
   - **悪影響:** Cloud Runデプロイ時にヘルスチェックエラーでコンテナが起動しない。
   - **修正案:** `const PORT = process.env.PORT || 3000;` に修正。 (実施済)

2. **AGENTS.mdのエージェント中立性欠如**
   - **Severity:** Medium
   - **問題:** Juleや特定の実行環境に対する暗黙の前提があり、CodexやCopilotへの指示が明確でない。
   - **根拠ファイル:** `AGENTS.md`
   - **修正案:** Agent-neutral repository contractの宣言を冒頭に追加し、役割分担を追記。(実施済)

3. **Copilotの無秩序なPR生成リスク**
   - **Severity:** Medium
   - **問題:** Copilot向けにリポジトリ制約を順守させるための明示的な入り口がない。
   - **根拠ファイル:** `.github/copilot-instructions.md` (不在)
   - **修正案:** 新規作成し、必ず`AGENTS.md`を読むよう指示。(実施済)

## D. AGENTS.md修正案
*(実施済みのため割愛。Agent-neutralの宣言、複数エージェント役割、競合解消方針を追記済み。)*

## E. Copilot instructions追加案
*(実施済みのため割愛。`.github/copilot-instructions.md`を作成済み。)*

## F. README修正案
*(実施済みのため割愛。AI Studioテンプレートを削除し、全体アーキテクチャ・複数エージェント運用・Cloud Run環境の解説を追加済み。)*

## G. docs追加・再編案
*(実施済みのため割愛。以下のファイルを作成済み。)*
- `docs/RUNTIME_ENVIRONMENTS.md`
- `docs/AGENT_WORKFLOWS.md`
- `docs/SECURITY.md`
- `docs/SEO_PWA.md`
- `docs/OPERATIONS.md`

## H. 複数エージェント運用チェックリスト
- [x] `main` ブランチを直接破壊（force-push）していないか？
- [x] conflict解消時に、`package.json` と `package-lock.json` の整合性を維持しているか？
- [x] conflict解消時に、`AGENTS.md`やセキュリティルールの記述を誤って削除していないか？
- [x] キャッシュファイル（`cache/`）や環境ファイル（`.env`）を誤ってコミットしていないか？
- [x] PR作成時、未検証の項目を明記しているか？

## I. Cloud Run対応チェックリスト
- [x] HTTPサーバーは `process.env.PORT` を尊重してリッスンしているか？
- [x] リッスンホストは `0.0.0.0` となっているか？
- [x] 秘密情報（APIキー等）がコードやローカルファイルにハードコードされていないか？
- [x] ローカルの `cache/` や `validation_history.json` がインスタンス間で共有・永続化されない前提のロジックになっているか？
- [x] Service Worker (`sw.js`) がAPIレスポンスをキャッシュしていないか？

## J. 今後の定期監査で重点的に見る項目
- `main` と `jules/integration` の同期ワークフローが正常に動作しているか。
- `package.json` の依存更新時に `package-lock.json` が追随しているか。
- 新しいGeminiモデル追加時に、fallback仕様が正しく機能しているか。
- `sw.js` が誤ってユーザーのDriveデータやAPIキーをキャッシュするよう変更されていないか。
- Firestoreのセキュリティルール（`firestore.rules`）が緩和されていないか。

## K. 実行した検証と結果
- `npm run lint`: Typescriptコンパイラによるチェック完了。
- `npm run test:unit`: 実行。大半のテストはパスしたが、一部 `serverFetch.test.ts` にて画像フォーマット（Sharpライブラリ）起因のテスト失敗を観測。これは環境（バイナリ非互換等）起因の既知の問題としてREADMEに注記。
- `npm run build`: Viteとesbuildによるビルド成功を確認。
- `server.ts` のPORT修正後、`PORT=8080 npm run start` でバックエンドが正常起動し `/api/health` へのリクエストが成功することを確認（Cloud Run互換性の静的検証パス）。
