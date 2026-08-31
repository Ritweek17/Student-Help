import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { TopHeader } from '../components/layout/TopHeader';
import { MobileNav } from '../components/layout/MobileNav';
import { CommandPalette } from '../components/cards/CommandPalette';
import { CommandProvider } from '../context/CommandContext';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <CommandProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row transition-colors">
        {/* Desktop Sidebar (Left) */}
        <div className="hidden lg:block w-64 shrink-0 h-screen sticky top-0 z-40">
          <Sidebar />
        </div>

        {/* Mobile Navigation Drawer & Bottom Bar */}
        <MobileNav isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        {/* Main Content Area (Right) */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-16 lg:pb-0">
          <TopHeader onOpenMobile={() => setMobileOpen(true)} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fadeIn">
            <Outlet />
          </main>
        </div>

        {/* Global Search / Cmd+K Palette */}
        <CommandPalette />
      </div>
    </CommandProvider>
  );
}
