"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  HomeIcon, 
  UsersIcon, 
  DocumentTextIcon, 
  BanknotesIcon, 
  Cog6ToothIcon,
  XMarkIcon,
  ArchiveBoxIcon,
  CalendarDaysIcon,
  ShieldExclamationIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import Image from 'next/image';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', id: 'nav-dashboard', icon: HomeIcon, roles: ['admin', 'office'] },
  { name: 'Kalender', href: '/dashboard/calendar', id: 'nav-calendar', icon: CalendarDaysIcon, roles: ['admin', 'office', 'teamlead'] },
  { name: 'Kunden', href: '/dashboard/customers', id: 'nav-customers', icon: UsersIcon, roles: ['admin', 'office'] },
  { name: 'Aufträge', href: '/dashboard/orders', id: 'nav-orders', icon: DocumentTextIcon, roles: ['admin', 'office'] },
  { name: 'Reklamationen', href: '/dashboard/claims', id: 'nav-claims', icon: ShieldExclamationIcon, roles: ['admin', 'office'] },
  { name: 'Offene Rechnungen', href: '/dashboard/finances', id: 'nav-finances', icon: BanknotesIcon, roles: ['admin', 'office'] },
  { name: 'Auswertungen', href: '/dashboard/statistics', id: 'nav-statistics', icon: ChartBarIcon, roles: ['admin'] },
  { name: 'Archiv', href: '/dashboard/archive', id: 'nav-archive', icon: ArchiveBoxIcon, roles: ['admin'] },
  { name: 'Einstellungen', href: '/dashboard/settings', id: 'nav-settings', icon: Cog6ToothIcon, roles: ['admin'] },
];

export function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (val: boolean) => void }) {
  const pathname = usePathname();
  const { profile } = useAuth();
  
  const filteredNavItems = navItems.filter(item => item.roles.includes(profile?.role || 'teamlead'));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar - Hidden on mobile entirely now */}
      <aside className={`
        hidden md:flex md:static md:inset-0 fixed inset-y-0 left-0 z-50 w-64 flex-col bg-bg-panel border-r border-structure transform transition-transform duration-300 ease-in-out md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-structure">
          <Image src="/Rothirsch.png" alt="Rothirsch Logo" width={150} height={40} className="object-contain" priority />
          <button onClick={() => setIsOpen(false)} className="md:hidden text-text-muted hover:text-text-main">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <nav className="p-4 space-y-2">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                id={item.id}
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

        {typeof window !== 'undefined' && localStorage.getItem('demoMode') === 'true' && (
          <div className="mt-auto p-4 border-t border-structure">
            <button 
              id="demo-reset-btn"
              onClick={async () => {
                if(confirm('Demo-Datenbank wirklich neu generieren?')) {
                  const res = await fetch('/api/seed-demo', { method: 'POST' });
                  if(res.ok) {
                    alert('Erfolgreich zurückgesetzt! Lade Seite neu...');
                    window.location.reload();
                  }
                }
              }}
              className="w-full btn-secondary text-xs bg-red-900/20 text-red-400 border-red-500/30 hover:bg-red-500 hover:text-white transition-colors"
            >
              Demo-Daten zurücksetzen
            </button>
            <button 
              onClick={() => {
                localStorage.removeItem('rothirsch_tutorial_completed');
                window.location.reload();
              }}
              className="w-full mt-2 btn-secondary text-xs bg-blue-900/20 text-blue-400 border-blue-500/30 hover:bg-blue-500 hover:text-white transition-colors py-2"
            >
              Tutorial neu starten
            </button>
            <button 
              onClick={() => {
                localStorage.removeItem('demoMode');
                window.location.href = '/';
              }}
              className="w-full mt-2 text-xs text-text-muted hover:text-white text-center py-2"
            >
              Demo-Modus beenden
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
