const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'q', 'Q', 's', 'S', 'o', 'N', 'd', 'U', 'D'];
const THOUSAND = 1000;
const SEC_PER_MIN = 60;
const SEC_PER_HOUR = 3600;
const SEC_PER_DAY = 86400;

const trim = (s: string) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);
const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatNumber(n: number, digits = 2): string {
  if (Number.isNaN(n)) return '0';
  if (!Number.isFinite(n)) return n < 0 ? '-∞' : '∞';
  if (n < 0) return '-' + formatNumber(-n, digits);
  if (n < THOUSAND) {
    const r = Number(n.toFixed(digits));
    if (r < THOUSAND) return trim(r.toFixed(digits));
    return '1' + SUFFIXES[1];
  }
  let exp = Math.max(1, Math.floor(Math.log10(n) / 3));
  let scaled = n / Math.pow(THOUSAND, exp);
  if (scaled >= THOUSAND) { exp++; scaled /= THOUSAND; }
  else if (scaled < 1) { exp--; scaled *= THOUSAND; }
  if (Number(scaled.toFixed(digits)) >= THOUSAND) { exp++; scaled /= THOUSAND; }
  if (exp >= SUFFIXES.length) {
    const [m, e] = n.toExponential(digits).split('e');
    return trim(m) + 'e' + e.replace('+', '');
  }
  return trim(scaled.toFixed(digits)) + SUFFIXES[exp];
}

export function formatMoney(n: number): string {
  return n < 0 ? '-$' + formatNumber(-n) : '$' + formatNumber(n);
}

/** Per-second rate as a number string; the caller adds the unit ("/s"). */
export function formatRate(perSec: number): string {
  return formatNumber(perSec);
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0s';
  const t = Math.floor(sec);
  if (t >= SEC_PER_DAY) {
    return `${Math.floor(t / SEC_PER_DAY)}d ${pad2(Math.floor((t % SEC_PER_DAY) / SEC_PER_HOUR))}h`;
  }
  if (t >= SEC_PER_HOUR) {
    return `${Math.floor(t / SEC_PER_HOUR)}h ${pad2(Math.floor((t % SEC_PER_HOUR) / SEC_PER_MIN))}m`;
  }
  if (t >= SEC_PER_MIN) return `${Math.floor(t / SEC_PER_MIN)}m ${pad2(t % SEC_PER_MIN)}s`;
  return `${t}s`;
}
