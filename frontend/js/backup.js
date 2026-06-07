// Export / import all local data as a single JSON file (CLAUDE.md §5b).
// The file carries a `versione` field so older formats can be migrated later.

import { db, DATA_VERSION } from './db.js';

// Build the export object and trigger a download.
export async function esportaDati() {
  const [ingredienti, ricette] = await Promise.all([
    db.ingredienti.toArray(),
    db.ricette.toArray(),
  ]);

  const payload = { versione: DATA_VERSION, ingredienti, ricette };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ricettario.json';
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Read a JSON file chosen by the user and replace the local data.
export async function importaDati(file, onDone) {
  let dati;
  try {
    dati = JSON.parse(await file.text());
  } catch {
    alert('Il file selezionato non è un JSON valido.');
    return;
  }

  if (typeof dati !== 'object' || dati === null) {
    alert('Formato del file non riconosciuto.');
    return;
  }
  if (dati.versione !== DATA_VERSION) {
    alert(
      `Versione del file non supportata: ${dati.versione} (attesa ${DATA_VERSION}).`
    );
    return;
  }

  const ingredienti = Array.isArray(dati.ingredienti) ? dati.ingredienti : [];
  const ricette = Array.isArray(dati.ricette) ? dati.ricette : [];

  const ok = confirm(
    `Importare ${ingredienti.length} ingredienti e ${ricette.length} ricette?\n\n` +
      'I dati attuali verranno SOSTITUITI con quelli del file.'
  );
  if (!ok) return;

  await db.transaction('rw', db.ingredienti, db.ricette, async () => {
    await db.ingredienti.clear();
    await db.ricette.clear();
    if (ingredienti.length) await db.ingredienti.bulkAdd(ingredienti);
    if (ricette.length) await db.ricette.bulkAdd(ricette);
  });

  alert('Dati importati correttamente.');
  if (onDone) onDone();
}
