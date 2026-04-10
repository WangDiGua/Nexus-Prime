'use client';

import React from 'react';
import { 
  Terminal, 
  Wifi, 
  WifiOff, 
  ArrowRightLeft, 
  Eye,
  FileCode,
  Search,
  ChevronRight,
  Database,
  Cpu,
  Zap,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRegistryStore } from '@/hooks/use-registry-store';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Packet } from '@/types/registry';

export default function ObserverPanel() {
  const { packets, clearPackets, contextTokens, contextContent } = useRegistryStore();

  return (
    <aside className="flex flex-col h-full border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-black/50 backdrop-blur-xl overflow-hidden">
      {/* 头部 - iOS Style */}
      <div className="h-16 ios-glass flex items-center px-6 justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-ios-blue/10 flex items-center justify-center text-ios-blue">
            <Eye size={18} />
          </div>
          <h2 className="text-sm font-bold tracking-tight text-foreground">观测器</h2>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ios-green/10 border border-ios-green/20">
          <Wifi size={10} className="text-ios-green animate-status-pulse" />
          <span className="text-[10px] font-bold text-ios-green uppercase tracking-wider">实时监控</span>
        </div>
      </div>

      {/* 报文流 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-6 py-3 bg-zinc-100/50 dark:bg-zinc-900/30 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">实时报文流</span>
          <div className="flex gap-3">
            <button 
              onClick={clearPackets}
              className="text-[10px] font-bold text-primary hover:opacity-80 transition-all uppercase tracking-wider"
            >
              清空
            </button>
            <Search size={12} className="text-muted-foreground" />
          </div>
        </div>
        
        <ScrollArea className="flex-1 font-mono text-[11px]">
          <div className="flex flex-col">
            {packets.map((packet: Packet) => (
              <Sheet key={packet.id}>
                <SheetTrigger className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800/50 transition-all cursor-pointer group text-left w-full active:scale-[0.99]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                        packet.type === '技能' ? 'bg-ios-blue/10 text-ios-blue' : 'bg-ios-purple/10 text-ios-purple'
                      )}>
                        {packet.type}
                      </span>
                      <span className="text-muted-foreground/60 font-bold">{packet.method}</span>
                    </div>
                    <span className={cn(
                      "font-bold text-[12px]",
                      packet.status >= 200 && packet.status < 300 ? 'text-ios-green' : 'text-ios-red'
                    )}>
                      {packet.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                    <span className="truncate flex-1 font-medium">{packet.endpoint}</span>
                    <span className="text-muted-foreground/40 flex items-center gap-1 font-bold">
                      <Clock size={10} />
                      {packet.time}
                    </span>
                  </div>
                </SheetTrigger>
                <SheetContent className="ios-card border-none w-[400px] sm:w-[540px] m-4 h-[calc(100%-2rem)] shadow-2xl">
                  <SheetHeader className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        packet.status === 200 ? "bg-ios-green/10 text-ios-green" : "bg-ios-red/10 text-ios-red"
                      )}>
                        <ArrowRightLeft size={20} />
                      </div>
                      <div>
                        <SheetTitle className="text-xl font-bold tracking-tight">报文详情</SheetTitle>
                        <SheetDescription className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                          ID: {packet.id}
                        </SheetDescription>
                      </div>
                    </div>
                  </SheetHeader>
                  
                  <ScrollArea className="h-[calc(100%-120px)] pr-4">
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                          <Badge variant="outline" className="rounded-full px-2 py-0 h-4 text-[8px] border-primary/20 text-primary">请求</Badge>
                          数据负载 (Payload)
                        </h4>
                        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-zinc-800/50 font-mono text-[11px] overflow-x-auto">
                          <pre className="text-primary/80">{JSON.stringify(packet.payload || {}, null, 2)}</pre>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                          <Badge variant="outline" className="rounded-full px-2 py-0 h-4 text-[8px] border-ios-green/20 text-ios-green">响应</Badge>
                          返回内容 (Body)
                        </h4>
                        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-zinc-800/50 font-mono text-[11px] overflow-x-auto">
                          <pre className="text-ios-green">{JSON.stringify(packet.response || {}, null, 2)}</pre>
                        </div>
                      </div>

                      {packet.stackTrace && (
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-ios-red uppercase tracking-[0.2em] flex items-center gap-2">
                            <Terminal size={14} />
                            错误堆栈 (Stack Trace)
                          </h4>
                          <div className="p-4 rounded-2xl bg-ios-red/5 border border-ios-red/10 font-mono text-[11px] text-ios-red overflow-x-auto">
                            <pre>{packet.stackTrace}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* 上下文查看器 */}
      <div className="h-1/3 border-t border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-100/30 dark:bg-zinc-900/30">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode size={14} className="text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">上下文查看器</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
            <Zap size={10} className="text-primary" />
            <span className="text-[10px] font-bold text-primary">{contextTokens} Tokens</span>
          </div>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="p-4 rounded-2xl bg-white dark:bg-black/20 border border-zinc-100 dark:border-zinc-800/50 font-mono text-[11px] text-muted-foreground/80 shadow-sm">
            <p className="text-primary/60 mb-3 font-bold">{"// 注入的上下文 (Context Injection)"}</p>
            <pre className="leading-relaxed">{JSON.stringify(contextContent, null, 2)}</pre>
          </div>
        </div>
      </div>
    </aside>
  );
}


