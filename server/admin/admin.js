// Pannello di gestione prenotazioni — legge/scrive dalle API del server
// (server/server.js), protette da login. Nessuna libreria esterna.

(function () {
  var EVENTI_LABEL = {
    'barolo-barbaresco': 'Barolo e Barbaresco vista mare',
    'altro': "Un'altra serata / non sicuro",
  };

  var filtroEvento = document.getElementById('filtro-evento');
  var filtroStato = document.getElementById('filtro-stato');
  var tableHolder = document.getElementById('table-holder');
  var statCards = document.getElementById('stat-cards');
  var ultimoAgg = document.getElementById('ultimo-agg');
  var btnRefresh = document.getElementById('btn-refresh');
  var exportLink = document.getElementById('export-link');

  function qs(params) {
    var pairs = [];
    Object.keys(params).forEach(function (k) {
      if (params[k]) pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    });
    return pairs.length ? '?' + pairs.join('&') : '';
  }

  function fmtData(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return iso;
    }
  }

  function renderStats(rows) {
    var totale = rows.length;
    var posti = rows.filter(function (r) { return r.stato !== 'annullata'; })
      .reduce(function (sum, r) { return sum + (Number(r.posti) || 0); }, 0);
    var nuove = rows.filter(function (r) { return r.stato === 'nuova'; }).length;
    var confermate = rows.filter(function (r) { return r.stato === 'confermata'; }).length;

    statCards.innerHTML = [
      ['Prenotazioni', totale],
      ['Posti richiesti', posti + ' (non annullate)'],
      ['Da rivedere', nuove],
      ['Confermate', confermate],
    ].map(function (pair) {
      return '<div class="stat-card"><b>' + pair[1] + '</b><span>' + pair[0] + '</span></div>';
    }).join('');
  }

  function renderTable(rows) {
    if (!rows.length) {
      tableHolder.innerHTML = '<p class="empty-state">Nessuna prenotazione trovata con questi filtri.</p>';
      return;
    }

    var html = '<div style="overflow-x:auto;"><table class="admin-table"><thead><tr>' +
      '<th>Data</th><th>Serata</th><th>Cliente</th><th>Contatti</th>' +
      '<th>Posti</th><th>Socio</th><th>Note</th><th>Stato</th><th></th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (r) {
      var eventoLabel = EVENTI_LABEL[r.evento] || r.evento;
      html += '<tr data-id="' + r.id + '">' +
        '<td>' + fmtData(r.creato_il) + '</td>' +
        '<td>' + eventoLabel + '</td>' +
        '<td>' + r.nome + ' ' + r.cognome + '</td>' +
        '<td>' + r.email + '<br><code class="small">' + r.telefono + '</code></td>' +
        '<td>' + r.posti + '</td>' +
        '<td>' + (r.socio === 'si' ? 'Sì' : 'No') + '</td>' +
        '<td class="note-cell">' + (r.note ? r.note : '<code class="small">—</code>') + '</td>' +
        '<td><span class="pill ' + r.stato + '">' + r.stato + '</span></td>' +
        '<td><div class="row-actions">' +
          '<select data-action="stato">' +
            '<option value="nuova"' + (r.stato === 'nuova' ? ' selected' : '') + '>Nuova</option>' +
            '<option value="confermata"' + (r.stato === 'confermata' ? ' selected' : '') + '>Confermata</option>' +
            '<option value="annullata"' + (r.stato === 'annullata' ? ' selected' : '') + '>Annullata</option>' +
          '</select>' +
          '<button type="button" class="btn-del" data-action="elimina">Elimina</button>' +
        '</div></td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    tableHolder.innerHTML = html;

    tableHolder.querySelectorAll('select[data-action="stato"]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var id = sel.closest('tr').getAttribute('data-id');
        cambiaStato(id, sel.value);
      });
    });
    tableHolder.querySelectorAll('button[data-action="elimina"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tr = btn.closest('tr');
        var id = tr.getAttribute('data-id');
        var descr = tr.children[2].textContent;
        if (window.confirm('Eliminare definitivamente la prenotazione di ' + descr + '?')) {
          eliminaPrenotazione(id);
        }
      });
    });
  }

  function carica() {
    var params = { evento: filtroEvento.value, stato: filtroStato.value };
    exportLink.href = '/api/prenotazioni/export.csv' + qs(params);
    tableHolder.innerHTML = '<p class="empty-state">Caricamento…</p>';
    fetch('/api/prenotazioni' + qs(params))
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        renderStats(rows);
        renderTable(rows);
        ultimoAgg.textContent = 'Aggiornato alle ' + new Date().toLocaleTimeString('it-IT');
      })
      .catch(function () {
        tableHolder.innerHTML = '<p class="empty-state">Errore nel caricamento dei dati. Riprova.</p>';
      });
  }

  function cambiaStato(id, stato) {
    fetch('/api/prenotazioni/' + id + '/stato', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stato: stato }),
    })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(carica)
      .catch(function () { alert('Non sono riuscito ad aggiornare lo stato. Riprova.'); });
  }

  function eliminaPrenotazione(id) {
    fetch('/api/prenotazioni/' + id, { method: 'DELETE' })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(carica)
      .catch(function () { alert('Non sono riuscito a eliminare la prenotazione. Riprova.'); });
  }

  filtroEvento.addEventListener('change', carica);
  filtroStato.addEventListener('change', carica);
  btnRefresh.addEventListener('click', carica);

  carica();
})();
