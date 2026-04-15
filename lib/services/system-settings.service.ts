import { prisma } from '@/lib/db/prisma';

const CACHE_TTL_MS = 15_000;

const RUNTIME_ENV_KEYS = [
  'LANTU_API_BASE_URL',
  'LANTU_API_KEY',
  'LANTU_API_TIMEOUT_MS',
  'LANTU_API_KEY_HEADER',
  'LANTU_API_TRACE_HEADER',
  'LANTU_FIELD_REQUEST_ID',
  'LANTU_FIELD_TRACE_ID',
  'LANTU_FIELD_STATUS_CODE',
  'LANTU_FIELD_STATUS',
  'LANTU_FIELD_LATENCY_MS',
  'LANTU_FIELD_BODY',
  'LANTU_FIELD_ENTRY',
  'LANTU_FIELD_OPENAI_TOOLS',
  'LANTU_FIELD_ROUTES',
  'LANTU_FIELD_WARNINGS',
  'LANTU_FIELD_FUNCTION_NAME',
  'LANTU_FIELD_RESOURCE_TYPE',
  'LANTU_FIELD_RESOURCE_ID',
  'LANTU_FIELD_UPSTREAM_NAME',
  'LANTU_ENTRY_RESOURCE_TYPE',
  'LANTU_ENTRY_RESOURCE_ID',
  'LANTU_REACT_MAX_ITERATIONS',
  'NEXUS_ASK_DATA_MCP_SSE_URL',
  'NEXUS_ASK_DATA_MCP_TIMEOUT_MS',
  'NEXT_PUBLIC_NEXUS_ASK_DATA_ENABLED',
  'NEXT_PUBLIC_NEXUS_ASK_DATA_BUTTON_LABEL',
  'NEXT_PUBLIC_NEXUS_ASK_DATA_SKILL_ID',
] as const;

type RuntimeEnvKey = (typeof RUNTIME_ENV_KEYS)[number];

interface CachedSystemSettings {
  expiresAt: number;
  values: Map<string, string>;
}

interface PublicChatSystemSettings {
  askDataSkillId: string;
  askDataDirectEnabled: boolean;
  askDataButtonLabel: string;
}

interface ChatRuntimeSettings {
  reactMaxIterations: number;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export class SystemSettingsService {
  private cache: CachedSystemSettings | null = null;
  private pendingLoad: Promise<Map<string, string>> | null = null;
  private warnedDbReadFailure = false;

  private async loadSettingMap(forceRefresh = false): Promise<Map<string, string>> {
    const now = Date.now();
    if (!forceRefresh && this.cache && this.cache.expiresAt > now) {
      return this.cache.values;
    }

    if (!forceRefresh && this.pendingLoad) {
      return this.pendingLoad;
    }

    this.pendingLoad = (async () => {
      try {
        const rows = await prisma.systemSetting.findMany({
          select: {
            key: true,
            value: true,
          },
        });

        const values = new Map<string, string>();
        for (const row of rows) {
          if (typeof row.value === 'string') {
            values.set(row.key, row.value);
          }
        }

        this.cache = {
          expiresAt: Date.now() + CACHE_TTL_MS,
          values,
        };
        this.warnedDbReadFailure = false;
        return values;
      } catch (error) {
        if (!this.warnedDbReadFailure) {
          console.warn(
            '[SystemSettings] Falling back to process.env because DB settings could not be loaded:',
            error instanceof Error ? error.message : String(error),
          );
          this.warnedDbReadFailure = true;
        }
        return this.cache?.values ?? new Map<string, string>();
      } finally {
        this.pendingLoad = null;
      }
    })();

    return this.pendingLoad;
  }

  async getRawValue(key: string): Promise<string | undefined> {
    const values = await this.loadSettingMap();
    const raw = values.get(key);
    if (raw != null && raw !== '') {
      return raw;
    }

    const envValue = process.env[key];
    return envValue && envValue !== '' ? envValue : undefined;
  }

  async applyRuntimeEnv(keys: readonly RuntimeEnvKey[] = RUNTIME_ENV_KEYS): Promise<void> {
    const values = await this.loadSettingMap();
    for (const key of keys) {
      const raw = values.get(key);
      if (raw != null) {
        process.env[key] = raw;
      }
    }
  }

  async getPublicChatSettings(): Promise<PublicChatSystemSettings> {
    const [askDataSkillId, askDataEnabledRaw, askDataButtonLabel] = await Promise.all([
      this.getRawValue('NEXT_PUBLIC_NEXUS_ASK_DATA_SKILL_ID'),
      this.getRawValue('NEXT_PUBLIC_NEXUS_ASK_DATA_ENABLED'),
      this.getRawValue('NEXT_PUBLIC_NEXUS_ASK_DATA_BUTTON_LABEL'),
    ]);

    return {
      askDataSkillId: askDataSkillId?.trim() ?? '',
      askDataDirectEnabled: parseBoolean(askDataEnabledRaw, false),
      askDataButtonLabel: askDataButtonLabel?.trim() || '智能问数',
    };
  }

  async getChatRuntimeSettings(): Promise<ChatRuntimeSettings> {
    const maxIterationsRaw =
      (await this.getRawValue('LANTU_REACT_MAX_ITERATIONS')) ??
      process.env.REACT_MAX_ITERATIONS;

    return {
      reactMaxIterations: parsePositiveInt(maxIterationsRaw, 20),
    };
  }

  clearCache(): void {
    this.cache = null;
    this.pendingLoad = null;
  }
}

export const systemSettingsService = new SystemSettingsService();
