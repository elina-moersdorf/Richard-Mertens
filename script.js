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

  /* ---------- Texte je Sprache (Sprache aus <html lang>) ---------- */
  const LANG = document.documentElement.lang === 'en' ? 'en' : 'de';
  const T = {
    de: {
      more: 'Weiterlesen',
      less: 'Weniger anzeigen',
      dot: (i, n) => `Bewertung ${i} von ${n}`,
      valueMissing: 'Bitte füllen Sie dieses Feld aus.',
      typeMismatch: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
      sending: 'Ihre Anfrage wird gesendet …',
      success: 'Vielen Dank. Ihre Anfrage ist angekommen. Ich melde mich in der Regel innerhalb von 24 Stunden bei Ihnen.',
      error: 'Leider konnte Ihre Anfrage nicht gesendet werden. Bitte versuchen Sie es erneut oder rufen Sie mich an: 030 98312332.',
      fileCount: 'Bitte wählen Sie höchstens 5 Dateien aus.',
      fileType: (n) => `„${n}“ hat ein nicht erlaubtes Format. Erlaubt sind PDF, JPG, PNG und Word.`,
      fileSize: (n) => `„${n}“ ist größer als 10 MB.`,
      fileTotal: 'Die Dateien sind zusammen größer als 15 MB.',
    },
    en: {
      more: 'Read more',
      less: 'Show less',
      dot: (i, n) => `Review ${i} of ${n}`,
      valueMissing: 'Please fill in this field.',
      typeMismatch: 'Please enter a valid email address.',
      sending: 'Sending your enquiry …',
      success: 'Thank you. Your enquiry has been received. I will usually get back to you within 24 hours.',
      error: 'Unfortunately, your enquiry could not be sent. Please try again or call me on +49 30 98312332.',
      fileCount: 'Please select no more than 5 files.',
      fileType: (n) => `“${n}” is not an accepted format. Accepted formats are PDF, JPG, PNG and Word.`,
      fileSize: (n) => `“${n}” is larger than 10 MB.`,
      fileTotal: 'The files are larger than 15 MB in total.',
    },
  }[LANG];

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
        btn.textContent = open ? T.less : T.more;
        btn.setAttribute('aria-expanded', String(open));
      });
    });

    const dots = document.createElement('div');
    dots.className = 'reviews__dots';
    cards.forEach((card, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', T.dot(i + 1, cards.length));
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
      valueMissing: T.valueMissing,
      typeMismatch: T.typeMismatch,
    };

    const setError = (field, text) => {
      const wrap = field.closest('.field');
      let note = wrap.querySelector('.field__error');
      const hint = wrap.querySelector('.field__hint');
      const describe = (...ids) => {
        const value = ids.filter(Boolean).join(' ');
        if (value) field.setAttribute('aria-describedby', value);
        else field.removeAttribute('aria-describedby');
      };
      wrap.classList.toggle('is-invalid', Boolean(text));
      field.setAttribute('aria-invalid', String(Boolean(text)));
      if (text) {
        if (!note) {
          note = document.createElement('p');
          note.className = 'field__error';
          note.id = `${field.id}-error`;
          wrap.append(note);
          describe(note.id, hint && hint.id);
        }
        note.textContent = text;
      } else if (note) {
        note.remove();
        describe(hint && hint.id);
      }
    };

    // Anhänge: höchstens 5 Dateien, je 10 MB, zusammen 15 MB, nur PDF/JPG/PNG/Word
    const MB = 1024 * 1024;
    const allowed = /\.(pdf|jpe?g|png|docx?)$/i;
    const fileError = (field) => {
      const files = [...field.files];
      if (files.length > 5) return T.fileCount;
      const wrongType = files.find((f) => !allowed.test(f.name));
      if (wrongType) return T.fileType(wrongType.name);
      const tooBig = files.find((f) => f.size > 10 * MB);
      if (tooBig) return T.fileSize(tooBig.name);
      if (files.reduce((sum, f) => sum + f.size, 0) > 15 * MB) return T.fileTotal;
      return '';
    };

    const validate = (field) => {
      if (field.type === 'file') {
        const text = fileError(field);
        setError(field, text);
        return !text;
      }
      const v = field.validity;
      const text = v.valid ? '' : (v.valueMissing ? messages.valueMissing : messages.typeMismatch);
      setError(field, text);
      return v.valid;
    };

    const fields = [...form.querySelectorAll('.field input, .field select, .field textarea')];
    fields.forEach((field) => {
      field.addEventListener(field.type === 'file' ? 'change' : 'blur', () => validate(field));
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
      status.textContent = T.sending;

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          // abgelehnte Eingaben (z. B. Anhänge): Hinweis des Servers zeigen
          const err = new Error(result.message || '');
          err.serverMessage = response.status === 400 ? result.message : '';
          throw err;
        }
        form.reset();
        status.textContent = T.success;
      } catch (error) {
        status.classList.add('is-error');
        status.textContent = error.serverMessage || T.error;
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
