# 数据库设置指南

## 1. 启动 Docker 服务

```bash
docker-compose up -d
```

这将启动以下服务：
- MySQL (端口 3306)
- Redis (端口 6379)
- Milvus (端口 19530)
- Attu - Milvus 管理界面 (端口 3002)

## 2. 配置环境变量

复制 `.env.example` 到 `.env` 并填入实际值：

```bash
cp .env.example .env
```

## 3. 同步数据库结构

```bash
npx prisma db push
```

或者使用迁移：

```bash
npx prisma migrate dev --name init
```

## 4. 初始化 Milvus 向量集合

向量集合会在首次使用时自动创建。如果需要手动创建：

```bash
npx ts-node scripts/init-milvus.ts
```

## 5. 验证服务状态

```bash
# 检查 MySQL
docker exec -it nexus-mysql mysql -u nexus -p nexus_prime -e "SHOW TABLES;"

# 检查 Redis
docker exec -it nexus-redis redis-cli ping

# 检查 Milvus
curl http://localhost:19530/v1/vector/collections
```

## 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| MySQL | 3306 | 主数据库 |
| Redis | 6379 | 缓存服务 |
| Milvus | 19530 | 向量数据库 |
| Attu | 3002 | Milvus 管理界面 |
| Next.js | 3001 | 应用服务 |
