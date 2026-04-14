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
