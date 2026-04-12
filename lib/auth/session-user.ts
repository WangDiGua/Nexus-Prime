import type { User } from '@/types/user';

/** 登录/注册接口 JSON 中的 user 片段（与 Prisma 返回字段一致） */
export type AuthSessionUserPayload = {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  role: string;
};

/**
 * 将登录/注册响应中的 user 转为前端 User（缺省字段用占位，随后 refresh 会拉全量）。
 */
export function sessionPayloadToUser(p: AuthSessionUserPayload): User {
  return {
    id: p.id,
    username: p.username,
    email: p.email,
    displayName: p.displayName,
    avatarUrl: null,
    role: p.role === 'ADMIN' ? 'ADMIN' : 'USER',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  };
}
