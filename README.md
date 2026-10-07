# Rechtsanwalt Richard Mertens – Landingpage

Statische Landingpage (HTML, CSS, JavaScript) mit Kontaktformular in PHP.
Gehostet bei STRATO (Hosting Basic, PHP 8.3).

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Landingpage |
| `impressum.html`, `datenschutz.html` | Rechtstexte |
| `danke.html` | Bestätigung nach dem Formularversand (ohne JavaScript) |
| `en/` | Englische Fassung: `index.html`, `legal-notice.html`, `privacy.html`, `thank-you.html` |
| `ru/` | Russische Fassung, gleiche Dateinamen wie `en/` – Umschalter „DE \| EN \| RU“ in der Kopfzeile (auf Handys in der schmalen Leiste darüber), `hreflang`-Verweise auf allen Seiten |
| `style.css`, `script.js` | Gestaltung und Interaktion |
| `consent.js` | Consent-Banner mit Google Consent Mode v2, lädt Google Tag Manager (GTM-P35MM9F5) erst nach Einwilligung – erstes Script im `<head>` jeder Seite |
| `kontakt.php` | Formularversand per E-Mail über den STRATO-Webspace; meldet `sent: true` nur bei echtem Versand (Grundlage für das Conversion-Ereignis `generate_lead`) |
| `robots.txt`, `sitemap.xml` | Suchmaschinen: Sitemap mit den drei Startseiten und ihren Sprachverknüpfungen |
| `fonts/`, `vendor/`, `assets/img/` | Schriften (inkl. kyrillischer Zeichensatz, lädt nur bei Bedarf), Bibliotheken (GSAP, Lenis), optimierte Bilder |
| `.user.ini` | PHP-Upload-Grenzen für die Anhänge im Formular |
| `GTM-ANLEITUNG.md` | Einrichtung von Google Tag Manager und Google Ads |

## Vor dem Livegang

- USt-IdNr. im Impressum nachtragen (`impressum.html`, `en/legal-notice.html`, `ru/legal-notice.html`; derzeit bewusst weggelassen)
- GTM und Google Ads nach `GTM-ANLEITUNG.md` einrichten (Trigger `generate_lead`, erweiterte Conversions)
- Nach dem Hochladen eine Testanfrage über das Formular senden (im Tag Assistant prüfen)
- Sitemap in der Google Search Console einreichen: `https://mertens-rechtsanwalt.de/sitemap.xml`

## Änderungen ausrollen

Nach Änderungen an `style.css` oder `script.js` die Versionsnummer `?v=` in den HTML-Dateien erhöhen,
damit Browser die neue Fassung laden.
