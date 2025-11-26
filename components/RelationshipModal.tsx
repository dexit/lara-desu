import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeftRight, GitMerge, Link } from 'lucide-react';
import { TableData } from '../types';
import { Node } from 'reactflow';

interface RelationshipModalProps {
    sourceNode: Node<TableData>;
    targetNode: Node<TableData>;
    onClose: () => void;
    onSubmit: (type: '1:1' | '1:N' | 'N:M', config: any) => void;
}

export default function RelationshipModal({ sourceNode, targetNode, onClose, onSubmit }: RelationshipModalProps) {
    const [type, setType] = useState<'1:1' | '1:N' | 'N:M'>('1:N');
    const [cascade, setCascade] = useState(true);
    
    // Auto-generated names
    const sourceName = sourceNode.data.name;
    const targetName = targetNode.data.name;
    
    // Naming conventions
    const sourceFk = `${sourceName.replace(/s$/, '')}_id`; // e.g., users -> user_id
    const targetFk = `${targetName.replace(/s$/, '')}_id`; // e.g., posts -> post_id
    
    // Pivot table name (alphabetical)
    const pivotName = [sourceName, targetName].sort().map(s => s.replace(/s$/, '')).join('_');

    return (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Link className="text-indigo-500" />
                        Create Relationship
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    
                    {/* Visualizer */}
                    <div className="flex items-center justify-center gap-8 mb-8 py-4">
                        <div className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-lg font-bold border border-indigo-200 dark:border-indigo-700">
                            {sourceName}
                        </div>
                        
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                            {type === '1:1' && <ArrowRight size={24} className="text-indigo-500" />}
                            {type === '1:N' && (
                                <div className="flex items-center">
                                    <div className="h-px w-8 bg-indigo-500"></div>
                                    <div className="text-xs font-bold text-indigo-500 ml-1">has many</div>
                                    <ArrowRight size={24} className="text-indigo-500 ml-1" />
                                </div>
                            )}
                            {type === 'N:M' && <ArrowLeftRight size={24} className="text-purple-500" />}
                        </div>

                        <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-lg font-bold border border-emerald-200 dark:border-emerald-700">
                            {targetName}
                        </div>
                    </div>

                    {/* Type Selection */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <button 
                            onClick={() => setType('1:1')}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${type === '1:1' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-800'}`}
                        >
                            <div className="mb-2 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <span className="font-bold text-xs">1:1</span>
                            </div>
                            <div className="font-bold text-slate-800 dark:text-white text-sm">One to One</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Unique relationship. E.g., User has one Profile.</div>
                        </button>

                        <button 
                            onClick={() => setType('1:N')}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${type === '1:N' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-800'}`}
                        >
                            <div className="mb-2 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <GitMerge size={16} />
                            </div>
                            <div className="font-bold text-slate-800 dark:text-white text-sm">One to Many</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Most common. E.g., User has many Posts.</div>
                        </button>

                        <button 
                            onClick={() => setType('N:M')}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${type === 'N:M' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-800'}`}
                        >
                            <div className="mb-2 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                <ArrowLeftRight size={16} />
                            </div>
                            <div className="font-bold text-slate-800 dark:text-white text-sm">Many to Many</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Requires pivot table. E.g., User has many Roles.</div>
                        </button>
                    </div>

                    {/* Configuration Summary */}
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">Automated Actions</h4>
                        
                        <div className="space-y-3">
                            {type === '1:N' && (
                                <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                                    <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">✓</div>
                                    <div>
                                        Add column <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded text-slate-900 dark:text-white font-mono">{sourceFk}</code> to <strong>{targetName}</strong> table.
                                    </div>
                                </div>
                            )}
                            
                            {type === '1:1' && (
                                <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                                    <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">✓</div>
                                    <div>
                                        Add unique column <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded text-slate-900 dark:text-white font-mono">{targetFk}</code> to <strong>{sourceName}</strong> table.
                                    </div>
                                </div>
                            )}

                            {type === 'N:M' && (
                                <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                                    <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">✓</div>
                                    <div>
                                        Create pivot table <strong>{pivotName}</strong> with <code className="font-mono">{sourceFk}</code> and <code className="font-mono">{targetFk}</code>.
                                    </div>
                                </div>
                            )}

                             <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                                <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">✓</div>
                                <div>
                                    Create Foreign Key constraints (Delete: Cascade).
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={() => onSubmit(type, { cascade })}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-500/30 transition-all"
                    >
                        Create Relationship
                    </button>
                </div>
            </div>
        </div>
    );
}