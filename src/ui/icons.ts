// Glyph icons: Phosphor (MIT), inlined as SVG. Docs: docs/12-art-direction-v2.md section 4.
import { h } from './dom';

import f_bone from '@phosphor-icons/core/assets/fill/bone-fill.svg?raw';
import f_pawPrint from '@phosphor-icons/core/assets/fill/paw-print-fill.svg?raw';
import f_star from '@phosphor-icons/core/assets/fill/star-fill.svg?raw';
import f_dog from '@phosphor-icons/core/assets/fill/dog-fill.svg?raw';
import f_flask from '@phosphor-icons/core/assets/fill/flask-fill.svg?raw';
import f_lightning from '@phosphor-icons/core/assets/fill/lightning-fill.svg?raw';
import f_house from '@phosphor-icons/core/assets/fill/house-fill.svg?raw';
import f_truck from '@phosphor-icons/core/assets/fill/truck-fill.svg?raw';
import f_calendarCheck from '@phosphor-icons/core/assets/fill/calendar-check-fill.svg?raw';
import f_trophy from '@phosphor-icons/core/assets/fill/trophy-fill.svg?raw';
import f_envelopeSimple from '@phosphor-icons/core/assets/fill/envelope-simple-fill.svg?raw';
import f_gearSix from '@phosphor-icons/core/assets/fill/gear-six-fill.svg?raw';
import f_shareFat from '@phosphor-icons/core/assets/fill/share-fat-fill.svg?raw';
import f_lockSimple from '@phosphor-icons/core/assets/fill/lock-simple-fill.svg?raw';
import f_checkSquare from '@phosphor-icons/core/assets/fill/check-square-fill.svg?raw';
import f_storefront from '@phosphor-icons/core/assets/fill/storefront-fill.svg?raw';
import f_squaresFour from '@phosphor-icons/core/assets/fill/squares-four-fill.svg?raw';
import f_sun from '@phosphor-icons/core/assets/fill/sun-fill.svg?raw';
import f_hammer from '@phosphor-icons/core/assets/fill/hammer-fill.svg?raw';
import f_graduationCap from '@phosphor-icons/core/assets/fill/graduation-cap-fill.svg?raw';
import f_magnifyingGlass from '@phosphor-icons/core/assets/fill/magnifying-glass-fill.svg?raw';
import f_lightbulb from '@phosphor-icons/core/assets/fill/lightbulb-fill.svg?raw';
import f_fire from '@phosphor-icons/core/assets/fill/fire-fill.svg?raw';
import f_snowflake from '@phosphor-icons/core/assets/fill/snowflake-fill.svg?raw';
import f_crown from '@phosphor-icons/core/assets/fill/crown-fill.svg?raw';
import f_chartBar from '@phosphor-icons/core/assets/fill/chart-bar-fill.svg?raw';
import f_gift from '@phosphor-icons/core/assets/fill/gift-fill.svg?raw';
import f_timer from '@phosphor-icons/core/assets/fill/timer-fill.svg?raw';
import f_plus from '@phosphor-icons/core/assets/fill/plus-fill.svg?raw';
import f_diamond from '@phosphor-icons/core/assets/fill/diamond-fill.svg?raw';
import f_tree from '@phosphor-icons/core/assets/fill/tree-fill.svg?raw';
import f_bed from '@phosphor-icons/core/assets/fill/bed-fill.svg?raw';
import f_package from '@phosphor-icons/core/assets/fill/package-fill.svg?raw';
import f_tennisBall from '@phosphor-icons/core/assets/fill/tennis-ball-fill.svg?raw';
import f_clover from '@phosphor-icons/core/assets/fill/clover-fill.svg?raw';
import f_wind from '@phosphor-icons/core/assets/fill/wind-fill.svg?raw';
import f_mailbox from '@phosphor-icons/core/assets/fill/mailbox-fill.svg?raw';
import f_shovel from '@phosphor-icons/core/assets/fill/shovel-fill.svg?raw';
import f_coins from '@phosphor-icons/core/assets/fill/coins-fill.svg?raw';
import f_money from '@phosphor-icons/core/assets/fill/money-fill.svg?raw';
import f_hourglass from '@phosphor-icons/core/assets/fill/hourglass-fill.svg?raw';
import f_medal from '@phosphor-icons/core/assets/fill/medal-fill.svg?raw';
import f_sparkle from '@phosphor-icons/core/assets/fill/sparkle-fill.svg?raw';
import f_rocket from '@phosphor-icons/core/assets/fill/rocket-fill.svg?raw';
import f_cube from '@phosphor-icons/core/assets/fill/cube-fill.svg?raw';
import f_flagBanner from '@phosphor-icons/core/assets/fill/flag-banner-fill.svg?raw';
import f_compass from '@phosphor-icons/core/assets/fill/compass-fill.svg?raw';
import b_swap from '@phosphor-icons/core/assets/bold/swap-bold.svg?raw';
import b_arrowsClockwise from '@phosphor-icons/core/assets/bold/arrows-clockwise-bold.svg?raw';
import b_x from '@phosphor-icons/core/assets/bold/x-bold.svg?raw';
import b_info from '@phosphor-icons/core/assets/bold/info-bold.svg?raw';
import b_arrowCounterClockwise from '@phosphor-icons/core/assets/bold/arrow-counter-clockwise-bold.svg?raw';
import b_spiral from '@phosphor-icons/core/assets/bold/spiral-bold.svg?raw';
import b_caretLeft from '@phosphor-icons/core/assets/bold/caret-left-bold.svg?raw';
import b_caretRight from '@phosphor-icons/core/assets/bold/caret-right-bold.svg?raw';
import b_arrowRight from '@phosphor-icons/core/assets/bold/arrow-right-bold.svg?raw';
import b_check from '@phosphor-icons/core/assets/bold/check-bold.svg?raw';
import b_plus from '@phosphor-icons/core/assets/bold/plus-bold.svg?raw';
import b_lockSimple from '@phosphor-icons/core/assets/bold/lock-simple-bold.svg?raw';
import b_caretDown from '@phosphor-icons/core/assets/bold/caret-down-bold.svg?raw';

const SVGS = {
  'bone': f_bone,
  'paw-print': f_pawPrint,
  'star': f_star,
  'dog': f_dog,
  'flask': f_flask,
  'lightning': f_lightning,
  'house': f_house,
  'truck': f_truck,
  'calendar-check': f_calendarCheck,
  'trophy': f_trophy,
  'envelope-simple': f_envelopeSimple,
  'gear-six': f_gearSix,
  'share-fat': f_shareFat,
  'lock-simple': f_lockSimple,
  'check-square': f_checkSquare,
  'storefront': f_storefront,
  'squares-four': f_squaresFour,
  'sun': f_sun,
  'hammer': f_hammer,
  'graduation-cap': f_graduationCap,
  'magnifying-glass': f_magnifyingGlass,
  'lightbulb': f_lightbulb,
  'fire': f_fire,
  'snowflake': f_snowflake,
  'crown': f_crown,
  'chart-bar': f_chartBar,
  'gift': f_gift,
  'timer': f_timer,
  'plus': f_plus,
  'diamond': f_diamond,
  'tree': f_tree,
  'bed': f_bed,
  'package': f_package,
  'tennis-ball': f_tennisBall,
  'clover': f_clover,
  'wind': f_wind,
  'mailbox': f_mailbox,
  'shovel': f_shovel,
  'coins': f_coins,
  'money': f_money,
  'hourglass': f_hourglass,
  'medal': f_medal,
  'sparkle': f_sparkle,
  'rocket': f_rocket,
  'cube': f_cube,
  'flag-banner': f_flagBanner,
  'compass': f_compass,
  'swap-bold': b_swap,
  'arrows-clockwise-bold': b_arrowsClockwise,
  'x-bold': b_x,
  'info-bold': b_info,
  'arrow-counter-clockwise-bold': b_arrowCounterClockwise,
  'spiral-bold': b_spiral,
  'caret-left-bold': b_caretLeft,
  'caret-right-bold': b_caretRight,
  'arrow-right-bold': b_arrowRight,
  'check-bold': b_check,
  'plus-bold': b_plus,
  'lock-simple-bold': b_lockSimple,
  'caret-down-bold': b_caretDown,
} as const;
export type IconName = keyof typeof SVGS;

/** Colours that go with a glyph unless the caller overrides them (spec section 4). */
const DEFAULT_COLOR: Partial<Record<IconName, string>> = {
  bone: 'var(--gold)',
  'paw-print': 'var(--purple)',
  star: 'var(--gold)',
  'check-square': 'var(--green)',
  fire: 'var(--orange)',
  coins: 'var(--gold)',
  crown: 'var(--gold)',
};

export interface IconOpts {
  size?: number;
  color?: string;
  cls?: string;
}

/** The raw `<svg>` markup of a glyph (uses currentColor). */
export function iconSvg(name: IconName): string {
  return SVGS[name];
}

/** A glyph as an inline element. Size in CSS px; colour defaults per glyph, otherwise inherits the text colour. */
export function icon(name: IconName, opts: IconOpts = {}): HTMLElement {
  const el = h('span', { cls: 'ico' + (opts.cls ? ' ' + opts.cls : ''), attrs: { 'aria-hidden': 'true' } });
  el.innerHTML = SVGS[name];
  const size = opts.size ?? 18;
  el.style.width = el.style.height = `${size}px`;
  const color = opts.color ?? DEFAULT_COLOR[name];
  if (color) el.style.color = color;
  return el;
}

/** Tokens usable inside UI strings, e.g. "+5 {bone}". They render as glyphs, never emoji. */
const TOKENS: Record<string, IconName> = {
  bone: 'bone',
  paw: 'paw-print',
  star: 'star',
  dog: 'dog',
  fire: 'fire',
  snow: 'snowflake',
  lock: 'lock-simple',
  tick: 'check-square',
  gift: 'gift',
  bolt: 'lightning',
  trophy: 'trophy',
  mail: 'envelope-simple',
  timer: 'timer',
  sparkle: 'sparkle',
  tree: 'tree',
  gear: 'gear-six',
  cal: 'calendar-check',
  chart: 'chart-bar',
  house: 'house',
  truck: 'truck',
  share: 'share-fat',
  sun: 'sun',
  hammer: 'hammer',
  school: 'graduation-cap',
  crown: 'crown',
  gem: 'diamond',
  coins: 'coins',
  flask: 'flask',
  shovel: 'shovel',
  search: 'magnifying-glass',
  cart: 'storefront',
  arrow: 'arrow-right-bold',
  info: 'info-bold',
  spiral: 'spiral-bold',
  medal: 'medal',
  flag: 'flag-banner',
  gem2: 'diamond',
};

const TOKEN_RE = /\{([a-z]+)\}/g;

/** Turn "+5 {bone}" into text + glyph nodes. */
export function rich(text: string, size = 16): (Node | string)[] {
  const out: (Node | string)[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const name = TOKENS[m[1]];
    if (!name) continue;
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push(icon(name, { size, cls: 'inline' }));
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Set an element's content from a tokenised string; cheap when unchanged (safe every frame). */
export function setRich(el: HTMLElement, text: string, size = 16): void {
  if (el.dataset.rich === text) return;
  el.dataset.rich = text;
  if (!text.includes('{')) {
    el.textContent = text;
    return;
  }
  el.replaceChildren(...rich(text, size).map((n) => (typeof n === 'string' ? document.createTextNode(n) : n)));
}

/** Glyph for a stat family (academy rows, premium shop, daily modifiers). */
export function statIcon(stat: string): IconName {
  switch (stat) {
    case 'layRate':
    case 'rescueRate':
    case 'rescueMult':
      return 'shovel';
    case 'findValue':
    case 'earnings':
    case 'zoomieBonus':
      return 'coins';
    case 'kennelCapacity':
    case 'kennelDiscount':
      return 'house';
    case 'shippingCapacity':
    case 'fleetSlots':
    case 'fleetDiscount':
    case 'sledCars':
      return 'truck';
    case 'squirrelRate':
    case 'squirrelHound':
      return 'dog';
    case 'adoptionCap':
    case 'adoptionRefill':
    case 'autoWhistle':
      return 'dog';
    case 'maxZoomies':
      return 'fire';
    case 'spiritPawBonus':
    case 'collarBonus':
      return 'paw-print';
    case 'offlineHours':
      return 'hourglass';
    case 'mailCapacity':
    case 'mailRate':
      return 'mailbox';
    case 'autoBuild':
      return 'hammer';
    case 'autoTraining':
    case 'researchDiscount':
      return 'graduation-cap';
    case 'autoPrestige':
      return 'tree';
    default:
      return 'sparkle';
  }
}

/** Glyph for a Daily Dig kind. */
export function digIcon(kind: string): IconName {
  switch (kind) {
    case 'squirrels':
      return 'dog';
    case 'letters':
      return 'envelope-simple';
    case 'whistle':
      return 'dog';
    case 'training':
      return 'graduation-cap';
    case 'buildings':
      return 'hammer';
    case 'earn':
      return 'coins';
    case 'treat':
      return 'lightning';
    case 'zoomies':
      return 'fire';
    default:
      return 'shovel';
  }
}
