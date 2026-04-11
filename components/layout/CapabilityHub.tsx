'use client';

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Database, 
  FileText, 
  Mail, 
  BarChart3, 
  ChevronRight, 
  Cpu, 
  Settings2,
  Globe,
  RefreshCw,
  Play,
  MessageSquare,
  Layers
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
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRegistryStore } from '@/hooks/use-registry-store';
import { useConversationStore } from '@/hooks/use-conversation-store';
import { registryClient } from '@/lib/registry-client';
import { Skill } from '@/types/registry';
import ConversationList from '@/components/conversation/ConversationList';

type TabType = 'conversations' | 'resources';

export default function CapabilityHub() {
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('conversations');
  const { addPacket, config } = useRegistryStore();
  const { activeConversationId, setActiveConversation, clearMessages } = useConversationStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['capabilities'],
    queryFn: () => registryClient.fetchCapabilities()
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
        response: result
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
  };

  const handleSelectConversation = async (id: string) => {
    setActiveConversation(id);
    try {
      const response = await fetch(`/api/conversations/${id}?messages=true`);
      if (response.ok) {
        const conversation = await response.json();
        if (conversation.messages) {
          useConversationStore.getState().setMessages(
            conversation.messages.map((m: any) => ({
              id: m.id,
              conversationId: m.conversationId,
              role: m.role,
              content: m.content,
              toolCalls: m.toolCalls,
              toolResults: m.toolResults,
              thinkingLog: m.thinkingLog ? Object.values(m.thinkingLog) : null,
              tokensUsed: m.tokensUsed,
              latencyMs: m.latencyMs,
              createdAt: new Date(m.createdAt),
            }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const iconMap: Record<string, any> = {
    FileText, Database, Mail, BarChart3, Globe
  };

  return (
    <aside className="flex flex-col h-full border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-black/50 backdrop-blur-xl overflow-hidden">
      <div className="p-4">
        <div className="ios-card p-3 flex items-center gap-3 hover:scale-[1.02] transition-all cursor-pointer group active:scale-95">
          <NexusLogo showText={false} size="sm" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate tracking-tight">{config.name}</h3>
            <p className="text-[10px] font-bold text-ios-green flex items-center gap-1 uppercase tracking-wider">
              <Activity size={10} />
              运行中
            </p>
          </div>
          <Settings2 size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </div>

      <div className="flex border-b border-zinc-200 dark:border-zinc-800 mx-4">
        <button
          onClick={() => setActiveTab('conversations')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-all",
            activeTab === 'conversations'
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageSquare size={14} />
          会话
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-all",
            activeTab === 'resources'
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers size={14} />
          资源
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'conversations' ? (
            <motion.div
              key="conversations"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full"
            >
              <ConversationList
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
              />
            </motion.div>
          ) : (
            <motion.div
              key="resources"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full overflow-y-auto p-4"
            >
              <div className="flex items-center justify-between px-2 mb-4">
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em]">系统资源</h4>
                <button 
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} className={cn("text-muted-foreground", isFetching && "animate-spin")} />
                </button>
              </div>

              {isLoading ? (
                <div className="space-y-3 px-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-10 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold text-muted-foreground/60 mb-2 px-2 uppercase tracking-widest">MCP 服务器</h4>
                    {data?.mcpServers.map((server: any) => {
                      const Icon = iconMap[server.icon] || Cpu;
                      return (
                        <div 
                          key={server.id}
                          className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-all cursor-pointer group active:scale-98"
                        >
                          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                            <Icon size={16} />
                          </div>
                          <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground">{server.name}</span>
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-ios-green/40 animate-status-pulse" />
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold text-muted-foreground/60 mb-2 px-2 uppercase tracking-widest">远程技能</h4>
                    {data?.skills.map((skill: Skill) => {
                      const Icon = iconMap[skill.icon] || Globe;
                      return (
                        <div 
                          key={skill.id}
                          className="group relative"
                        >
                          <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-all cursor-pointer active:scale-98">
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                              <Icon size={16} />
                            </div>
                            <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground">{skill.name}</span>
                            
                            <Dialog>
                              <DialogTrigger className="ml-auto opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-primary/10 text-primary transition-all">
                                <Play size={12} fill="currentColor" />
                              </DialogTrigger>
                              <DialogContent className="ios-card border-none max-w-md">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-3 text-xl">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
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
                                    <Label className="text-[10px] uppercase tracking-widest font-bold opacity-50">接口地址</Label>
                                    <div className="ios-input font-mono text-[10px] text-primary truncate">
                                      {skill.endpoint}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-[10px] uppercase tracking-widest font-bold opacity-50">测试负载 (JSON)</Label>
                                    <textarea 
                                      className="ios-input w-full min-h-[120px] font-mono text-xs focus:ring-primary/20"
                                      placeholder='{ "test": true }'
                                    />
                                  </div>
                                  {triggerResult && (
                                    <div className={cn(
                                      "p-4 rounded-2xl border text-[10px] font-mono animate-ios-fade-in",
                                      triggerResult.status === 'success' ? "bg-ios-green/5 border-ios-green/20 text-ios-green" : "bg-ios-red/5 border-ios-red/20 text-ios-red"
                                    )}>
                                      <pre className="overflow-x-auto">{JSON.stringify(triggerResult, null, 2)}</pre>
                                    </div>
                                  )}
                                </div>
                                <DialogFooter>
                                  <Button 
                                    onClick={() => handleManualTrigger(skill)}
                                    disabled={isTriggering}
                                    className="ios-button-primary w-full"
                                  >
                                    {isTriggering ? <RefreshCw size={16} className="animate-spin mr-2" /> : <Play size={16} className="mr-2" />}
                                    执行测试
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            
                            <ChevronRight size={14} className="text-muted-foreground/40 group-hover:hidden" />
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

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/30 dark:bg-zinc-900/30">
        <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          <span>{config.version}</span>
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-status-pulse" />
            {isFetching ? '同步中' : '已同步'}
          </span>
        </div>
        <p className="text-[9px] text-muted-foreground/50 mt-2 text-center font-medium">
          最后同步: {mounted ? new Date().toLocaleTimeString() : '--:--:--'}
        </p>
      </div>
    </aside>
  );
}
