'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import CapabilityHub from '@/components/layout/CapabilityHub';
import NexusChat from '@/components/layout/NexusChat';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useAuth } from '@/components/auth/auth-provider';
import { MOBILE_BREAKPOINT } from '@/hooks/use-mobile';

export default function ChatPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  /**
   * `true` keeps the mobile drawer closed by default.
   * After mount, desktop viewports expand back to the regular sidebar width.
   */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const { openRegister } = useAuth();
  const activeConversationId = searchParams.get('conversation');

  useEffect(() => {
    const syncSidebarCollapsed = () => {
      setSidebarCollapsed(window.innerWidth < MOBILE_BREAKPOINT);
    };

    syncSidebarCollapsed();
    window.addEventListener('resize', syncSidebarCollapsed);
    return () => window.removeEventListener('resize', syncSidebarCollapsed);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('register') !== '1') return;
    openRegister();
    window.history.replaceState({}, '', '/chat');
  }, [openRegister]);

  const closeMobileSidebar = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT) {
      setSidebarCollapsed(true);
    }
  }, []);

  const setConversationInUrl = useCallback(
    (conversationId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (conversationId) {
        params.set('conversation', conversationId);
      } else {
        params.delete('conversation');
      }
      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('已退出登录');
      setTimeout(() => {
        window.location.href = '/chat';
      }, 500);
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('退出失败，请重试');
    }
  }, []);

  /** Preserve the two-column shell while CSS chunks are still loading. */
  const shellStyle = {
    display: 'flex',
    flexDirection: 'row' as const,
    minHeight: '100dvh',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'var(--gpt-main, #ffffff)',
  };

  return (
    <div
      className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-gpt-main"
      style={shellStyle}
    >
      {/* Mobile overlay shown while the drawer is open. */}
      <button
        type="button"
        aria-label="关闭侧边栏"
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity md:hidden',
          sidebarCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100',
        )}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'pointer',
        }}
        onClick={() => setSidebarCollapsed(true)}
      />

      <div
        className={cn(
          'flex h-full shrink-0 overflow-hidden transition-[transform,width] duration-200 ease-out',
          'fixed inset-y-0 left-0 z-50 md:relative md:z-auto',
          sidebarCollapsed
            ? '-translate-x-full w-[min(100%,280px)] max-w-[85vw] md:translate-x-0 md:max-w-none md:w-[52px]'
            : 'translate-x-0 w-[min(100%,280px)] max-w-[85vw] md:max-w-none md:w-[260px]',
        )}
      >
        <CapabilityHub
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onLogout={handleLogout}
          onCloseMobile={closeMobileSidebar}
          activeConversationId={activeConversationId}
          onSelectConversation={(conversationId) => {
            setConversationInUrl(conversationId);
            closeMobileSidebar();
          }}
          onNewConversation={() => {
            setConversationInUrl(null);
            closeMobileSidebar();
          }}
        />
      </div>

      <div
        className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <NexusChat
          sidebarCollapsed={sidebarCollapsed}
          onOpenSidebar={() => setSidebarCollapsed(false)}
          activeConversationId={activeConversationId}
          onSelectConversation={setConversationInUrl}
        />
      </div>
    </div>
  );
}
