// App bootstrap: wait for the DB, seed on first launch, wire navigation/backup.

import { seedIfEmpty } from './db.js';
import { renderIngredienti } from './ingredienti.js';
import { renderRicette } from './ricette.js';
import { esportaDati, importaDati } from './backup.js';

const contenuto = document.getElementById('contenuto');

async function mostraSezione(nome) {
  // Highlight the active tab.
  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('attivo', t.dataset.sezione === nome)
  );

  if (nome === 'ricette') {
    await renderRicette(contenuto);
  } else {
    await renderIngredienti(contenuto);
  }
}

function wireNav() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.onclick = () => mostraSezione(tab.dataset.sezione);
  });

  document.getElementById('btn-esporta').onclick = () => esportaDati();

  const fileInput = document.getElementById('file-importa');
  document.getElementById('btn-importa').onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    await importaDati(file, () => mostraSezione('ingredienti'));
    fileInput.value = ''; // allow re-importing the same file
  };
}

async function init() {
  try {
    await seedIfEmpty();
  } catch (err) {
    contenuto.innerHTML = `<p class="errore">${err.message}</p>`;
    return;
  }
  wireNav();
  await mostraSezione('ingredienti');
}

init();
