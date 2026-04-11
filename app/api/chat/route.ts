import { NextRequest } from 'next/server';
import { createToolExecutor } from '@/lib/tool-executor';
import { createApiConfig } from '@/lib/api-config';
import { ChatSSEEvent, ToolCall, ToolResult } from '@/types/chat';
import { settingsService } from '@/lib/services/settings.service';
import { messageService } from '@/lib/services/message.service';
import { llmCache, toolCache } from '@/lib/cache/redis';
import { vectorService } from '@/lib/vector/milvus';
import { embeddingService } from '@/lib/vector/embedding';

const apiConfig = createApiConfig();

const DASHSCOPE_BASE_URL = process.env.DASHSCOPE_BASE_URL?.replace(/\/$/, '');
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

function encodeSSE(event: ChatSSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

async function getRelevantHistory(
  query: string,
  conversationId: string,
  limit: number = 5
): Promise<OpenAIMessage[]> {
  try {
    const queryEmbedding = await embeddingService.embed(query);
    const similarMessages = await vectorService.searchSimilar(queryEmbedding.embedding, { topK: limit });
    
    if (similarMessages.length === 0) return [];

    const messageIds = similarMessages.map((m) => m.messageId);
    const messages = await Promise.all(
      messageIds.map((id) => messageService.findById(id))
    );

    return messages
      .filter((m) => m && m.conversationId !== conversationId)
      .map((m) => ({
        role: m!.role.toLowerCase() as 'user' | 'assistant',
        content: m!.content,
      }));
  } catch (error) {
    console.error('[VectorSearch] Error:', error);
    return [];
  }
}

async function callLLM(
  messages: OpenAIMessage[],
  tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: object } }>,
  settings?: { model?: string; maxTokens?: number; temperature?: number }
): Promise<{ content: string | null; toolCalls: ToolCall[]; finishReason: string }> {
  const model = settings?.model || process.env.DASHSCOPE_MODEL || 'qwen-plus-latest';
  
  const cacheKey = `${model}:${JSON.stringify(messages.slice(-2))}:${tools?.length || 0}`;
  const cached = await llmCache.get<{ content: string | null; toolCalls: ToolCall[]; finishReason: string }>(cacheKey);
  
  if (cached) {
    console.log('[Cache] LLM response hit');
    return cached;
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: settings?.maxTokens || 4096,
    temperature: settings?.temperature ?? 0.7,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const response = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText.slice(0, 500)}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  const finishReason = data.choices?.[0]?.finish_reason || 'stop';

  const toolCalls: ToolCall[] = [];
  if (message?.tool_calls) {
    for (const tc of message.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }
      toolCalls.push({
        id: tc.id,
        name: tc.function.name,
        args,
      });
    }
  }

  const result = {
    content: message?.content || null,
    toolCalls,
    finishReason,
  };

  await llmCache.set(cacheKey, result, 3600);

  return result;
}

export async function POST(req: NextRequest) {
  if (!DASHSCOPE_API_KEY || !DASHSCOPE_BASE_URL) {
    return new Response(
      JSON.stringify({ error: 'Missing DASHSCOPE_API_KEY or DASHSCOPE_BASE_URL' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: {
    messages?: Array<{ role: string; content: string }>;
    conversationId?: string;
    entryResourceType?: string;
    entryResourceId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const userMessages = body.messages || [];
  if (userMessages.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Messages array is empty' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let userSettings: {
    defaultModel?: string;
    systemPrompt?: string | null;
    maxTokens?: number;
    temperature?: number;
    enableHistoryContext?: boolean;
    historyContextLimit?: number;
    enableVectorSearch?: boolean;
  } | null = null;

  try {
    const settings = await settingsService.getSettings();
    userSettings = {
      defaultModel: settings.defaultModel,
      systemPrompt: settings.systemPrompt,
      maxTokens: settings.maxTokens,
      temperature: settings.temperature,
      enableHistoryContext: settings.enableHistoryContext,
      historyContextLimit: settings.historyContextLimit,
      enableVectorSearch: settings.enableVectorSearch,
    };
  } catch {
    // User not authenticated or settings not found
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  (async () => {
    try {
      const toolExecutor = await createToolExecutor(
        body.entryResourceType,
        body.entryResourceId
      );
      const tools = toolExecutor.getToolDefinitions();

      console.log(`[ReAct] 📦 获取到 ${tools.length} 个工具定义`);

      let openaiTools: Array<{ type: 'function'; function: { name: string; description: string; parameters: object } }> | undefined;
      
      if (tools.length > 0) {
        openaiTools = tools.map((t) => ({
          type: 'function' as const,
          function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          },
        }));
      }

      const systemPrompt = userSettings?.systemPrompt || `你是 Nexus-Prime，一个友好、专业的 AI 助手，拥有丰富的远程工具能力。

## 核心能力

你通过 MCP 协议连接了多个远程工具服务器，可以：
- 🍳 **美食推荐**：推荐今天吃什么、获取菜谱
- 🌐 **网页抓取**：获取网页内容
- 🔮 **八字命理**：根据时间计算八字信息
- 以及更多...

## 工具调用原则

**重要：当用户的问题与你拥有的工具功能相关时，应该主动调用工具获取实时/专业数据！**

## 参数格式要求

**关键：工具参数值必须是纯文本，不要使用任何 Markdown 格式！**

## 对话风格

1. 保持友好、自然的对话风格
2. 调用工具前，简要说明你将做什么
3. 将工具返回的结果以自然的方式呈现给用户
4. 如果工具调用失败，向用户解释情况并提供替代方案`;

      const conversationHistory: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
      ];

      if (userSettings?.enableHistoryContext && body.conversationId) {
        const contextLimit = userSettings.historyContextLimit || 10;
        const history = await messageService.getConversationContext(
          body.conversationId,
          contextLimit
        );
        
        for (const msg of history) {
          conversationHistory.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content,
          });
        }
      }

      if (userSettings?.enableVectorSearch && userMessages.length > 0) {
        const lastUserMessage = userMessages[userMessages.length - 1];
        const relevantHistory = await getRelevantHistory(
          lastUserMessage.content,
          body.conversationId || '',
          3
        );
        
        if (relevantHistory.length > 0) {
          conversationHistory.push({
            role: 'system',
            content: `[相关历史上下文]\n${relevantHistory.map((m) => `${m.role}: ${m.content}`).join('\n')}`,
          });
        }
      }

      for (const msg of userMessages) {
        conversationHistory.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }

      let iteration = 0;
      const maxIterations = apiConfig.react.maxIterations;

      await writer.write(
        encoder.encode(encodeSSE({
          type: 'thinking',
          content: `🔄 ReAct 模式启动，已加载 ${tools.length} 个远程工具`,
        }))
      );

      while (iteration < maxIterations) {
        iteration++;
        console.log(`\n[ReAct] ====== 第 ${iteration}/${maxIterations} 次迭代 ======`);

        await writer.write(
          encoder.encode(encodeSSE({
            type: 'thinking',
            content: `💭 第 ${iteration} 轮思考中...`,
          }))
        );

        const llmResponse = await callLLM(conversationHistory, openaiTools, {
          model: userSettings?.defaultModel,
          maxTokens: userSettings?.maxTokens,
          temperature: userSettings?.temperature,
        });

        console.log(`[ReAct] 🤖 LLM 响应: content=${llmResponse.content?.slice(0, 80) || '(空)'} toolCalls=${llmResponse.toolCalls.length}`);

        if (llmResponse.content) {
          await writer.write(
            encoder.encode(encodeSSE({
              type: 'content',
              content: llmResponse.content,
            }))
          );
        }

        if (llmResponse.toolCalls.length === 0) {
          await writer.write(
            encoder.encode(encodeSSE({
              type: 'thinking',
              content: '✅ 思考完成',
            }))
          );
          await writer.write(encoder.encode(encodeSSE({ type: 'done' })));
          break;
        }

        await writer.write(
          encoder.encode(encodeSSE({
            type: 'thinking',
            content: `🔧 调用 ${llmResponse.toolCalls.length} 个工具`,
          }))
        );

        const assistantMessage: OpenAIMessage = {
          role: 'assistant',
          content: llmResponse.content || '',
          tool_calls: llmResponse.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.args),
            },
          })),
        };
        conversationHistory.push(assistantMessage);

        for (const toolCall of llmResponse.toolCalls) {
          await writer.write(
            encoder.encode(encodeSSE({
              type: 'tool_call',
              toolCall,
            }))
          );

          const cacheKey = `${toolCall.name}:${JSON.stringify(toolCall.args)}`;
          let result: ToolResult;
          
          const cachedResult = await toolCache.get<ToolResult>(cacheKey);
          if (cachedResult) {
            console.log(`[Cache] Tool result hit for ${toolCall.name}`);
            result = { ...cachedResult, cached: true };
          } else {
            result = await toolExecutor.execute(toolCall);
            if (result.status === 'success') {
              await toolCache.set(cacheKey, result, 86400);
            }
          }

          await writer.write(
            encoder.encode(encodeSSE({
              type: 'tool_result',
              result,
            }))
          );

          conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolExecutor.formatResultForLLM(result),
          });
        }
      }

      if (iteration >= maxIterations) {
        await writer.write(encoder.encode(encodeSSE({ type: 'done' })));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await writer.write(
        encoder.encode(encodeSSE({
          type: 'error',
          error: errorMessage,
        }))
      );
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
