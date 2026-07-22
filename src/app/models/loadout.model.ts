/**
 * THE DATA CONTRACT
 * -----------------
 * Change from Step 2: `edited` is now a real ISO timestamp string
 * (e.g. "2026-07-21T18:30:00.000Z") instead of "2 hours ago".
 * Storage wants real data; "2 hours ago" is a DISPLAY concern,
 * handled by the TimeAgoPipe at render time.
 */
export interface Loadout {
  id: string;
  frame: string;
  name: string;
  creator: string;
  colors: string[];
  fav: boolean;
  edited: string;   // ISO timestamp — sortable, storable, honest
}

/** All frames in the game — drives the "By Warframe" grid. */
export const FRAMES: string[] = ['Ash','Atlas','Banshee','Baruuk','Caliban','Chroma','Citrine','Cyte-09','Dagath','Dante','Ember','Equinox','Excalibur','Follie','Frost','Gara','Garuda','Gauss','Grendel','Gyre','Harrow','Hildryn','Hydroid','Inaros','Ivara','Jade','Khora','Koumei','Kullervo','Lavos','Limbo','Loki','Mag','Mesa','Mirage','Nekros','Nezha','Nidus','Nokko','Nova','Nyx','Oberon','Octavia','Oraxia','Protea','Qorvex','Revenant','Rhino','Saryn','Sevagoth','Styanax','Temple','Titania','Trinity','Uriel','Valkyr','Vauban','Volt','Voruna','Wisp','Wukong','Xaku','Yareli','Zephyr'];

// DUMMY_LOADOUTS is gone. Sample data now lives in LoadoutService.seedDemo(),
// created with real timestamps at the moment you ask for it.
