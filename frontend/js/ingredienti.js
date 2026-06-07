// CRUD + UI for ingredients (CLAUDE.md §5). User-facing texts in Italian.

import { db, nuovoIngredienteId } from './db.js';

// Common units of measure offered in the form (free text also allowed).
const UNITA = ['g', 'ml', 'pz', 'q.b.'];

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

  const list = document.createElement('div');
  list.className = 'lista';

  container.append(header, list);
  await renderLista(list, container);
}

// Build the grouped-by-category list.
async function renderLista(list, container) {
  list.innerHTML = '';
  const items = await db.ingredienti.orderBy('nome').toArray();

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'vuoto';
    empty.textContent = 'Nessun ingrediente. Aggiungine uno con "+ Nuovo ingrediente".';
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
        <input name="unita_misura" list="unita-list" value="">
        <datalist id="unita-list">
          ${UNITA.map((u) => `<option value="${u}">`).join('')}
        </datalist>
      </label>
      <label>Categoria
        <input name="categoria" value="">
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
    form.querySelector('[name=unita_misura]').value = ing.unita_misura || '';
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
    if (!data.nome) return;

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
async function eliminaIngrediente(ing, container) {
  const tutte = await db.ricette.toArray();
  const usata = tutte.filter((r) =>
    (r.ingredienti || []).some((riga) => riga.ingrediente_id === ing.id)
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
