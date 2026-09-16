// Server locale per Areale.
// - serve il sito statico (le stesse pagine di prima)
// - riceve le prenotazioni dal form di prenota.html e le salva nel database
// - espone titolo/sottotitolo/data/luogo/descrizione degli appuntamenti,
//   letti dal sito pubblico e modificabili dal pannello
// - due pannelli di gestione protetti da login: /admin.html (prenotazioni)
//   e /admin-eventi.html (appuntamenti)

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const basicAuth = require('express-basic-auth');
const db = require('./db');
const { eventoPageHtml } = require('./evento-template');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_ROOT = path.join(__dirname, '..');
// Le immagini caricate dal pannello vivono nella cartella "storage", insieme
// al database (vedi server/db.js) — così tutti i dati "vivi" del sito stanno
// in un unico posto, comodo da individuare per i backup e da montare come
// disco persistente quando il sito sarà online (es. Render). STORAGE_ROOT è
// configurabile con una variabile d'ambiente per quel caso; in locale è
// semplicemente la cartella "storage" accanto a "server".
const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(SITE_ROOT, 'storage');
const IMG_EVENTI_DIR = path.join(STORAGE_ROOT, 'img', 'eventi');
fs.mkdirSync(IMG_EVENTI_DIR, { recursive: true });

// Prima di questa versione le immagini vivevano in img/eventi, dentro la
// cartella pubblica del sito. Se ce ne sono ancora lì (installazioni già in
// uso) le copia nella nuova posizione, così le immagini già caricate non si
// perdono e restano raggiungibili allo stesso indirizzo di sempre.
const LEGACY_IMG_EVENTI_DIR = path.join(SITE_ROOT, 'img', 'eventi');
function migraImmaginiVecchie() {
  try {
    if (path.resolve(LEGACY_IMG_EVENTI_DIR) === path.resolve(IMG_EVENTI_DIR)) return;
    if (!fs.existsSync(LEGACY_IMG_EVENTI_DIR)) return;
    fs.readdirSync(LEGACY_IMG_EVENTI_DIR).forEach((f) => {
      const src = path.join(LEGACY_IMG_EVENTI_DIR, f);
      const dest = path.join(IMG_EVENTI_DIR, f);
      if (!fs.existsSync(dest) && fs.statSync(src).isFile()) {
        fs.copyFileSync(src, dest);
        console.log(`Immagine trovata in una posizione precedente: copiata in storage/img/eventi/${f}.`);
      }
    });
  } catch (e) {
    console.warn('Migrazione immagini non riuscita (non bloccante):', e.message);
  }
}
migraImmaginiVecchie();

const uploadImmagine = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, IMG_EVENTI_DIR),
    filename: (req, file, cb) => {
      const ev = db.eventi.get(req.params.id);
      const base = ev ? ev.slug : 'evento-' + Date.now();
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      cb(null, base + ext);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Formato immagine non supportato (usa JPG, PNG, WEBP o GIF).'));
  },
});

// elimina eventuali immagini precedenti dello stesso appuntamento con
// estensione diversa, per non lasciare file orfani sul disco
function pulisciVecchieImmagini(slug, fileDaTenere) {
  try {
    fs.readdirSync(IMG_EVENTI_DIR).forEach((f) => {
      if (f !== fileDaTenere && f.startsWith(slug + '.')) {
        fs.unlinkSync(path.join(IMG_EVENTI_DIR, f));
      }
    });
  } catch (e) {
    // non bloccante
  }
}

// ==========================================================================
// MODIFICA QUI per cambiare le credenziali di accesso ai pannelli:
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'areale2026';
// ==========================================================================

const auth = basicAuth({
  users: { [ADMIN_USER]: ADMIN_PASS },
  challenge: true,
  realm: 'Areale - Pannello di gestione',
});

app.use(express.json());

// ---------------------------------------------------------------------
// API pubblica: il form di prenotazione del sito invia qui i dati
// ---------------------------------------------------------------------
app.post('/api/prenotazioni', (req, res) => {
  const body = req.body || {};
  const { evento, nome, cognome, email, telefono } = body;

  if (!evento || !nome || !cognome || !email || !telefono) {
    return res.status(400).json({ ok: false, error: 'Compila tutti i campi obbligatori.' });
  }

  // honeypot anti-spam (campo nascosto che un utente reale lascia vuoto)
  if (body['bot-field']) {
    return res.json({ ok: true }); // finge successo, ma non salva nulla
  }

  const id = db.prenotazioni.create({
    evento,
    nome,
    cognome,
    email,
    telefono,
    posti: Math.max(1, Math.min(10, Number(body.posti) || 1)),
    socio: body.socio === 'si' ? 'si' : 'no',
    note: body.note || '',
  });

  res.json({ ok: true, id });
});

// ---------------------------------------------------------------------
// API pubblica: dati degli appuntamenti (letti da index/serate/pagine evento)
// ---------------------------------------------------------------------
app.get('/api/eventi', (req, res) => {
  res.json(db.eventi.getAll(req.query));
});

// ---------------------------------------------------------------------
// Pannelli di gestione e relative API di scrittura: protetti da login
// ---------------------------------------------------------------------
app.get('/admin.html', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});
app.get('/admin.js', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'admin.js'));
});
app.get('/admin-eventi.html', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'admin-eventi.html'));
});
app.get('/admin-eventi.js', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'admin-eventi.js'));
});

app.get('/api/prenotazioni', auth, (req, res) => {
  res.json(db.prenotazioni.getAll(req.query));
});

app.patch('/api/prenotazioni/:id/stato', auth, (req, res) => {
  const { stato } = req.body || {};
  if (!['nuova', 'confermata', 'annullata'].includes(stato)) {
    return res.status(400).json({ ok: false, error: 'Stato non valido.' });
  }
  db.prenotazioni.updateStato(req.params.id, stato);
  res.json({ ok: true });
});

app.delete('/api/prenotazioni/:id', auth, (req, res) => {
  db.prenotazioni.remove(req.params.id);
  res.json({ ok: true });
});

app.get('/api/prenotazioni/export.csv', auth, (req, res) => {
  const csv = db.prenotazioni.exportCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="prenotazioni.csv"');
  res.send('﻿' + csv); // BOM iniziale: Excel apre gli accenti correttamente
});

app.post('/api/eventi', auth, (req, res) => {
  const b = req.body || {};
  if (!b.titolo) {
    return res.status(400).json({ ok: false, error: 'Il titolo è obbligatorio.' });
  }
  const evento = db.eventi.create(b);
  res.json({ ok: true, evento });
});

app.patch('/api/eventi/:id', auth, (req, res) => {
  const aggiornato = db.eventi.update(req.params.id, req.body || {});
  if (!aggiornato) {
    return res.status(404).json({ ok: false, error: 'Appuntamento non trovato.' });
  }
  res.json({ ok: true, evento: aggiornato });
});

// immagine di copertina di un appuntamento (usata come "presentazione"
// dell'evento in home, nell'elenco e nella pagina dedicata)
app.post('/api/eventi/:id/immagine', auth, (req, res) => {
  uploadImmagine.single('immagine')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ ok: false, error: err.message || 'Errore nel caricamento del file.' });
    }
    const ev = db.eventi.get(req.params.id);
    if (!ev) return res.status(404).json({ ok: false, error: 'Appuntamento non trovato.' });
    if (!req.file) return res.status(400).json({ ok: false, error: 'Nessun file ricevuto.' });

    pulisciVecchieImmagini(ev.slug, req.file.filename);
    const aggiornato = db.eventi.update(ev.id, { immagine: 'img/eventi/' + req.file.filename });
    res.json({ ok: true, evento: aggiornato });
  });
});

app.delete('/api/eventi/:id', auth, (req, res) => {
  const ev = db.eventi.get(req.params.id);
  db.eventi.remove(req.params.id);
  if (ev) pulisciVecchieImmagini(ev.slug, null);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------
// Pagina dedicata di un appuntamento: se esiste già un file scritto a mano
// (es. evento-barolo-barbaresco.html) viene servito quello; altrimenti la
// pagina viene generata al volo dai dati dell'appuntamento nel database —
// così ogni nuovo appuntamento creato dal pannello ha subito una sua pagina.
// ---------------------------------------------------------------------
app.get(/^\/evento-([a-z0-9-]+)\.html$/, (req, res, next) => {
  const slug = req.params[0];
  const paginaScrittaAMano = path.join(SITE_ROOT, `evento-${slug}.html`);
  if (fs.existsSync(paginaScrittaAMano)) return next();

  const ev = db.eventi.get(slug);
  if (!ev) return res.status(404).send('Appuntamento non trovato.');
  res.send(eventoPageHtml(ev));
});

// ---------------------------------------------------------------------
// Immagini degli appuntamenti: fisicamente dentro "storage" (vedi sopra),
// ma raggiungibili all'indirizzo di sempre (img/eventi/...), esattamente
// come i valori già salvati nel database e i tag <img> del sito.
// ---------------------------------------------------------------------
app.use('/img/eventi', express.static(IMG_EVENTI_DIR));

// ---------------------------------------------------------------------
// Sito pubblico (le pagine statiche esistenti)
// ---------------------------------------------------------------------
app.use(express.static(SITE_ROOT));

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log('====================================================');
      console.log('  Areale — server avviato');
      console.log('====================================================');
      console.log(`  Sito:               http://localhost:${PORT}/`);
      console.log(`  Pannello prenot.:   http://localhost:${PORT}/admin.html`);
      console.log(`  Pannello eventi:    http://localhost:${PORT}/admin-eventi.html`);
      console.log(`  Utente:             ${ADMIN_USER}`);
      console.log(`  Password:           ${ADMIN_PASS}`);
      console.log('====================================================');
    });
  })
  .catch((err) => {
    console.error('Errore in avvio:', err);
    process.exit(1);
  });
