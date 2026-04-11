import { NextRequest, NextResponse } from 'next/server';
import { conversationService } from '@/lib/services/conversation.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const includeMessages = searchParams.get('messages') === 'true';

    const conversation = await conversationService.findById(id, includeMessages);

    if (!conversation) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Get conversation error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    return NextResponse.json({ error: '获取会话失败' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, summary, metadata } = body;

    const conversation = await conversationService.update(id, {
      title,
      summary,
      metadata,
    });

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Update conversation error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Conversation not found') {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }
    return NextResponse.json({ error: '更新会话失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await conversationService.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Conversation not found') {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }
    return NextResponse.json({ error: '删除会话失败' }, { status: 500 });
  }
}
