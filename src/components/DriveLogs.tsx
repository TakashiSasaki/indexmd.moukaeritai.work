import { useState } from "react";
import { DriveLog } from "../types";
import { Terminal, Trash2, Calendar, AlertCircle, Copy, Check } from "lucide-react";

interface DriveLogsProps {
  logs: DriveLog[];
  onClearLogs: () => void;
}

export default function DriveLogs({ logs, onClearLogs }: DriveLogsProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);

  const handleClearClick = () => {
    if (logs.length === 0) return;
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 4000);
    } else {
      onClearLogs();
      setConfirming(false);
    }
  };

  const handleCopyLogs = async () => {
    if (logs.length === 0) return;
    
    const textToCopy = logs
      .map((log) => {
        const timeStr = new Date(log.timestamp).toLocaleTimeString();
        const dateStr = new Date(log.timestamp).toLocaleDateString();
        return `[${dateStr} ${timeStr}] [${log.level.toUpperCase()}] ${log.message}${log.details ? `\nDetails: ${log.details}` : ""}`;
      })
      .join("\n");

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy logs: ", err);
    }
  };

  return (
    <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden h-[400px]" id="logs-card">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5" /> Log
        </h3>
        <div className="flex gap-2 items-center">
          <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded tracking-tight">ACTIVE</span>
          <button
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer bg-white"
            title="Copy Logs to Clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-green-650 animate-pulse" />
                <span className="text-green-650">コピー完了</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-450" />
                <span>ログをコピー</span>
              </>
            )}
          </button>
          <button
            onClick={handleClearClick}
            disabled={logs.length === 0}
            className={`flex items-center justify-center gap-1.5 px-2 py-1 text-[10px] font-bold rounded transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${
              confirming
                ? "bg-red-500 hover:bg-red-600 text-white border-transparent shadow-sm px-2.5"
                : "text-slate-400 hover:text-red-500 hover:bg-red-50"
            }`}
            title={confirming ? "再度クリックして完全に消去" : "Clear CPU Logs"}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirming && <span>全消去？ (あと4秒)</span>}
          </button>
        </div>
      </div>

      <div className="flex-1 bg-slate-50 p-4 font-mono text-xs text-slate-600 leading-relaxed overflow-y-auto overflow-x-hidden custom-scrollbar">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 italic gap-2 select-none text-[10px]">
            <AlertCircle className="w-6 h-6 opacity-40 text-slate-400" />
            No terminal activity tracked.
          </div>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log, idx) => {
              let badgeStyle = "text-blue-500";
              if (log.level === "success") badgeStyle = "text-green-500";
              if (log.level === "warn") badgeStyle = "text-orange-500";
              if (log.level === "error") badgeStyle = "text-red-600 font-bold bg-red-100 px-1 rounded";

              return (
                <div key={log.id || idx} className="flex flex-col">
                  <div className="flex items-start gap-1.5 break-words">
                    <span className="text-slate-400 shrink-0 select-none hidden sm:inline">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className={`shrink-0 uppercase font-bold tracking-tight ${badgeStyle}`}>
                      [{log.level}]
                    </span>
                    <span className={`break-all ${log.level === 'error' ? 'text-red-700' : 'text-slate-600'}`}>{log.message}</span>
                  </div>
                  {log.details && (
                    <pre className="text-[10px] text-indigo-700 bg-indigo-50/50 p-2 rounded border border-indigo-100 break-words overflow-x-auto whitespace-pre-wrap ml-0 sm:ml-[76px] mt-1">
                      {log.details}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
