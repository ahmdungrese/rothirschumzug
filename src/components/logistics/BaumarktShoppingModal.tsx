"use client";

import React, { useState, useMemo } from 'react';
import { 
  XMarkIcon, 
  ShoppingCartIcon, 
  CheckIcon, 
  PlusIcon, 
  TrashIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface BaumarktShoppingModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
}

interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
}

export function BaumarktShoppingModal({ isOpen, onClose, order }: BaumarktShoppingModalProps) {
  // Aggregate initial materials from order
  const initialItems = useMemo<ShoppingItem[]>(() => {
    if (!order) return [];

    const itemMap = new Map<string, ShoppingItem>();

    const addOrUpdate = (name: string, qty: number, unit: string = 'Stk') => {
      const cleanName = name.trim();
      if (!cleanName || qty <= 0) return;
      const key = cleanName.toLowerCase();
      if (itemMap.has(key)) {
        itemMap.get(key)!.quantity += qty;
      } else {
        itemMap.set(key, {
          id: `item-${Date.now()}-${Math.random()}`,
          name: cleanName,
          quantity: qty,
          unit,
          checked: false
        });
      }
    };

    // 1. From services
    if (Array.isArray(order.services)) {
      order.services.forEach((s: any) => {
        const n = (s.name || '').toLowerCase();
        if (n.includes('karton') || n.includes('box') || n.includes('kleider') || n.includes('seide') || n.includes('folie') || n.includes('klebeband') || n.includes('pack')) {
          addOrUpdate(s.name, s.quantity || 1, s.unit || 'Stk');
        }
      });
    }

    // 2. From materials
    if (Array.isArray(order.materials)) {
      order.materials.forEach((m: any) => {
        addOrUpdate(m.name || 'Packmittel', m.quantity || 1, m.unit || 'Stk');
      });
    }

    // 3. From inventory (e.g. Umzugskarton, Kleiderbox, Bücherkarton)
    if (Array.isArray(order.inventory)) {
      order.inventory.forEach((i: any) => {
        const n = (i.name || '').toLowerCase();
        if (n.includes('karton') || n.includes('kleiderbox') || n.includes('bücherkarton')) {
          addOrUpdate(i.name, i.quantity || 1, 'Stk');
        }
      });
    }

    // If nothing found, provide sensible standard defaults for moving
    if (itemMap.size === 0) {
      addOrUpdate('Standard-Umzugskarton', 30, 'Stk');
      addOrUpdate('Bücherkarton (schwer)', 10, 'Stk');
      addOrUpdate('Kleiderbox (mit Stange)', 3, 'Stk');
      addOrUpdate('Rollen Klebeband', 3, 'Rollen');
      addOrUpdate('Stretchfolie / Polsterfolie', 1, 'Rolle');
    }

    return Array.from(itemMap.values());
  }, [order]);

  const [items, setItems] = useState<ShoppingItem[]>(initialItems);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);

  if (!isOpen || !order) return null;

  const toggleCheck = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        name: newItemName.trim(),
        quantity: newItemQty || 1,
        unit: 'Stk',
        checked: false
      }
    ]);
    setNewItemName('');
    setNewItemQty(1);
  };

  const checkedCount = items.filter(i => i.checked).length;
  const totalCount = items.length;

  const generateShoppingText = () => {
    const cust = order.customerName || 'Kunde';
    const orderNum = order.orderNumber || (order.id ? `#${order.id.slice(-5).toUpperCase()}` : '');
    let text = `🛒 Baumarkt-Einkaufszettel für ${orderNum} (${cust}):\n\n`;
    items.forEach(item => {
      text += `${item.checked ? '✅' : '⬜'} ${item.quantity}x ${item.name} (${item.unit})\n`;
    });
    text += `\nRothirsch Logistik`;
    return text;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateShoppingText());
    toast.success('Einkaufszettel in die Zwischenablage kopiert!');
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(generateShoppingText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <ShoppingCartIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-headline text-slate-900 dark:text-white">
                Baumarkt-Einkaufszettel
              </h3>
              <p className="text-xs text-slate-500">
                {order.customerName} • {checkedCount} von {totalCount} erledigt
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5">
          <div 
            className="bg-emerald-500 h-1.5 transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
          />
        </div>

        {/* List of Items */}
        <div className="p-5 overflow-y-auto flex-1 space-y-2.5">
          {items.map(item => (
            <div 
              key={item.id}
              onClick={() => toggleCheck(item.id)}
              className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer select-none ${
                item.checked 
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 opacity-75' 
                  : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                  item.checked 
                    ? 'bg-emerald-500 border-emerald-500 text-white' 
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                }`}>
                  {item.checked && <CheckIcon className="w-4 h-4" />}
                </div>
                <div>
                  <span className={`text-sm font-bold block ${
                    item.checked 
                      ? 'line-through text-slate-400 dark:text-slate-500' 
                      : 'text-slate-900 dark:text-white'
                  }`}>
                    {item.quantity}x {item.name}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Einheit: {item.unit}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(item.id);
                }}
                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                title="Entfernen"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Quick Add Custom Item */}
          <form onSubmit={handleAddItem} className="pt-3 flex gap-2">
            <input
              type="number"
              min="1"
              value={newItemQty}
              onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
              className="w-16 px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-center font-bold"
            />
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Weiteres Material hinzufügen (z.B. Klebeband)..."
              className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-bold flex items-center gap-1 hover:brightness-110"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="In Zwischenablage kopieren"
            >
              <ClipboardDocumentIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Kopieren</span>
            </button>
            <button
              type="button"
              onClick={handleWhatsApp}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Per WhatsApp senden"
            >
              <ChatBubbleLeftRightIcon className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            Fertig
          </button>
        </div>

      </div>
    </div>
  );
}
