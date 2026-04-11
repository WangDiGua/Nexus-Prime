/**
 * 全局轻提示（Sonner），已在 `Providers` 中挂载 `<AppToaster />`。
 *
 * @example
 * import { toast } from '@/lib/toast';
 * toast.success('已保存');
 * toast.error('操作失败');
 * toast.promise(fetch(...), { loading: '提交中…', success: '完成', error: '失败' });
 */
export { toast } from 'sonner';
