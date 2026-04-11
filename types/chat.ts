export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  status: 'success' | 'error';
  error?: string;
  latency?: number;
  cached?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolResults?: ToolResult[];
}

export interface ReActState {
  phase: 'thinking' | 'tool_calling' | 'tool_executing' | 'responding' | 'complete' | 'error';
  currentToolCall?: ToolCall;
  toolResults: ToolResult[];
  iteration: number;
  reasoning?: string;
}

export interface SSEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'content' | 'error' | 'done';
  data: unknown;
}

export interface ThinkingEvent {
  type: 'thinking';
  content: string;
}

export interface ToolCallEvent {
  type: 'tool_call';
  toolCall: ToolCall;
}

export interface ToolResultEvent {
  type: 'tool_result';
  result: ToolResult;
}

export interface ContentEvent {
  type: 'content';
  content: string;
}

export interface ErrorEvent {
  type: 'error';
  error: string;
}

export interface DoneEvent {
  type: 'done';
}

export type ChatSSEEvent = ThinkingEvent | ToolCallEvent | ToolResultEvent | ContentEvent | ErrorEvent | DoneEvent;
