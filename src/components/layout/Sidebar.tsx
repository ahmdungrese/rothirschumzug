"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
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
  ChartBarIcon,
  QuestionMarkCircleIcon,
  TruckIcon
} from '@heroicons/react/24/outline';
import Image from 'next/image';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', id: 'nav-dashboard', icon: HomeIcon, roles: ['admin', 'office'] },
  { name: 'Logistik', href: '/dashboard/logistics', id: 'nav-logistics', icon: TruckIcon, roles: ['admin', 'office'] },
  { name: 'Kalender', href: '/dashboard/calendar', id: 'nav-calendar', icon: CalendarDaysIcon, roles: ['admin', 'office', 'teamlead'] },
  { name: 'Kunden', href: '/dashboard/customers', id: 'nav-customers', icon: UsersIcon, roles: ['admin', 'office'] },
  { name: 'Angebote', href: '/dashboard/orders', id: 'nav-orders', icon: DocumentTextIcon, roles: ['admin', 'office'] },
  { name: 'Reklamationen', href: '/dashboard/claims', id: 'nav-claims', icon: ShieldExclamationIcon, roles: ['admin', 'office'] },
  { name: 'Rechnungen', href: '/dashboard/finances', id: 'nav-finances', icon: BanknotesIcon, roles: ['admin', 'office'] },
  { name: 'Auswertungen', href: '/dashboard/statistics', id: 'nav-statistics', icon: ChartBarIcon, roles: ['admin'] },
  { name: 'Archiv', href: '/dashboard/archive', id: 'nav-archive', icon: ArchiveBoxIcon, roles: ['admin'] },
  { name: 'Einstellungen', href: '/dashboard/settings', id: 'nav-settings', icon: Cog6ToothIcon, roles: ['admin'] },
  { name: 'Handbuch', href: '/dashboard/manual', id: 'nav-manual', icon: QuestionMarkCircleIcon, roles: ['admin', 'office', 'teamlead'] },
];

export function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (val: boolean) => void }) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const { theme } = useTheme();
  
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

      {/* Sidebar - SlideOver on mobile, static on desktop */}
      <aside className={`
        flex md:static md:inset-0 fixed inset-y-0 left-0 z-50 w-64 flex-col bg-bg-dark md:bg-bg-panel border-r border-structure transform transition-transform duration-300 ease-in-out md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-structure" style={{ backgroundColor: 'var(--lm-sidebar-header)' }}>
          <Image 
            src="/Rothirsch.png" 
            alt="Rothirsch Logo" 
            width={150} 
            height={40} 
            className="object-contain" 
            priority 
          />
          <button onClick={() => setIsOpen(false)} className="md:hidden text-text-muted hover:text-text-main">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                id={item.id}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? 'sidebar-active text-[#D91E2A] dark:text-red-400 font-bold shadow-sm' 
                    : 'text-text-muted hover:bg-structure/60 hover:text-text-main font-medium'
                }`}
                onClick={() => setIsOpen(false)}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-[#D91E2A] dark:text-red-400' : ''}`} />
                <span className="font-display text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* System Version Footer */}
        <div className="p-3.5 border-t border-structure bg-bg-dark/50 flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-[11px] text-text-main">Rothirsch ERP</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20 text-[10px] font-mono">
            v2.4.0
          </span>
        </div>
      </aside>
    </>
  );
}
