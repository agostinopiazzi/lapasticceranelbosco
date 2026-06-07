// CRUD + UI for recipes (CLAUDE.md §5). User-facing texts in Italian.

import { db, nuovaRicettaId } from './db.js';
import { scalaQuantita } from './calcoli.js';

let filtroTag = ''; // '' = tutti

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

  // Tag filter (uses the multi-entry `*tag` index, §5b).
  const filtro = document.createElement('div');
  filtro.className = 'filtro';
  const lab = document.createElement('label');
  lab.textContent = 'Filtra per tag: ';
  const sel = document.createElement('select');
  const tutti = await tuttiITag();
  sel.innerHTML =
    `<option value="">Tutte</option>` +
    tutti.map((t) => `<option value="${escapeText(t)}">${escapeText(t)}</option>`).join('');
  sel.value = filtroTag;
  sel.onchange = async () => {
    filtroTag = sel.value;
    await renderLista(list, container);
  };
  lab.append(sel);
  filtro.append(lab);

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

async function renderLista(list, container) {
  list.innerHTML = '';

  const ricette = filtroTag
    ? await db.ricette.where('tag').equals(filtroTag).sortBy('nome')
    : await db.ricette.orderBy('nome').toArray();

  if (ricette.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'vuoto';
    empty.textContent = filtroTag
      ? 'Nessuna ricetta con questo tag.'
      : 'Nessuna ricetta. Aggiungine una con "+ Nuova ricetta".';
    list.append(empty);
    return;
  }

  // Resolve ingredient names for display.
  const ingMap = new Map((await db.ingredienti.toArray()).map((i) => [i.id, i]));

  for (const r of ricette) {
    const card = document.createElement('div');
    card.className = 'card';

    const top = document.createElement('div');
    top.className = 'card-top';
    const nome = document.createElement('h3');
    nome.textContent = r.nome;
    const meta = document.createElement('span');
    meta.className = 'riga-meta';
    meta.textContent = `${r.porzioni_base || 1} porzione/i`;
    top.append(nome, meta);

    const autoreEl = document.createElement('p');
    autoreEl.className = 'ricetta-autore';
    if (r.autore) autoreEl.textContent = `di ${r.autore}`;

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

    const ul = document.createElement('ul');
    ul.className = 'ingredienti-list';
    for (const riga of r.ingredienti || []) {
      const ing = ingMap.get(riga.ingrediente_id);
      const li = document.createElement('li');
      const nomeIng = ing ? ing.nome : '⚠ ingrediente mancante';
      const q = riga.quantita == null ? '' : `${riga.quantita} `;
      li.textContent = `${nomeIng}: ${q}${riga.unita_misura || ''}`.trim();
      if (!ing) li.className = 'mancante';
      ul.append(li);
    }
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
//               ingredient quantities if the portions change (spec)
//   neither   → blank new recipe
async function openForm(container, opts = {}) {
  const { ric, base } = opts;
  const isEdit = !!ric;
  const isCopia = !!base;
  const prefill = ric || base; // source of pre-filled values
  const ingredienti = await db.ingredienti.orderBy('nome').toArray();

  const form = document.createElement('form');
  form.className = 'form-overlay';
  form.innerHTML = `
    <div class="form-box form-box-large">
      <h3>${isEdit ? 'Modifica ricetta' : isCopia ? 'Nuova ricetta (da copia)' : 'Nuova ricetta'}</h3>
      <label>Nome
        <input name="nome" required>
      </label>
      <label>Autore
        <input name="autore" required>
      </label>
      <label>Porzioni base
        <input name="porzioni_base" type="number" min="1" step="1" value="1">
      </label>

      <fieldset>
        <legend>Ingredienti</legend>
        <div class="righe-ingredienti"></div>
        <button type="button" class="aggiungi-ingrediente">+ Aggiungi ingrediente</button>
      </fieldset>

      <fieldset>
        <legend>Procedimento (un passo per riga)</legend>
        <div class="righe-istruzioni"></div>
        <button type="button" class="aggiungi-istruzione">+ Aggiungi passo</button>
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

  // Build one ingredient row (select + quantità + unità + remove).
  function rigaIngrediente(valore = {}) {
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
    um.value = valore.unita_misura || '';

    // Auto-fill unit from the chosen ingredient when empty.
    sel.onchange = () => {
      const ing = ingredienti.find((i) => i.id === sel.value);
      if (ing && !um.value) um.value = ing.unita_misura || '';
    };

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.textContent = '✕';
    rm.className = 'rimuovi';
    rm.onclick = () => row.remove();

    row.append(sel, q, um, rm);
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

  form.querySelector('.aggiungi-ingrediente').onclick = () =>
    righeIng.append(rigaIngrediente());
  form.querySelector('.aggiungi-istruzione').onclick = () =>
    righeIstr.append(rigaIstruzione());

  // Prefill on edit or copy. On copy, suggest "Copia di …" as the name; the
  // original recipe is never touched (we only read `base`).
  if (prefill) {
    const nomeIniziale = isCopia ? `Copia di ${prefill.nome || ''}` : prefill.nome || '';
    form.querySelector('[name=nome]').value = nomeIniziale;
    form.querySelector('[name=autore]').value = prefill.autore || '';
    form.querySelector('[name=porzioni_base]').value = prefill.porzioni_base || 1;
    form.querySelector('[name=tag]').value = (prefill.tag || []).join(', ');
    for (const riga of prefill.ingredienti || []) righeIng.append(rigaIngrediente(riga));
    for (const step of prefill.istruzioni || []) righeIstr.append(rigaIstruzione(step));
  }
  if (!righeIng.children.length) righeIng.append(rigaIngrediente());
  if (!righeIstr.children.length) righeIstr.append(rigaIstruzione());

  // Copy flow: rescale ingredient quantities when the portions change.
  // Disabled when base portions are missing or 0 (quantities stay unchanged).
  if (isCopia) {
    const porzInput = form.querySelector('[name=porzioni_base]');
    const basePorzioni = base.porzioni_base;
    porzInput.addEventListener('input', () => {
      if (!basePorzioni || basePorzioni <= 0) return;
      const nuove = parseInt(porzInput.value, 10);
      for (const row of righeIng.querySelectorAll('.riga-form')) {
        const q = row.querySelector('.qta');
        if (q.dataset.base == null || q.dataset.base === '') continue;
        const scaled = scalaQuantita(Number(q.dataset.base), basePorzioni, nuove);
        if (scaled != null) q.value = scaled;
      }
    });
  }

  form.querySelector('.annulla').onclick = () => form.remove();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const nome = form.querySelector('[name=nome]').value.trim();
    const autore = form.querySelector('[name=autore]').value.trim();
    if (!nome || !autore) return; // both mandatory (formato-file-json)

    const porzioni = parseInt(form.querySelector('[name=porzioni_base]').value, 10) || 1;

    const righeIngredienti = [...righeIng.querySelectorAll('.riga-form')]
      .map((row) => {
        const id = row.querySelector('select').value;
        const qRaw = row.querySelector('.qta').value;
        const um = row.querySelector('.um').value.trim();
        if (!id) return null;
        return {
          ingrediente_id: id,
          quantita: qRaw === '' ? null : Number(qRaw),
          unita_misura: um,
        };
      })
      .filter(Boolean);

    const istruzioni = [...righeIstr.querySelectorAll('.step')]
      .map((i) => i.value.trim())
      .filter(Boolean);

    const tag = form
      .querySelector('[name=tag]')
      .value.split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const data = {
      nome,
      autore,
      porzioni_base: porzioni,
      ingredienti: righeIngredienti,
      istruzioni,
      tag,
    };

    if (isEdit) {
      await db.ricette.update(ric.id, data);
    } else {
      await db.ricette.add({ id: nuovaRicettaId(), ...data });
    }
    form.remove();
    await renderRicette(container);
    mostraToast(
      isEdit
        ? 'Ricetta aggiornata.'
        : `Ricetta "${nome}" salvata.`
    );
  };

  document.body.append(form);
  form.querySelector('[name=nome]').focus();
}

async function eliminaRicetta(ric, container) {
  if (!confirm(`Eliminare la ricetta "${ric.nome}"?`)) return;
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
