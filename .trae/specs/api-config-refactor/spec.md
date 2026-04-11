# API 配置化改造 Spec

## Why

当前 Nexus-Prime 项目中有多处硬编码的配置，包括 API 端点路径、请求格式、认证方式等。需要将这些配置提取为可配置项，以便于部署到不同环境。

## What Changes

- 将后端 API 基础路径配置化
- 将 API Key 认证头名称配置化
- 将请求/响应字段名配置化
- 将工具调用相关参数配置化
- 创建统一的配置类型定义

## Impact

- Affected code: `lib/lantu-client.ts`, `lib/tool-executor.ts`, `app/api/chat/route.ts`
- Affected config: `.env.example`, `.env.local`

## ADDED Requirements

### Requirement: API 配置集中管理

系统应当提供统一的 API 配置管理，所有与后端交互相关的配置都应从环境变量读取。

#### Scenario: 配置读取
- **WHEN** 应用启动时
- **THEN** 从环境变量读取所有 API 相关配置
- **AND** 提供合理的默认值

### Requirement: 后端 API 端点配置化

以下端点路径应当可配置：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `LANTU_API_BASE_URL` | `http://localhost:8080/regis` | 后端 API 基础路径 |
| `LANTU_API_KEY_HEADER` | `X-Api-Key` | API Key 请求头名称 |
| `LANTU_API_TRACE_HEADER` | `X-Trace-Id` | 链路追踪请求头名称 |

### Requirement: SDK 网关端点路径配置化

以下 SDK 网关路径应当可配置：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `LANTU_SDK_RESOURCES_PATH` | `/sdk/v1/resources` | 资源目录端点 |
| `LANTU_SDK_TOOLS_PATH` | `/sdk/v1/capabilities/tools` | 工具聚合端点 |
| `LANTU_SDK_INVOKE_PATH` | `/sdk/v1/invoke` | 统一调用端点 |
| `LANTU_SDK_INVOKE_STREAM_PATH` | `/sdk/v1/invoke-stream` | 流式调用端点 |
| `LANTU_SDK_RESOLVE_PATH` | `/sdk/v1/resolve` | 资源解析端点 |

### Requirement: InvokeRequest 字段名配置化

根据后端 `InvokeRequest.java`，请求体字段名应当可配置：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `LANTU_FIELD_RESOURCE_TYPE` | `resourceType` | 资源类型字段名 |
| `LANTU_FIELD_RESOURCE_ID` | `resourceId` | 资源ID字段名 |
| `LANTU_FIELD_VERSION` | `version` | 版本字段名 |
| `LANTU_FIELD_TIMEOUT_SEC` | `timeoutSec` | 超时字段名 |
| `LANTU_FIELD_PAYLOAD` | `payload` | 载荷字段名 |

### Requirement: InvokeResponse 字段名配置化

根据后端 `InvokeResponse.java`，响应体字段名应当可配置：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `LANTU_FIELD_REQUEST_ID` | `requestId` | 请求ID字段名 |
| `LANTU_FIELD_TRACE_ID` | `traceId` | 追踪ID字段名 |
| `LANTU_FIELD_STATUS_CODE` | `statusCode` | 状态码字段名 |
| `LANTU_FIELD_STATUS` | `status` | 状态字段名 |
| `LANTU_FIELD_LATENCY_MS` | `latencyMs` | 延迟字段名 |
| `LANTU_FIELD_BODY` | `body` | 响应体字段名 |

### Requirement: AggregatedTools 字段名配置化

根据后端 `AggregatedCapabilityToolsVO.java`，工具聚合响应字段名应当可配置：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `LANTU_FIELD_ENTRY` | `entry` | 入口信息字段名 |
| `LANTU_FIELD_OPENAI_TOOLS` | `openAiTools` | OpenAI工具列表字段名 |
| `LANTU_FIELD_ROUTES` | `routes` | 路由表字段名 |
| `LANTU_FIELD_WARNINGS` | `warnings` | 警告列表字段名 |

### Requirement: ToolDispatchRoute 字段名配置化

根据后端 `ToolDispatchRouteVO.java`，路由字段名应当可配置：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `LANTU_FIELD_FUNCTION_NAME` | `unifiedFunctionName` | 统一函数名字段名 |
| `LANTU_FIELD_UPSTREAM_NAME` | `upstreamToolName` | 上游工具名字段名 |

### Requirement: 超时配置化

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `LANTU_API_TIMEOUT_MS` | `30000` | API 请求超时（毫秒） |
| `LANTU_INVOKE_DEFAULT_TIMEOUT_SEC` | `30` | 工具调用默认超时（秒） |
| `LANTU_REACT_MAX_ITERATIONS` | `20` | ReAct 最大迭代次数 |

### Requirement: 分页参数配置化

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `LANTU_FIELD_PAGE` | `page` | 页码字段名 |
| `LANTU_FIELD_PAGE_SIZE` | `pageSize` | 每页数量字段名 |
| `LANTU_FIELD_ITEMS` | `items` | 列表项字段名 |
| `LANTU_FIELD_TOTAL` | `total` | 总数字段名 |

## MODIFIED Requirements

### Requirement: LantuClient 配置化

修改前的 `LantuClient` 硬编码了端点路径和字段名。

修改后的 `LantuClient` 应从配置对象读取所有路径和字段名。

### Requirement: ToolExecutor 配置化

修改前的 `ToolExecutor` 硬编码了请求/响应字段名。

修改后的 `ToolExecutor` 应从配置对象读取字段名。

## REMOVED Requirements

无
