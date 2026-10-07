# Google Tag Manager & Google Ads – Einrichtung mit dem Consent-Banner

Container: **GTM-P35MM9F5** (eingetragen in `consent.js`)

## Wie das Banner arbeitet

1. `consent.js` steht auf jeder Seite als erstes Script im `<head>` und setzt sofort alle
   Consent-Mode-v2-Signale auf `denied` (`ad_storage`, `ad_user_data`, `ad_personalization`,
   `analytics_storage`, außerdem `functionality_storage`, `personalization_storage`) und
   `ads_data_redaction: true`.
2. **Der GTM-Container wird erst geladen, wenn der Besucher Statistik oder Marketing erlaubt.**
   Vor der Einwilligung geht keine einzige Anfrage an Google, auch keine cookielosen Pings.
   Das offizielle GTM-Snippet steckt deshalb in `loadGTM()` in `consent.js` und nicht direkt im `<head>`.
3. Nach der Entscheidung sendet das Banner `gtag('consent', 'update', …)` und das Event
   `consent_update` mit den Variablen `consent_statistics` und `consent_marketing` an den `dataLayer`.
4. Ein Widerruf löscht die Cookies `_ga*` bzw. `_gcl*` und lädt die Seite neu.

**Kein `<noscript>`-iframe:** Das Fallback würde Google ohne Einwilligung laden. Ohne
JavaScript kann niemand einwilligen, und Conversion-Tags brauchen ohnehin JavaScript.

Den Standard-GTM-Code von Google **nicht** zusätzlich in die Seiten einbauen.

## 1. Consent-Übersicht in GTM aktivieren

Verwaltung → Containereinstellungen → **„Übersicht über die Einwilligung aktivieren“** anhaken.
Danach erscheint in der Tag-Liste das Schild-Symbol für die Consent-Prüfung.

## 2. Tags an die Einwilligung koppeln

| Tag | Integrierte Prüfung | Zusätzlich erforderliche Einwilligung (strengste Einstellung) |
|---|---|---|
| Google-Tag (GA4-Konfiguration) | analytics_storage | `analytics_storage` |
| GA4-Ereignisse | analytics_storage | `analytics_storage` |
| Google Ads Conversion-Tracking | ad_storage | `ad_storage`, `ad_user_data` |
| Google Ads Remarketing | ad_storage | `ad_storage`, `ad_user_data`, `ad_personalization` |
| Conversion-Verknüpfung | ad_storage | `ad_storage` |

So geht es pro Tag: Tag öffnen → Erweiterte Einstellungen → **Einwilligungseinstellungen** →
„Zusätzliche Einwilligung für das Auslösen des Tags erforderlich“ → die Typen aus der Tabelle eintragen.

**Wichtig:** Kein Tag darf den Consent-Default selbst setzen (z. B. Consent-Vorlagen aus der Galerie).
Das übernimmt allein `consent.js`.

## 3. Conversion „Anfrage gesendet“ mit erweiterten Conversions

### Was die Website liefert

Nach **bestätigtem** Versand des Kontaktformulars (nicht bei Fehlern, nicht doppelt, nicht bei
Spam-Bots) schreibt `script.js` in den `dataLayer`:

```js
{
  event: 'generate_lead',
  form_id: 'contact_form',
  form_language: 'de' | 'en' | 'ru',
  user_data: { email: 'name@beispiel.de' }   // nur mit Einwilligung in „Marketing“
}
```

Die E-Mail-Adresse ist bereits getrimmt und kleingeschrieben. Name, Telefon, Anliegen,
Nachricht und Anhänge kommen nie in den `dataLayer`.

### Variablen anlegen

1. **Datenschichtvariable** `DLV – user_data.email`
   Name der Datenschichtvariable: `user_data.email` · Version 2
2. **Datenschichtvariable** `DLV – form_language` (optional, für Auswertungen)
   Name: `form_language`
3. **Vom Nutzer bereitgestellte Daten** `UPD – E-Mail`
   Variablentyp „Vom Nutzer bereitgestellte Daten“ → **Manuelle Konfiguration** →
   E-Mail: `{{DLV – user_data.email}}`

### Trigger anlegen

**Benutzerdefiniertes Ereignis** `CE – generate_lead`
Ereignisname: `generate_lead` · Auslösen bei: Alle benutzerdefinierten Ereignisse

### Tags anlegen

1. **Conversion-Verknüpfung** (Conversion Linker), Trigger: All Pages / Alle Seiten.
2. **Google Ads-Conversion-Tracking** `Ads – Anfrage gesendet`
   - Conversion-ID und Conversion-Label aus Google Ads (Ziele → Conversions → Aktion → Tag einrichten → Google Tag Manager)
   - **„Vom Nutzer bereitgestellte Daten aus Ihrer Website einbeziehen“** anhaken → `{{UPD – E-Mail}}`
   - Trigger: `CE – generate_lead`
   - Einwilligung: `ad_storage`, `ad_user_data` (siehe Tabelle oben)
3. Optional GA4-Ereignis `generate_lead` mit demselben Trigger, **ohne** E-Mail-Adresse
   (personenbezogene Daten dürfen nicht an Google Analytics gehen).

Optional für Anrufe: Trigger „Klick – Nur Links“, Bedingung `Click URL` beginnt mit `tel:`,
dazu ein zweites Conversion-Tag (eigene Conversion-Aktion in Google Ads).

### In Google Ads freischalten

Ziele → Conversions → Einstellungen → **Erweiterte Conversions für das Web** aktivieren →
Methode **Google Tag Manager** → Nutzungsbedingungen für Kundendaten akzeptieren.

## 4. Google Analytics (datenschutzfreundliche Einstellungen, wie in der Datenschutzerklärung beschrieben)

- Verwaltung → Datenerfassung und -änderung → **Datenaufbewahrung: 2 Monate**
- **Google Signals: aus**
- **Detaillierte Standort- und Gerätedaten: aus**
- Datenfreigabe an andere Google-Produkte: aus

## 5. Prüfen (Tag Assistant / Vorschaumodus)

Das Formular sendet nur auf dem Server (PHP), also auf der Live-Domain testen.

1. Vor der Auswahl: GTM lädt gar nicht, keine Anfrage an `googletagmanager.com`.
   Tag Assistant verbindet sich erst, **nachdem** im Banner eingewilligt wurde.
2. „Alle ablehnen“: weiterhin keine Anfragen an Google.
3. Nur „Statistik“: GA4 feuert, Google-Ads-Tags sind blockiert; `generate_lead` enthält **keine** E-Mail.
4. „Alle akzeptieren“, dann Testanfrage senden: Ereignis `generate_lead` erscheint, unter
   „Variablen“ steht `user_data.email`, das Tag `Ads – Anfrage gesendet` hat ausgelöst,
   im Tab „Einwilligung“ stehen alle Werte auf `granted`.
5. In Google Ads unter der Conversion-Aktion → Diagnose für erweiterte Conversions prüfen (dauert einige Tage).

## 6. Bei Änderungen

Werden neue Dienste oder Zwecke ergänzt, `CONSENT_VERSION` in `consent.js` erhöhen
(zuletzt 1.1 für die erweiterten Conversions). Dann werden alle Besucher erneut gefragt,
und die Datenschutzerklärung (DE/EN/RU) muss ergänzt werden.
