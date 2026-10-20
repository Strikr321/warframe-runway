import { Pipe, PipeTransform } from '@angular/core';

/** `{{ iso | timeAgo }}` → "2 hours ago". */
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
