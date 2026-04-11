'use client';

import React, { useState, useEffect } from 'react';
import {
  Database,
  FileText,
  Mail,
  BarChart3,
  ChevronRight,
  Cpu,
  RefreshCw,
  Play,
  MessageSquare,
  Layers,
  SquarePen,
  PanelLeft,
  Globe,
  LogIn,
} from 'lucide-react';
import { NexusLogo } from '@/components/ui/nexus-logo';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRegistryStore } from '@/hooks/use-registry-store';
import { useConversationStore } from '@/hooks/use-conversation-store';
import { registryClient } from '@/lib/registry-client';
import { Skill } from '@/types/registry';
import ConversationList from '@/components/conversation/ConversationList';
import { UserAccountMenu } from '@/components/layout/user-account-menu';
import { useAuth } from '@/components/auth/auth-provider';

type TabType = 'conversations' | 'resources';

const sidebarClass =
  'flex flex-col h-full min-h-0 bg-gpt-sidebar border-r border-gpt-border';

interface CapabilityHubProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** 已登录时传入，用于退出登录 */
  onLogout?: () => void | Promise<void>;
  /** 移动端抽屉内选会话/新建后收起抽屉 */
  onCloseMobile?: () => void;
}

export default function CapabilityHub({
  collapsed = false,
  onToggleCollapse,
  onLogout,
  onCloseMobile,
}: CapabilityHubProps) {
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>('conversations');
  const { user, isAuthenticated, isReady, openLogin } = useAuth();
  const { addPacket, config } = useRegistryStore();
  const { activeConversationId, setActiveConversation, clearMessages } = useConversationStore();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['capabilities'],
    queryFn: () => registryClient.fetchCapabilities(),
  });

  const handleManualTrigger = async (skill: Skill) => {
    setIsTriggering(true);
    const startTime = Date.now();

    try {
      const result = await registryClient.remoteInvoke(skill, { manual: true });
      setTriggerResult(result);

      addPacket({
        id: Math.random().toString(36).substring(7),
        type: '技能',
        method: 'POST',
        endpoint: skill.endpoint,
        status: 200,
        time: `${Date.now() - startTime}ms`,
        payload: { manual: true, skill: skill.name },
        response: result,
      });
    } catch (e) {
      setTriggerResult({ status: 'error', message: '触发失败' });
    } finally {
      setIsTriggering(false);
    }
  };

  const handleNewConversation = () => {
    setActiveConversation(null);
    clearMessages();
    onCloseMobile?.();
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    onCloseMobile?.();
  };

  const iconMap: Record<string, any> = {
    FileText,
    Database,
    Mail,
    BarChart3,
    Globe,
  };

  const navButton = (
    id: TabType,
    label: string,
    Icon: React.ComponentType<{ size?: number; className?: string }>
  ) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={cn(
        'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
        activeTab === id
          ? 'bg-black/[0.06] text-foreground dark:bg-white/10'
          : 'text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
      )}
    >
      <Icon size={18} className="shrink-0 opacity-80" />
      <span className="truncate font-medium">{label}</span>
    </button>
  );

  if (collapsed) {
    return (
      <TooltipProvider delay={200}>
        <aside className={cn(sidebarClass, 'w-full items-center py-3 gap-1')}>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center text-foreground"
            title={config.name}
            aria-label={config.name}
          >
            <NexusLogo showText={false} size="sm" />
          </div>

          <Tooltip>
            <TooltipTrigger
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/10"
              onClick={handleNewConversation}
            >
              <SquarePen size={20} />
            </TooltipTrigger>
            <TooltipContent side="right">新建会话</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                activeTab === 'conversations'
                  ? 'bg-black/[0.06] dark:bg-white/10 text-foreground'
                  : 'text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/10'
              )}
              onClick={() => setActiveTab('conversations')}
            >
              <MessageSquare size={20} />
            </TooltipTrigger>
            <TooltipContent side="right">会话</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                activeTab === 'resources'
                  ? 'bg-black/[0.06] dark:bg-white/10 text-foreground'
                  : 'text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/10'
              )}
              onClick={() => setActiveTab('resources')}
            >
              <Layers size={20} />
            </TooltipTrigger>
            <TooltipContent side="right">资源与能力</TooltipContent>
          </Tooltip>

          <div className="flex-1 min-h-[1rem]" />

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
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <div className="flex min-w-0 items-center gap-2">
          <NexusLogo showText={false} size="sm" />
          <span className="truncate text-sm font-semibold text-foreground">{config.name}</span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/10"
              onClick={onToggleCollapse}
            >
              <PanelLeft size={18} />
            </TooltipTrigger>
            <TooltipContent side="bottom">收起边栏</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex flex-col gap-2 px-3 pb-2">
        <button
          type="button"
          onClick={handleNewConversation}
          className="flex w-full items-center gap-3 rounded-xl border border-gpt-border bg-gpt-main px-3 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-[#ececec] dark:bg-[#2f2f2f] dark:hover:bg-[#3b3b3b]"
        >
          <SquarePen size={18} className="text-muted-foreground" />
          新建会话
        </button>
      </div>

      <div className="space-y-1 px-3 pb-2">
        {navButton('conversations', '会话', MessageSquare)}
        {navButton('resources', '资源与能力', Layers)}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'conversations' ? (
            <motion.div
              key="conversations"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="flex h-full min-h-0 flex-col"
            >
              <p className="shrink-0 px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                最近
              </p>
              <ConversationList
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
                toolbarVariant="searchOnly"
                density="compact"
                authenticated={isReady && isAuthenticated}
              />
            </motion.div>
          ) : (
            <motion.div
              key="resources"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="h-full overflow-y-auto px-3 pb-4 scrollbar-none"
            >
              <div className="flex items-center justify-between px-1 pb-3 pt-1">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  系统资源
                </h4>
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-black/[0.06] dark:hover:bg-white/10 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={cn(isFetching && 'animate-spin')} />
                </button>
              </div>

              {isLoading ? (
                <div className="space-y-2 px-1">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 animate-pulse rounded-lg bg-black/[0.04] dark:bg-white/5"
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h4 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      MCP 服务器
                    </h4>
                    {data?.mcpServers.map((server: any) => {
                      const Icon = iconMap[server.icon] || Cpu;
                      return (
                        <div
                          key={server.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/5"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-black/[0.04] text-muted-foreground dark:bg-white/5">
                            <Icon size={16} />
                          </div>
                          <span className="truncate text-sm text-foreground">
                            {server.name}
                          </span>
                          <div className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/70" />
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-1">
                    <h4 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      远程技能
                    </h4>
                    {data?.skills.map((skill: Skill) => {
                      const Icon = iconMap[skill.icon] || Globe;
                      return (
                        <div key={skill.id} className="group relative">
                          <div className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-black/[0.04] text-muted-foreground dark:bg-white/5">
                              <Icon size={16} />
                            </div>
                            <span className="text-sm text-foreground">{skill.name}</span>

                            <Dialog>
                              <DialogTrigger className="ml-auto rounded-md p-1.5 text-primary opacity-0 transition-all hover:bg-primary/10 group-hover:opacity-100">
                                <Play size={12} fill="currentColor" />
                              </DialogTrigger>
                              <DialogContent className="ios-card max-w-md border-none">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-3 text-xl">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                      <Icon size={20} />
                                    </div>
                                    手动测试: {skill.name}
                                  </DialogTitle>
                                  <DialogDescription className="text-muted-foreground pt-2">
                                    直接调用远程 Skill 接口进行连通性与逻辑验证。
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                                      接口地址
                                    </Label>
                                    <div className="ios-input font-mono text-[10px] text-primary truncate">
                                      {skill.endpoint}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                                      测试负载 (JSON)
                                    </Label>
                                    <textarea
                                      className="ios-input min-h-[120px] w-full font-mono text-xs focus:ring-primary/20"
                                      placeholder='{ "test": true }'
                                    />
                                  </div>
                                  {triggerResult && (
                                    <div
                                      className={cn(
                                        'rounded-2xl border p-4 font-mono text-[10px] animate-ios-fade-in',
                                        triggerResult.status === 'success'
                                          ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600'
                                          : 'border-red-500/20 bg-red-500/5 text-red-600'
                                      )}
                                    >
                                      <pre className="overflow-x-auto">
                                        {JSON.stringify(triggerResult, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                                <DialogFooter>
                                  <Button
                                    onClick={() => handleManualTrigger(skill)}
                                    disabled={isTriggering}
                                    className="ios-button-primary w-full"
                                  >
                                    {isTriggering ? (
                                      <RefreshCw size={16} className="mr-2 animate-spin" />
                                    ) : (
                                      <Play size={16} className="mr-2" />
                                    )}
                                    执行测试
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            <ChevronRight
                              size={14}
                              className="text-muted-foreground opacity-0 group-hover:hidden"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
              'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
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
