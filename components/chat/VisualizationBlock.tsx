'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { AlertTriangle, FileJson2, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  asVisualizationSourceRows,
  extractVisualizationMessage,
  stringifyVisualizationJson,
  type VisualizationMessage,
  type VisualizationPayload,
} from '@/lib/visualization';

function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains('dark'));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

function isVisualizationPayload(
  message: VisualizationMessage | null,
): message is VisualizationPayload {
  return Boolean(message && message.type === 'visualization');
}

function resolveTableColumns(rows: Record<string, unknown>[]): string[] {
  const columns = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columns.add(key);
    }
  }
  return [...columns];
}

function VisualizationFallbackView({
  message,
}: {
  message: VisualizationMessage;
}) {
  const fallbackType =
    'fallback' in message && message.fallback?.type ? message.fallback.type : 'table';
  const sourceRows = isVisualizationPayload(message)
    ? asVisualizationSourceRows(message.data.source)
    : [];
  const columns = resolveTableColumns(sourceRows).slice(0, 8);

  return (
    <div className="mt-3 rounded-xl border border-border bg-background/70 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
        {fallbackType === 'table' ? (
          <Table2 className="size-4 text-muted-foreground" aria-hidden />
        ) : (
          <FileJson2 className="size-4 text-muted-foreground" aria-hidden />
        )}
        鍏滃簳灞曠ず
      </div>
      {sourceRows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-muted/50">
                {columns.map((column) => (
                  <th
                    key={column}
                    className="border border-border px-2 py-1.5 font-medium text-muted-foreground"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sourceRows.slice(0, 12).map((row, idx) => (
                <tr key={idx} className="odd:bg-background even:bg-muted/20">
                  {columns.map((column) => (
                    <td key={column} className="border border-border px-2 py-1.5">
                      {typeof row[column] === 'object'
                        ? stringifyVisualizationJson(row[column])
                        : String(row[column] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <pre className="max-h-64 overflow-auto rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
          {stringifyVisualizationJson(
            isVisualizationPayload(message) ? message.data.source : message,
          )}
        </pre>
      )}
    </div>
  );
}

export function VisualizationBlock({
  payload,
  className,
}: {
  payload: unknown;
  className?: string;
}) {
  const dark = useIsDark();
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const message = useMemo(() => extractVisualizationMessage(payload), [payload]);

  useEffect(() => {
    if (!message || !isVisualizationPayload(message)) return;
    if (message.renderer !== 'echarts') {
      return;
    }
    if (!chartRef.current) return;

    const scheduleRenderError = (value: string | null) => {
      window.setTimeout(() => setRenderError(value), 0);
    };

    let disposed = false;
    let chart: echarts.ECharts | null = null;
    let resizeObserver: ResizeObserver | null = null;

    try {
      chart = echarts.init(chartRef.current, dark ? 'dark' : undefined, {
        renderer: 'canvas',
      });
      chart.setOption(message.chart.spec.option, {
        notMerge: true,
        lazyUpdate: true,
        silent: false,
      });
      scheduleRenderError(null);

      const resize = () => chart?.resize();
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => resize());
        resizeObserver.observe(chartRef.current);
      }
      window.addEventListener('resize', resize);

      return () => {
        if (disposed) return;
        disposed = true;
        resizeObserver?.disconnect();
        window.removeEventListener('resize', resize);
        chart?.dispose();
      };
    } catch (error) {
      scheduleRenderError(error instanceof Error ? error.message : '图表渲染失败');
      chart?.dispose();
      return undefined;
    }
  }, [dark, message]);

  if (!message) {
    return (
      <div className={cn('mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive', className)}>
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle className="size-4" aria-hidden />
          鍥捐〃娑堟伅鏃犳晥
        </div>
        <pre className="mt-2 overflow-auto text-xs leading-relaxed text-destructive/90">
          {stringifyVisualizationJson(payload)}
        </pre>
      </div>
    );
  }

  if (!isVisualizationPayload(message)) {
    return (
      <div className={cn('mt-3 rounded-xl border border-border bg-background/70 p-3', className)}>
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <AlertTriangle className="size-4 text-muted-foreground" aria-hidden />
          {message.message}
        </div>
        {'fallback' in message ? <VisualizationFallbackView message={message} /> : null}
      </div>
    );
  }
  if (message.renderer !== 'echarts') {
    return (
      <div className={cn('mt-3 rounded-xl border border-border bg-background/70 p-3', className)}>
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <AlertTriangle className="size-4 text-muted-foreground" aria-hidden />
          暂不支持渲染器: {message.renderer}
        </div>
        <VisualizationFallbackView message={message} />
      </div>
    );
  }


  return (
    <div className={cn('mt-3 rounded-xl border border-border bg-background/70 p-3', className)}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              {message.renderer.toUpperCase()}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {message.chart.kind}
            </span>
          </div>
          <h4 className="mt-2 text-sm font-semibold text-foreground">{message.title}</h4>
          {message.subtitle ? (
            <p className="mt-1 text-xs text-muted-foreground">{message.subtitle}</p>
          ) : null}
          {message.description ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {message.description}
            </p>
          ) : null}
        </div>
      </div>

      {renderError ? (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          鍥捐〃娓叉煋澶辫触: {renderError}
          <VisualizationFallbackView message={message} />
        </div>
      ) : (
        <div
          ref={chartRef}
          className="mt-3 h-[420px] w-full overflow-hidden rounded-lg border border-border/60 bg-gradient-to-b from-background to-muted/20"
        />
      )}
    </div>
  );
}

