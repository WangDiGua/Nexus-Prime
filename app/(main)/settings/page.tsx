'use client';

import { Settings } from 'lucide-react';
import { UserSettingsForm } from '@/components/settings/user-settings-form';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl p-8">
        <div className="mb-8">
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            <Settings className="text-primary" />
            用户设置
          </h1>
          <p className="mt-2 text-muted-foreground">管理您的账户和偏好设置</p>
        </div>

        <UserSettingsForm variant="page" />
      </div>
    </div>
  );
}
