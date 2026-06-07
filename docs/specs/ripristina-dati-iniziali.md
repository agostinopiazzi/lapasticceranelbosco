# Feature: Ripristina dati iniziali (svuota e ricarica il seed)

## Obiettivo
Permettere all'utente di **azzerare** i propri dati locali (ingredienti e ricette) e **ricaricare il
ricettario di esempio** iniziale (`seed.json`), con una conferma esplicita e la possibilità di
esportare prima un backup di sicurezza.

## Comportamento
1. In alto è presente un pulsante **"Ripristina dati iniziali"**.
2. Al clic si apre una finestra di conferma che spiega chiaramente che l'operazione **cancella tutti
   i dati attuali** e ricarica i dati di esempio, ed è **irreversibile**.
3. La finestra offre tre scelte:
   - **"Esporta backup, poi svuota"**: prima esporta i dati attuali (con scelta del nome file, come
     l'esportazione normale), poi — solo se l'esportazione è andata a buon fine — svuota e ricarica.
   - **"Svuota senza esportare"**: procede direttamente a svuotare e ricaricare.
   - **"Annulla"**: non fa nulla.
4. Dopo lo svuotamento, i dati di esempio vengono caricati e la schermata si aggiorna; un messaggio
   conferma l'esito.

## Dati coinvolti
- Si cancellano completamente gli object store `ingredienti` e `ricette` e si ricaricano dal file
  `frontend/data/seed.json` (stesso formato di [../formato-file-json.md](../formato-file-json.md),
  versione corrente).
- L'eventuale backup è il normale file JSON di esportazione totale.

## Vincoli
- Operazione **irreversibile** sui dati locali: per questo la conferma e l'offerta di backup sono
  obbligatorie.
- Se l'utente annulla la scelta del nome file durante l'esportazione, **lo svuotamento non avviene**
  (si evita di cancellare dati senza aver davvero salvato il backup).
- Il caricamento del seed avviene in una transazione atomica: se fallisce, i dati non restano a metà.
- Nessuna intelligenza artificiale.

## Usabilità
- Linguaggio chiaro, niente gergo; il pulsante distruttivo "Svuota senza esportare" è evidenziato
  come azione pericolosa.
- Il percorso consigliato (esporta prima) è il pulsante principale.

## Casi limite
- Dati già vuoti → l'operazione ricarica comunque il seed senza errori.
- File seed non raggiungibile o di versione non supportata → messaggio di errore, nessuna modifica.
- Esportazione annullata a metà → nessuno svuotamento.
