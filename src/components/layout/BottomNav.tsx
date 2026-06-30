"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, UsersIcon, DocumentTextIcon, Cog8ToothIcon } from '@heroicons/react/24/outline';
import { HomeIcon as HomeSolid, UsersIcon as UsersSolid, DocumentTextIcon as DocumentSolid, Cog8ToothIcon as CogSolid } from '@heroicons/react/24/solid';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, activeIcon: HomeSolid },
  { name: 'Kunden', href: '/dashboard/customers', icon: UsersIcon, activeIcon: UsersSolid },
  { name: 'Angebote', href: '/dashboard/orders', icon: DocumentTextIcon, activeIcon: DocumentSolid },
  { name: 'Settings', href: '/dashboard/settings', icon: Cog8ToothIcon, activeIcon: CogSolid },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-dark border-t border-structure pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
      <nav className="flex justify-around items-center h-16 px-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = isActive ? item.activeIcon : item.icon;
          
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-primary' : 'text-text-muted hover:text-text-main'
              }`}
            >
              <div className={`relative p-1 rounded-full ${isActive ? 'bg-primary/10' : ''}`}>
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-medium tracking-wide">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
