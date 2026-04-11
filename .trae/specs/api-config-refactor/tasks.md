# Tasks

- [x] Task 1: 创建 API 配置类型定义
  - [x] SubTask 1.1: 创建 `lib/api-config.ts` 文件
  - [x] SubTask 1.2: 定义 `ApiConfig` 接口，包含所有可配置项
  - [x] SubTask 1.3: 创建 `createApiConfig()` 函数从环境变量读取配置
  - [x] SubTask 1.4: 导出默认配置实例

- [x] Task 2: 重构 LantuClient 使用配置
  - [x] SubTask 2.1: 修改 `LantuClient` 构造函数接受 `ApiConfig`
  - [x] SubTask 2.2: 替换硬编码的端点路径为配置项
  - [x] SubTask 2.3: 替换硬编码的字段名为配置项
  - [x] SubTask 2.4: 更新 `fetchResources`、`fetchAggregatedTools`、`invoke` 方法

- [x] Task 3: 重构 ToolExecutor 使用配置
  - [x] SubTask 3.1: 修改 `ToolExecutor` 构造函数接受 `ApiConfig`
  - [x] SubTask 3.2: 替换硬编码的请求字段名为配置项
  - [x] SubTask 3.3: 替换硬编码的响应字段名为配置项

- [x] Task 4: 更新环境变量配置
  - [x] SubTask 4.1: 更新 `.env.example` 添加所有新配置项
  - [x] SubTask 4.2: 添加配置项注释说明

- [x] Task 5: 更新 API Routes 使用配置
  - [x] SubTask 5.1: 修改 `app/api/chat/route.ts` 使用配置化的超时和迭代次数
  - [x] SubTask 5.2: 修改 `app/api/tools/route.ts` 使用配置化的端点路径
  - [x] SubTask 5.3: 修改 `app/api/resources/route.ts` 使用配置化的端点路径

# Task Dependencies

- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 5 depends on Task 1, Task 2, Task 3
