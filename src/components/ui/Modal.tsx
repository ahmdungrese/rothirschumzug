"use client";
import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useModalBackHandler } from '@/hooks/useModalBackHandler';

export function Modal({ onClose, children, maxWidth = 'max-w-lg', title }: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  title?: string;
}) {
  // Mobile hardware/gesture back button automatically closes the modal without leaving the page
  useModalBackHandler(true, onClose, 'ui-modal');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className={`relative bg-bg-panel border border-structure rounded-2xl w-full ${maxWidth} shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto`}>
        {title && (
          <div className="px-6 pt-5 pb-3 border-b border-structure flex items-center justify-between">
            <h3 className="font-headline font-bold text-base text-text-main">{title}</h3>
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-text-muted hover:text-text-main transition-colors bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-full p-1 cursor-pointer"
          title="Schließen"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
