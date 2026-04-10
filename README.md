# Nexus-Prime

基于 **Next.js 15** 与 **React 19** 的智能 Agent 交互前端：左侧能力/registry面板、中间对话、右侧观测与上下文。对话默认通过服务端调用 **阿里云百炼 DashScope**的 **OpenAI 兼容接口**（`/compatible-mode/v1`），API Key 仅保存在服务端环境变量中，不会暴露给浏览器。

## 功能概览

- **Nexus Chat**：多轮对话、工具调用（示例：`query_database`、`send_email`），工具执行仍在前端通过 `registryClient` 演示远程调用。
- **Capability Hub / Observer Panel**：能力与 MCP 注册、请求包与时间线等 UI（Zustand 状态）。
- **API**：`POST /api/chat` 转发至 DashScope `chat/completions`。

## 环境要求

- Node.js20+（建议与 Next 15 一致）
- npm 或兼容包管理器

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制示例文件并按说明填写（**勿将真实密钥提交到 Git**）：

```bash
cp .env.example .env.local
```

| 变量 | 说明 |
|------|------|
| `DASHSCOPE_BASE_URL` | 兼容模式根路径，例如北京：`https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `DASHSCOPE_API_KEY` | 百炼 / DashScope API Key（`sk-` 开头） |
| `DASHSCOPE_MODEL` | 模型名，如 `qwen-plus-latest`、`qwen-turbo-latest`（以控制台开通为准） |
| `APP_URL` | 部署后的站点根 URL（自引用链接、回调等场景可选用） |

地域与 Base URL 需与 API Key 所属区域一致，详见[阿里云百炼 OpenAI 兼容说明](https://help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-openai-with-dashscope)。

### 3. 本地开发

默认开发端口为 **3001**（在 `package.json` 的 `dev` 脚本中配置）。

```bash
npm run dev
```

浏览器访问：<http://localhost:3001>

### 4. 生产构建

```bash
npm run build
npm start
```

生产环境同样需在运行环境中注入上述 `DASHSCOPE_*` 变量（`.env.local` 不会进入构建产物或镜像，需在主机/平台配置）。

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器（端口 3001） |
| `npm run build` | 生产构建 |
| `npm run start` | 生产启动（端口 3001） |
| `npm run lint` | ESLint |
| `npm run clean` | 清理 Next 缓存 |

## 项目结构（摘要）

```text
app/
  api/chat/route.ts    # DashScope 代理与工具定义
  page.tsx             # 三栏布局入口
components/layout/     # NexusChat、CapabilityHub、ObserverPanel 等
hooks/                 # Zustand 等
lib/                   # 工具与 registry 客户端
types/                 # TypeScript 类型
```

## 技术栈

- Next.js 15、React 19、TypeScript
- Tailwind CSS 4、shadcn/ui（Radix / Base UI）
- Zustand、TanStack Query、ky 等

## 许可证

私有项目或未声明许可证时，以仓库所有者约定为准。

## 相关链接

- [阿里云大模型服务平台百炼](https://help.aliyun.com/zh/model-studio/)
