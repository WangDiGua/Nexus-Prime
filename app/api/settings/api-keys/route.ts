import { NextRequest, NextResponse } from 'next/server';
import { settingsService } from '@/lib/services/settings.service';

export async function GET() {
  try {
    const keys = await settingsService.getApiKeys();
    return NextResponse.json({ keys });
  } catch (error) {
    console.error('Get API keys error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    return NextResponse.json({ error: '获取API密钥失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, key, provider } = body;

    if (!name || !key) {
      return NextResponse.json({ error: '名称和密钥不能为空' }, { status: 400 });
    }

    const apiKey = await settingsService.createApiKey({ name, key, provider });
    return NextResponse.json(apiKey, { status: 201 });
  } catch (error) {
    console.error('Create API key error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    return NextResponse.json({ error: '创建API密钥失败' }, { status: 500 });
  }
}
