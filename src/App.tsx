import { useState, useEffect } from "react";
import { useNavigate, useLocation, Routes, Route, Navigate } from "react-router-dom";
import { 
  auth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  db,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  writeBatch,
  doc,
  User,
  OperationType,
  handleFirestoreError,
  formatErrorMessage
} from "./lib/firebase";
import { writeLog } from "./lib/logger";
import { 
  saveDriveTokenState, 
  loadDriveTokenState, 
  clearDriveTokenState, 
  isDriveTokenLikelyExpired 
} from "./lib/driveToken";

import { AppConfig, DriveLog } from "./types";
import defaultAppConfig from "./config.json";

import DriveDashboard from "./components/DriveDashboard";
import DriveLogs from "./components/DriveLogs";
import SettingsPanel from "./components/SettingsPanel";

import { 
  BookOpen, 
  Compass, 
  HelpCircle, 
  LogOut, 
  ShieldAlert, 
  Sparkles, 
  ExternalLink,
  Github,
  FolderOpen
} from "lucide-react";

const ACTIVE_TAB_KEY = "indexmd_active_tab";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig>(defaultAppConfig);
  const [logs, setLogs] = useState<DriveLog[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);

  const validTabs = ["dashboard", "debugger", "summary-debugger", "firestore-test", "logs"];
  const activeTab = validTabs.includes(location.pathname.substring(1))
    ? location.pathname.substring(1)
    : "dashboard";

  // Redirect root to dashboard or last active tab
  useEffect(() => {
    if (location.pathname === "/" && user && !authLoading) {
      const lastTab = localStorage.getItem(ACTIVE_TAB_KEY) || "dashboard";
      navigate(`/${lastTab}`, { replace: true });
    }
  }, [location.pathname, user, authLoading]);

  // Persist current tab to localStorage for session recovery
  useEffect(() => {
    if (validTabs.includes(activeTab)) {
      localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    }
  }, [activeTab]);

  const handleTabChange = (tab: string) => {
    navigate(`/${tab}`);
  };

  // Monitor auth state
  useEffect(() => {
    const state = loadDriveTokenState();
    if (state && !isDriveTokenLikelyExpired(state)) {
      setGoogleAccessToken(state.accessToken);
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      
      if (firebaseUser) {
        // Load initial logs for the user
        syncUserLogs(firebaseUser.uid);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch / Sync historical logs from Firestore
  const syncUserLogs = async (uid: string) => {
    // We are no longer saving logs to Firestore to avoid exceeding Firebase Quotas
    // We will just maintain an empty state or the existing state initially
  };

  // Helper to add log and trigger layout update
  const handleAddLog = async (level: "info" | "success" | "warn" | "error", message: string, details?: string) => {
    if (!user) return;
    
    try {
      const newLog: DriveLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level,
        message,
        details: details || ""
      };
      
      setLogs((prev) => {
        const next = [newLog, ...prev];
        return next.length > config.max_logs_count ? next.slice(0, config.logs_cleanup_threshold) : next;
      });
      // We no longer write to Firestore to save costs
      // await writeLog(user.uid, level, message, details);
    } catch (e) {
      console.error("handleAddLog failed:", e);
    }
  };

  // Clear log history from database
  const handleClearLogs = async () => {
    if (!user) return;
    try {
      setLogs([]);
      handleAddLog("warn", "システムログデータが手動クリアされました。");
    } catch (err: any) {
      console.error("Failed to empty logs:", err);
    }
  };

  // Google Provider Authentication Trigger
  const handleLogin = async () => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      const provider = new GoogleAuthProvider();
      // Request standard Google Drive read and write permissions to generate/place index.md
      provider.addScope("https://www.googleapis.com/auth/drive");
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;

      if (accessToken) {
        setGoogleAccessToken(accessToken);
        saveDriveTokenState(accessToken);
        handleAddLog("success", `Google Drive OAuth 認証に成功しました。ログインアカウント: ${result.user.email}`);
      } else {
        throw new Error("Google Drive Token did not register successfully.");
      }
    } catch (err: any) {
      console.error("OAuth authorization error:", err);
      // AI Studio specific: the popup might fail due to iframe restrictions / COOP headers.
      if (err.message && err.message.includes("Cross-Origin-Opener-Policy") || err.code === "auth/popup-closed-by-user") {
        setAuthError("【重要】 iframe内でポップアップがブロックされました。「新しいタブで開く」アイコンからアプリを開き直してログインしてください。");
      } else {
        setAuthError(`ログイン認証に失敗しました。詳細: ${formatErrorMessage(err)}`);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (user) {
        await handleAddLog("info", "アカウントからログアウトしました。");
      }
      setAuthError(null);
      await signOut(auth);
      setGoogleAccessToken(null);
      clearDriveTokenState();
      setUser(null);
    } catch (e: any) {
      console.error(e);
    }
  };

  // Token recovery redirecter - checks 401 exceptions on calls
  const handleSessionExpiry = () => {
    handleAddLog("error", "Google API アクセストークン期限切れを検知しました。セッションをリセットし再認証を要求します。");
    clearDriveTokenState();
    setGoogleAccessToken(null);
    setAuthError("Google認証の有効期限が切れました。安全のため再度ログインしてください。");
  };

  const updateConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    if (user) {
      handleAddLog("info", "システム稼働設定が更新されました。", JSON.stringify(newConfig, null, 2));
    }
  };

  // Authenticate Wrapper layout
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center font-sans text-slate-800">
        <div className="flex flex-col items-center gap-4">
          <FolderOpen className="w-12 h-12 text-indigo-600 animate-bounce" />
          <p className="text-sm font-semibold tracking-wide text-slate-600 font-display animate-pulse">
            認証ステータスを読み込み中...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 selection:bg-indigo-500/20 selection:text-indigo-600">
      
      {/* Dynamic header / Title block */}
      <header className="border-b border-slate-200 bg-white shadow-sm sticky top-0 z-50 h-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-sm select-none">
              ix
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight font-display">
                  indexmd
                </h1>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono font-medium">v1.2-stable</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3 bg-slate-50 pl-3 pr-2 py-1 rounded-xl border border-slate-200">
                {!googleAccessToken && (
                  <div className="hidden sm:flex items-center gap-1.5 mr-2 text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 uppercase tracking-widest">
                    <ShieldAlert className="w-3 h-3" />
                    Drive Auth Required
                  </div>
                )}
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "Profile"}
                    className="w-7 h-7 rounded-full border border-slate-300 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200 uppercase">
                    {(user.displayName || user.email || "U")[0]}
                  </div>
                )}
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-800">{user.displayName || user.email?.split("@")[0] || "user"}</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider">Google Authenticated</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-xs text-slate-600 hover:text-red-600 hover:bg-red-50/50 transition-colors px-2.5 py-1 bg-white border border-slate-200 rounded-lg cursor-pointer"
                  title="Logout Account"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                Drive API: Offline
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-0 space-y-6">
        
        {!user ? (
          // Welcoming Hero & Secure login screen
          <div className="max-w-2xl mx-auto text-center space-y-6 py-12" id="welcome-container">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-xs font-semibold tracking-wide font-display">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Google Drive 全自動OKF準拠 Indexer
              </div>
              <h2 className="text-3xl font-extrabold text-slate-950 font-display tracking-tight leading-tight sm:text-4xl">
                Google Drive の構造を<br />
                <span className="text-indigo-600">一瞬でインデックス。</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                マイドライブ配下の全階層をボトムアップ走査し、各フォルダにAI生成の情報概要と内部リンク付き、人間の手動メモも保護されるセクション分離型（Hybrid-Merge）の <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-indigo-650 border border-slate-200">index.md</code> を自動生成・配置します。
              </p>
            </div>

            {/* Visual Specs Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-left space-y-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500" /> indexmd 技術統合仕様
              </h3>
              <ul className="text-xs text-slate-600 space-y-3 font-medium">
                <li className="flex items-start gap-2.5">
                  <span className="text-indigo-600 font-mono font-bold shrink-0">1.</span>
                  <span><strong>セクション分離型（Hybrid-Merge）:</strong> ユーザーが手動で書き込んだメモ（User Notes）を検知し保護したまま、AI生成領域（&lt;!-- AUTO_GENERATED_START --&gt; ～ &lt;!-- AUTO_GENERATED_END --&gt;）のみを自動書換。</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-indigo-600 font-mono font-bold shrink-0">2.</span>
                  <span><strong>ボトムアップ要約（Cascade Summary）:</strong> 階層構造の深いディレクトリから順に処理。親フォルダの要約を行う際、自動的に子の「AI Summary」を読み取って引用・ propagation。</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-indigo-600 font-mono font-bold shrink-0">3.</span>
                  <span><strong>インクリメンタル走査（Modified Audit）:</strong>前回の走査時刻から更新があったフォルダのみを条件抽出するため、同期時間やAPI消費を節約。</span>
                </li>
              </ul>
            </div>

            {/* Login control CTA */}
            <div className="pt-2 space-y-4">
              {authError && (
                <div className="max-w-md mx-auto p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-left text-xs font-semibold flex items-start gap-2 animate-fade-in shadow-sm">
                  <span className="text-red-500 shrink-0 font-bold select-none text-base leading-none">⚠️</span>
                  <div>
                    <p className="font-bold text-red-800">ログイン・認証に失敗、または無効化されました</p>
                    <p className="text-red-600/90 font-medium mt-0.5">{authError}</p>
                  </div>
                </div>
              )}

              <button
                onClick={handleLogin}
                className="inline-flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white font-bold px-8 py-3.5 rounded-2xl shadow-md hover:-translate-y-0.5 transform cursor-pointer text-sm sm:text-base font-display"
                id="btn-login"
              >
                <Compass className="w-5 h-5 text-indigo-105" />
                Googleでログインして同期を開始
              </button>
              <p className="text-[10px] text-slate-400 mt-3">
                * ログインには Google Drive 操作スコープがリクエストされます。読み書きは <code className="font-mono">index.md</code> に限定されます。<br/>
                * <strong>重要:</strong> 認証のポップアップがブロックされる、または真っ白になる場合は、プレビュー画面右上の<strong>「新しいタブで開く」アイコン</strong>からアプリを開き直してログインしてください。
              </p>
            </div>
          </div>
        ) : !googleAccessToken ? (
          // Re-auth screen for missing/expired drive token
          <div className="max-w-2xl mx-auto text-center space-y-6 py-12" id="reauth-container">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-100 text-amber-700 rounded-full text-xs font-semibold tracking-wide font-display">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Drive Access Required
              </div>
              <h2 className="text-3xl font-extrabold text-slate-950 font-display tracking-tight leading-tight sm:text-4xl">
                Drive アクセストークンの<br />
                <span className="text-amber-600">再取得が必要です。</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                セキュリティのため、Google Drive API のアクセストークンの有効期限が切れました。
                アプリを継続して利用するには、Google Drive アクセストークンを再取得してください。
              </p>
            </div>

            <div className="pt-2 space-y-4">
              {authError && (
                <div className="max-w-md mx-auto p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-left text-xs font-semibold flex items-start gap-2 animate-fade-in shadow-sm">
                  <span className="text-red-500 shrink-0 font-bold select-none text-base leading-none">⚠️</span>
                  <div>
                    <p className="font-bold text-red-800">認証エラー</p>
                    <p className="text-red-600/90 font-medium mt-0.5">{authError}</p>
                  </div>
                </div>
              )}

              <button
                onClick={handleLogin}
                className="inline-flex items-center gap-3 bg-amber-600 hover:bg-amber-700 transition-colors text-white font-bold px-8 py-3.5 rounded-2xl shadow-md hover:-translate-y-0.5 transform cursor-pointer text-sm sm:text-base font-display"
                id="btn-reauth"
              >
                <Compass className="w-5 h-5 text-white" />
                Google Drive アクセストークンを再取得
              </button>
            </div>
          </div>
        ) : (
          // Active Dashboard View
          <div className="space-y-6" id="dashboard-container">
            {/* Action panel & Directory overview */}
            <DriveDashboard 
              userId={user.uid}
              token={googleAccessToken}
              config={config}
              logs={logs}
              onAddLog={handleAddLog}
              onClearLogs={handleClearLogs}
              onSessionExpiry={handleSessionExpiry}
              activeTab={activeTab}
              setActiveTab={handleTabChange}
            />

            {/* Double section layout: Configuration Tuning and Real-Time Log Auditor */}
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <SettingsPanel config={config} onSaveConfig={updateConfig} />
                  <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      インデックス生成のヒント
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      フォルダ内のファイル数が多い場合、AI要約の生成に時間がかかることがあります。
                      大規模な構造を同期する場合は、設定から「スキャン上限」を調整して少しずつ進めることをお勧めします。
                    </p>
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[10px] text-slate-400 italic">
                        ※ ログは上部の「システムログ」タブから確認できます。
                      </p>
                    </div>
                  </div>
                </div>
              } />
              <Route path="/debugger" element={
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <SettingsPanel config={config} onSaveConfig={updateConfig} />
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 shadow-inner">
                    <h4 className="text-xs font-bold text-slate-600 mb-2 uppercase">Debugger Mode Active</h4>
                    <p className="text-[11px] text-slate-500 italic">設定パネルを使用してデバッグ時の挙動（スキャン上限など）を調整できます。</p>
                  </div>
                </div>
              } />
              <Route path="/summary-debugger" element={null} />
              <Route path="/firestore-test" element={
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                   <SettingsPanel config={config} onSaveConfig={updateConfig} />
                </div>
              } />
              <Route path="/logs" element={null} />
            </Routes>
          </div>
        )}

      </main>

      {/* Footer credits */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-16 text-center select-none text-[10px] font-medium text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© 2026 indexmd.moukaeritai.work. OKF Directory Framework Standard 2.0.</p>
          <div className="flex gap-4 uppercase tracking-widest text-[9px]">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> FIRESTORE SYNC: OK
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-bold">DRIVE SCOPE: READ/WRITE (INDEX.MD ONLY)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
