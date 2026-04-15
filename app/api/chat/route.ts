import { NextRequest } from 'next/server';
import { createToolExecutor } from '@/lib/tool-executor';
import { createApiConfig } from '@/lib/api-config';
import { ChatSSEEvent, ToolCall, ToolResult } from '@/types/chat';
import { settingsService } from '@/lib/services/settings.service';
import { messageService } from '@/lib/services/message.service';
import { getCaches, getLantuClient, getVectorServices } from '@/lib/runtime/lazy-services';
import { getAuthUser } from '@/lib/auth/auth-service';

const apiConfig = createApiConfig();

const DASHSCOPE_BASE_URL = process.env.DASHSCOPE_BASE_URL?.replace(/\/$/, '');
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** 百炼思考链：多轮工具调用时需回传，见官方「思考模式」文档 */
  reasoning_content?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface ToolCallAccum {
  id?: string;
  name?: string;
  arguments: string;
}

function mergeToolCallStreamDeltas(
  delta: {
    tool_calls?: Array<{
      index?: number;
      id?: string;
      type?: string;
      function?: { name?: string; arguments?: string };
    }>;
  },
  toolCallsByIndex: Map<number, ToolCallAccum>
) {
  if (!delta.tool_calls?.length) return;
  for (const tc of delta.tool_calls) {
    const index = typeof tc.index === 'number' ? tc.index : 0;
    if (!toolCallsByIndex.has(index)) {
      toolCallsByIndex.set(index, { arguments: '' });
    }
    const acc = toolCallsByIndex.get(index)!;
    if (tc.id) acc.id = tc.id;
    if (tc.function?.name) acc.name = tc.function.name;
    if (tc.function?.arguments) acc.arguments += tc.function.arguments;
  }
}

function toolCallsFromStreamAccum(toolCallsByIndex: Map<number, ToolCallAccum>): ToolCall[] {
  const sorted = [...toolCallsByIndex.entries()].sort((a, b) => a[0] - b[0]);
  const out: ToolCall[] = [];
  for (const [, tc] of sorted) {
    if (!tc.id || !tc.name) continue;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.arguments || '{}');
    } catch {
      args = {};
    }
    out.push({ id: tc.id, name: tc.name, args });
  }
  return out;
}

/**
 * 流式调用百炼 OpenAI 兼容接口：转发 reasoning_content → reasoning_delta、content → content。
 * 思考模式需 stream + enable_thinking；部分模型不支持时会自动降级重试。
 */
async function streamDashScopeChatCompletion(
  messages: OpenAIMessage[],
  tools: Array<{ type: 'function'; function: { name: string; description: string; parameters: object } }> | undefined,
  settings: { model?: string; maxTokens?: number; temperature?: number } | undefined,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  /** 来自请求体或 DASHSCOPE_ENABLE_THINKING 的最终开关 */
  requestEnableThinking: boolean
): Promise<{ content: string; reasoning: string; toolCalls: ToolCall[]; finishReason: string }> {
  const model = settings?.model || process.env.DASHSCOPE_MODEL || 'qwen-plus-latest';
  let enableThinking = requestEnableThinking;

  const buildBody = (withThinking: boolean): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: settings?.maxTokens || 4096,
      temperature: settings?.temperature ?? 0.7,
      stream: true,
    };
    if (withThinking) {
      body.enable_thinking = true;
    }
    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }
    return body;
  };

  const post = (withThinking: boolean) =>
    fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify(buildBody(withThinking)),
    });

  let response = await post(enableThinking);
  if (!response.ok && enableThinking && response.status === 400) {
    const errPreview = await response.text();
    console.warn('[DashScope] Retrying without enable_thinking:', errPreview.slice(0, 300));
    enableThinking = false;
    response = await post(false);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM stream error (${response.status}): ${errorText.slice(0, 500)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('LLM stream: empty body');
  }

  let fullContent = '';
  let fullReasoning = '';
  let finishReason = 'stop';
  const toolCallsByIndex = new Map<number, ToolCallAccum>();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{
            delta?: {
              content?: string | null;
              reasoning_content?: string | null;
              tool_calls?: Array<{
                index?: number;
                id?: string;
                type?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
            message?: {
              tool_calls?: Array<{
                index?: number;
                id?: string;
                type?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
            finish_reason?: string | null;
          }>;
        };
        const choice = json.choices?.[0];
        const delta = choice?.delta;
        const message = choice?.message;
        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
        }
        if (message?.tool_calls?.length && toolCallsByIndex.size === 0) {
          mergeToolCallStreamDeltas({ tool_calls: message.tool_calls }, toolCallsByIndex);
        }
        if (delta?.reasoning_content) {
          const piece = String(delta.reasoning_content);
          fullReasoning += piece;
          await writer.write(
            encoder.encode(
              encodeSSE({
                type: 'reasoning_delta',
                content: piece,
              })
            )
          );
        }
        if (delta?.content) {
          const piece = String(delta.content);
          fullContent += piece;
          await writer.write(
            encoder.encode(
              encodeSSE({
                type: 'content',
                content: piece,
              })
            )
          );
        }
        if (delta) {
          mergeToolCallStreamDeltas(delta, toolCallsByIndex);
        }
      } catch {
        // 忽略单行解析失败
      }
    }
    if (done) break;
  }

  const toolCalls = toolCallsFromStreamAccum(toolCallsByIndex);
  return {
    content: fullContent,
    reasoning: fullReasoning,
    toolCalls,
    finishReason,
  };
}

function encodeSSE(event: ChatSSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

const SKILL_SERVICE_DETAIL_MAX = 12000;

/** 从 resolve 结果组装技能层（须置于 system 最前，避免被默认「三项能力」盖过） */
function buildSkillLayerFromResolve(resolved: {
  displayName?: string;
  serviceDetailMd?: string;
  spec?: Record<string, unknown>;
}): string {
  const parts: string[] = [];
  if (resolved.displayName?.trim()) {
    parts.push(`## 当前技能：${resolved.displayName.trim()}`);
  }
  const spec = resolved.spec;
  if (spec && typeof spec === 'object') {
    const ctx =
      typeof spec.contextPrompt === 'string' ? spec.contextPrompt.trim() : '';
    const doc =
      typeof spec.entryDoc === 'string' ? spec.entryDoc.trim() : '';
    if (ctx) {
      parts.push(`### 人设与行为（托管提示，必须遵守）\n${ctx}`);
    }
    if (doc) {
      parts.push(`### 入口说明\n${doc}`);
    }
  }
  const md = resolved.serviceDetailMd?.trim();
  if (md) {
    const clipped =
      md.length > SKILL_SERVICE_DETAIL_MAX
        ? `${md.slice(0, SKILL_SERVICE_DETAIL_MAX)}\n\n…（服务详情过长已截断）`
        : md;
    parts.push(`### 服务详情（Markdown）\n${clipped}`);
  }
  return parts.join('\n\n').trim();
}

async function getRelevantHistory(
  query: string,
  conversationId: string,
  limit: number = 5
): Promise<string> {
  try {
    const { embeddingService, vectorService } = await getVectorServices();
    const queryEmbedding = await embeddingService.embed(query);
    const similarMessages = await vectorService.searchSimilar(
      queryEmbedding.embedding,
      { topK: limit, queryText: query }
    );

    if (similarMessages.length === 0) return '';

    const conversationBlocks: string[] = [];
    const knowledgeBlocks: string[] = [];

    for (const item of similarMessages) {
      if (item.messageId) {
        const message = await messageService.findById(item.messageId);
        if (message && message.conversationId !== conversationId) {
          conversationBlocks.push(
            `${message.role.toLowerCase()}: ${message.content}`
          );
          continue;
        }
      }

      const metadata = item.metadata || {};
      const title =
        typeof metadata.title === 'string' ? metadata.title.trim() : '';
      const source =
        typeof metadata.source === 'string' ? metadata.source.trim() : '';
      const assetType =
        typeof metadata.assetType === 'string' ? metadata.assetType.trim() : '';
      const metaSummary = [
        typeof metadata.table_name === 'string' && metadata.table_name.trim()
          ? `表名：${metadata.table_name.trim()}`
          : '',
        typeof metadata.table_comment === 'string' &&
        metadata.table_comment.trim()
          ? `表说明：${metadata.table_comment.trim()}`
          : '',
        typeof metadata.question === 'string' && metadata.question.trim()
          ? `问题：${metadata.question.trim()}`
          : '',
        typeof metadata.metric_id === 'string' && metadata.metric_id.trim()
          ? `指标：${metadata.metric_id.trim()}`
          : '',
      ]
        .filter(Boolean)
        .join('；')
        .slice(0, 400);

      knowledgeBlocks.push(
        [
          title ? `标题：${title}` : '',
          assetType ? `类型：${assetType}` : '',
          source ? `来源：${source}` : '',
          metaSummary ? `补充：${metaSummary}` : '',
          `内容：${item.content.slice(0, 1600)}`,
        ]
          .filter(Boolean)
          .join('\n')
      );
    }

    const sections: string[] = [];
    if (conversationBlocks.length > 0) {
      sections.push(`[相关历史对话]\n${conversationBlocks.join('\n')}`);
    }
    if (knowledgeBlocks.length > 0) {
      sections.push(
        `[相关知识库]\n${knowledgeBlocks
          .map((block, index) => `#${index + 1}\n${block}`)
          .join('\n\n')}`
      );
    }

    return sections.join('\n\n');
  } catch (error) {
    console.error('[VectorSearch] Error:', error);
    return '';
  }
}

async function callLLM(
  messages: OpenAIMessage[],
  tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: object } }>,
  settings?: { model?: string; maxTokens?: number; temperature?: number }
): Promise<{ content: string | null; toolCalls: ToolCall[]; finishReason: string }> {
  const model = settings?.model || process.env.DASHSCOPE_MODEL || 'qwen-plus-latest';
  const { llmCache } = await getCaches();
  
  const cacheKey = `${model}:${JSON.stringify(messages.slice(-2))}:${tools?.length || 0}`;
  let cached: { content: string | null; toolCalls: ToolCall[]; finishReason: string } | null = null;
  try {
    cached = await llmCache.get<{ content: string | null; toolCalls: ToolCall[]; finishReason: string }>(cacheKey);
  } catch (e) {
    console.warn('[Cache] Redis 不可用，跳过 LLM 读缓存:', e);
  }

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

  try {
    await llmCache.set(cacheKey, result, 3600);
  } catch (e) {
    console.warn('[Cache] Redis 不可用，跳过 LLM 写缓存:', e);
  }

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
    /** 是否启用百炼思考链（流式 reasoning）；未传则使用环境变量 DASHSCOPE_ENABLE_THINKING */
    enableThinking?: boolean;
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

  const authUser = await getAuthUser().catch(() => null);

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const streamEnableThinking =
    typeof body.enableThinking === 'boolean'
      ? body.enableThinking
      : process.env.DASHSCOPE_ENABLE_THINKING === 'true';

  (async () => {
    try {
      let skillLayer = '';
      /** resolve 有内容 / 仅用目录 description 兜底 */
      let skillLayerSource: 'resolve' | 'catalog' | 'none' = 'none';

      if (
        body.entryResourceType === 'skill' &&
        body.entryResourceId != null &&
        String(body.entryResourceId).trim() !== ''
      ) {
        const rid = String(body.entryResourceId).trim();
        const lantuClient = await getLantuClient();
        const resolved = await lantuClient.resolveEntry('skill', rid);
        if (resolved?.error) {
          console.warn('[Chat] 技能 resolve 失败（仍将尝试聚合工具）:', resolved.error);
        } else if (resolved) {
          skillLayer = buildSkillLayerFromResolve(resolved);
          if (skillLayer.trim()) {
            skillLayerSource = 'resolve';
          } else {
            console.warn(
              '[Chat] 技能已选但 resolve 未返回可用人设/详情（hosted_system_prompt、entry_doc、service_detail_md 可能均为空），尝试目录 description 兜底'
            );
          }
        }

        if (!skillLayer.trim()) {
          const sum = await lantuClient.fetchPublishedResourceSummary(
            'skill',
            rid
          );
          if (sum?.description?.trim()) {
            const title = sum.displayName?.trim();
            skillLayer = [
              title ? `## 当前技能：${title}` : '',
              `### 技能简介（来自资源目录）\n${sum.description!.trim()}`,
            ]
              .filter(Boolean)
              .join('\n\n');
            skillLayerSource = 'catalog';
          }
        }
      }

      const skillSelected =
        body.entryResourceType === 'skill' &&
        body.entryResourceId != null &&
        String(body.entryResourceId).trim() !== '';

      const skillPreamble =
        skillLayer.trim().length > 0
          ? `【最高优先级｜用户已通过技能商城选择本技能】\n${skillLayer.trim()}\n\n` +
            `你必须以上述人设与说明为准回复；不要忽略角色去主动列举「美食推荐、网页抓取、八字命理」等通用能力清单，除非用户明确询问且与当前人设一致。\n\n---\n\n`
          : skillSelected
            ? `【最高优先级｜用户已选择技能】\n` +
              `服务端未返回该技能的人设或详情（请检查后台「托管人设 / hosted_system_prompt」或「服务详情」）。` +
              `请勿用默认助手模板里的「美食推荐/网页抓取/八字命理」清单代替用户所选技能；若无法扮演，请简短说明需管理员配置后再试。\n\n---\n\n`
            : '';

      const toolExecutor = await createToolExecutor(
        body.entryResourceType,
        body.entryResourceId,
        {
          requestContext: {
            ...(authUser?.userId ? { actor_id: authUser.userId } : {}),
            ...(authUser?.username ? { actor_name: authUser.username } : {}),
            ...(authUser?.role ? { actor_role: authUser.role } : {}),
            ...(body.conversationId ? { conversation_id: body.conversationId } : {}),
          },
        },
      );
      const tools = toolExecutor.getToolDefinitions();
      const hasAskDataTool = tools.some((tool) =>
        tool.function.name.includes('ask_data_query'),
      );

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

      const baseSystemPrompt = userSettings?.systemPrompt || `你是 Nexus-Prime，一个友好、专业的 AI 助手，拥有丰富的远程工具能力。

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

## 回复中的图表（可选）

需要**折线图/柱状图/饼图**时，使用 \`\`\`chart 代码块，内容为**单行或多行 JSON**（合法 JSON 即可），字段：
- \`type\`: \`"line"\`、\`"bar"\` 或 \`"pie"\`
- \`data\`: 对象数组
- 折线图/柱状图推荐提供：
  - \`xKey\`: 横轴类别字段名
  - \`series\`: \`[{ "key": "数值列名", "name": "图例名（可选）" }]\`，最多 8 条序列
- 饼图推荐提供：
  - \`nameKey\`: 名称字段名
  - \`valueKey\`: 数值字段名
- \`height\`: 可选，图表高度（像素，160–520）

如果字段名清晰，也可以省略 \`xKey\`、\`series\`、\`nameKey\`、\`valueKey\`，系统会尝试自动推断。

需要流程图/时序图等可用 \`\`\`mermaid 代码块。

## 对话风格

1. 保持友好、自然的对话风格
2. 调用工具前，简要说明你将做什么
3. 将工具返回的结果以自然的方式呈现给用户
4. 如果工具调用失败，向用户解释情况并提供替代方案`;

      /** 技能层必须放在最前，否则默认「核心能力」会压过角色扮演 */
      const askDataPriorityPrompt = hasAskDataTool
        ? `

## Data Query Priority

When the user asks for campus business data, grouped statistics, rankings, trends, rosters, or identifier-based attribute lookup, prefer the ask_data_query tool.
- Do not guess numbers, factual records, or attribute values from memory.
- If the tool returns a table, chart, or clarification question, use that result directly.
- For employee number, student number, roster, title, department, status, and similar point lookups, call the data tool before answering.
`
        : '';

      const askDataModePrompt =
        body.entryResourceType === 'ask_data'
          ? `

## Active Mode

The user explicitly entered 智能问数 mode.
- Treat this conversation as a campus data query workflow first.
- Prefer asking the ask_data_query tool for factual data, statistics, dimensions, trends, rosters, and identifier-based lookups.
- Keep answers grounded in tool output instead of general speculation.
`
          : '';

      const systemPrompt =
        skillPreamble +
        baseSystemPrompt +
        askDataModePrompt +
        askDataPriorityPrompt;

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

        if (relevantHistory) {
          conversationHistory.push({
            role: 'system',
            content: relevantHistory,
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
          content: (() => {
            const base = `ReAct 模式启动，已加载 ${tools.length} 个远程工具`;
            if (skillLayer.trim().length === 0) {
              return skillSelected
                ? `${base}；已选技能但未拉到人设/详情（resolve 与目录 description 均为空，请在后台填写托管人设或资源描述）`
                : base;
            }
            if (skillLayerSource === 'catalog') {
              return `${base}；已用资源目录「描述」注入（建议在后台补全托管人设以获得更好角色效果）`;
            }
            return `${base}；已注入技能上下文（人设/详情，已置于 system 最前）`;
          })(),
        }))
      );

      while (iteration < maxIterations) {
        iteration++;
        console.log(`\n[ReAct] ====== 第 ${iteration}/${maxIterations} 次迭代 ======`);

        let llmResponse: {
          content: string | null;
          reasoning: string;
          toolCalls: ToolCall[];
          finishReason: string;
        };

        try {
          llmResponse = await streamDashScopeChatCompletion(
            conversationHistory,
            openaiTools,
            {
              model: userSettings?.defaultModel,
              maxTokens: userSettings?.maxTokens,
              temperature: userSettings?.temperature,
            },
            writer,
            encoder,
            streamEnableThinking
          );
        } catch (streamErr) {
          console.warn('[ReAct] Stream failed, using non-streaming fallback:', streamErr);
          await writer.write(
            encoder.encode(
              encodeSSE({
                type: 'thinking',
                content: `第 ${iteration} 轮思考中…`,
              })
            )
          );
          const fallback = await callLLM(conversationHistory, openaiTools, {
            model: userSettings?.defaultModel,
            maxTokens: userSettings?.maxTokens,
            temperature: userSettings?.temperature,
          });
          llmResponse = {
            content: fallback.content,
            reasoning: '',
            toolCalls: fallback.toolCalls,
            finishReason: fallback.finishReason,
          };
          if (fallback.content) {
            await writer.write(
              encoder.encode(
                encodeSSE({
                  type: 'content',
                  content: fallback.content,
                })
              )
            );
          }
        }

        console.log(
          `[ReAct] 🤖 LLM 响应: content=${llmResponse.content?.slice(0, 80) || '(空)'} toolCalls=${llmResponse.toolCalls.length}`
        );

        if (llmResponse.toolCalls.length === 0) {
          await writer.write(
            encoder.encode(
              encodeSSE({
                type: 'thinking',
                content: '思考完成',
              })
            )
          );
          await writer.write(encoder.encode(encodeSSE({ type: 'done' })));
          break;
        }

        await writer.write(
          encoder.encode(
            encodeSSE({
              type: 'thinking',
              content: `调用 ${llmResponse.toolCalls.length} 个工具`,
            })
          )
        );

        const assistantMessage: OpenAIMessage = {
          role: 'assistant',
          content: llmResponse.content || '',
          ...(llmResponse.reasoning ? { reasoning_content: llmResponse.reasoning } : {}),
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

          const cacheKey = toolExecutor.buildCacheKey(toolCall);
          let result: ToolResult;
          const { toolCache } = await getCaches();

          let cachedResult: ToolResult | null = null;
          try {
            cachedResult = await toolCache.get<ToolResult>(cacheKey);
          } catch (e) {
            console.warn('[Cache] Redis 不可用，跳过工具读缓存:', e);
          }
          if (cachedResult) {
            console.log(`[Cache] Tool result hit for ${toolCall.name}`);
            result = { ...cachedResult, cached: true };
          } else {
            result = await toolExecutor.execute(toolCall);
            if (result.status === 'success') {
              try {
                await toolCache.set(cacheKey, result, 86400);
              } catch (e) {
                console.warn('[Cache] Redis 不可用，跳过工具写缓存:', e);
              }
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
