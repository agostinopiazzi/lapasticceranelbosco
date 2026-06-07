# Feature: Autore della ricetta

## Obiettivo
Ogni ricetta indica **chi l'ha creata**, tramite un campo **`autore`** obbligatorio. Questo permette
di sapere a colpo d'occhio la paternità di ciascuna ricetta e prepara il terreno a futuri filtri o
attribuzioni.

## Comportamento
1. Nel form di creazione/modifica ricetta compare un campo **"Autore"** (testo), **obbligatorio**:
   non si può salvare senza compilarlo.
2. L'autore viene **mostrato** nella scheda della ricetta, sotto il titolo, come *"Autore: Mario Rossi"*.
   La riga è sempre visibile; per le ricette salvate prima dell'introduzione del campo mostra
   *"Autore: non indicato"*.
3. Creando una ricetta **da una esistente** (copia), l'autore viene precompilato con quello della
   ricetta di origine e resta modificabile.
4. L'autore fa parte dei dati della ricetta: è incluso in export (totale e parziale) e richiesto in
   import.

## Dati coinvolti
- Nuovo campo `autore` (stringa non vuota) su ogni oggetto Ricetta — vedi
  [../formato-file-json.md](../formato-file-json.md).
- Introduzione della **versione 2** del formato dati. Il campo `versione` passa da `1` a `2`.

## Migrazione dei dati esistenti
- Importando un file in **versione 1** (senza `autore`), l'app lo aggiorna a versione 2 *prima* di
  validarlo: alle ricette prive di autore viene assegnato **"Sconosciuto"**. L'utente è avvisato.
- I dati iniziali (`seed.json`) sono già in versione 2 con l'autore valorizzato.
- Logica di migrazione: [../../frontend/js/migrazione.js](../../frontend/js/migrazione.js).

## Vincoli
- `autore` è **obbligatorio** sia nel form (l'app non crea ricette senza autore) sia nella
  validazione import (vedi [import-validazione.md](import-validazione.md)).
- Testo libero: nessun elenco predefinito di autori, nessun account utente. Coerente con
  l'assenza di AI a runtime.
- Nessun impatto sugli ingredienti.

## Usabilità
- Etichetta chiara "Autore", campo obbligatorio segnalato dal browser se lasciato vuoto.
- In copia, l'autore è già compilato: un campo in meno da ripensare se non cambia.

## Casi limite
- Import di un vecchio file v1 → autore "Sconosciuto" assegnato automaticamente, con avviso.
- Autore composto solo da spazi → considerato vuoto, salvataggio/validazione rifiutati.
- Ricetta copiata e poi attribuita a un altro autore → si modifica liberamente il campo.
