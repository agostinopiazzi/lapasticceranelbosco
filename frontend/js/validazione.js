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
const CAMPI_RICETTA = ['id', 'nome', 'autore', 'porzioni_base', 'ingredienti', 'istruzioni', 'tag', 'resa', 'mise_en_place'];
// A recipe ingredient row is one of two shapes: an ingredient reference or a
// sub-recipe reference (ricette-componibili spec). Exactly one of the two id
// fields is present.
const CAMPI_RIGA_INGREDIENTE = ['ingrediente_id', 'quantita', 'unita_misura'];
const CAMPI_RIGA_SOTTORICETTA = ['ricetta_id', 'quantita', 'unita_misura'];
const CAMPI_RESA = ['quantita', 'unita_misura'];
const CAMPI_MISE_EN_PLACE = ['ingredienti', 'istruzioni'];

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

// Validate one ingredient/sub-recipe row (used both by a recipe's main list and
// by its mise en place). Pushes problems into `errori` and returns the
// `ricetta_id` referenced by the row (or null), so the caller can build the
// reference graph for cycle detection.
function validaRiga(riga, dr, errori, ctx) {
  if (!isObject(riga)) {
    errori.push(`${dr}: non è un oggetto valido.`);
    return null;
  }

  const haIng = isNonEmptyString(riga.ingrediente_id);
  const haRic = isNonEmptyString(riga.ricetta_id);

  // A row references exactly one thing: an ingredient OR another recipe.
  if (haIng && haRic) {
    errori.push(`${dr}: indica sia "ingrediente_id" sia "ricetta_id"; usane uno solo.`);
  } else if (!haIng && !haRic) {
    errori.push(`${dr}: manca il riferimento ("ingrediente_id" oppure "ricetta_id").`);
  }

  // Allowed fields depend on the row kind; when ambiguous (both/neither id) use
  // the union so we don't pile a spurious "campo non previsto" on top.
  let campiAmmessi;
  if (haIng && haRic) campiAmmessi = ['ingrediente_id', 'ricetta_id', 'quantita', 'unita_misura'];
  else if (haRic) campiAmmessi = CAMPI_RIGA_SOTTORICETTA;
  else campiAmmessi = CAMPI_RIGA_INGREDIENTE;
  verificaCampiNonPrevisti(riga, campiAmmessi, dr, errori);

  // Referential integrity.
  if (haIng && ctx.refIngVerificabili && !ctx.idIngredientiValidi.has(riga.ingrediente_id)) {
    errori.push(
      `${dr}: "ingrediente_id" ${mostra(riga.ingrediente_id)} non corrisponde a nessun ingrediente presente nel file.`
    );
  }
  let ricettaRiferita = null;
  if (haRic) {
    if (ctx.refRicVerificabili && !ctx.idRicetteValide.has(riga.ricetta_id)) {
      errori.push(
        `${dr}: "ricetta_id" ${mostra(riga.ricetta_id)} non corrisponde a nessuna ricetta presente nel file.`
      );
    }
    ricettaRiferita = riga.ricetta_id;
  }

  const q = riga.quantita;
  const quantitaOk = q === null || (typeof q === 'number' && Number.isFinite(q) && q >= 0);
  if (!quantitaOk) {
    errori.push(`${dr}: "quantita" deve essere un numero ≥ 0 oppure null (trovato ${mostra(q)}).`);
  }
  if ('unita_misura' in riga && typeof riga.unita_misura !== 'string') {
    errori.push(`${dr}: "unita_misura" deve essere testo.`);
  }

  return ricettaRiferita;
}

// Validate the mandatory `resa` (yield) object of a recipe.
function validaResa(resa, dove, errori) {
  if (!isObject(resa)) {
    errori.push(`${dove}: manca il campo "resa" (oggetto con "quantita" e "unita_misura").`);
    return;
  }
  verificaCampiNonPrevisti(resa, CAMPI_RESA, `${dove}, resa`, errori);
  const rq = resa.quantita;
  if (!(typeof rq === 'number' && Number.isFinite(rq) && rq >= 0)) {
    errori.push(`${dove}: "resa.quantita" deve essere un numero ≥ 0 (trovato ${mostra(rq)}).`);
  }
  if (!isNonEmptyString(resa.unita_misura)) {
    errori.push(`${dove}: "resa.unita_misura" mancante o vuoto.`);
  }
}

// Validate the optional `mise_en_place` (inline mini-recipe). Returns referenced
// recipe ids found in its rows, so they also count for cycle detection.
function validaMiseEnPlace(mep, dove, errori, ctx) {
  const dm = `${dove}, mise en place`;
  const riferimenti = [];
  if (!isObject(mep)) {
    errori.push(`${dm}: deve essere un oggetto con "ingredienti" e "istruzioni".`);
    return riferimenti;
  }
  verificaCampiNonPrevisti(mep, CAMPI_MISE_EN_PLACE, dm, errori);

  if (!Array.isArray(mep.ingredienti)) {
    errori.push(`${dm}: il campo "ingredienti" manca o non è un elenco.`);
  } else {
    mep.ingredienti.forEach((riga, j) => {
      const rif = validaRiga(riga, `${dm}, riga ingrediente #${j + 1}`, errori, ctx);
      if (rif) riferimenti.push(rif);
    });
  }

  if (!Array.isArray(mep.istruzioni)) {
    errori.push(`${dm}: il campo "istruzioni" manca o non è un elenco.`);
  } else {
    mep.istruzioni.forEach((passo, j) => {
      if (typeof passo !== 'string')
        errori.push(`${dm}: il passo #${j + 1} del procedimento deve essere testo.`);
    });
  }

  return riferimenti;
}

// Validate one recipe object. `ctx` carries the id sets and verifiability flags
// shared by all rows. Records the recipe's outgoing sub-recipe references into
// `grafo` (id → Set of referenced recipe ids) for cycle detection.
function validaRicetta(ric, indice, errori, idVisti, ctx, grafo) {
  const etichetta = `Ricetta #${indice + 1}`;
  if (!isObject(ric)) {
    errori.push(`${etichetta}: non è un oggetto valido.`);
    return;
  }
  const dove = isNonEmptyString(ric.nome) ? `${etichetta} ("${ric.nome}")` : etichetta;
  verificaCampiNonPrevisti(ric, CAMPI_RICETTA, dove, errori);

  let id = null;
  if (!isNonEmptyString(ric.id)) {
    errori.push(`${dove}: campo "id" mancante o vuoto.`);
  } else if (idVisti.has(ric.id)) {
    errori.push(`${dove}: "id" duplicato (${ric.id}). Ogni ricetta deve avere un id univoco.`);
  } else {
    id = ric.id;
    idVisti.add(id);
  }

  if (!isNonEmptyString(ric.nome)) errori.push(`${dove}: campo "nome" mancante o vuoto.`);
  if (!isNonEmptyString(ric.autore)) errori.push(`${dove}: campo "autore" mancante o vuoto.`);

  if (!Number.isInteger(ric.porzioni_base) || ric.porzioni_base < 1) {
    errori.push(
      `${dove}: "porzioni_base" deve essere un numero intero ≥ 1 (trovato ${mostra(ric.porzioni_base)}).`
    );
  }

  // Yield (resa): mandatory on every recipe (ricette-componibili spec).
  validaResa(ric.resa, dove, errori);

  const riferimenti = new Set();

  // Ingredient rows (ingredient or sub-recipe).
  if (!Array.isArray(ric.ingredienti)) {
    errori.push(`${dove}: il campo "ingredienti" manca o non è un elenco.`);
  } else {
    ric.ingredienti.forEach((riga, j) => {
      const rif = validaRiga(riga, `${dove}, riga ingrediente #${j + 1}`, errori, ctx);
      if (rif) riferimenti.add(rif);
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

  // Mise en place: optional inline mini-recipe.
  if (ric.mise_en_place !== undefined) {
    for (const rif of validaMiseEnPlace(ric.mise_en_place, dove, errori, ctx)) riferimenti.add(rif);
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

  if (id) grafo.set(id, riferimenti);
}

// Find a cycle in the recipe-reference graph (id → Set of referenced ids).
// Returns the list of ids forming the cycle (e.g. [A, B, A]) or null. Catches
// both self-references (A→A) and longer loops (A→B→A). Iterative DFS would also
// work; recursion is fine given the small number of recipes.
function trovaCiclo(grafo) {
  const stato = new Map(); // id → 'in-corso' | 'fatto'
  const percorso = [];
  let ciclo = null;

  function dfs(n) {
    stato.set(n, 'in-corso');
    percorso.push(n);
    for (const m of grafo.get(n) || []) {
      if (ciclo) return;
      const s = stato.get(m);
      if (s === 'in-corso') {
        const i = percorso.indexOf(m);
        ciclo = percorso.slice(i).concat(m);
        return;
      }
      if (s !== 'fatto') dfs(m);
      if (ciclo) return;
    }
    percorso.pop();
    stato.set(n, 'fatto');
  }

  for (const n of grafo.keys()) {
    if (!stato.get(n)) dfs(n);
    if (ciclo) break;
  }
  return ciclo;
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
  const idIngredientiValidi = new Set();
  const refIngVerificabili = Array.isArray(dati.ingredienti);
  if (!refIngVerificabili) {
    errori.push('Il campo "ingredienti" manca o non è un elenco (array).');
  } else {
    dati.ingredienti.forEach((ing, i) => validaIngrediente(ing, i, errori, idIngredientiValidi));
  }

  // Pre-pass over recipes: collect the set of valid recipe ids and their names,
  // needed for referential integrity of `ricetta_id` and for cycle messages.
  const refRicVerificabili = Array.isArray(dati.ricette);
  const idRicetteValide = new Set();
  const nomePerId = new Map();
  if (refRicVerificabili) {
    for (const ric of dati.ricette) {
      if (isObject(ric) && isNonEmptyString(ric.id)) {
        idRicetteValide.add(ric.id);
        nomePerId.set(ric.id, isNonEmptyString(ric.nome) ? ric.nome : ric.id);
      }
    }
  }

  const ctx = { idIngredientiValidi, idRicetteValide, refIngVerificabili, refRicVerificabili };

  // ricette
  const idVisti = new Set();
  const grafo = new Map();
  if (!refRicVerificabili) {
    errori.push('Il campo "ricette" manca o non è un elenco (array).');
  } else {
    dati.ricette.forEach((ric, i) => validaRicetta(ric, i, errori, idVisti, ctx, grafo));

    // No recursion between recipes: reject any cycle in the reference graph.
    const ciclo = trovaCiclo(grafo);
    if (ciclo) {
      const nomi = ciclo.map((id) => `«${nomePerId.get(id) || id}»`).join(' → ');
      errori.push(`Riferimento circolare tra ricette: ${nomi}. Le ricette non possono richiamarsi a vicenda.`);
    }
  }

  return errori;
}
