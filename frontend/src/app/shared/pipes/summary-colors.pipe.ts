import { Pipe, PipeTransform } from '@angular/core';
import { Loadout } from '../../core/models/loadout.model';
import { summaryColors } from '../../data/channels.data';

/** `@for (c of loadout | summaryColors; ...)`: the 4 card color dots. */
@Pipe({ name: 'summaryColors' })
export class SummaryColorsPipe implements PipeTransform {
  transform(loadout: Loadout): string[] {
    return summaryColors(loadout.colorState);
  }
}
