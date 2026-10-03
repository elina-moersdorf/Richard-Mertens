/* =========================================================
   Consent-Banner – Rechtsanwalt Richard Mertens
   ---------------------------------------------------------
   Grundsatz: Vor einer aktiven Einwilligung wird KEIN Google-Dienst
   geladen – auch nicht der Google Tag Manager selbst.

   1. Google Consent Mode v2: Alle Signale stehen sofort auf "denied".
   2. Der GTM-Container wird erst geladen, wenn Statistik oder Marketing
      eingewilligt wurde (danach sorgt der Consent Mode dafür, dass nur
      die freigegebenen Kategorien arbeiten).
   3. Die Entscheidung wird mit Version, Zeitstempel und Kennung im
      lokalen Speicher abgelegt (technisch notwendig, § 25 Abs. 2 TDDDG)
      und nach 12 Monaten oder bei neuer Version erneut abgefragt.
   4. Widerruf jederzeit über jedes Element mit [data-cc-open].

   Vor dem Livegang: GTM_ID unten eintragen.
   ========================================================= */
(() => {
  'use strict';

  const GTM_ID = 'GTM-XXXXXXX';          // eigene Container-ID eintragen
  const CONSENT_VERSION = '1.0';         // erhöhen, wenn sich Dienste/Zwecke ändern → erneute Abfrage
  const STORAGE_KEY = 'rm_consent';
  const MAX_AGE_DAYS = 365;

  /* ---------- 1. Consent Mode v2: Standard = abgelehnt ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
    security_storage: 'granted',
    wait_for_update: 500,
  });
  gtag('set', 'ads_data_redaction', true);   // Werbe-Kennungen schwärzen, solange ad_storage abgelehnt ist
  gtag('set', 'url_passthrough', false);     // keine Klick-IDs über URLs weiterreichen

  /* ---------- Speicher ---------- */
  function readConsent() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!data || data.version !== CONSENT_VERSION) return null;
      const ageDays = (Date.now() - Date.parse(data.timestamp)) / 86400000;
      if (!(ageDays >= 0 && ageDays <= MAX_AGE_DAYS)) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function writeConsent(choice) {
    const previous = readConsent();
    const record = {
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      id: (previous && previous.id) || Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
      necessary: true,
      statistics: Boolean(choice.statistics),
      marketing: Boolean(choice.marketing),
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch (e) { /* Speicher gesperrt: Auswahl gilt nur für diesen Aufruf */ }
    return record;
  }

  /* ---------- 2. Einwilligung anwenden ---------- */
  let gtmLoaded = false;

  function loadGTM() {
    if (gtmLoaded || !/^GTM-[A-Z0-9]+$/.test(GTM_ID) || GTM_ID === 'GTM-XXXXXXX') return;
    gtmLoaded = true;
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(GTM_ID);
    document.head.appendChild(s);
  }

  function applyConsent(record) {
    gtag('consent', 'update', {
      analytics_storage: record.statistics ? 'granted' : 'denied',
      ad_storage: record.marketing ? 'granted' : 'denied',
      ad_user_data: record.marketing ? 'granted' : 'denied',
      ad_personalization: record.marketing ? 'granted' : 'denied',
    });
    window.dataLayer.push({
      event: 'consent_update',
      consent_statistics: record.statistics,
      consent_marketing: record.marketing,
      consent_version: record.version,
    });
    if (record.statistics || record.marketing) loadGTM();
  }

  // Beim Widerruf: gesetzte Google-Cookies löschen
  function deleteCookies(prefixes) {
    const host = location.hostname;
    const domains = ['', host, '.' + host, '.' + host.split('.').slice(-2).join('.')];
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim();
      if (!prefixes.some((p) => name.startsWith(p))) return;
      domains.forEach((d) => {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
      });
    });
  }

  function saveChoice(choice) {
    const before = readConsent();
    const record = writeConsent(choice);
    const revokedStats = before && before.statistics && !record.statistics;
    const revokedMarketing = before && before.marketing && !record.marketing;

    if (revokedStats || revokedMarketing) {
      if (revokedStats) deleteCookies(['_ga']);
      if (revokedMarketing) deleteCookies(['_gcl', '_gac']);
      gtag('consent', 'update', {
        analytics_storage: record.statistics ? 'granted' : 'denied',
        ad_storage: record.marketing ? 'granted' : 'denied',
        ad_user_data: record.marketing ? 'granted' : 'denied',
        ad_personalization: record.marketing ? 'granted' : 'denied',
      });
      // bereits geladene Dienste lassen sich nur durch Neuladen sicher beenden
      location.reload();
      return;
    }
    applyConsent(record);
    hideBanner();
  }

  /* ---------- 3. Banner ---------- */
  const TEXT = {
    intro: 'Ich setze auf dieser Website Dienste von Google ein (Google Tag Manager, Google Analytics, Google Ads), um die Nutzung statistisch auszuwerten und den Erfolg meiner Anzeigen zu messen. Diese Dienste nutze ich nur mit Ihrer Einwilligung. Dabei können Daten an Google in die USA übermittelt werden. Ihre Einwilligung ist freiwillig und kann jederzeit über „Cookie-Einstellungen“ am Seitenende geändert oder widerrufen werden. Technisch notwendige Funktionen sind immer aktiv.',
  };

  const html = `
<section class="cc" id="cc" role="dialog" aria-modal="false" aria-labelledby="cc-title" aria-describedby="cc-desc" hidden>
  <div class="cc__inner">
    <div class="cc__view" data-cc-view="main">
      <h2 class="cc__title" id="cc-title">Datenschutz-Einstellungen</h2>
      <p class="cc__text" id="cc-desc">${TEXT.intro}</p>
      <p class="cc__links"><a href="datenschutz.html">Datenschutzerklärung</a><a href="impressum.html">Impressum</a></p>
      <div class="cc__actions">
        <button type="button" class="cc__btn" data-cc-action="reject">Alle ablehnen</button>
        <button type="button" class="cc__btn" data-cc-action="accept">Alle akzeptieren</button>
        <button type="button" class="cc__link" data-cc-action="settings" aria-controls="cc-settings">Einstellungen</button>
      </div>
    </div>

    <div class="cc__view" data-cc-view="settings" id="cc-settings" hidden>
      <h2 class="cc__title" tabindex="-1">Einstellungen</h2>
      <p class="cc__text">Wählen Sie, welche Dienste Sie zulassen möchten. Sie können Ihre Auswahl jederzeit ändern.</p>

      <div class="cc__cats">
        <div class="cc__cat">
          <div class="cc__cat-head">
            <label class="cc__cat-label" for="cc-necessary">Notwendig</label>
            <input class="cc__switch" type="checkbox" role="switch" id="cc-necessary" checked disabled aria-describedby="cc-necessary-info">
          </div>
          <p class="cc__cat-text" id="cc-necessary-info">Immer aktiv. Ermöglicht den Betrieb der Website und speichert Ihre Auswahl in diesem Banner.</p>
          <details class="cc__details">
            <summary>Details</summary>
            <dl>
              <dt>Anbieter</dt><dd>Rechtsanwalt Richard Mertens (diese Website)</dd>
              <dt>Zweck</dt><dd>Speicherung Ihrer Datenschutz-Auswahl, damit das Banner nicht bei jedem Aufruf erscheint.</dd>
              <dt>Speicherung</dt><dd>„rm_consent“ im lokalen Speicher Ihres Browsers, 12 Monate</dd>
              <dt>Rechtsgrundlage</dt><dd>§ 25 Abs. 2 Nr. 2 TDDDG, Art. 6 Abs. 1 lit. c DSGVO</dd>
            </dl>
          </details>
        </div>

        <div class="cc__cat">
          <div class="cc__cat-head">
            <label class="cc__cat-label" for="cc-statistics">Statistik</label>
            <input class="cc__switch" type="checkbox" role="switch" id="cc-statistics" data-cc-cat="statistics" aria-describedby="cc-statistics-info">
          </div>
          <p class="cc__cat-text" id="cc-statistics-info">Hilft mir zu verstehen, wie die Website genutzt wird, damit ich sie verbessern kann.</p>
          <details class="cc__details">
            <summary>Details</summary>
            <dl>
              <dt>Dienste</dt><dd>Google Tag Manager, Google Analytics 4</dd>
              <dt>Anbieter</dt><dd>Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland</dd>
              <dt>Zweck</dt><dd>Statistische Auswertung der Website-Nutzung (z.&nbsp;B. aufgerufene Seiten, Verweildauer, Gerät, ungefähre Region)</dd>
              <dt>Cookies</dt><dd>_ga, _ga_* – bis zu 2 Jahre</dd>
              <dt>Drittland</dt><dd>Übermittlung in die USA möglich (EU-US Data Privacy Framework)</dd>
              <dt>Rechtsgrundlage</dt><dd>Ihre Einwilligung, Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG</dd>
            </dl>
          </details>
        </div>

        <div class="cc__cat">
          <div class="cc__cat-head">
            <label class="cc__cat-label" for="cc-marketing">Marketing</label>
            <input class="cc__switch" type="checkbox" role="switch" id="cc-marketing" data-cc-cat="marketing" aria-describedby="cc-marketing-info">
          </div>
          <p class="cc__cat-text" id="cc-marketing-info">Misst, ob meine Google-Anzeigen zu Anfragen führen, und ermöglicht passende Anzeigen auf anderen Websites.</p>
          <details class="cc__details">
            <summary>Details</summary>
            <dl>
              <dt>Dienste</dt><dd>Google Tag Manager, Google Ads (Conversion-Tracking, Remarketing)</dd>
              <dt>Anbieter</dt><dd>Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland</dd>
              <dt>Zweck</dt><dd>Erfolgsmessung von Anzeigen, Wiedererkennung für Werbung auf anderen Websites</dd>
              <dt>Cookies</dt><dd>_gcl_au – 90 Tage; Cookies auf doubleclick.net/google.com (z.&nbsp;B. IDE) – bis zu 13 Monate</dd>
              <dt>Drittland</dt><dd>Übermittlung in die USA möglich (EU-US Data Privacy Framework)</dd>
              <dt>Rechtsgrundlage</dt><dd>Ihre Einwilligung, Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG</dd>
            </dl>
          </details>
        </div>
      </div>

      <p class="cc__links"><a href="datenschutz.html">Datenschutzerklärung</a><a href="impressum.html">Impressum</a></p>
      <div class="cc__actions">
        <button type="button" class="cc__btn" data-cc-action="reject">Alle ablehnen</button>
        <button type="button" class="cc__btn" data-cc-action="save">Auswahl speichern</button>
        <button type="button" class="cc__btn" data-cc-action="accept">Alle akzeptieren</button>
      </div>
    </div>
  </div>
</section>`;

  let banner = null;
  let lastFocus = null;

  function showView(name) {
    banner.querySelectorAll('[data-cc-view]').forEach((v) => { v.hidden = v.dataset.ccView !== name; });
  }

  function syncSwitches() {
    const current = readConsent() || { statistics: false, marketing: false };
    banner.querySelectorAll('[data-cc-cat]').forEach((input) => {
      input.checked = Boolean(current[input.dataset.ccCat]);
    });
  }

  function showBanner(view) {
    if (!banner) return;
    lastFocus = document.activeElement;
    syncSwitches();
    showView(view || 'main');
    banner.hidden = false;
    if (view === 'settings') banner.querySelector('#cc-settings .cc__title').focus();
  }

  function hideBanner() {
    if (!banner) return;
    banner.hidden = true;
    if (lastFocus && document.contains(lastFocus) && lastFocus !== document.body) lastFocus.focus();
  }

  function buildBanner() {
    document.body.insertAdjacentHTML('afterbegin', html); // als erstes Element: Tastatur erreicht das Banner zuerst
    banner = document.getElementById('cc');

    banner.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-cc-action]');
      if (!btn) return;
      const action = btn.dataset.ccAction;
      if (action === 'accept') saveChoice({ statistics: true, marketing: true });
      if (action === 'reject') saveChoice({ statistics: false, marketing: false });
      if (action === 'settings') {
        showView('settings');
        banner.querySelector('#cc-settings .cc__title').focus();
      }
      if (action === 'save') {
        saveChoice({
          statistics: banner.querySelector('#cc-statistics').checked,
          marketing: banner.querySelector('#cc-marketing').checked,
        });
      }
    });

    // „Cookie-Einstellungen“-Links überall auf der Seite
    document.addEventListener('click', (event) => {
      const opener = event.target.closest('[data-cc-open]');
      if (!opener) return;
      event.preventDefault();
      showBanner('settings');
    });
  }

  /* ---------- Start ---------- */
  const stored = readConsent();
  if (stored) applyConsent(stored);

  const init = () => {
    buildBanner();
    if (!stored) showBanner('main');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
