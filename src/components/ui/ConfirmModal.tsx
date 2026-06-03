import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  confirmText = "Bestätigen", 
  cancelText = "Abbrechen", 
  onConfirm, 
  onCancel,
  isDestructive = true
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-panel border border-structure rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-full ${isDestructive ? 'bg-red-500/20 text-red-500' : 'bg-primary/20 text-primary'}`}>
              <ExclamationTriangleIcon className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
          </div>
          <p className="text-text-muted">{message}</p>
        </div>
        <div className="p-4 border-t border-structure bg-bg-dark flex justify-end gap-3">
          <button 
            onClick={onCancel} 
            className="btn-secondary"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onCancel(); // auto close
            }} 
            className={`btn-primary ${isDestructive ? '!bg-red-500 hover:!bg-red-600 border-none' : ''}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
