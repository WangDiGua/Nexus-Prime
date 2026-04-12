import type { ModelSelectOption } from '@/components/ui/model-select';

/**
 * 与百炼 OpenAI 兼容接口常用名一致（见：模型列表 / compatible-mode）。
 * 稳定版与 `*-latest` 在文档中并列存在；本应用下拉统一用 `*-latest`，避免与旧数据里的短名重复展示。
 */
export const BASE_CHAT_MODEL_OPTIONS: ModelSelectOption[] = [
  { value: 'qwen-plus-latest', label: 'Qwen Plus（推荐）' },
  { value: 'qwen-turbo-latest', label: 'Qwen Turbo（快速）' },
  { value: 'qwen-max-latest', label: 'Qwen Max' },
  { value: 'qwen-long-latest', label: 'Qwen Long（长文本）' },
];

/** 与预设同一模型的短名 / 旧配置，映射到 canonical value，用于去重与展示对齐 */
const LEGACY_MODEL_ALIASES: Record<string, string> = {
  'qwen-plus': 'qwen-plus-latest',
  'qwen-turbo': 'qwen-turbo-latest',
  'qwen-max': 'qwen-max-latest',
  'qwen-long': 'qwen-long-latest',
};

/**
 * 将用户/库里可能出现的短名规范为下拉预设中的 id（与官网并列名称对应，避免同系列出现两行）。
 */
export function normalizeChatModelId(model: string | undefined | null): string | undefined {
  if (model == null || !String(model).trim()) return undefined;
  const t = String(model).trim();
  return LEGACY_MODEL_ALIASES[t] ?? t;
}

/** 合并当前模型（若不在预设列表中则追加一项，避免下拉无法展示） */
export function buildChatModelOptions(currentModel: string | undefined): ModelSelectOption[] {
  const byValue = new Map(BASE_CHAT_MODEL_OPTIONS.map((o) => [o.value, o]));
  const normalized = normalizeChatModelId(currentModel);
  if (normalized && !byValue.has(normalized)) {
    byValue.set(normalized, { value: normalized, label: normalized });
  }
  return Array.from(byValue.values());
}
