import { NextRequest, NextResponse } from 'next/server';
import { messageService } from '@/lib/services/message.service';
import { conversationService } from '@/lib/services/conversation.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const messages = await messageService.findByConversationId(conversationId, {
      limit,
      offset,
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    return NextResponse.json({ error: '获取消息失败' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const body = await request.json();
    const {
      role,
      content,
      toolCalls,
      toolResults,
      thinkingLog,
      thinkingStepDurationsMs,
      tokensUsed,
      latencyMs,
      model,
    } = body;

    const conversation = await conversationService.findById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    const message = await messageService.create({
      conversationId,
      role,
      content,
      toolCalls,
      toolResults,
      thinkingLog,
      thinkingStepDurationsMs,
      tokensUsed,
      latencyMs,
      model,
    });

    try {
      await conversationService.updateMessageCount(conversationId);
    } catch (e) {
      console.error('updateMessageCount after create:', e);
    }

    if (role === 'USER' && !conversation.title) {
      try {
        await conversationService.generateTitle(conversationId, content);
      } catch (e) {
        console.error('generateTitle after create:', e);
      }
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Create message error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const detail =
      process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.message
        : undefined;
    return NextResponse.json(
      { error: '创建消息失败', ...(detail ? { detail } : {}) },
      { status: 500 }
    );
  }
}
