/**
 * 从 MYSQL_* 环境变量拼 Prisma 用的 mysql:// URL，并对 user/password 做 URL 编码，
 * 避免密码中含 @ : # 等破坏连接串解析（与 Redis 拆 REDIS_PASSWORD 同理）。
 */
export function buildMysqlDatabaseUrlFromEnv(): string {
  const host = process.env.MYSQL_HOST ?? 'localhost';
  const port = process.env.MYSQL_PORT ?? '3306';
  const user = process.env.MYSQL_USER ?? 'root';
  const password = process.env.MYSQL_PASSWORD ?? '';
  const database = process.env.MYSQL_DATABASE ?? 'nexus_prime';
  const u = encodeURIComponent(user);
  const p = encodeURIComponent(password);
  return `mysql://${u}:${p}@${host}:${port}/${database}`;
}

/** 若配置了 MYSQL_HOST，则用分字段覆盖 DATABASE_URL，供 PrismaClient 使用 */
export function ensureMysqlDatabaseUrlFromParts(): void {
  if (!process.env.MYSQL_HOST?.trim()) return;
  process.env.DATABASE_URL = buildMysqlDatabaseUrlFromEnv();
}
