import {
  LantuConnectClient,
  LantuConnectError,
  createLantuConnectConfigFromEnv,
} from 'lantuconnect-sdk';
import { ApiConfig, createApiConfig } from './api-config';

export interface LantuResource {
  id: string;
  name: string;
  displayName?: string;
  resourceCode?: string;
  type: 'agent' | 'skill' | 'mcp' | 'app' | 'dataset';
  status: 'draft' | 'testing' | 'published' | 'deprecated';
  description?: string;
  endpoint?: string;
  icon?: string;
  tags?: string[];
  ownerName?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LantuTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<
        string,
        {
          type: string;
          description?: string;
          enum?: string[];
        }
      >;
      required?: string[];
    };
  };
  _lantu?: {
    resourceType: string;
    resourceId: string;
    resourceName: string;
  };
}

export interface InvokeRequest {
  resourceType: string;
  resourceId: string;
  version?: string;
  timeoutSec?: number;
  payload?: Record<string, unknown>;
}

export interface InvokeResponse {
  success: boolean;
  data?: unknown;
  requestId?: string;
  traceId?: string;
  statusCode?: number;
  latency?: number;
  error?: string;
}

export interface AggregatedToolsResponse {
  tools: LantuTool[];
  routes: Array<{
    toolName: string;
    resourceType: string;
    resourceId: string;
  }>;
  warnings?: string[];
}

function createCoreClient(config: ApiConfig): LantuConnectClient {
  return new LantuConnectClient(
    createLantuConnectConfigFromEnv(process.env, {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      timeoutMs: config.timeout.api,
      apiKeyHeader: config.headers.apiKey,
      traceHeader: config.headers.trace,
    })
  );
}

function parseBodyString(body: string | undefined): unknown {
  if (body == null || body === '') return body;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

class LantuClient {
  private config: ApiConfig;
  private core: LantuConnectClient | null = null;

  constructor(config?: ApiConfig) {
    this.config = config || createApiConfig();
  }

  private getCore(): LantuConnectClient {
    if (!this.core) {
      this.core = createCoreClient(this.config);
    }
    return this.core;
  }

  private async mcpInitialize(resourceId: string): Promise<void> {
    const c = this.getCore();
    await c.mcpEnsureInitialized(resourceId);
  }

  async fetchResources(params?: {
    resourceType?: string;
    status?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: LantuResource[]; total: number; error?: string }> {
    try {
      const page = await this.getCore().listResources({
        page: params?.page,
        pageSize: params?.pageSize,
        resourceType: params?.resourceType,
        status: params?.status,
        keyword: params?.keyword,
      });

      const rawList = page.list || [];

      console.log(
        `[LantuClient] 📥 原始资源数据 (前2条):`,
        rawList.slice(0, 2).map((r) => {
          const row = r as Record<string, unknown>;
          return {
            resourceId: row.resourceId,
            resourceCode: row.resourceCode,
            displayName: row.displayName,
            resourceType: row.resourceType,
            status: row.status,
            _keys: Object.keys(row),
          };
        }),
      );

      const items: LantuResource[] = rawList.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          id: String(row.resourceId ?? row.id ?? ''),
          name: String(row.displayName ?? row.name ?? row.resourceCode ?? ''),
          displayName: row.displayName as string | undefined,
          resourceCode: row.resourceCode as string | undefined,
          type: (row.resourceType ?? row.type ?? 'mcp') as LantuResource['type'],
          status: (row.status ?? 'draft') as LantuResource['status'],
          description: row.description as string | undefined,
          endpoint: row.endpoint as string | undefined,
          icon: row.icon as string | undefined,
          tags: (row.tags as string[] | undefined) ?? (row.catalogTagNames as string[] | undefined),
          ownerName: (row.createdByName as string | undefined) ?? (row.ownerName as string | undefined),
          createdByName: row.createdByName as string | undefined,
          createdAt: (row.createTime as string | undefined) ?? (row.createdAt as string | undefined),
          updatedAt: (row.updateTime as string | undefined) ?? (row.updatedAt as string | undefined),
        };
      });

      return { items, total: page.total || 0 };
    } catch (error) {
      const msg =
        error instanceof LantuConnectError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);
      console.error('Failed to fetch resources:', error);
      return { items: [], total: 0, error: msg };
    }
  }

  async fetchAggregatedTools(
    entryResourceType?: string,
    entryResourceId?: string
  ): Promise<AggregatedToolsResponse> {
    const actualEntryType = entryResourceType || this.config.entryResource.type;
    const actualEntryId = entryResourceId || this.config.entryResource.id;

    if (actualEntryType && actualEntryId) {
      return this.fetchAggregatedToolsFromEntry(actualEntryType, actualEntryId);
    }

    return this.fetchAggregatedToolsFromMcpList();
  }

  private async fetchAggregatedToolsFromEntry(
    entryResourceType: string,
    entryResourceId: string
  ): Promise<AggregatedToolsResponse> {
    try {
      const agg = await this.getCore().aggregatedTools(entryResourceType, entryResourceId);
      const result = agg as Record<string, unknown>;
      const tf = this.config.toolsField;
      const rf = this.config.routeField;

      const openAiToolsRaw = (result[tf.openAiTools] ?? result.openAiTools ?? []) as unknown[];
      const routesData = (result[tf.routes] ?? result.routes ?? []) as unknown[];
      const warnings = (result[tf.warnings] ?? result.warnings ?? []) as string[];

      const tools: LantuTool[] = (openAiToolsRaw as unknown[]).map((t: unknown) => {
        const m = t as { function?: LantuTool['function']; _lantu?: LantuTool['_lantu'] };
        return {
          type: 'function' as const,
          function: m.function!,
          _lantu: m._lantu,
        };
      });

      const routes = (routesData as Record<string, unknown>[]).map((r) => ({
        toolName: String(r[rf.functionName] ?? r.unifiedFunctionName ?? ''),
        resourceType: String(r.resourceType ?? ''),
        resourceId: String(r.resourceId ?? ''),
      }));

      return { tools, routes, warnings };
    } catch (error) {
      console.error('Failed to fetch aggregated tools from entry:', error);
      return { tools: [], routes: [], warnings: [`Failed to fetch from entry: ${error}`] };
    }
  }

  private async fetchAggregatedToolsFromMcpList(): Promise<AggregatedToolsResponse> {
    try {
      console.log('[LantuClient] 🔍 开始获取已发布的 MCP 资源列表...');
      const { items: mcps, error: catalogError } = await this.fetchResources({
        resourceType: 'mcp',
        status: 'published',
      });
      if (catalogError) {
        return {
          tools: [],
          routes: [],
          warnings: [
            `资源目录请求失败（${catalogError}）。多为网关返回了非 JSON（例如 HTML 或 404 页）、或 baseUrl/Key 与 LantuConnect-Backend 不一致。`,
          ],
        };
      }
      console.log(
        `[LantuClient] 📋 找到 ${mcps.length} 个已发布的 MCP 资源:`,
        mcps.map((m) => `${m.name}(${m.id})`)
      );

      if (mcps.length === 0) {
        return { tools: [], routes: [], warnings: ['No published MCP resources found'] };
      }

      const allTools: LantuTool[] = [];
      const allRoutes: AggregatedToolsResponse['routes'] = [];
      const warnings: string[] = [];

      for (const mcp of mcps) {
        try {
          console.log(`[LantuClient] 🔄 正在获取 MCP "${mcp.name}" (${mcp.id}) 的工具列表...`);
          const toolsList = await this.mcpToolsList(mcp.id);
          console.log(
            `[LantuClient] ✅ MCP "${mcp.name}" 返回 ${toolsList.length} 个工具:`,
            toolsList.map((t) => t.name)
          );

          for (const tool of toolsList) {
            const toolName = `mcp_${mcp.id}_${tool.name}`;
            allTools.push({
              type: 'function',
              function: {
                name: toolName,
                description: tool.description || `Tool from ${mcp.name}`,
                parameters:
                  (tool.inputSchema as LantuTool['function']['parameters']) ||
                  ({ type: 'object', properties: {} } as LantuTool['function']['parameters']),
              },
              _lantu: {
                resourceType: 'mcp',
                resourceId: mcp.id,
                resourceName: mcp.name,
              },
            });

            allRoutes.push({
              toolName,
              resourceType: 'mcp',
              resourceId: mcp.id,
            });
          }
        } catch (error) {
          console.error(`[LantuClient] ❌ 获取 MCP "${mcp.name}" 工具列表失败:`, error);
          warnings.push(`Failed to fetch tools from MCP ${mcp.name}: ${error}`);
        }
      }

      console.log(`[LantuClient] 🎉 总计聚合 ${allTools.length} 个工具，${allRoutes.length} 条路由`);
      return { tools: allTools, routes: allRoutes, warnings };
    } catch (error) {
      console.error('Failed to fetch aggregated tools from MCP list:', error);
      return { tools: [], routes: [], warnings: [`Failed: ${error}`] };
    }
  }

  async mcpToolsList(
    resourceId: string
  ): Promise<Array<{ name: string; description?: string; inputSchema?: object }>> {
    console.log(`[LantuClient] 📞 调用 mcpToolsList(${resourceId})`);

    const raw = await this.getCore().mcpToolsList(resourceId);
    const obj = raw as { tools?: Array<{ name: string; description?: string; inputSchema?: object }> };
    const tools = obj?.tools ?? (Array.isArray(raw) ? raw : []);
    return tools as Array<{ name: string; description?: string; inputSchema?: object }>;
  }

  async mcpInvoke(
    resourceId: string,
    payload: { method: string; arguments?: Record<string, unknown> },
    _retryCount = 0
  ): Promise<InvokeResponse> {
    const startTime = Date.now();
    const c = this.getCore();

    try {
      const body = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: payload.method,
        ...(payload.arguments ? { params: payload.arguments } : {}),
      };

      console.log(
        `[LantuClient] 🚀 MCP Invoke → /mcp/v1/resources/mcp/${resourceId}/message ${JSON.stringify(body).slice(0, 200)}`
      );

      let { status, json: data } = await c.mcpMessage('mcp', resourceId, body);

      console.log(`[LantuClient] 📊 MCP Response status: ${status}`);

      if (status < 200 || status >= 300) {
        const errorText = JSON.stringify(data);
        console.error(`[LantuClient] ❌ MCP HTTP Error ${status}:`, errorText.slice(0, 300));

        if (
          _retryCount === 0 &&
          typeof errorText === 'string' &&
          errorText.includes('should be mcp initialize request')
        ) {
          console.log(`[LantuClient] 🔄 Session 过期，清除缓存并重新初始化 (${resourceId})...`);
          c.mcpClearSession(resourceId);
          await this.mcpInitialize(resourceId);
          console.log(`[LantuClient] 🔄 重新初始化完成，重试请求...`);
          return this.mcpInvoke(resourceId, payload, _retryCount + 1);
        }

        throw new Error(`HTTP ${status}: ${errorText.slice(0, 200)}`);
      }

      console.log(`[LantuClient] ✅ MCP Response data:`, JSON.stringify(data).slice(0, 300));

      const errObj = data as { error?: { message?: string } } | null;
      if (errObj && typeof errObj === 'object' && 'error' in errObj && errObj.error) {
        const msg = errObj.error?.message ?? '';
        if (_retryCount === 0 && msg.toLowerCase().includes('initialize')) {
          console.log(`[LantuClient] 🔄 Session 过期(JSON-RPC error)，清除缓存并重新初始化 (${resourceId})...`);
          c.mcpClearSession(resourceId);
          await this.mcpInitialize(resourceId);
          return this.mcpInvoke(resourceId, payload, _retryCount + 1);
        }
        return {
          success: false,
          error: errObj.error?.message || JSON.stringify(errObj.error),
          latency: Date.now() - startTime,
        };
      }

      const result = (data as { result?: unknown })?.result;

      return {
        success: true,
        data: result,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
        latency: Date.now() - startTime,
      };
    }
  }

  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    const startTime = Date.now();

    if (request.resourceType === 'mcp') {
      return this.invokeMcp(request);
    }

    try {
      const inv = await this.getCore().invoke({
        resourceType: request.resourceType,
        resourceId: request.resourceId,
        version: request.version,
        timeoutSec: request.timeoutSec,
        payload: request.payload,
      });

      const rf = this.config.responseField;
      const data =
        parseBodyString(inv.body) ??
        (inv as unknown as Record<string, unknown>)[rf.body];

      return {
        success: true,
        data,
        requestId: inv.requestId,
        traceId: inv.traceId,
        statusCode: inv.statusCode,
        latency: inv.latencyMs ?? Date.now() - startTime,
      };
    } catch (error) {
      const msg =
        error instanceof LantuConnectError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);
      console.error('Failed to invoke tool:', error);
      return {
        success: false,
        error: msg,
        latency: Date.now() - startTime,
      };
    }
  }

  private async invokeMcp(request: InvokeRequest): Promise<InvokeResponse> {
    const startTime = Date.now();
    const c = this.getCore();

    try {
      const payload = request.payload || {};

      if (typeof payload === 'object' && 'method' in payload) {
        const p = payload as { method: string; name?: string; arguments?: Record<string, unknown> };

        await this.mcpInitialize(request.resourceId);
        const body = {
          jsonrpc: '2.0' as const,
          id: 1,
          method: p.method,
          params: {
            name: p.name,
            arguments: p.arguments || {},
          },
        };

        console.log(`[LantuClient] 🔧 invokeMcp → ${request.resourceId} method=${p.method}`);
        console.log(`[LantuClient] 📤 发送 body:`, JSON.stringify(body, null, 2));

        const { status, json: data } = await c.mcpMessage('mcp', request.resourceId, body);

        console.log(`[LantuClient] 📥 MCP Response status: ${status}`);

        if (status < 200 || status >= 300) {
          const errorText = JSON.stringify(data);
          console.error(`[LantuClient] ❌ MCP HTTP Error:`, errorText.slice(0, 500));
          throw new Error(`HTTP ${status}: ${errorText.slice(0, 200)}`);
        }

        console.log(
          `[LantuClient] 📦 MCP Response data:`,
          JSON.stringify(data, null, 2).slice(0, 500)
        );

        const d = data as { error?: { message?: string }; result?: unknown };
        if (d.error) {
          return {
            success: false,
            error: d.error.message || JSON.stringify(d.error),
            latency: Date.now() - startTime,
          };
        }

        return {
          success: true,
          data: d.result,
          latency: Date.now() - startTime,
        };
      }

      throw new Error('Invalid MCP payload format');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[LantuClient] ❌ invokeMcp 失败:`, errorMessage);
      return {
        success: false,
        error: errorMessage,
        latency: Date.now() - startTime,
      };
    }
  }

  async invokeStream(
    request: InvokeRequest,
    onChunk: (chunk: string) => void
  ): Promise<InvokeResponse> {
    const startTime = Date.now();

    try {
      let fullContent = '';
      await this.getCore().invokeStream(
        {
          resourceType: request.resourceType,
          resourceId: request.resourceId,
          version: request.version,
          timeoutSec: request.timeoutSec,
          payload: request.payload,
        },
        (chunk) => {
          fullContent += chunk;
          onChunk(chunk);
        }
      );

      return {
        success: true,
        data: fullContent,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof LantuConnectError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);
      console.error('Failed to invoke stream:', error);
      return {
        success: false,
        error: errorMessage,
        latency: Date.now() - startTime,
      };
    }
  }

  async resolveResource(resourceType: string, resourceId: string): Promise<LantuResource | null> {
    try {
      const data = await this.getCore().getResource(resourceType, resourceId);
      return (data as LantuResource) || null;
    } catch (error) {
      console.error('Failed to resolve resource:', error);
      return null;
    }
  }

  /**
   * 从已发布目录中按 ID 查找资源摘要（resolve 无人设时，常用 description 作兜底）。
   */
  async fetchPublishedResourceSummary(
    resourceType: string,
    resourceId: string
  ): Promise<{ displayName?: string; description?: string } | null> {
    const pageSize = 300;
    let page = 1;
    const maxPages = 15;
    while (page <= maxPages) {
      const { items, total, error } = await this.fetchResources({
        resourceType,
        status: 'published',
        page,
        pageSize,
      });
      if (error && page === 1) {
        console.warn('[LantuClient] fetchPublishedResourceSummary:', error);
      }
      const hit = items.find((i) => i.id === resourceId);
      if (hit) {
        return {
          displayName: hit.displayName || hit.name,
          description: hit.description?.trim() || undefined,
        };
      }
      const t = typeof total === 'number' ? total : 0;
      if (items.length < pageSize || page * pageSize >= t) break;
      page += 1;
    }
    return null;
  }

  /**
   * POST /sdk/v1/resolve — 获取技能等资源的 spec（如 skill 的 contextPrompt / hosted_system_prompt）。
   * 用于门户对话：纯上下文技能往往未绑定 MCP，aggregatedTools 为 0，但仍需把人格注入 system prompt。
   */
  async resolveEntry(
    resourceType: string,
    resourceId: string
  ): Promise<{
    displayName?: string;
    /** 目录/技能详情 Markdown（与后台 service_detail_md 对应） */
    serviceDetailMd?: string;
    spec?: Record<string, unknown>;
    error?: string;
  } | null> {
    try {
      const data = await this.getCore().resolve({
        resourceType,
        resourceId,
      });
      const row = data as Record<string, unknown>;
      const pickStr = (keys: string[]): string | undefined => {
        for (const k of keys) {
          const v = row[k];
          if (typeof v === 'string' && v.trim()) return v.trim();
        }
        return undefined;
      };
      const rawSpec =
        row.spec && typeof row.spec === 'object'
          ? ({ ...(row.spec as Record<string, unknown>) } as Record<string, unknown>)
          : undefined;
      if (rawSpec) {
        if (
          rawSpec.contextPrompt == null &&
          typeof rawSpec.context_prompt === 'string'
        ) {
          rawSpec.contextPrompt = rawSpec.context_prompt;
        }
        if (rawSpec.entryDoc == null && typeof rawSpec.entry_doc === 'string') {
          rawSpec.entryDoc = rawSpec.entry_doc;
        }
      }
      return {
        displayName: pickStr(['displayName', 'display_name']),
        serviceDetailMd: pickStr(['serviceDetailMd', 'service_detail_md']),
        spec: rawSpec,
      };
    } catch (error) {
      const msg =
        error instanceof LantuConnectError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);
      console.error('[LantuClient] resolveEntry failed:', msg);
      return { error: msg };
    }
  }
}

export const lantuClient = new LantuClient();
