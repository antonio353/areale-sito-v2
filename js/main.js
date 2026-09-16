// AREALE — comportamenti condivisi del sito

document.addEventListener('DOMContentLoaded', function () {

  // Menu mobile
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { nav.classList.remove('open'); });
    });
  }

  // Pagina prenota.html: pre-seleziona la serata da ?evento=slug
  var select = document.querySelector('[data-evento-select]');
  if (select) {
    var params = new URLSearchParams(window.location.search);
    var evento = params.get('evento');
    if (evento) {
      var opt = select.querySelector('option[value="' + evento + '"]');
      if (opt) { select.value = evento; }
    }
  }

  // Pagina prenota.html: invia la prenotazione al server locale (server/server.js)
  // invece di fare un normale invio del form, così finisce nel database del
  // pannello di gestione invece che perdersi (o dipendere da Netlify Forms).
  var prenotaForm = document.querySelector('form[name="prenotazione"]');
  if (prenotaForm) {
    prenotaForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var submitBtn = prenotaForm.querySelector('button[type="submit"]');
      var originalLabel = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Invio in corso…';
      }

      var payload = Object.fromEntries(new FormData(prenotaForm).entries());

      fetch('/api/prenotazioni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          if (!r.ok) throw new Error('Errore server');
          return r.json();
        })
        .then(function () {
          window.location.href = 'grazie.html';
        })
        .catch(function () {
          alert('Non è stato possibile inviare la prenotazione. Verifica di aver avviato il server (avvia-server.bat) e riprova, oppure contattaci direttamente.');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
          }
        });
    });
  }
});
