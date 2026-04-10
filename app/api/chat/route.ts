import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_INSTRUCTION = `你是一个名为 Nexus-Prime 的高级 AI 助手。
你拥有访问远程能力（Skills）和 MCP 服务器的权限。
当用户要求执行特定任务时，优先考虑使用工具。
在调用工具前，请简要说明你的思考过程。`;

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'query_database',
      description: '查询远程数据库以获取用户信息',
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string', description: '要查询的表名' },
          query: { type: 'string', description: '查询条件' },
        },
        required: ['table', 'query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'send_email',
      description: '发送电子邮件',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: '收件人邮箱' },
          subject: { type: 'string', description: '邮件主题' },
          body: { type: 'string', description: '邮件内容' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
];

type ChatMessage = { role: string; content: string };

export async function POST(req: NextRequest) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseUrl = process.env.DASHSCOPE_BASE_URL?.replace(/\/$/, '');
  const model = process.env.DASHSCOPE_MODEL || 'qwen-plus-latest';

  if (!apiKey || !baseUrl) {
    return NextResponse.json(
      { error: '缺少 DASHSCOPE_API_KEY 或 DASHSCOPE_BASE_URL' },
      { status: 500 }
    );
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '无效的 JSON 请求体' }, { status: 400 });
  }

  const raw = body.messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: 'messages 必须为非空数组' }, { status: 400 });
  }

  const messages = raw.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content ?? ''),
  }));

  const openaiMessages = [
    { role: 'system' as const, content: SYSTEM_INSTRUCTION },
    ...messages,
  ];

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: openaiMessages,
      tools: TOOLS,
      tool_choice: 'auto',
    }),
  });

  const rawText = await upstream.text();

  let data: {
    error?: { message?: string; code?: string; type?: string } | string;
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          id?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
    }>;
  };
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    return NextResponse.json(
      { error: rawText?.slice(0, 800) || '上游返回非 JSON' },
      { status: upstream.ok ? 502 : upstream.status }
    );
  }

  if (!upstream.ok) {
    const errObj = typeof data.error === 'object' && data.error !== null ? data.error : null;
    const errMsg =
      errObj?.message ||
      (typeof data.error === 'string' ? data.error : null) ||
      rawText?.slice(0, 800) ||
      upstream.statusText;
    return NextResponse.json({ error: errMsg }, { status: upstream.status });
  }

  if (typeof data.error === 'object' && data.error !== null && data.error.message) {
    return NextResponse.json({ error: data.error.message }, { status: 502 });
  }

  const msg = data.choices?.[0]?.message;
  const text = typeof msg?.content === 'string' ? msg.content : '';

  const functionCalls: { id: string; name: string; args: Record<string, unknown> }[] = [];
  for (const tc of msg?.tool_calls ?? []) {
    const fn = tc.function;
    if (!fn?.name) continue;
    let args: Record<string, unknown> = {};
    if (fn.arguments) {
      try {
        args = JSON.parse(fn.arguments) as Record<string, unknown>;
      } catch {
        args = {};
      }
    }
    functionCalls.push({
      id: tc.id ?? '',
      name: fn.name,
      args,
    });
  }

  return NextResponse.json({ text, functionCalls });
}
