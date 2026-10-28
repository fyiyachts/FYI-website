import { formatMoney } from '../api/_lib/price';

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPriceString(price: string): string {
  const num = parseFloat(price.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return price;
  return formatPrice(num);
}

export function formatLength(feet: number | string): string {
  const num = typeof feet === 'string' ? parseFloat(feet) : feet;
  if (isNaN(num)) return String(feet);
  return `${Math.round(num)}'`;
}

export function formatDate(date: string | number): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function timeAgo(date: string | number): string {
  const now = Date.now();
  const then = typeof date === 'number' ? date : new Date(date).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export function daysListed(listingDate: number): number {
  const diff = Date.now() - listingDate;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function formatDaysListed(listingDate: number): string {
  const days = daysListed(listingDate);
  if (days === 0) return 'Listed today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function parsePriceNumber(price: string): number | null {
  const num = parseFloat(price.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? null : num;
}

/**
 * A boat's asking price as shown, in its own currency ("€845,000") when the
 * record says so; otherwise its USD figure exactly as formatPrice prints it.
 */
export function formatBoatPrice(
  boat: { price?: number; listPrice?: { amount: number; currency: string } },
  fallback = 'Price on Request',
): string {
  if (boat.listPrice) return formatMoney(boat.listPrice, fallback);
  return boat.price ? formatPrice(boat.price) : fallback;
}
