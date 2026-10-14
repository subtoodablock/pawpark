import type { ProductDef } from '../../core';

export type PurchaseResult = { ok: true; receiptId: string } | { ok: false; reason: string };

/** A money provider. The engine never sees this; the UI calls grantPurchase after `ok`. */
export interface PaymentProvider {
  /** true while no real money can change hands (shows the TEST MODE banner) */
  readonly testMode: boolean;
  listProducts(): Promise<ProductDef[]>;
  purchase(productId: string): Promise<PurchaseResult>;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
