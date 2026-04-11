# Nexus-Prime 生产级门户改造计划

## 📋 项目概述

将 Nexus-Prime 从 Demo 级别升级为生产级 AI 门户，具备完整的用户系统、数据持久化、向量检索、缓存优化等企业级能力。

---

## ✅ 已完成阶段

### 阶段一：基础设施搭建 ✅ 完成

| 任务 | 状态 |
|------|------|
| Prisma 集成 | ✅ |
| 数据库 Schema | ✅ |
| Redis 集成 | ✅ |
| Milvus 集成 | ✅ |
| Docker Compose | ✅ |
| 环境变量 | ✅ |

### 阶段二：用户认证系统 ✅ 完成

| 任务 | 状态 |
|------|------|
| 密码加密 (bcrypt) | ✅ |
| JWT 认证 | ✅ |
| 认证中间件 | ✅ |
| 注册 API | ✅ |
| 登录 API | ✅ |
| 登出 API | ✅ |
| 登录页面 | ✅ |
| 注册页面 | ✅ |

### 阶段三：会话与消息管理 ⏳ 进行中

| 任务 | 状态 |
|------|------|
| 会话 Service | ✅ |
| 消息 Service | ✅ |
| 会话 API | ⏳ 待完成 |
| 消息 API | ⏳ 待完成 |
| 会话列表 UI | ⏳ 待完成 |
| 会话切换 | ⏳ 待完成 |

---

## 📁 已创建的文件

### 数据库层
- `prisma/schema.prisma` - 完整数据库模型
- `lib/db/prisma.ts` - Prisma 客户端

### 缓存层
- `lib/cache/redis.ts` - Redis 缓存服务

### 向量层
- `lib/vector/milvus.ts` - Milvus 向量服务
- `lib/vector/embedding.ts` - 文本向量化服务

### 认证层
- `lib/auth/auth-service.ts` - 认证服务
- `middleware.ts` - 路由保护中间件

### API 层
- `app/api/auth/register/route.ts` - 注册
- `app/api/auth/login/route.ts` - 登录
- `app/api/auth/logout/route.ts` - 登出
- `app/api/auth/me/route.ts` - 获取当前用户

### 服务层
- `lib/services/conversation.service.ts` - 会话服务
- `lib/services/message.service.ts` - 消息服务

### 前端层
- `app/(auth)/login/page.tsx` - 登录页面
- `app/(auth)/register/page.tsx` - 注册页面
- `app/(auth)/layout.tsx` - 认证布局

### 类型定义
- `types/user.ts` - 用户类型

---

## 🚀 下一步操作

### 1. 启动 Docker 容器

```bash
cd d:\myWebsiteWorks\Nexus-Prime
docker-compose up -d
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```env
# 数据库
DATABASE_URL="mysql://nexus:nexus123@localhost:3306/nexus_prime"

# Redis
REDIS_URL="redis://localhost:6379"

# Milvus
MILVUS_ADDRESS="localhost:19530"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"

# DashScope
DASHSCOPE_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
DASHSCOPE_API_KEY="your-dashscope-api-key"
DASHSCOPE_MODEL="qwen-plus-latest"

# LantuConnect
LANTU_API_BASE_URL="http://localhost:8080/regis"
LANTU_API_KEY="sk_8f2a2d634c1042619dc64067ab5d989b"

# Embedding
EMBEDDING_PROVIDER="dashscope"
EMBEDDING_MODEL="text-embedding-v3"
VECTOR_DIMENSION="1536"
```

### 3. 安装额外依赖

```bash
npm install @alicloud/dashscope-sdk-js
```

### 4. 运行数据库迁移

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. 启动开发服务器

```bash
npm run dev
```

---

## 📊 剩余工作

| 阶段 | 预计时间 |
|------|---------|
| 阶段三：会话消息管理 | 1-2 天 |
| 阶段四：聊天功能重构 | 2 天 |
| 阶段五：向量检索系统 | 2-3 天 |
| 阶段六：缓存系统 | 1-2 天 |
| 阶段七：用户设置系统 | 1 天 |
| 阶段八：优化与完善 | 1-2 天 |

---

## ⚠️ 注意事项

1. **Docker 必须先启动** - MySQL/Redis/Milvus 容器需要先运行
2. **端口冲突** - 确保 3306、6379、19530 端口未被占用
3. **环境变量** - 必须配置正确的 API Key
4. **数据库迁移** - 首次运行需要执行 Prisma 迁移
