import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Code, FileJson, BookOpen, ChevronRight, FileText } from 'lucide-react';

// Vite raw imports for documentation and schemas
import schemaDoc from '../../docs/schema-documentation.md?raw';
import summarySchema from '../../contracts/schemas/summary-analysis/v1.2.0-draft.2/schema.json?raw';
import textRecordSchema from '../../contracts/schemas/text-analysis-record/v0.1.0/schema.json?raw';
import visualSchema from '../../contracts/schemas/visual-analysis/v0.2.0-draft.1/schema.json?raw';
import imageRecordSchema from '../../contracts/schemas/image-analysis-record/v0.1.0/schema.json?raw';

const schemas = [
  { id: 'summary-analysis', name: 'Summary Analysis v1.2.0-draft.2', content: summarySchema },
  { id: 'text-analysis-record', name: 'Text Analysis Record v0.1.0', content: textRecordSchema },
  { id: 'visual-analysis', name: 'Visual Analysis v0.2.0-draft.1', content: visualSchema },
  { id: 'image-analysis-record', name: 'Image Analysis Record v0.1.0', content: imageRecordSchema },
];

export default function DeveloperDocs() {
  const [activeTab, setActiveTab] = useState<'doc' | 'schema'>('doc');
  const [selectedSchema, setSelectedSchema] = useState(schemas[0].id);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Code className="w-6 h-6 text-indigo-600" />
            Developer Documentation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Technical specifications, data schemas, and architecture guidelines.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 shrink-0 space-y-1">
          <button
            onClick={() => setActiveTab('doc')}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'doc'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Schema Documentation
          </button>
          
          <div className="pt-4 pb-2 px-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <FileJson className="w-4 h-4" />
              JSON Schemas
            </div>
          </div>
          
          {schemas.map((schema) => (
            <button
              key={schema.id}
              onClick={() => {
                setActiveTab('schema');
                setSelectedSchema(schema.id);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left ${
                activeTab === 'schema' && selectedSchema === schema.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate">{schema.name}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {activeTab === 'doc' ? (
            <div className="p-8">
              <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-a:text-indigo-600">
                <ReactMarkdown>{schemaDoc}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full min-h-[600px]">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <FileJson className="w-5 h-5 text-indigo-500" />
                  {schemas.find((s) => s.id === selectedSchema)?.name}
                </h3>
              </div>
              <div className="flex-1 overflow-auto bg-slate-900 p-6">
                <pre className="text-sm font-mono text-slate-300 whitespace-pre-wrap break-all">
                  {schemas.find((s) => s.id === selectedSchema)?.content}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
