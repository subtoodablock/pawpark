import { PRODUCTS } from '../../core';
import type { ProductDef } from '../../core';
import { h } from '../dom';
import { showModal } from '../Modal';
import { formatPrice, type PaymentProvider, type PurchaseResult } from './PaymentProvider';

/** TEST MODE provider: confirm dialog, fake receipt ids, no money moves. */
export class MockProvider implements PaymentProvider {
  readonly testMode = true;

  listProducts(): Promise<ProductDef[]> {
    return Promise.resolve(PRODUCTS.slice());
  }

  purchase(productId: string): Promise<PurchaseResult> {
    const p = PRODUCTS.find((x) => x.id === productId);
    if (!p) return Promise.resolve({ ok: false, reason: 'Unknown product.' });
    return new Promise((resolve) => {
      showModal(
        'TEST MODE',
        [
          h('p', { text: `TEST MODE — no real money will be charged. Simulate buying ${p.name} for ${formatPrice(p.priceCents)}?` }),
        ],
        [
          { label: 'Cancel', onClick: () => resolve({ ok: false, reason: 'Purchase cancelled.' }) },
          {
            label: `Simulate ${formatPrice(p.priceCents)}`,
            primary: true,
            onClick: () => resolve({ ok: true, receiptId: `test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }),
          },
        ],
      );
    });
  }
}
