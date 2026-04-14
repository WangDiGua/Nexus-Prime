import type { ChatSelectedSkill } from '@/components/chat/skill-store-sheet';
import type { ToolInvocationView } from '@/types/chat';
import type { Resource, Skill } from '@/types/registry';

type TaskGroupId =
  | 'research'
  | 'analysis'
  | 'automation'
  | 'communication'
  | 'integration'
  | 'general';

export interface TaskGroup {
  id: TaskGroupId;
  title: string;
  description: string;
}

export interface GroupedSkillBucket {
  group: TaskGroup;
  skills: Skill[];
}

export interface WorkModeSummary {
  title: string;
  description: string;
  chips: string[];
}

export interface ToolDeliverySummary {
  title: string;
  statusLabel: string;
  tone: 'neutral' | 'success' | 'error';
  summary: string;
  highlights: string[];
  nextStep?: string;
  rawResult: string;
}

const TASK_GROUPS: Record<TaskGroupId, TaskGroup> = {
  research: {
    id: 'research',
    title: '资料研究',
    description: '适合检索、总结、比对资料和知识增强任务。',
  },
  analysis: {
    id: 'analysis',
    title: '数据分析',
    description: '适合图表、报表、结构化结果和趋势判断。',
  },
  automation: {
    id: 'automation',
    title: '流程执行',
    description: '适合批量执行、任务编排和自动化动作。',
  },
  communication: {
    id: 'communication',
    title: '内容生成',
    description: '适合写作、邮件、方案和对外表达。',
  },
  integration: {
    id: 'integration',
    title: '系统协作',
    description: '适合调用远程服务、业务系统或 MCP 工具。',
  },
  general: {
    id: 'general',
    title: '通用能力',
    description: '适合日常问答、探索和未明确分类的任务。',
  },
};

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function inferTaskGroupFromText(text: string): TaskGroupId {
  const normalized = text.toLowerCase();
  if (
    /(report|chart|table|dashboard|分析|数据|报表|图表|统计|趋势|可视化)/.test(
      normalized,
    )
  ) {
    return 'analysis';
  }
  if (
    /(mail|message|copy|write|blog|content|marketing|邮件|写作|文案|总结|方案|内容)/.test(
      normalized,
    )
  ) {
    return 'communication';
  }
  if (
    /(workflow|trigger|run|batch|automation|execute|执行|流程|自动化|批量|触发)/.test(
      normalized,
    )
  ) {
    return 'automation';
  }
  if (
    /(mcp|api|system|server|service|集成|接口|系统|服务|工具)/.test(normalized)
  ) {
    return 'integration';
  }
  if (
    /(search|knowledge|research|query|retrieve|检索|知识|查询|研究|资料)/.test(
      normalized,
    )
  ) {
    return 'research';
  }
  return 'general';
}

export function groupSkillsByTask(skills: Skill[]): GroupedSkillBucket[] {
  const buckets = new Map<TaskGroupId, Skill[]>();

  for (const skill of skills) {
    const taskGroup = inferTaskGroupFromText(
      [skill.name, skill.description, skill.endpoint].filter(Boolean).join(' '),
    );
    const current = buckets.get(taskGroup) ?? [];
    current.push(skill);
    buckets.set(taskGroup, current);
  }

  return Array.from(buckets.entries())
    .map(([id, groupedSkills]) => ({
      group: TASK_GROUPS[id],
      skills: groupedSkills.sort((left, right) =>
        left.name.localeCompare(right.name, 'zh-CN'),
      ),
    }))
    .sort((left, right) => right.skills.length - left.skills.length);
}

export function describeResourceValue(resource: Resource): {
  scenario: string;
  input: string;
  output: string;
} {
  const taskGroup = inferTaskGroupFromText(
    [resource.name, resource.description, ...(resource.tags ?? [])].join(' '),
  );

  switch (taskGroup) {
    case 'analysis':
      return {
        scenario: '适合做数据分析、图表生成和结构化洞察。',
        input: '输入问题、指标说明、原始数据或分析目标。',
        output: '返回图表、结构化数据或结论摘要。',
      };
    case 'communication':
      return {
        scenario: '适合生成文案、邮件、对外说明或方案。',
        input: '输入主题、对象、语气和核心要求。',
        output: '返回可直接使用或继续编辑的内容草稿。',
      };
    case 'automation':
      return {
        scenario: '适合执行工作流、任务编排和批量动作。',
        input: '输入任务目标、参数和执行范围。',
        output: '返回执行状态、结果摘要和下一步建议。',
      };
    case 'integration':
      return {
        scenario: '适合连接业务系统、远程服务和工具。',
        input: '输入业务上下文、目标对象或接口参数。',
        output: '返回工具结果、状态反馈和相关数据。',
      };
    case 'research':
      return {
        scenario: '适合检索资料、整合知识和快速研究。',
        input: '输入研究主题、检索范围和关注点。',
        output: '返回摘要、引用信息和可继续追问的方向。',
      };
    default:
      return {
        scenario: '适合通用问答和探索式任务。',
        input: '输入你的任务目标、问题或上下文。',
        output: '返回结论、建议和后续动作。',
      };
  }
}

export function getWorkModeSummary(params: {
  canChat: boolean;
  thinkingModeEnabled: boolean;
  selectedSkill: ChatSelectedSkill | null;
}): WorkModeSummary {
  const chips: string[] = [];

  if (params.selectedSkill) {
    chips.push('技能增强');
  } else {
    chips.push('通用对话');
  }

  if (params.thinkingModeEnabled) {
    chips.push('展示思考过程');
  }

  chips.push(params.canChat ? '可直接执行任务' : '登录后可执行任务');

  if (!params.canChat) {
    return {
      title: '访客浏览模式',
      description: '你可以先了解能力中心，登录后再让助手真正执行任务和调用工具。',
      chips,
    };
  }

  if (params.selectedSkill) {
    return {
      title: '技能增强模式',
      description:
        '当前对话会优先围绕“' +
        params.selectedSkill.name +
        '”聚合可用工具，更适合明确的任务执行。',
      chips,
    };
  }

  return {
    title: '通用任务模式',
    description:
      '适合直接提需求、整理资料、生成内容或让系统先帮你判断该调用哪类能力。',
    chips,
  };
}

function stringifyShort(value: unknown): string {
  if (value == null) return '无返回内容';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function extractObjectHighlights(result: Record<string, unknown>): string[] {
  const keys = Object.keys(result).slice(0, 4);
  return keys.map((key) => {
    const value = result[key];
    if (Array.isArray(value)) {
      return key + '：' + value.length + ' 项';
    }
    if (value && typeof value === 'object') {
      return key + '：结构化对象';
    }
    return key + '：' + String(value);
  });
}

export function summarizeToolInvocation(
  invocation: ToolInvocationView,
): ToolDeliverySummary {
  if (invocation.state === 'calling') {
    return {
      title: invocation.toolName,
      statusLabel: '执行中',
      tone: 'neutral',
      summary: '工具已开始执行，正在等待返回结果。',
      highlights: [
        '调用 ID：' + invocation.toolCallId,
        '已提交参数：' + Object.keys(invocation.args ?? {}).length + ' 项',
      ],
      nextStep: '保持当前会话打开，结果返回后会自动写入本轮回复。',
      rawResult: stringifyShort(invocation.args),
    };
  }

  const result = invocation.result;
  if (!result) {
    return {
      title: invocation.toolName,
      statusLabel: '等待结果',
      tone: 'neutral',
      summary: '工具已被调用，但当前还没有可展示的返回结果。',
      highlights: ['调用 ID：' + invocation.toolCallId],
      rawResult: stringifyShort(invocation.args),
    };
  }

  if (result.status === 'error') {
    return {
      title: invocation.toolName,
      statusLabel: '执行失败',
      tone: 'error',
      summary: result.error || '工具调用失败，当前没有拿到有效结果。',
      highlights: [
        '调用 ID：' + invocation.toolCallId,
        result.latency ? '耗时：' + result.latency + ' ms' : '耗时：未知',
      ],
      nextStep: '建议补充更具体的输入，或切换到更适合的技能后重试。',
      rawResult: stringifyShort(result.result ?? result.error),
    };
  }

  const payload = result.result;
  const highlights: string[] = [
    '调用 ID：' + invocation.toolCallId,
    result.latency ? '耗时：' + result.latency + ' ms' : '已返回结果',
  ];

  let summary = '工具执行成功，结果已准备好，可直接继续引用或展开查看原始数据。';

  if (Array.isArray(payload)) {
    summary = '工具执行成功，返回了 ' + payload.length + ' 条结果。';
    highlights.push('返回类型：列表');
    if (payload.length > 0) {
      highlights.push('首项预览：' + stringifyShort(payload[0]).slice(0, 60));
    }
  } else if (payload && typeof payload === 'object') {
    summary = '工具执行成功，已返回结构化结果，可继续用于图表、总结或后续动作。';
    highlights.push(...extractObjectHighlights(payload as Record<string, unknown>));
  } else if (typeof payload === 'string') {
    summary = payload.length > 90 ? payload.slice(0, 90) + '...' : payload;
    highlights.push('返回类型：文本');
  }

  return {
    title: invocation.toolName,
    statusLabel: '已完成',
    tone: 'success',
    summary,
    highlights: highlights.slice(0, 4),
    nextStep: '如果这个结果还不够，可以继续追问“基于这个结果继续处理”。',
    rawResult: stringifyShort(payload),
  };
}

export function recommendSkills(skills: Skill[], input: string): Skill[] {
  const normalizedInput = normalizeText(input).toLowerCase();
  if (!normalizedInput) {
    return skills.slice(0, 3);
  }

  return [...skills]
    .map((skill) => {
      const source = [skill.name, skill.description, skill.endpoint]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      let score = 0;
      for (const token of normalizedInput.split(/\s+/)) {
        if (!token) continue;
        if (source.includes(token)) {
          score += token.length > 2 ? 3 : 1;
        }
      }
      const taskGroup = inferTaskGroupFromText(normalizedInput);
      if (inferTaskGroupFromText(source) === taskGroup) {
        score += 4;
      }
      return { skill, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((item) => item.skill);
}
