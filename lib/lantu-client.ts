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
      properties: Record<string, {
        type: string;
        description?: string;
        enum?: string[];
      }>;
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

class LantuClient {
  private config: ApiConfig;
  private mcpSessionCache: Map<string, string> = new Map();

  constructor(config?: ApiConfig) {
    this.config = config || createApiConfig();
  }

  private getHeaders(extra?: Record<string, string>): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers[this.config.headers.apiKey] = this.config.apiKey;
    }
    if (extra) {
      Object.assign(headers, extra);
    }
    return headers;
  }

  private async mcpInitialize(resourceId: string): Promise<void> {
    const cached = this.mcpSessionCache.get(resourceId);
    if (cached === 'done') return;

    console.log(`[LantuClient] 🔐 MCP Initialize (${resourceId})...`);

    try {
      const initBody = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'Nexus-Prime', version: '1.0.0' },
        },
      };

      let initResponse = await fetch(
        `${this.config.baseUrl}/mcp/v1/resources/mcp/${resourceId}/message`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(initBody),
        }
      );

      console.log(`[LantuClient] 🔐 Initialize response: ${initResponse.status}`);
      if (!initResponse.ok) {
        const errText = await initResponse.text();
        console.warn(`[LantuClient] ⚠️ Initialize 返回非200: ${errText.slice(0, 200)}`);
      }

      const initSid = initResponse.headers.get('mcp-session-id');
      if (initSid) {
        this.mcpSessionCache.set(resourceId, initSid);
        console.log(`[LantuClient] ✅ Initialize 成功, sessionId=${initSid.slice(0, 12)}...`);
      } else {
        console.log(`[LantuClient] ✅ Initialize 完成 (无session-id header，后端管理session)`);
      }

      console.log(`[LantuClient] 📤 发送 notifications/initialized...`);

      const notifBody = {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      };

      const notifResponse = await fetch(
        `${this.config.baseUrl}/mcp/v1/resources/mcp/${resourceId}/message`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(notifBody),
        }
      );

      console.log(`[LantuClient] 📤 initialized notification: ${notifResponse.status}`);

      this.mcpSessionCache.set(resourceId, 'done');
    } catch (error) {
      console.error(`[LantuClient] ❌ Initialize 失败:`, error);
      throw error;
    }
  }

  async fetchResources(params?: {
    resourceType?: string;
    status?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: LantuResource[]; total: number }> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.resourceType) searchParams.set('resourceType', params.resourceType);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.keyword) searchParams.set('keyword', params.keyword);
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));

      const response = await fetch(
        `${this.config.baseUrl}${this.config.sdk.resourcesPath}?${searchParams.toString()}`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const resultData = data.data || {};
      const rawList: any[] = resultData.list || [];

      console.log(`[LantuClient] 📥 原始资源数据 (前2条):`, rawList.slice(0, 2).map(r => ({
        resourceId: r.resourceId,
        resourceCode: r.resourceCode,
        displayName: r.displayName,
        resourceType: r.resourceType,
        status: r.status,
        _keys: Object.keys(r)
      })));

      const items: LantuResource[] = rawList.map((r: any) => ({
        id: r.resourceId || r.id || '',
        name: r.displayName || r.name || r.resourceCode || '',
        displayName: r.displayName,
        resourceCode: r.resourceCode,
        type: (r.resourceType || r.type || 'mcp') as LantuResource['type'],
        status: (r.status || 'draft') as LantuResource['status'],
        description: r.description,
        endpoint: r.endpoint,
        icon: r.icon,
        tags: r.tags || r.catalogTagNames,
        ownerName: r.createdByName || r.ownerName,
        createdByName: r.createdByName,
        createdAt: r.createTime || r.createdAt,
        updatedAt: r.updateTime || r.updatedAt,
      }));

      return { items, total: resultData.total || 0 };
    } catch (error) {
      console.error('Failed to fetch resources:', error);
      return { items: [], total: 0 };
    }
  }

  async fetchAggregatedTools(entryResourceType?: string, entryResourceId?: string): Promise<AggregatedToolsResponse> {
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
      const searchParams = new URLSearchParams();
      searchParams.set('entryResourceType', entryResourceType);
      searchParams.set('entryResourceId', entryResourceId);

      const response = await fetch(
        `${this.config.baseUrl}${this.config.sdk.toolsPath}?${searchParams.toString()}`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const result = data.data || {};

      const openAiTools = result[this.config.toolsField.openAiTools] || [];
      const routesData = result[this.config.toolsField.routes] || [];
      const warnings = result[this.config.toolsField.warnings] || [];

      const tools: LantuTool[] = openAiTools.map((t: any) => ({
        type: 'function',
        function: t.function,
        _lantu: t._lantu,
      }));

      const routes = routesData.map((r: any) => ({
        toolName: r[this.config.routeField.functionName],
        resourceType: r.resourceType,
        resourceId: r.resourceId,
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
      const { items: mcps } = await this.fetchResources({ resourceType: 'mcp', status: 'published' });
      console.log(`[LantuClient] 📋 找到 ${mcps.length} 个已发布的 MCP 资源:`, mcps.map(m => `${m.name}(${m.id})`));
      
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
          console.log(`[LantuClient] ✅ MCP "${mcp.name}" 返回 ${toolsList.length} 个工具:`, toolsList.map(t => t.name));

          for (const tool of toolsList) {
            const toolName = `mcp_${mcp.id}_${tool.name}`;
            allTools.push({
              type: 'function',
              function: {
                name: toolName,
                description: tool.description || `Tool from ${mcp.name}`,
                parameters: tool.inputSchema || ({ type: 'object', properties: {} } as any),
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

  async mcpToolsList(resourceId: string): Promise<Array<{
    name: string;
    description?: string;
    inputSchema?: object;
  }>> {
    console.log(`[LantuClient] 📞 调用 mcpToolsList(${resourceId})`);

    await this.mcpInitialize(resourceId);
    const response = await this.mcpInvoke(resourceId, { method: 'tools/list' });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get tools list');
    }

    const result = response.data as any;
    return result.result?.tools || result.tools || [];
  }

  async mcpInvoke(
    resourceId: string,
    payload: { method: string; arguments?: Record<string, unknown> },
    _retryCount = 0
  ): Promise<InvokeResponse> {
    const startTime = Date.now();

    try {
      const body = {
        jsonrpc: '2.0',
        id: 1,
        method: payload.method,
        ...(payload.arguments ? { params: payload.arguments } : {}),
      };

      console.log(`[LantuClient] 🚀 MCP Invoke → /mcp/v1/resources/mcp/${resourceId}/message ${JSON.stringify(body).slice(0, 200)}`);

      const response = await fetch(
        `${this.config.baseUrl}/mcp/v1/resources/mcp/${resourceId}/message`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(body),
        }
      );

      console.log(`[LantuClient] 📊 MCP Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LantuClient] ❌ MCP HTTP Error ${response.status}:`, errorText.slice(0, 300));

        if (_retryCount === 0 && errorText.includes('should be mcp initialize request')) {
          console.log(`[LantuClient] 🔄 Session 过期，清除缓存并重新初始化 (${resourceId})...`);
          this.mcpSessionCache.delete(resourceId);
          await this.mcpInitialize(resourceId);
          console.log(`[LantuClient] 🔄 重新初始化完成，重试请求...`);
          return this.mcpInvoke(resourceId, payload, _retryCount + 1);
        }

        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
      }

      const data = await response.json();
      console.log(`[LantuClient] ✅ MCP Response data:`, JSON.stringify(data).slice(0, 300));

      if (data.error) {
        if (_retryCount === 0 && data.error.message?.includes('initialize')) {
          console.log(`[LantuClient] 🔄 Session 过期(JSON-RPC error)，清除缓存并重新初始化 (${resourceId})...`);
          this.mcpSessionCache.delete(resourceId);
          await this.mcpInitialize(resourceId);
          return this.mcpInvoke(resourceId, payload, _retryCount + 1);
        }
        return {
          success: false,
          error: data.error.message || JSON.stringify(data.error),
          latency: Date.now() - startTime,
        };
      }

      return {
        success: true,
        data: data.result,
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

    const body: Record<string, unknown> = {
      [this.config.field.resourceType]: request.resourceType,
      [this.config.field.resourceId]: request.resourceId,
    };

    if (request.version) {
      body[this.config.field.version] = request.version;
    }
    if (request.timeoutSec) {
      body[this.config.field.timeoutSec] = request.timeoutSec;
    }
    if (request.payload) {
      body[this.config.field.payload] = request.payload;
    }

    try {
      const response = await fetch(
        `${this.config.baseUrl}${this.config.sdk.invokePath}`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const resultData = data.data || {};

      return {
        success: true,
        data: resultData[this.config.responseField.body],
        requestId: resultData[this.config.responseField.requestId],
        traceId: resultData[this.config.responseField.traceId],
        statusCode: resultData[this.config.responseField.statusCode],
        latency: resultData[this.config.responseField.latencyMs] || Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to invoke tool:', error);
      
      return {
        success: false,
        error: errorMessage,
        latency: Date.now() - startTime,
      };
    }
  }

  private async invokeMcp(request: InvokeRequest): Promise<InvokeResponse> {
    const startTime = Date.now();

    try {
      let payload = request.payload || {};
      
      if (typeof payload === 'object' && 'method' in payload) {
        const p = payload as any;

        await this.mcpInitialize(request.resourceId);
        const body = {
          jsonrpc: '2.0',
          id: 1,
          method: p.method,
          params: {
            name: p.name,
            arguments: p.arguments || {}
          }
        };

        console.log(`[LantuClient] 🔧 invokeMcp → ${request.resourceId} method=${p.method}`);
        console.log(`[LantuClient] 📤 发送 body:`, JSON.stringify(body, null, 2));

        const response = await fetch(
          `${this.config.baseUrl}/mcp/v1/resources/mcp/${request.resourceId}/message`,
          {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
          }
        );

        console.log(`[LantuClient] 📥 MCP Response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[LantuClient] ❌ MCP HTTP Error: ${errorText.slice(0, 500)}`);
          throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
        }

        const data = await response.json();
        console.log(`[LantuClient] 📦 MCP Response data:`, JSON.stringify(data, null, 2).slice(0, 500));

        if (data.error) {
          return {
            success: false,
            error: data.error.message || JSON.stringify(data.error),
            latency: Date.now() - startTime,
          };
        }

        return {
          success: true,
          data: data.result,
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
    
    const body: Record<string, unknown> = {
      [this.config.field.resourceType]: request.resourceType,
      [this.config.field.resourceId]: request.resourceId,
    };

    if (request.version) {
      body[this.config.field.version] = request.version;
    }
    if (request.timeoutSec) {
      body[this.config.field.timeoutSec] = request.timeoutSec;
    }
    if (request.payload) {
      body[this.config.field.payload] = request.payload;
    }

    try {
      const response = await fetch(
        `${this.config.baseUrl}${this.config.sdk.invokeStreamPath}`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        onChunk(chunk);
      }

      return {
        success: true,
        data: fullContent,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
      const response = await fetch(
        `${this.config.baseUrl}${this.config.sdk.resourcesPath}/${resourceType}/${resourceId}`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.data || null;
    } catch (error) {
      console.error('Failed to resolve resource:', error);
      return null;
    }
  }
}

export const lantuClient = new LantuClient();
