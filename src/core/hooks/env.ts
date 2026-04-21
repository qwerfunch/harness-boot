// harness-boot — 환경 변수 주입 정책 (F-004, red phase stub)
//
// hook env 주입은 meta.json.allowedEnvVars 화이트리스트에 제한되며,
// 비허용 키는 denied 로 보고되고 값은 절대 반환되지 않는다 (비밀 마스킹).

export interface EnvPolicy {
  readonly allowedEnvVars: readonly string[];
}

export interface EnvResolution {
  readonly env: Record<string, string>;
  readonly denied: readonly string[];
}

export function resolveEnv(
  hookEnv: Record<string, string> | undefined,
  processEnv: Record<string, string | undefined>,
  policy: EnvPolicy,
): EnvResolution {
  const allowed = new Set(policy.allowedEnvVars);
  const env: Record<string, string> = {};
  const denied: string[] = [];

  for (const key of Object.keys(processEnv).sort()) {
    if (!allowed.has(key)) continue;
    const value = processEnv[key];
    if (value === undefined) continue;
    env[key] = value;
  }

  if (hookEnv) {
    for (const key of Object.keys(hookEnv).sort()) {
      if (allowed.has(key)) {
        env[key] = hookEnv[key] as string;
      } else {
        denied.push(key);
      }
    }
  }

  return { env, denied };
}
