# Feature: Scelta del nome del file in esportazione

## Obiettivo
Quando l'utente esporta il ricettario, può scegliere il nome del file `.json` invece di accettare un nome predefinito imposto dal programma.

## Comportamento
1. L'utente avvia "Esporta dati".
2. Il sistema mostra un campo **"Nome del file"** già compilato con un nome predefinito modificabile.
3. L'utente può accettare il nome proposto o digitarne uno proprio.
4. Alla conferma viene scaricato un file `.json` con il nome scelto.

## Nome predefinito proposto
- Formato suggerito: `ricettario-AAAA-MM-GG.json` (data corrente), così i backup successivi non si sovrascrivono.
- L'estensione `.json` è gestita dal sistema: se l'utente non la scrive, viene aggiunta automaticamente.

## Validazione del nome
- Se il campo è vuoto → si usa il nome predefinito.
- Caratteri non ammessi dal file system (es. `/ \ : * ? " < > |`) vengono rimossi o sostituiti automaticamente.
- Estensione diversa da `.json` digitata dall'utente → corretta in `.json`.

## Vincoli
- Cambia **solo il nome** del file: contenuto e struttura (campo `versione`, ingredienti, ricette) restano invariati.
- Nessun impatto su importazione: l'import resta indipendente dal nome del file.
- Funziona senza intelligenza artificiale.

## Usabilità
- Campo nome con etichetta chiara e nome predefinito già pronto (l'utente può semplicemente confermare).
- Nessun gergo tecnico; un solo passaggio in più rispetto all'export attuale.

## Casi limite
- Nome composto solo da caratteri non ammessi → si ricade sul nome predefinito.
- Nome molto lungo → troncato a una lunghezza sicura prima del download.
