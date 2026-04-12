'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Brain,
  Key,
  Plus,
  Trash2,
  Star,
  Database,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModelSelect } from '@/components/ui/model-select';
import { useTheme } from '@/lib/context/ThemeContext';
import { toast } from '@/lib/toast';
import {
  buildChatModelOptions,
  normalizeChatModelId,
} from '@/lib/chat-model-options';

interface UserSettings {
  defaultModel: string;
  systemPrompt?: string;
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  language: string;
  maxTokens: number;
  temperature: number;
  enableHistoryContext: boolean;
  historyContextLimit: number;
  enableVectorSearch: boolean;
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  provider: string;
  isDefault: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

type SettingsTab = 'general' | 'model' | 'api-keys';

export type UserSettingsFormVariant = 'page' | 'popover';

interface UserSettingsFormProps {
  variant?: UserSettingsFormVariant;
}

export function UserSettingsForm({ variant = 'page' }: UserSettingsFormProps) {
  const { theme: currentTheme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showAddKey, setShowAddKey] = useState(false);

  const isPopover = variant === 'popover';

  const modelSelectOptions = useMemo(
    () => buildChatModelOptions(settings?.defaultModel),
    [settings?.defaultModel]
  );

  const resolvedDefaultModel = useMemo(() => {
    const raw = settings?.defaultModel;
    return normalizeChatModelId(raw) ?? raw ?? 'qwen-plus-latest';
  }, [settings?.defaultModel]);

  useEffect(() => {
    fetchSettings();
    fetchApiKeys();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        toast.error('无法加载设置');
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('无法加载设置');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/settings/api-keys');
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.keys || []);
      } else {
        toast.error('无法加载 API 密钥列表');
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
      toast.error('无法加载 API 密钥列表');
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      const canonicalModel =
        normalizeChatModelId(settings.defaultModel) ?? settings.defaultModel;
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, defaultModel: canonicalModel }),
      });

      if (response.ok) {
        setSettings((s) =>
          s ? { ...s, defaultModel: canonicalModel } : s
        );
        setSaveMessage('设置已保存');
        setTimeout(() => setSaveMessage(''), 3000);
        toast.success('设置已保存');
      } else {
        const err = await response.json().catch(() => ({} as { error?: string }));
        toast.error(err.error || '保存失败');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('保存失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddApiKey = async () => {
    if (!newKeyName || !newKeyValue) return;

    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName, key: newKeyValue }),
      });

      if (response.ok) {
        await fetchApiKeys();
        setNewKeyName('');
        setNewKeyValue('');
        setShowAddKey(false);
        toast.success('密钥已添加');
      } else {
        const err = await response.json().catch(() => ({} as { error?: string }));
        toast.error(err.error || '添加失败');
      }
    } catch (error) {
      console.error('Failed to add API key:', error);
      toast.error('添加密钥失败');
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    try {
      const response = await fetch(`/api/settings/api-keys/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchApiKeys();
        toast.success('密钥已删除');
      } else {
        const err = await response.json().catch(() => ({} as { error?: string }));
        toast.error(err.error || '删除失败');
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
      toast.error('删除失败');
    }
  };

  const handleSetDefaultKey = async (id: string) => {
    try {
      const response = await fetch(`/api/settings/api-keys/${id}`, {
        method: 'PATCH',
      });

      if (response.ok) {
        await fetchApiKeys();
        toast.success('已设为默认密钥');
      } else {
        const err = await response.json().catch(() => ({} as { error?: string }));
        toast.error(err.error || '操作失败');
      }
    } catch (error) {
      console.error('Failed to set default key:', error);
      toast.error('设置默认密钥失败');
    }
  };

  const tabs = [
    { id: 'general' as const, label: '常规', icon: Settings },
    { id: 'model' as const, label: '模型', icon: Brain },
    { id: 'api-keys' as const, label: 'API密钥', icon: Key },
  ];

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center py-12',
          isPopover && 'min-h-[200px]'
        )}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const cardClass = isPopover
    ? 'rounded-xl border border-gpt-border bg-gpt-main p-4 space-y-4'
    : 'ios-card p-6 space-y-6';

  if (!settings) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        无法加载设置，请稍后重试
      </div>
    );
  }

  return (
    <div
      className={cn(
        isPopover
          ? 'flex h-full min-h-0 flex-1 flex-col'
          : 'flex gap-6'
      )}
    >
      <div
        className={cn(
          isPopover
            ? 'flex shrink-0 flex-wrap gap-2 border-b border-gpt-border pb-3'
            : 'w-48 shrink-0 space-y-1'
        )}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-xl text-sm font-medium transition-all',
              isPopover
                ? 'flex-1 justify-center px-3 py-2 sm:flex-none'
                : 'w-full gap-3 px-4 py-3',
              activeTab === tab.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]'
            )}
          >
            <tab.icon size={isPopover ? 16 : 18} />
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className={cn(
          'min-w-0 flex-1',
          isPopover && 'min-h-0 overflow-y-auto overscroll-contain pr-1 scrollbar-none'
        )}
      >
        <AnimatePresence mode="wait">
          {activeTab === 'general' && (
            <motion.div
              key="general"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-4"
            >
              <div className={cardClass}>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Settings size={18} className="text-primary" />
                  外观设置
                </h2>

                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    主题
                  </Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { value: 'LIGHT', label: '浅色' },
                      { value: 'DARK', label: '深色' },
                      { value: 'SYSTEM', label: '跟随系统' },
                    ].map((theme) => (
                      <button
                        key={theme.value}
                        type="button"
                        onClick={() => {
                          setSettings({ ...settings!, theme: theme.value as UserSettings['theme'] });
                          setTheme(theme.value as 'LIGHT' | 'DARK' | 'SYSTEM');
                        }}
                        className={cn(
                          'rounded-lg px-3 py-2 text-sm font-medium transition-all',
                          settings?.theme === theme.value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-zinc-100 text-muted-foreground hover:text-foreground dark:bg-zinc-800'
                        )}
                      >
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={cardClass}>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Database size={18} className="text-primary" />
                  数据与隐私
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">启用历史上下文</p>
                      <p className="text-sm text-muted-foreground">
                        在对话中包含历史消息作为上下文
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings!,
                          enableHistoryContext: !settings?.enableHistoryContext,
                        })
                      }
                      className={cn(
                        'relative h-6 w-12 shrink-0 rounded-full border border-transparent transition-colors',
                        settings?.enableHistoryContext
                          ? 'bg-primary shadow-inner'
                          : 'bg-zinc-200 dark:border-white/10 dark:bg-zinc-700'
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-transform',
                          settings?.enableHistoryContext
                            ? 'translate-x-6 bg-primary-foreground'
                            : 'translate-x-0.5 bg-white'
                        )}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">启用向量搜索</p>
                      <p className="text-sm text-muted-foreground">
                        使用语义搜索检索相关历史消息
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings!,
                          enableVectorSearch: !settings?.enableVectorSearch,
                        })
                      }
                      className={cn(
                        'relative h-6 w-12 shrink-0 rounded-full border border-transparent transition-colors',
                        settings?.enableVectorSearch
                          ? 'bg-primary shadow-inner'
                          : 'bg-zinc-200 dark:border-white/10 dark:bg-zinc-700'
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-transform',
                          settings?.enableVectorSearch
                            ? 'translate-x-6 bg-primary-foreground'
                            : 'translate-x-0.5 bg-white'
                        )}
                      />
                    </button>
                  </div>

                  {settings?.enableHistoryContext && (
                    <div>
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                        历史上下文限制
                      </Label>
                      <input
                        type="number"
                        value={settings?.historyContextLimit || 10}
                        onChange={(e) =>
                          setSettings({
                            ...settings!,
                            historyContextLimit: parseInt(e.target.value, 10),
                          })
                        }
                        min={1}
                        max={50}
                        className="mt-2 w-full rounded-xl border border-border bg-zinc-100 px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-zinc-800"
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'model' && (
            <motion.div
              key="model"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-4"
            >
              <div className={cardClass}>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Brain size={18} className="text-primary" />
                  模型配置
                </h2>

                <div className="space-y-4">
                  <div>
                    <Label
                      htmlFor="inline-settings-default-model"
                      className="text-muted-foreground text-xs uppercase tracking-wider"
                    >
                      默认模型
                    </Label>
                    <div className="mt-2">
                      <ModelSelect
                        id="inline-settings-default-model"
                        value={resolvedDefaultModel}
                        onChange={(v) => setSettings({ ...settings!, defaultModel: v })}
                        options={modelSelectOptions}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                      最大Token数
                    </Label>
                    <input
                      type="number"
                      value={settings?.maxTokens || 4096}
                      onChange={(e) =>
                        setSettings({ ...settings!, maxTokens: parseInt(e.target.value, 10) })
                      }
                      min={256}
                      max={32768}
                      className="mt-2 w-full rounded-xl border border-border bg-zinc-100 px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-zinc-800"
                    />
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                      温度 (Temperature)
                    </Label>
                    <div className="mt-2 flex items-center gap-4">
                      <input
                        type="range"
                        value={settings?.temperature || 0.7}
                        onChange={(e) =>
                          setSettings({
                            ...settings!,
                            temperature: parseFloat(e.target.value),
                          })
                        }
                        min={0}
                        max={2}
                        step={0.1}
                        className="gpt-range flex-1 cursor-pointer"
                      />
                      <span className="w-12 shrink-0 text-center font-mono text-sm tabular-nums text-muted-foreground">
                        {(settings?.temperature || 0.7).toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      较低的值产生更确定的输出，较高的值产生更多样化的输出
                    </p>
                  </div>
                </div>
              </div>

              <div className={cn(cardClass, !isPopover && 'space-y-4')}>
                <h2 className="text-base font-semibold">系统提示词</h2>
                <textarea
                  value={settings?.systemPrompt || ''}
                  onChange={(e) => setSettings({ ...settings!, systemPrompt: e.target.value })}
                  placeholder="输入自定义系统提示词..."
                  className="h-28 w-full resize-none rounded-xl border border-border bg-zinc-100 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-zinc-800"
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'api-keys' && (
            <motion.div
              key="api-keys"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-4"
            >
              <div className={cardClass}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <Key size={18} className="text-primary" />
                    API密钥管理
                  </h2>
                  <Button
                    type="button"
                    onClick={() => setShowAddKey(!showAddKey)}
                    className="ios-button-primary w-full sm:w-auto"
                  >
                    <Plus size={16} className="mr-2" />
                    添加密钥
                  </Button>
                </div>

                <AnimatePresence>
                  {showAddKey && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 space-y-4 rounded-xl border border-border bg-zinc-100/50 p-4 dark:bg-zinc-800/50">
                        <div>
                          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                            名称
                          </Label>
                          <Input
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            placeholder="例如：生产环境密钥"
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                            密钥
                          </Label>
                          <Input
                            type="password"
                            value={newKeyValue}
                            onChange={(e) => setNewKeyValue(e.target.value)}
                            placeholder="输入API密钥..."
                            className="mt-2"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={handleAddApiKey}
                            className="ios-button-primary flex-1"
                          >
                            保存
                          </Button>
                          <Button
                            type="button"
                            onClick={() => setShowAddKey(false)}
                            className="flex-1 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-4 space-y-3">
                  {apiKeys.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <Key size={32} className="mx-auto mb-3 opacity-30" />
                      <p>暂无API密钥</p>
                      <p className="mt-1 text-sm">添加您的LantuConnect API密钥</p>
                    </div>
                  ) : (
                    apiKeys.map((key) => (
                      <div
                        key={key.id}
                        className="flex flex-col gap-3 rounded-xl border border-border bg-zinc-100/50 p-3 sm:flex-row sm:items-center dark:bg-zinc-800/50"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Key size={18} className="text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium">{key.name}</p>
                            {key.isDefault && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                默认
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-sm text-muted-foreground">{key.keyPrefix}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!key.isDefault && (
                            <button
                              type="button"
                              onClick={() => handleSetDefaultKey(key.id)}
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-zinc-200 hover:text-foreground dark:hover:bg-zinc-700"
                              title="设为默认"
                            >
                              <Star size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteApiKey(key.id)}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                            title="删除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab !== 'api-keys' && (
          <div className="mt-4 flex flex-col gap-2 border-t border-gpt-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-primary">{saveMessage}</p>
            <Button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="ios-button-primary w-full sm:w-auto"
            >
              {isSaving ? (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : null}
              保存设置
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
