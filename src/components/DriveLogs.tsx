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

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const date = String(d.getDate()).padStart(2, "0");
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const seconds = String(d.getSeconds()).padStart(2, "0");
      return `${year}/${month}/${date} ${hours}:${minutes}:${seconds}`;
    } catch {
      return "0000/00/00 00:00:00";
    }
  };

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
        const timeStr = formatTimestamp(log.timestamp);
        return `[${timeStr}] [${log.level.toUpperCase()}] ${log.message}${log.details ? `\nDetails: ${log.details}` : ""}`;
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
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 gap-2">
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 min-w-0">
          <Terminal className="w-3.5 h-3.5 shrink-0" /> 
          <span className="truncate">
            システムログ <span className="text-[10px] text-indigo-500 font-extrabold lowercase tracking-normal hidden md:inline">（最新のログが一番上に表示されます）</span>
          </span>
        </h3>
        <div className="flex gap-1.5 items-center shrink-0">
          <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[9px] font-bold rounded tracking-tight">ACTIVE</span>
          <button
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer bg-white"
            title="Copy Logs to Clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-green-600 animate-pulse shrink-0" />
                <span className="text-green-600 hidden sm:inline">コピー完了</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="hidden sm:inline">ログをコピー</span>
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
            {confirming && <span>全消去？</span>}
          </button>
        </div>
      </div>
 
      <div className="flex-1 bg-slate-50 p-3 font-mono text-[11px] text-slate-600 leading-tight overflow-y-auto overflow-x-hidden custom-scrollbar">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 italic gap-2 select-none text-[10px]">
            <AlertCircle className="w-6 h-6 opacity-40 text-slate-400" />
            No terminal activity tracked.
          </div>
        ) : (
          <div className="divide-y divide-slate-250/20">
            {logs.map((log, idx) => {
              let badgeStyle = "text-blue-550 bg-blue-50/70 border border-blue-100/80";
              if (log.level === "success") badgeStyle = "text-green-650 bg-green-50/70 border border-green-100/80";
              if (log.level === "warn") badgeStyle = "text-amber-600 bg-amber-50/70 border border-amber-100/80";
              if (log.level === "error") badgeStyle = "text-red-600 bg-red-50 border border-red-100 font-bold";
 
              return (
                <div key={log.id ? `${log.id}-${idx}` : idx} className="grid grid-cols-[115px_58px_1fr] items-start gap-1.5 py-1 text-[10.5px] hover:bg-slate-200/20 transition-colors">
                  <span className="text-slate-400 font-bold select-none text-[10px] pt-0.5">
                    [{formatTimestamp(log.timestamp)}]
                  </span>
                  <span className={`px-1 py-0.5 rounded text-[8.5px] font-extrabold tracking-tight text-center uppercase shrink-0 ${badgeStyle}`}>
                    {log.level}
                  </span>
                  <span className="break-all text-slate-700 font-medium leading-normal pl-0.5">
                    {log.message}
                  </span>
                  {log.details && (
                    <div className="col-span-3 mt-1 sm:pl-[180px]">
                      <pre className="text-[10px] text-indigo-700 bg-indigo-50/50 p-2 rounded border border-indigo-100 break-words overflow-x-auto whitespace-pre-wrap">
                        {log.details}
                      </pre>
                    </div>
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
