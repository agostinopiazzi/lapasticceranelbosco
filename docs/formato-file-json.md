# Formato del file dati JSON (Ricettario)

> **Scopo di questo documento.** Descrivere in modo **univoco e completo** la struttura del file
> `.json` usato dall'app Ricettario per export, import e dati iniziali (`seed`). È un documento di
> **riferimento**: non è letto né eseguito dal codice. Serve a una persona — o a un'intelligenza
> artificiale — per capire e ragionare sui dati di questa repo senza dover leggere il codice.
>
> La **validazione a runtime** che applica queste regole vive in
> [../frontend/js/validazione.js](../frontend/js/validazione.js); la feature è descritta in
> [specs/import-validazione.md](specs/import-validazione.md). Se il formato cambia, aggiornare
> insieme: questo documento, il validatore, e `CLAUDE.md` §5b.

---

## 1. A cosa serve il file

Lo stesso identico formato è usato in tre punti:

| Uso | File | Direzione |
|---|---|---|
| Dati iniziali (primo avvio) | `frontend/data/seed.json` | letto dall'app |
| Esporta / backup | file scelto dall'utente (es. `ricettario-2026-06-07.json`) | scritto dall'app |
| Importa / ripristino | file scelto dall'utente | letto e validato dall'app |

I dati vivono solo nel browser dell'utente (IndexedDB); questo file è il loro formato di scambio.

---

## 2. Struttura generale

Il file è **un singolo oggetto JSON** con esattamente questi tre campi di primo livello:

```json
{
  "versione": 3,
  "ingredienti": [ /* elenco di Ingrediente */ ],
  "ricette":     [ /* elenco di Ricetta */ ]
}
```

| Campo | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| `versione` | intero | sì | Versione del formato dati. Valore corrente: **3**. Permette migrazioni future (vedi §8). |
| `ingredienti` | array di [Ingrediente](#3-ingrediente) | sì | Può essere vuoto (`[]`). |
| `ricette` | array di [Ricetta](#4-ricetta) | sì | Può essere vuoto (`[]`). |

> **Campi extra non sono ammessi.** Qualunque campo non elencato — a livello di file, ingrediente,
> ricetta o riga ingrediente — fa **fallire l'import**. Sono consentiti esattamente i campi descritti
> in questo documento, né più né meno (oltre a quelli facoltativi, che possono mancare).

---

## 3. Ingrediente

Un ingrediente del ricettario.

```json
{
  "id": "ing_001",
  "nome": "Farina 00",
  "unita_misura": "g",
  "categoria": "farine"
}
```

| Campo | Tipo | Obbligatorio | Regole |
|---|---|---|---|
| `id` | stringa | sì | Non vuoto. **Univoco** tra tutti gli ingredienti del file. È la chiave a cui fanno riferimento le ricette. |
| `nome` | stringa | sì | Non vuoto. Nome leggibile (es. "Farina 00"). |
| `unita_misura` | stringa | sì | Non vuota. Unità in cui si esprimono le quantità (es. `g`, `ml`, `pz`, `q.b.`). |
| `categoria` | stringa | sì | Non vuota. Raggruppamento (es. `farine`, `zuccheri`, `grassi`). |

**Convenzione id** (non imposta dalla validazione): gli id del set iniziale sono `ing_001`,
`ing_002`, …; quelli creati dall'utente sono del tipo `ing_<timestamp>_<numero>` per evitare
collisioni. Qualunque stringa non vuota e univoca è comunque valida.

---

## 4. Ricetta

Una ricetta, con le sue righe di ingredienti e il procedimento.

```json
{
  "id": "ric_001",
  "nome": "Frollino Earl Grey",
  "autore": "La Pasticcera nel Bosco",
  "porzioni_base": 1,
  "resa": { "quantita": 25, "unita_misura": "g" },
  "ingredienti": [
    { "ingrediente_id": "ing_010", "quantita": 25, "unita_misura": "g" },
    { "ingrediente_id": "ing_022", "quantita": null, "unita_misura": "q.b." }
  ],
  "istruzioni": [
    "Impastare gli ingredienti secchi.",
    "Aggiungere il burro freddo."
  ],
  "mise_en_place": {
    "ingredienti": [
      { "ingrediente_id": "ing_010", "quantita": 25, "unita_misura": "g" }
    ],
    "istruzioni": ["Pesare gli ingredienti secchi."]
  },
  "tag": ["frolla", "biscotti"]
}
```

| Campo | Tipo | Obbligatorio | Regole |
|---|---|---|---|
| `id` | stringa | sì | Non vuoto. **Univoco** tra tutte le ricette del file. |
| `nome` | stringa | sì | Non vuoto. |
| `autore` | stringa | sì | Non vuoto. Chi ha creato la ricetta (introdotto nella versione 2). Testo libero. |
| `porzioni_base` | intero | sì | **≥ 1**. Numero di porzioni a cui si riferiscono le quantità (base per la scalatura). |
| `resa` | oggetto [Resa](#42-resa-di-una-ricetta) | sì | Quanto produce la ricetta alle sue `porzioni_base` (introdotta nella versione 3). Dà senso alla quantità con cui la ricetta è richiamata come sotto-ricetta. |
| `ingredienti` | array di [Riga](#41-riga-di-ingredienti-di-una-ricetta) | sì | Può essere vuoto (`[]`). Ogni riga è un ingrediente **oppure** una sotto-ricetta. |
| `istruzioni` | array di stringhe | sì | Passi del procedimento, in ordine. Può essere vuoto (`[]`). |
| `mise_en_place` | oggetto [Mise en place](#43-mise-en-place) | no | Preparazione preliminare inline (introdotta nella versione 3). Presente solo quando serve. |
| `tag` | array di stringhe | no | Etichette libere (es. `lievitati`, `dolce`). Se presente, ogni elemento è testo non vuoto. |

### 4.1 Riga (di ingredienti di una ricetta)

Una riga della lista `ingredienti` (sia principale sia del mise en place) è di **una di due forme**.
Ha **esattamente uno** tra `ingrediente_id` e `ricetta_id`.

**Forma A — riga ingrediente** (collega la ricetta a un ingrediente):

| Campo | Tipo | Obbligatorio | Regole |
|---|---|---|---|
| `ingrediente_id` | stringa | sì | Non vuoto. **Deve corrispondere** all'`id` di un ingrediente presente nello stesso file (integrità referenziale). |
| `quantita` | numero \| `null` | sì | Numero **≥ 0**, oppure `null` quando la quantità non si esprime (es. `q.b.`). |
| `unita_misura` | stringa | no | Se presente, è testo. Di norma coincide con l'`unita_misura` dell'ingrediente. |

**Forma B — riga sotto-ricetta** (usa un'altra ricetta come componente, introdotta nella versione 3):

| Campo | Tipo | Obbligatorio | Regole |
|---|---|---|---|
| `ricetta_id` | stringa | sì | Non vuoto. **Deve corrispondere** all'`id` di una ricetta presente nello stesso file (integrità referenziale). Non può creare cicli (vedi §5). |
| `quantita` | numero \| `null` | sì | Numero **≥ 0**, oppure `null`. Si riferisce alla `resa` della ricetta richiamata (es. `200` di una resa da `500 g`). |
| `unita_misura` | stringa | no | Se presente, è testo. Di norma coincide con l'`unita_misura` della `resa` della ricetta richiamata. |

### 4.2 Resa di una ricetta

Oggetto che dichiara quanto produce la ricetta alle sue `porzioni_base`.

| Campo | Tipo | Obbligatorio | Regole |
|---|---|---|---|
| `quantita` | numero | sì | **≥ 0**. |
| `unita_misura` | stringa | sì | Non vuota (es. `g`, `ml`, `pz`). |

> **Valore predefinito** (quando la resa non è nota, in migrazione o nel form): `quantita` = somma
> delle quantità numeriche delle righe della lista ingredienti; `unita_misura` = l'unità prevalente
> tra quelle righe (default `g`). È un default grezzo, correggibile.

### 4.3 Mise en place

Mini-ricetta **inline** con la preparazione preliminare. Non ha porzioni proprie: eredita le
`porzioni_base` della ricetta madre.

| Campo | Tipo | Obbligatorio | Regole |
|---|---|---|---|
| `ingredienti` | array di [Riga](#41-riga-di-ingredienti-di-una-ricetta) | sì | Stesse righe della lista principale (ingrediente o sotto-ricetta). Può essere vuoto (`[]`). |
| `istruzioni` | array di stringhe | sì | Passi della preparazione preliminare. Può essere vuoto (`[]`). |

---

## 5. Regole di integrità (riassunto)

Un file è considerato **valido** solo se rispetta **tutte** queste condizioni:

1. La radice è un oggetto con `versione`, `ingredienti`, `ricette`.
2. `versione` è uguale alla versione supportata (attualmente `3`).
3. `ingredienti` e `ricette` sono array.
4. Ogni ingrediente ha `id`, `nome`, `unita_misura`, `categoria` non vuoti.
5. Gli `id` degli ingredienti sono **univoci**.
6. Ogni ricetta ha `id` (univoco), `nome` non vuoto, `autore` non vuoto, `porzioni_base` intero ≥ 1
   e una `resa` valida (`quantita` numero ≥ 0, `unita_misura` non vuota).
7. Ogni riga (lista principale o mise en place) ha **esattamente uno** tra `ingrediente_id` e
   `ricetta_id`, e una `quantita` numero ≥ 0 oppure `null`. L'`ingrediente_id` **esiste** tra gli
   ingredienti del file; il `ricetta_id` **esiste** tra le ricette del file.
8. **Nessun ciclo** tra ricette: una ricetta non può richiamare sé stessa né, tramite una catena di
   `ricetta_id` (anche attraverso i mise en place), tornare a sé stessa.
9. `istruzioni` è un array di stringhe; `tag` (se presente) è un array di stringhe non vuote.
10. `mise_en_place` (se presente) è un oggetto con `ingredienti` (array di righe) e `istruzioni`
    (array di stringhe).
11. **Nessun campo non previsto** a nessun livello (file, ingrediente, ricetta, riga, resa, mise en
    place): la presenza di campi estranei fa fallire l'import.

---

## 6. Esempio minimo completo e valido

```json
{
  "versione": 3,
  "ingredienti": [
    { "id": "ing_001", "nome": "Farina 00", "unita_misura": "g", "categoria": "farine" },
    { "id": "ing_002", "nome": "Acqua", "unita_misura": "g", "categoria": "liquidi" }
  ],
  "ricette": [
    {
      "id": "ric_001",
      "nome": "Pane base",
      "autore": "Mario Rossi",
      "porzioni_base": 4,
      "resa": { "quantita": 800, "unita_misura": "g" },
      "ingredienti": [
        { "ingrediente_id": "ing_001", "quantita": 500, "unita_misura": "g" },
        { "ingrediente_id": "ing_002", "quantita": 300, "unita_misura": "g" }
      ],
      "istruzioni": ["Impastare", "Lievitare", "Cuocere"],
      "tag": ["lievitati"]
    }
  ]
}
```

### 6.1 Esempio con sotto-ricetta e mise en place

`Crostata` usa `Pasta frolla` come componente (riga sotto-ricetta) e ha una mise en place inline.

```json
{
  "versione": 3,
  "ingredienti": [
    { "id": "ing_001", "nome": "Farina 00", "unita_misura": "g", "categoria": "farine" },
    { "id": "ing_002", "nome": "Burro", "unita_misura": "g", "categoria": "grassi" },
    { "id": "ing_003", "nome": "Confettura", "unita_misura": "g", "categoria": "conserve" }
  ],
  "ricette": [
    {
      "id": "ric_frolla",
      "nome": "Pasta frolla",
      "autore": "La Pasticcera nel Bosco",
      "porzioni_base": 1,
      "resa": { "quantita": 500, "unita_misura": "g" },
      "ingredienti": [
        { "ingrediente_id": "ing_001", "quantita": 300, "unita_misura": "g" },
        { "ingrediente_id": "ing_002", "quantita": 200, "unita_misura": "g" }
      ],
      "istruzioni": ["Impastare velocemente.", "Riposo in frigo 30 minuti."]
    },
    {
      "id": "ric_crostata",
      "nome": "Crostata",
      "autore": "La Pasticcera nel Bosco",
      "porzioni_base": 8,
      "resa": { "quantita": 700, "unita_misura": "g" },
      "ingredienti": [
        { "ricetta_id": "ric_frolla", "quantita": 450, "unita_misura": "g" },
        { "ingrediente_id": "ing_003", "quantita": 250, "unita_misura": "g" }
      ],
      "istruzioni": ["Stendere la frolla.", "Farcire con la confettura.", "Cuocere a 180°C."],
      "mise_en_place": {
        "ingredienti": [
          { "ingrediente_id": "ing_002", "quantita": 10, "unita_misura": "g" }
        ],
        "istruzioni": ["Imburrare lo stampo."]
      }
    }
  ]
}
```

---

## 7. Appendice — Schema formale (JSON Schema)

Descrizione **machine-readable** equivalente alle regole sopra (JSON Schema Draft 2020-12). Utile
per ragionamento automatico o per generare validatori in altri linguaggi. Non è usata dall'app.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Ricettario data file",
  "type": "object",
  "required": ["versione", "ingredienti", "ricette"],
  "properties": {
    "versione": { "const": 3 },
    "ingredienti": {
      "type": "array",
      "items": { "$ref": "#/$defs/ingrediente" }
    },
    "ricette": {
      "type": "array",
      "items": { "$ref": "#/$defs/ricetta" }
    }
  },
  "additionalProperties": false,
  "$defs": {
    "ingrediente": {
      "type": "object",
      "required": ["id", "nome", "unita_misura", "categoria"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "nome": { "type": "string", "minLength": 1 },
        "unita_misura": { "type": "string", "minLength": 1 },
        "categoria": { "type": "string", "minLength": 1 }
      },
      "additionalProperties": false
    },
    "ricetta": {
      "type": "object",
      "required": ["id", "nome", "autore", "porzioni_base", "resa", "ingredienti", "istruzioni"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "nome": { "type": "string", "minLength": 1 },
        "autore": { "type": "string", "minLength": 1 },
        "porzioni_base": { "type": "integer", "minimum": 1 },
        "resa": { "$ref": "#/$defs/resa" },
        "ingredienti": {
          "type": "array",
          "items": { "$ref": "#/$defs/riga" }
        },
        "istruzioni": {
          "type": "array",
          "items": { "type": "string" }
        },
        "mise_en_place": { "$ref": "#/$defs/miseEnPlace" },
        "tag": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 }
        }
      },
      "additionalProperties": false
    },
    "resa": {
      "type": "object",
      "required": ["quantita", "unita_misura"],
      "properties": {
        "quantita": { "type": "number", "minimum": 0 },
        "unita_misura": { "type": "string", "minLength": 1 }
      },
      "additionalProperties": false
    },
    "miseEnPlace": {
      "type": "object",
      "required": ["ingredienti", "istruzioni"],
      "properties": {
        "ingredienti": {
          "type": "array",
          "items": { "$ref": "#/$defs/riga" }
        },
        "istruzioni": {
          "type": "array",
          "items": { "type": "string" }
        }
      },
      "additionalProperties": false
    },
    "riga": {
      "oneOf": [
        { "$ref": "#/$defs/rigaIngrediente" },
        { "$ref": "#/$defs/rigaSottoRicetta" }
      ]
    },
    "rigaIngrediente": {
      "type": "object",
      "required": ["ingrediente_id", "quantita"],
      "properties": {
        "ingrediente_id": { "type": "string", "minLength": 1 },
        "quantita": {
          "anyOf": [
            { "type": "number", "minimum": 0 },
            { "type": "null" }
          ]
        },
        "unita_misura": { "type": "string" }
      },
      "additionalProperties": false
    },
    "rigaSottoRicetta": {
      "type": "object",
      "required": ["ricetta_id", "quantita"],
      "properties": {
        "ricetta_id": { "type": "string", "minLength": 1 },
        "quantita": {
          "anyOf": [
            { "type": "number", "minimum": 0 },
            { "type": "null" }
          ]
        },
        "unita_misura": { "type": "string" }
      },
      "additionalProperties": false
    }
  }
}
```

> Nota: i vincoli di **integrità referenziale** (ogni `ingrediente_id` deve esistere tra gli
> `ingredienti`, ogni `ricetta_id` tra le `ricette`), l'**unicità degli id** e l'**assenza di cicli**
> tra ricette non sono esprimibili in JSON Schema puro: sono applicati dal validatore dell'app
> ([validazione.js](../frontend/js/validazione.js)) e descritti in §5.

---

## 8. Storico versioni e migrazione

| Versione | Novità |
|---|---|
| 1 | Formato iniziale: `ingredienti` e `ricette`; la ricetta ha `id`, `nome`, `porzioni_base`, `ingredienti`, `istruzioni`, `tag`. |
| 2 | Aggiunto il campo **obbligatorio `autore`** alle ricette. |
| **3** (corrente) | Ricette **componibili**: una riga può riferire una ricetta (`ricetta_id`) oltre a un ingrediente. Aggiunti `resa` (obbligatoria) e `mise_en_place` (facoltativa). Vietati i cicli tra ricette. |

**Migrazione automatica in import.** Quando si importa un file di versione precedente, l'app lo
aggiorna alla versione corrente *prima* di validarlo, in modo che i vecchi backup restino
utilizzabili ([migrazione.js](../frontend/js/migrazione.js)). Le migrazioni si applicano a cascata
(v1 → v2 → v3):

- **v1 → v2**: a ogni ricetta priva di `autore` viene assegnato l'autore predefinito **"Sconosciuto"**.
- **v2 → v3**: a ogni ricetta priva di `resa` viene assegnata una resa predefinita (somma delle
  quantità degli ingredienti, unità prevalente — vedi §4.3). `mise_en_place` resta assente (facoltativa).

L'utente viene avvisato quando un file viene aggiornato durante l'import. File con versione
sconosciuta (più recente di quella supportata) vengono invece rifiutati dalla validazione.
