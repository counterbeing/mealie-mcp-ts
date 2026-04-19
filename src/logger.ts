function ts(): string {
  return new Date().toISOString();
}

function truncate(value: unknown, max = 200): string {
  const json = typeof value === 'string' ? value : JSON.stringify(value);
  if (!json) return '';
  return json.length > max ? `${json.slice(0, max)}…(${json.length}c)` : json;
}

export function logInfo(event: string, fields: Record<string, unknown> = {}): void {
  const parts = Object.entries(fields).map(([k, v]) => `${k}=${truncate(v)}`);
  console.error(`[${ts()}] ${event}${parts.length ? ' ' + parts.join(' ') : ''}`);
}

export function logError(
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const parts = Object.entries(fields).map(([k, v]) => `${k}=${truncate(v)}`);
  console.error(`[${ts()}] ERROR ${event}${parts.length ? ' ' + parts.join(' ') : ''}`);
}
