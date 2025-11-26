
import React, { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { Copy, Trash2, Edit, Plus, Layout } from 'lucide-react';

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
  onLayout
}: ContextMenuProps) {
  const { project } = useReactFlow();

  const handleAction = useCallback((action: () => void) => {
      action();
      onClose();
  }, [onClose]);

  return (
    <div
      style={{ top, left }}
      className="absolute z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg overflow-hidden min-w-[160px] py-1 animate-in fade-in zoom-in-95 duration-100"
    >
        {type === 'node' && targetId && (
            <>
                <button
                    onClick={() => handleAction(() => onEdit?.(targetId))}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                    <Edit size={14} /> Edit Table
                </button>
                 <button
                    onClick={() => handleAction(() => onDuplicate?.(targetId))}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                    <Copy size={14} /> Duplicate
                </button>
                <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                <button
                    onClick={() => handleAction(() => onDelete?.(targetId))}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                    <Trash2 size={14} /> Delete
                </button>
            </>
        )}

        {type === 'pane' && (
             <>
                <button
                    onClick={() => {
                        // Project screen coordinates to flow coordinates
                        const { x, y } = project({ x: left, y: top });
                        handleAction(() => onAddTable?.(x, y));
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                    <Plus size={14} /> New Table Here
                </button>
                 <button
                    onClick={() => handleAction(() => onLayout?.())}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                    <Layout size={14} /> Auto Layout
                </button>
             </>
        )}
    </div>
  );
}
