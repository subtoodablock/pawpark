import { TREATS, formatDuration, formatMoney, formatNumber } from '../core';
import type { RewardResult, Stat } from '../core';

function trim(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}
function pct(n: number): string {
  return trim(n * 100) + '%';
}

/** Human-readable per-level effect of an upgrade, derived from def.stat/perLevel. */
export function statLabel(stat: Stat, perLevel: number): string {
  switch (stat) {
    case 'layRate':
      return `+${pct(perLevel)} dig rate`;
    case 'findValue':
      return `+${pct(perLevel)} find value`;
    case 'kennelCapacity':
      return `+${pct(perLevel)} kennel capacity`;
    case 'shippingCapacity':
      return `+${pct(perLevel)} shipping capacity`;
    case 'squirrelRate':
      return `+${pct(perLevel)} squirrel visits`;
    case 'adoptionCap':
      return `+${trim(perLevel)} adoption stock`;
    case 'adoptionRefill':
      return `+${trim(perLevel)} stock refill/sec`;
    case 'rescueRate':
      return `+${trim(perLevel)} pups/min per kennel`;
    case 'fleetSlots':
      return `+${trim(perLevel)} fleet slot${perLevel === 1 ? '' : 's'}`;
    case 'zoomieBonus':
      return `+${pct(perLevel)} income per zoomie`;
    case 'maxZoomies':
      return `+${trim(perLevel)} max zoomies`;
    case 'spiritPawBonus':
      return `+${pct(perLevel)} per Spirit Paw`;
    case 'collarBonus':
      return `+${pct(perLevel)} per Legend Collar`;
    case 'offlineHours':
      return `+${trim(perLevel)}h Treat Jar`;
    case 'mailCapacity':
      return `+${trim(perLevel)} mailbox slot${perLevel === 1 ? '' : 's'}`;
    case 'squirrelHound':
      return `+${pct(perLevel)} hound catch chance`;
    case 'autoWhistle':
      return `+${pct(perLevel)} auto-whistle`;
    case 'autoBuild':
      return 'Unlocks Auto-Build';
    case 'autoTraining':
      return 'Unlocks Auto-Training';
    case 'autoPrestige':
      return 'Unlocks Auto-Prestige';
    case 'researchDiscount':
      return `-${pct(perLevel)} training cost`;
    case 'kennelDiscount':
      return `-${pct(perLevel)} kennel cost`;
    case 'fleetDiscount':
      return `-${pct(perLevel)} fleet cost`;
  }
  return `${stat} ${perLevel}`;
}

/** Duration for treats / jars: whole hours when long, otherwise formatDuration. */
export function formatTreatDuration(sec: number): string {
  if (sec >= 3600) {
    const hrs = sec / 3600;
    return (Number.isInteger(hrs) ? String(hrs) : hrs.toFixed(1)) + 'h';
  }
  return formatDuration(sec);
}

export function formatReward(r: RewardResult): string {
  switch (r.kind) {
    case 'cash':
      return `+${formatMoney(r.amount)}`;
    case 'goldenBones':
      return `+${formatNumber(r.amount)} \u{1F9B4}`;
    case 'treat': {
      const t = TREATS.find((x) => x.id === r.treatId);
      return `${t ? t.icon + ' ' + t.name : 'Treat'} (${formatTreatDuration(r.durationSec)})`;
    }
  }
}

// ---------------------------------------------------------------- research cards

export interface StatDesc {
  pre: string;
  /** the number part, rendered in the accent colour */
  hi: string;
  post: string;
}

/** "Increase dig rate by [10%]": per-level effect split so the number can be highlighted. */
export function describeStat(stat: Stat, p: number): StatDesc {
  const up = (what: string): StatDesc => ({ pre: `Increase ${what} by `, hi: pct(p), post: '' });
  const plural = (n: number, w: string): string => `${w}${n === 1 ? '' : 's'}`;
  switch (stat) {
    case 'layRate':
      return up('dig rate');
    case 'findValue':
      return up('find value');
    case 'kennelCapacity':
      return up('kennel capacity');
    case 'shippingCapacity':
      return up('shipping capacity');
    case 'squirrelRate':
      return up('squirrel visits');
    case 'earnings':
      return up('earnings');
    case 'mailRate':
      return up('letter arrivals');
    case 'adoptionCap':
      return { pre: 'Increase adoption stock by ', hi: trim(p), post: '' };
    case 'adoptionRefill':
      return { pre: 'Refill adoption stock ', hi: `${trim(p)}`, post: ' faster per second' };
    case 'rescueRate':
      return { pre: 'Rescue ', hi: trim(p), post: ' more pups per minute per kennel' };
    case 'fleetSlots':
      return { pre: 'Unlock ', hi: trim(p), post: ` extra fleet ${plural(p, 'slot')}` };
    case 'zoomieBonus':
      return { pre: 'Increase income per zoomie by ', hi: pct(p), post: '' };
    case 'maxZoomies':
      return { pre: 'Increase max zoomies by ', hi: trim(p), post: '' };
    case 'spiritPawBonus':
      return { pre: 'Increase the bonus per Spirit Paw by ', hi: pct(p), post: '' };
    case 'collarBonus':
      return { pre: 'Increase the bonus per Legend Collar by ', hi: pct(p), post: '' };
    case 'offlineHours':
      return { pre: 'Treat Jar holds ', hi: `${trim(p)}h`, post: ' more offline time' };
    case 'mailCapacity':
      return { pre: 'Mailbox holds ', hi: trim(p), post: ` more ${plural(p, 'letter')}` };
    case 'squirrelHound':
      return { pre: 'Raise the hound catch chance by ', hi: pct(p), post: '' };
    case 'autoWhistle':
      return { pre: 'Auto-adopt ', hi: pct(p), post: ' of the stock refill' };
    case 'autoBuild':
      return { pre: 'Unlocks ', hi: 'Auto-Build', post: '' };
    case 'autoTraining':
      return { pre: 'Unlocks ', hi: 'Auto-Training', post: '' };
    case 'autoPrestige':
      return { pre: 'Unlocks ', hi: 'Auto-Prestige', post: '' };
    case 'researchDiscount':
      return { pre: 'Reduce Training costs by ', hi: pct(p), post: '' };
    case 'kennelDiscount':
      return { pre: 'Reduce Kennel costs by ', hi: pct(p), post: '' };
    case 'fleetDiscount':
      return { pre: 'Reduce Fleet costs by ', hi: pct(p), post: '' };
  }
  return { pre: '', hi: statLabel(stat, p), post: '' };
}

function big(n: number): string {
  return Math.abs(n) >= 1000 ? formatNumber(n) : trim(n);
}

/** Total effect of `level` levels of an upgrade on its own: +perLevel×level (mult) or the added amount. */
export function statTotal(stat: Stat, p: number, level: number): string {
  const t = p * level;
  switch (stat) {
    case 'layRate':
    case 'findValue':
    case 'kennelCapacity':
    case 'shippingCapacity':
    case 'squirrelRate':
    case 'earnings':
    case 'mailRate':
    case 'zoomieBonus':
    case 'spiritPawBonus':
    case 'collarBonus':
    case 'squirrelHound':
    case 'autoWhistle':
      return `+${pct(t)}`;
    case 'researchDiscount':
    case 'kennelDiscount':
    case 'fleetDiscount':
      return `-${pct(t)}`;
    case 'adoptionCap':
    case 'maxZoomies':
    case 'mailCapacity':
      return `+${big(t)}`;
    case 'adoptionRefill':
      return `+${big(t)}/s`;
    case 'rescueRate':
      return `+${big(t)}/min`;
    case 'fleetSlots':
      return `+${big(t)} ${t === 1 ? 'slot' : 'slots'}`;
    case 'offlineHours':
      return `+${big(t)}h`;
    case 'autoBuild':
    case 'autoTraining':
    case 'autoPrestige':
      return level >= 1 ? 'ON' : 'OFF';
  }
  return `+${big(t)}`;
}
