# Feature: Pannello "Info" (come funziona l'app)

## Obiettivo
Offrire all'utente, soprattutto se poco esperto, una spiegazione **breve e chiara** di come funziona
l'applicazione e di cosa può fare, accessibile in qualsiasi momento.

## Comportamento
1. In alto è presente un pulsante **"Info"**.
2. Al clic si apre una finestra con un testo sintetico in italiano che spiega:
   - cosa fa l'app e che i dati restano **solo nel browser** dell'utente;
   - le due sezioni **Ingredienti** e **Ricette** e come usarle (ricerca, filtri, creazione da una
     ricetta esistente con ricalcolo porzioni);
   - le quantità libere ("q.b.");
   - **Esporta/Importa** per backup e cambio dispositivo;
   - **Ripristina dati di esempio**;
   - il fatto che i dati iniziali sono **solo esempi**, modificabili o eliminabili.
3. Un pulsante **"Ho capito"** chiude la finestra.

## Dati coinvolti
- Nessuno: è solo testo informativo statico. Non legge né modifica dati.

## Vincoli
- Testo in italiano, senza gergo tecnico.
- Nessuna intelligenza artificiale.

## Usabilità
- Pulsante sempre raggiungibile dall'intestazione.
- Finestra leggibile e scorrevole su schermi piccoli.

## Casi limite
- Apertura ripetuta del pannello → semplicemente si riapre; nessuno stato da gestire.
