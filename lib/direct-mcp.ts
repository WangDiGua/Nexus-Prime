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

function resolveUrl(baseUrl: string, value: string): string {
  return new URL(value, baseUrl).toString();
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

class DirectMcpSession {
  private decoder = new TextDecoder();
  private buffer = '';

  constructor(
    private readonly reader: ReadableStreamDefaultReader<Uint8Array>,
    readonly messagesUrl: string,
    private readonly abortController: AbortController,
    initialBuffer = '',
  ) {
    this.buffer = initialBuffer;
  }

  static async connect(
    sseUrl: string,
    timeoutMs: number,
  ): Promise<DirectMcpSession> {
    const abortController = new AbortController();
    const response = await fetch(sseUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
      },
      cache: 'no-store',
      signal: abortController.signal,
    });

    if (!response.ok || !response.body) {
      abortController.abort();
      throw new Error(
        `Failed to open direct MCP SSE (${response.status} ${response.statusText})`,
      );
    }

    const session = new DirectMcpSession(
      response.body.getReader(),
      sseUrl,
      abortController,
    );

    while (true) {
      const event = await session.readEvent(timeoutMs);
      if (event.event === 'endpoint' && event.data) {
        return new DirectMcpSession(
          session.reader,
          resolveUrl(sseUrl, event.data),
          abortController,
          session.buffer,
        );
      }
    }
  }

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

    await this.send({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
  }

  async request<T = unknown>(
    payload: JsonRpcMessage,
    timeoutMs: number,
  ): Promise<T> {
    if (payload.id == null) {
      throw new Error('Direct MCP request requires an id');
    }

    await this.send(payload);

    while (true) {
      const event = await this.readEvent(timeoutMs);
      if (!event.data) {
        continue;
      }

      let message: JsonRpcMessage;
      try {
        message = JSON.parse(event.data) as JsonRpcMessage;
      } catch {
        continue;
      }

      if (message.id !== payload.id) {
        continue;
      }

      if (message.error) {
        throw new Error(message.error.message || 'Direct MCP request failed');
      }

      return message.result as T;
    }
  }

  close(): void {
    this.abortController.abort();
    this.reader.releaseLock();
  }

  private async send(payload: JsonRpcMessage): Promise<void> {
    const response = await fetch(this.messagesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Direct MCP POST failed (${response.status} ${response.statusText}): ${detail.slice(0, 200)}`,
      );
    }
  }

  private async readEvent(timeoutMs: number): Promise<SseEventPayload> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const event = await Promise.race([
      this.readEventInternal(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Direct MCP SSE read timeout'));
        }, timeoutMs);
      }),
    ]);
    if (timer) {
      clearTimeout(timer);
    }

    return event;
  }

  private async readEventInternal(): Promise<SseEventPayload> {
    while (true) {
      const normalizedBuffer = this.buffer
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
      const separatorIndex = normalizedBuffer.indexOf('\n\n');

      if (separatorIndex >= 0) {
        const rawEvent = normalizedBuffer.slice(0, separatorIndex);
        this.buffer = normalizedBuffer.slice(separatorIndex + 2);
        return parseSseEvent(rawEvent);
      }

      const { done, value } = await this.reader.read();
      if (done) {
        if (normalizedBuffer.trim()) {
          this.buffer = '';
          return parseSseEvent(normalizedBuffer);
        }
        throw new Error('Direct MCP SSE stream closed');
      }

      this.buffer =
        normalizedBuffer + this.decoder.decode(value ?? new Uint8Array(), { stream: true });
    }
  }
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
  sseUrl: string,
  timeoutMs: number,
  run: (session: DirectMcpSession) => Promise<T>,
): Promise<T> {
  const session = await DirectMcpSession.connect(sseUrl, timeoutMs);
  try {
    await session.initialize(timeoutMs);
    return await run(session);
  } finally {
    session.close();
  }
}

export async function fetchDirectMcpTools(
  sseUrl: string,
  timeoutMs: number,
): Promise<McpToolDefinition[]> {
  return withDirectMcpSession(sseUrl, timeoutMs, async (session) => {
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
  sseUrl: string,
  timeoutMs: number,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  return withDirectMcpSession(sseUrl, timeoutMs, async (session) => {
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
