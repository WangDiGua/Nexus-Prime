import { create } from 'zustand';
import { Packet, McpServer, AgentConfig } from '@/types/registry';

interface RegistryState {
  packets: Packet[];
  mcpServers: McpServer[];
  config: AgentConfig;
  contextTokens: number;
  contextContent: any;
  
  addPacket: (packet: Packet) => void;
  clearPackets: () => void;
  setMcpServers: (servers: McpServer[]) => void;
  updateConfig: (config: Partial<AgentConfig>) => void;
  updateContext: (tokens: number, content: any) => void;
}

export const useRegistryStore = create<RegistryState>((set) => ({
  packets: [],
  mcpServers: [],
  config: {
    name: 'Nexus-Prime',
    version: 'v2.1.0',
    model: 'qwen-plus-latest'
  },
  contextTokens: 1240,
  contextContent: {
    file: "README.md",
    content: "Nexus-Prime v2.0...",
    mcp_source: "文件服务器-MCP"
  },

  addPacket: (packet) => set((state) => ({ 
    packets: [packet, ...state.packets].slice(0, 50) 
  })),
  
  clearPackets: () => set({ packets: [] }),
  
  setMcpServers: (mcpServers) => set({ mcpServers }),
  
  updateConfig: (config) => set((state) => ({ 
    config: { ...state.config, ...config } 
  })),
  
  updateContext: (tokens, content) => set({ 
    contextTokens: tokens, 
    contextContent: content 
  }),
}));
