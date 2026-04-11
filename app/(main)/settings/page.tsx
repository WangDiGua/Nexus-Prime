'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, 
  Brain, 
  Key, 
  Plus, 
  Trash2, 
  Star,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/lib/context/ThemeContext';

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

export default function SettingsPage() {
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
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
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
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      if (response.ok) {
        setSaveMessage('设置已保存');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
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
      }
    } catch (error) {
      console.error('Failed to add API key:', error);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    try {
      const response = await fetch(`/api/settings/api-keys/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        await fetchApiKeys();
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
    }
  };

  const handleSetDefaultKey = async (id: string) => {
    try {
      const response = await fetch(`/api/settings/api-keys/${id}`, {
        method: 'PATCH',
      });
      
      if (response.ok) {
        await fetchApiKeys();
      }
    } catch (error) {
      console.error('Failed to set default key:', error);
    }
  };

  const tabs = [
    { id: 'general', label: '常规', icon: Settings },
    { id: 'model', label: '模型', icon: Brain },
    { id: 'api-keys', label: 'API密钥', icon: Key },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Settings className="text-primary" />
            用户设置
          </h1>
          <p className="text-muted-foreground mt-2">管理您的账户和偏好设置</p>
        </div>

        <div className="flex gap-6">
          <div className="w-48 shrink-0">
            <div className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  )}
                >
                  <tab.icon size={18} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            <AnimatePresence mode="wait">
              {activeTab === 'general' && (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="ios-card p-6 space-y-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Settings size={20} className="text-primary" />
                      外观设置
                    </h2>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">主题</Label>
                        <div className="flex gap-2 mt-2">
                          {[
                            { value: 'LIGHT', label: '浅色' },
                            { value: 'DARK', label: '深色' },
                            { value: 'SYSTEM', label: '跟随系统' },
                          ].map((theme) => (
                            <button
                              key={theme.value}
                              onClick={() => {
                                setSettings({ ...settings!, theme: theme.value as any });
                                setTheme(theme.value as any);
                              }}
                              className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                settings?.theme === theme.value
                                  ? "bg-primary text-white"
                                  : "bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {theme.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">语言</Label>
                        <select
                          value={settings?.language || 'zh-CN'}
                          onChange={(e) => setSettings({ ...settings!, language: e.target.value })}
                          className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="zh-CN">简体中文</option>
                          <option value="en-US">English</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="ios-card p-6 space-y-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Database size={20} className="text-primary" />
                      数据与隐私
                    </h2>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">启用历史上下文</p>
                          <p className="text-sm text-muted-foreground">在对话中包含历史消息作为上下文</p>
                        </div>
                        <button
                          onClick={() => setSettings({ ...settings!, enableHistoryContext: !settings?.enableHistoryContext })}
                          className={cn(
                            "w-12 h-6 rounded-full transition-colors relative",
                            settings?.enableHistoryContext ? "bg-primary" : "bg-zinc-200 dark:bg-zinc-700"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform",
                            settings?.enableHistoryContext ? "translate-x-6" : "translate-x-0.5"
                          )} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">启用向量搜索</p>
                          <p className="text-sm text-muted-foreground">使用语义搜索检索相关历史消息</p>
                        </div>
                        <button
                          onClick={() => setSettings({ ...settings!, enableVectorSearch: !settings?.enableVectorSearch })}
                          className={cn(
                            "w-12 h-6 rounded-full transition-colors relative",
                            settings?.enableVectorSearch ? "bg-primary" : "bg-zinc-200 dark:bg-zinc-700"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform",
                            settings?.enableVectorSearch ? "translate-x-6" : "translate-x-0.5"
                          )} />
                        </button>
                      </div>

                      {settings?.enableHistoryContext && (
                        <div>
                          <Label className="text-muted-foreground text-xs uppercase tracking-wider">历史上下文限制</Label>
                          <input
                            type="number"
                            value={settings?.historyContextLimit || 10}
                            onChange={(e) => setSettings({ ...settings!, historyContextLimit: parseInt(e.target.value) })}
                            min={1}
                            max={50}
                            className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="ios-card p-6 space-y-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Brain size={20} className="text-primary" />
                      模型配置
                    </h2>
                    
                    <div className="space-y-4">
                      <div>
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">默认模型</Label>
                        <select
                          value={settings?.defaultModel || 'qwen-plus-latest'}
                          onChange={(e) => setSettings({ ...settings!, defaultModel: e.target.value })}
                          className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="qwen-plus-latest">Qwen Plus (推荐)</option>
                          <option value="qwen-max">Qwen Max</option>
                          <option value="qwen-turbo">Qwen Turbo (快速)</option>
                          <option value="qwen-long">Qwen Long (长文本)</option>
                        </select>
                      </div>

                      <div>
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">最大Token数</Label>
                        <input
                          type="number"
                          value={settings?.maxTokens || 4096}
                          onChange={(e) => setSettings({ ...settings!, maxTokens: parseInt(e.target.value) })}
                          min={256}
                          max={32768}
                          className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div>
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">温度 (Temperature)</Label>
                        <div className="mt-2 flex items-center gap-4">
                          <input
                            type="range"
                            value={settings?.temperature || 0.7}
                            onChange={(e) => setSettings({ ...settings!, temperature: parseFloat(e.target.value) })}
                            min={0}
                            max={2}
                            step={0.1}
                            className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                          />
                          <span className="text-sm font-mono w-12 text-center">
                            {(settings?.temperature || 0.7).toFixed(1)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          较低的值产生更确定的输出，较高的值产生更多样化的输出
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="ios-card p-6 space-y-4">
                    <h2 className="text-lg font-semibold">系统提示词</h2>
                    <textarea
                      value={settings?.systemPrompt || ''}
                      onChange={(e) => setSettings({ ...settings!, systemPrompt: e.target.value })}
                      placeholder="输入自定义系统提示词..."
                      className="w-full h-32 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                  </div>
                </motion.div>
              )}

              {activeTab === 'api-keys' && (
                <motion.div
                  key="api-keys"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="ios-card p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Key size={20} className="text-primary" />
                        API密钥管理
                      </h2>
                      <Button
                        onClick={() => setShowAddKey(!showAddKey)}
                        className="ios-button-primary"
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
                          <div className="p-4 rounded-xl bg-zinc-100/50 dark:bg-zinc-800/50 border border-border space-y-4">
                            <div>
                              <Label className="text-muted-foreground text-xs uppercase tracking-wider">名称</Label>
                              <Input
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                                placeholder="例如：生产环境密钥"
                                className="mt-2"
                              />
                            </div>
                            <div>
                              <Label className="text-muted-foreground text-xs uppercase tracking-wider">密钥</Label>
                              <Input
                                type="password"
                                value={newKeyValue}
                                onChange={(e) => setNewKeyValue(e.target.value)}
                                placeholder="输入API密钥..."
                                className="mt-2"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={handleAddApiKey} className="ios-button-primary flex-1">
                                保存
                              </Button>
                              <Button
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

                    <div className="space-y-3">
                      {apiKeys.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Key size={32} className="mx-auto mb-3 opacity-30" />
                          <p>暂无API密钥</p>
                          <p className="text-sm mt-1">添加您的LantuConnect API密钥</p>
                        </div>
                      ) : (
                        apiKeys.map((key) => (
                          <div
                            key={key.id}
                            className="flex items-center gap-4 p-4 rounded-xl bg-zinc-100/50 dark:bg-zinc-800/50 border border-border"
                          >
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Key size={18} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{key.name}</p>
                                {key.isDefault && (
                                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                    默认
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground font-mono">{key.keyPrefix}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {!key.isDefault && (
                                <button
                                  onClick={() => handleSetDefaultKey(key.id)}
                                  className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-muted-foreground hover:text-foreground transition-colors"
                                  title="设为默认"
                                >
                                  <Star size={16} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteApiKey(key.id)}
                                className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
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
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-primary">{saveMessage}</p>
                <Button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="ios-button-primary"
                >
                  {isSaving ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  ) : null}
                  保存设置
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
