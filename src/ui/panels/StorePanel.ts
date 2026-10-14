import {
  MAX_STREAK_FREEZES,
  PREMIUM_SHOP,
  PRODUCTS,
  STREAK_FREEZE_COST,
  VIP_TIERS,
  buyPremium,
  buyStreakFreeze,
  computeStats,
  formatNumber,
  grantPurchase,
  premiumCost,
} from '../../core';
import type { ProductDef } from '../../core';
import type { GameController } from '../GameController';
import { h, meter, setClass, setHidden, setMeter, setText } from '../dom';
import type { PaymentProvider } from '../payments/PaymentProvider';
import { formatPrice } from '../payments/PaymentProvider';
import { toast } from '../Toasts';
import { icon, rich, setRich, statIcon } from '../icons';
import { makeRow, section, setBtn, type Panel } from './common';

export function createStorePanel(c: GameController, provider: PaymentProvider): Panel {
  const el = h('div', { cls: 'panel' });
  if (provider.testMode) {
    el.append(h('div', { cls: 'test-banner', text: 'TEST MODE — no real money is charged. Purchases are simulated.' }));
  }
  const stars = h('div', { cls: 'store-stars' });
  el.append(stars);

  // ---- products
  const grid = h('div', { cls: 'product-grid' });
  let busy = false;
  function renderProducts(list: ProductDef[]): void {
    grid.replaceChildren(
      ...list.map((p) =>
        h(
          'button',
          {
            cls: 'product',
            attrs: { type: 'button' },
            on: {
              click: async () => {
                if (busy) return;
                busy = true;
                try {
                  const res = await provider.purchase(p.id);
                  if (!res.ok) {
                    toast(res.reason, 'info');
                    return;
                  }
                  const g = grantPurchase(c.state, p.id, res.receiptId);
                  if (c.check(g)) {
                    c.save();
                    toast(`{star} +${formatNumber(p.stars)} Pup Stars. Thank you!`, 'gold', 4500);
                  }
                } finally {
                  busy = false;
                  update();
                }
              },
            },
          },
          p.tag ? h('span', { cls: 'product-tag', text: p.tag }) : null,
          h('span', { cls: 'product-stars' }, ...rich(`{star} ${formatNumber(p.stars)}`, 22)),
          h('span', { cls: 'product-price', text: formatPrice(p.priceCents) }),
        ),
      ),
    );
  }
  renderProducts(PRODUCTS);
  provider.listProducts().then(renderProducts, () => {});
  el.append(section('{star} Pup Stars', h('div', { cls: 'row-desc', text: 'Stars buy permanent upgrades and conveniences. No random rewards: every item says exactly what it does.' }), grid));

  // ---- VIP
  const vipTitle = h('div', { cls: 'row-title' });
  const vipMeter = meter('goal');
  const vipMeta = h('div', { cls: 'row-meta' });
  const vipPerks = h('div', { cls: 'row-desc' });
  el.append(section('{crown} Kennel Club', h('div', { cls: 'card' }, vipTitle, vipMeter.el, vipMeta, vipPerks)));

  // ---- shop
  const shopRows = PREMIUM_SHOP.map((def) => {
    const row = makeRow(icon(statIcon(def.stat), { size: 26, color: 'var(--purple)' }), def.name, () => {
      const ok = c.check(buyPremium(c.state, def.id));
      if (ok) c.save();
      update();
      return ok;
    });
    el.append(row.el);
    return { def, row };
  });
  const shopHead = section('{cart} Kennel Club Shop (permanent, paid in {star})');
  el.insertBefore(shopHead, shopRows[0]?.row.el ?? null);

  // ---- consumables
  const fRow = makeRow(icon('snowflake', { size: 26, color: 'var(--blue)' }), 'Streak Freeze', () => {
    const ok = c.check(buyStreakFreeze(c.state));
    if (ok) c.save();
    update();
    return ok;
  }, 'Saves your Daily Treat streak when you miss a day.');
  el.append(section('{snow} Consumables', fRow.el, h('div', { cls: 'row-desc' }, ...rich('Treats can also be bought with {star} in the Epic research tab.', 15))));

  function update(): void {
    const s = c.state;
    const tier = computeStats(s).vipTier;
    setRich(stars, `{star} ${formatNumber(Math.floor(s.premium.stars))} Pup Stars`, 30);

    const cur = VIP_TIERS[tier];
    const nxt = VIP_TIERS[tier + 1];
    setText(vipTitle, `${cur?.name ?? 'None'}  \u00b7  lifetime spend ${formatPrice(s.premium.spendCents)}`);
    if (nxt) {
      setHidden(vipMeter.el, false);
      const lo = cur?.minSpendCents ?? 0;
      setMeter(vipMeter, (s.premium.spendCents - lo) / Math.max(1, nxt.minSpendCents - lo));
      setText(vipMeta, `${formatPrice(Math.max(0, nxt.minSpendCents - s.premium.spendCents))} more for ${nxt.name}`);
    } else {
      setHidden(vipMeter.el, true);
      setText(vipMeta, 'Top tier reached. Thank you!');
    }
    const perks: string[] = [];
    if (cur) {
      if (cur.earningsBonus > 0) perks.push(`+${Math.round(cur.earningsBonus * 100)}% earnings`);
      if (cur.mailCapacity > 0) perks.push(`+${cur.mailCapacity} mailbox slot${cur.mailCapacity === 1 ? '' : 's'}`);
      if (cur.offlineHours > 0) perks.push(`+${cur.offlineHours}h Treat Jar`);
    }
    const nextPerks: string[] = [];
    if (nxt) {
      nextPerks.push(`+${Math.round(nxt.earningsBonus * 100)}% earnings`);
      if (nxt.mailCapacity > 0) nextPerks.push(`+${nxt.mailCapacity} mailbox`);
      if (nxt.offlineHours > 0) nextPerks.push(`+${nxt.offlineHours}h Treat Jar`);
    }
    setText(vipPerks, `Perks: ${perks.length ? perks.join(', ') : 'none yet'} (tiers replace, not stack).` + (nxt ? ` Next: ${nextPerks.join(', ')}.` : ''));

    for (const { def, row } of shopRows) {
      const lvl = s.premium.shop[def.id] ?? 0;
      const locked = tier < def.requiredTier;
      setText(row.desc, def.description);
      setRich(row.meta, locked ? `{lock} Requires ${VIP_TIERS[def.requiredTier]?.name ?? 'higher'} tier` : `Lv ${lvl}/${def.maxLevel}`);
      setClass(row.el, 'locked', locked);
      const cost = premiumCost(s, def.id);
      if (locked) setBtn(row.btn, '{lock}', false);
      else if (cost === null) setBtn(row.btn, 'MAX', false);
      else setBtn(row.btn, `{star} ${formatNumber(cost)}`, s.premium.stars >= cost);
    }

    const fr = s.daily.streakFreezes;
    setText(fRow.meta, `Owned ${fr}/${MAX_STREAK_FREEZES}`);
    setBtn(fRow.btn, fr >= MAX_STREAK_FREEZES ? 'MAX' : `{star} ${STREAK_FREEZE_COST}`, fr < MAX_STREAK_FREEZES && s.premium.stars >= STREAK_FREEZE_COST);
  }
  return { el, update };
}
