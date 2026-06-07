// "Info" panel: a short, non-technical explanation of how the app works
// (pannello-info spec). User-facing texts in Italian.

export function mostraInfo() {
  const overlay = document.createElement('div');
  overlay.className = 'form-overlay';
  overlay.innerHTML = `
    <div class="form-box form-box-large info-box">
      <h3>Come funziona Ricettario</h3>
      <p>Ricettario ti aiuta a gestire i tuoi <strong>ingredienti</strong> e le tue
      <strong>ricette</strong>. I dati restano salvati <strong>solo nel tuo browser, su questo
      dispositivo</strong>: niente viene inviato a un server.</p>
      <ul class="info-elenco">
        <li><strong>Ingredienti</strong>: aggiungili con nome, unità di misura e categoria, e
        ritrovali con la barra di ricerca per nome o categoria.</li>
        <li><strong>Ricette</strong>: creane una da zero oppure <em>partendo da una esistente</em>,
        che viene copiata; cambiando le porzioni, le quantità si ricalcolano da sole.</li>
        <li><strong>Cerca e filtra</strong>: nelle ricette puoi filtrare per tag o autore e cercare
        per nome o contenuto (anche per ingrediente usato).</li>
        <li><strong>Quantità</strong>: indica un numero oppure lasciala libera con "q.b." (quanto
        basta).</li>
        <li><strong>Esporta / Importa</strong>: salva tutti i dati in un file (o solo le ricette che
        selezioni) e ricaricalo per fare un backup o spostarti su un altro dispositivo.</li>
        <li><strong>Ripristina dati di esempio</strong>: svuota tutto e ricarica le ricette di
        esempio (puoi esportare prima un backup).</li>
      </ul>
      <p class="info-nota">Le ricette e gli ingredienti che vedi all'inizio sono <strong>solo
      esempi</strong>, per mostrarti le possibilità dell'app: modificali o eliminali pure.</p>
      <div class="form-actions">
        <button type="button" class="primary chiudi">Ho capito</button>
      </div>
    </div>
  `;
  overlay.querySelector('.chiudi').onclick = () => overlay.remove();
  document.body.append(overlay);
}
