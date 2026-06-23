import React from 'react';
import { ModelInfo, ValidationRecord } from '../types';
import MODELS_INFO from '../data/models_info.json';
import VALIDATION_HISTORY from '../data/validation_history.json';
import { Check, X, HelpCircle, AlertCircle } from 'lucide-react';

const MODELS = MODELS_INFO as ModelInfo[];

const MIME_TYPES = [
  { label: 'テキスト (txt/csv)', type: 'text' },
  { label: 'JSON', type: 'application/json' },
  { label: 'PDF', type: 'application/pdf' },
  { label: 'Word (docx)', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { label: 'Excel (xlsx)', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { label: 'PowerPoint (pptx)', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  { label: '画像 (jpg/png)', type: 'image' },
];

interface CompatibilityMatrixProps {
  history?: ValidationRecord[];
  onCellClick?: (modelId: string, mimeType: string) => void;
  currentModelId?: string;
  currentMimeType?: string;
}

export const CompatibilityMatrix: React.FC<CompatibilityMatrixProps> = ({ 
  onCellClick, 
  currentModelId, 
  currentMimeType 
}) => {

  const getStatus = (modelId: string, mimeType: string) => {
    // Fallback to model modalities
    const model = MODELS.find(m => m.id === modelId);
    if (!model) return 'unknown';

    if (mimeType === 'application/pdf') {
       return model.modalities.includes('PDF') || model.modalities.includes('Files') ? 'likely' : 'unlikely';
    }
    if (mimeType === 'text' || mimeType === 'application/json') {
       return model.modalities.includes('Text') ? 'likely' : 'unlikely';
    }
    if (mimeType === 'image') {
       return model.modalities.includes('Image') ? 'likely' : 'unlikely';
    }
    if (mimeType.includes('officedocument')) {
       return model.modalities.includes('Files') ? 'likely' : 'unlikely';
    }

    return 'unknown';
  };

  const isCurrentCell = (modelId: string, mimeType: string) => {
    if (!currentModelId || !currentMimeType) return false;
    if (modelId !== currentModelId) return false;

    // MIME type matching logic to correspond with currentMimeType mapping
    if (mimeType === 'text') return currentMimeType.startsWith('text/') || currentMimeType === 'application/json';
    if (mimeType === 'image') return currentMimeType.startsWith('image/');
    return mimeType === currentMimeType;
  };

  const renderIcon = (status: string) => {
    switch (status) {
      case 'success': return <Check className="w-4 h-4 text-emerald-500" />;
      case 'error': return <X className="w-4 h-4 text-rose-500" />;
      case 'auth_error': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'likely': return <Check className="w-4 h-4 text-emerald-300/50" />;
      case 'unlikely': return <X className="w-4 h-4 text-rose-300/50" />;
      default: return <HelpCircle className="w-4 h-4 text-slate-300" />;
    }
  };

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 z-10">MIME Type / Model</th>
            {MODELS.map(model => (
              <th 
                key={model.id} 
                className={`p-3 text-[10px] font-bold uppercase tracking-wider text-center min-w-[80px] transition-colors ${
                  model.id === currentModelId ? 'text-indigo-600 bg-indigo-50/30' : 'text-slate-500'
                }`}
              >
                {model.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MIME_TYPES.map((mime, idx) => (
            <tr key={mime.type} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
              <td className={`p-3 text-xs font-medium border-b border-slate-100 sticky left-0 z-10 transition-colors ${
                isCurrentCell(currentModelId || '', mime.type) ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700 bg-inherit'
              }`}>
                {mime.label}
              </td>
              {MODELS.map(model => {
                const status = getStatus(model.id, mime.type);
                const isActive = isCurrentCell(model.id, mime.type);
                return (
                  <td 
                    key={model.id} 
                    className={`p-3 border-b border-slate-100 text-center cursor-pointer hover:bg-indigo-50/50 transition-all group ${
                      isActive ? 'bg-indigo-50 ring-2 ring-indigo-500 ring-inset z-20' : ''
                    }`}
                    onClick={() => onCellClick?.(model.id, mime.type)}
                  >
                    <div className={`flex justify-center transition-transform ${isActive ? 'scale-125' : 'group-hover:scale-125'}`}>
                      {renderIcon(status)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-1.5">
          <Check className="w-3 h-3 text-emerald-500" />
          <span className="text-[10px] text-slate-500">検証済み成功</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Check className="w-3 h-3 text-emerald-300/50" />
          <span className="text-[10px] text-slate-500">仕様上可能</span>
        </div>
        <div className="flex items-center gap-1.5">
          <X className="w-3 h-3 text-rose-500" />
          <span className="text-[10px] text-slate-500">検証済み失敗</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-3 h-3 text-amber-500" />
          <span className="text-[10px] text-slate-500">認可エラー等</span>
        </div>
      </div>
    </div>
  );
};
