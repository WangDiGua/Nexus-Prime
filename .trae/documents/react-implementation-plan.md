# ReAct 模式实现计划

## 目标

在 Nexus-Prime (Next.js 全栈) 中实现完整的 ReAct 循环，通过调用 LantuConnect-Backend 的 API 执行工具调用。

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    Nexus-Prime (Next.js 全栈)                    │
├─────────────────────────────────────────────────────────────────┤
│   前端 UI                                                        │
│   ├── CapabilityHub (能力面板)                                   │
│   ├── NexusChat (对话界面)                                       │
│   └── ObserverPanel (观测面板)                                   │
│                                                                 │
│   后端 API Routes                                                │
│   ├── /api/chat - AI 推理 + ReAct 循环控制                       │
│   ├── /api/tools - 工具列表代理                                  │
│   └── /api/resources - 资源列表代理                              │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                 LantuConnect-Backend (能力平台)                  │
│   GET  /sdk/v1/resources           - 获取资源列表                │
│   GET  /sdk/v1/capabilities/tools  - 获取 MCP 工具聚合          │
│   POST /sdk/v1/invoke              - 执行工具调用                │
└─────────────────────────────────────────────────────────────────┘
```

## 实现步骤

### 第一阶段：后端 API 代理层

#### 1.1 创建环境配置
- 文件：`.env.local`
- 添加 `LANTU_BACKEND_URL` 配置（默认 `http://localhost:8080/regis`）
- 添加 `LANTU_API_KEY` 配置

#### 1.2 创建 LantuConnect 客户端服务
- 文件：`lib/lantu-client.ts`
- 功能：
  - `fetchResources()` - 获取资源列表
  - `fetchTools()` - 获取 MCP 工具聚合
  - `invokeTool()` - 执行工具调用

#### 1.3 创建工具列表 API 代理
- 文件：`app/api/tools/route.ts`
- 代理 `GET /sdk/v1/capabilities/tools`

#### 1.4 创建资源列表 API 代理
- 文件：`app/api/resources/route.ts`
- 代理 `GET /sdk/v1/resources`

### 第二阶段：ReAct 循环核心

#### 2.1 重构 /api/chat 路由
- 文件：`app/api/chat/route.ts`
- 核心改动：
  - 添加 ReAct 循环逻辑
  - 动态获取工具定义（从 LantuConnect-Backend）
  - 工具调用结果返回 AI 继续推理
  - 支持 SSE 流式响应

#### 2.2 定义消息类型
- 文件：`types/chat.ts`
- 类型：
  - `ChatMessage` - 支持 user/assistant/tool 角色
  - `ToolCall` - 工具调用结构
  - `ToolResult` - 工具执行结果

#### 2.3 创建工具执行器
- 文件：`lib/tool-executor.ts`
- 功能：
  - 解析 AI 返回的 tool_calls
  - 调用 LantuConnect-Backend 执行工具
  - 格式化工具结果为 AI 可理解的格式

### 第三阶段：前端适配

#### 3.1 更新 NexusChat 组件
- 文件：`components/layout/NexusChat.tsx`
- 改动：
  - 支持 SSE 流式响应
  - 实时展示 AI 思考过程
  - 展示工具调用状态和结果
  - 支持中断 ReAct 循环

#### 3.2 更新 ChatMessage 组件
- 文件：`components/chat/ChatMessage.tsx`
- 改动：
  - 展示 AI 思考过程
  - 展示工具调用卡片（调用中/成功/失败）
  - 展示工具执行结果

#### 3.3 更新 ToolCard 组件
- 文件：`components/chat/ToolCard.tsx`
- 改动：
  - 支持展示工具调用参数
  - 支持展示执行结果
  - 支持展开/收起详情

### 第四阶段：状态管理

#### 4.1 更新 Zustand Store
- 文件：`hooks/use-registry-store.ts`
- 添加：
  - `toolCalls` - 当前工具调用列表
  - `addToolCall` - 添加工具调用
  - `updateToolCall` - 更新工具调用状态

#### 4.2 更新 Registry Client
- 文件：`lib/registry-client.ts`
- 改动：
  - 移除模拟数据
  - 调用真实后端 API

### 第五阶段：UI 优化

#### 5.1 更新 CapabilityHub
- 文件：`components/layout/CapabilityHub.tsx`
- 改动：
  - 从真实 API 获取资源列表
  - 展示资源状态

#### 5.2 更新 ObserverPanel
- 文件：`components/layout/ObserverPanel.tsx`
- 改动：
  - 展示 ReAct 循环的完整轨迹
  - 展示每轮工具调用的详情

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `.env.local` | 创建 | 环境配置 |
| `lib/lantu-client.ts` | 创建 | LantuConnect 客户端 |
| `lib/tool-executor.ts` | 创建 | 工具执行器 |
| `types/chat.ts` | 创建 | 消息类型定义 |
| `app/api/tools/route.ts` | 创建 | 工具列表 API |
| `app/api/resources/route.ts` | 创建 | 资源列表 API |
| `app/api/chat/route.ts` | 重构 | ReAct 循环核心 |
| `components/layout/NexusChat.tsx` | 重构 | 对话界面 |
| `components/chat/ChatMessage.tsx` | 更新 | 消息展示 |
| `components/chat/ToolCard.tsx` | 更新 | 工具卡片 |
| `hooks/use-registry-store.ts` | 更新 | 状态管理 |
| `lib/registry-client.ts` | 重构 | 真实 API 调用 |
| `components/layout/CapabilityHub.tsx` | 更新 | 能力面板 |
| `components/layout/ObserverPanel.tsx` | 更新 | 观测面板 |

## 依赖关系

```
第一阶段（后端代理层）
    │
    ▼
第二阶段（ReAct 核心）
    │
    ▼
第三阶段（前端适配）
    │
    ▼
第四阶段（状态管理）
    │
    ▼
第五阶段（UI 优化）
```

## 测试计划

1. **单元测试**
   - 工具执行器测试
   - LantuConnect 客户端测试

2. **集成测试**
   - ReAct 循环测试
   - 工具调用链测试

3. **端到端测试**
   - 完整对话流程测试
   - 多轮工具调用测试

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| LantuConnect-Backend 未启动 | 添加健康检查和友好错误提示 |
| 工具调用超时 | 设置合理超时时间，支持重试 |
| AI 无限循环 | 添加可选的最大轮次限制配置 |
| SSE 连接中断 | 添加重连机制 |
