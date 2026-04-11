export type SkillType = '远程' | '本地';

export interface Skill {
  id: string;
  name: string;
  type: SkillType;
  icon: string;
  endpoint: string;
  description: string;
}

export interface McpServer {
  id: string;
  name: string;
  status: '已连接' | '断开' | '连接中';
  icon: string;
}

export interface Packet {
  id: string;
  type: '技能' | 'MCP' | '工具';
  method: string;
  endpoint: string;
  status: number;
  time: string;
  payload?: any;
  response?: any;
  stackTrace?: string;
}

export interface AgentConfig {
  name: string;
  version: string;
  model: string;
}

export interface Resource {
  id: string;
  name: string;
  type: 'agent' | 'skill' | 'mcp' | 'app' | 'dataset';
  status: 'draft' | 'testing' | 'published' | 'deprecated';
  description?: string;
  endpoint?: string;
  icon?: string;
  tags?: string[];
  ownerName?: string;
}
