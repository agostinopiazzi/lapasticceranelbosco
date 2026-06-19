// CRUD + UI for ingredients (CLAUDE.md §5). User-facing texts in Italian.

import { db, nuovoIngredienteId } from './db.js';
import { UNITA_MISURA } from './unita.js';

let filtroIngredienti = ''; // search query, matched against nome OR categoria

// Render the whole "Ingredienti" section into `container`.
export async function renderIngredienti(container) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'section-header';
  const title = document.createElement('h2');
  title.textContent = 'Ingredienti';
  const addBtn = document.createElement('button');
  addBtn.textContent = '+ Nuovo ingrediente';
  addBtn.className = 'primary';
  addBtn.onclick = () => openForm(container);
  header.append(title, addBtn);

  // Search box: filters the list by ingredient name or category (re-renders only
  // the list, so the input keeps focus while typing).
  const filtro = document.createElement('div');
  filtro.className = 'filtro';
  const cerca = document.createElement('input');
  cerca.type = 'search';
  cerca.className = 'cerca';
  cerca.placeholder = 'Cerca per nome o categoria…';
  cerca.autocomplete = 'off';
  cerca.value = filtroIngredienti;
  cerca.oninput = async () => {
    filtroIngredienti = cerca.value;
    await renderLista(list, container);
  };
  filtro.append(cerca);

  const list = document.createElement('div');
  list.className = 'lista';

  container.append(header, filtro, list);
  await renderLista(list, container);
}

// Build the grouped-by-category list.
async function renderLista(list, container) {
  list.innerHTML = '';
  const tutti = await db.ingredienti.orderBy('nome').toArray();

  if (tutti.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'vuoto';
    empty.textContent = 'Nessun ingrediente. Aggiungine uno con "+ Nuovo ingrediente".';
    list.append(empty);
    return;
  }

  // Filter by name OR category (case-insensitive substring).
  const q = filtroIngredienti.trim().toLowerCase();
  const items = q
    ? tutti.filter(
        (i) =>
          (i.nome || '').toLowerCase().includes(q) ||
          (i.categoria || '').toLowerCase().includes(q)
      )
    : tutti;

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'vuoto';
    empty.textContent = 'Nessun ingrediente trovato per la ricerca.';
    list.append(empty);
    return;
  }

  // Group by categoria.
  const gruppi = new Map();
  for (const ing of items) {
    const cat = ing.categoria || 'senza categoria';
    if (!gruppi.has(cat)) gruppi.set(cat, []);
    gruppi.get(cat).push(ing);
  }

  for (const [cat, list_] of [...gruppi.entries()].sort()) {
    const h = document.createElement('h3');
    h.className = 'categoria';
    h.textContent = cat;
    list.append(h);

    for (const ing of list_) {
      const row = document.createElement('div');
      row.className = 'riga';

      const nome = document.createElement('span');
      nome.className = 'riga-nome';
      nome.textContent = ing.nome;

      const um = document.createElement('span');
      um.className = 'riga-meta';
      um.textContent = ing.unita_misura || '';

      const azioni = document.createElement('span');
      azioni.className = 'azioni';
      const edit = document.createElement('button');
      edit.textContent = 'Modifica';
      edit.onclick = () => openForm(container, ing);
      const del = document.createElement('button');
      del.textContent = 'Elimina';
      del.className = 'danger';
      del.onclick = () => eliminaIngrediente(ing, container);
      azioni.append(edit, del);

      row.append(nome, um, azioni);
      list.append(row);
    }
  }
}

// Open the create/edit form. `ing` undefined → create.
function openForm(container, ing) {
  const isEdit = !!ing;
  const form = document.createElement('form');
  form.className = 'form-overlay';

  form.innerHTML = `
    <div class="form-box">
      <h3>${isEdit ? 'Modifica ingrediente' : 'Nuovo ingrediente'}</h3>
      <label>Nome
        <input name="nome" required value="">
      </label>
      <label>Unità di misura
        <select name="unita_misura" required>
          <option value="">— scegli —</option>
          ${UNITA_MISURA.map((u) => `<option value="${u}">${u}</option>`).join('')}
        </select>
      </label>
      <label>Categoria
        <input name="categoria" value="" required>
      </label>
      <div class="form-actions">
        <button type="button" class="annulla">Annulla</button>
        <button type="submit" class="primary">Salva</button>
      </div>
    </div>
  `;

  // Set values safely (avoid HTML injection via attribute interpolation).
  if (isEdit) {
    form.querySelector('[name=nome]').value = ing.nome || '';
    const selUM = form.querySelector('[name=unita_misura]');
    // Preserve a legacy/custom unit not in the proposed list (e.g. imported "kg").
    if (ing.unita_misura && !UNITA_MISURA.includes(ing.unita_misura)) {
      const opt = document.createElement('option');
      opt.value = ing.unita_misura;
      opt.textContent = ing.unita_misura;
      selUM.append(opt);
    }
    selUM.value = ing.unita_misura || '';
    form.querySelector('[name=categoria]').value = ing.categoria || '';
  }

  form.querySelector('.annulla').onclick = () => form.remove();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      nome: form.querySelector('[name=nome]').value.trim(),
      unita_misura: form.querySelector('[name=unita_misura]').value.trim(),
      categoria: form.querySelector('[name=categoria]').value.trim(),
    };
    // All three are mandatory and must match the data format (formato-file-json).
    if (!data.nome || !data.unita_misura || !data.categoria) return;

    if (isEdit) {
      await db.ingredienti.update(ing.id, data);
    } else {
      await db.ingredienti.add({ id: nuovoIngredienteId(), ...data });
    }
    form.remove();
    await renderIngredienti(container);
  };

  document.body.append(form);
  form.querySelector('[name=nome]').focus();
}

// Delete an ingredient, warning if it is used in any recipe (avoid orphan refs).
// Checks both the main ingredient list and the mise en place of each recipe.
async function eliminaIngrediente(ing, container) {
  const tutte = await db.ricette.toArray();
  const righeDi = (r) => [
    ...(r.ingredienti || []),
    ...(r.mise_en_place && Array.isArray(r.mise_en_place.ingredienti) ? r.mise_en_place.ingredienti : []),
  ];
  const usata = tutte.filter((r) =>
    righeDi(r).some((riga) => riga.ingrediente_id === ing.id)
  );

  let messaggio = `Eliminare l'ingrediente "${ing.nome}"?`;
  if (usata.length > 0) {
    const nomi = usata.map((r) => `• ${r.nome}`).join('\n');
    messaggio =
      `Attenzione: "${ing.nome}" è usato in ${usata.length} ricetta/e:\n\n${nomi}\n\n` +
      `Eliminandolo, quelle ricette resteranno con un riferimento mancante.\n\nEliminare comunque?`;
  }

  if (!confirm(messaggio)) return;
  await db.ingredienti.delete(ing.id);
  await renderIngredienti(container);
}
