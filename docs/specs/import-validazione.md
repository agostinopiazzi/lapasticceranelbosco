# Feature: Validazione del file in importazione

## Obiettivo
Quando l'utente importa un file `.json`, il sistema deve **verificarne la struttura** prima di
usarlo e **rifiutare** i file non conformi, in modo che nel database locale finiscano solo
ingredienti e ricette corretti. I dati già presenti non devono mai essere danneggiati da un file
sbagliato.

Il formato di riferimento, descritto in modo univoco, è in [../formato-file-json.md](../formato-file-json.md).
La spec descrive *cosa* viene controllato; la descrizione del formato dice *com'è fatto* il file.

## Comportamento
1. L'utente sceglie un file con "Importa dati".
2. Il sistema prova a leggerlo come JSON. Se non è JSON valido → messaggio chiaro, **nessuna modifica**.
3. Se il file è di una **versione precedente**, viene **migrato** al formato corrente prima della
   validazione (vedi [autore-ricetta.md](autore-ricetta.md) e [../formato-file-json.md](../formato-file-json.md) §8); l'utente è avvisato.
4. Il sistema **valida la struttura** (vedi sotto). Se trova problemi:
   - mostra un messaggio con il **numero di problemi** e l'**elenco** dei primi (gli altri riassunti);
   - **non tocca** i dati locali;
   - non procede oltre.
5. Se il file è valido, chiede conferma della sostituzione e importa dentro una transazione atomica.
6. Se durante il salvataggio si verifica un errore imprevisto, la transazione viene annullata
   (i dati restano quelli di prima) e l'utente è avvisato.

## Controlli effettuati
Validazione **deterministica** (nessuna AI), tutta in [../../frontend/js/validazione.js](../../frontend/js/validazione.js).

### Livello file
- La radice è un **oggetto** con i campi `versione`, `ingredienti`, `ricette`.
- `versione` presente e uguale alla versione supportata dall'app.
- `ingredienti` e `ricette` sono **elenchi** (array).

### Ogni ingrediente
- È un oggetto.
- `id`: testo non vuoto e **univoco** tra gli ingredienti.
- `nome`: testo non vuoto.
- `unita_misura`: testo non vuoto (es. `g`, `ml`, `pz`, `q.b.`).
- `categoria`: testo non vuoto.

### Ogni ricetta
- È un oggetto.
- `id`: testo non vuoto e **univoco** tra le ricette.
- `nome`: testo non vuoto.
- `autore`: testo non vuoto (vedi [autore-ricetta.md](autore-ricetta.md)).
- `porzioni_base`: intero ≥ 1.
- `ingredienti`: elenco di righe; ogni riga è un oggetto con:
  - `ingrediente_id`: testo non vuoto che **deve corrispondere** a un ingrediente presente nel file
    (integrità referenziale);
  - `quantita`: numero ≥ 0 **oppure** `null`;
  - `unita_misura` (se presente): testo.
- `istruzioni`: elenco di testi (può essere vuoto).
- `tag` (facoltativo): elenco di testi non vuoti.

> Tutti i problemi vengono raccolti e mostrati insieme (non solo il primo), con un riferimento
> leggibile (es. *Ricetta #2 ("Impasto Croissant"), riga ingrediente #4*) per aiutare l'utente a
> capire cosa correggere.

## Vincoli
- Nessuna intelligenza artificiale: solo controlli strutturali e aritmetici espliciti.
- La validazione avviene **prima** di qualunque scrittura: i dati locali sono intoccabili finché il
  file non è valido.
- Campi extra non previsti non bloccano l'import (compatibilità con versioni future), ma il formato
  canonico resta quello descritto in [../formato-file-json.md](../formato-file-json.md).
- Coerenza app↔import: il form ingredienti rende obbligatori `unita_misura` e `categoria`, così l'app
  non può creare dati che il proprio import rifiuterebbe.

## Usabilità
- Messaggi in italiano, senza gergo, che dicono **cosa** non va e **dove**.
- Messaggio rassicurante esplicito: "I tuoi dati attuali NON sono stati modificati".

## Casi limite
- File non JSON (testo, immagine rinominata) → messaggio "non è un file JSON valido".
- JSON valido ma non un oggetto (numero, testo, elenco) → rifiutato con spiegazione.
- `id` duplicati tra ingredienti o tra ricette → errore puntuale.
- Ricetta che cita un `ingrediente_id` inesistente nel file → errore puntuale.
- `quantita` testuale o negativa → errore; `null` è ammesso (quantità "a piacere"/`q.b.`).
- File enorme con molti errori → vengono mostrati i primi e riassunti gli altri.
