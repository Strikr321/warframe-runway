import { Loadout, emptyAttachments } from '../core/models/loadout.model';
import { colorStateFromSummary } from './channels.data';

type DemoRow = [
  id: string,
  frame: string,
  name: string,
  colors: string[],
  fav: boolean,
  hoursAgo: number,
];

const ROWS: DemoRow[] = [
  ['l1', 'Volt', 'Corrupted Lightning', ['#e8641a', '#3080c8', '#a0a0a0', '#f0c050'], true, 2],
  ['l2', 'Volt', 'Prime Storm', ['#f0c050', '#0f0505', '#c8952a', '#20a0e0'], false, 24],
  ['l3', 'Excalibur', 'Void Walker', ['#5166b7', '#1e1e22', '#f0c050', '#a020e0'], true, 3],
  ['l4', 'Mesa', 'Peacemaker', ['#bb282b', '#282724', '#f0c050', '#e03010'], false, 5],
  ['l5', 'Mesa', 'Gunslinger Gold', ['#f0c050', '#7a5a18', '#e8d8c0', '#c8952a'], true, 26],
  ['l6', 'Wisp', 'Spectral Bloom', ['#54bfd2', '#3f9fb7', '#e0e020', '#a020e0'], false, 12],
  ['l7', 'Saryn', 'Toxic Elegance', ['#41c100', '#112c18', '#e0e020', '#a0a0a0'], false, 48],
  ['l8', 'Rhino', 'Iron Sovereign', ['#f0c050', '#3a0808', '#c8952a', '#e8641a'], false, 72],
  ['l9', 'Rhino', 'Palatine Frost', ['#54c9db', '#0ab6e5', '#f0c050', '#ffffff'], false, 120],
  ['l10', 'Rhino', 'Blood Iron', ['#952024', '#200d15', '#e03010', '#bb282b'], false, 168],
  ['l11', 'Nekros', 'Soul Reaper', ['#0f1221', '#461011', '#e0e020', '#a020e0'], false, 96],
];

/** Sample loadouts for the empty-state "Load Sample Loadouts" button. */
export function demoLoadouts(now = Date.now()): Loadout[] {
  return ROWS.map(([id, frame, name, colors, fav, hoursAgo]) => ({
    id,
    frame,
    name,
    creator: 'Tenno',
    fav,
    edited: new Date(now - hoursAgo * 3_600_000).toISOString(),
    attachments: emptyAttachments(),
    colorState: colorStateFromSummary(colors),
  }));
}
