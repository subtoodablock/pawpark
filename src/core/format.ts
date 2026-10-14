/**
 * Short suffix scheme, indexed by exp3 (value = mantissa * 1000^exp3), covering 1e3..1e99:
 *  1-13  legacy single letters: K M B T q Q s S o N d U D   (thousand .. duodecillion)
 *  14-20 tredecillion..novemdecillion: <digit-letter>d  -> Td qd Qd sd Sd Od Nd
 *  21    vigintillion: V
 *  22-30 unvigintillion..novemvigintillion: <digit-letter>v -> Uv Dv Tv qv Qv sv Sv Ov Nv
 *  31-33 trigintillion..duotrigintillion: Tg Ug Dg
 * Digit-letters: U=1 D=2 T=3 q=4 Q=5 s=6 S=7 O/o=8 N=9. 'd' = decillion block, 'v' = vigintillion
 * block, 'g' = trigintillion block. Beyond the table we fall back to scientific notation.
 */
export const SUFFIXES = [
  '', 'K', 'M', 'B', 'T', 'q', 'Q', 's', 'S', 'o', 'N', 'd', 'U', 'D',
  'Td', 'qd', 'Qd', 'sd', 'Sd', 'Od', 'Nd', 'V',
  'Uv', 'Dv', 'Tv', 'qv', 'Qv', 'sv', 'Sv', 'Ov', 'Nv',
  'Tg', 'Ug', 'Dg',
];

/** Long names indexed by exp3 (1 = thousand ... 33 = duotrigintillion, i.e. 1e99). */
export const NUMBER_NAMES = [
  '', 'Thousand', 'Million', 'Billion', 'Trillion', 'Quadrillion', 'Quintillion', 'Sextillion', 'Septillion',
  'Octillion', 'Nonillion', 'Decillion', 'Undecillion', 'Duodecillion', 'Tredecillion', 'Quattuordecillion',
  'Quindecillion', 'Sexdecillion', 'Septendecillion', 'Octodecillion', 'Novemdecillion', 'Vigintillion',
  'Unvigintillion', 'Duovigintillion', 'Tresvigintillion', 'Quattuorvigintillion', 'Quinvigintillion',
  'Sexvigintillion', 'Septenvigintillion', 'Octovigintillion', 'Novemvigintillion', 'Trigintillion',
  'Untrigintillion', 'Duotrigintillion',
];

export function numberName(exp3: number): string {
  return NUMBER_NAMES[exp3] ?? '';
}

/** Long name for a short suffix ("o" -> "Octillion"); '' if unknown. */
export function suffixName(suffix: string): string {
  const i = SUFFIXES.indexOf(suffix);
  return i > 0 ? NUMBER_NAMES[i] : '';
}
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
