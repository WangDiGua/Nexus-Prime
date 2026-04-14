'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  ChevronRight,
  Cpu,
  Database,
  FileText,
  Globe,
  Layers,
  LogIn,
  Mail,
  MessageSquare,
  PanelLeft,
  Play,
  RefreshCw,
  Sparkles,
  SquarePen,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { NexusLogo } from '@/components/ui/nexus-logo';
import { UserAccountMenu } from '@/components/layout/user-account-menu';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/components/auth/auth-provider';
import ConversationList from '@/components/conversation/ConversationList';
import {
  describeResourceValue,
  groupSkillsByTask,
} from '@/lib/agent-workbench';
import { cn } from '@/lib/utils';
import { nexusPixelLogo } from '@/lib/fonts/pixel-logo';
import { registryClient } from '@/lib/registry-client';
import { useConversationStore } from '@/hooks/use-conversation-store';
import { useRegistryStore } from '@/hooks/use-registry-store';
import { Resource, Skill } from '@/types/registry';

type TabType = 'conversations' | 'resources';

const sidebarClass =
  'flex h-full min-h-0 flex-col border-r border-gpt-border bg-gpt-sidebar';

interface CapabilityHubProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onLogout?: () => void | Promise<void>;
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
  const { addPacket } = useRegistryStore();
  const { activeConversationId, clearMessages, setActiveConversation } =
    useConversationStore();

  const resourcesEnabled = activeTab === 'resources';
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['capabilities'],
    queryFn: () => registryClient.fetchCapabilities(),
    enabled: resourcesEnabled,
    staleTime: 5 * 60 * 1000,
  });

  const groupedSkills = groupSkillsByTask(data?.skills ?? []);

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
    } catch {
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

  const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
    FileText,
    Database,
    Mail,
    BarChart3,
    Globe,
  };

  const navButton = (
    id: TabType,
    label: string,
    Icon: React.ComponentType<{ size?: number; className?: string }>,
  ) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
        activeTab === id
          ? 'bg-black/[0.06] text-foreground dark:bg-white/10'
          : 'text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05]',
      )}
    >
      <Icon size={18} className="shrink-0 opacity-80" />
      <span className="truncate font-medium">{label}</span>
    </button>
  );

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
                  ? 'bg-black/[0.06] text-foreground dark:bg-white/10'
                  : 'text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/10',
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
                  ? 'bg-black/[0.06] text-foreground dark:bg-white/10'
                  : 'text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/10',
              )}
              onClick={() => setActiveTab('resources')}
            >
              <Layers size={20} />
            </TooltipTrigger>
            <TooltipContent side="right">任务能力中心</TooltipContent>
          </Tooltip>

          <div className="min-h-[1rem] flex-1" />

          {!isReady ? (
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-muted" aria-hidden />
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

      <div className="px-3 pb-2">
        <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
          <div className="flex items-start gap-2">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">任务能力中心</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                先开始一段对话，再根据任务目标选择技能、资源和系统能力。
              </p>
            </div>
          </div>
        </div>
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
        {navButton('conversations', '最近会话', MessageSquare)}
        {navButton('resources', '任务能力中心', Layers)}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'conversations' ? (
          <div className="flex h-full min-h-0 flex-col">
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
          </div>
        ) : (
          <div className="h-full overflow-y-auto px-3 pb-4 scrollbar-none">
            <div className="flex items-center justify-between px-1 pb-3 pt-1">
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  当前能力
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  从任务目标出发，而不是从底层接口出发。
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refetch()}
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
                <section className="space-y-2">
                  <h4 className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    已连接系统
                  </h4>
                  {(data?.mcpServers ?? []).length > 0 ? (
                    data?.mcpServers.map((server) => {
                      const Icon = iconMap[server.icon] || Cpu;
                      return (
                        <div
                          key={server.id}
                          className="flex items-center gap-3 rounded-lg p-2 hover:bg-black/[0.04] dark:hover:bg-white/5"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-black/[0.04] text-muted-foreground dark:bg-white/5">
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-foreground">{server.name}</p>
                            <p className="text-xs text-muted-foreground">
                              可作为本轮任务的外部工具来源
                            </p>
                          </div>
                          <div className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-600">
                            {server.status}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                      还没有发现已连接系统，但你依然可以先进行普通对话。
                    </div>
                  )}
                </section>

                <section className="space-y-3">
                  <div className="px-1">
                    <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      技能分组
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      按任务目标查看，不再要求你先理解底层服务结构。
                    </p>
                  </div>

                  {groupedSkills.length > 0 ? (
                    groupedSkills.map(({ group, skills }) => (
                      <div key={group.id} className="rounded-2xl border border-border/70 bg-background/70 p-3">
                        <div className="mb-3">
                          <p className="text-sm font-medium text-foreground">{group.title}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {group.description}
                          </p>
                        </div>
                        <div className="space-y-2">
                          {skills.map((skill) => {
                            const Icon = iconMap[skill.icon] || Globe;
                            return (
                              <div key={skill.id} className="group rounded-xl border border-border/60 bg-background/70 p-2">
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-black/[0.04] text-muted-foreground dark:bg-white/5">
                                    <Icon size={16} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground">{skill.name}</p>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                      {skill.description || '适合作为当前任务的专用工具入口。'}
                                    </p>
                                  </div>
                                  <Dialog>
                                    <DialogTrigger className="rounded-md p-1.5 text-primary transition-all hover:bg-primary/10">
                                      <Play size={12} fill="currentColor" />
                                    </DialogTrigger>
                                    <DialogContent className="ios-card max-w-md border-none">
                                      <DialogHeader>
                                        <DialogTitle className="flex items-center gap-3 text-xl">
                                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                            <Icon size={20} />
                                          </div>
                                          高级调试：{skill.name}
                                        </DialogTitle>
                                        <DialogDescription className="pt-2 text-muted-foreground">
                                          这里保留给高级用户做连通性测试。普通使用场景下，建议直接在聊天区描述任务。
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                          <Label className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                                            接口地址
                                          </Label>
                                          <div className="ios-input truncate font-mono text-[10px] text-primary">
                                            {skill.endpoint}
                                          </div>
                                        </div>
                                        <div className="space-y-2">
                                          <Label className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                                            测试负载（JSON）
                                          </Label>
                                          <textarea
                                            className="ios-input min-h-[120px] w-full font-mono text-xs focus:ring-primary/20"
                                            placeholder='{ "test": true }'
                                          />
                                        </div>
                                        {triggerResult ? (
                                          <div
                                            className={cn(
                                              'animate-ios-fade-in rounded-2xl border p-4 font-mono text-[10px]',
                                              triggerResult.status === 'success'
                                                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600'
                                                : 'border-red-500/20 bg-red-500/5 text-red-600',
                                            )}
                                          >
                                            <pre className="overflow-x-auto">
                                              {JSON.stringify(triggerResult, null, 2)}
                                            </pre>
                                          </div>
                                        ) : null}
                                      </div>
                                      <DialogFooter>
                                        <Button
                                          onClick={() => void handleManualTrigger(skill)}
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
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                      当前没有可展示的技能列表。
                    </div>
                  )}
                </section>

                <section className="space-y-3">
                  <div className="px-1">
                    <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      资源卡片
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      每个资源都补充“适用场景、输入要求、预期输出”，帮助首次使用的人快速上手。
                    </p>
                  </div>
                  {(data?.resources ?? []).slice(0, 6).map((resource: Resource) => {
                    const resourceInfo = describeResourceValue(resource);
                    return (
                      <div
                        key={resource.id}
                        className="rounded-2xl border border-border/70 bg-background/70 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {resource.name}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {resource.description || '可在 Agent 工作台中复用的任务资源。'}
                            </p>
                          </div>
                          <ChevronRight size={14} className="mt-1 shrink-0 text-muted-foreground" />
                        </div>
                        <div className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                          <p>适用场景：{resourceInfo.scenario}</p>
                          <p>输入要求：{resourceInfo.input}</p>
                          <p>预期输出：{resourceInfo.output}</p>
                        </div>
                      </div>
                    );
                  })}
                </section>
              </div>
            )}
          </div>
        )}
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
