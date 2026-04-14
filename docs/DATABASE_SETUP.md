# 数据库与向量库配置指南

## 1. 启动本地依赖

```bash
docker compose up -d
```

这会启动以下服务：
- MySQL，端口 `3306`
- Redis，端口 `6379`
- Qdrant，端口 `6333`

## 2. 配置环境变量

复制 `.env.example` 到 `.env`，再按实际环境修改：

```bash
cp .env.example .env
```

如果你使用远程 Qdrant，可填写：

```env
QDRANT_URL="http://8.137.15.201:6333"
QDRANT_API_KEY=""
```

## 3. 同步 Prisma 结构

```bash
npx prisma db push
```

或者使用迁移：

```bash
npx prisma migrate dev --name init
```

## 4. Qdrant 向量集合初始化

向量集合会在首次写入或检索时自动创建，一般不需要手工初始化。

如需检查连通性，可以运行：

```bash
node scripts/test-qdrant.ts
```

## 5. 验证服务状态

```bash
# 检查 MySQL
docker exec -it nexus-mysql mysql -u nexus -pnexus123 nexus_prime -e "SHOW TABLES;"

# 检查 Redis
docker exec -it nexus-redis redis-cli ping

# 检查 Qdrant
curl http://localhost:6333/collections
```

## 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| MySQL | 3306 | 主数据库 |
| Redis | 6379 | 缓存服务 |
| Qdrant | 6333 | 向量数据库 |
| Next.js | 3001 | 应用服务 |
