import React, { useState } from 'react';
import { Sparkles, X, Globe, Settings, Terminal, Database, Cpu, MessageSquare } from 'lucide-react';
import { AiSettings, AVAILABLE_MODELS } from '../types';

interface AiAssistantModalProps {
  onClose: () => void;
  onGenerateText: (prompt: string, settings: AiSettings) => void;
  onGenerateJson: (req: string, res: string, settings: AiSettings) => void;
  isLoading: boolean;
}

export default function AiAssistantModal({ onClose, onGenerateText, onGenerateJson, isLoading }: AiAssistantModalProps) {
  const [activeTab, setActiveTab] = useState<'prompt' | 'api' | 'settings'>('prompt');
  
  // State
  const [prompt, setPrompt] = useState('');
  const [apiReq, setApiReq] = useState('');
  const [apiRes, setApiRes] = useState('');
  
  // Settings
  const [settings, setSettings] = useState<AiSettings>({
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      database: 'mysql'
  });

  const handleGenerate = () => {
      if (activeTab === 'prompt') {
          onGenerateText(prompt, settings);
      } else {
          onGenerateJson(apiReq, apiRes, settings);
      }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[600px] rounded-2xl shadow-2xl flex overflow-hidden border border-slate-200 dark:border-slate-800">
        
        {/* Sidebar */}
        <div className="w-64 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                <Sparkles className="text-indigo-500" /> AI Architect
            </h2>
            
            <nav className="space-y-1 flex-1">
                <button 
                    onClick={() => setActiveTab('prompt')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'prompt' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                    <MessageSquare size={18} /> Schema from Text
                </button>
                <button 
                    onClick={() => setActiveTab('api')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'api' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                    <Globe size={18} /> API to Schema
                </button>
                <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />
                 <button 
                    onClick={() => setActiveTab('settings')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                    <Settings size={18} /> Configuration
                </button>
            </nav>

            <div className="mt-auto">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
                    <div className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 mb-1">Active Model</div>
                    <div className="text-xs text-indigo-600 dark:text-indigo-400 truncate">{AVAILABLE_MODELS.find(m => m.id === settings.model)?.name}</div>
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900">
            {/* Header */}
            <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6">
                <h3 className="font-semibold text-slate-800 dark:text-white">
                    {activeTab === 'prompt' && "Describe your application"}
                    {activeTab === 'api' && "Import from API JSON"}
                    {activeTab === 'settings' && "Model & Generation Settings"}
                </h3>
                <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 p-6 overflow-y-auto">
                {activeTab === 'prompt' && (
                    <div className="space-y-4 h-full flex flex-col">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Describe the system you want to build. Include details about entities, relationships, and specific features.
                        </p>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g., A multi-tenant SaaS application with subscription plans, user roles, team management, and activity logs..."
                            className="flex-1 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 resize-none focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white placeholder:text-slate-400"
                        />
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {['E-commerce', 'Blog System', 'Learning Management', 'CRM', 'Social Network'].map(tag => (
                                <button key={tag} onClick={() => setPrompt(prev => prev ? prev + '\n' + tag : tag)} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap">
                                    + {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'api' && (
                    <div className="space-y-4 h-full flex flex-col">
                         <p className="text-sm text-slate-500 dark:text-slate-400">
                            Paste the JSON Request and Response bodies from your API to automatically reverse-engineer the schema.
                        </p>
                        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                            <div className="flex flex-col">
                                <label className="text-xs font-bold text-slate-500 mb-1">Request JSON</label>
                                <textarea
                                    value={apiReq}
                                    onChange={(e) => setApiReq(e.target.value)}
                                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 font-mono text-xs resize-none focus:ring-1 focus:ring-indigo-500 outline-none dark:text-white"
                                    placeholder="{ ... }"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-bold text-slate-500 mb-1">Response JSON</label>
                                <textarea
                                    value={apiRes}
                                    onChange={(e) => setApiRes(e.target.value)}
                                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 font-mono text-xs resize-none focus:ring-1 focus:ring-indigo-500 outline-none dark:text-white"
                                    placeholder="{ ... }"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="space-y-6 max-w-lg">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">AI Model</label>
                            <div className="space-y-3">
                                {AVAILABLE_MODELS.map(model => (
                                    <label key={model.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${settings.model === model.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                        <input 
                                            type="radio" 
                                            name="model" 
                                            value={model.id} 
                                            checked={settings.model === model.id}
                                            onChange={() => setSettings({...settings, model: model.id})}
                                            className="mt-1 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div>
                                            <div className="font-semibold text-slate-900 dark:text-white text-sm">{model.name}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">{model.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                             <div className="flex justify-between mb-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Creativity (Temperature)</label>
                                <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{settings.temperature}</span>
                             </div>
                             <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.1" 
                                value={settings.temperature}
                                onChange={(e) => setSettings({...settings, temperature: parseFloat(e.target.value)})}
                                className="w-full accent-indigo-600"
                            />
                            <div className="flex justify-between text-xs text-slate-400 mt-1">
                                <span>Strict</span>
                                <span>Balanced</span>
                                <span>Creative</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Target Database Engine</label>
                            <select 
                                value={settings.database}
                                onChange={(e) => setSettings({...settings, database: e.target.value as any})}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="mysql">MySQL 8.0+</option>
                                <option value="mariadb">MariaDB</option>
                                <option value="pgsql">PostgreSQL</option>
                                <option value="sqlite">SQLite</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            {activeTab !== 'settings' && (
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={handleGenerate}
                        disabled={isLoading || (activeTab === 'prompt' && !prompt) || (activeTab === 'api' && !apiRes)}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>Generating...</>
                        ) : (
                            <>
                                <Cpu size={18} /> Generate Schema
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}