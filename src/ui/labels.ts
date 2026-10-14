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
