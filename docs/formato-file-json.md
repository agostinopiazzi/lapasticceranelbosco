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
  "versione": 2,
  "ingredienti": [ /* elenco di Ingrediente */ ],
  "ricette":     [ /* elenco di Ricetta */ ]
}
```

| Campo | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| `versione` | intero | sì | Versione del formato dati. Valore corrente: **2**. Permette migrazioni future (vedi §8). |
| `ingredienti` | array di [Ingrediente](#3-ingrediente) | sì | Può essere vuoto (`[]`). |
| `ricette` | array di [Ricetta](#4-ricetta) | sì | Può essere vuoto (`[]`). |

> Campi extra non elencati qui non sono previsti dal formato. L'import li tollera (non blocca), ma
> non fanno parte della definizione canonica.

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
  "ingredienti": [
    { "ingrediente_id": "ing_010", "quantita": 25, "unita_misura": "g" },
    { "ingrediente_id": "ing_022", "quantita": null, "unita_misura": "q.b." }
  ],
  "istruzioni": [
    "Impastare gli ingredienti secchi.",
    "Aggiungere il burro freddo."
  ],
  "tag": ["frolla", "biscotti"]
}
```

| Campo | Tipo | Obbligatorio | Regole |
|---|---|---|---|
| `id` | stringa | sì | Non vuoto. **Univoco** tra tutte le ricette del file. |
| `nome` | stringa | sì | Non vuoto. |
| `autore` | stringa | sì | Non vuoto. Chi ha creato la ricetta (introdotto nella versione 2). Testo libero. |
| `porzioni_base` | intero | sì | **≥ 1**. Numero di porzioni a cui si riferiscono le quantità (base per la scalatura). |
| `ingredienti` | array di [Riga ingrediente](#41-riga-ingrediente-di-una-ricetta) | sì | Può essere vuoto (`[]`). |
| `istruzioni` | array di stringhe | sì | Passi del procedimento, in ordine. Può essere vuoto (`[]`). |
| `tag` | array di stringhe | no | Etichette libere (es. `lievitati`, `dolce`). Se presente, ogni elemento è testo non vuoto. |

### 4.1 Riga ingrediente (di una ricetta)

Collega una ricetta a un ingrediente con una quantità (relazione molti-a-molti, attributo `quantita`).

| Campo | Tipo | Obbligatorio | Regole |
|---|---|---|---|
| `ingrediente_id` | stringa | sì | Non vuoto. **Deve corrispondere** all'`id` di un ingrediente presente nello stesso file (integrità referenziale). |
| `quantita` | numero \| `null` | sì | Numero **≥ 0**, oppure `null` quando la quantità non si esprime (es. `q.b.`). |
| `unita_misura` | stringa | no | Se presente, è testo. Di norma coincide con l'`unita_misura` dell'ingrediente. |

---

## 5. Regole di integrità (riassunto)

Un file è considerato **valido** solo se rispetta **tutte** queste condizioni:

1. La radice è un oggetto con `versione`, `ingredienti`, `ricette`.
2. `versione` è uguale alla versione supportata (attualmente `1`).
3. `ingredienti` e `ricette` sono array.
4. Ogni ingrediente ha `id`, `nome`, `unita_misura`, `categoria` non vuoti.
5. Gli `id` degli ingredienti sono **univoci**.
6. Ogni ricetta ha `id` (univoco), `nome` non vuoto, `autore` non vuoto e `porzioni_base` intero ≥ 1.
7. Ogni riga ingrediente di ogni ricetta ha un `ingrediente_id` che **esiste** tra gli ingredienti
   del file e una `quantita` numero ≥ 0 oppure `null`.
8. `istruzioni` è un array di stringhe; `tag` (se presente) è un array di stringhe non vuote.

---

## 6. Esempio minimo completo e valido

```json
{
  "versione": 2,
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
    "versione": { "const": 2 },
    "ingredienti": {
      "type": "array",
      "items": { "$ref": "#/$defs/ingrediente" }
    },
    "ricette": {
      "type": "array",
      "items": { "$ref": "#/$defs/ricetta" }
    }
  },
  "$defs": {
    "ingrediente": {
      "type": "object",
      "required": ["id", "nome", "unita_misura", "categoria"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "nome": { "type": "string", "minLength": 1 },
        "unita_misura": { "type": "string", "minLength": 1 },
        "categoria": { "type": "string", "minLength": 1 }
      }
    },
    "ricetta": {
      "type": "object",
      "required": ["id", "nome", "autore", "porzioni_base", "ingredienti", "istruzioni"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "nome": { "type": "string", "minLength": 1 },
        "autore": { "type": "string", "minLength": 1 },
        "porzioni_base": { "type": "integer", "minimum": 1 },
        "ingredienti": {
          "type": "array",
          "items": { "$ref": "#/$defs/rigaIngrediente" }
        },
        "istruzioni": {
          "type": "array",
          "items": { "type": "string" }
        },
        "tag": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 }
        }
      }
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
      }
    }
  }
}
```

> Nota: il vincolo di **integrità referenziale** (ogni `ingrediente_id` deve esistere tra gli
> `ingredienti`) e l'**unicità degli id** non sono esprimibili in JSON Schema puro: sono applicati
> dal validatore dell'app ([validazione.js](../frontend/js/validazione.js)) e descritti in §5.

---

## 8. Storico versioni e migrazione

| Versione | Novità |
|---|---|
| 1 | Formato iniziale: `ingredienti` e `ricette`; la ricetta ha `id`, `nome`, `porzioni_base`, `ingredienti`, `istruzioni`, `tag`. |
| **2** (corrente) | Aggiunto il campo **obbligatorio `autore`** alle ricette. |

**Migrazione automatica in import.** Quando si importa un file di versione precedente, l'app lo
aggiorna alla versione corrente *prima* di validarlo, in modo che i vecchi backup restino
utilizzabili ([migrazione.js](../frontend/js/migrazione.js)):

- **v1 → v2**: a ogni ricetta priva di `autore` viene assegnato l'autore predefinito **"Sconosciuto"**.

L'utente viene avvisato quando un file viene aggiornato durante l'import. File con versione
sconosciuta (più recente di quella supportata) vengono invece rifiutati dalla validazione.
