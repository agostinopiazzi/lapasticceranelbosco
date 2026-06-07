# Feature: Export totale ed export parziale

## Obiettivo
Permettere all'utente due modi di esportare i dati in un file `.json`:

1. **Export totale**: esporta **tutti** gli ingredienti e **tutte** le ricette, inclusi gli
   ingredienti non usati da nessuna ricetta.
2. **Export parziale**: l'utente sceglie **quali ricette** esportare; il file contiene solo
   quelle ricette e **solo gli ingredienti che compaiono in esse**.

Entrambi gli export riutilizzano la scelta del nome file (vedi [nome-file-export.md](nome-file-export.md)).

## Comportamento

### Export totale
- Pulsante **"Esporta tutto"**.
- Produce un file con `versione`, **tutti** gli `ingredienti` e **tutte** le `ricette`, identico
  all'export esistente. Gli ingredienti orfani (non referenziati da alcuna ricetta) vengono inclusi.

### Export parziale
- Pulsante **"Esporta selezione"**.
- Se non esiste alcuna ricetta → messaggio chiaro e nessun file ("Non ci sono ricette da esportare.").
- Si apre una finestra di **selezione ricette**:
  - elenco delle ricette con **casella di spunta**, nome e numero di porzioni;
  - campo di **ricerca per nome**;
  - comandi **"Seleziona tutte"** / **"Deseleziona tutte"**;
  - contatore delle ricette selezionate;
  - pulsante **"Esporta selezione"** attivo solo con almeno una ricetta selezionata, più **"Annulla"**.
- Alla conferma:
  1. si raccolgono gli `ingrediente_id` citati nelle righe delle ricette selezionate;
  2. si includono **solo** gli ingredienti corrispondenti a quegli id e realmente presenti nel database;
  3. si chiede il nome del file (default suggerito `ricettario-parziale-AAAA-MM-GG.json`) e si scarica.

## Dati coinvolti
- Struttura del file invariata rispetto a §5b di `CLAUDE.md`: `{ versione, ingredienti, ricette }`.
- Nell'export parziale `ricette` contiene solo le ricette scelte e `ingredienti` solo quelli da esse
  referenziati. Il campo `versione` resta uguale (stesso formato dati).

## Vincoli
- Nessuna intelligenza artificiale: la selezione degli ingredienti è una semplice raccolta degli id
  referenziati (logica deterministica).
- L'**import non cambia**: un file parziale si importa come qualunque altro file (sostituisce i dati
  locali con quanto contenuto nel file). L'utente è avvisato altrove che l'import sostituisce i dati.
- Un ingrediente referenziato ma non più esistente nel database viene semplicemente ignorato
  (non si inventano ingredienti).

## Usabilità
- Due pulsanti distinti e dal nome esplicito ("Esporta tutto" / "Esporta selezione").
- La selezione usa caselle di spunta e una ricerca, senza gergo tecnico.
- Per casi rapidi l'utente può "Seleziona tutte" e ottenere di fatto un export totale dalla
  schermata di selezione.

## Casi limite
- Nessuna ricetta nel database → l'export parziale avvisa e non produce file.
- Ricetta senza ingredienti → viene esportata comunque; semplicemente non aggiunge ingredienti.
- Ricette selezionate che non referenziano alcun ingrediente esistente → `ingredienti` risulta vuoto.
- Annullamento in qualunque momento (selezione o richiesta nome file) → nessun file scaricato.
