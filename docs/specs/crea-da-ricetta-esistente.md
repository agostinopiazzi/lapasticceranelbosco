# Feature: Crea ricetta partendo da una esistente

## Obiettivo
All'avvio della creazione di una nuova ricetta, l'utente può scegliere se partire da zero o duplicare una ricetta già presente nel database, usandola come base da modificare.

## Comportamento
1. L'utente avvia "Nuova ricetta".
2. Il sistema chiede: **"Parti da zero"** oppure **"Parti da una ricetta esistente"**.
3. Se sceglie "esistente":
   - mostra l'elenco delle ricette (con ricerca per nome);
   - selezionata una ricetta, ne copia in una **nuova bozza** nome, porzioni, ingredienti (con quantità e unità) e procedimento;
   - la bozza è completamente modificabile e **non altera** la ricetta originale.
4. Al salvataggio viene creata una ricetta nuova e indipendente.

## Dati copiati dalla ricetta base
- Nome (suggerito come "Copia di …", modificabile)
- Numero di porzioni
- Elenco ingredienti: ingrediente, quantità, unità di misura
- Procedimento / note

## Ricalcolo quantità (opzionale)
Se l'utente cambia il numero di porzioni della bozza, le quantità degli ingredienti vengono ricalcolate in proporzione:

    nuova_quantità = quantità_base × (nuove_porzioni ÷ porzioni_base)

Il risultato è arrotondato secondo la regola già usata nel programma per la generazione ricette.

## Vincoli
- L'operazione **non modifica mai** la ricetta di origine.
- Gli ingredienti copiati devono già esistere nel database ingredienti (nessun nuovo ingrediente creato automaticamente).
- Funziona senza intelligenza artificiale.

## Usabilità
- Scelta iniziale con due pulsanti grandi e testo chiaro.
- Selezione ricetta con barra di ricerca per nome.
- Conferma a fine creazione che la nuova ricetta è stata salvata.

## Casi limite
- Database ricette vuoto → l'opzione "Parti da una ricetta esistente" è disattivata.
- Porzioni base mancanti o pari a 0 → il ricalcolo proporzionale è disabilitato; quantità copiate invariate.
