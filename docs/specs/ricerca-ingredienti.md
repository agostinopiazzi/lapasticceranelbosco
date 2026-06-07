# Feature: Ricerca ingredienti (per nome o categoria)

## Obiettivo
Permettere all'utente di trovare velocemente un ingrediente filtrando l'elenco tramite una **barra di
ricerca** che cerca sia nel **nome** sia nella **categoria**.

## Comportamento
1. In cima alla sezione **Ingredienti** compare un campo di ricerca con etichetta chiara
   (placeholder "Cerca per nome o categoria…").
2. Mentre l'utente digita, l'elenco si filtra in tempo reale.
3. Un ingrediente è mostrato se il testo cercato è contenuto **nel nome oppure nella categoria**
   (confronto senza distinzione tra maiuscole/minuscole, su porzioni di testo).
4. L'elenco filtrato resta **raggruppato per categoria** come la vista normale.
5. Svuotando il campo si torna a vedere tutti gli ingredienti.

## Dati coinvolti
- Sola lettura sugli ingredienti già presenti in locale (IndexedDB). Nessuna modifica ai dati.

## Vincoli
- Ricerca **deterministica**, lato browser, senza intelligenza artificiale.
- Il filtro non altera né cancella dati: cambia solo ciò che viene mostrato.

## Usabilità
- Campo di ricerca singolo e immediato; nessun pulsante "cerca" da premere.
- Il testo digitato **resta** dopo aver aggiunto/modificato/eliminato un ingrediente, così la vista
  non si "resetta" sotto le mani dell'utente.

## Casi limite
- Nessun ingrediente nel database → messaggio "Nessun ingrediente…" (come oggi).
- Ricerca senza risultati → messaggio dedicato "Nessun ingrediente trovato per la ricerca.".
- Campo vuoto → elenco completo.
