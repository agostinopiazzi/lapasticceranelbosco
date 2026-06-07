// Forward migration of an imported data object to the current DATA_VERSION
// (autore-ricetta spec). Pure module: no DOM, no DB — easy to unit-test.
//
// Importing an older file should not fail just because the format evolved: we
// upgrade the parsed object first, then validate it against the current format.
// Each step is a small, explicit transformation (no AI).

import { DATA_VERSION } from './versione.js';

// Author assigned to v1 recipes that predate the mandatory `autore` field.
export const AUTORE_DEFAULT = 'Sconosciuto';

function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// v1 → v2: every recipe gains a mandatory `autore`. Recipes without one (all v1
// recipes) get AUTORE_DEFAULT; anything already present is kept.
function migraV1aV2(dati) {
  const ricette = Array.isArray(dati.ricette)
    ? dati.ricette.map((r) => {
        if (!isObject(r)) return r; // leave malformed entries for the validator
        const haAutore = typeof r.autore === 'string' && r.autore.trim() !== '';
        return haAutore ? r : { ...r, autore: AUTORE_DEFAULT };
      })
    : dati.ricette;
  return { ...dati, versione: 2, ricette };
}

// Upgrade `dati` to the current version when possible. Unknown or already-current
// versions are returned unchanged; structurally invalid input is left to the
// validator. Returns `{ dati, migrato }` where `migrato` is true if anything was
// changed, so the caller can inform the user.
export function migraDati(dati) {
  if (!isObject(dati)) return { dati, migrato: false };

  let migrato = false;
  let corrente = dati;

  if (corrente.versione === 1) {
    corrente = migraV1aV2(corrente);
    migrato = true;
  }

  // Hook point for future steps (v2 → v3, …) before reaching DATA_VERSION.

  return { dati: corrente, migrato: migrato && corrente.versione === DATA_VERSION };
}
