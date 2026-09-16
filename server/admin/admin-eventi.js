// Pannello di gestione appuntamenti — legge/scrive da /api/eventi.
// Nessuna libreria esterna.

(function () {
  var listaHolder = document.getElementById('lista-holder');
  var nuovoHolder = document.getElementById('nuovo-holder');
  var btnNuovo = document.getElementById('btn-nuovo');

  function campoHtml(id, label, value, type) {
    type = type || 'text';
    return '<div class="campo">' +
      '<label for="' + id + '">' + label + '</label>' +
      '<input id="' + id + '" type="' + type + '" value="' + escHtml(value || '') + '">' +
      '</div>';
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function immaginePreviewHtml(ev) {
    if (ev && ev.immagine) {
      return '<img class="img-preview" src="' + escHtml(ev.immagine) + '?t=' + Date.now() + '" alt="Anteprima immagine">';
    }
    return '<div class="img-preview-empty">Nessuna immagine caricata</div>';
  }

  function cardHtml(ev) {
    var id = ev.id;
    return (
      '<div class="evento-card" data-id="' + id + '">' +
        '<div class="evento-card-head">' +
          '<div>' +
            '<span class="pill ' + ev.stato + '">' + (ev.stato === 'svolto' ? 'Svolto' : 'In programma') + '</span> ' +
            '<span class="slug">slug: ' + escHtml(ev.slug) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="evento-grid">' +
          campoHtml('titolo-' + id, 'Titolo', ev.titolo) +
          campoHtml('sottotitolo-' + id, 'Sottotitolo', ev.sottotitolo) +
          campoHtml('data-' + id, 'Data (testo mostrato sul sito, es. "23 ottobre")', ev.data_testo) +
          campoHtml('dataiso-' + id, 'Data (per ordinare — usata per "prossimo appuntamento")', ev.data_iso, 'date') +
          campoHtml('luogo-' + id, 'Luogo', ev.luogo) +
          '<div class="campo">' +
            '<label for="stato-' + id + '">Stato</label>' +
            '<select id="stato-' + id + '">' +
              '<option value="in_programma"' + (ev.stato === 'in_programma' ? ' selected' : '') + '>In programma</option>' +
              '<option value="svolto"' + (ev.stato === 'svolto' ? ' selected' : '') + '>Svolto</option>' +
            '</select>' +
          '</div>' +
          campoHtml('ordine-' + id, 'Ordine (i più bassi vengono prima)', ev.ordine, 'number') +
          '<div class="campo full">' +
            '<label for="descrizione-' + id + '">Descrizione</label>' +
            '<textarea id="descrizione-' + id + '">' + escHtml(ev.descrizione) + '</textarea>' +
          '</div>' +
          '<div class="campo full">' +
            '<label>Immagine di presentazione</label>' +
            '<div class="img-upload-row" data-role="img-row">' +
              immaginePreviewHtml(ev) +
              '<div class="img-upload-controls">' +
                '<input type="file" accept="image/*" id="imgfile-' + id + '">' +
                '<button type="button" class="btn-ghost" data-action="carica-immagine">Carica immagine</button>' +
                '<span class="salvato-msg" data-role="img-salvato">Immagine aggiornata ✓</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="evento-actions">' +
          '<div>' +
            '<button type="button" class="btn btn-primary" data-action="salva">Salva modifiche</button> ' +
            '<span class="salvato-msg" data-role="salvato">Salvato ✓</span>' +
          '</div>' +
          '<button type="button" class="btn-del" data-action="elimina">Elimina appuntamento</button>' +
        '</div>' +
      '</div>'
    );
  }

  function leggiCampi(card) {
    var id = card.getAttribute('data-id');
    return {
      titolo: card.querySelector('#titolo-' + id).value.trim(),
      sottotitolo: card.querySelector('#sottotitolo-' + id).value.trim(),
      data_testo: card.querySelector('#data-' + id).value.trim(),
      data_iso: card.querySelector('#dataiso-' + id).value,
      luogo: card.querySelector('#luogo-' + id).value.trim(),
      stato: card.querySelector('#stato-' + id).value,
      ordine: Number(card.querySelector('#ordine-' + id).value) || 0,
      descrizione: card.querySelector('#descrizione-' + id).value.trim(),
    };
  }

  function attacca(card) {
    var id = card.getAttribute('data-id');

    card.querySelector('[data-action="salva"]').addEventListener('click', function () {
      var payload = leggiCampi(card);
      fetch('/api/eventi/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function (res) {
          var pill = card.querySelector('.pill');
          pill.className = 'pill ' + res.evento.stato;
          pill.textContent = res.evento.stato === 'svolto' ? 'Svolto' : 'In programma';
          var msg = card.querySelector('[data-role="salvato"]');
          msg.classList.add('show');
          setTimeout(function () { msg.classList.remove('show'); }, 1800);
        })
        .catch(function () { alert('Non sono riuscito a salvare le modifiche. Riprova.'); });
    });

    card.querySelector('[data-action="elimina"]').addEventListener('click', function () {
      var titolo = card.querySelector('#titolo-' + id).value;
      if (!window.confirm('Eliminare definitivamente l\'appuntamento "' + titolo + '"? Non si può annullare.')) return;
      fetch('/api/eventi/' + id, { method: 'DELETE' })
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function () { carica(); })
        .catch(function () { alert('Non sono riuscito a eliminare l\'appuntamento. Riprova.'); });
    });

    var btnImg = card.querySelector('[data-action="carica-immagine"]');
    btnImg.addEventListener('click', function () {
      var fileInput = card.querySelector('#imgfile-' + id);
      var file = fileInput.files[0];
      if (!file) { alert('Scegli prima un file immagine.'); return; }
      var fd = new FormData();
      fd.append('immagine', file);
      fetch('/api/eventi/' + id + '/immagine', { method: 'POST', body: fd })
        .then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok || !data.ok) throw new Error(data.error || 'Errore nel caricamento.');
            return data;
          });
        })
        .then(function (res) {
          var row = card.querySelector('[data-role="img-row"]');
          var vecchiaPreview = row.querySelector('.img-preview, .img-preview-empty');
          var wrapper = document.createElement('div');
          wrapper.innerHTML = immaginePreviewHtml(res.evento);
          row.replaceChild(wrapper.firstChild, vecchiaPreview);
          fileInput.value = '';
          var msg = card.querySelector('[data-role="img-salvato"]');
          msg.classList.add('show');
          setTimeout(function () { msg.classList.remove('show'); }, 1800);
        })
        .catch(function (err) { alert('Non sono riuscito a caricare l\'immagine: ' + (err.message || 'errore sconosciuto')); });
    });
  }

  function carica() {
    listaHolder.innerHTML = '<p class="empty-state">Caricamento…</p>';
    fetch('/api/eventi')
      .then(function (r) { return r.json(); })
      .then(function (eventi) {
        if (!eventi.length) {
          listaHolder.innerHTML = '<p class="empty-state">Nessun appuntamento ancora. Creane uno con "+ Nuovo appuntamento".</p>';
          return;
        }
        listaHolder.innerHTML = eventi.map(cardHtml).join('');
        listaHolder.querySelectorAll('.evento-card').forEach(attacca);
      })
      .catch(function () {
        listaHolder.innerHTML = '<p class="empty-state">Errore nel caricamento. Riprova.</p>';
      });
  }

  function mostraFormNuovo() {
    if (nuovoHolder.querySelector('.nuovo-card')) return; // già aperto
    nuovoHolder.innerHTML =
      '<div class="evento-card nuovo-card">' +
        '<div class="evento-card-head"><strong>Nuovo appuntamento</strong></div>' +
        '<p class="form-note" style="margin-top:0;">Riceverà subito una sua pagina dedicata sul sito (link "Scopri l\'evento" nell\'elenco appuntamenti).</p>' +
        '<div class="evento-grid">' +
          campoHtml('n-titolo', 'Titolo') +
          campoHtml('n-sottotitolo', 'Sottotitolo') +
          campoHtml('n-data', 'Data (testo mostrato sul sito, es. "23 ottobre")') +
          campoHtml('n-dataiso', 'Data (per ordinare — usata per "prossimo appuntamento")', '', 'date') +
          campoHtml('n-luogo', 'Luogo') +
          '<div class="campo">' +
            '<label for="n-stato">Stato</label>' +
            '<select id="n-stato">' +
              '<option value="in_programma">In programma</option>' +
              '<option value="svolto">Svolto</option>' +
            '</select>' +
          '</div>' +
          campoHtml('n-ordine', 'Ordine', 0, 'number') +
          '<div class="campo full">' +
            '<label for="n-descrizione">Descrizione</label>' +
            '<textarea id="n-descrizione"></textarea>' +
          '</div>' +
          '<div class="campo full">' +
            '<label for="n-imgfile">Immagine di presentazione (facoltativa, puoi aggiungerla anche dopo)</label>' +
            '<input type="file" accept="image/*" id="n-imgfile">' +
          '</div>' +
        '</div>' +
        '<div class="evento-actions">' +
          '<button type="button" class="btn btn-primary" id="n-salva">Crea appuntamento</button>' +
          '<button type="button" class="btn-del" id="n-annulla">Annulla</button>' +
        '</div>' +
      '</div>';

    document.getElementById('n-annulla').addEventListener('click', function () {
      nuovoHolder.innerHTML = '';
    });
    document.getElementById('n-salva').addEventListener('click', function () {
      var titolo = document.getElementById('n-titolo').value.trim();
      if (!titolo) { alert('Il titolo è obbligatorio.'); return; }
      var payload = {
        titolo: titolo,
        sottotitolo: document.getElementById('n-sottotitolo').value.trim(),
        data_testo: document.getElementById('n-data').value.trim(),
        data_iso: document.getElementById('n-dataiso').value,
        luogo: document.getElementById('n-luogo').value.trim(),
        stato: document.getElementById('n-stato').value,
        ordine: Number(document.getElementById('n-ordine').value) || 0,
        descrizione: document.getElementById('n-descrizione').value.trim(),
      };
      var fileImmagine = document.getElementById('n-imgfile').files[0];

      fetch('/api/eventi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function (res) {
          if (fileImmagine && res.evento) {
            var fd = new FormData();
            fd.append('immagine', fileImmagine);
            return fetch('/api/eventi/' + res.evento.id + '/immagine', { method: 'POST', body: fd });
          }
        })
        .then(function () {
          nuovoHolder.innerHTML = '';
          carica();
        })
        .catch(function () { alert('Non sono riuscito a creare l\'appuntamento. Riprova.'); });
    });
  }

  btnNuovo.addEventListener('click', mostraFormNuovo);

  carica();
})();
