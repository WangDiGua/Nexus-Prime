interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
}

interface SseEventPayload {
  event?: string;
  data: string;
}

interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: object;
}

function parseSseEvent(rawEvent: string): SseEventPayload {
  const lines = rawEvent.split('\n');
  let eventName: string | undefined;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      continue;
    }
    if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  }

  return {
    event: eventName,
    data: dataLines.join('\n'),
  };
}

function normalizeEventStream(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseJsonRpcMessage(raw: string): JsonRpcMessage | null {
  try {
    return JSON.parse(raw) as JsonRpcMessage;
  } catch {
    return null;
  }
}

function parseEventStreamMessages(raw: string): JsonRpcMessage[] {
  const messages: JsonRpcMessage[] = [];
  const normalized = normalizeEventStream(raw);
  const events = normalized.split('\n\n');

  for (const rawEvent of events) {
    const event = parseSseEvent(rawEvent);
    if (!event.data) {
      continue;
    }
    const message = parseJsonRpcMessage(event.data);
    if (message) {
      messages.push(message);
    }
  }

  return messages;
}

class DirectMcpSession {
  private sessionId: string | null = null;

  constructor(private readonly endpointUrl: string) {}

  async initialize(timeoutMs: number): Promise<void> {
    await this.request(
      {
        jsonrpc: '2.0',
        id: 'initialize',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'Nexus-Prime',
            version: '0.1.0',
          },
        },
      },
      timeoutMs,
    );

    await this.post(
      {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      },
      timeoutMs,
    );
  }

  async request<T = unknown>(
    payload: JsonRpcMessage,
    timeoutMs: number,
  ): Promise<T> {
    if (payload.id == null) {
      throw new Error('Direct MCP request requires an id');
    }

    const messages = await this.post(payload, timeoutMs);
    const match = messages.find((message) => message.id === payload.id);

    if (!match) {
      throw new Error('Direct MCP response did not include the expected message');
    }
    if (match.error) {
      throw new Error(match.error.message || 'Direct MCP request failed');
    }

    return match.result as T;
  }

  close(): void {
    // FastMCP HTTP transport is request/response based.
  }

  private async post(
    payload: JsonRpcMessage,
    timeoutMs: number,
  ): Promise<JsonRpcMessage[]> {
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          ...(this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {}),
        },
        cache: 'no-store',
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `Direct MCP HTTP failed (${response.status} ${response.statusText}): ${detail.slice(0, 200)}`,
        );
      }

      const responseSessionId =
        response.headers.get('mcp-session-id') ??
        response.headers.get('Mcp-Session-Id');
      if (responseSessionId) {
        this.sessionId = responseSessionId;
      }

      const body = await response.text();
      if (!body.trim()) {
        return [];
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        return parseEventStreamMessages(body);
      }

      const message = parseJsonRpcMessage(body);
      if (message) {
        return [message];
      }

      throw new Error('Direct MCP HTTP returned an unreadable response body');
    } finally {
      clearTimeout(timer);
    }
  }
}

function normalizeDirectMcpUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = pathname === '' ? '/mcp/' : `${pathname}/`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

function extractStructuredToolResult(result: unknown): unknown {
  if (!result || typeof result !== 'object') {
    return result;
  }

  const row = result as {
    structuredContent?: unknown;
    content?: Array<{ type?: string; text?: string }>;
  };

  if (row.structuredContent != null) {
    return row.structuredContent;
  }

  const firstText = row.content?.find(
    (item) => item?.type === 'text' && typeof item.text === 'string',
  )?.text;
  if (!firstText) {
    return result;
  }

  try {
    return JSON.parse(firstText) as unknown;
  } catch {
    return firstText;
  }
}

async function withDirectMcpSession<T>(
  baseUrl: string,
  timeoutMs: number,
  run: (session: DirectMcpSession) => Promise<T>,
): Promise<T> {
  const session = new DirectMcpSession(normalizeDirectMcpUrl(baseUrl));
  try {
    await session.initialize(timeoutMs);
    return await run(session);
  } finally {
    session.close();
  }
}

export async function fetchDirectMcpTools(
  baseUrl: string,
  timeoutMs: number,
): Promise<McpToolDefinition[]> {
  return withDirectMcpSession(baseUrl, timeoutMs, async (session) => {
    const result = await session.request<{ tools?: McpToolDefinition[] }>(
      {
        jsonrpc: '2.0',
        id: 'tools-list',
        method: 'tools/list',
      },
      timeoutMs,
    );

    return Array.isArray(result?.tools) ? result.tools : [];
  });
}

export async function callDirectMcpTool(
  baseUrl: string,
  timeoutMs: number,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  return withDirectMcpSession(baseUrl, timeoutMs, async (session) => {
    const result = await session.request(
      {
        jsonrpc: '2.0',
        id: 'tools-call',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      },
      timeoutMs,
    );

    return extractStructuredToolResult(result);
  });
}
