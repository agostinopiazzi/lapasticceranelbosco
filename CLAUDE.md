# CLAUDE.md — Ricettario (web app)

> Questo file è il punto di riferimento del progetto per Claude Code.
> Contiene obiettivi, vincoli, architettura e convenzioni.
> Va tenuto aggiornato man mano che il progetto evolve (approccio spec-anchored).

---

## 1. Obiettivo del progetto

Web app per la gestione di **ricette** e **ingredienti**, con un **generatore di nuove ricette** basato sulle indicazioni dell'utente e su semplici calcoli aritmetici sugli ingredienti.

Punti chiave:

- Database di ricette
- Database di ingredienti
- Generazione di una o più ricette nuove in base alle indicazioni dell'utente, con calcoli aritmetici sugli ingredienti (es. scalatura porzioni, somma/conversione quantità)
- **Nessuna dipendenza da intelligenza artificiale a runtime**: l'AI può essere usata solo in fase di sviluppo. L'app finita deve funzionare con logica deterministica (regole + aritmetica)
- **Utilizzabile da utenti con scarse competenze informatiche**
- **Nessuna installazione** richiesta sul dispositivo dell'utente (si usa dal browser tramite URL)

---

## 2. Vincoli e requisiti non funzionali

| Requisito | Decisione |
|---|---|
| Installazione lato utente | Nessuna. Accesso via browser/URL. |
| Competenze utente | Minime. UI semplice, testi chiari in italiano, pochi click. |
| AI a runtime | Vietata. Generazione = regole deterministiche + aritmetica. |
| Accesso | Riservato: solo utenti autorizzati dall'amministratore. |
| Dati utente | **Locali** al dispositivo di ciascun utente. Ogni utente è responsabile dei propri dati. |
| Lingua interfaccia | Italiano. |

---

## 3. Architettura

> **ASSUNZIONE DA CONFERMARE** — scelta architetturale derivata dai requisiti
> (Python + accesso riservato + dati locali). Modificare qui se l'impostazione cambia.

Architettura ibrida: backend Python minimale + frontend nel browser.

- **Backend (Python)** — compiti limitati:
  1. **Autenticazione**: verifica che l'utente sia autorizzato (solo gli autorizzati possono usare l'app).
  2. **Servire il frontend** (pagine e asset statici).
  3. **API di generazione ricette**: riceve gli ingredienti/parametri dal browser, esegue i calcoli, restituisce la/le ricetta/e. **Stateless**: non memorizza i dati dell'utente.

- **Frontend (browser)** — l'app vera e propria:
  1. Interfaccia utente semplice.
  2. **Persistenza locale dei dati** dell'utente (ricette e ingredienti) tramite IndexedDB.
  3. Invia i dati al backend solo in modo transitorio quando serve generare una ricetta; il salvataggio avviene in locale.

Conseguenze:
- Il server **non conserva** ricette/ingredienti degli utenti → privacy e responsabilità dei dati in capo all'utente.
- Serve un server sempre attivo (per auth + servire l'app). Internet necessario al login e al caricamento; l'uso quotidiano può funzionare offline solo per le parti già caricate (valutare in seguito).
- Funzione di **export/import** dei dati locali (file JSON) necessaria per backup e cambio dispositivo.

> **Stato attuale del deployment (senza autenticazione).** Per ora l'app è pubblicata
> come sito statico su **GitHub Pages** tramite il workflow [.github/workflows/pages.yml](.github/workflows/pages.yml),
> che pubblica la sola cartella `frontend/`. In questa configurazione il **backend Python non è
> usato**: l'app gira interamente lato browser (IndexedDB) e nessun dato dell'utente lascia il
> dispositivo. L'**accesso riservato (§4) non è attivo**: chiunque abbia il link vede l'app (i dati
> restano comunque locali a ciascun browser). Quando servirà l'autenticazione si rivaluterà
> l'hosting (vedi §9.1 e §9.5): auth gestita esterna → si può restare su Pages; backend proprio →
> serve un host che esegua Python.

---

## 4. Autenticazione (accesso riservato)

- Solo gli utenti **autorizzati dall'amministratore** possono accedere.
- Approccio consigliato: servizio di auth gestito (es. Auth0 / Supabase Auth / Firebase Auth / Clerk) **oppure** auth semplice gestita dal backend.
- **DA CONFERMARE**: livello di robustezza richiesto.
  - Utenti fidati, basta evitare accessi casuali → soluzione leggera.
  - Necessità di resistere a tentativi attivi di accesso → autenticazione robusta con servizio dedicato.

---

## 5. Modello dati

> Modello concettuale di partenza. I dati risiedono in locale (IndexedDB) sul dispositivo dell'utente.

### Ingrediente
- `id`
- `nome`
- `unita_misura` (es. g, ml, pz)
- `categoria`
- note nutrizionali / proprietà

### Ricetta
- `id`
- `nome`
- `autore` (chi ha creato la ricetta; obbligatorio dalla versione 2)
- `porzioni_base` (numero di porzioni a cui si riferiscono le quantità)
- `istruzioni` (passi)
- `ingredienti`: lista di righe `{ ingrediente_id, quantita, unita_misura }`
- `tag` (facoltativo: es. vegetariano, dolce, primo…)

### Relazione
- Ricetta ↔ Ingredienti è una relazione **molti-a-molti** con attributo `quantita` sulla riga.

---

## 5b. Persistenza e formato dei dati locali

Distinguere due livelli: **come** i dati sono memorizzati durante l'uso e **in che formato** vengono esportati.

### Uso quotidiano: IndexedDB (nel browser)
- I dati di ogni utente vivono in **IndexedDB**, il database integrato nel browser, sul dispositivo dell'utente. Nessun dato passa da un server.
- Organizzazione: due **object store** (equivalente delle tabelle):
  - `ingredienti`
  - `ricette`
- I record sono oggetti strutturati (di fatto JSON) secondo il modello dati di §5.
- Prevedere **indici** utili (es. ricetta per `tag`) per ricerche veloci.
- È trasparente per l'utente: non vede né gestisce file durante l'uso normale.
- In sviluppo è consigliabile usare una libreria che semplifica l'API di IndexedDB (es. **Dexie.js**); dettaglio implementativo, non cambia il modello.

> Limite noto: i dati sono legati a quel browser su quel dispositivo. Se l'utente cambia
> dispositivo/browser o svuota i dati di navigazione, li perde. Per questo l'export/import è essenziale.

### Backup e portabilità: file JSON unico
- Funzioni **Esporta** / **Importa** che producono/leggono **un singolo file `.json`** contenente ingredienti + ricette.
- L'export ha due modalità (vedi [export-parziale.md](docs/specs/export-parziale.md)):
  - **Esporta tutto**: tutti gli ingredienti (anche quelli non usati da alcuna ricetta) e tutte le ricette.
  - **Esporta selezione**: solo le ricette scelte dall'utente e i soli ingredienti referenziati da esse.
- In entrambi i casi l'utente può scegliere il nome del file (vedi [nome-file-export.md](docs/specs/nome-file-export.md)). Nessun gergo tecnico.
- "Importa dati" **valida** il file prima di usarlo e rifiuta i file non conformi senza toccare i dati locali (vedi [import-validazione.md](docs/specs/import-validazione.md)).
- Il file include un campo **`versione`**: permette di leggere correttamente file creati con strutture dati precedenti (migrazioni future).

> **Formato di riferimento univoco**: la struttura completa del file (campi, tipi, vincoli, schema
> formale) è descritta in **[docs/formato-file-json.md](docs/formato-file-json.md)**. È la fonte
> autorevole per il formato; tenerla allineata a [validazione.js](frontend/js/validazione.js).

Struttura del file di export (riepilogo; dettaglio in [docs/formato-file-json.md](docs/formato-file-json.md)):

```json
{
  "versione": 2,
  "ingredienti": [
    { "id": "ing_001", "nome": "Farina 00", "unita_misura": "g", "categoria": "farine" }
  ],
  "ricette": [
    {
      "id": "ric_001",
      "nome": "Pane base",
      "autore": "Mario Rossi",
      "porzioni_base": 4,
      "ingredienti": [
        { "ingrediente_id": "ing_001", "quantita": 500, "unita_misura": "g" }
      ],
      "istruzioni": ["Impastare", "Lievitare", "Cuocere"],
      "tag": ["lievitati"]
    }
  ]
}
```

> Nota: `localStorage` è escluso (troppo limitato e solo testo). IndexedDB per l'uso interno,
> JSON per la portabilità.

---

## 6. Generatore di ricette (logica deterministica, NO AI)

Il generatore produce una o più ricette **a partire dalle indicazioni dell'utente** usando solo regole e aritmetica. Esempi di funzioni:

- **Scalatura porzioni**: data una ricetta per N porzioni, ricalcola le quantità per M porzioni
  (`quantita_nuova = quantita * M / N`).
- **Generazione per ingredienti disponibili**: dato un insieme di ingredienti posseduti, propone ricette compatibili dal database.
- **Generazione per vincoli**: filtra/combina ricette in base a tag o esclusioni (es. senza un certo ingrediente).
- **Calcoli aggregati**: somma quantità, conversioni di unità di misura coerenti.

> Regola ferrea: nessuna chiamata a modelli AI nella logica di generazione. Tutto deve essere
> spiegabile come operazione aritmetica o regola esplicita.

**DA DEFINIRE** con l'utente: quali "indicazioni" può dare (porzioni? ingredienti disponibili? esclusioni? tipo di piatto?) e con quale priorità il generatore combina le ricette.

---

## 7. Stack tecnico

> Proposta iniziale, modificabile.

- **Backend**: Python con **FastAPI** (leggero, moderno, adatto a servire API + file statici).
- **Frontend**: HTML/CSS/JavaScript. Valutare un framework leggero solo se serve; priorità alla semplicità d'uso.
- **Persistenza locale**: IndexedDB (lato browser) tramite libreria **Dexie.js** (vedi §5b). Dexie è **incluso localmente** in [frontend/vendor/dexie.min.js](frontend/vendor/dexie.min.js) (v4.4.3), non caricato da CDN: nessuna richiesta a terze parti.
- **Auth**: servizio gestito o modulo dedicato del backend (vedi §4). **Non ancora attiva** (vedi nota deployment in §3).
- **Export/Import dati**: singolo file JSON con campo `versione` (vedi §5b).
- **Deployment**: GitHub Pages (sola cartella `frontend/`) via GitHub Actions, vedi §3.

---

## 8. Convenzioni di sviluppo

- Codice e commenti tecnici in inglese; **testi rivolti all'utente in italiano**.
- Priorità alla **semplicità d'uso** per utenti non tecnici: messaggi chiari, errori comprensibili, nessun gergo.
- La logica di generazione deve restare **deterministica e testabile** (test unitari sui calcoli aritmetici).
- Mantenere il backend **stateless** rispetto ai dati utente.
- Prima di implementare una nuova feature: scrivere/aggiornare la relativa **spec in `docs/specs/`** (vedi §8b), aggiornare questo file se cambiano architettura o modello dati, poi usare Plan Mode.

### Calcoli condivisi
- Tutta l'aritmetica sulle quantità (scalatura porzioni, arrotondamenti) vive in [frontend/js/calcoli.js](frontend/js/calcoli.js), così la stessa regola di arrotondamento è usata sia copiando una ricetta sia (in futuro) dal generatore (§6).

---

## 8b. Specifiche delle feature (`docs/specs/`)

Le specifiche delle singole feature vivono nella cartella **`docs/specs/`**, un file Markdown per feature (approccio spec-anchored).

- Ogni spec descrive **obiettivo, comportamento, dati coinvolti, vincoli, usabilità e casi limite** in italiano, indipendentemente dall'implementazione.
- Flusso per una nuova feature: **scrivere/aggiornare la spec in `docs/specs/` → Plan Mode → implementazione → tenere allineati spec e `CLAUDE.md`**.
- `CLAUDE.md` resta il riferimento globale (architettura, modello dati, convenzioni); le spec in `docs/specs/` descrivono il dettaglio delle singole funzionalità.

Stato delle feature:

| Spec | Stato |
|---|---|
| [crea-da-ricetta-esistente.md](docs/specs/crea-da-ricetta-esistente.md) — crea una nuova ricetta partendo da una esistente (copia + ricalcolo porzioni) | ✅ Implementata |
| [nome-file-export.md](docs/specs/nome-file-export.md) — scelta del nome del file `.json` in esportazione (nome predefinito con data, sanificazione caratteri, estensione forzata) | ✅ Implementata |
| [export-parziale.md](docs/specs/export-parziale.md) — export totale (tutti gli ingredienti, anche orfani) ed export parziale (ricette selezionate + soli ingredienti referenziati) | ✅ Implementata |
| [import-validazione.md](docs/specs/import-validazione.md) — validazione strutturale del file `.json` in importazione (formato corretto forzato, dati locali al sicuro) | ✅ Implementata |
| [autore-ricetta.md](docs/specs/autore-ricetta.md) — campo `autore` obbligatorio sulle ricette (formato dati v2 + migrazione automatica dei file v1) | ✅ Implementata |
| [ripristina-dati-iniziali.md](docs/specs/ripristina-dati-iniziali.md) — pulsante per svuotare i dati locali e ricaricare il seed, con conferma e backup opzionale | ✅ Implementata |
| [ricerca-ingredienti.md](docs/specs/ricerca-ingredienti.md) — barra di ricerca ingredienti per nome o categoria | ✅ Implementata |
| [ricerca-filtri-ricette.md](docs/specs/ricerca-filtri-ricette.md) — ricette: ricerca per nome/contenuto + filtri per tag e autore (combinati) | ✅ Implementata |

Legenda stato: ✅ Implementata · 🚧 In corso · 📋 Solo spec (da implementare).

---

## 9. Decisioni ancora aperte (da confermare con l'utente)

1. **Robustezza dell'autenticazione**: barriera morbida tra persone fidate, oppure protezione da tentativi attivi di accesso?
2. **Indicazioni del generatore**: quali parametri può fornire l'utente e come vengono combinati?
3. **Funzionamento offline**: serve che l'app funzioni offline dopo il primo caricamento (PWA), o basta l'accesso via URL con internet?
4. **Dati iniziali**: ogni utente parte da un ricettario vuoto, oppure fornisci un set di ricette/ingredienti di base al primo avvio?
5. **Hosting**: ~~dove gira il backend~~ → **Deciso (provvisorio)**: per ora deploy statico su **GitHub Pages** senza backend né autenticazione (vedi nota in §3). Da rivalutare quando si introdurrà l'auth.

---

## 10. Roadmap suggerita (fasi)

1. Definire e fissare il modello dati e le regole del generatore (spec).
2. Frontend con persistenza locale: CRUD ingredienti e ricette + export/import.
3. Generatore di ricette (scalatura porzioni come prima funzione).
4. Autenticazione e accesso riservato.
5. Rifinitura UX per utenti non tecnici + test.
