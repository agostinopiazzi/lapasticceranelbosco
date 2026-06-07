// CRUD + UI for recipes (CLAUDE.md §5). User-facing texts in Italian.

import { db, nuovaRicettaId } from './db.js';

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
  addBtn.onclick = () => openForm(container);
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
    edit.onclick = () => openForm(container, r);
    const del = document.createElement('button');
    del.textContent = 'Elimina';
    del.className = 'danger';
    del.onclick = () => eliminaRicetta(r, container);
    azioni.append(edit, del);

    card.append(top, tags, dettagli, azioni);
    list.append(card);
  }
}

// Open the create/edit form. `ric` undefined → create.
async function openForm(container, ric) {
  const isEdit = !!ric;
  const ingredienti = await db.ingredienti.orderBy('nome').toArray();

  const form = document.createElement('form');
  form.className = 'form-overlay';
  form.innerHTML = `
    <div class="form-box form-box-large">
      <h3>${isEdit ? 'Modifica ricetta' : 'Nuova ricetta'}</h3>
      <label>Nome
        <input name="nome" required>
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

  // Prefill on edit.
  if (isEdit) {
    form.querySelector('[name=nome]').value = ric.nome || '';
    form.querySelector('[name=porzioni_base]').value = ric.porzioni_base || 1;
    form.querySelector('[name=tag]').value = (ric.tag || []).join(', ');
    for (const riga of ric.ingredienti || []) righeIng.append(rigaIngrediente(riga));
    for (const step of ric.istruzioni || []) righeIstr.append(rigaIstruzione(step));
  }
  if (!righeIng.children.length) righeIng.append(rigaIngrediente());
  if (!righeIstr.children.length) righeIstr.append(rigaIstruzione());

  form.querySelector('.annulla').onclick = () => form.remove();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const nome = form.querySelector('[name=nome]').value.trim();
    if (!nome) return;

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
  };

  document.body.append(form);
  form.querySelector('[name=nome]').focus();
}

async function eliminaRicetta(ric, container) {
  if (!confirm(`Eliminare la ricetta "${ric.nome}"?`)) return;
  await db.ricette.delete(ric.id);
  await renderRicette(container);
}

// Escape text used inside option labels built via innerHTML.
function escapeText(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
