import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth/auth-service';
import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const validated = loginSchema.parse(body);

    const result = await authService.login(validated.username, validated.password);

    const response = NextResponse.json({
      success: true,
      user: result.user,
    });

    // 设置认证 cookie
    const cookieSecure = process.env.NODE_ENV === 'production';

    response.cookies.set('auth_token', result.tokens.accessToken, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/',
    });

    response.cookies.set('refresh_token', result.tokens.refreshToken, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 天
      path: '/',
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message || '参数验证失败' },
        { status: 400 }
      );
    }
    
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }

    console.error('[Auth] Login error:', error);
    return NextResponse.json(
      { success: false, error: '登录失败，请稍后重试' },
      { status: 500 }
    );
  }
}
