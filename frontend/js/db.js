// IndexedDB layer (via Dexie.js, loaded as a global from ./vendor in index.html).
// Two object stores per CLAUDE.md §5/§5b: `ingredienti` and `ricette`.
// User data lives only here, in the browser. Nothing is sent to the server.

// `Dexie` is provided globally by the <script> tag in index.html.
export const db = new Dexie('ricettario');

db.version(1).stores({
  // Primary key `id` (string, e.g. "ing_001"); indexes for fast lookup.
  ingredienti: 'id, nome, categoria',
  // Primary key `id`; `*tag` is a multi-entry index for filtering by tag (§5b).
  ricette: 'id, nome, *tag',
});

// Data format version we read/write (matches seed.json and the export file, §5b).
// Defined in its own module so validation/migration can use it without Dexie.
export { DATA_VERSION } from './versione.js';
import { DATA_VERSION } from './versione.js';

// Fetch and validate the starter dataset (seed.json).
async function leggiSeed() {
  const res = await fetch('./data/seed.json');
  if (!res.ok) throw new Error('Impossibile caricare i dati iniziali.');
  const seed = await res.json();
  if (seed.versione !== DATA_VERSION) {
    throw new Error(
      `Versione dati non supportata: ${seed.versione} (attesa ${DATA_VERSION}).`
    );
  }
  return seed;
}

// Write the seed records into the two stores (caller decides whether to clear first).
async function scriviSeed(seed) {
  if (Array.isArray(seed.ingredienti)) await db.ingredienti.bulkAdd(seed.ingredienti);
  if (Array.isArray(seed.ricette)) await db.ricette.bulkAdd(seed.ricette);
}

// Load the starter dataset only on first launch (both stores empty), so we
// never overwrite the user's own changes on reload. See CLAUDE.md §9.4.
export async function seedIfEmpty() {
  const [nIng, nRic] = await Promise.all([
    db.ingredienti.count(),
    db.ricette.count(),
  ]);
  if (nIng > 0 || nRic > 0) return false; // already has data → do nothing

  const seed = await leggiSeed();
  await db.transaction('rw', db.ingredienti, db.ricette, async () => {
    await scriviSeed(seed);
  });
  return true;
}

// Replace ALL local data with the starter dataset (ripristina-dati-iniziali spec).
// Destructive: clears both stores, then reloads the seed, atomically.
export async function ricaricaDatiIniziali() {
  const seed = await leggiSeed();
  await db.transaction('rw', db.ingredienti, db.ricette, async () => {
    await db.ingredienti.clear();
    await db.ricette.clear();
    await scriviSeed(seed);
  });
}

// Generate ids for user-created records. Timestamp-based so they never collide
// with the seed ids (ing_001…, ric_001…).
export function nuovoIngredienteId() {
  return `ing_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

export function nuovaRicettaId() {
  return `ric_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}
