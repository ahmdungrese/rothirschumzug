"use client";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function SlideOver({ isOpen, onClose, title, children }: SlideOverProps) {
  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 z-40 transition-opacity backdrop-blur-sm" 
        onClick={onClose}
      />
      <div className={`
        fixed inset-y-0 right-0 z-50 w-full sm:w-[450px] bg-bg-panel border-l border-structure shadow-2xl transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="flex items-center justify-between p-6 border-b border-structure bg-bg-dark/50">
          <h2 className="text-xl font-semibold text-text-main tracking-tight">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-main hover:bg-structure p-2 rounded-full transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto h-[calc(100vh-85px)]">
          {children}
        </div>
      </div>
    </>
  );
}
