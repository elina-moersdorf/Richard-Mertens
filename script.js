/* =========================================================
   Richard Mertens – Landingpage
   Lenis · GSAP ScrollTrigger
   Inhalte stehen sofort fest auf der Seite – keine Einblend-Effekte
   beim Laden oder Scrollen. Bewegung nur bei Interaktion (Hover, Scroll).
   ========================================================= */
(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined';

  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------- Smooth Scroll (Lenis) ---------- */
  let lenis = null;
  if (!reducedMotion && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    if (hasGsap && window.ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => {
        lenis.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    }
  }

  /* ---------- Anker-Links (Navigation, CTAs, Skip-Link) ---------- */
  const nav = document.querySelector('.site-nav');

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;

    event.preventDefault();
    const offset = id === '#start' ? 0 : -(nav ? nav.offsetHeight : 0);

    if (lenis) {
      lenis.scrollTo(id === '#start' ? 0 : target, { offset });
    } else {
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    }

    // Fokus für Tastatur- und Screenreader-Nutzer mitnehmen
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  /* ---------- Bewertungen (mobil): „Weiterlesen“ und Punkte unter dem Slider ---------- */
  const track = document.querySelector('.reviews__track');
  if (track) {
    const cards = [...track.querySelectorAll('.review')];

    track.querySelectorAll('.review__more').forEach((btn) => {
      const card = btn.closest('.review');
      btn.addEventListener('click', () => {
        const open = card.classList.toggle('is-open');
        btn.textContent = open ? 'Weniger anzeigen' : 'Weiterlesen';
        btn.setAttribute('aria-expanded', String(open));
      });
    });

    const dots = document.createElement('div');
    dots.className = 'reviews__dots';
    cards.forEach((card, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Bewertung ${i + 1} von ${cards.length}`);
      dot.addEventListener('click', () => {
        track.scrollTo({ left: card.offsetLeft - track.offsetLeft - track.clientLeft - parseFloat(getComputedStyle(track).paddingLeft), behavior: reducedMotion ? 'auto' : 'smooth' });
      });
      dots.append(dot);
    });
    track.after(dots);

    const markDot = () => {
      const center = track.scrollLeft + track.clientWidth / 2;
      let active = 0;
      cards.forEach((card, i) => {
        if (card.offsetLeft - track.offsetLeft <= center) active = i;
      });
      [...dots.children].forEach((d, i) => d.setAttribute('aria-current', String(i === active)));
    };
    track.addEventListener('scroll', markDot, { passive: true });
    markDot();
  }

  /* ---------- Kontaktformular (kontakt.php auf dem eigenen Webspace) ---------- */
  const form = document.querySelector('.contact-form');
  if (form) {
    // Zeitstempel für den Spamschutz (zu schnell ausgefüllte Formulare werden verworfen)
    const ts = form.querySelector('input[name="ts"]');
    if (ts) ts.value = String(Date.now());

    const status = form.querySelector('.contact-form__status');
    const submit = form.querySelector('.contact-form__submit');
    const messages = {
      valueMissing: 'Bitte füllen Sie dieses Feld aus.',
      typeMismatch: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    };

    const setError = (field, text) => {
      const wrap = field.closest('.field');
      let note = wrap.querySelector('.field__error');
      wrap.classList.toggle('is-invalid', Boolean(text));
      field.setAttribute('aria-invalid', String(Boolean(text)));
      if (text) {
        if (!note) {
          note = document.createElement('p');
          note.className = 'field__error';
          note.id = `${field.id}-error`;
          wrap.append(note);
          field.setAttribute('aria-describedby', note.id);
        }
        note.textContent = text;
      } else if (note) {
        note.remove();
        field.removeAttribute('aria-describedby');
      }
    };

    const validate = (field) => {
      const v = field.validity;
      const text = v.valid ? '' : (v.valueMissing ? messages.valueMissing : messages.typeMismatch);
      setError(field, text);
      return v.valid;
    };

    const fields = [...form.querySelectorAll('.field input, .field select, .field textarea')];
    fields.forEach((field) => {
      field.addEventListener('blur', () => validate(field));
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const invalid = fields.filter((f) => !validate(f));
      if (invalid.length) {
        invalid[0].focus();
        return;
      }

      submit.disabled = true;
      status.classList.remove('is-error');
      status.textContent = 'Ihre Anfrage wird gesendet …';

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Fehler');
        form.reset();
        status.textContent = 'Vielen Dank. Ihre Anfrage ist angekommen. Ich melde mich in der Regel innerhalb von 24 Stunden bei Ihnen.';
      } catch (error) {
        status.classList.add('is-error');
        status.textContent = 'Leider konnte Ihre Anfrage nicht gesendet werden. Bitte versuchen Sie es erneut oder rufen Sie mich an: 030 98312332.';
      } finally {
        submit.disabled = false;
      }
    });
  }

  /* ---------- Große Überschriften in einer Zeile ----------
     Jede Überschrift mit [data-fit] wird so weit verkleinert, dass sie in eine
     Zeile passt – aber nie unter die Mindestgröße (mobil 24 px, sonst 32 px).
     Ist der Text dafür zu lang, bricht er ausgewogen in mehrere Zeilen um. */
  const fitHeadings = () => {
    const minSize = window.innerWidth < 768 ? 24 : 32;
    const headings = [...document.querySelectorAll('[data-fit]')];
    // 1. alle zurücksetzen und verfügbare Breite messen, solange normal umbrochen wird
    //    (mit nowrap würden Rasterspalten mitwachsen und das Ergebnis verfälschen)
    headings.forEach((h) => { h.style.fontSize = ''; h.style.whiteSpace = ''; });
    // Breite der Überschrift selbst im umbrochenen Zustand = Breite ihrer Spalte
    const widths = headings.map((h) => h.getBoundingClientRect().width);
    // 2. Textbreite in einer Zeile messen und passend verkleinern
    headings.forEach((h, i) => {
      const available = widths[i];
      h.style.whiteSpace = 'nowrap';
      const max = parseFloat(getComputedStyle(h).fontSize);
      const range = document.createRange();
      range.selectNodeContents(h);
      const natural = range.getBoundingClientRect().width;
      if (natural <= available) return;                 // passt bereits
      const size = Math.floor(max * (available / natural) * 0.98 * 10) / 10;
      if (size >= minSize) {
        h.style.fontSize = `${size}px`;
      } else {
        h.style.whiteSpace = '';                        // zu lang: lesbar umbrechen
      }
    });
  };
  fitHeadings();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitHeadings);
  let fitTimer;
  window.addEventListener('resize', () => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitHeadings, 120);
  });

  /* ---------- Navigation: feine Goldlinie nach dem ersten Scrollen ---------- */
  const updateNav = () => nav && nav.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

})();
