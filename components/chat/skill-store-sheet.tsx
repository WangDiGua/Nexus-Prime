'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Sparkles } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ChatSelectedSkill {
  id: string;
  name: string;
  icon?: string;
}

interface SkillStoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: ChatSelectedSkill | null;
  onSelect: (skill: ChatSelectedSkill) => void;
  onClearSelection?: () => void;
}

type ResourceRow = {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  icon?: string;
  type?: string;
};

export function SkillStoreSheet({
  open,
  onOpenChange,
  selected,
  onSelect,
  onClearSelection,
}: SkillStoreSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ResourceRow[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        resourceType: 'skill',
        status: 'published',
        pageSize: '100',
      });
      const res = await fetch(`/api/resources?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        data?: { items?: ResourceRow[]; total?: number; error?: string };
      };
      const payload = json.data;
      if (payload?.error) {
        throw new Error(payload.error);
      }
      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载技能列表失败');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) => {
      const name = (r.displayName || r.name || '').toLowerCase();
      const desc = (r.description || '').toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [items, query]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle>任务技能中心</SheetTitle>
              <SheetDescription className="mt-1">
                为当前对话选择一个技能入口，系统会优先围绕它调用更合适的工具与资源。
              </SheetDescription>
            </div>
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Sparkles className="size-4" />
            </div>
          </div>
          {selected && onClearSelection ? (
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => onClearSelection()}
              >
                清除当前技能
              </Button>
            </div>
          ) : null}
        </SheetHeader>

        <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
          <div className="rounded-2xl border border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
            适合在你已经知道任务方向时使用，比如“写一封邮件”“生成图表”“调用某个业务系统”。
          </div>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索技能名称或描述"
              className="h-9 pl-9"
              aria-label="搜索技能"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在加载技能...
            </div>
          ) : null}

          {!loading && error ? (
            <p className="px-2 py-8 text-center text-sm text-destructive">{error}</p>
          ) : null}

          {!loading && !error && filtered.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              {items.length === 0 ? '当前还没有已发布技能。' : '没有找到匹配的技能。'}
            </p>
          ) : null}

          <ul className="space-y-1">
            {filtered.map((resource) => {
              const title = resource.displayName || resource.name || resource.id;
              const active = selected?.id === resource.id;
              return (
                <li key={resource.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect({
                        id: resource.id,
                        name: title,
                        icon: resource.icon,
                      });
                      onOpenChange(false);
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                      active
                        ? 'bg-primary/12 ring-1 ring-primary/25'
                        : 'hover:bg-muted/80',
                    )}
                  >
                    {resource.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resource.icon}
                        alt=""
                        className="mt-0.5 size-9 shrink-0 rounded-lg bg-muted object-cover"
                      />
                    ) : (
                      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-medium text-muted-foreground">
                        {title.slice(0, 1)}
                      </div>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-snug text-foreground">
                        {title}
                      </span>
                      {resource.description ? (
                        <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {resource.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
