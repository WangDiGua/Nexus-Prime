import { McpServer, Resource, Skill } from '@/types/registry';

class RegistryClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = typeof window !== 'undefined' ? '/api' : '';
  }

  async fetchCapabilities(): Promise<{
    mcpServers: McpServer[];
    skills: Skill[];
    resources: Resource[];
  }> {
    try {
      const [toolsRes, resourcesRes] = await Promise.all([
        fetch(`${this.baseUrl}/tools`),
        fetch(`${this.baseUrl}/resources`),
      ]);

      const toolsData = toolsRes.ok
        ? await toolsRes.json()
        : { data: { tools: [], routes: [] } };
      const resourcesData = resourcesRes.ok
        ? await resourcesRes.json()
        : { data: { items: [] } };

      const tools = toolsData.data?.tools || [];
      const resources = resourcesData.data?.items || [];
      const serverMap = new Map<string, McpServer>();

      for (const tool of tools) {
        const meta = tool._lantu;
        if (meta && meta.resourceType === 'mcp') {
          const serverId = String(meta.resourceId || 'mcp-server');
          if (!serverMap.has(serverId)) {
            serverMap.set(serverId, {
              id: serverId,
              name: meta.resourceName || serverId,
              status: '已连接',
              icon: 'Server',
            });
          }
        }
      }

      const skills: Skill[] = tools.map((tool: any) => ({
        id: tool.function.name,
        name: tool.function.name,
        type: tool._lantu?.resourceType === 'skill' ? '远程' : '本地',
        icon: 'Zap',
        endpoint: `/invoke/${tool.function.name}`,
        description: tool.function.description || '可在当前会话中直接调用的工具能力。',
      }));

      return {
        mcpServers: Array.from(serverMap.values()),
        skills,
        resources,
      };
    } catch (error) {
      console.error('Failed to fetch capabilities:', error);
      return { mcpServers: [], skills: [], resources: [] };
    }
  }

  async fetchResources(params?: {
    resourceType?: string;
    status?: string;
    keyword?: string;
  }): Promise<Resource[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.resourceType) searchParams.set('resourceType', params.resourceType);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.keyword) searchParams.set('keyword', params.keyword);

      const response = await fetch(`${this.baseUrl}/resources?${searchParams.toString()}`);
      const data = await response.json();
      return data.data?.items || [];
    } catch (error) {
      console.error('Failed to fetch resources:', error);
      return [];
    }
  }

  async remoteInvoke(skill: Skill, payload: Record<string, unknown>): Promise<any> {
    const startTime = Date.now();
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `执行 ${skill.name}` }],
          toolCall: {
            name: skill.id,
            args: payload,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        status: 'success',
        data: data.result || data,
        latency: `${Date.now() - startTime}ms`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: `${Date.now() - startTime}ms`,
      };
    }
  }
}

export const registryClient = new RegistryClient();
