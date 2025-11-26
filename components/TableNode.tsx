import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { TableData, LaravelColumnType } from '../types';
import { Key, Settings, Trash2, Link } from 'lucide-react';

// Define the data prop type
type TableNodeProps = NodeProps<TableData & { 
    onEdit: (id: string) => void;
    onDelete: (id: string) => void; 
}>;

const TableNode = ({ id, data }: TableNodeProps) => {
  return (
    <div className="min-w-[250px] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden font-sans group/node">
      {/* Header */}
      <div 
        className="relative px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors"
        style={{ backgroundColor: data.color || '#eef2ff' }}
      >
        {/* Connection Handle for Table-to-Table linking */}
        <Handle 
            type="source" 
            position={Position.Top} 
            id="table-handle"
            className="!w-4 !h-2 !rounded-sm !bg-indigo-500 !-top-1 opacity-0 group-hover/node:opacity-100 transition-opacity z-10 cursor-crosshair"
        />
        <Handle 
            type="target" 
            position={Position.Top} 
            id="table-target"
            className="!w-full !h-full !rounded-none !bg-transparent !top-0 !left-0 z-0"
            isConnectableStart={false}
        />

        <div className="font-bold text-slate-800 dark:text-slate-900 truncate relative z-10">
            {data.name}
        </div>
        <div className="flex gap-1 relative z-10">
            <button 
                onClick={() => data.onEdit(id)}
                className="p-1 hover:bg-black/10 rounded text-slate-600 dark:text-slate-800 transition-colors"
                title="Edit Table"
            >
                <Settings size={14} />
            </button>
             <button 
                onClick={() => data.onDelete(id)}
                className="p-1 hover:bg-red-500/20 hover:text-red-700 rounded text-slate-600 dark:text-slate-800 transition-colors"
                 title="Delete Table"
            >
                <Trash2 size={14} />
            </button>
        </div>
      </div>

      {/* Columns List */}
      <div className="p-2 space-y-1">
        {data.columns.map((col) => (
          <div key={col.id} className="group flex items-center justify-between text-sm px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded cursor-default relative">
            <div className="flex items-center gap-2 overflow-hidden">
                {col.type === LaravelColumnType.ID ? (
                    <Key size={12} className="text-yellow-500 flex-shrink-0" />
                ) : col.type === LaravelColumnType.FOREIGN_ID ? (
                     <Key size={12} className="text-blue-500 flex-shrink-0" />
                ) : (
                    <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-600 flex-shrink-0" />
                )}
                <span className={`truncate ${col.type === LaravelColumnType.ID ? 'font-semibold' : ''} dark:text-slate-200`}>
                    {col.name}
                </span>
            </div>
            <div className="text-xs text-slate-400 font-mono ml-2">
                {col.type}
            </div>
            
            {/* Handles for connecting relations */}
            <Handle 
                type="source" 
                position={Position.Right} 
                id={`src-${col.id}`}
                className="!w-3 !h-3 !bg-slate-400 hover:!bg-indigo-500 hover:!w-4 hover:!h-4 transition-all opacity-0 group-hover:opacity-100 -right-1.5"
            />
             <Handle 
                type="target" 
                position={Position.Left} 
                id={`tgt-${col.id}`}
                className="!w-3 !h-3 !bg-slate-400 hover:!bg-indigo-500 hover:!w-4 hover:!h-4 transition-all opacity-0 group-hover:opacity-100 -left-1.5"
            />
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between text-xs text-slate-400 px-2">
            <span>{data.timestamps ? 'created_at, updated_at' : ''}</span>
            <span>{data.softDeletes ? 'deleted_at' : ''}</span>
        </div>
      </div>
    </div>
  );
};

export default memo(TableNode);