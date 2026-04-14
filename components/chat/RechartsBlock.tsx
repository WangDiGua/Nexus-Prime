'use client';

import { useMemo } from 'react';
import { z } from 'zod';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const baseChartSchema = z.object({
  type: z.enum(['line', 'bar', 'pie']),
  data: z.array(z.record(z.unknown())).min(1).max(200),
  height: z.number().min(160).max(520).optional(),
});

const axisChartSchema = baseChartSchema.extend({
  type: z.enum(['line', 'bar']),
  xKey: z.string().min(1).optional(),
  series: z
    .array(
      z.object({
        key: z.string().min(1),
        name: z.string().optional(),
      }),
    )
    .min(1)
    .max(8)
    .optional(),
});

const pieChartSchema = baseChartSchema.extend({
  type: z.literal('pie'),
  nameKey: z.string().min(1).optional(),
  valueKey: z.string().min(1).optional(),
});

type AxisSeries = { key: string; name?: string };

type AxisChartSpec = {
  type: 'line' | 'bar';
  data: Record<string, unknown>[];
  xKey: string;
  series: AxisSeries[];
  height?: number;
};

type PieChartSpec = {
  type: 'pie';
  data: Record<string, unknown>[];
  nameKey: string;
  valueKey: string;
  height?: number;
};

type NormalizedChartSpec = AxisChartSpec | PieChartSpec;

function isNumericLike(value: unknown) {
  return (
    typeof value === 'number' ||
    (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)))
  );
}

function normalizeNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return 0;
}

function inferAxisFields(rows: Record<string, unknown>[]) {
  const firstRow = rows[0];
  if (!firstRow) return { xKey: null as string | null, series: [] as AxisSeries[] };

  const keys = Object.keys(firstRow);
  const numericKeys = keys.filter((key) =>
    rows.every((row) => {
      const value = row[key];
      return value == null || isNumericLike(value);
    }),
  );
  const xKey = keys.find((key) => !numericKeys.includes(key)) ?? keys[0] ?? null;
  const series = numericKeys
    .filter((key) => key !== xKey)
    .map((key) => ({ key, name: key }));

  return { xKey, series };
}

function inferPieFields(rows: Record<string, unknown>[]) {
  const firstRow = rows[0];
  if (!firstRow) return { nameKey: null as string | null, valueKey: null as string | null };

  const keys = Object.keys(firstRow);
  const valueKey =
    keys.find((key) => key.toLowerCase() === 'value') ??
    keys.find((key) =>
      rows.every((row) => {
        const value = row[key];
        return value == null || isNumericLike(value);
      }),
    ) ??
    null;
  const nameKey =
    keys.find((key) => key.toLowerCase() === 'name') ??
    keys.find((key) => key !== valueKey) ??
    null;

  return { nameKey, valueKey };
}

function validateAxisRows(
  rows: Record<string, unknown>[],
  xKey: string,
  series: AxisSeries[],
): string | null {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!(xKey in row)) {
      return `第 ${i + 1} 行缺少横轴字段“${xKey}”`;
    }
    for (const item of series) {
      if (!(item.key in row)) {
        return `第 ${i + 1} 行缺少“${item.key}”`;
      }
      if (!isNumericLike(row[item.key])) {
        return `“${item.key}”必须是数字（第 ${i + 1} 行）`;
      }
    }
  }
  return null;
}

function validatePieRows(
  rows: Record<string, unknown>[],
  nameKey: string,
  valueKey: string,
): string | null {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!(nameKey in row)) {
      return `第 ${i + 1} 行缺少名称字段“${nameKey}”`;
    }
    if (!(valueKey in row)) {
      return `第 ${i + 1} 行缺少数值字段“${valueKey}”`;
    }
    if (!isNumericLike(row[valueKey])) {
      return `“${valueKey}”必须是数字（第 ${i + 1} 行）`;
    }
  }
  return null;
}

function normalizeAxisData(rows: Record<string, unknown>[], series: AxisSeries[]) {
  return rows.map((row) => {
    const next = { ...row };
    for (const item of series) {
      next[item.key] = normalizeNumber(next[item.key]);
    }
    return next;
  });
}

function normalizePieData(
  rows: Record<string, unknown>[],
  nameKey: string,
  valueKey: string,
) {
  return rows.map((row) => ({
    ...row,
    [nameKey]: String(row[nameKey] ?? ''),
    [valueKey]: normalizeNumber(row[valueKey]),
  }));
}

/** 与亮/暗背景都协调的序列色 */
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

function normalizeChartSpec(input: unknown):
  | { ok: true; spec: NormalizedChartSpec }
  | { ok: false; message: string } {
  const baseParsed = baseChartSchema.safeParse(input);
  if (!baseParsed.success) {
    return {
      ok: false,
      message: baseParsed.error.issues.map((issue) => issue.message).join('；'),
    };
  }

  if (baseParsed.data.type === 'pie') {
    const parsed = pieChartSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues.map((issue) => issue.message).join('；'),
      };
    }

    const { data, height } = parsed.data;
    const inferred = inferPieFields(data as Record<string, unknown>[]);
    const nameKey = parsed.data.nameKey ?? inferred.nameKey;
    const valueKey = parsed.data.valueKey ?? inferred.valueKey;

    if (!nameKey || !valueKey) {
      return {
        ok: false,
        message: '饼图缺少可识别的名称字段或数值字段',
      };
    }

    const rowErr = validatePieRows(
      data as Record<string, unknown>[],
      nameKey,
      valueKey,
    );
    if (rowErr) {
      return { ok: false, message: rowErr };
    }

    return {
      ok: true,
      spec: {
        type: 'pie',
        data: normalizePieData(data as Record<string, unknown>[], nameKey, valueKey),
        nameKey,
        valueKey,
        height,
      },
    };
  }

  const parsed = axisChartSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((issue) => issue.message).join('；'),
    };
  }

  const { data, height, type } = parsed.data;
  const inferred = inferAxisFields(data as Record<string, unknown>[]);
  const xKey = parsed.data.xKey ?? inferred.xKey;
  const series = parsed.data.series ?? inferred.series;

  if (!xKey || !series.length) {
    return {
      ok: false,
      message: '图表缺少 xKey 或 series，且无法从数据中自动推断',
    };
  }

  const rowErr = validateAxisRows(data as Record<string, unknown>[], xKey, series);
  if (rowErr) {
    return { ok: false, message: rowErr };
  }

  return {
    ok: true,
    spec: {
      type,
      data: normalizeAxisData(data as Record<string, unknown>[], series),
      xKey,
      series,
      height,
    },
  };
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
      return normalizeChartSpec(json);
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

  const tooltipStyle = {
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '12px',
  };

  const axisStroke = 'var(--muted-foreground)';
  const gridStroke = 'var(--border)';
  const height = result.spec.height ?? 300;

  if (result.spec.type === 'pie') {
    const { data, nameKey, valueKey } = result.spec;
    return (
      <div className="my-4 w-full overflow-x-auto rounded-lg border border-border bg-muted/30 p-3 dark:bg-muted/15">
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Pie
                data={data}
                dataKey={valueKey}
                nameKey={nameKey}
                cx="50%"
                cy="50%"
                outerRadius="72%"
                innerRadius="36%"
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`${String(entry[nameKey] ?? index)}-${index}`}
                    fill={palette[index % palette.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  const { type, data, xKey, series } = result.spec;

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
        ? series.map((item, index) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.name ?? item.key}
              stroke={palette[index % palette.length]}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 1 }}
              activeDot={{ r: 4 }}
            />
          ))
        : series.map((item, index) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.name ?? item.key}
              fill={palette[index % palette.length]}
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
