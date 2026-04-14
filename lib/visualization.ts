export type VisualizationRenderer =
  | 'echarts'
  | 'vega'
  | 'svg'
  | 'table'
  | 'markdown';

export interface VisualizationFallback {
  type?: 'table' | 'markdown' | 'text';
  showRawData?: boolean;
}

export interface VisualizationSpec {
  option: Record<string, unknown>;
}

export interface VisualizationChart {
  kind: string;
  spec: VisualizationSpec;
}

export interface VisualizationStyle {
  theme?: 'light' | 'dark';
  width?: string;
  height?: number;
  responsive?: boolean;
}

export interface VisualizationInteraction {
  tooltip?: boolean;
  legend?: boolean;
  dataZoom?: boolean;
  saveAsImage?: boolean;
  clickable?: boolean;
}

export interface VisualizationPayload {
  type: 'visualization';
  version: string;
  renderer: VisualizationRenderer;
  id?: string;
  title: string;
  subtitle?: string;
  description?: string;
  chart: VisualizationChart;
  data: {
    source: unknown;
    fields?: Array<{
      key: string;
      type: string;
      label?: string;
    }>;
  };
  style?: VisualizationStyle;
  interaction?: VisualizationInteraction;
  fallback?: VisualizationFallback;
  meta?: Record<string, unknown>;
}

export interface VisualizationErrorPayload {
  type: 'visualization_error';
  version: string;
  code: string;
  message: string;
  fallback?: VisualizationFallback;
}

export type VisualizationMessage =
  | VisualizationPayload
  | VisualizationErrorPayload;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function unwrapVisualizationCandidate(value: unknown): unknown {
  if (!isRecord(value)) return null;

  if (value.type === 'visualization' || value.type === 'visualization_error') {
    return value;
  }

  if ('visualization' in value) {
    return unwrapVisualizationCandidate(value.visualization);
  }

  if ('result' in value) {
    const nested = unwrapVisualizationCandidate(value.result);
    if (nested) return nested;
  }

  if ('payload' in value) {
    const nested = unwrapVisualizationCandidate(value.payload);
    if (nested) return nested;
  }

  return null;
}

export function extractVisualizationMessage(
  value: unknown,
): VisualizationMessage | null {
  const candidate = unwrapVisualizationCandidate(value);
  if (!candidate || !isRecord(candidate) || typeof candidate.type !== 'string') {
    return null;
  }

  if (candidate.type === 'visualization_error') {
    return candidate as unknown as VisualizationErrorPayload;
  }

  if (candidate.type !== 'visualization') {
    return null;
  }

  const chart = candidate.chart;
  const data = candidate.data;
  const renderer = candidate.renderer;
  const title = candidate.title;

  if (!isRecord(chart) || !isRecord(chart.spec)) {
    return null;
  }
  if (typeof renderer !== 'string' || typeof title !== 'string') {
    return null;
  }
  if (typeof chart.kind !== 'string') {
    return null;
  }
  if (!('option' in chart.spec) || !isRecord(chart.spec.option)) {
    return null;
  }
  if (!isRecord(data)) {
    return null;
  }

  return candidate as unknown as VisualizationPayload;
}

export function isVisualizationMessage(
  value: unknown,
): value is VisualizationMessage {
  return extractVisualizationMessage(value) !== null;
}

export function stringifyVisualizationJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function asVisualizationSourceRows(source: unknown): Record<string, unknown>[] {
  if (!Array.isArray(source)) return [];
  return source.filter(isRecord);
}

function inferFieldsFromRows(rows: Record<string, unknown>[]) {
  const firstRow = rows[0];
  if (!firstRow) {
    return {
      categoryKey: null as string | null,
      numericKeys: [] as string[],
    };
  }

  const keys = Object.keys(firstRow);
  const numericKeys = keys.filter((key) =>
    rows.every((row) => {
      const value = row[key];
      if (value == null) return true;
      if (isFiniteNumber(value)) return true;
      return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value));
    }),
  );

  const categoryKey =
    keys.find((key) => !numericKeys.includes(key)) ?? keys[0] ?? null;

  return {
    categoryKey,
    numericKeys: numericKeys.filter((key) => key !== categoryKey),
  };
}

function normalizeNumericValue(value: unknown) {
  if (isFiniteNumber(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return 0;
}

function hasRenderableSeries(option: Record<string, unknown>) {
  return Array.isArray(option.series) && option.series.length > 0;
}

function hasCartesianAxes(option: Record<string, unknown>) {
  return (
    (isRecord(option.xAxis) || Array.isArray(option.xAxis)) &&
    (isRecord(option.yAxis) || Array.isArray(option.yAxis))
  );
}

export function buildFallbackEChartsOption(
  payload: VisualizationPayload,
): Record<string, unknown> | null {
  const rows = asVisualizationSourceRows(payload.data.source);
  if (rows.length === 0) return null;

  const fields = payload.data.fields ?? [];
  const categoryField =
    fields.find((field) => field.type !== 'number')?.key ?? inferFieldsFromRows(rows).categoryKey;
  const numericFields =
    fields.filter((field) => field.type === 'number').map((field) => field.key) ??
    [];

  const inferred = inferFieldsFromRows(rows);
  const xKey = categoryField ?? inferred.categoryKey;
  const seriesKeys = (numericFields.length > 0 ? numericFields : inferred.numericKeys).filter(
    (key) => key !== xKey,
  );

  if (!xKey || seriesKeys.length === 0) {
    return null;
  }

  const normalizedRows = rows.map((row) => {
    const next: Record<string, unknown> = { ...row, [xKey]: String(row[xKey] ?? '') };
    for (const key of seriesKeys) {
      next[key] = normalizeNumericValue(row[key]);
    }
    return next;
  });

  const kind = payload.chart.kind.toLowerCase();
  const seriesType = kind.includes('line') ? 'line' : 'bar';

  return {
    animationDuration: 300,
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 16, right: 16, top: 48, bottom: 16, containLabel: true },
    xAxis: {
      type: 'category',
      data: normalizedRows.map((row) => String(row[xKey] ?? '')),
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: 'value',
    },
    series: seriesKeys.map((key) => ({
      name: fields.find((field) => field.key === key)?.label ?? key,
      type: seriesType,
      data: normalizedRows.map((row) => normalizeNumericValue(row[key])),
      ...(seriesType === 'line'
        ? { smooth: true, emphasis: { focus: 'series' } }
        : { emphasis: { focus: 'series' } }),
    })),
  };
}

export function resolveRenderableEChartsOption(
  payload: VisualizationPayload,
): Record<string, unknown> | null {
  const rawOption = payload.chart.spec.option;
  const kind = payload.chart.kind.toLowerCase();

  if (kind.includes('bar') || kind.includes('line')) {
    if (!hasRenderableSeries(rawOption) || !hasCartesianAxes(rawOption)) {
      return buildFallbackEChartsOption(payload);
    }
  }

  return rawOption;
}
