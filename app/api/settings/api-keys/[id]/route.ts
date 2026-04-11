import { NextRequest, NextResponse } from 'next/server';
import { settingsService } from '@/lib/services/settings.service';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await settingsService.deleteApiKey(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete API key error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'API Key not found') {
      return NextResponse.json({ error: 'API密钥不存在' }, { status: 404 });
    }
    return NextResponse.json({ error: '删除API密钥失败' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await settingsService.setDefaultApiKey(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Set default API key error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'API Key not found') {
      return NextResponse.json({ error: 'API密钥不存在' }, { status: 404 });
    }
    return NextResponse.json({ error: '设置默认密钥失败' }, { status: 500 });
  }
}
