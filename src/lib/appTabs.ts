import { LayoutDashboard, FileSearch, Sparkles, Database, Terminal, Zap, LucideIcon, History as HistoryIcon } from 'lucide-react';

export type AppTabId =
  | "dashboard"
  | "debugger"
  | "summary-debugger"
  | "summary-browser"
  | "firestore-test"
  | "logs"
  | "cache-stats";

export interface AppTab {
  id: AppTabId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

export const APP_TABS: readonly AppTab[] = [
  { id: "dashboard", label: "フォルダスキャンテスト", shortLabel: "スキャン", icon: LayoutDashboard },
  { id: "debugger", label: "フォルダ情報取得テスト", shortLabel: "情報取得", icon: FileSearch },
  { id: "summary-debugger", label: "AI要約テスト", shortLabel: "AI要約", icon: Sparkles },
  { id: "summary-browser", label: "保存済み要約ブラウザ", shortLabel: "要約履歴", icon: HistoryIcon },
  { id: "firestore-test", label: "Firestoreテスト", shortLabel: "Firestore", icon: Database },
  { id: "logs", label: "システムログ", shortLabel: "ログ", icon: Terminal },
  { id: "cache-stats", label: "キャッシュ統計", shortLabel: "キャッシュ", icon: Zap },
];

export const VALID_TAB_IDS = APP_TABS.map(tab => tab.id);

export function isValidTabId(id: string): id is AppTabId {
  return VALID_TAB_IDS.includes(id as AppTabId);
}

export function resolveActiveTab(pathname: string): AppTabId {
  const maybeTab = pathname.replace(/^\//, '');
  if (isValidTabId(maybeTab)) {
    return maybeTab;
  }
  return "dashboard";
}
