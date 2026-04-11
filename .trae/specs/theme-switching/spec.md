# 主题切换功能规范

## Why
系统当前硬编码为暗色主题，用户无法在亮色、暗色和跟随系统之间切换，影响用户体验。

## What Changes
- 创建主题上下文 (ThemeContext) 和主题提供者 (ThemeProvider)
- 实现亮色/暗色/跟随系统三种主题模式
- 修改 layout.tsx 使用动态主题类名
- 在设置页面保存主题时实时切换

## Impact
- Affected code: `components/Providers.tsx`, `app/layout.tsx`, `app/(main)/settings/page.tsx`
- Affected specs: 用户设置系统

## ADDED Requirements

### Requirement: 主题上下文
系统 SHALL 提供主题上下文，支持 LIGHT、DARK、SYSTEM 三种模式。

#### Scenario: 主题切换
- **WHEN** 用户选择主题模式
- **THEN** 系统立即应用对应主题

#### Scenario: 跟随系统
- **WHEN** 用户选择 SYSTEM 模式
- **THEN** 系统根据操作系统偏好自动切换亮暗主题

### Requirement: 主题持久化
系统 SHALL 将用户主题偏好保存到数据库，并在下次访问时恢复。

#### Scenario: 主题恢复
- **WHEN** 用户重新登录系统
- **THEN** 系统自动应用用户上次选择的主题

### Requirement: 默认主题
系统 SHALL 默认使用 SYSTEM 主题模式。

#### Scenario: 新用户
- **WHEN** 新用户首次访问系统
- **THEN** 系统使用跟随系统主题

## 技术方案

### 方案概述
1. 创建 `lib/context/ThemeContext.tsx` 提供主题状态管理
2. 修改 `components/Providers.tsx` 包含 ThemeProvider
3. 修改 `app/layout.tsx` 使用动态主题类名
4. 修改设置页面，保存主题时同步更新上下文

### CSS 变量
系统已在 `globals.css` 中定义了完整的亮暗主题 CSS 变量，无需修改。
