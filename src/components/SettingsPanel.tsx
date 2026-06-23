import { useState } from "react";
import { AppConfig } from "../types";
import { Settings, Save, RefreshCw, Layers, ShieldAlert, Zap, ChevronDown, ChevronUp } from "lucide-react";

interface SettingsPanelProps {
  config: AppConfig;
  onSaveConfig: (updated: AppConfig) => void;
}

export default function SettingsPanel({ config, onSaveConfig }: SettingsPanelProps) {
  const [localConfig, setLocalConfig] = useState<AppConfig>(config);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const handleSave = () => {
    onSaveConfig(localConfig);
    setSavedMessage("Settings saved successfully.");
    setTimeout(() => setSavedMessage(null), 3000);
  };

  const handleChange = (field: keyof AppConfig, value: any) => {
    setLocalConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm transition-all duration-200" id="settings-card">
      <div 
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-slate-500" />
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            システム詳細設定 <span className="text-[10px] text-indigo-500 font-extrabold lowercase tracking-normal">({isExpanded ? "クリックで閉じる" : "クリックで展開"})</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
            tuning.json
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 animate-pulse" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-slate-100 space-y-5 animate-fadeIn">
          {/* Rate limit & Concurrency */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 border-l-2 border-indigo-500 pl-2">
              <Zap className="w-3.5 h-3.5" /> Performance Params
            </h3>

            <div className="bg-slate-50 border border-slate-100 rounded p-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex justify-between">
                <span>Drive API Delay Limit</span>
                <span className="font-mono text-indigo-600 font-bold">{localConfig.rate_limit_delay_ms}ms</span>
              </label>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={localConfig.rate_limit_delay_ms}
                onChange={(e) => handleChange("rate_limit_delay_ms", parseInt(e.target.value))}
                className="w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer"
              />
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded p-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex justify-between">
                <span>Max Concurrent Tasks</span>
                <span className="font-mono text-indigo-600 font-bold">{localConfig.max_concurrent_tasks}</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={localConfig.max_concurrent_tasks}
                onChange={(e) => handleChange("max_concurrent_tasks", parseInt(e.target.value))}
                className="w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* AI Model Settings */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 border-l-2 border-indigo-500 pl-2">
              <Layers className="w-3.5 h-3.5" /> Inference Engine
            </h3>

            <div className="bg-slate-50 border border-slate-100 rounded p-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Model Selection</label>
              <select
                value={localConfig.gemini_model}
                onChange={(e) => handleChange("gemini_model", e.target.value)}
                className="w-full bg-white border border-slate-200 rounded text-xs font-mono font-bold text-indigo-600 px-2 py-1.5 focus:border-indigo-500 focus:outline-none"
              >
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Accuracy)</option>
                <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
              </select>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded p-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex justify-between">
                <span>Max Logs Storage</span>
                <span className="font-mono text-indigo-600 font-bold">{localConfig.max_logs_count} logs</span>
              </label>
              <input
                type="range"
                min="50"
                max="2000"
                step="50"
                value={localConfig.max_logs_count}
                onChange={(e) => handleChange("max_logs_count", parseInt(e.target.value))}
                className="w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
            {savedMessage ? (
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{savedMessage}</span>
            ) : (
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Awaiting Save</span>
            )}
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 text-indigo-700 transition-colors px-4 py-1.5 rounded text-xs font-bold font-display cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Apply Params
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

