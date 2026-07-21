/**
 * THE DATA CONTRACT
 * -----------------
 * A TypeScript interface describes the SHAPE of our data.
 * Every component that touches a loadout imports this, so if the
 * shape ever changes, the compiler points at every spot to fix.
 * (In Step 6 this same shape becomes a Java entity + JSON.)
 */
export interface Loadout {
  id: string;
  frame: string;      // which Warframe this loadout belongs to
  name: string;       // e.g. "Corrupted Lightning"
  creator: string;
  colors: string[];   // hex colors shown as dots
  fav: boolean;
  edited: string;     // human string for now; becomes a real Date later
}

/** All frames in the game — drives the "By Warframe" grid. */
export const FRAMES: string[] = ['Ash','Atlas','Banshee','Baruuk','Caliban','Chroma','Citrine','Cyte-09','Dagath','Dante','Ember','Equinox','Excalibur','Follie','Frost','Gara','Garuda','Gauss','Grendel','Gyre','Harrow','Hildryn','Hydroid','Inaros','Ivara','Jade','Khora','Koumei','Kullervo','Lavos','Limbo','Loki','Mag','Mesa','Mirage','Nekros','Nezha','Nidus','Nokko','Nova','Nyx','Oberon','Octavia','Oraxia','Protea','Qorvex','Revenant','Rhino','Saryn','Sevagoth','Styanax','Temple','Titania','Trinity','Uriel','Valkyr','Vauban','Volt','Voruna','Wisp','Wukong','Xaku','Yareli','Zephyr'];

/**
 * DUMMY DATA — dies in Step 3 when LoadoutService + localStorage arrive.
 * Flat array (not grouped by frame) because grouping is a VIEW concern;
 * the page computes groups when it needs them.
 */
export const DUMMY_LOADOUTS: Loadout[] = [
  { id: 'l1', frame: 'Volt',      name: 'Corrupted Lightning', creator: 'Tenno', colors: ['#e8641a','#3080c8','#a0a0a0','#f0c050'], fav: true,  edited: '2 hours ago' },
  { id: 'l2', frame: 'Volt',      name: 'Prime Storm',         creator: 'Tenno', colors: ['#f0c050','#0f0505','#c8952a','#20a0e0'], fav: false, edited: '1 day ago' },
  { id: 'l3', frame: 'Excalibur', name: 'Void Walker',         creator: 'Tenno', colors: ['#5166b7','#1e1e22','#f0c050','#a020e0'], fav: true,  edited: '3 hours ago' },
  { id: 'l4', frame: 'Mesa',      name: 'Peacemaker',          creator: 'Tenno', colors: ['#bb282b','#282724','#f0c050','#e03010'], fav: false, edited: '5 hours ago' },
  { id: 'l5', frame: 'Mesa',      name: 'Gunslinger Gold',     creator: 'Tenno', colors: ['#f0c050','#7a5a18','#e8d8c0','#c8952a'], fav: true,  edited: '1 day ago' },
  { id: 'l6', frame: 'Wisp',      name: 'Spectral Bloom',      creator: 'Tenno', colors: ['#54bfd2','#3f9fb7','#e0e020','#a020e0'], fav: false, edited: '12 hours ago' },
  { id: 'l7', frame: 'Saryn',     name: 'Toxic Elegance',      creator: 'Tenno', colors: ['#41c100','#112c18','#e0e020','#a0a0a0'], fav: false, edited: '2 days ago' },
  { id: 'l8', frame: 'Rhino',     name: 'Iron Sovereign',      creator: 'Tenno', colors: ['#f0c050','#3a0808','#c8952a','#e8641a'], fav: false, edited: '3 days ago' },
  { id: 'l9', frame: 'Rhino',     name: 'Palatine Frost',      creator: 'Tenno', colors: ['#54c9db','#0ab6e5','#f0c050','#ffffff'], fav: false, edited: '5 days ago' },
  { id: 'l10', frame: 'Rhino',    name: 'Blood Iron',          creator: 'Tenno', colors: ['#952024','#200d15','#e03010','#bb282b'], fav: false, edited: '1 week ago' },
  { id: 'l11', frame: 'Nekros',   name: 'Soul Reaper',         creator: 'Tenno', colors: ['#0f1221','#461011','#e0e020','#a020e0'], fav: false, edited: '4 days ago' },
];
