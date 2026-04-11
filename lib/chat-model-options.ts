import type { ModelSelectOption } from '@/components/ui/model-select';

/** 与聊天 / 设置 API 中 defaultModel 取值一致 */
export const BASE_CHAT_MODEL_OPTIONS: ModelSelectOption[] = [
  { value: 'qwen-plus-latest', label: 'Qwen Plus (推荐)' },
  { value: 'qwen-turbo-latest', label: 'Qwen Turbo (快速)' },
  { value: 'qwen-max-latest', label: 'Qwen Max' },
  { value: 'qwen-long-latest', label: 'Qwen Long (长文本)' },
];

/** 合并当前模型（若不在预设列表中则追加一项，避免下拉无法展示） */
export function buildChatModelOptions(currentModel: string | undefined): ModelSelectOption[] {
  const byValue = new Map(BASE_CHAT_MODEL_OPTIONS.map((o) => [o.value, o]));
  if (currentModel && !byValue.has(currentModel)) {
    byValue.set(currentModel, { value: currentModel, label: currentModel });
  }
  return Array.from(byValue.values());
}
