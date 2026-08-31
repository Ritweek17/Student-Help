import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Compass, BookOpen, Calendar, User } from 'lucide-react';
import { Sidebar } from './Sidebar';

export function MobileNav({ isOpen, onClose }) {
  const location = useLocation();

  const bottomNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Discover', path: '/opportunities', icon: Compass },
    { label: 'Learning', path: '/learning', icon: BookOpen },
    { label: 'Calendar', path: '/calendar', icon: Calendar },
    { label: 'Profile', path: '/profile', icon: User }
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop & Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 shadow-2xl z-10 animate-slideRight">
            <Sidebar onCloseMobile={onClose} />
          </div>
        </div>
      )}

      {/* Mobile Bottom Fixed Quick Nav Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-40 px-2 flex items-center justify-around">
        {bottomNavItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'));

          return (
            <NavLink
              key={idx}
              to={item.path}
              className={({ isActive: linkActive }) => {
                const active = isActive || linkActive;
                return `flex flex-col items-center justify-center w-full h-full py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? 'text-blue-700 dark:text-blue-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`;
              }}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
