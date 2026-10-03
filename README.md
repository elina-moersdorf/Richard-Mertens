# Rechtsanwalt Richard Mertens – Landingpage

Statische Landingpage (HTML, CSS, JavaScript) mit Kontaktformular in PHP.
Gehostet bei STRATO (Hosting Basic, PHP 8.3).

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Landingpage |
| `impressum.html`, `datenschutz.html` | Rechtstexte |
| `danke.html` | Bestätigung nach dem Formularversand (ohne JavaScript) |
| `style.css`, `script.js` | Gestaltung und Interaktion |
| `consent.js` | Consent-Banner mit Google Consent Mode v2 – **GTM-ID eintragen** |
| `kontakt.php` | Formularversand per E-Mail über den STRATO-Webspace |
| `fonts/`, `vendor/`, `assets/img/` | Schriften, Bibliotheken (GSAP, Lenis), optimierte Bilder |
| `GTM-ANLEITUNG.md` | Einrichtung von Google Tag Manager und Google Ads |

## Vor dem Livegang

- GTM-Container-ID in `consent.js` eintragen
- Gelb markierte Platzhalter in `impressum.html` und `datenschutz.html` ausfüllen
- Nach dem Hochladen eine Testanfrage über das Formular senden

## Änderungen ausrollen

Nach Änderungen an `style.css` oder `script.js` die Versionsnummer `?v=` in den HTML-Dateien erhöhen,
damit Browser die neue Fassung laden.
