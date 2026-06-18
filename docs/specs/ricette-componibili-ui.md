# Feature: UI per ricette componibili, resa e mise en place (Fase 2)

> **Fase 2** di [ricette-componibili-e-mise-en-place.md](ricette-componibili-e-mise-en-place.md).
> La **Fase 1** (modello dati v3: sotto-ricette, `resa`, `mise_en_place`, validazione, migrazione) è
> già implementata. Questa spec copre l'**interfaccia**: creare, modificare e vedere questi dati.
> Nessuna modifica al formato dati (resta v3).

## Obiettivo
Rendere usabili dall'interfaccia, per un utente non tecnico, le tre novità del formato v3:

1. **Sotto-ricette**: aggiungere a una ricetta delle righe che richiamano un'altra ricetta come
   componente (oltre alle righe ingrediente).
2. **Resa**: indicare quanto produce la ricetta, con un valore predefinito calcolato ma modificabile.
3. **Mise en place**: comporre la sezione di preparazione preliminare (ingredienti + istruzioni).

E mostrarle in modo chiaro nella scheda ricetta.

## Comportamento

### A. Form ricetta — Resa
- Nuovo campo **"Resa"** (quantità + unità), accanto a "Porzioni base".
- **Precompilata e modificabile** (decisione utente): parte dal valore predefinito (somma delle
  quantità delle righe, unità prevalente) e **si aggiorna in automatico** mentre si aggiungono o
  cambiano le righe, **finché l'utente non la modifica a mano**; da quel momento resta il valore
  scritto.
- **Nuova ricetta da zero**: resa in modalità automatica (segue la somma).
- **Modifica di una ricetta esistente**: il campo parte dalla resa salvata (modalità manuale, per non
  sovrascrivere una resa reale già impostata). Un piccolo comando **"↻ ricalcola dagli ingredienti"**
  riporta al valore predefinito su richiesta.
- **Copia** (crea da esistente): la resa viene riportata e **scalata con le porzioni** come le altre
  quantità (vedi C).

### B. Form ricetta — righe ingrediente e sotto-ricetta
- Due pulsanti distinti (decisione utente):
  - **"+ Aggiungi ingrediente"**: riga come oggi (menu ingrediente + quantità + unità).
  - **"+ Aggiungi ricetta (componente)"**: riga con **menu delle ricette** + quantità + unità.
- Le due tipologie di riga sono visivamente distinte (es. etichetta/icona "componente").
- Scegliendo una ricetta componente, l'unità si **precompila** dall'`unita_misura` della sua `resa`
  (se l'unità è vuota); la quantità si riferisce alla resa di quella ricetta.
- **Prevenzione cicli nel menu**: il menu delle ricette componenti **esclude** la ricetta che si sta
  modificando e ogni ricetta che (direttamente o indirettamente) la richiama, così non è possibile
  creare un ciclo dal form. (La validazione import resta come rete di sicurezza, Fase 1.)
  - In **creazione** (ricetta nuova, senza id) nessuna ricetta può richiamarla: il menu le mostra tutte.

### C. Form ricetta — Mise en place
- Sezione **"Mise en place (preparazione preliminare)"**, facoltativa e inizialmente **vuota/chiusa**.
- Contiene le proprie righe (stessi due pulsanti: ingrediente / ricetta componente) e i propri passi
  ("+ Aggiungi passo").
- Se l'utente non aggiunge nulla, la ricetta viene salvata **senza** il campo `mise_en_place`
  (resta facoltativo). Se aggiunge qualcosa, viene salvato `{ ingredienti, istruzioni }`.
- Non ha porzioni proprie: eredita quelle della ricetta; in copia si scala con esse.

### D. Copia con ricalcolo porzioni
Estende [crea-da-ricetta-esistente.md](crea-da-ricetta-esistente.md): al cambio di porzioni si
ricalcolano in proporzione (regola di [calcoli.js](../../frontend/js/calcoli.js)):
- le quantità delle righe ingrediente **e** delle righe sotto-ricetta della lista principale;
- le quantità delle righe del mise en place;
- il valore della **resa** (finché non modificato a mano).

### E. Scheda ricetta (visualizzazione)
- Mostrare la **resa** vicino alle porzioni (es. *"Resa: 500 g"*).
- Nell'elenco ingredienti, le righe sotto-ricetta sono mostrate in modo distinto (nome della ricetta
  componente + quantità) e sono **cliccabili**: aprono una **vista di sola lettura** della ricetta
  richiamata (resa, ingredienti, mise en place, procedimento).
- Se presente, una sezione **"Mise en place"** prima del procedimento principale, con i suoi
  ingredienti e i suoi passi.
- Una riga sotto-ricetta il cui `ricetta_id` non esiste più mostra un avviso chiaro
  (*"⚠ ricetta componente mancante"*), come già avviene per gli ingredienti.

### F. Eliminazioni protette
- **Eliminare un ingrediente** usato in una ricetta: l'avviso esistente deve considerare **anche** gli
  ingredienti citati nei mise en place (oggi [ingredienti.js](../../frontend/js/ingredienti.js) guarda
  solo la lista principale).
- **Eliminare una ricetta** usata come componente da altre ricette: avvisare l'utente (lascerebbe
  riferimenti pendenti), con l'elenco delle ricette che la usano, prima di confermare.

## Dati coinvolti
- Nessun cambiamento al formato (v3, vedi [../formato-file-json.md](../formato-file-json.md)).
- File UI toccati: [ricette.js](../../frontend/js/ricette.js) (form + scheda + copia),
  [ingredienti.js](../../frontend/js/ingredienti.js) (controllo uso esteso ai mise en place),
  ed eventuale CSS per le righe componente / sezione mise en place.
- Riuso: `calcolaResaPredefinita` e `scalaQuantita` da [calcoli.js](../../frontend/js/calcoli.js).

## Vincoli
- Nessuna intelligenza artificiale: menu, filtri anti-ciclo e ricalcoli sono logica deterministica.
- Il form non deve permettere di creare cicli (menu filtrato); la validazione resta il backstop.
- Testi in italiano, chiari, senza gergo. Coerenza con lo stile attuale (overlay, `riga-form`, chip).
- Le ricette create/modificate restano valide contro il formato v3 (resa sempre presente).

## Usabilità
- Distinguere a colpo d'occhio "ingrediente" e "ricetta componente" (etichetta/icona).
- La resa precompilata evita un campo da pensare nei casi semplici, ma è correggibile per le rese reali.
- La vista di sola lettura della sotto-ricetta evita di perdersi tra le ricette aperte.

## Casi limite
- **Nessuna ricetta selezionabile** come componente (es. unica ricetta, o tutte creerebbero cicli) →
  il pulsante/menu "Aggiungi ricetta (componente)" è disattivato con spiegazione.
- **Resa**: lasciata al valore automatico → salvata come somma corrente; messa a 0 a mano → ammessa
  ma segnalata come inusuale.
- **Mise en place** lasciato vuoto → non salvato (campo facoltativo assente).
- **Copia** di una ricetta con sotto-ricette: vengono copiate le righe (riferimenti agli stessi
  `ricetta_id`); le ricette componenti **non** vengono duplicate.
- **Modifica** che ridurrebbe a un ciclo (caso residuo non filtrabile) → bloccata con messaggio.
- Ricetta componente eliminata altrove → la scheda mostra l'avviso "componente mancante".

## Fuori scope
- Espansione/"esplosione" ricorsiva della sotto-ricetta nei suoi ingredienti base (compito del futuro
  generatore, CLAUDE.md §6).
- Conversioni tra unità di misura diverse tra riga e resa (si assume coerenza di unità).
