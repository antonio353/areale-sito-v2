// AREALE — carica titolo/sottotitolo/data/luogo/descrizione degli
// appuntamenti dal server e li inserisce nelle pagine che li mostrano.
// Se il server non è raggiungibile, le pagine restano con il testo
// scritto nell'HTML (usato come valore di partenza/fallback).

(function () {
  var DEDICATED_PAGES = {
    'barolo-barbaresco': 'evento-barolo-barbaresco.html',
    'sud-wine-festival': 'evento-sud-wine-festival.html',
  };
  var IMMAGINI = {
    'barolo-barbaresco': 'img/eventi/barolo-barbaresco.jpg',
    'sud-wine-festival': 'https://images.unsplash.com/photo-1742665764542-aff4f4bc064e?auto=format&fit=crop&w=900&q=80',
    'vini-dal-mondo': 'https://images.unsplash.com/photo-1676476623306-566a9b7afc44?auto=format&fit=crop&w=900&q=80',
  };
  var IMMAGINE_DEFAULT = IMMAGINI['vini-dal-mondo'];

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // testo formattato (descrizioni scritte con l'editor del pannello admin):
  // ripulisce l'HTML tenendo solo i tag di formattazione base, per evitare
  // che codice o markup indesiderato finisca sulle pagine pubbliche.
  var RTE_TAG_CONSENTITI = { P: 1, BR: 1, B: 1, STRONG: 1, I: 1, EM: 1, UL: 1, OL: 1, LI: 1, A: 1 };
  function sanitizeRichHtml(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = String(html == null ? '' : html);
    (function pulisci(nodo) {
      Array.prototype.slice.call(nodo.childNodes).forEach(function (figlio) {
        if (figlio.nodeType === Node.COMMENT_NODE) {
          nodo.removeChild(figlio);
          return;
        }
        if (figlio.nodeType === Node.TEXT_NODE) return;
        if (figlio.nodeType !== Node.ELEMENT_NODE) {
          nodo.removeChild(figlio);
          return;
        }
        pulisci(figlio);
        if (!RTE_TAG_CONSENTITI[figlio.tagName]) {
          while (figlio.firstChild) nodo.insertBefore(figlio.firstChild, figlio);
          nodo.removeChild(figlio);
          return;
        }
        var hrefValida = null;
        if (figlio.tagName === 'A') {
          var href = figlio.getAttribute('href') || '';
          if (/^(https?:|mailto:)/i.test(href)) hrefValida = href;
        }
        Array.prototype.slice.call(figlio.attributes).forEach(function (attr) {
          figlio.removeAttribute(attr.name);
        });
        if (hrefValida) {
          figlio.setAttribute('href', hrefValida);
          figlio.setAttribute('rel', 'noopener');
          figlio.setAttribute('target', '_blank');
        }
      });
    })(tpl.content);
    return tpl.innerHTML;
  }

  // se il risultato non inizia già con un blocco (p/ul/ol), lo avvolge in
  // un <p> — serve sia per le vecchie descrizioni in testo semplice, sia
  // per compatibilità con markup formattato che arriva senza wrapper.
  function garantisceBlocco(html) {
    var s = (html || '').trim();
    if (!s) return '';
    if (/^<(p|ul|ol)[ >]/i.test(s)) return s;
    return '<p>' + s + '</p>';
  }

  // riassunto in testo semplice (usato nelle anteprime, es. elenco serate.html)
  function testoSenzaTag(html) {
    return String(html == null ? '' : html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // immagine di un appuntamento: quella caricata dal pannello, altrimenti
  // la foto di riserva collegata allo slug, altrimenti una generica
  function immagineDi(ev) {
    return ev.immagine || IMMAGINI[ev.slug] || IMMAGINE_DEFAULT;
  }

  // --- campi singoli: <elemento data-evento="slug:campo">testo di scorta</elemento> ---
  function hydrateCampi(bySlug) {
    document.querySelectorAll('[data-evento]').forEach(function (el) {
      var parts = el.getAttribute('data-evento').split(':');
      var ev = bySlug[parts[0]];
      if (!ev) return;
      var valore = ev[parts[1]];
      if (valore == null || valore === '') return;

      if (el.hasAttribute('data-evento-rich')) {
        el.innerHTML = garantisceBlocco(sanitizeRichHtml(valore));
      } else {
        el.textContent = parts[1] === 'descrizione' ? testoSenzaTag(valore) : valore;
      }
    });

    // immagini agganciate a uno slug fisso (es. le due pagine dedicate storiche)
    document.querySelectorAll('[data-evento-img]').forEach(function (el) {
      var slug = el.getAttribute('data-evento-img');
      var ev = bySlug[slug];
      if (!ev) return;
      el.src = immagineDi(ev);
      // gli sfondi delle sezioni "hero" restano sempre a tutto schermo
      // (ritagliati): la scelta "mostra tutta l'immagine" vale per le altre
      // immagini (card, box "il concept", ecc.)
      if (!el.closest('.hero')) {
        el.classList.toggle('img-contain', ev.adattamento_immagine === 'contain');
      }
    });
  }

  // --- "prossimo appuntamento" in home: sceglie l'evento in programma con
  // la data (data_iso) più vicina a oggi, non più uno slug fisso ---
  function dataIsoValida(s) {
    if (!s) return null;
    var d = new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  function scegliProssimo(eventi) {
    var oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    var inProgramma = eventi.filter(function (e) { return e.stato === 'in_programma'; });

    var conData = inProgramma
      .map(function (e) { return { e: e, d: dataIsoValida(e.data_iso) }; })
      .filter(function (x) { return x.d && x.d >= oggi; })
      .sort(function (a, b) { return a.d - b.d; });
    if (conData.length) return conData[0].e;

    // nessun appuntamento con una data futura impostata: usa l'ordine manuale
    var senzaData = inProgramma.slice().sort(function (a, b) { return (a.ordine || 0) - (b.ordine || 0); });
    return senzaData[0] || null;
  }

  function hydrateProssimo(eventi) {
    var sezione = document.querySelector('[data-prossimo-sezione]');
    if (!sezione) return;
    var ev = scegliProssimo(eventi);
    if (!ev) return; // resta il contenuto statico scritto nell'HTML

    sezione.querySelectorAll('[data-prossimo]').forEach(function (el) {
      var campo = el.getAttribute('data-prossimo');
      var valore = ev[campo];
      if (valore == null || valore === '') return;
      el.textContent = campo === 'descrizione' ? testoSenzaTag(valore) : valore;
    });
    var linkPrenota = sezione.querySelector('[data-prossimo-link="prenota"]');
    if (linkPrenota) linkPrenota.setAttribute('href', 'prenota.html?evento=' + encodeURIComponent(ev.slug));
    var linkScopri = sezione.querySelector('[data-prossimo-link="scopri"]');
    if (linkScopri) linkScopri.setAttribute('href', 'evento-' + ev.slug + '.html');
    var img = sezione.querySelector('[data-prossimo-img]');
    if (img) {
      img.src = immagineDi(ev);
      img.classList.toggle('img-contain', ev.adattamento_immagine === 'contain');
    }
  }

  // --- "ultimo appuntamento svolto" in home: sceglie l'evento svolto con
  // la data (data_iso) più recente, non più uno slug fisso ---
  function scegliUltimo(eventi) {
    var oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    var svolti = eventi.filter(function (e) { return e.stato === 'svolto'; });

    var conData = svolti
      .map(function (e) { return { e: e, d: dataIsoValida(e.data_iso) }; })
      .filter(function (x) { return x.d && x.d <= oggi; })
      .sort(function (a, b) { return b.d - a.d; }); // decrescente: il più recente prima
    if (conData.length) return conData[0].e;

    // nessuno svolto con una data valida: usa l'ordine manuale
    var senzaData = svolti.slice().sort(function (a, b) { return (a.ordine || 0) - (b.ordine || 0); });
    return senzaData[0] || null;
  }

  function hydrateUltimo(eventi) {
    var sezione = document.querySelector('[data-ultimo-sezione]');
    if (!sezione) return;
    var ev = scegliUltimo(eventi);
    if (!ev) return; // resta il contenuto statico scritto nell'HTML

    sezione.querySelectorAll('[data-ultimo]').forEach(function (el) {
      var campo = el.getAttribute('data-ultimo');
      var valore = ev[campo];
      if (valore == null || valore === '') return;
      el.textContent = campo === 'descrizione' ? testoSenzaTag(valore) : valore;
    });
    var img = sezione.querySelector('[data-ultimo-img]');
    if (img) {
      img.src = immagineDi(ev);
      img.classList.toggle('img-contain', ev.adattamento_immagine === 'contain');
    }
  }

  // --- prenota.html: popola il menu a tendina con gli appuntamenti in
  // programma (esclude quelli già svolti) e preseleziona quello scelto
  // tramite ?evento=slug (es. dal pulsante "Prenota il tuo posto" di una
  // pagina evento) ---
  function hydrateSelectPrenota(eventi) {
    var select = document.querySelector('[data-evento-select]');
    if (!select) return;

    var inProgramma = eventi.filter(function (e) { return e.stato === 'in_programma'; });

    // appuntamenti con data impostata prima (in ordine cronologico), poi
    // quelli senza data ancora definita (in base all'ordine manuale)
    var ordinati = inProgramma
      .map(function (e) { return { e: e, d: dataIsoValida(e.data_iso) }; })
      .sort(function (a, b) {
        if (a.d && b.d) return a.d - b.d;
        if (a.d) return -1;
        if (b.d) return 1;
        return (a.e.ordine || 0) - (b.e.ordine || 0);
      })
      .map(function (x) { return x.e; });

    var params = new URLSearchParams(window.location.search);
    var eventoInUrl = params.get('evento');
    var valorePrecedente = select.value;

    var html = ordinati.map(function (ev) {
      var etichetta = ev.titolo + (ev.data_testo ? ' — ' + ev.data_testo : '');
      return '<option value="' + escHtml(ev.slug) + '">' + escHtml(etichetta) + '</option>';
    }).join('');
    html += '<option value="altro">Un altro appuntamento / non sono sicuro</option>';
    select.innerHTML = html;

    if (eventoInUrl && select.querySelector('option[value="' + CSS.escape(eventoInUrl) + '"]')) {
      select.value = eventoInUrl;
    } else if (valorePrecedente && select.querySelector('option[value="' + CSS.escape(valorePrecedente) + '"]')) {
      select.value = valorePrecedente;
    }
  }

  // --- elenco completo (serate.html): due contenitori, uno per stato ---
  function timelineItemHtml(ev, isPast) {
    var img = immagineDi(ev);
    var classeImg = ev.adattamento_immagine === 'contain' ? ' class="img-contain"' : '';
    var senzaData = !ev.data_testo || /definizione/i.test(ev.data_testo);
    var badgeClass = isPast ? 'badge filled' : (senzaData ? 'badge' : 'badge garnet');
    var badgeLabel = isPast ? 'Svolta' : (senzaData ? 'Prossimamente' : 'Posti disponibili');

    var azioni = '';
    if (!isPast) {
      azioni += '<a href="prenota.html?evento=' + encodeURIComponent(ev.slug) + '" class="btn btn-primary">Prenota il tuo posto</a>';
    }
    if (DEDICATED_PAGES[ev.slug]) {
      azioni += ' <a href="' + DEDICATED_PAGES[ev.slug] + '" class="btn-ghost">Scopri l\'evento</a>';
    }

    return (
      '<div class="timeline-item' + (isPast ? ' past' : '') + '">' +
      '<span class="date">' + escHtml(ev.data_testo || '') + '</span>' +
      '<div class="card">' +
      '<div>' +
      '<span class="' + badgeClass + '">' + badgeLabel + '</span>' +
      '<h3>' + escHtml(ev.titolo) + '</h3>' +
      '<p class="meta-line">' + escHtml(ev.luogo || '') + '</p>' +
      '<p>' + escHtml(testoSenzaTag(ev.descrizione)) + '</p>' +
      (azioni ? '<div class="actions">' + azioni + '</div>' : '') +
      '</div>' +
      '<div class="thumb"><img' + classeImg + ' src="' + img + '" alt="' + escHtml(ev.titolo) + '"></div>' +
      '</div>' +
      '</div>'
    );
  }

  function hydrateTimeline(eventi) {
    var progHolder = document.getElementById('timeline-in-programma');
    var svoltiHolder = document.getElementById('timeline-svolti');
    if (!progHolder && !svoltiHolder) return;

    var inProgramma = eventi.filter(function (e) { return e.stato === 'in_programma'; });
    var svolti = eventi.filter(function (e) { return e.stato === 'svolto'; });

    if (progHolder) {
      progHolder.innerHTML = inProgramma.length
        ? inProgramma.map(function (e) { return timelineItemHtml(e, false); }).join('')
        : '<p class="form-note">Nessun appuntamento in programma al momento.</p>';
    }
    if (svoltiHolder) {
      svoltiHolder.innerHTML = svolti.length
        ? svolti.map(function (e) { return timelineItemHtml(e, true); }).join('')
        : '<p class="form-note">Nessuna serata svolta ancora pubblicata.</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch('/api/eventi')
      .then(function (r) { return r.json(); })
      .then(function (eventi) {
        var bySlug = {};
        eventi.forEach(function (e) { bySlug[e.slug] = e; });
        hydrateCampi(bySlug);
        hydrateProssimo(eventi);
        hydrateUltimo(eventi);
        hydrateTimeline(eventi);
        hydrateSelectPrenota(eventi);
      })
      .catch(function () {
        // server non avviato o non raggiungibile: le pagine restano
        // con il testo scritto nell'HTML, senza bloccare nulla.
      });
  });
})();
