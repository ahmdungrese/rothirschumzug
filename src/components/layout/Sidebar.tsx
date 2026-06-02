"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HomeIcon, 
  UsersIcon, 
  DocumentTextIcon, 
  BanknotesIcon, 
  Cog6ToothIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Image from 'next/image';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Kunden', href: '/dashboard/customers', icon: UsersIcon },
  { name: 'Aufträge', href: '/dashboard/orders', icon: DocumentTextIcon },
  { name: 'Finanzen', href: '/dashboard/finances', icon: BanknotesIcon },
  { name: 'Einstellungen', href: '/dashboard/settings', icon: Cog6ToothIcon },
];

export function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (val: boolean) => void }) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-bg-panel border-r border-structure transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-structure">
          <Image src="/Rothirsch.png" alt="Rothirsch Logo" width={150} height={40} className="object-contain" priority />
          <button onClick={() => setIsOpen(false)} className="md:hidden text-text-muted hover:text-text-main">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm' 
                    : 'text-text-muted hover:bg-structure hover:text-text-main'
                }`}
                onClick={() => setIsOpen(false)}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
