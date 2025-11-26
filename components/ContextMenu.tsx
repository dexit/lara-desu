import React, { useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from 'reactflow';
import { Copy, Trash2, Edit, Plus, Layout, GitMerge, Link } from 'lucide-react';

interface ContextMenuProps {
  id: string;
  top: number;
  left: number;
  right: number;
  bottom: number;
  type: 'node' | 'pane' | 'edge';
  targetId?: string;
  onClose: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onAddTable?: (x: number, y: number) => void;
  onLayout?: () => void;
  onStartRelation?: (id: string) => void;
}

export default function ContextMenu({
  top,
  left,
  type,
  targetId,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
  onAddTable,
  onLayout,
  onStartRelation
}: ContextMenuProps) {
  const { project } = useReactFlow();
  const menuRef = useRef<HTMLDivElement>(null);

  const handleAction = useCallback((action: () => void) => {
      action();
      onClose();
  }, [onClose]);
  
  // Adjust position to stay in viewport
  const style = {
      top,
      left,
  };
  
  // If too close to bottom, move up
  if (window.innerHeight - top < 200) {
      style.top = top - 150;
  }
  // If too close to right, move left
  if (window.innerWidth - left < 200) {
      style.left = left - 150;
  }

  return (
    <div
      ref={menuRef}
      style={style}
      className="absolute z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg overflow-hidden min-w-[180px] py-1 animate-in fade-in zoom-in-95 duration-100 font-sans"
    >
        {type === 'node' && targetId && (
            <>
                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 mb-1">
                    Table Actions
                </div>
                <button
                    onClick={() => handleAction(() => onEdit?.(targetId))}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors"
                >
                    <Edit size={16} className="text-indigo-500" /> Edit Table
                </button>
                 <button
                    onClick={() => handleAction(() => onDuplicate?.(targetId))}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors"
                >
                    <Copy size={16} className="text-blue-500" /> Duplicate
                </button>
                
                <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                
                <button
                    onClick={() => handleAction(() => onDelete?.(targetId))}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors"
                >
                    <Trash2 size={16} /> Delete
                </button>
            </>
        )}

        {type === 'pane' && (
             <>
                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 mb-1">
                    Canvas Actions
                </div>
                <button
                    onClick={() => {
                        const { x, y } = project({ x: left, y: top });
                        handleAction(() => onAddTable?.(x, y));
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors"
                >
                    <Plus size={16} className="text-indigo-500" /> New Table Here
                </button>
                 <button
                    onClick={() => handleAction(() => onLayout?.())}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors"
                >
                    <Layout size={16} className="text-slate-500" /> Auto Layout
                </button>
             </>
        )}
    </div>
  );
}