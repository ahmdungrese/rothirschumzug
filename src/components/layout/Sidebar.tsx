"use client";
import { useState, useEffect } from 'react';
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
  TruckIcon,
  ChevronLeftIcon,
  ChevronRightIcon
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
  const [isSlim, setIsSlim] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('rothirsch_sidebar_slim');
      if (saved !== null) {
        setIsSlim(saved === 'true');
      }
    } catch {}
  }, []);

  const toggleSlim = () => {
    setIsSlim(prev => {
      const next = !prev;
      try { localStorage.setItem('rothirsch_sidebar_slim', String(next)); } catch {}
      return next;
    });
  };
  
  const filteredNavItems = navItems.filter(item => item.roles.includes(profile?.role || 'teamlead'));

  return (
    <>
      {/* Mobile overlay (for phones only < 768px) */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar:
          - Phone (< 768px): Slide-over drawer on hamburger tap
          - Tablet Portrait (768px - 1023px): Statically docked Slim Icon Rail (68px) — icons only!
          - Desktop / Tablet Landscape (>= 1024px): Statically docked, either Slim (68px) or Full (256px)
      */}
      <aside className={`
        flex md:static md:inset-0 fixed inset-y-0 left-0 z-50 flex-col bg-bg-dark md:bg-bg-panel border-r border-structure transform transition-all duration-300 ease-in-out md:translate-x-0 shrink-0
        ${isOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full'}
        md:w-[68px] ${isSlim ? 'lg:w-[68px]' : 'lg:w-64'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-3 border-b border-structure" style={{ backgroundColor: 'var(--lm-sidebar-header)' }}>
          {/* Phone Drawer Header (< md): full logo + close X */}
          <div className="flex md:hidden items-center justify-between w-full">
            <Image 
              src="/Rothirsch.png" 
              alt="Rothirsch Logo" 
              width={130} 
              height={34} 
              className="object-contain" 
              priority 
            />
            <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-text-main p-1.5 rounded-lg hover:bg-structure/40">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Tablet Portrait Header (md to lg): ONLY compact deer emblem centered */}
          <div className="hidden md:flex lg:hidden w-full items-center justify-center">
            <div className="w-9 h-9 overflow-hidden flex items-center justify-start rounded-lg">
              <Image 
                src="/Rothirsch.png" 
                alt="Rothirsch" 
                width={120} 
                height={36} 
                className="object-contain max-w-none h-8 w-auto -ml-0.5" 
                priority 
              />
            </div>
          </div>

          {/* Desktop / Landscape Header (lg+): Full logo + collapse or Compact emblem + expand */}
          <div className="hidden lg:flex items-center justify-between w-full">
            {isSlim ? (
              <div className="w-full flex items-center justify-center">
                <button 
                  type="button"
                  onClick={toggleSlim}
                  title="Sidebar vergrößern"
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-structure/40 hover:bg-structure text-text-main transition-colors cursor-pointer"
                >
                  <ChevronRightIcon className="w-4 h-4 text-primary" />
                </button>
              </div>
            ) : (
              <>
                <Image 
                  src="/Rothirsch.png" 
                  alt="Rothirsch Logo" 
                  width={140} 
                  height={36} 
                  className="object-contain" 
                  priority 
                />
                <button 
                  type="button"
                  onClick={toggleSlim}
                  title="Sidebar einklappen (Slim Modus)"
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-structure text-text-muted hover:text-text-main transition-colors cursor-pointer"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Navigation Items (Icons only on tablet portrait!) */}
        <nav className="p-2 space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                id={item.id}
                href={item.href}
                title={item.name}
                className={`flex items-center rounded-xl transition-all ${
                  isSlim 
                    ? 'justify-center p-3 w-full' 
                    : 'md:justify-center lg:justify-start gap-3 p-3 lg:px-3.5 lg:py-2.5'
                } ${
                  isActive 
                    ? 'sidebar-active text-[#527048] dark:text-[#A8C69F] font-bold shadow-sm' 
                    : 'text-text-muted hover:bg-structure/60 hover:text-text-main font-medium'
                }`}
                onClick={() => setIsOpen(false)}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#6E8F64] dark:text-[#A8C69F]' : ''}`} />
                {/* Text is hidden on tablet portrait (md to lg), shown on phone drawer and expanded desktop */}
                <span className={`font-display text-sm truncate ${isSlim ? 'hidden' : 'inline md:hidden lg:inline'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* System Version & Collapse Footer */}
        <div className="p-3 border-t border-structure bg-bg-dark/50 flex items-center justify-center md:justify-center lg:justify-between text-xs text-text-muted">
          {/* Phone Drawer (< md): full text + badge */}
          <div className="flex md:hidden items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#6E8F64] animate-pulse shrink-0" />
              <span className="font-semibold text-[11px] text-text-main truncate">Rothirsch ERP</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20 text-[10px] font-mono shrink-0">
              v2.5.0
            </span>
          </div>

          {/* Tablet Portrait (md to lg): compact v2.5 badge centered */}
          <div className="hidden md:flex lg:hidden items-center justify-center w-full">
            <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20 text-[9px] font-mono">
              v2.5
            </span>
          </div>

          {/* Desktop / Landscape (lg+) */}
          <div className="hidden lg:flex items-center justify-between w-full">
            {isSlim ? (
              <button
                type="button"
                onClick={toggleSlim}
                title="Sidebar ausklappen"
                className="p-1 rounded-lg hover:bg-structure text-text-muted hover:text-primary transition-colors cursor-pointer w-full text-center"
              >
                <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20 text-[9px] font-mono">
                  v2.5
                </span>
              </button>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#6E8F64] animate-pulse shrink-0" />
                  <span className="font-semibold text-[11px] text-text-main truncate">Rothirsch ERP</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20 text-[10px] font-mono shrink-0">
                  v2.5.0
                </span>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
