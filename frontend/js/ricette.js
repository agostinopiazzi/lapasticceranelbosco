// CRUD + UI for recipes (CLAUDE.md §5). User-facing texts in Italian.

import { db, nuovaRicettaId } from './db.js';
import { scalaQuantita, calcolaResaPredefinita } from './calcoli.js';
import { unitaConValore } from './unita.js';

let filtroTag = ''; // '' = tutti
let filtroAutore = ''; // '' = tutti
let ricercaTesto = ''; // free-text search over name + contents

// All rows of a recipe where ingredient/sub-recipe references live (main list +
// mise en place). Shared by search, cycle checks and delete protection.
function righeDiRicetta(r) {
  return [
    ...(Array.isArray(r.ingredienti) ? r.ingredienti : []),
    ...(r && r.mise_en_place && Array.isArray(r.mise_en_place.ingredienti)
      ? r.mise_en_place.ingredienti
      : []),
  ];
}

// Read the rows of a form container into data objects, branching on the row kind
// (ingredient vs sub-recipe). Skips rows with no selection.
function leggiRighe(container) {
  return [...container.querySelectorAll('.riga-form')]
    .map((row) => {
      const sel = row.querySelector('select');
      const id = sel ? sel.value : '';
      if (!id) return null;
      const qRaw = row.querySelector('.qta').value;
      const um = row.querySelector('.um').value.trim();
      const quantita = qRaw === '' ? null : Number(qRaw);
      if (row.classList.contains('riga-componente')) {
        return { ricetta_id: id, quantita, unita_misura: um };
      }
      return { ingrediente_id: id, quantita, unita_misura: um };
    })
    .filter(Boolean);
}

// Recipes that may NOT be used as a component of recipe `idCorrente`, because
// doing so would create a cycle: `idCorrente` itself plus every recipe that
// (transitively) already uses it. A new recipe (no id) forbids nothing.
function ricetteVietate(idCorrente, tutte) {
  const vietate = new Set();
  if (!idCorrente) return vietate;
  vietate.add(idCorrente);

  // Reverse adjacency: usatoDa.get(X) = recipes that directly use X.
  const usatoDa = new Map();
  for (const r of tutte) {
    for (const riga of righeDiRicetta(r)) {
      if (riga.ricetta_id) {
        if (!usatoDa.has(riga.ricetta_id)) usatoDa.set(riga.ricetta_id, new Set());
        usatoDa.get(riga.ricetta_id).add(r.id);
      }
    }
  }

  const coda = [idCorrente];
  while (coda.length) {
    const x = coda.pop();
    for (const chi of usatoDa.get(x) || []) {
      if (!vietate.has(chi)) {
        vietate.add(chi);
        coda.push(chi);
      }
    }
  }
  return vietate;
}

// Render the whole "Ricette" section into `container`.
export async function renderRicette(container) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'section-header';
  const title = document.createElement('h2');
  title.textContent = 'Ricette';
  const addBtn = document.createElement('button');
  addBtn.textContent = '+ Nuova ricetta';
  addBtn.className = 'primary';
  addBtn.onclick = () => nuovaRicetta(container);
  header.append(title, addBtn);

  const filtro = document.createElement('div');
  filtro.className = 'filtro';

  // Free-text search over name and contents (re-renders only the list, so the
  // input keeps focus while typing).
  const cerca = document.createElement('input');
  cerca.type = 'search';
  cerca.className = 'cerca';
  cerca.placeholder = 'Cerca per nome o contenuto…';
  cerca.autocomplete = 'off';
  cerca.value = ricercaTesto;

  // Re-render the list and refresh the "clear filters" button state after any
  // filter change (renderLista alone doesn't touch the button).
  const applica = async () => {
    btnClear.disabled = !(ricercaTesto || filtroTag || filtroAutore);
    await renderLista(list, container);
  };

  cerca.oninput = async () => {
    ricercaTesto = cerca.value;
    await applica();
  };

  // Tag + author dropdowns.
  const [tags, autori] = await Promise.all([tuttiITag(), tuttiGliAutori()]);

  const selTags = document.createElement('div');
  selTags.className = 'filtri-select';

  const labTag = document.createElement('label');
  labTag.textContent = 'Tag: ';
  const selTag = document.createElement('select');
  selTag.innerHTML =
    `<option value="">Tutti</option>` +
    tags.map((t) => `<option value="${escapeText(t)}">${escapeText(t)}</option>`).join('');
  selTag.value = filtroTag;
  selTag.onchange = async () => {
    filtroTag = selTag.value;
    await applica();
  };
  labTag.append(selTag);

  const labAutore = document.createElement('label');
  labAutore.textContent = 'Autore: ';
  const selAutore = document.createElement('select');
  selAutore.innerHTML =
    `<option value="">Tutti</option>` +
    autori.map((a) => `<option value="${escapeText(a)}">${escapeText(a)}</option>`).join('');
  selAutore.value = filtroAutore;
  selAutore.onchange = async () => {
    filtroAutore = selAutore.value;
    await applica();
  };
  labAutore.append(selAutore);

  // Clear all filters at once; disabled when nothing is active.
  const btnClear = document.createElement('button');
  btnClear.type = 'button';
  btnClear.className = 'cancella-filtri';
  btnClear.textContent = 'Cancella filtri';
  btnClear.disabled = !(ricercaTesto || filtroTag || filtroAutore);
  btnClear.onclick = async () => {
    ricercaTesto = '';
    filtroTag = '';
    filtroAutore = '';
    await renderRicette(container);
  };

  selTags.append(labTag, labAutore, btnClear);
  filtro.append(cerca, selTags);

  const list = document.createElement('div');
  list.className = 'lista';

  container.append(header, filtro, list);
  await renderLista(list, container);
}

// Distinct sorted list of all tags across recipes.
async function tuttiITag() {
  const all = await db.ricette.toArray();
  const set = new Set();
  for (const r of all) for (const t of r.tag || []) set.add(t);
  return [...set].sort();
}

// Distinct sorted list of all authors across recipes (skips empty ones).
async function tuttiGliAutori() {
  const all = await db.ricette.toArray();
  const set = new Set();
  for (const r of all) if (r.autore) set.add(r.autore);
  return [...set].sort();
}

// Lowercased searchable text for a recipe: name + author + tags + instructions
// + the names of its ingredients/sub-recipes (resolved via the maps), including
// the mise en place.
function testoRicercabile(r, ingMap, ricMap) {
  const parti = [r.nome || '', r.autore || ''];
  for (const t of r.tag || []) parti.push(t);
  for (const passo of r.istruzioni || []) parti.push(passo);
  const aggiungiRighe = (righe) => {
    for (const riga of righe || []) {
      if (riga.ricetta_id) {
        const sub = ricMap.get(riga.ricetta_id);
        if (sub && sub.nome) parti.push(sub.nome);
      } else {
        const ing = ingMap.get(riga.ingrediente_id);
        if (ing && ing.nome) parti.push(ing.nome);
      }
    }
  };
  aggiungiRighe(r.ingredienti);
  if (r.mise_en_place) {
    aggiungiRighe(r.mise_en_place.ingredienti);
    for (const passo of r.mise_en_place.istruzioni || []) parti.push(passo);
  }
  return parti.join(' ').toLowerCase();
}

// Render a list of rows (ingredient or sub-recipe) into a <ul>. Sub-recipe rows
// are shown distinctly and are clickable (open a read-only view). Missing
// references are flagged. Shared by the card and the read-only view.
function appendRigheLi(ul, righe, ingMap, ricMap) {
  for (const riga of righe || []) {
    const li = document.createElement('li');
    const q = riga.quantita == null ? '' : `${riga.quantita} `;
    const um = riga.unita_misura || '';
    if (riga.ricetta_id) {
      const sub = ricMap.get(riga.ricetta_id);
      if (sub) {
        li.className = 'riga-componente';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'link-componente';
        btn.textContent = sub.nome;
        btn.onclick = () => mostraRicettaSolaLettura(sub, ingMap, ricMap);
        const meta = document.createElement('span');
        meta.textContent = ` (componente): ${q}${um}`.replace(/\s+$/, '');
        li.append(btn, meta);
      } else {
        li.className = 'mancante';
        li.textContent = `⚠ ricetta componente mancante: ${q}${um}`.trim();
      }
    } else {
      const ing = ingMap.get(riga.ingrediente_id);
      const nomeIng = ing ? ing.nome : '⚠ ingrediente mancante';
      li.textContent = `${nomeIng}: ${q}${um}`.trim();
      if (!ing) li.className = 'mancante';
    }
    ul.append(li);
  }
}

// Append a "Mise en place" block (ingredients + steps) to `target`, if present
// and non-empty. Shared by the card and the read-only view.
function appendMiseEnPlace(target, ric, ingMap, ricMap) {
  const mep = ric.mise_en_place;
  if (!mep) return;
  const haIng = (mep.ingredienti || []).length > 0;
  const haIstr = (mep.istruzioni || []).length > 0;
  if (!haIng && !haIstr) return;

  const titolo = document.createElement('p');
  titolo.className = 'mep-titolo';
  titolo.textContent = 'Mise en place';
  target.append(titolo);

  if (haIng) {
    const ul = document.createElement('ul');
    ul.className = 'ingredienti-list';
    appendRigheLi(ul, mep.ingredienti, ingMap, ricMap);
    target.append(ul);
  }
  if (haIstr) {
    const ol = document.createElement('ol');
    ol.className = 'istruzioni-list';
    for (const step of mep.istruzioni) {
      const li = document.createElement('li');
      li.textContent = step;
      ol.append(li);
    }
    target.append(ol);
  }
}

// Read-only popup showing a recipe (used when clicking a sub-recipe component).
// Components inside it are clickable too (re-opens the same view).
function mostraRicettaSolaLettura(ric, ingMap, ricMap) {
  const overlay = document.createElement('div');
  overlay.className = 'form-overlay';
  const box = document.createElement('div');
  box.className = 'form-box form-box-large';

  const h = document.createElement('h3');
  h.textContent = ric.nome;
  box.append(h);

  const meta = document.createElement('p');
  meta.className = 'riga-meta';
  meta.textContent =
    `Autore: ${ric.autore || 'non indicato'} · ${ric.porzioni_base || 1} porzione/i` +
    (ric.resa ? ` · Resa: ${ric.resa.quantita} ${ric.resa.unita_misura}` : '');
  box.append(meta);

  appendMiseEnPlace(box, ric, ingMap, ricMap);

  if ((ric.ingredienti || []).length) {
    const ul = document.createElement('ul');
    ul.className = 'ingredienti-list';
    appendRigheLi(ul, ric.ingredienti, ingMap, ricMap);
    box.append(ul);
  }
  if ((ric.istruzioni || []).length) {
    const ol = document.createElement('ol');
    ol.className = 'istruzioni-list';
    for (const step of ric.istruzioni) {
      const li = document.createElement('li');
      li.textContent = step;
      ol.append(li);
    }
    box.append(ol);
  }

  const azioni = document.createElement('div');
  azioni.className = 'form-actions';
  const chiudi = document.createElement('button');
  chiudi.type = 'button';
  chiudi.className = 'primary';
  chiudi.textContent = 'Chiudi';
  chiudi.onclick = () => overlay.remove();
  azioni.append(chiudi);
  box.append(azioni);

  overlay.append(box);
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  document.body.append(overlay);
}

async function renderLista(list, container) {
  list.innerHTML = '';

  const tutte = await db.ricette.orderBy('nome').toArray();

  if (tutte.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'vuoto';
    empty.textContent = 'Nessuna ricetta. Aggiungine una con "+ Nuova ricetta".';
    list.append(empty);
    return;
  }

  // Resolve ingredient and recipe names (used for display and for content search).
  const ingMap = new Map((await db.ingredienti.toArray()).map((i) => [i.id, i]));
  const ricMap = new Map(tutte.map((r) => [r.id, r]));

  // Apply tag + author + text filters together (AND).
  const q = ricercaTesto.trim().toLowerCase();
  const ricette = tutte.filter((r) => {
    if (filtroTag && !(r.tag || []).includes(filtroTag)) return false;
    if (filtroAutore && r.autore !== filtroAutore) return false;
    if (q && !testoRicercabile(r, ingMap, ricMap).includes(q)) return false;
    return true;
  });

  if (ricette.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'vuoto';
    empty.textContent = 'Nessuna ricetta corrisponde ai filtri.';
    list.append(empty);
    return;
  }

  for (const r of ricette) {
    const card = document.createElement('div');
    card.className = 'card';

    const top = document.createElement('div');
    top.className = 'card-top';
    const nome = document.createElement('h3');
    nome.textContent = r.nome;
    const meta = document.createElement('span');
    meta.className = 'riga-meta';
    const resaTxt = r.resa ? ` · Resa: ${r.resa.quantita} ${r.resa.unita_misura}` : '';
    meta.textContent = `${r.porzioni_base || 1} porzione/i${resaTxt}`;
    top.append(nome, meta);

    // Author line, always visible. Older recipes saved before the `autore`
    // field show a clear fallback.
    const autoreEl = document.createElement('p');
    autoreEl.className = 'ricetta-autore';
    const autoreLab = document.createElement('span');
    autoreLab.className = 'etichetta';
    autoreLab.textContent = 'Autore: ';
    const autoreVal = document.createElement('span');
    if (r.autore) {
      autoreVal.textContent = r.autore;
    } else {
      autoreVal.textContent = 'non indicato';
      autoreVal.className = 'autore-mancante';
    }
    autoreEl.append(autoreLab, autoreVal);

    const tags = document.createElement('div');
    tags.className = 'tags';
    for (const t of r.tag || []) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = t;
      tags.append(chip);
    }

    const dettagli = document.createElement('details');
    const sum = document.createElement('summary');
    sum.textContent = 'Ingredienti e procedimento';
    dettagli.append(sum);

    // Mise en place first (it's the preliminary preparation).
    appendMiseEnPlace(dettagli, r, ingMap, ricMap);

    const ul = document.createElement('ul');
    ul.className = 'ingredienti-list';
    appendRigheLi(ul, r.ingredienti, ingMap, ricMap);
    dettagli.append(ul);

    if ((r.istruzioni || []).length) {
      const ol = document.createElement('ol');
      ol.className = 'istruzioni-list';
      for (const step of r.istruzioni) {
        const li = document.createElement('li');
        li.textContent = step;
        ol.append(li);
      }
      dettagli.append(ol);
    }

    const azioni = document.createElement('div');
    azioni.className = 'azioni';
    const edit = document.createElement('button');
    edit.textContent = 'Modifica';
    edit.onclick = () => openForm(container, { ric: r });
    const del = document.createElement('button');
    del.textContent = 'Elimina';
    del.className = 'danger';
    del.onclick = () => eliminaRicetta(r, container);
    azioni.append(edit, del);

    card.append(top, autoreEl, tags, dettagli, azioni);
    list.append(card);
  }
}

// Step 1 of "Nuova ricetta": ask whether to start from scratch or from an
// existing recipe used as a base (spec: crea-da-ricetta-esistente).
async function nuovaRicetta(container) {
  const conRicette = (await db.ricette.count()) > 0;

  const overlay = document.createElement('div');
  overlay.className = 'form-overlay';
  overlay.innerHTML = `
    <div class="form-box">
      <h3>Nuova ricetta</h3>
      <p class="scelta-intro">Come vuoi iniziare?</p>
      <div class="scelte">
        <button type="button" class="scelta-grande primary scelta-zero">Parti da zero</button>
        <button type="button" class="scelta-grande scelta-esistente" ${
          conRicette ? '' : 'disabled'
        }>Parti da una ricetta esistente</button>
      </div>
      ${
        conRicette
          ? ''
          : '<p class="vuoto">Non ci sono ancora ricette da cui partire.</p>'
      }
      <div class="form-actions">
        <button type="button" class="annulla">Annulla</button>
      </div>
    </div>
  `;

  overlay.querySelector('.annulla').onclick = () => overlay.remove();
  overlay.querySelector('.scelta-zero').onclick = () => {
    overlay.remove();
    openForm(container);
  };
  const btnEsistente = overlay.querySelector('.scelta-esistente');
  if (conRicette) {
    btnEsistente.onclick = () => {
      overlay.remove();
      selezionaBase(container);
    };
  }

  document.body.append(overlay);
}

// Step 2: pick the recipe to copy, with a name search box.
async function selezionaBase(container) {
  const ricette = await db.ricette.orderBy('nome').toArray();

  const overlay = document.createElement('div');
  overlay.className = 'form-overlay';
  overlay.innerHTML = `
    <div class="form-box">
      <h3>Scegli la ricetta da copiare</h3>
      <input class="cerca" type="search" placeholder="Cerca per nome…" autocomplete="off">
      <div class="lista-scelta"></div>
      <div class="form-actions">
        <button type="button" class="annulla">Annulla</button>
      </div>
    </div>
  `;

  const lista = overlay.querySelector('.lista-scelta');
  const cerca = overlay.querySelector('.cerca');

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
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'voce-scelta';
      btn.innerHTML = `<span class="voce-nome"></span><span class="riga-meta">${
        r.porzioni_base || 1
      } porzione/i</span>`;
      btn.querySelector('.voce-nome').textContent = r.nome;
      btn.onclick = () => {
        overlay.remove();
        openForm(container, { base: r });
      };
      lista.append(btn);
    }
  }

  cerca.oninput = () => render(cerca.value);
  overlay.querySelector('.annulla').onclick = () => overlay.remove();

  render();
  document.body.append(overlay);
  cerca.focus();
}

// Open the recipe form.
//   opts.ric  → edit an existing recipe (updates it on save)
//   opts.base → create a new recipe pre-filled from `base` (copy), recalculating
//               quantities and yield if the portions change (spec)
//   neither   → blank new recipe
async function openForm(container, opts = {}) {
  const { ric, base } = opts;
  const isEdit = !!ric;
  const isCopia = !!base;
  const prefill = ric || base; // source of pre-filled values
  const [ingredienti, ricette] = await Promise.all([
    db.ingredienti.orderBy('nome').toArray(),
    db.ricette.orderBy('nome').toArray(),
  ]);

  // Recipes selectable as components: all except those that would form a cycle
  // with the recipe being edited (none excluded for a brand-new recipe). When
  // opened via quick-create, `vietateExtra` carries the originating recipe's
  // chain so the new recipe can't reference it either (no cycles).
  const vietate = ricetteVietate(isEdit ? ric.id : null, ricette);
  if (opts.vietateExtra) for (const id of opts.vietateExtra) vietate.add(id);
  const selezionabili = ricette.filter((r) => !vietate.has(r.id));
  const senzaComponenti = selezionabili.length === 0;

  const form = document.createElement('form');
  form.className = 'form-overlay';
  form.innerHTML = `
    <div class="form-box form-box-large">
      <h3>${
        isEdit
          ? 'Modifica ricetta'
          : isCopia
            ? 'Nuova ricetta (da copia)'
            : opts.onCreated
              ? 'Nuova ricetta da aggiungere come componente'
              : 'Nuova ricetta'
      }</h3>
      <label>Nome
        <input name="nome" required>
      </label>
      <label>Autore
        <input name="autore" required>
      </label>
      <label>Porzioni base
        <input name="porzioni_base" type="number" min="1" step="1" value="1">
      </label>
      <label>Resa (quanto produce la ricetta)</label>
      <div class="resa-campo">
        <input name="resa_quantita" type="number" min="0" step="any" class="resa-q" placeholder="q.tà">
        <select name="resa_unita" class="resa-u"></select>
        <button type="button" class="ricalcola-resa" title="Imposta la resa alla somma delle quantità">↻ ricalcola</button>
      </div>

      <fieldset>
        <legend>Ingredienti</legend>
        <div class="righe-ingredienti"></div>
        <div class="aggiungi-righe">
          <button type="button" class="aggiungi-ingrediente">+ Aggiungi ingrediente</button>
          <button type="button" class="aggiungi-componente" ${senzaComponenti ? 'disabled' : ''}>+ Aggiungi ricetta (componente)</button>
          <button type="button" class="crea-componente">➕ Crea nuova ricetta e aggiungila</button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Procedimento (un passo per riga)</legend>
        <div class="righe-istruzioni"></div>
        <button type="button" class="aggiungi-istruzione">+ Aggiungi passo</button>
      </fieldset>

      <fieldset>
        <legend>Mise en place — preparazione preliminare (facoltativa)</legend>
        <div class="mep-righe-ingredienti"></div>
        <div class="aggiungi-righe">
          <button type="button" class="mep-aggiungi-ingrediente">+ Aggiungi ingrediente</button>
          <button type="button" class="mep-aggiungi-componente" ${senzaComponenti ? 'disabled' : ''}>+ Aggiungi ricetta (componente)</button>
          <button type="button" class="mep-crea-componente">➕ Crea nuova ricetta e aggiungila</button>
        </div>
        <div class="mep-righe-istruzioni"></div>
        <button type="button" class="mep-aggiungi-istruzione">+ Aggiungi passo</button>
      </fieldset>

      <label>Tag (separati da virgola)
        <input name="tag" placeholder="es. dolce, lievitati">
      </label>

      <div class="form-actions">
        <button type="button" class="annulla">Annulla</button>
        <button type="submit" class="primary">Salva</button>
      </div>
    </div>
  `;

  const righeIng = form.querySelector('.righe-ingredienti');
  const righeIstr = form.querySelector('.righe-istruzioni');
  const righeMep = form.querySelector('.mep-righe-ingredienti');
  const righeMepIstr = form.querySelector('.mep-righe-istruzioni');
  const resaQ = form.querySelector('[name=resa_quantita]');
  const resaU = form.querySelector('[name=resa_unita]');

  // Yield (resa) follows the running sum of the MAIN ingredient rows until the
  // user edits it by hand (then `resaAuto` is false and we leave it alone).
  let resaAuto = true;
  // Fill the resa unit dropdown so it always contains `valore` (even a custom or
  // legacy unit not in the proposed list), then select it.
  function setResaUnita(valore) {
    const v = (valore || '').trim();
    resaU.innerHTML = '';
    for (const u of unitaConValore(v)) {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      resaU.append(opt);
    }
    resaU.value = v || 'g';
  }
  function aggiornaResaAuto() {
    if (!resaAuto) return;
    const r = calcolaResaPredefinita(leggiRighe(righeIng));
    resaQ.value = r.quantita;
    setResaUnita(r.unita_misura);
  }
  resaQ.addEventListener('input', () => {
    resaAuto = false;
  });
  resaU.addEventListener('change', () => {
    resaAuto = false;
  });
  form.querySelector('.ricalcola-resa').onclick = () => {
    resaAuto = true;
    aggiornaResaAuto();
  };

  // Build one ingredient row (select + quantità + unità + remove). `onChange` is
  // called when the row changes (used to keep the auto resa in sync).
  function rigaIngrediente(valore = {}, onChange) {
    const row = document.createElement('div');
    row.className = 'riga-form';
    const sel = document.createElement('select');
    sel.innerHTML =
      `<option value="">— scegli ingrediente —</option>` +
      ingredienti.map((i) => `<option value="${i.id}">${escapeText(i.nome)}</option>`).join('');
    sel.value = valore.ingrediente_id || '';

    const q = document.createElement('input');
    q.type = 'number';
    q.step = 'any';
    q.placeholder = 'q.tà';
    q.className = 'qta';
    if (valore.quantita != null) q.value = valore.quantita;
    // Remember the base quantity so the copy flow can rescale on portion change.
    if (valore.quantita != null) q.dataset.base = valore.quantita;

    const um = document.createElement('input');
    um.placeholder = 'unità';
    um.className = 'um';
    um.readOnly = true; // forced to the ingredient's unit, not editable by hand

    // The unit always matches the chosen ingredient's unit of measure.
    const aggiornaUnita = () => {
      const ing = ingredienti.find((i) => i.id === sel.value);
      um.value = ing ? ing.unita_misura || '' : '';
    };

    sel.onchange = () => {
      aggiornaUnita();
      if (onChange) onChange();
    };
    q.addEventListener('input', () => onChange && onChange());
    aggiornaUnita(); // set the unit from the (possibly pre-filled) selection

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.textContent = '✕';
    rm.className = 'rimuovi';
    rm.onclick = () => {
      row.remove();
      if (onChange) onChange();
    };

    row.append(sel, q, um, rm);
    return row;
  }

  // Build one sub-recipe (component) row. Same shape as an ingredient row but the
  // select lists recipes and the row is tagged `riga-componente`.
  function rigaSottoRicetta(valore = {}, onChange) {
    const row = document.createElement('div');
    row.className = 'riga-form riga-componente';

    const tag = document.createElement('span');
    tag.className = 'tag-componente';
    tag.textContent = 'ricetta';

    const sel = document.createElement('select');
    sel.innerHTML =
      `<option value="">— scegli ricetta —</option>` +
      selezionabili.map((r) => `<option value="${r.id}">${escapeText(r.nome)}</option>`).join('');
    sel.value = valore.ricetta_id || '';

    const q = document.createElement('input');
    q.type = 'number';
    q.step = 'any';
    q.placeholder = 'q.tà';
    q.className = 'qta';
    if (valore.quantita != null) q.value = valore.quantita;
    if (valore.quantita != null) q.dataset.base = valore.quantita;

    const um = document.createElement('input');
    um.placeholder = 'unità';
    um.className = 'um';
    um.readOnly = true; // forced to the recipe's yield unit, not editable by hand

    // The unit always matches the chosen recipe's yield (resa) unit of measure.
    const aggiornaUnita = () => {
      const r = ricette.find((x) => x.id === sel.value);
      um.value = r && r.resa ? r.resa.unita_misura || '' : '';
    };

    sel.onchange = () => {
      aggiornaUnita();
      if (onChange) onChange();
    };
    q.addEventListener('input', () => onChange && onChange());
    aggiornaUnita(); // set the unit from the (possibly pre-filled) selection

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.textContent = '✕';
    rm.className = 'rimuovi';
    rm.onclick = () => {
      row.remove();
      if (onChange) onChange();
    };

    row.append(tag, sel, q, um, rm);
    return row;
  }

  function rigaIstruzione(testo = '') {
    const row = document.createElement('div');
    row.className = 'riga-form';
    const input = document.createElement('input');
    input.className = 'step';
    input.value = testo;
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.textContent = '✕';
    rm.className = 'rimuovi';
    rm.onclick = () => row.remove();
    row.append(input, rm);
    return row;
  }

  // Route a stored row to the right factory based on its kind.
  function appendRiga(target, riga, onChange) {
    if (riga && riga.ricetta_id) target.append(rigaSottoRicetta(riga, onChange));
    else target.append(rigaIngrediente(riga || {}, onChange));
  }

  form.querySelector('.aggiungi-ingrediente').onclick = () =>
    righeIng.append(rigaIngrediente({}, aggiornaResaAuto));
  form.querySelector('.aggiungi-componente').onclick = () =>
    righeIng.append(rigaSottoRicetta({}, aggiornaResaAuto));
  form.querySelector('.aggiungi-istruzione').onclick = () =>
    righeIstr.append(rigaIstruzione());
  form.querySelector('.mep-aggiungi-ingrediente').onclick = () =>
    righeMep.append(rigaIngrediente({}, null));
  form.querySelector('.mep-aggiungi-componente').onclick = () =>
    righeMep.append(rigaSottoRicetta({}, null));
  form.querySelector('.mep-aggiungi-istruzione').onclick = () =>
    righeMepIstr.append(rigaIstruzione());

  // Quick-create: build a brand-new recipe on the fly (full form) and add it as
  // a component here, without leaving the current form (spec B2). The new recipe
  // is saved as a standalone recipe; the current form keeps its edits.
  function creaComponente(target, onChange) {
    openForm(container, {
      // Forbid this recipe + its ancestors in the new recipe too (no cycles).
      vietateExtra: new Set(vietate),
      onCreated: (nuova) => {
        selezionabili.push(nuova);
        ricette.push(nuova);
        // Extend every existing component menu with the new recipe.
        for (const sel of form.querySelectorAll('.riga-componente select')) {
          const opt = document.createElement('option');
          opt.value = nuova.id;
          opt.textContent = nuova.nome;
          sel.append(opt);
        }
        // Components now exist: re-enable the "add component" buttons.
        for (const b of form.querySelectorAll('.aggiungi-componente, .mep-aggiungi-componente')) {
          b.disabled = false;
        }
        // Add a preselected component row at the originating spot.
        target.append(
          rigaSottoRicetta(
            { ricetta_id: nuova.id, unita_misura: nuova.resa ? nuova.resa.unita_misura : '' },
            onChange
          )
        );
        if (onChange) onChange();
      },
    });
  }
  form.querySelector('.crea-componente').onclick = () => creaComponente(righeIng, aggiornaResaAuto);
  form.querySelector('.mep-crea-componente').onclick = () => creaComponente(righeMep, null);

  // Prefill on edit or copy. On copy, suggest "Copia di …" as the name; the
  // original recipe is never touched (we only read `base`).
  if (prefill) {
    const nomeIniziale = isCopia ? `Copia di ${prefill.nome || ''}` : prefill.nome || '';
    form.querySelector('[name=nome]').value = nomeIniziale;
    form.querySelector('[name=autore]').value = prefill.autore || '';
    form.querySelector('[name=porzioni_base]').value = prefill.porzioni_base || 1;
    form.querySelector('[name=tag]').value = (prefill.tag || []).join(', ');
    for (const riga of prefill.ingredienti || []) appendRiga(righeIng, riga, aggiornaResaAuto);
    for (const step of prefill.istruzioni || []) righeIstr.append(rigaIstruzione(step));
    if (prefill.mise_en_place) {
      for (const riga of prefill.mise_en_place.ingredienti || []) appendRiga(righeMep, riga, null);
      for (const step of prefill.mise_en_place.istruzioni || []) righeMepIstr.append(rigaIstruzione(step));
    }
  }
  if (!righeIng.children.length) righeIng.append(rigaIngrediente({}, aggiornaResaAuto));
  if (!righeIstr.children.length) righeIstr.append(rigaIstruzione());

  // Resa initial state: edit keeps the stored yield (manual); new/copy follow the
  // running sum (auto), so on copy it rescales together with the portions.
  if (isEdit && ric.resa && typeof ric.resa.quantita === 'number') {
    resaAuto = false;
    resaQ.value = ric.resa.quantita;
    setResaUnita(ric.resa.unita_misura || 'g');
  } else {
    resaAuto = true;
    aggiornaResaAuto();
  }

  // Copy flow: rescale quantities (main rows, components, mise en place) and the
  // auto resa when the portions change. Disabled when base portions are missing.
  if (isCopia) {
    const porzInput = form.querySelector('[name=porzioni_base]');
    const basePorzioni = base.porzioni_base;
    porzInput.addEventListener('input', () => {
      if (!basePorzioni || basePorzioni <= 0) return;
      const nuove = parseInt(porzInput.value, 10);
      for (const cont of [righeIng, righeMep]) {
        for (const row of cont.querySelectorAll('.riga-form')) {
          const q = row.querySelector('.qta');
          if (!q || q.dataset.base == null || q.dataset.base === '') continue;
          const scaled = scalaQuantita(Number(q.dataset.base), basePorzioni, nuove);
          if (scaled != null) q.value = scaled;
        }
      }
      aggiornaResaAuto();
    });
  }

  form.querySelector('.annulla').onclick = () => form.remove();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const nome = form.querySelector('[name=nome]').value.trim();
    const autore = form.querySelector('[name=autore]').value.trim();
    if (!nome || !autore) return; // both mandatory (formato-file-json)

    const porzioni = parseInt(form.querySelector('[name=porzioni_base]').value, 10) || 1;

    const righeIngredienti = leggiRighe(righeIng);

    const istruzioni = [...righeIstr.querySelectorAll('.step')]
      .map((i) => i.value.trim())
      .filter(Boolean);

    const tag = form
      .querySelector('[name=tag]')
      .value.split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // Yield: always present (mandatory in v3). Empty quantity → 0; empty unit → g.
    const resaQuant = resaQ.value === '' ? 0 : Number(resaQ.value);
    const resa = {
      quantita: Number.isFinite(resaQuant) && resaQuant >= 0 ? resaQuant : 0,
      unita_misura: resaU.value.trim() || 'g',
    };

    const data = {
      nome,
      autore,
      porzioni_base: porzioni,
      resa,
      ingredienti: righeIngredienti,
      istruzioni,
      tag,
    };

    // Mise en place: only saved when it has some content (field is optional).
    const mepIngredienti = leggiRighe(righeMep);
    const mepIstruzioni = [...righeMepIstr.querySelectorAll('.step')]
      .map((i) => i.value.trim())
      .filter(Boolean);
    if (mepIngredienti.length || mepIstruzioni.length) {
      data.mise_en_place = { ingredienti: mepIngredienti, istruzioni: mepIstruzioni };
    }

    // `put` replaces the whole record by id, so removing a mise en place or
    // changing the resa is persisted (no stale leftover fields).
    const id = isEdit ? ric.id : nuovaRicettaId();
    const record = { id, ...data };
    await db.ricette.put(record);
    form.remove();

    // Quick-create mode: hand the new recipe back to the originating form
    // instead of re-rendering the list (that form is still open).
    if (opts.onCreated) {
      opts.onCreated(record);
      return;
    }

    await renderRicette(container);
    mostraToast(isEdit ? 'Ricetta aggiornata.' : `Ricetta "${nome}" salvata.`);
  };

  document.body.append(form);
  form.querySelector('[name=nome]').focus();
}

async function eliminaRicetta(ric, container) {
  // Warn if the recipe is used as a component by other recipes (avoid orphan refs).
  const tutte = await db.ricette.toArray();
  const usata = tutte.filter(
    (r) => r.id !== ric.id && righeDiRicetta(r).some((riga) => riga.ricetta_id === ric.id)
  );

  let messaggio = `Eliminare la ricetta "${ric.nome}"?`;
  if (usata.length > 0) {
    const nomi = usata.map((r) => `• ${r.nome}`).join('\n');
    messaggio =
      `Attenzione: "${ric.nome}" è usata come componente in ${usata.length} ricetta/e:\n\n${nomi}\n\n` +
      `Eliminandola, quelle ricette resteranno con un riferimento mancante.\n\nEliminare comunque?`;
  }

  if (!confirm(messaggio)) return;
  await db.ricette.delete(ric.id);
  await renderRicette(container);
}

// Brief non-blocking confirmation message (auto-dismisses).
function mostraToast(messaggio) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = messaggio;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Escape text used inside option labels built via innerHTML.
function escapeText(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
