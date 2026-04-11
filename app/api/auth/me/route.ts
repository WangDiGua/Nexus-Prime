import { NextResponse } from 'next/server';
import { authService } from '@/lib/auth/auth-service';
import { getAuthUser } from '@/lib/auth/auth-service';

export async function GET() {
  try {
    const user = await getAuthUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, user: null },
        { status: 401 }
      );
    }

    const fullUser = await authService.getCurrentUser(user.userId);
    
    return NextResponse.json({
      success: true,
      user: fullUser,
    });
  } catch (error) {
    console.error('[Auth] Get current user error:', error);
    return NextResponse.json(
      { success: false, user: null },
      { status: 500 }
    );
  }
}
