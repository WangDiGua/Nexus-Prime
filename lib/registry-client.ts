import ky from 'ky';
import { Skill, McpServer } from '@/types/registry';

class RegistryClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'https://api.lantu.com/v1') {
    this.baseUrl = baseUrl;
  }

  async fetchCapabilities(): Promise<{ mcpServers: McpServer[], skills: Skill[] }> {
    // 模拟 API 调用
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      mcpServers: [
        { id: 'mcp-1', name: '文件服务器-MCP', status: '已连接', icon: 'FileText' },
        { id: 'mcp-2', name: '数据库-MCP', status: '已连接', icon: 'Database' },
      ],
      skills: [
        { id: 'skill-1', name: '发送邮件', type: '远程', icon: 'Mail', endpoint: `${this.baseUrl}/email`, description: '通过 SMTP 发送系统通知或用户邮件' },
        { id: 'skill-2', name: '生成图表', type: '远程', icon: 'BarChart3', endpoint: `${this.baseUrl}/charts`, description: '将结构化数据转换为可视化图表' },
        { id: 'skill-3', name: '网页搜索', type: '远程', icon: 'Globe', endpoint: `${this.baseUrl}/search`, description: '实时检索互联网公开信息' },
      ]
    };
  }

  async remoteInvoke(skill: Skill, payload: any): Promise<any> {
    const startTime = Date.now();
    try {
      // 模拟远程调用
      await new Promise(resolve => setTimeout(resolve, 1200));
      return {
        status: 'success',
        data: { message: `已成功调用 ${skill.name}` },
        latency: `${Date.now() - startTime}ms`
      };
    } catch (error) {
      throw new Error(`Failed to invoke skill ${skill.name}`);
    }
  }
}

export const registryClient = new RegistryClient();
