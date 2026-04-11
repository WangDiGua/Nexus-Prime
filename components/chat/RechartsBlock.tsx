'use client';

import { useMemo } from 'react';
import { z } from 'zod';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const chartSpecSchema = z.object({
  type: z.enum(['line', 'bar']),
  data: z.array(z.record(z.unknown())).min(1).max(200),
  xKey: z.string().min(1),
  series: z
    .array(
      z.object({
        key: z.string().min(1),
        name: z.string().optional(),
      }),
    )
    .min(1)
    .max(8),
  height: z.number().min(160).max(520).optional(),
});

function validateRows(
  rows: Record<string, unknown>[],
  xKey: string,
  series: { key: string }[],
): string | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!(xKey in row)) {
      return `第 ${i + 1} 行缺少横轴字段「${xKey}」`;
    }
    for (const s of series) {
      if (!(s.key in row)) {
        return `第 ${i + 1} 行缺少「${s.key}」`;
      }
      const v = row[s.key];
      if (typeof v !== 'number') {
        if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
          continue;
        }
        return `「${s.key}」须为数字（第 ${i + 1} 行）`;
      }
    }
  }
  return null;
}

/** 与亮/暗背景都协调的序列色（不依赖未定义的 chart token） */
const SERIES_COLORS_LIGHT = [
  '#171717',
  '#525252',
  '#737373',
  '#a3a3a3',
  '#0d9488',
  '#7c3aed',
  '#b45309',
  '#be123c',
];

const SERIES_COLORS_DARK = [
  '#ececec',
  '#a3a3a3',
  '#737373',
  '#525252',
  '#2dd4bf',
  '#c4b5fd',
  '#fdba74',
  '#fb7185',
];

function normalizeData(
  rows: Record<string, unknown>[],
  series: { key: string }[],
): Record<string, unknown>[] {
  return rows.map((row) => {
    const next = { ...row };
    for (const s of series) {
      const v = next[s.key];
      if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
        next[s.key] = Number(v);
      }
    }
    return next;
  });
}

export function RechartsBlock({
  code,
  isDark,
}: {
  code: string;
  isDark: boolean;
}) {
  const palette = isDark ? SERIES_COLORS_DARK : SERIES_COLORS_LIGHT;

  const result = useMemo(() => {
    try {
      const json = JSON.parse(code) as unknown;
      const parsed = chartSpecSchema.safeParse(json);
      if (!parsed.success) {
        return {
          ok: false as const,
          message: parsed.error.issues.map((i) => i.message).join('；'),
        };
      }
      const spec = parsed.data;
      const rowErr = validateRows(spec.data as Record<string, unknown>[], spec.xKey, spec.series);
      if (rowErr) {
        return { ok: false as const, message: rowErr };
      }
      const data = normalizeData(spec.data as Record<string, unknown>[], spec.series);
      return { ok: true as const, spec: { ...spec, data } };
    } catch {
      return { ok: false as const, message: 'JSON 解析失败' };
    }
  }, [code]);

  if (!result.ok) {
    return (
      <div className="my-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        图表无法渲染：{result.message}
      </div>
    );
  }

  const { type, data, xKey, series, height = 300 } = result.spec;
  const tooltipStyle = {
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '12px',
  };

  const axisStroke = 'var(--muted-foreground)';
  const gridStroke = 'var(--border)';

  const chart = (
    <>
      <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey={xKey}
        tick={{ fontSize: 11, fill: axisStroke }}
        axisLine={{ stroke: gridStroke }}
        tickLine={{ stroke: gridStroke }}
      />
      <YAxis
        tick={{ fontSize: 11, fill: axisStroke }}
        axisLine={{ stroke: gridStroke }}
        tickLine={{ stroke: gridStroke }}
        width={40}
      />
      <Tooltip
        contentStyle={tooltipStyle}
        labelStyle={{ color: 'var(--foreground)' }}
      />
      <Legend wrapperStyle={{ fontSize: '12px' }} />
      {type === 'line'
        ? series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name ?? s.key}
              stroke={palette[i % palette.length]}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 1 }}
              activeDot={{ r: 4 }}
            />
          ))
        : series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name ?? s.key}
              fill={palette[i % palette.length]}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          ))}
    </>
  );

  return (
    <div className="my-4 w-full overflow-x-auto rounded-lg border border-border bg-muted/30 p-3 dark:bg-muted/15">
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {type === 'line' ? (
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              {chart}
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              {chart}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
