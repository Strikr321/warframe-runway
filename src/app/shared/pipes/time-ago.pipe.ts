import { Pipe, PipeTransform } from '@angular/core';

/**
 * A PIPE = a tiny formatter usable inside any template:
 *   {{ l.edited | timeAgo }}   →   "2 hours ago"
 *
 * Why a pipe and not a method on each component? Formatting is a
 * display concern shared by many components — a pipe is written once
 * and imported wherever needed, and Angular caches the result until
 * the input value changes (that's what `pure` means, the default).
 */
@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
  transform(iso: string): string {
    const then = new Date(iso).getTime();
    if (isNaN(then)) return '';

    const secs = Math.floor((Date.now() - then) / 1000);
    if (secs < 60) return 'just now';

    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }
}
