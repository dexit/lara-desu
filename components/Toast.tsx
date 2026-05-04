
import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer = ({ toasts, removeToast }: ToastProps) => {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
      ))}
    </div>
  );
};

const ToastItem = ({ toast, removeToast }: { toast: ToastMessage; removeToast: (id: string) => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [toast, removeToast]);

  const styles = {
    success: 'bg-emerald-600 dark:bg-emerald-600',
    error: 'bg-red-600 dark:bg-red-600',
    info: 'bg-indigo-600 dark:bg-indigo-600',
  };

  const icons = {
    success: <CheckCircle size={18} />,
    error: <AlertCircle size={18} />,
    info: <Info size={18} />,
  };

  return (
    <div className={`${styles[toast.type]} text-white px-4 py-3 rounded-xl shadow-lg shadow-black/10 flex items-center gap-3 pointer-events-auto animate-in slide-in-from-right-full fade-in duration-300 max-w-sm`}>
      <div className="flex-shrink-0">{icons[toast.type]}</div>
      <p className="text-sm font-medium">{toast.message}</p>
      <button 
        onClick={() => removeToast(toast.id)} 
        className="ml-auto hover:bg-white/20 p-1 rounded transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
};
