# 系统 Bug 修复规范

## Why
系统存在多个 TypeScript 编译错误，影响代码质量和开发体验。需要修复这些错误以确保系统稳定性。

## What Changes
- 修复 `lib/lantu-client.ts` 模块导入问题
- 修复 `Prisma.InputJsonValue` 类型错误
- 清理未使用的变量声明

## Impact
- Affected code: `lib/lantu-client.ts`, `lib/services/conversation.service.ts`, `lib/tool-executor.ts`, `app/api/chat/route.ts`

## ADDED Requirements

### Requirement: TypeScript 编译无错误
系统 SHALL 通过 TypeScript 编译，不产生任何 Error 级别的诊断信息。

#### Scenario: 编译检查
- **WHEN** 运行 TypeScript 编译检查
- **THEN** 所有文件无编译错误

### Requirement: Prisma 类型正确使用
系统 SHALL 正确使用 Prisma 提供的类型定义。

#### Scenario: JSON 类型处理
- **WHEN** 使用 Prisma 的 JSON 类型
- **THEN** 使用正确的类型导入和转换方式

## 已发现的问题

### 问题 1: `lib/lantu-client.ts` 不是模块
- **文件**: `app/api/chat/route.ts`, `app/api/tools/route.ts`, `app/api/resources/route.ts`, `lib/tool-executor.ts`
- **错误**: 文件"d:/myWebsiteWorks/Nexus-Prime/lib/lantu-client.ts"不是模块
- **原因**: 可能是循环依赖或模块导出问题

### 问题 2: `Prisma.InputJsonValue` 不存在
- **文件**: `lib/services/conversation.service.ts`
- **错误**: 命名空间"Prisma"没有已导出的成员"InputJsonValue"
- **原因**: Prisma 类型导入路径问题

### 问题 3: 未使用的变量
- **文件**: `app/api/chat/route.ts` - `conversationService` 未使用
- **文件**: `lib/tool-executor.ts` - `config`, `tool` 未使用
- **影响**: 代码质量警告

## 修复方案

### 方案 1: 修复 lantu-client.ts 模块问题
检查并确保 `lib/lantu-client.ts` 正确导出所有需要的成员。

### 方案 2: 修复 Prisma 类型
使用 `@prisma/client` 直接导入 `Prisma` 命名空间，或使用类型断言替代。

### 方案 3: 清理未使用变量
移除或使用这些变量。
