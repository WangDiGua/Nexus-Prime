# Tasks

- [x] Task 1: 创建主题上下文
  - [x] SubTask 1.1: 创建 `lib/context/ThemeContext.tsx` 文件
  - [x] SubTask 1.2: 实现 ThemeProvider 组件，支持 LIGHT/DARK/SYSTEM 模式
  - [x] SubTask 1.3: 实现 useTheme hook，提供主题状态和切换方法

- [x] Task 2: 集成主题提供者
  - [x] SubTask 2.1: 修改 `components/Providers.tsx` 包含 ThemeProvider
  - [x] SubTask 2.2: 修改 `app/layout.tsx` 使用动态主题类名

- [x] Task 3: 实现主题切换逻辑
  - [x] SubTask 3.1: 修改设置页面，主题切换时同步更新上下文
  - [x] SubTask 3.2: 实现主题持久化到数据库

- [x] Task 4: 验证主题功能
  - [x] SubTask 4.1: 测试亮色主题切换
  - [x] SubTask 4.2: 测试暗色主题切换
  - [x] SubTask 4.3: 测试跟随系统模式
  - [x] SubTask 4.4: 测试主题持久化

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 3]
