# MCP 工具参数清理 Spec

## Why
LLM 在生成工具调用参数时，有时会在字符串值中添加 Markdown 格式符号（如反引号包裹 URL），导致 MCP 服务端参数校验失败返回 "Invalid request parameters"。

## What Changes
- 在 `tool-executor.ts` 中添加参数清理逻辑，递归去除字符串值中的 Markdown 格式符号
- 更新系统提示词，明确告知 LLM 不要在参数中使用 Markdown 格式

## Impact
- Affected specs: 无
- Affected code: `lib/tool-executor.ts`, `app/api/chat/route.ts`

## ADDED Requirements

### Requirement: 参数清理
系统 SHALL 在调用 MCP 工具前，自动清理参数中的 Markdown 格式符号。

#### Scenario: URL 参数清理
- **WHEN** LLM 生成参数 `{"url": "\`https://example.com\`"}`
- **THEN** 系统自动清理为 `{"url": "https://example.com"}`

#### Scenario: 递归清理
- **WHEN** 参数包含嵌套对象或数组
- **THEN** 系统递归清理所有字符串值

### Requirement: 系统提示词优化
系统 SHALL 在系统提示词中明确告知 LLM 参数格式要求。

#### Scenario: 提示词包含格式说明
- **WHEN** 系统初始化
- **THEN** 系统提示词包含 "参数值不要使用 Markdown 格式（如反引号）"
