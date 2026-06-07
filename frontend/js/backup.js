// Export / import all local data as a single JSON file (CLAUDE.md §5b).
// The file carries a `versione` field so older formats can be migrated later.

import { db, DATA_VERSION } from './db.js';

// Max length for the file name (without extension) before truncating, to stay
// within file-system limits.
const MAX_NOME_FILE = 100;

// Default export name: ricettario-AAAA-MM-GG.json (today's date) so successive
// backups don't overwrite each other (nome-file-export spec).
export function nomeFilePredefinito() {
  const oggi = new Date();
  const aaaa = oggi.getFullYear();
  const mm = String(oggi.getMonth() + 1).padStart(2, '0');
  const gg = String(oggi.getDate()).padStart(2, '0');
  return `ricettario-${aaaa}-${mm}-${gg}.json`;
}

// Turn whatever the user typed into a safe .json file name. Falls back to the
// default name when the input is empty or has no usable characters left.
export function normalizzaNomeFile(input) {
  let nome = (input ?? '').trim();
  if (!nome) return nomeFilePredefinito();

  // Drop a trailing .json (any case); the extension is re-added at the end.
  nome = nome.replace(/\.json$/i, '');

  // Remove characters not allowed by common file systems: / \ : * ? " < > |
  nome = nome.replace(/[/\\:*?"<>|]/g, '');
  nome = nome.trim();

  if (!nome) return nomeFilePredefinito();
  if (nome.length > MAX_NOME_FILE) nome = nome.slice(0, MAX_NOME_FILE);

  return `${nome}.json`;
}

// Build the export object and trigger a download.
// The user can choose the file name (nome-file-export spec); the default is
// pre-filled so non-technical users can simply confirm.
export async function esportaDati() {
  const [ingredienti, ricette] = await Promise.all([
    db.ingredienti.toArray(),
    db.ricette.toArray(),
  ]);

  const scelta = prompt(
    'Nome del file da scaricare:',
    nomeFilePredefinito()
  );
  if (scelta === null) return; // user cancelled the export
  const nomeFile = normalizzaNomeFile(scelta);

  const payload = { versione: DATA_VERSION, ingredienti, ricette };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
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
