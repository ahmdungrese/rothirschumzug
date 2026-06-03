"use client";
import { OrderEditor } from '@/components/orders/OrderEditor';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function NewOrderPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="p-2 bg-bg-dark rounded-full hover:bg-structure transition-colors">
          <ArrowLeftIcon className="w-5 h-5 text-text-muted" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Neues Angebot erstellen</h1>
          <p className="text-text-muted mt-1">Geben Sie die Kundendaten ein (Seamless Flow). Der Kunde wird beim Speichern automatisch angelegt.</p>
        </div>
      </div>
      <OrderEditor />
    </div>
  );
}
