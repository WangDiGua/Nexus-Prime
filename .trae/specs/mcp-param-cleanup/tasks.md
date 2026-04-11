# Tasks

- [x] Task 1: 添加参数清理函数
  - [x] 创建 `cleanMarkdownFormatting` 函数，递归清理字符串中的 Markdown 格式符号
  - [x] 支持清理反引号、前后空格、换行符等

- [x] Task 2: 在 ToolExecutor.execute 中应用参数清理
  - [x] 在构造 payload 前对 toolCall.args 进行清理
  - [x] 添加日志记录清理前后的参数对比

- [x] Task 3: 更新系统提示词
  - [x] 在 SYSTEM_INSTRUCTION 中添加参数格式要求说明

# Task Dependencies
- Task 2 依赖 Task 1 ✅
- Task 3 独立 ✅
