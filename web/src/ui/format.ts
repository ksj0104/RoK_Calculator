export function formatDuration(sec: number, t: (k: string) => string): string {
  if (sec <= 0) return `0${t('unit.sec')}`;
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}${t('unit.day')}`);
  if (h) parts.push(`${h}${t('unit.hour')}`);
  if (m && !d) parts.push(`${m}${t('unit.min')}`);
  if (s && !d && !h) parts.push(`${s}${t('unit.sec')}`);
  return parts.join(' ');
}

export const formatNumber = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);
