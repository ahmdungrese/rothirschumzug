"use client";
import { XMarkIcon } from '@heroicons/react/24/outline';

export function Modal({ onClose, children, maxWidth = 'max-w-lg' }: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className={`relative bg-bg-panel border border-structure rounded-2xl w-full ${maxWidth} shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-text-muted hover:text-text-main transition-colors bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-full p-1"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
