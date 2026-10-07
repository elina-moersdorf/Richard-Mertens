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
   5. window.rmConsent.has('marketing' | 'statistics') liefert anderen
      Skripten den aktuellen Stand (z. B. für erweiterte Conversions).

   Das offizielle GTM-Snippet steht bewusst NICHT ungefiltert im <head>:
   Es würde Google vor der Einwilligung laden. Es wird in loadGTM()
   ausgeführt, sobald eine Einwilligung vorliegt. Das <noscript>-iframe
   entfällt aus demselben Grund (ohne JavaScript ist keine Einwilligung möglich).
   ========================================================= */
(() => {
  'use strict';

  const GTM_ID = 'GTM-P35MM9F5';         // Container-ID von Google Tag Manager
  const CONSENT_VERSION = '1.1';         // erhöhen, wenn sich Dienste/Zwecke ändern → erneute Abfrage
                                         // 1.1: erweiterte Conversions (gehashte E-Mail-Adresse) ergänzt
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

  // Lesezugriff für andere Skripte, z. B. ob die E-Mail-Adresse für erweiterte Conversions
  // in den dataLayer darf (nur mit Einwilligung in „Marketing“)
  window.rmConsent = Object.freeze({
    has: (category) => {
      const current = readConsent();
      return Boolean(current && current[category]);
    },
  });

  /* ---------- 2. Einwilligung anwenden ---------- */
  let gtmLoaded = false;

  // entspricht dem offiziellen GTM-Snippet, wird aber erst nach Einwilligung ausgeführt
  function loadGTM() {
    if (gtmLoaded || !/^GTM-[A-Z0-9]+$/.test(GTM_ID)) return;
    gtmLoaded = true;
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    const f = document.getElementsByTagName('script')[0];
    const j = document.createElement('script');
    j.async = true;
    j.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(GTM_ID);
    f.parentNode.insertBefore(j, f);
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

  /* ---------- 3. Banner (Texte je Sprache, Sprache aus <html lang>) ---------- */
  const LANG = ['en', 'ru'].includes(document.documentElement.lang) ? document.documentElement.lang : 'de';
  const L = {
    de: {
      title: 'Datenschutz-Einstellungen',
      intro: 'Ich setze auf dieser Website Dienste von Google ein (Google Tag Manager, Google Analytics, Google Ads), um die Nutzung statistisch auszuwerten und den Erfolg meiner Anzeigen zu messen. Diese Dienste nutze ich nur mit Ihrer Einwilligung. Mit Ihrer Einwilligung in „Marketing“ wird beim Absenden des Kontaktformulars außerdem Ihre E-Mail-Adresse in gehashter (pseudonymisierter) Form an Google übermittelt, damit ich Anfragen meinen Anzeigen zuordnen kann. Dabei können Daten an Google in die USA übermittelt werden. Ihre Einwilligung ist freiwillig und kann jederzeit über „Cookie-Einstellungen“ am Seitenende geändert oder widerrufen werden. Technisch notwendige Funktionen sind immer aktiv.',
      privacy: 'Datenschutzerklärung', privacyHref: 'datenschutz.html',
      imprint: 'Impressum', imprintHref: 'impressum.html',
      reject: 'Alle ablehnen', accept: 'Alle akzeptieren', settings: 'Einstellungen', save: 'Auswahl speichern',
      settingsTitle: 'Einstellungen',
      settingsIntro: 'Wählen Sie, welche Dienste Sie zulassen möchten. Sie können Ihre Auswahl jederzeit ändern.',
      details: 'Details',
      provider: 'Anbieter', services: 'Dienste', purpose: 'Zweck', storage: 'Speicherung', cookies: 'Cookies', thirdCountry: 'Drittland', legalBasis: 'Rechtsgrundlage',
      necessary: 'Notwendig',
      necessaryInfo: 'Immer aktiv. Ermöglicht den Betrieb der Website und speichert Ihre Auswahl in diesem Banner.',
      necessaryProvider: 'Rechtsanwalt Richard Mertens (diese Website)',
      necessaryPurpose: 'Speicherung Ihrer Datenschutz-Auswahl, damit das Banner nicht bei jedem Aufruf erscheint.',
      necessaryStorage: '„rm_consent“ im lokalen Speicher Ihres Browsers, 12 Monate',
      necessaryBasis: '§ 25 Abs. 2 Nr. 2 TDDDG, Art. 6 Abs. 1 lit. c DSGVO',
      statistics: 'Statistik',
      statisticsInfo: 'Hilft mir zu verstehen, wie die Website genutzt wird, damit ich sie verbessern kann.',
      statisticsPurpose: 'Statistische Auswertung der Website-Nutzung (z.&nbsp;B. aufgerufene Seiten, Verweildauer, Gerät, ungefähre Region)',
      statisticsCookies: '_ga, _ga_* – bis zu 2 Jahre',
      marketing: 'Marketing',
      marketingInfo: 'Misst, ob meine Google-Anzeigen zu Anfragen führen (auch mithilfe Ihrer gehashten E-Mail-Adresse beim Absenden des Formulars), und ermöglicht passende Anzeigen auf anderen Websites.',
      marketingServices: 'Google Tag Manager, Google Ads (Conversion-Tracking inkl. erweiterter Conversions, Remarketing)',
      marketingPurpose: 'Erfolgsmessung von Anzeigen; beim Absenden des Kontaktformulars Abgleich Ihrer gehashten E-Mail-Adresse (SHA-256) mit Google-Konten (erweiterte Conversions); Wiedererkennung für Werbung auf anderen Websites',
      marketingCookies: '_gcl_au – 90 Tage; Cookies auf doubleclick.net/google.com (z.&nbsp;B. IDE) – bis zu 13 Monate',
      google: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland',
      usa: 'Übermittlung in die USA möglich (EU-US Data Privacy Framework)',
      consentBasis: 'Ihre Einwilligung, Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG',
    },
    en: {
      title: 'Privacy settings',
      intro: 'This website uses Google services (Google Tag Manager, Google Analytics, Google Ads) to analyse how the site is used and to measure the success of my advertising. I only use these services with your consent. If you consent to “Marketing”, your email address is also sent to Google in hashed (pseudonymised) form when you submit the contact form, so that I can attribute enquiries to my ads. In the process, data may be transferred to Google in the USA. Your consent is voluntary and can be changed or withdrawn at any time via “Cookie settings” at the bottom of the page. Strictly necessary functions are always active.',
      privacy: 'Privacy policy', privacyHref: 'privacy.html',
      imprint: 'Legal notice', imprintHref: 'legal-notice.html',
      reject: 'Reject all', accept: 'Accept all', settings: 'Settings', save: 'Save selection',
      settingsTitle: 'Settings',
      settingsIntro: 'Choose which services you would like to allow. You can change your selection at any time.',
      details: 'Details',
      provider: 'Provider', services: 'Services', purpose: 'Purpose', storage: 'Storage', cookies: 'Cookies', thirdCountry: 'Third country', legalBasis: 'Legal basis',
      necessary: 'Necessary',
      necessaryInfo: 'Always active. Required for the website to work and to store your choice in this banner.',
      necessaryProvider: 'Rechtsanwalt Richard Mertens (this website)',
      necessaryPurpose: 'Stores your privacy choice so that the banner does not reappear on every visit.',
      necessaryStorage: '“rm_consent” in your browser’s local storage, 12 months',
      necessaryBasis: 'Section 25(2) no. 2 TDDDG, Art. 6(1)(c) GDPR',
      statistics: 'Statistics',
      statisticsInfo: 'Helps me understand how the website is used so that I can improve it.',
      statisticsPurpose: 'Statistical analysis of website usage (e.g. pages viewed, time spent, device, approximate region)',
      statisticsCookies: '_ga, _ga_* – up to 2 years',
      marketing: 'Marketing',
      marketingInfo: 'Measures whether my Google ads lead to enquiries (also using your hashed email address when you submit the form) and enables relevant ads on other websites.',
      marketingServices: 'Google Tag Manager, Google Ads (conversion tracking incl. enhanced conversions, remarketing)',
      marketingPurpose: 'Measuring the success of ads; when you submit the contact form, matching your hashed email address (SHA-256) with Google accounts (enhanced conversions); recognising visitors for advertising on other websites',
      marketingCookies: '_gcl_au – 90 days; cookies on doubleclick.net/google.com (e.g. IDE) – up to 13 months',
      google: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland',
      usa: 'Transfer to the USA possible (EU-US Data Privacy Framework)',
      consentBasis: 'Your consent, Art. 6(1)(a) GDPR, Section 25(1) TDDDG',
    },
    ru: {
      title: 'Настройки конфиденциальности',
      intro: 'На этом сайте я использую сервисы Google (Google Tag Manager, Google Analytics, Google Ads), чтобы статистически анализировать использование сайта и оценивать эффективность своей рекламы. Эти сервисы я использую только с Вашего согласия. Если Вы согласились на «Маркетинг», при отправке контактной формы Ваш адрес электронной почты также передаётся Google в хешированном (псевдонимизированном) виде, чтобы я мог соотнести запросы со своей рекламой. При этом данные могут передаваться Google в США. Ваше согласие добровольно, его можно в любой момент изменить или отозвать через «Настройки cookie» внизу страницы. Технически необходимые функции активны всегда.',
      privacy: 'Политика конфиденциальности', privacyHref: 'privacy.html',
      imprint: 'Выходные данные', imprintHref: 'legal-notice.html',
      reject: 'Отклонить все', accept: 'Принять все', settings: 'Настройки', save: 'Сохранить выбор',
      settingsTitle: 'Настройки',
      settingsIntro: 'Выберите, какие сервисы Вы хотите разрешить. Вы можете изменить свой выбор в любое время.',
      details: 'Подробнее',
      provider: 'Поставщик', services: 'Сервисы', purpose: 'Цель', storage: 'Хранение', cookies: 'Cookie', thirdCountry: 'Третья страна', legalBasis: 'Правовое основание',
      necessary: 'Необходимые',
      necessaryInfo: 'Всегда активны. Нужны для работы сайта и сохранения Вашего выбора в этом окне.',
      necessaryProvider: 'Rechtsanwalt Richard Mertens (этот сайт)',
      necessaryPurpose: 'Сохранение Вашего выбора настроек конфиденциальности, чтобы окно не появлялось при каждом посещении.',
      necessaryStorage: '«rm_consent» в локальном хранилище Вашего браузера, 12 месяцев',
      necessaryBasis: '§ 25 абз. 2 п. 2 TDDDG, ст. 6 абз. 1 лит. c GDPR (DSGVO)',
      statistics: 'Статистика',
      statisticsInfo: 'Помогает мне понять, как используется сайт, чтобы я мог его улучшить.',
      statisticsPurpose: 'Статистический анализ использования сайта (например, просмотренные страницы, время на сайте, устройство, приблизительный регион)',
      statisticsCookies: '_ga, _ga_* – до 2 лет',
      marketing: 'Маркетинг',
      marketingInfo: 'Показывает, приводят ли мои объявления в Google к запросам (в том числе с помощью Вашего хешированного адреса эл. почты при отправке формы), и позволяет показывать подходящую рекламу на других сайтах.',
      marketingServices: 'Google Tag Manager, Google Ads (отслеживание конверсий, включая расширенные конверсии, ремаркетинг)',
      marketingPurpose: 'Оценка эффективности рекламы; при отправке контактной формы – сопоставление Вашего хешированного адреса эл. почты (SHA-256) с аккаунтами Google (расширенные конверсии); повторное распознавание посетителей для рекламы на других сайтах',
      marketingCookies: '_gcl_au – 90 дней; cookie на doubleclick.net/google.com (например, IDE) – до 13 месяцев',
      google: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ирландия',
      usa: 'Возможна передача в США (EU-US Data Privacy Framework)',
      consentBasis: 'Ваше согласие, ст. 6 абз. 1 лит. a GDPR (DSGVO), § 25 абз. 1 TDDDG',
    },
  }[LANG];

  const row = (term, value) => `<dt>${term}</dt><dd>${value}</dd>`;

  const html = `
<section class="cc" id="cc" role="dialog" aria-modal="false" aria-labelledby="cc-title" aria-describedby="cc-desc" lang="${LANG}" hidden>
  <div class="cc__inner">
    <div class="cc__view" data-cc-view="main">
      <h2 class="cc__title" id="cc-title">${L.title}</h2>
      <p class="cc__text" id="cc-desc">${L.intro}</p>
      <p class="cc__links"><a href="${L.privacyHref}">${L.privacy}</a><a href="${L.imprintHref}">${L.imprint}</a></p>
      <div class="cc__actions">
        <button type="button" class="cc__btn" data-cc-action="reject">${L.reject}</button>
        <button type="button" class="cc__btn" data-cc-action="accept">${L.accept}</button>
        <button type="button" class="cc__link" data-cc-action="settings" aria-controls="cc-settings">${L.settings}</button>
      </div>
    </div>

    <div class="cc__view" data-cc-view="settings" id="cc-settings" hidden>
      <h2 class="cc__title" tabindex="-1">${L.settingsTitle}</h2>
      <p class="cc__text">${L.settingsIntro}</p>

      <div class="cc__cats">
        <div class="cc__cat">
          <div class="cc__cat-head">
            <label class="cc__cat-label" for="cc-necessary">${L.necessary}</label>
            <input class="cc__switch" type="checkbox" role="switch" id="cc-necessary" checked disabled aria-describedby="cc-necessary-info">
          </div>
          <p class="cc__cat-text" id="cc-necessary-info">${L.necessaryInfo}</p>
          <details class="cc__details">
            <summary>${L.details}</summary>
            <dl>
              ${row(L.provider, L.necessaryProvider)}
              ${row(L.purpose, L.necessaryPurpose)}
              ${row(L.storage, L.necessaryStorage)}
              ${row(L.legalBasis, L.necessaryBasis)}
            </dl>
          </details>
        </div>

        <div class="cc__cat">
          <div class="cc__cat-head">
            <label class="cc__cat-label" for="cc-statistics">${L.statistics}</label>
            <input class="cc__switch" type="checkbox" role="switch" id="cc-statistics" data-cc-cat="statistics" aria-describedby="cc-statistics-info">
          </div>
          <p class="cc__cat-text" id="cc-statistics-info">${L.statisticsInfo}</p>
          <details class="cc__details">
            <summary>${L.details}</summary>
            <dl>
              ${row(L.services, 'Google Tag Manager, Google Analytics 4')}
              ${row(L.provider, L.google)}
              ${row(L.purpose, L.statisticsPurpose)}
              ${row(L.cookies, L.statisticsCookies)}
              ${row(L.thirdCountry, L.usa)}
              ${row(L.legalBasis, L.consentBasis)}
            </dl>
          </details>
        </div>

        <div class="cc__cat">
          <div class="cc__cat-head">
            <label class="cc__cat-label" for="cc-marketing">${L.marketing}</label>
            <input class="cc__switch" type="checkbox" role="switch" id="cc-marketing" data-cc-cat="marketing" aria-describedby="cc-marketing-info">
          </div>
          <p class="cc__cat-text" id="cc-marketing-info">${L.marketingInfo}</p>
          <details class="cc__details">
            <summary>${L.details}</summary>
            <dl>
              ${row(L.services, L.marketingServices)}
              ${row(L.provider, L.google)}
              ${row(L.purpose, L.marketingPurpose)}
              ${row(L.cookies, L.marketingCookies)}
              ${row(L.thirdCountry, L.usa)}
              ${row(L.legalBasis, L.consentBasis)}
            </dl>
          </details>
        </div>
      </div>

      <p class="cc__links"><a href="${L.privacyHref}">${L.privacy}</a><a href="${L.imprintHref}">${L.imprint}</a></p>
      <div class="cc__actions">
        <button type="button" class="cc__btn" data-cc-action="reject">${L.reject}</button>
        <button type="button" class="cc__btn" data-cc-action="save">${L.save}</button>
        <button type="button" class="cc__btn" data-cc-action="accept">${L.accept}</button>
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
