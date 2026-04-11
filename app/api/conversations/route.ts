import { NextRequest, NextResponse } from 'next/server';
import { conversationService } from '@/lib/services/conversation.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');

    if (search) {
      const conversations = await conversationService.search(search, limit);
      return NextResponse.json({ conversations, total: conversations.length });
    }

    const result = await conversationService.findByUserId({ limit, offset });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Get conversations error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    return NextResponse.json({ error: '获取会话列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, summary, metadata } = body;

    const conversation = await conversationService.create({
      title,
      summary,
      metadata,
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('Create conversation error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    return NextResponse.json({ error: '创建会话失败' }, { status: 500 });
  }
}
