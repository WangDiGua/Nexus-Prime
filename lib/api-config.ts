/**
 * Portal-side config shared with `lantuconnect-sdk`.
 * This file keeps Nexus-specific runtime fields such as ReAct iteration limits
 * and aggregated response-field mappings.
 */
export interface ApiConfig {
  baseUrl: string;
  apiKey: string | undefined;
  headers: {
    apiKey: string;
    trace: string;
  };
  /** HTTP client timeout in milliseconds. */
  timeout: {
    api: number;
  };
  responseField: {
    requestId: string;
    traceId: string;
    statusCode: string;
    status: string;
    latencyMs: string;
    body: string;
  };
  toolsField: {
    entry: string;
    openAiTools: string;
    routes: string;
    warnings: string;
  };
  routeField: {
    functionName: string;
    resourceType: string;
    resourceId: string;
    upstreamName: string;
  };
  react: {
    maxIterations: number;
  };
  entryResource: {
    type: string;
    id: string;
  };
}

export function createApiConfig(): ApiConfig {
  return {
    baseUrl: process.env.LANTU_API_BASE_URL || 'http://localhost:8080/regis',
    apiKey: process.env.LANTU_API_KEY,
    headers: {
      apiKey: process.env.LANTU_API_KEY_HEADER || 'X-Api-Key',
      trace: process.env.LANTU_API_TRACE_HEADER || 'X-Trace-Id',
    },
    timeout: {
      api: parseInt(process.env.LANTU_API_TIMEOUT_MS || '30000', 10),
    },
    responseField: {
      requestId: process.env.LANTU_FIELD_REQUEST_ID || 'requestId',
      traceId: process.env.LANTU_FIELD_TRACE_ID || 'traceId',
      statusCode: process.env.LANTU_FIELD_STATUS_CODE || 'statusCode',
      status: process.env.LANTU_FIELD_STATUS || 'status',
      latencyMs: process.env.LANTU_FIELD_LATENCY_MS || 'latencyMs',
      body: process.env.LANTU_FIELD_BODY || 'body',
    },
    toolsField: {
      entry: process.env.LANTU_FIELD_ENTRY || 'entry',
      openAiTools: process.env.LANTU_FIELD_OPENAI_TOOLS || 'openAiTools',
      routes: process.env.LANTU_FIELD_ROUTES || 'routes',
      warnings: process.env.LANTU_FIELD_WARNINGS || 'warnings',
    },
    routeField: {
      functionName: process.env.LANTU_FIELD_FUNCTION_NAME || 'unifiedFunctionName',
      resourceType: process.env.LANTU_FIELD_RESOURCE_TYPE || 'resourceType',
      resourceId: process.env.LANTU_FIELD_RESOURCE_ID || 'resourceId',
      upstreamName: process.env.LANTU_FIELD_UPSTREAM_NAME || 'upstreamToolName',
    },
    react: {
      maxIterations: parseInt(
        process.env.LANTU_REACT_MAX_ITERATIONS ||
          process.env.REACT_MAX_ITERATIONS ||
          '20',
        10,
      ),
    },
    entryResource: {
      type: process.env.LANTU_ENTRY_RESOURCE_TYPE || 'agent',
      id: process.env.LANTU_ENTRY_RESOURCE_ID || '',
    },
  };
}

export const defaultApiConfig = createApiConfig();
