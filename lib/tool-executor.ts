import type { LantuTool } from './lantu-client';
import { ToolCall, ToolResult } from '@/types/chat';
import { getLantuClient } from '@/lib/runtime/lazy-services';

function cleanMarkdownFormatting(value: unknown): unknown {
  if (typeof value === 'string') {
    let cleaned = value;
    if ((cleaned.startsWith('`') && cleaned.endsWith('`')) ||
        (cleaned.startsWith('"`') && cleaned.endsWith('`"')) ||
        (cleaned.startsWith("'`") && cleaned.endsWith("`'"))) {
      cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '');
    }
    cleaned = cleaned.trim();
    return cleaned;
  }
  if (Array.isArray(value)) {
    return value.map(item => cleanMarkdownFormatting(item));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = cleanMarkdownFormatting(val);
    }
    return result;
  }
  return value;
}

export interface ToolRoute {
  toolName: string;
  resourceType: string;
  resourceId: string;
}

export interface ToolExecutorConfig {
  tools: LantuTool[];
  routes: ToolRoute[];
}

export class ToolExecutor {
  private tools: Map<string, LantuTool> = new Map();
  private routes: Map<string, ToolRoute> = new Map();

  constructor(executorConfig: ToolExecutorConfig) {
    for (const tool of executorConfig.tools) {
      this.tools.set(tool.function.name, tool);
    }
    for (const route of executorConfig.routes) {
      this.routes.set(route.toolName, route);
    }
  }

  getToolDefinitions(): LantuTool[] {
    return Array.from(this.tools.values());
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  getTool(name: string): LantuTool | undefined {
    return this.tools.get(name);
  }

  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();
    const route = this.routes.get(toolCall.name);

    console.log(`[ToolExecutor] 🔧 执行工具: ${toolCall.name}`);
    console.log(`[ToolExecutor]   参数:`, JSON.stringify(toolCall.args).slice(0, 200));
    if (route) {
      console.log(`[ToolExecutor]   路由: ${route.resourceType}/${route.resourceId}`);
    } else {
      console.log(`[ToolExecutor]   ⚠️ 未找到路由！`);
    }

    if (!route) {
      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        args: toolCall.args,
        result: null,
        status: 'error',
        error: `Unknown tool: ${toolCall.name}`,
        latency: Date.now() - startTime,
      };
    }

    try {
      const cleanedArgs = cleanMarkdownFormatting(toolCall.args) as Record<string, unknown>;
      
      console.log(`[ToolExecutor] 🧹 参数清理:`, {
        original: toolCall.args,
        cleaned: cleanedArgs,
        changed: JSON.stringify(toolCall.args) !== JSON.stringify(cleanedArgs)
      });

      let payload: Record<string, unknown>;
      
      if (route.resourceType === 'mcp') {
        const originalToolName = toolCall.name.replace(/^mcp_\d+_/, '');
        payload = {
          method: 'tools/call',
          name: originalToolName,
          arguments: cleanedArgs,
        };
      } else {
        payload = cleanedArgs;
      }

      const lantuClient = await getLantuClient();
      const response = await lantuClient.invoke({
        resourceType: route.resourceType,
        resourceId: route.resourceId,
        payload,
      });

      if (!response.success) {
        return {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          args: toolCall.args,
          result: null,
          status: 'error',
          error: response.error || 'Tool execution failed',
          latency: response.latency,
        };
      }

      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        args: toolCall.args,
        result: response.data,
        status: 'success',
        latency: response.latency,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        args: toolCall.args,
        result: null,
        status: 'error',
        error: errorMessage,
        latency: Date.now() - startTime,
      };
    }
  }

  formatResultForLLM(result: ToolResult): string {
    if (result.status === 'error') {
      return JSON.stringify({
        error: result.error,
        toolName: result.toolName,
      });
    }

    try {
      if (typeof result.result === 'string') {
        return result.result;
      }
      return JSON.stringify(result.result, null, 2);
    } catch {
      return String(result.result);
    }
  }
}

export async function createToolExecutor(
  entryResourceType?: string,
  entryResourceId?: string
): Promise<ToolExecutor> {
  const lantuClient = await getLantuClient();
  const { tools, routes } = await lantuClient.fetchAggregatedTools(
    entryResourceType,
    entryResourceId
  );

  return new ToolExecutor({ tools, routes });
}
