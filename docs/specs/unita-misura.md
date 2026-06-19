# Feature: Unità di misura proposte dal sistema

## Obiettivo
L'unità di misura non si scrive a mano: ovunque l'utente la **sceglie**, la prende da un **menu a
tendina** con le unità proposte dal sistema. Questo evita errori di battitura e unità incoerenti, e
prepara il terreno a una futura gestione delle unità da frontend.

## Elenco delle unità (fonte unica)
- Le unità proposte vivono in un **unico punto**: [../../frontend/js/unita.js](../../frontend/js/unita.js)
  (`UNITA_MISURA`). Attualmente: **`g`, `ml`, `pz`, `q.b.`**.
- Aggiungere un'unità = aggiungerla a quella lista (lato codice/«backend»). È il punto di aggancio per
  la **futura feature**: permettere all'utente di aggiungere nuove unità **dal frontend** (salvate in
  locale e unite a queste predefinite).

## Dove si applica
1. **Creazione/modifica ingrediente** ([ingredienti.js](../../frontend/js/ingredienti.js)): il campo
   "Unità di misura" è un menu a tendina (non più testo libero). Obbligatorio.
2. **Resa di una ricetta** ([ricette.js](../../frontend/js/ricette.js)): l'unità della resa è un menu
   a tendina.
3. **Righe di una ricetta** (ingrediente o sotto-ricetta): l'unità **non** si sceglie qui, è
   **forzata** e derivata — dall'unità dell'ingrediente selezionato o dalla `resa` della ricetta
   selezionata (vedi [ricette-componibili-ui.md](ricette-componibili-ui.md) §B). Coerente per
   costruzione, quindi nessun menu.

## Vincoli e compatibilità
- **Dati esistenti / import**: un'unità non in elenco (es. un vecchio `kg` importato) viene
  **preservata**: in modifica compare comunque come voce selezionata del menu (helper
  `unitaConValore`), così non viene cambiata silenziosamente. La validazione import non impone
  l'elenco (vedi nota sotto).
- **Formato dati invariato**: nel file `.json` `unita_misura` resta testo libero
  ([../formato-file-json.md](../formato-file-json.md)); l'elenco proposto è un vincolo della **UI**,
  non del formato. Così restano importabili file con unità non previste.
- Nessuna intelligenza artificiale: semplice elenco e menu.

## Usabilità
- Per creare un ingrediente si sceglie l'unità dal menu (con voce iniziale "— scegli —", obbligatoria).
- L'unità della resa è coerente con le stesse unità proposte.

## Fuori scope (feature futura)
- Aggiunta/gestione delle unità **dal frontend** da parte dell'utente (persistenza locale, merge con
  le predefinite). `UNITA_MISURA` in `unita.js` è il punto di estensione previsto.
