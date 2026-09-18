// Genera la pagina dedicata di un appuntamento creato dal pannello
// (quelli che non hanno una pagina scritta a mano come Barolo & Barbaresco
// o il Sud Wine Festival). Stessa struttura grafica del resto del sito.

const IMMAGINE_DEFAULT = 'https://images.unsplash.com/photo-1676476623306-566a9b7afc44?auto=format&fit=crop&w=1400&q=80';

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// toglie i tag HTML (la descrizione può ora contenere grassetto/corsivo/elenchi
// scritti con l'editor del pannello) per ottenere un riassunto in testo semplice
function testoSenzaTag(s) {
  return String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function metaDescrizione(ev) {
  const testo = testoSenzaTag(ev.descrizione) || testoSenzaTag(ev.sottotitolo) || testoSenzaTag(ev.titolo);
  return testo.length > 155 ? testo.slice(0, 152) + '…' : testo;
}

function eventoPageHtml(ev) {
  const slug = escHtml(ev.slug);
  const slugEnc = encodeURIComponent(ev.slug);
  const titolo = escHtml(ev.titolo || 'Appuntamento');
  const sottotitolo = escHtml(ev.sottotitolo || '');
  // fallback mostrato prima che js/eventi.js carichi e ripulisca la versione
  // formattata dal server; se il testo salvato contiene già dei tag (scritto
  // con l'editor grassetto/corsivo/elenchi) lo passa così com'è, altrimenti
  // lo tratta come testo semplice
  const descrizioneGrezza = ev.descrizione || '';
  const descrizione = descrizioneGrezza.indexOf('<') !== -1
    ? descrizioneGrezza
    : '<p>' + escHtml(descrizioneGrezza) + '</p>';
  const luogo = escHtml(ev.luogo || '');
  const dataTesto = escHtml(ev.data_testo || '');
  const immagine = ev.immagine ? escHtml(ev.immagine) : IMMAGINE_DEFAULT;

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titolo} — Areale</title>
<meta name="description" content="${escHtml(metaDescrizione(ev))}">
<link rel="icon" href="img/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=Archivo:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="css/style.css?v=9">
</head>
<body>

<header class="site-header">
  <div class="wrap bar">
    <a href="index.html" class="brand">Areale <small>ASSOCIAZIONE&nbsp;CULTURALE</small></a>
    <button class="nav-toggle" aria-label="Apri il menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
    <nav class="main-nav">
      <a href="index.html">Home</a>
      <a href="serate.html">Gli appuntamenti</a>
      <a href="evento-barolo-barbaresco.html">Barolo &amp; Barbaresco</a>
      <a href="evento-sud-wine-festival.html">Sud Wine Festival</a>
      <a href="tessera.html">Diventa socio</a>
      <div class="nav-cta">
        <a href="prenota.html" class="btn btn-primary">Prenota un appuntamento</a>
      </div>
    </nav>
  </div>
</header>

<section class="hero" style="min-height: 62vh;">
  <img src="${immagine}" alt="${titolo}" data-evento-img="${slug}">
  <div class="hero-content">
    <span class="legend"><span class="dot"></span>Appuntamento</span>
    <h1 data-evento="${slug}:titolo">${titolo}</h1>
    <p class="lede" data-evento="${slug}:sottotitolo">${sottotitolo}</p>
    <div class="cta-row">
      <a href="prenota.html?evento=${slugEnc}" class="btn btn-primary">Prenota il tuo posto</a>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="section-head">
      <h2>Descrizione</h2>
    </div>
    <div class="prose-wide" data-evento="${slug}:descrizione" data-evento-rich>
      ${descrizione}
    </div>
  </div>
</section>

<section class="alt-bg">
  <div class="wrap">
    <div class="section-head">
      <h2>Informazioni pratiche</h2>
    </div>
    <ul class="feature-meta" style="flex-direction:column; gap:14px; font-size:1.02rem;">
      <li data-evento="${slug}:data_testo">${dataTesto || 'Data da confermare'}</li>
      <li>Luogo: <span data-evento="${slug}:luogo">${luogo || 'da confermare'}</span></li>
    </ul>
    <div class="cta-row" style="margin-top:2em;">
      <a href="prenota.html?evento=${slugEnc}" class="btn btn-primary">Prenota il tuo posto</a>
      <a href="serate.html" class="btn-ghost">Vedi gli altri appuntamenti</a>
    </div>
  </div>
</section>

<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <p class="brand">Areale</p>
        <p>Associazione Culturale — Terracina (LT)<br>Degustazioni, eventi e cultura del vino.</p>
      </div>
      <div>
        <h4>Il sito</h4>
        <ul>
          <li><a href="serate.html">Gli appuntamenti</a></li>
          <li><a href="prenota.html">Prenota</a></li>
          <li><a href="tessera.html">Diventa socio</a></li>
          <li><a href="privacy.html">Informativa privacy</a></li>
        </ul>
      </div>
      <div>
        <h4>Eventi speciali</h4>
        <ul>
          <li><a href="evento-barolo-barbaresco.html">Barolo &amp; Barbaresco vista mare</a></li>
          <li><a href="evento-sud-wine-festival.html">Sud Wine Festival</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 Associazione Culturale Areale — Terracina</span>
      <span><a href="mailto:associazioneareale@gmail.com">associazioneareale@gmail.com</a></span>
    </div>
  </div>
</footer>

<script src="js/main.js?v=6"></script>
<script src="js/eventi.js?v=11"></script>
</body>
</html>
`;
}

module.exports = { eventoPageHtml, IMMAGINE_DEFAULT };
