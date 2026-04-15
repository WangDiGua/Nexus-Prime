import { NextRequest, NextResponse } from 'next/server';
import { authService, getAuthUser } from '@/lib/auth/auth-service';
import { settingsService } from '@/lib/services/settings.service';
import { conversationService } from '@/lib/services/conversation.service';
import { messageService } from '@/lib/services/message.service';
import { systemSettingsService } from '@/lib/services/system-settings.service';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    const conversationId = request.nextUrl.searchParams.get('conversationId')?.trim() || null;
    const systemConfig = await systemSettingsService.getPublicChatSettings();

    if (!authUser) {
      return NextResponse.json({
        user: null,
        settings: null,
        conversations: [],
        activeConversation: null,
        messages: [],
        systemConfig,
      });
    }

    const [user, settings, conversationList] = await Promise.all([
      authService.getCurrentUser(authUser.userId),
      settingsService.getSettings(),
      conversationService.findByUserId(),
    ]);

    let activeConversation = null;
    let messages: Awaited<ReturnType<typeof messageService.findByConversationId>> = [];

    if (conversationId) {
      activeConversation = await conversationService.findById(conversationId, false);
      if (activeConversation) {
        messages = await messageService.findByConversationId(conversationId);
      }
    }

    return NextResponse.json({
      user,
      settings,
      conversations: conversationList.conversations,
      activeConversation,
      messages,
      systemConfig,
    });
  } catch (error) {
    console.error('[ChatBootstrap] failed:', error);
    return NextResponse.json(
      {
        error: 'Bootstrap failed',
        user: null,
        settings: null,
        conversations: [],
        activeConversation: null,
        messages: [],
        systemConfig: {
          askDataSkillId: '',
          askDataDirectEnabled: false,
          askDataButtonLabel: '智能问数',
        },
      },
      { status: 500 },
    );
  }
}
