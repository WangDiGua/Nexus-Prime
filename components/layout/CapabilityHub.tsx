'use client';

import { LogIn, PanelLeft, SquarePen } from 'lucide-react';
import { NexusLogo } from '@/components/ui/nexus-logo';
import { UserAccountMenu } from '@/components/layout/user-account-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/components/auth/auth-provider';
import ConversationList from '@/components/conversation/ConversationList';
import { cn } from '@/lib/utils';
import { nexusPixelLogo } from '@/lib/fonts/pixel-logo';

const sidebarClass =
  'flex h-full min-h-0 flex-col border-r border-gpt-border bg-gpt-sidebar';

interface CapabilityHubProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onLogout?: () => void | Promise<void>;
  onCloseMobile?: () => void;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export default function CapabilityHub({
  collapsed = false,
  onToggleCollapse,
  onLogout,
  onCloseMobile,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: CapabilityHubProps) {
  const { user, isAuthenticated, isReady, openLogin } = useAuth();

  if (collapsed) {
    return (
      <TooltipProvider delay={200}>
        <aside className={cn(sidebarClass, 'w-full items-center gap-1 py-3')}>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center text-foreground"
            title="Nexus-Prime"
            aria-label="Nexus-Prime"
          >
            <NexusLogo showText={false} size="sm" />
          </div>

          <Tooltip>
            <TooltipTrigger
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/10"
              onClick={onNewConversation}
            >
              <SquarePen size={20} />
            </TooltipTrigger>
            <TooltipContent side="right">新建会话</TooltipContent>
          </Tooltip>

          <div className="min-h-[1rem] flex-1" />

          {!isReady ? (
            <div
              className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-muted"
              aria-hidden
            />
          ) : isAuthenticated ? (
            <UserAccountMenu
              variant="collapsed"
              displayName={user?.displayName || user?.username || '用户'}
              onLogout={onLogout ?? (() => Promise.resolve())}
            />
          ) : (
            <Tooltip>
              <TooltipTrigger
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/10"
                onClick={openLogin}
              >
                <LogIn size={20} strokeWidth={2} />
              </TooltipTrigger>
              <TooltipContent side="right">登录</TooltipContent>
            </Tooltip>
          )}
        </aside>
      </TooltipProvider>
    );
  }

  return (
    <aside className={cn(sidebarClass, 'w-full')}>
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-3">
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              nexusPixelLogo.className,
              'block truncate text-[1.15rem] leading-tight tracking-[-0.5px] text-foreground [-webkit-font-smoothing:antialiased]',
            )}
          >
            Nexus-Prime
          </span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/10"
              onClick={onToggleCollapse}
            >
              <PanelLeft size={18} />
            </TooltipTrigger>
            <TooltipContent side="bottom">收起侧边栏</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex flex-col gap-2 px-3 pb-2">
        <button
          type="button"
          onClick={onNewConversation}
          className="flex w-full items-center gap-3 rounded-xl border border-gpt-border bg-gpt-main px-3 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-[#ececec] dark:bg-[#2f2f2f] dark:hover:bg-[#3b3b3b]"
        >
          <SquarePen size={18} className="text-muted-foreground" />
          新建会话
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col">
          <p className="shrink-0 px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            最近
          </p>
          <ConversationList
            activeConversationId={activeConversationId}
            onSelectConversation={onSelectConversation}
            onNewConversation={onNewConversation}
            toolbarVariant="searchOnly"
            density="compact"
            authenticated={isReady && isAuthenticated}
          />
        </div>
      </div>

      <div className="shrink-0 border-t border-gpt-border p-3">
        {!isReady ? (
          <div className="h-10 w-full animate-pulse rounded-xl bg-muted" aria-hidden />
        ) : isAuthenticated ? (
          <UserAccountMenu
            variant="full"
            displayName={user?.displayName || user?.username || '用户'}
            onLogout={onLogout ?? (() => Promise.resolve())}
          />
        ) : (
          <button
            type="button"
            onClick={openLogin}
            className={cn(
              'flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-medium text-foreground transition-colors',
              'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]',
            )}
          >
            <LogIn size={20} className="shrink-0 opacity-90" strokeWidth={2} />
            登录
          </button>
        )}
      </div>
    </aside>
  );
}
