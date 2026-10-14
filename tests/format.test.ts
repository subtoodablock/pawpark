import { describe, expect, it } from 'vitest';
import { formatDuration, formatMoney, formatNumber, formatRate } from '../src/core';

describe('formatNumber', () => {
  it('shows small numbers with trimmed decimals', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(5)).toBe('5');
    expect(formatNumber(0.25)).toBe('0.25');
    expect(formatNumber(12.5)).toBe('12.5');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1.999)).toBe('2');
  });
  it('uses suffixes', () => {
    expect(formatNumber(1000)).toBe('1K');
    expect(formatNumber(1234)).toBe('1.23K');
    expect(formatNumber(1.5e6)).toBe('1.5M');
    expect(formatNumber(2.5e9)).toBe('2.5B');
    expect(formatNumber(3e12)).toBe('3T');
    expect(formatNumber(4e15)).toBe('4q');
    expect(formatNumber(5e18)).toBe('5Q');
    expect(formatNumber(6e21)).toBe('6s');
    expect(formatNumber(7e24)).toBe('7S');
    expect(formatNumber(8e27)).toBe('8o');
    expect(formatNumber(9e30)).toBe('9N');
    expect(formatNumber(1e33)).toBe('1d');
    expect(formatNumber(1e36)).toBe('1U');
    expect(formatNumber(1e39)).toBe('1D');
  });
  it('rolls over at rounding boundaries', () => {
    expect(formatNumber(999.999)).toBe('1K');
    expect(formatNumber(999_999)).toBe('1M');
    expect(formatNumber(999_994)).toBe('999.99K');
  });
  it('switches to scientific beyond the suffixes', () => {
    expect(formatNumber(1.5e42)).toBe('1.5e42');
    expect(formatNumber(1e100)).toBe('1e100');
  });
  it('handles negatives, digits and non-finite', () => {
    expect(formatNumber(-1234)).toBe('-1.23K');
    expect(formatNumber(1234, 1)).toBe('1.2K');
    expect(formatNumber(1234, 0)).toBe('1K');
    expect(formatNumber(NaN)).toBe('0');
    expect(formatNumber(Infinity)).toBe('∞');
  });
});

describe('formatMoney / formatRate', () => {
  it('prefixes money', () => {
    expect(formatMoney(1.23e6)).toBe('$1.23M');
    expect(formatMoney(0)).toBe('$0');
    expect(formatMoney(-50)).toBe('-$50');
  });
  it('rate has no unit', () => {
    expect(formatRate(4500)).toBe('4.5K');
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes, hours, days', () => {
    expect(formatDuration(9)).toBe('9s');
    expect(formatDuration(9.9)).toBe('9s');
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(60)).toBe('1m 00s');
    expect(formatDuration(252)).toBe('4m 12s');
    expect(formatDuration(3900)).toBe('1h 05m');
    expect(formatDuration(36000)).toBe('10h 00m');
    expect(formatDuration(90000)).toBe('1d 01h');
  });
  it('is safe on bad input', () => {
    expect(formatDuration(-5)).toBe('0s');
    expect(formatDuration(NaN)).toBe('0s');
  });
});
