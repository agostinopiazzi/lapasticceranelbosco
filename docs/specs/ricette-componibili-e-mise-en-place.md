# Feature: Ricette componibili (sotto-ricette) e Mise en place

## Obiettivo
Estendere il modello delle ricette in due modi, per coprire molti più casi d'uso di pasticceria/cucina reale:

1. **Ricette componibili (sotto-ricette).** Nella lista degli ingredienti di una ricetta si può
   citare **un'altra ricetta** della libreria (non solo un ingrediente). La ricetta citata resta una
   ricetta completa e autonoma nell'elenco `ricette` (es. una "Crostata" usa "Pasta frolla" e
   "Crema pasticcera", che sono ricette a sé). Si indica **quanta** sotto-ricetta serve tramite
   **quantità + unità di misura**, grazie a un nuovo campo **`resa`** che dichiara quanto produce la
   sotto-ricetta.
2. **Mise en place.** Ogni ricetta ha una sezione **`mise_en_place`** che è essa stessa una
   mini-ricetta (propri **ingredienti** + proprie **istruzioni**), definita **dentro** la ricetta
   (inline). Rappresenta la preparazione preliminare (pesare, ammollare, foderare stampi, ecc.) ed
   **eredita le porzioni** dalla ricetta madre.

> Questa feature **alza il formato dati alla versione 3** (oggi `2`), con migrazione automatica dei
> file v1/v2 in import. Vedi [../formato-file-json.md](../formato-file-json.md).

---

## Comportamento

### 1. Sotto-ricette nella lista ingredienti
- La lista `ingredienti` di una ricetta può contenere **due tipi di riga**:
  - **Riga ingrediente** (come oggi): fa riferimento a un ingrediente tramite `ingrediente_id`.
  - **Riga sotto-ricetta** (nuova): fa riferimento a un'altra ricetta tramite `ricetta_id`, con una
    `quantita` e una `unita_misura` (es. *"200 g di Crema pasticcera"*).
- La ricetta richiamata vive normalmente nell'elenco `ricette`: non viene duplicata, è solo
  **referenziata** per id. La stessa sotto-ricetta può essere usata da più ricette.
- Una sotto-ricetta può a sua volta contenere altre sotto-ricette (**annidamento permesso**), purché
  non si creino **cicli** (vedi Vincoli).

### 2. Resa di una ricetta
- Ogni ricetta dichiara quanto produce alle sue `porzioni_base`, nel campo **`resa`** obbligatorio
  (es. `{ "quantita": 500, "unita_misura": "g" }`). Serve a dare senso alla quantità con cui la
  ricetta viene richiamata come sotto-ricetta (*"200 g di una resa da 500 g"*).
- **Valore predefinito quando la resa non è nota** (in migrazione e come precompilazione nel form):
  `resa.quantita` = **somma delle quantità numeriche** di tutte le righe della lista ingredienti
  principale (righe ingrediente e righe sotto-ricetta; si ignorano `quantita` `null`/`q.b.`);
  `resa.unita_misura` = l'unità **prevalente** tra quelle righe (a parità, la prima incontrata;
  se nessuna, default `"g"`). È un default grezzo, esplicitamente correggibile dall'utente.

### 3. Mise en place
- Il campo **`mise_en_place`** è **facoltativo**: presente solo sulle ricette che hanno una
  preparazione preliminare. Una ricetta che non ne ha non riporta affatto il campo.
- Quando presente, è un oggetto con due liste: `{ "ingredienti": [...], "istruzioni": [...] }`.
- `mise_en_place.ingredienti` usa le **stesse identiche righe** della lista ingredienti principale
  (quindi può contenere sia righe ingrediente sia righe sotto-ricetta).
- Il mise en place **non ha porzioni proprie**: si riferisce alle stesse `porzioni_base` della
  ricetta madre e si **scala insieme a lei**.

### 4. Scalatura porzioni (copia/ricalcolo)
- Quando si scala una ricetta da N a M porzioni (vedi [crea-da-ricetta-esistente.md](crea-da-ricetta-esistente.md)),
  ogni `quantita` si ricalcola con la regola esistente `quantita × M ÷ N`
  ([../../frontend/js/calcoli.js](../../frontend/js/calcoli.js)). Vale per:
  - le righe ingrediente **e** le righe sotto-ricetta della lista principale;
  - le righe del `mise_en_place` (eredita le porzioni → stesso fattore);
  - la `resa.quantita`, se presente (anch'essa scala con M÷N).
- **Nessuna ricorsione** in copia: la quantità della riga sotto-ricetta scala linearmente come una
  qualunque quantità; non si "esplode" la sotto-ricetta nei suoi ingredienti base. L'esplosione
  ricorsiva è semmai compito del futuro **generatore** (CLAUDE.md §6), fuori da questa spec.

---

## Dati coinvolti
Modifiche al modello dati (formato **versione 3** — riferimento autorevole in
[../formato-file-json.md](../formato-file-json.md)):

- **Ricetta**: due nuovi campi
  - `resa` (oggetto `{ quantita: numero ≥ 0, unita_misura: stringa non vuota }`) — **obbligatorio**
    su ogni ricetta; default = somma delle quantità degli ingredienti (vedi Comportamento §2).
  - `mise_en_place` (oggetto `{ ingredienti: [riga…], istruzioni: [stringa…] }`) — **facoltativo**,
    presente solo quando la ricetta ha una preparazione preliminare.
- **Riga della lista ingredienti**: diventa di due forme alternative
  - ingrediente: `{ ingrediente_id, quantita, unita_misura? }` (come oggi);
  - sotto-ricetta: `{ ricetta_id, quantita, unita_misura? }` (nuova).
  - Una riga ha **esattamente uno** tra `ingrediente_id` e `ricetta_id`.
- **Validazione**: [../../frontend/js/validazione.js](../../frontend/js/validazione.js) va estesa
  (nuovi campi, doppio tipo di riga, integrità referenziale verso le ricette, rilevamento cicli).
- **Migrazione**: [../../frontend/js/migrazione.js](../../frontend/js/migrazione.js) (v2 → v3).
- **Seed**: [../../frontend/data/seed.json](../../frontend/data/seed.json) aggiornato a v3 con un
  esempio che mostra una ricetta composta + un mise en place.

---

## Migrazione dei dati esistenti
- **v2 → v3**: a ogni ricetta viene calcolato e aggiunto il campo **`resa`** obbligatorio con il
  valore predefinito (somma delle quantità degli ingredienti — vedi Comportamento §2). **Non** si
  aggiunge `mise_en_place` (facoltativo: le ricette v2 non ne hanno). Le righe ingrediente esistenti
  restano invariate (sono tutte righe ingrediente).
- **v1 → v2** resta come oggi (assegna `autore` = "Sconosciuto"); poi si applica v2 → v3 a cascata.
- L'utente è **avvisato** quando un file viene aggiornato in import (come già avviene). File con
  versione più recente di quella supportata vengono rifiutati.
- Il `seed.json` è già nativo in versione 3.

---

## Vincoli
- **Integrità referenziale**: ogni `ricetta_id` di una riga sotto-ricetta deve corrispondere a una
  ricetta presente nel file (come già per `ingrediente_id`).
- **Niente cicli**: una ricetta non può richiamare sé stessa, né direttamente né attraverso una
  catena di sotto-ricette (A→B→A). Il validatore rileva i cicli sul grafo dei riferimenti
  (considerando anche i riferimenti dentro `mise_en_place`) e **rifiuta** il file.
- **Resa obbligatoria**: ogni ricetta ha una `resa` valida (`quantita` numero ≥ 0, `unita_misura`
  non vuota). Quando una riga sotto-ricetta indica una `quantita` non nulla, di norma la sua
  `unita_misura` coincide con quella della `resa` della ricetta richiamata.
- **Nessun campo non previsto** a nessun livello (regola già esistente): la presenza di campi
  estranei fa fallire l'import. L'elenco dei campi ammessi va aggiornato con i nuovi.
- **Nessuna intelligenza artificiale**: tutto è struttura dati + aritmetica deterministica.

---

## Usabilità
- Per l'utente non tecnico, nel form ricetta (UI — vedi *Ambito*) aggiungere un componente deve
  essere chiaro: "Aggiungi ingrediente" **oppure** "Aggiungi una ricetta come componente".
- La scheda ricetta mostra le sotto-ricette con il loro nome (cliccabile per aprirle) e la quantità,
  e una sezione "Mise en place" prima del procedimento principale.
- Messaggi di errore in italiano e comprensibili (es. *"La ricetta «Crostata» usa «Crema
  pasticcera», che non indica quanto rende: aggiungi la resa."*, *"Riferimento circolare tra
  ricette."*).

---

## Casi limite
- **Riga senza alcun id** o **con entrambi** `ingrediente_id` e `ricetta_id` → riga non valida.
- **`ricetta_id` inesistente** nel file → import rifiutato (integrità referenziale).
- **Ciclo** A→A o A→B→A → import rifiutato con messaggio chiaro.
- **Ricetta senza `resa`** in un file v3 → import rifiutato (la resa è obbligatoria). In migrazione
  v2→v3 la resa viene calcolata automaticamente.
- **`mise_en_place` assente** → del tutto lecito (campo facoltativo). Se presente ma malformato
  (non oggetto, liste non valide) → import rifiutato.
- **Resa con unità incoerente** rispetto agli ingredienti (es. somma di g+ml+pz) → la migrazione
  produce comunque un numero con l'unità prevalente; l'utente può correggerla nel form.
- **Export parziale** di una ricetta che usa sotto-ricette → vedi *Impatti su altre feature*: vanno
  incluse (in modo transitivo) anche le sotto-ricette referenziate, oltre ai loro ingredienti.
- **`resa.quantita` = 0** → ammessa come valore, ma una sotto-ricetta con resa 0 non è utilizzabile
  per dosare (caso degenere, da segnalare semmai in UI).

---

## Impatti su altre feature (da allineare)
- **[export-parziale.md](export-parziale.md)**: la raccolta deve includere, oltre agli
  `ingrediente_id`, anche le **ricette referenziate** (`ricetta_id`) in modo **transitivo**, e i loro
  ingredienti. Altrimenti si esporterebbe una ricetta con riferimenti rotti.
- **[import-validazione.md](import-validazione.md)**: nuove regole (doppia riga, resa, mise en place,
  cicli).
- **[crea-da-ricetta-esistente.md](crea-da-ricetta-esistente.md)**: la copia deve gestire anche le
  righe sotto-ricetta, il mise en place e la scalatura della resa.
- **CLAUDE.md** §5, §5b, §6: aggiornare modello dati, formato e nota sul generatore.

---

## Ambito (fasi)
Per tenere la modifica gestibile, la feature si divide in due fasi:

- **Fase 1 — Modello dati (questa spec, prioritaria):** formato v3, `formato-file-json.md`,
  `validazione.js`, `migrazione.js`, `seed.json` con esempio. È ciò che l'utente ha chiesto
  ("una modifica al json delle ricette").
- **Fase 2 — UI:** form di creazione/modifica per aggiungere righe sotto-ricetta, modificare la
  `resa` e il `mise_en_place`; visualizzazione nella scheda ricetta; aggiornamento di export
  parziale e copia. Da dettagliare in una spec dedicata dopo la Fase 1.

---

## Decisioni confermate (2026-06-18)
1. **Mise en place facoltativo**: presente solo sulle ricette che hanno una preparazione preliminare.
2. **Resa obbligatoria** su ogni ricetta; quando non nota, default = **somma delle quantità degli
   ingredienti** (unità prevalente), correggibile dall'utente.
3. **Cicli vietati**: nessun caso d'uso legittimo di ricorsione tra ricette.
4. **Si parte dalla Fase 1** (solo modello dati); la UI è Fase 2 in una spec dedicata.
