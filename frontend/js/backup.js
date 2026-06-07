// Export / import all local data as a single JSON file (CLAUDE.md §5b).
// The file carries a `versione` field so older formats can be migrated later.

import { db, DATA_VERSION } from './db.js';
import { validaFileDati } from './validazione.js';
import { migraDati, AUTORE_DEFAULT } from './migrazione.js';

// Max length for the file name (without extension) before truncating, to stay
// within file-system limits.
const MAX_NOME_FILE = 100;

// Default export name: <base>-AAAA-MM-GG.json (today's date) so successive
// backups don't overwrite each other (nome-file-export spec).
export function nomeFilePredefinito(base = 'ricettario') {
  const oggi = new Date();
  const aaaa = oggi.getFullYear();
  const mm = String(oggi.getMonth() + 1).padStart(2, '0');
  const gg = String(oggi.getDate()).padStart(2, '0');
  return `${base}-${aaaa}-${mm}-${gg}.json`;
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

// Ask the user for a file name (default pre-filled) and download `payload` as a
// JSON file. Returns false if the user cancels the name prompt. Shared by the
// total and partial export (export-parziale spec).
function scaricaPayload(payload, nomePredefinito) {
  const scelta = prompt('Nome del file da scaricare:', nomePredefinito);
  if (scelta === null) return false; // user cancelled the export
  const nomeFile = normalizzaNomeFile(scelta);

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
  return true;
}

// Total export: every ingredient (including ones used by no recipe) and every
// recipe. The user can choose the file name (nome-file-export spec).
export async function esportaDati() {
  const [ingredienti, ricette] = await Promise.all([
    db.ingredienti.toArray(),
    db.ricette.toArray(),
  ]);

  const payload = { versione: DATA_VERSION, ingredienti, ricette };
  scaricaPayload(payload, nomeFilePredefinito());
}

// Partial export: the user picks which recipes to export; the file then carries
// only those recipes and only the ingredients they reference (export-parziale
// spec). Selection happens in an overlay built by `selezionaRicette`.
export async function esportaParziale() {
  const ricette = await db.ricette.orderBy('nome').toArray();
  if (ricette.length === 0) {
    alert('Non ci sono ricette da esportare.');
    return;
  }

  const scelte = await selezionaRicette(ricette);
  if (!scelte || scelte.length === 0) return; // cancelled or nothing selected

  // Collect the ingredient ids referenced by the chosen recipes, then keep only
  // the ingredients that actually exist in the database.
  const idUsati = new Set();
  for (const r of scelte) {
    for (const riga of r.ingredienti || []) {
      if (riga.ingrediente_id) idUsati.add(riga.ingrediente_id);
    }
  }
  const tuttiIngredienti = await db.ingredienti.toArray();
  const ingredienti = tuttiIngredienti.filter((i) => idUsati.has(i.id));

  const payload = { versione: DATA_VERSION, ingredienti, ricette: scelte };
  scaricaPayload(payload, nomeFilePredefinito('ricettario-parziale'));
}

// Overlay that lets the user tick which recipes to export, with search and
// select-all. Resolves to the array of chosen recipe objects, or null if the
// user cancels.
function selezionaRicette(ricette) {
  return new Promise((resolve) => {
    const selezionati = new Set();

    const overlay = document.createElement('div');
    overlay.className = 'form-overlay';
    overlay.innerHTML = `
      <div class="form-box form-box-large">
        <h3>Scegli le ricette da esportare</h3>
        <input class="cerca" type="search" placeholder="Cerca per nome…" autocomplete="off">
        <div class="seleziona-tutte">
          <button type="button" class="tutte">Seleziona tutte</button>
          <button type="button" class="nessuna">Deseleziona tutte</button>
        </div>
        <div class="lista-scelta"></div>
        <div class="form-actions">
          <span class="conteggio riga-meta"></span>
          <button type="button" class="annulla">Annulla</button>
          <button type="button" class="primary esporta" disabled>Esporta selezione</button>
        </div>
      </div>
    `;

    const lista = overlay.querySelector('.lista-scelta');
    const cerca = overlay.querySelector('.cerca');
    const conteggio = overlay.querySelector('.conteggio');
    const btnEsporta = overlay.querySelector('.esporta');

    function aggiornaStato() {
      const n = selezionati.size;
      conteggio.textContent = n === 0 ? 'Nessuna selezionata' : `${n} selezionata/e`;
      btnEsporta.disabled = n === 0;
    }

    function render(filtro = '') {
      const q = filtro.trim().toLowerCase();
      const filtrate = q
        ? ricette.filter((r) => r.nome.toLowerCase().includes(q))
        : ricette;
      lista.innerHTML = '';
      if (filtrate.length === 0) {
        const p = document.createElement('p');
        p.className = 'vuoto';
        p.textContent = 'Nessuna ricetta trovata.';
        lista.append(p);
        return;
      }
      for (const r of filtrate) {
        const label = document.createElement('label');
        label.className = 'voce-checkbox';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selezionati.has(r.id);
        cb.onchange = () => {
          if (cb.checked) selezionati.add(r.id);
          else selezionati.delete(r.id);
          aggiornaStato();
        };
        const nome = document.createElement('span');
        nome.className = 'voce-nome';
        nome.textContent = r.nome;
        const meta = document.createElement('span');
        meta.className = 'riga-meta';
        meta.textContent = `${r.porzioni_base || 1} porzione/i`;
        label.append(cb, nome, meta);
        lista.append(label);
      }
    }

    cerca.oninput = () => render(cerca.value);
    overlay.querySelector('.tutte').onclick = () => {
      for (const r of ricette) selezionati.add(r.id);
      render(cerca.value);
      aggiornaStato();
    };
    overlay.querySelector('.nessuna').onclick = () => {
      selezionati.clear();
      render(cerca.value);
      aggiornaStato();
    };
    overlay.querySelector('.annulla').onclick = () => {
      overlay.remove();
      resolve(null);
    };
    btnEsporta.onclick = () => {
      overlay.remove();
      resolve(ricette.filter((r) => selezionati.has(r.id)));
    };

    render();
    aggiornaStato();
    document.body.append(overlay);
    cerca.focus();
  });
}

// How many validation problems to list in the alert before summarising the rest.
const MAX_ERRORI_MOSTRATI = 12;

// Read a JSON file chosen by the user, validate it against the expected format
// (import-validazione spec), and only then replace the local data. The user's
// data is never touched unless the file is fully valid.
export async function importaDati(file, onDone) {
  let dati;
  try {
    dati = JSON.parse(await file.text());
  } catch {
    alert(
      'Il file selezionato non è un file JSON valido. ' +
        'Scegli un file .json esportato da questa app.'
    );
    return;
  }

  // Upgrade older files to the current format before validating (e.g. v1 files
  // predate the mandatory recipe author).
  const { dati: datiMigrati, migrato } = migraDati(dati);

  // Structural validation: refuse a malformed file before clearing anything.
  const errori = validaFileDati(datiMigrati);
  if (errori.length > 0) {
    const elenco = errori
      .slice(0, MAX_ERRORI_MOSTRATI)
      .map((e) => `• ${e}`)
      .join('\n');
    const extra =
      errori.length > MAX_ERRORI_MOSTRATI
        ? `\n…e altri ${errori.length - MAX_ERRORI_MOSTRATI} problema/i.`
        : '';
    alert(
      `Impossibile importare il file: trovati ${errori.length} problema/i.\n` +
        'I tuoi dati attuali NON sono stati modificati.\n\n' +
        elenco +
        extra
    );
    return;
  }

  // From here on the file is valid: these are guaranteed arrays.
  const { ingredienti, ricette } = datiMigrati;

  const avvisoMigrazione = migrato
    ? '\n\nIl file è in un formato precedente: alle ricette senza autore verrà ' +
      `assegnato "${AUTORE_DEFAULT}".`
    : '';
  const ok = confirm(
    `Importare ${ingredienti.length} ingredienti e ${ricette.length} ricette?\n\n` +
      'I dati attuali verranno SOSTITUITI con quelli del file.' +
      avvisoMigrazione
  );
  if (!ok) return;

  try {
    await db.transaction('rw', db.ingredienti, db.ricette, async () => {
      await db.ingredienti.clear();
      await db.ricette.clear();
      if (ingredienti.length) await db.ingredienti.bulkAdd(ingredienti);
      if (ricette.length) await db.ricette.bulkAdd(ricette);
    });
  } catch {
    // The transaction is atomic: on error nothing is committed, so the previous
    // data stays intact. We just inform the user.
    alert(
      'Importazione non riuscita per un errore imprevisto durante il salvataggio. ' +
        'I tuoi dati attuali non sono stati modificati.'
    );
    return;
  }

  alert('Dati importati correttamente.');
  if (onDone) onDone();
}
