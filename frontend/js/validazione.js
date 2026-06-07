// Deterministic validation of an imported data file (import-validazione spec).
//
// Pure module: no DOM, no DB access. `validaFileDati` returns a list of
// human-readable error messages (Italian) so the importer can refuse a
// malformed file BEFORE touching the user's local data. Empty list = valid.
//
// No AI: every rule is an explicit structural/arithmetic check. The canonical
// data format this enforces is documented in docs/formato-file-json.md — keep
// the two in sync.

import { DATA_VERSION } from './versione.js';

// Exact set of allowed keys at each level. Any other key makes the file invalid:
// the import refuses unexpected fields (keep in sync with docs/formato-file-json.md).
const CAMPI_FILE = ['versione', 'ingredienti', 'ricette'];
const CAMPI_INGREDIENTE = ['id', 'nome', 'unita_misura', 'categoria'];
const CAMPI_RICETTA = ['id', 'nome', 'autore', 'porzioni_base', 'ingredienti', 'istruzioni', 'tag'];
const CAMPI_RIGA_INGREDIENTE = ['ingrediente_id', 'quantita', 'unita_misura'];

function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

// Render a value for an error message (quoted strings, "assente" for undefined).
function mostra(v) {
  if (v === undefined) return 'assente';
  if (typeof v === 'string') return `"${v}"`;
  return JSON.stringify(v);
}

// Push an error if `oggetto` carries keys outside `ammessi` (unexpected fields).
function verificaCampiNonPrevisti(oggetto, ammessi, dove, errori) {
  const extra = Object.keys(oggetto).filter((k) => !ammessi.includes(k));
  if (extra.length > 0) {
    errori.push(`${dove}: campo/i non previsto/i: ${extra.map((k) => `"${k}"`).join(', ')}.`);
  }
}

// Validate one ingredient object, pushing any problems into `errori` and
// returning its id (so the caller can track duplicates / referenced ids).
function validaIngrediente(ing, indice, errori, idVisti) {
  const etichetta = `Ingrediente #${indice + 1}`;
  if (!isObject(ing)) {
    errori.push(`${etichetta}: non è un oggetto valido.`);
    return null;
  }
  const dove = isNonEmptyString(ing.nome) ? `${etichetta} ("${ing.nome}")` : etichetta;
  verificaCampiNonPrevisti(ing, CAMPI_INGREDIENTE, dove, errori);

  let id = null;
  if (!isNonEmptyString(ing.id)) {
    errori.push(`${dove}: campo "id" mancante o vuoto.`);
  } else if (idVisti.has(ing.id)) {
    errori.push(`${dove}: "id" duplicato (${ing.id}). Ogni ingrediente deve avere un id univoco.`);
  } else {
    id = ing.id;
    idVisti.add(id);
  }

  if (!isNonEmptyString(ing.nome)) errori.push(`${dove}: campo "nome" mancante o vuoto.`);
  if (!isNonEmptyString(ing.unita_misura))
    errori.push(`${dove}: campo "unita_misura" mancante o vuoto (es. "g", "ml", "pz", "q.b.").`);
  if (!isNonEmptyString(ing.categoria))
    errori.push(`${dove}: campo "categoria" mancante o vuoto.`);

  return id;
}

// Validate one recipe object. `idIngredientiValidi` is the set of ingredient ids
// found in the file (for referential checks); `riferimentiVerificabili` says
// whether the ingredienti list itself was a valid array.
function validaRicetta(ric, indice, errori, idVisti, idIngredientiValidi, riferimentiVerificabili) {
  const etichetta = `Ricetta #${indice + 1}`;
  if (!isObject(ric)) {
    errori.push(`${etichetta}: non è un oggetto valido.`);
    return;
  }
  const dove = isNonEmptyString(ric.nome) ? `${etichetta} ("${ric.nome}")` : etichetta;
  verificaCampiNonPrevisti(ric, CAMPI_RICETTA, dove, errori);

  if (!isNonEmptyString(ric.id)) {
    errori.push(`${dove}: campo "id" mancante o vuoto.`);
  } else if (idVisti.has(ric.id)) {
    errori.push(`${dove}: "id" duplicato (${ric.id}). Ogni ricetta deve avere un id univoco.`);
  } else {
    idVisti.add(ric.id);
  }

  if (!isNonEmptyString(ric.nome)) errori.push(`${dove}: campo "nome" mancante o vuoto.`);
  if (!isNonEmptyString(ric.autore)) errori.push(`${dove}: campo "autore" mancante o vuoto.`);

  if (!Number.isInteger(ric.porzioni_base) || ric.porzioni_base < 1) {
    errori.push(
      `${dove}: "porzioni_base" deve essere un numero intero ≥ 1 (trovato ${mostra(ric.porzioni_base)}).`
    );
  }

  // Ingredient rows.
  if (!Array.isArray(ric.ingredienti)) {
    errori.push(`${dove}: il campo "ingredienti" manca o non è un elenco.`);
  } else {
    ric.ingredienti.forEach((riga, j) => {
      const dr = `${dove}, riga ingrediente #${j + 1}`;
      if (!isObject(riga)) {
        errori.push(`${dr}: non è un oggetto valido.`);
        return;
      }
      verificaCampiNonPrevisti(riga, CAMPI_RIGA_INGREDIENTE, dr, errori);
      if (!isNonEmptyString(riga.ingrediente_id)) {
        errori.push(`${dr}: "ingrediente_id" mancante o vuoto.`);
      } else if (riferimentiVerificabili && !idIngredientiValidi.has(riga.ingrediente_id)) {
        errori.push(
          `${dr}: "ingrediente_id" ${mostra(riga.ingrediente_id)} non corrisponde a nessun ingrediente presente nel file.`
        );
      }
      const q = riga.quantita;
      const quantitaOk = q === null || (typeof q === 'number' && Number.isFinite(q) && q >= 0);
      if (!quantitaOk) {
        errori.push(`${dr}: "quantita" deve essere un numero ≥ 0 oppure null (trovato ${mostra(q)}).`);
      }
      if ('unita_misura' in riga && typeof riga.unita_misura !== 'string') {
        errori.push(`${dr}: "unita_misura" deve essere testo.`);
      }
    });
  }

  // Instructions: array of strings (may be empty).
  if (!Array.isArray(ric.istruzioni)) {
    errori.push(`${dove}: il campo "istruzioni" manca o non è un elenco.`);
  } else {
    ric.istruzioni.forEach((passo, j) => {
      if (typeof passo !== 'string')
        errori.push(`${dove}: il passo #${j + 1} del procedimento deve essere testo.`);
    });
  }

  // Tags: optional; if present must be an array of non-empty strings.
  if (ric.tag !== undefined) {
    if (!Array.isArray(ric.tag)) {
      errori.push(`${dove}: il campo "tag" deve essere un elenco di testi.`);
    } else {
      ric.tag.forEach((t, j) => {
        if (!isNonEmptyString(t))
          errori.push(`${dove}: il tag #${j + 1} non è valido (deve essere testo non vuoto).`);
      });
    }
  }
}

// Validate the whole imported object. Returns an array of error messages;
// an empty array means the file matches the expected format.
export function validaFileDati(dati) {
  // Top level must be a plain object.
  if (!isObject(dati)) {
    return [
      'Il file non rappresenta i dati attesi: serve un oggetto JSON con i campi "versione", "ingredienti" e "ricette".',
    ];
  }

  const errori = [];

  // Reject unexpected top-level fields.
  verificaCampiNonPrevisti(dati, CAMPI_FILE, 'File', errori);

  // versione
  if (!('versione' in dati)) {
    errori.push('Manca il campo "versione".');
  } else if (dati.versione !== DATA_VERSION) {
    errori.push(`Campo "versione" non supportato: ${mostra(dati.versione)} (atteso ${DATA_VERSION}).`);
  }

  // ingredienti
  const idIngredienti = new Set();
  const riferimentiVerificabili = Array.isArray(dati.ingredienti);
  if (!riferimentiVerificabili) {
    errori.push('Il campo "ingredienti" manca o non è un elenco (array).');
  } else {
    dati.ingredienti.forEach((ing, i) => validaIngrediente(ing, i, errori, idIngredienti));
  }

  // ricette
  const idRicette = new Set();
  if (!Array.isArray(dati.ricette)) {
    errori.push('Il campo "ricette" manca o non è un elenco (array).');
  } else {
    dati.ricette.forEach((ric, i) =>
      validaRicetta(ric, i, errori, idRicette, idIngredienti, riferimentiVerificabili)
    );
  }

  return errori;
}
