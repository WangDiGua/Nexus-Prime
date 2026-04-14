'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useConversationStore } from '@/hooks/use-conversation-store';

export interface Conversation {
  id: string;
  title: string | null;
  messageCount: number;
  lastMessageAt: Date | null;
  createdAt: Date;
}

interface ConversationListProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  toolbarVariant?: 'full' | 'searchOnly' | 'hidden';
  density?: 'default' | 'compact';
  authenticated?: boolean;
}

export default function ConversationList({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  toolbarVariant = 'full',
  density = 'default',
  authenticated = true,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  const conversationListNonce = useConversationStore((s) => s.conversationListNonce);

  const fetchConversations = async (query?: string) => {
    try {
      setIsLoading(true);
      const q = (query ?? '').trim();
      const url = q
        ? `/api/conversations?search=${encodeURIComponent(q)}`
        : '/api/conversations';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authenticated) {
      setConversations([]);
      setIsLoading(false);
      return;
    }
    void fetchConversations(searchQueryRef.current);
  }, [authenticated, conversationListNonce]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    await fetchConversations(query);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          onNewConversation();
        }
        toast.success('会话已删除');
      } else {
        const err = await response.json().catch(() => ({} as { error?: string }));
        toast.error(err.error || '删除失败');
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast.error('删除失败');
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return d.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const compact = density === 'compact';
  const showNew = toolbarVariant === 'full';
  const showSearch = toolbarVariant === 'full' || toolbarVariant === 'searchOnly';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {toolbarVariant !== 'hidden' && (
        <div
          className={cn(
            'shrink-0 space-y-3',
            toolbarVariant === 'full' ? 'p-4' : 'px-3 pb-2 pt-0',
          )}
        >
          {showNew && (
            <button
              onClick={onNewConversation}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
            >
              <Plus size={16} />
              新建会话
            </button>
          )}

          {showSearch && (
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => void handleSearch(e.target.value)}
                placeholder="搜索会话..."
                className={cn(
                  'w-full rounded-xl py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/20',
                  compact
                    ? 'border border-transparent bg-black/[0.04] dark:bg-white/[0.05]'
                    : 'bg-[#f4f4f4] dark:bg-[#2f2f2f]',
                )}
              />
            </div>
          )}
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0 px-2">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-black/[0.06] dark:bg-white/10"
              />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare size={32} className="mb-3 opacity-30" />
            <p className="text-sm">暂无会话</p>
            <p className="mt-1 text-xs opacity-60">开始新对话吧</p>
          </div>
        ) : (
          <div className={cn('space-y-0.5', compact ? 'p-1' : 'p-2')}>
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  'group relative cursor-pointer rounded-lg transition-colors',
                  compact ? 'px-3 py-2.5' : 'rounded-xl p-3',
                  activeConversationId === conv.id
                    ? compact
                      ? 'bg-white/10 text-foreground'
                      : 'border border-primary/20 bg-primary/10'
                    : compact
                      ? 'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground'
                      : 'hover:bg-[#ececec] dark:hover:bg-white/[0.05]',
                )}
                onClick={() => onSelectConversation(conv.id)}
              >
                <div className={cn('flex', compact ? 'items-center gap-2' : 'items-start gap-3')}>
                  {!compact && (
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        activeConversationId === conv.id
                          ? 'bg-primary/20 text-primary'
                          : 'bg-[#ececec] text-muted-foreground dark:bg-[#2f2f2f]',
                      )}
                    >
                      <MessageSquare size={14} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h4
                      className={cn(
                        'truncate font-medium text-foreground',
                        compact ? 'text-[13px]' : 'text-sm',
                      )}
                    >
                      {conv.title || '新会话'}
                    </h4>
                    {!compact && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {conv.messageCount} 条消息
                        </span>
                        {conv.lastMessageAt && (
                          <>
                            <span className="text-[10px] text-muted-foreground/50">·</span>
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock size={8} />
                              {formatTime(conv.lastMessageAt)}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(showDeleteConfirm === conv.id ? null : conv.id);
                    }}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </div>

                {showDeleteConfirm === conv.id && (
                  <div className="overflow-hidden">
                    <div className="mt-2 flex items-center gap-2 border-t border-gpt-border pt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(conv.id);
                        }}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-500/10 px-2 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/20"
                      >
                        <Trash2 size={12} />
                        确认删除
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(null);
                        }}
                        className="flex-1 rounded-lg bg-[#ececec] px-2 py-1.5 text-xs font-medium transition-colors hover:bg-[#e0e0e0] dark:bg-[#2f2f2f] dark:hover:bg-[#3b3b3b]"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
