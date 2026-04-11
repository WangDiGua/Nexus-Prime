import { NextRequest, NextResponse } from 'next/server';
import { settingsService } from '@/lib/services/settings.service';

export async function GET() {
  try {
    const settings = await settingsService.getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    return NextResponse.json({ error: '获取设置失败' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const settings = await settingsService.updateSettings(body);
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Update settings error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    return NextResponse.json({ error: '更新设置失败' }, { status: 500 });
  }
}
