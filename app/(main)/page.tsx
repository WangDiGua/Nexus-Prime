'use client';

import React from 'react';
import CapabilityHub from '@/components/layout/CapabilityHub';
import NexusChat from '@/components/layout/NexusChat';
import { Settings, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="w-[280px] shrink-0">
        <CapabilityHub />
      </div>

      <div className="flex-1 min-w-0">
        <NexusChat />
      </div>

      <div className="fixed top-4 right-4 flex items-center gap-2 z-50">
        <Link
          href="/settings"
          className="p-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-muted-foreground hover:text-foreground transition-all backdrop-blur-sm border border-border"
        >
          <Settings size={18} />
        </Link>
        <button
          onClick={handleLogout}
          className="p-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 hover:bg-red-500/10 dark:hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-all backdrop-blur-sm border border-border"
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}
