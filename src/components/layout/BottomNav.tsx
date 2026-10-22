"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, TruckIcon, UsersIcon, CalendarDaysIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { HomeIcon as HomeSolid, TruckIcon as TruckSolid, UsersIcon as UsersSolid, CalendarDaysIcon as CalendarDaysSolid, QuestionMarkCircleIcon as QuestionMarkCircleSolid } from '@heroicons/react/24/solid';
import { useAuth } from '@/context/AuthContext';
import { triggerHaptic } from '@/lib/haptics';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, activeIcon: HomeSolid, roles: ['admin', 'office'] },
  { name: 'Logistik', href: '/dashboard/logistics', icon: TruckIcon, activeIcon: TruckSolid, roles: ['admin', 'office'] },
  { name: 'Kunde', href: '/dashboard/customers', icon: UsersIcon, activeIcon: UsersSolid, roles: ['admin', 'office'] },
  { name: 'Kalender', href: '/dashboard/calendar', icon: CalendarDaysIcon, activeIcon: CalendarDaysSolid, roles: ['admin', 'office', 'teamlead'] },
  { name: 'Handbuch', href: '/dashboard/manual', icon: QuestionMarkCircleIcon, activeIcon: QuestionMarkCircleSolid, roles: ['teamlead'] },
];

export function BottomNav() {
  const pathname = usePathname();
  const { profile } = useAuth();

  // Hide completely on editor / wizard pages where a full-width docked action bar exists
  const isEditorPage = pathname.includes('/edit-order') ||
    pathname.includes('/new-offer') ||
    pathname.includes('/new-invoice') ||
    pathname.includes('/edit-invoice') ||
    pathname.includes('/orders/new') ||
    pathname.includes('/inventory');

  if (isEditorPage) return null;

  const filteredNavigation = navigation.filter(item => item.roles.includes(profile?.role || 'teamlead'));

  return (
    <div className="md:hidden shrink-0 w-full bg-bg-dark/98 backdrop-blur-md border-t border-structure pb-[max(0.25rem,env(safe-area-inset-bottom))] z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
      <nav className="flex justify-around items-center h-15 px-2">
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = isActive ? item.activeIcon : item.icon;
          
          return (
            <Link 
              key={item.name} 
              href={item.href}
              onClick={() => triggerHaptic('light')}
              className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors select-none active:scale-95 ${
                isActive ? 'text-primary' : 'text-text-muted hover:text-text-main'
              }`}
            >
              <div className={`relative p-1 rounded-full ${isActive ? 'bg-primary/10' : ''}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium tracking-wide">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
