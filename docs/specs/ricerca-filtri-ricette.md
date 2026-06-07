# Feature: Ricerca e filtri delle ricette

## Obiettivo
Aiutare l'utente a trovare velocemente una ricetta combinando:
- un **filtro per tag** (già esistente),
- un **filtro per autore**,
- una **barra di ricerca testuale** che cerca nel **nome** e nei **contenuti** della ricetta.

## Comportamento
In cima alla sezione **Ricette** sono presenti tre controlli:

1. **Barra di ricerca** (testo libero, placeholder "Cerca per nome o contenuto…"): filtra le ricette
   il cui testo contiene quanto digitato. La ricerca guarda dentro:
   - nome della ricetta,
   - autore,
   - tag,
   - passi del procedimento (`istruzioni`),
   - **nomi degli ingredienti** usati nella ricetta (risolti dagli `ingrediente_id`).
2. **Filtro per tag**: menu a tendina con tutti i tag presenti; "Tutti" = nessun filtro.
3. **Filtro per autore**: menu a tendina con tutti gli autori presenti; "Tutti" = nessun filtro.

I tre criteri si combinano in **AND**: una ricetta è mostrata solo se soddisfa contemporaneamente
ricerca testuale, tag selezionato e autore selezionato. L'elenco resta ordinato per nome.

È inoltre presente un pulsante **"Cancella filtri"** che azzera in un colpo solo ricerca, tag e
autore. È **disabilitato** quando nessun filtro è attivo.

## Dati coinvolti
- Sola lettura su ricette e ingredienti locali (IndexedDB). Nessuna modifica ai dati.
- Gli elenchi di tag e autori sono ricavati dalle ricette presenti.

## Vincoli
- Filtri e ricerca **deterministici**, lato browser, senza intelligenza artificiale.
- Confronto testuale senza distinzione tra maiuscole/minuscole, per sottostringa.
- Nessuna alterazione dei dati: cambia solo ciò che viene mostrato.

## Usabilità
- Ricerca in tempo reale mentre si digita; nessun pulsante "cerca".
- I valori di ricerca/filtri **restano** dopo aver creato/modificato/eliminato una ricetta, così la
  vista non si resetta.
- Messaggi chiari quando non ci sono risultati.

## Casi limite
- Nessuna ricetta nel database → messaggio "Nessuna ricetta. Aggiungine una…".
- Filtri/ricerca senza risultati → messaggio "Nessuna ricetta corrisponde ai filtri.".
- Ricetta con autore mancante (vecchi dati) → non compare nei filtri per autore valorizzati, ma resta
  visibile senza filtro autore.
- Ingrediente referenziato ma assente → semplicemente non aggiunge testo cercabile per quella riga.
