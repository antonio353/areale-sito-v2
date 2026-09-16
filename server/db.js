// Livello dati: SQLite reale via sql.js (compilato in WebAssembly, nessuna
// dipendenza nativa da compilare — funziona su qualunque PC con Node.js).
// Il database vive in un unico file binario, dentro la cartella "storage"
// (alla radice del sito, fuori da "server"), che viene riscritta su disco
// dopo ogni modifica. Tutti i dati "vivi" del sito (database + immagini
// caricate) stanno in quella cartella: comoda da individuare per i backup,
// e pensata per corrispondere a un unico "disco persistente" quando il sito
// sarà online (es. Render).
//
// Due tabelle:
//  - prenotazioni: le richieste ricevute dal form "Prenota una serata"
//  - eventi: titolo/sottotitolo/data/luogo/descrizione dei vari appuntamenti,
//    mostrati in home, nell'elenco appuntamenti e nelle pagine dedicate

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const SITE_ROOT = path.join(__dirname, '..');
// STORAGE_ROOT è configurabile con una variabile d'ambiente: utile in hosting
// (es. Render) per puntare a un disco persistente montato altrove. In locale,
// di default, è semplicemente la cartella "storage" accanto a "server".
const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(SITE_ROOT, 'storage');
const DATA_DIR = path.join(STORAGE_ROOT, 'data');
// Nota: prima di questa versione il file si chiamava prenotazioni.sqlite, e
// prima ancora viveva dentro server/data invece che in storage/data. Se
// esiste ancora un file di una di queste posizioni precedenti (installazioni
// già in uso) lo si legge comunque, così i dati già raccolti non si perdono:
// al primo avvio con questa versione vengono letti da lì e poi riscritti
// nella nuova posizione (storage/data/areale.sqlite).
const DB_FILE = path.join(DATA_DIR, 'areale.sqlite');
const OLD_DB_FILE = path.join(DATA_DIR, 'prenotazioni.sqlite');
const LEGACY_DATA_DIR = path.join(__dirname, 'data');
const LEGACY_DB_FILE = path.join(LEGACY_DATA_DIR, 'areale.sqlite');
const LEGACY_OLD_DB_FILE = path.join(LEGACY_DATA_DIR, 'prenotazioni.sqlite');

let db;

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

function seedEventiIfEmpty() {
  const res = db.exec('SELECT COUNT(*) AS n FROM eventi;');
  const n = res[0].values[0][0];
  if (n > 0) return;

  const seed = [
    {
      slug: 'barolo-barbaresco',
      titolo: 'Barolo e Barbaresco vista mare',
      sottotitolo: '23 ottobre, ore 19:00 — Ristorante 116, Terracina',
      data_testo: '23 ottobre',
      data_iso: '2026-10-23',
      luogo: 'Ristorante 116, Terracina',
      descrizione: "Due grandi Nebbiolo del Piemonte, Barolo e Barbaresco, in un unico appuntamento affacciato sul mare di Terracina. Un percorso guidato tra etichette, produttori e un menù pensato per accompagnare ogni calice.",
      stato: 'in_programma',
      ordine: 1,
      // la locandina è quadrata: "contain" la mostra intera invece di ritagliarla
      adattamento_immagine: 'contain',
      // mostrato nella sezione "due eventi" della home
      vetrina: 1,
    },
    {
      slug: 'sud-wine-festival',
      titolo: 'Sud Wine Festival',
      sottotitolo: 'Data in via di definizione — Terracina',
      data_testo: 'Data in via di definizione',
      data_iso: '',
      luogo: 'Terracina — luogo da definire',
      descrizione: 'Un festival dedicato ai vitigni e ai produttori del Sud Italia: Campania, Puglia, Sicilia, Calabria e Basilicata in un solo evento.',
      stato: 'in_programma',
      ordine: 2,
      vetrina: 1,
    },
    {
      slug: 'vini-dal-mondo',
      titolo: 'Vini dal Mondo',
      sottotitolo: '24 luglio — Ristorante Ai Pozzi, Lenola',
      data_testo: '24 luglio',
      data_iso: '2026-07-24',
      luogo: 'Ristorante Ai Pozzi, Lenola',
      descrizione: "Un appuntamento dedicato ai vini da ogni angolo del mondo, con 26 produttori a raccontare le proprie etichette calice dopo calice. Grazie a chi c'era: la prossima è già in programma.",
      stato: 'svolto',
      ordine: 1,
    },
  ];

  seed.forEach((e) => createEvento(e));
}

// Installazioni già esistenti (create prima di questa versione): aggiunge le
// colonne nuove senza toccare i dati già presenti.
function ensureColumn(table, column, decl) {
  const info = db.exec(`PRAGMA table_info(${table});`);
  if (!info.length) return false;
  const cols = info[0].values.map((row) => row[1]);
  if (!cols.includes(column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl};`);
    return true;
  }
  return false;
}

// Per chi aveva già i 3 appuntamenti di esempio prima dell'introduzione della
// data "vera" (data_iso): gliela assegna una volta sola, così "prossimo
// appuntamento" funziona subito senza dover reinserire nulla a mano.
function backfillDateIsoIfMissing() {
  const note = {
    'barolo-barbaresco': '2026-10-23',
    'vini-dal-mondo': '2026-07-24',
  };
  Object.keys(note).forEach((slug) => {
    const ev = getEvento(slug);
    if (ev && !ev.data_iso) {
      db.run('UPDATE eventi SET data_iso = ? WHERE id = ?', [note[slug], ev.id]);
    }
  });
}

// Al primo avvio dopo l'introduzione di "adattamento_immagine" (colonna appena
// aggiunta con ALTER TABLE, quindi valorizzata a 'cover' per tutti): la
// locandina di Barolo & Barbaresco è quadrata, quindi la imposta a 'contain'
// una volta sola così non risulta già tagliata (si può comunque cambiare dal
// pannello appuntamenti in qualunque momento).
function backfillAdattamentoImmagineBarolo() {
  const ev = getEvento('barolo-barbaresco');
  if (ev) db.run("UPDATE eventi SET adattamento_immagine = 'contain' WHERE id = ?", [ev.id]);
}

// Al primo avvio dopo l'introduzione di "vetrina" (la sezione home "Due
// eventi, un solo filo conduttore", prima fissa su questi due appuntamenti
// scritti a mano nell'HTML): li marca come "in vetrina" una volta sola, così
// la home resta identica a prima finché non si decide di cambiarli dal
// pannello appuntamenti.
function backfillVetrinaIniziale() {
  ['barolo-barbaresco', 'sud-wine-festival'].forEach((slug) => {
    const ev = getEvento(slug);
    if (ev) db.run('UPDATE eventi SET vetrina = 1 WHERE id = ?', [ev.id]);
  });
}

async function init() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file),
  });

  const fileToLoad =
    fs.existsSync(DB_FILE) ? DB_FILE :
    fs.existsSync(OLD_DB_FILE) ? OLD_DB_FILE :
    fs.existsSync(LEGACY_DB_FILE) ? LEGACY_DB_FILE :
    fs.existsSync(LEGACY_OLD_DB_FILE) ? LEGACY_OLD_DB_FILE :
    null;
  db = fileToLoad ? new SQL.Database(fs.readFileSync(fileToLoad)) : new SQL.Database();
  if (fileToLoad && fileToLoad !== DB_FILE) {
    console.log(`Database trovato in una posizione precedente (${fileToLoad}): lo sposto in ${DB_FILE}.`);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS prenotazioni (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      evento     TEXT NOT NULL,
      nome       TEXT NOT NULL,
      cognome    TEXT NOT NULL,
      email      TEXT NOT NULL,
      telefono   TEXT NOT NULL,
      posti      INTEGER NOT NULL DEFAULT 1,
      socio      TEXT,
      note       TEXT,
      stato      TEXT NOT NULL DEFAULT 'nuova',
      creato_il  TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS eventi (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      slug         TEXT NOT NULL UNIQUE,
      titolo       TEXT NOT NULL,
      sottotitolo  TEXT,
      data_testo   TEXT,
      data_iso     TEXT,
      luogo        TEXT,
      descrizione  TEXT,
      stato        TEXT NOT NULL DEFAULT 'in_programma',
      ordine       INTEGER NOT NULL DEFAULT 0,
      immagine     TEXT,
      adattamento_immagine TEXT NOT NULL DEFAULT 'cover',
      vetrina      INTEGER NOT NULL DEFAULT 0,
      aggiornato_il TEXT NOT NULL
    );
  `);

  // installazioni precedenti a data_iso/immagine/adattamento_immagine/vetrina:
  // aggiunge le colonne se mancano, senza toccare i dati già presenti
  ensureColumn('eventi', 'data_iso', 'TEXT');
  ensureColumn('eventi', 'immagine', 'TEXT');
  const adattamentoAppenaAggiunto = ensureColumn('eventi', 'adattamento_immagine', "TEXT NOT NULL DEFAULT 'cover'");
  const vetrinaAppenaAggiunta = ensureColumn('eventi', 'vetrina', 'INTEGER NOT NULL DEFAULT 0');

  backfillDateIsoIfMissing();
  if (adattamentoAppenaAggiunto) backfillAdattamentoImmagineBarolo();
  if (vetrinaAppenaAggiunta) backfillVetrinaIniziale();
  seedEventiIfEmpty();
  persist();
}

// ---------------------------------------------------------------------
// Prenotazioni
// ---------------------------------------------------------------------

function createPrenotazione(b) {
  const creato_il = new Date().toISOString();
  db.run(
    `INSERT INTO prenotazioni (evento, nome, cognome, email, telefono, posti, socio, note, stato, creato_il)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'nuova', ?)`,
    [b.evento, b.nome, b.cognome, b.email, b.telefono, b.posti, b.socio, b.note, creato_il]
  );
  const idRes = db.exec('SELECT last_insert_rowid() AS id;');
  persist();
  return idRes[0].values[0][0];
}

function getAllPrenotazioni({ evento, stato } = {}) {
  let sql = 'SELECT * FROM prenotazioni WHERE 1=1';
  const params = [];
  if (evento) {
    sql += ' AND evento = ?';
    params.push(evento);
  }
  if (stato) {
    sql += ' AND stato = ?';
    params.push(stato);
  }
  sql += ' ORDER BY creato_il DESC';
  return runSelect(sql, params);
}

function updateStatoPrenotazione(id, stato) {
  db.run('UPDATE prenotazioni SET stato = ? WHERE id = ?', [stato, id]);
  persist();
}

function removePrenotazione(id) {
  db.run('DELETE FROM prenotazioni WHERE id = ?', [id]);
  persist();
}

function exportPrenotazioniCsv() {
  const rows = getAllPrenotazioni();
  const headers = ['id', 'evento', 'nome', 'cognome', 'email', 'telefono', 'posti', 'socio', 'note', 'stato', 'creato_il'];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(','));
  return lines.join('\r\n');
}

// ---------------------------------------------------------------------
// Eventi (appuntamenti)
// ---------------------------------------------------------------------

function runSelect(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function getAllEventi({ stato } = {}) {
  let sql = 'SELECT * FROM eventi WHERE 1=1';
  const params = [];
  if (stato) {
    sql += ' AND stato = ?';
    params.push(stato);
  }
  sql += ' ORDER BY stato ASC, ordine ASC, id ASC';
  return runSelect(sql, params);
}

function getEvento(slugOrId) {
  const rows = runSelect('SELECT * FROM eventi WHERE slug = ? OR CAST(id AS TEXT) = ?', [String(slugOrId), String(slugOrId)]);
  return rows[0] || null;
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'evento';
}

function createEvento(e) {
  let slug = e.slug ? slugify(e.slug) : slugify(e.titolo);
  // evita slug duplicati
  let candidate = slug;
  let i = 2;
  while (getEvento(candidate)) {
    candidate = `${slug}-${i++}`;
  }
  slug = candidate;

  const aggiornato_il = new Date().toISOString();
  db.run(
    `INSERT INTO eventi (slug, titolo, sottotitolo, data_testo, data_iso, luogo, descrizione, stato, ordine, immagine, adattamento_immagine, vetrina, aggiornato_il)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      e.titolo || 'Nuovo appuntamento',
      e.sottotitolo || '',
      e.data_testo || '',
      e.data_iso || '',
      e.luogo || '',
      e.descrizione || '',
      e.stato === 'svolto' ? 'svolto' : 'in_programma',
      Number.isFinite(Number(e.ordine)) ? Number(e.ordine) : 0,
      e.immagine || '',
      e.adattamento_immagine === 'contain' ? 'contain' : 'cover',
      e.vetrina ? 1 : 0,
      aggiornato_il,
    ]
  );
  persist();
  return getEvento(slug);
}

const EVENTO_CAMPI_MODIFICABILI = ['titolo', 'sottotitolo', 'data_testo', 'data_iso', 'luogo', 'descrizione', 'stato', 'ordine', 'immagine', 'adattamento_immagine', 'vetrina'];

function updateEvento(id, campi) {
  const esistente = getEvento(id);
  if (!esistente) return null;

  const set = [];
  const params = [];
  for (const campo of EVENTO_CAMPI_MODIFICABILI) {
    if (Object.prototype.hasOwnProperty.call(campi, campo)) {
      set.push(`${campo} = ?`);
      let valore = campi[campo];
      if (campo === 'ordine') valore = Number(valore) || 0;
      if (campo === 'adattamento_immagine') valore = valore === 'contain' ? 'contain' : 'cover';
      if (campo === 'vetrina') valore = (valore === true || valore === 1 || valore === '1') ? 1 : 0;
      params.push(valore);
    }
  }
  if (!set.length) return esistente;

  set.push('aggiornato_il = ?');
  params.push(new Date().toISOString());
  params.push(esistente.id);

  db.run(`UPDATE eventi SET ${set.join(', ')} WHERE id = ?`, params);
  persist();
  return getEvento(esistente.id);
}

function removeEvento(id) {
  db.run('DELETE FROM eventi WHERE id = ?', [id]);
  persist();
}

module.exports = {
  init,
  prenotazioni: {
    create: createPrenotazione,
    getAll: getAllPrenotazioni,
    updateStato: updateStatoPrenotazione,
    remove: removePrenotazione,
    exportCsv: exportPrenotazioniCsv,
  },
  eventi: {
    getAll: getAllEventi,
    get: getEvento,
    create: createEvento,
    update: updateEvento,
    remove: removeEvento,
  },
};
