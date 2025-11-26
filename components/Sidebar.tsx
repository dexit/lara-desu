
import React, { useState } from 'react';
import { Node } from 'reactflow';
import { TableData, LaravelColumnType, Column } from '../types';
import { Trash2, Plus, X, ChevronDown, ChevronRight, HelpCircle, Link2, AlertCircle, List } from 'lucide-react';

interface SidebarProps {
  selectedNode?: Node<TableData>;
  onUpdateTable: (id: string, data: Partial<TableData>) => void;
  onClose: () => void;
}

export default function Sidebar({ selectedNode, onUpdateTable, onClose }: SidebarProps) {
  const [expandedCol, setExpandedCol] = useState<string | null>(null);

  if (!selectedNode) return null;

  const { data } = selectedNode;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateTable(selectedNode.id, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() });
  };

  const handleAddColumn = () => {
    const newCol: Column = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'new_column',
      type: LaravelColumnType.STRING,
      nullable: false,
      unique: false
    };
    onUpdateTable(selectedNode.id, { columns: [...data.columns, newCol] });
    setExpandedCol(newCol.id); // Auto expand new column
  };

  const handleUpdateColumn = (colId: string, updates: Partial<Column>) => {
    // If setting to 'set null', ensure column is nullable
    if (updates.onDelete === 'set null' || updates.onUpdate === 'set null') {
        updates.nullable = true;
    }
    
    const newCols = data.columns.map(c => c.id === colId ? { ...c, ...updates } : c);
    onUpdateTable(selectedNode.id, { columns: newCols });
  };

  const handleDeleteColumn = (colId: string) => {
    onUpdateTable(selectedNode.id, { columns: data.columns.filter(c => c.id !== colId) });
  };

  const handleOptionToggle = (key: 'timestamps' | 'softDeletes') => {
      onUpdateTable(selectedNode.id, { [key]: !data[key] });
  }

  return (
    <div className="w-96 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col h-full shadow-2xl z-20 transition-all duration-300 ease-in-out font-sans">
      <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
        <div>
            <h2 className="font-bold text-lg text-slate-800 dark:text-white">Table Settings</h2>
            <p className="text-xs text-slate-500">Configure schema definition</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700">
            <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 space-y-6">
            
            {/* Table Properties */}
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Table Name</label>
                    <input 
                        type="text" 
                        value={data.name} 
                        onChange={handleNameChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-white font-mono"
                        placeholder="e.g. users"
                    />
                </div>
                
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                        <input type="checkbox" checked={data.timestamps} onChange={() => handleOptionToggle('timestamps')} className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600" />
                        Timestamps
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                        <input type="checkbox" checked={data.softDeletes} onChange={() => handleOptionToggle('softDeletes')} className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600" />
                        Soft Deletes
                    </label>
                </div>
                
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Appearance</label>
                    <div className="flex gap-2">
                        {[
                            { c: '#eef2ff', n: 'Indigo' }, 
                            { c: '#f0fdf4', n: 'Green' }, 
                            { c: '#fef2f2', n: 'Red' }, 
                            { c: '#fffbeb', n: 'Amber' }, 
                            { c: '#f5f3ff', n: 'Purple' },
                            { c: '#ecfeff', n: 'Cyan' }
                        ].map(theme => (
                            <button 
                                key={theme.c}
                                onClick={() => onUpdateTable(selectedNode.id, { color: theme.c })}
                                className={`w-8 h-8 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm transition-transform hover:scale-110 ${data.color === theme.c ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-800' : ''}`}
                                style={{ backgroundColor: theme.c }}
                                title={theme.n}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-700" />

            {/* Columns Manager */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Columns ({data.columns.length})</label>
                    <button 
                        onClick={handleAddColumn}
                        className="text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                    >
                        <Plus size={14} /> ADD COLUMN
                    </button>
                </div>
                
                <div className="space-y-3">
                    {data.columns.map((col, idx) => {
                        const isForeignKey = col.type === LaravelColumnType.FOREIGN_ID || col.name.endsWith('_id');
                        
                        return (
                        <div key={col.id} className={`bg-white dark:bg-slate-900 border rounded-lg transition-all ${expandedCol === col.id ? 'border-indigo-500 ring-1 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}>
                            {/* Column Header */}
                            <div 
                                className="flex items-center gap-2 p-3 cursor-pointer"
                                onClick={() => setExpandedCol(expandedCol === col.id ? null : col.id)}
                            >
                                <div className="text-slate-400">
                                    {expandedCol === col.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-semibold dark:text-slate-200 truncate">{col.name}</span>
                                        {col.type === LaravelColumnType.ID && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 rounded font-bold">PK</span>}
                                        {isForeignKey && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded font-bold">FK</span>}
                                    </div>
                                    <div className="text-[10px] text-slate-500">{col.type}</div>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteColumn(col.id); }}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>

                            {/* Column Details (Expanded) */}
                            {expandedCol === col.id && (
                                <div className="px-3 pb-3 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-3 mt-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] uppercase text-slate-500 font-semibold">Name</label>
                                            <input 
                                                type="text"
                                                value={col.name}
                                                onChange={(e) => handleUpdateColumn(col.id, { name: e.target.value })}
                                                className="w-full mt-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:ring-1 focus:ring-indigo-500 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase text-slate-500 font-semibold">Type</label>
                                            <select
                                                value={col.type}
                                                onChange={(e) => handleUpdateColumn(col.id, { type: e.target.value })}
                                                className="w-full mt-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:ring-1 focus:ring-indigo-500 dark:text-white"
                                            >
                                                {Object.values(LaravelColumnType).map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {col.type === LaravelColumnType.ENUM && (
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-700">
                                            <label className="flex items-center gap-1 text-[10px] uppercase text-slate-500 font-semibold mb-1">
                                                <List size={10} /> Enum Values (comma separated)
                                            </label>
                                            <input 
                                                type="text"
                                                value={col.enumValues || ''}
                                                onChange={(e) => handleUpdateColumn(col.id, { enumValues: e.target.value })}
                                                placeholder="pending, active, suspended"
                                                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:ring-1 focus:ring-indigo-500 dark:text-white font-mono"
                                            />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2">
                                         <div>
                                            <label className="text-[10px] uppercase text-slate-500 font-semibold">Default</label>
                                            <input 
                                                type="text"
                                                value={col.default || ''}
                                                onChange={(e) => handleUpdateColumn(col.id, { default: e.target.value })}
                                                placeholder="NULL"
                                                className="w-full mt-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:ring-1 focus:ring-indigo-500 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase text-slate-500 font-semibold">Comment</label>
                                            <input 
                                                type="text"
                                                value={col.comment || ''}
                                                onChange={(e) => handleUpdateColumn(col.id, { comment: e.target.value })}
                                                placeholder="Description..."
                                                className="w-full mt-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:ring-1 focus:ring-indigo-500 dark:text-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-1">
                                         <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                                            <input 
                                                type="checkbox" 
                                                checked={col.nullable} 
                                                onChange={(e) => handleUpdateColumn(col.id, { nullable: e.target.checked })}
                                                className="rounded-sm text-indigo-600 focus:ring-0 w-3.5 h-3.5 border-slate-300" 
                                            />
                                            Nullable
                                        </label>
                                        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                                            <input 
                                                type="checkbox" 
                                                checked={col.unique} 
                                                onChange={(e) => handleUpdateColumn(col.id, { unique: e.target.checked })}
                                                className="rounded-sm text-indigo-600 focus:ring-0 w-3.5 h-3.5 border-slate-300" 
                                            />
                                            Unique
                                        </label>
                                         <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                                            <input 
                                                type="checkbox" 
                                                checked={col.index} 
                                                onChange={(e) => handleUpdateColumn(col.id, { index: e.target.checked })}
                                                className="rounded-sm text-indigo-600 focus:ring-0 w-3.5 h-3.5 border-slate-300" 
                                            />
                                            Index
                                        </label>
                                    </div>
                                    
                                    {/* Relationship Configuration */}
                                    {isForeignKey && (
                                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Link2 size={12} className="text-indigo-500" />
                                                <label className="text-[10px] uppercase text-indigo-600 dark:text-indigo-400 font-bold">Relationship Settings</label>
                                            </div>
                                            
                                            {/* Relationship Type */}
                                            <div className="flex bg-slate-100 dark:bg-slate-800 rounded p-1 mb-3">
                                                 <button
                                                    className={`flex-1 text-xs py-1 rounded transition-all ${!col.unique ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-white font-medium' : 'text-slate-500 dark:text-slate-400'}`}
                                                    onClick={() => handleUpdateColumn(col.id, { unique: false })}
                                                 >
                                                    One-to-Many
                                                 </button>
                                                 <button
                                                    className={`flex-1 text-xs py-1 rounded transition-all ${col.unique ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-white font-medium' : 'text-slate-500 dark:text-slate-400'}`}
                                                    onClick={() => handleUpdateColumn(col.id, { unique: true })}
                                                 >
                                                    One-to-One
                                                 </button>
                                            </div>
                                    
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] text-slate-400 mb-1 block">On Delete</label>
                                                    <select
                                                        value={col.onDelete || 'cascade'}
                                                        onChange={(e) => handleUpdateColumn(col.id, { onDelete: e.target.value })}
                                                        className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs dark:text-white focus:ring-1 focus:ring-indigo-500"
                                                    >
                                                        <option value="cascade">Cascade</option>
                                                        <option value="set null">Set Null</option>
                                                        <option value="restrict">Restrict</option>
                                                        <option value="no action">No Action</option>
                                                    </select>
                                                </div>
                                                 <div>
                                                    <label className="text-[10px] text-slate-400 mb-1 block">On Update</label>
                                                    <select
                                                         value={col.onUpdate || 'cascade'}
                                                        onChange={(e) => handleUpdateColumn(col.id, { onUpdate: e.target.value })}
                                                        className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs dark:text-white focus:ring-1 focus:ring-indigo-500"
                                                    >
                                                         <option value="cascade">Cascade</option>
                                                        <option value="set null">Set Null</option>
                                                        <option value="restrict">Restrict</option>
                                                        <option value="no action">No Action</option>
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            {col.onDelete === 'set null' && !col.nullable && (
                                                <div className="flex items-center gap-1.5 mt-2 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-1.5 rounded">
                                                    <AlertCircle size={10} />
                                                    <span>Set Null requires column to be nullable. (Auto-enabled)</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        )
                    })}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
