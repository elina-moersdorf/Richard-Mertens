# Google Tag Manager & Google Ads – Einrichtung mit dem Consent-Banner

## Wie das Banner arbeitet

1. `consent.js` setzt sofort beim Laden alle Consent-Mode-v2-Signale auf `denied`
   (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`, außerdem
   `functionality_storage`, `personalization_storage`) und `ads_data_redaction: true`.
2. **Der GTM-Container wird erst geladen, wenn der Besucher Statistik oder Marketing erlaubt.**
   Vor der Einwilligung geht also keine einzige Anfrage an Google, auch keine cookielosen Pings.
3. Nach der Entscheidung sendet das Banner `gtag('consent', 'update', …)` und das Event
   `consent_update` mit den Variablen `consent_statistics` und `consent_marketing` an den `dataLayer`.
4. Ein Widerruf löscht die Cookies `_ga*` bzw. `_gcl*` und lädt die Seite neu.

## 1. Container-ID eintragen

In `consent.js` die Zeile `const GTM_ID = 'GTM-XXXXXXX';` durch die eigene ID ersetzen.
Den Standard-GTM-Code von Google **nicht** zusätzlich in die Seite einbauen.

## 2. Consent-Übersicht in GTM aktivieren

Verwaltung → Containereinstellungen → **„Übersicht über die Einwilligung aktivieren“** anhaken.
Danach erscheint in der Tag-Liste das Schild-Symbol für die Consent-Prüfung.

## 3. Tags an die Einwilligung koppeln

| Tag | Integrierte Prüfung | Zusätzlich erforderliche Einwilligung (strengste Einstellung) |
|---|---|---|
| Google-Tag (GA4-Konfiguration) | analytics_storage | `analytics_storage` |
| GA4-Ereignisse | analytics_storage | `analytics_storage` |
| Google Ads Conversion-Tracking | ad_storage | `ad_storage`, `ad_user_data` |
| Google Ads Remarketing | ad_storage | `ad_storage`, `ad_user_data`, `ad_personalization` |
| Conversion-Verknüpfung | ad_storage | `ad_storage` |

So geht es pro Tag: Tag öffnen → Erweiterte Einstellungen → **Einwilligungseinstellungen** →
„Zusätzliche Einwilligung für das Auslösen des Tags erforderlich“ → die Typen aus der Tabelle eintragen.
Damit feuern Google-Ads-Tags erst nach Einwilligung in „Marketing“ und Analytics erst nach „Statistik“.

## 4. Trigger

- Google-Tag (GA4): Trigger **„Consent-Initialisierung – Alle Seiten“** oder „Initialisierung – Alle Seiten“.
- Conversion-Tags (z. B. Formular gesendet, Klick auf `tel:`-Link): normale Trigger verwenden.
  Die Einwilligungseinstellungen aus Schritt 3 verhindern das Auslösen ohne Zustimmung.
- Optional: Benutzerdefiniertes Ereignis `consent_update` als Trigger, falls ein Tag direkt nach der
  Zustimmung auf derselben Seite laufen soll.

**Wichtig:** Kein Tag darf den Consent-Default selbst setzen (z. B. Consent-Vorlagen aus der Galerie).
Das übernimmt allein `consent.js`.

## 5. Google Analytics (datenschutzfreundliche Einstellungen, wie in der Datenschutzerklärung beschrieben)

- Verwaltung → Datenerfassung und -änderung → **Datenaufbewahrung: 2 Monate**
- **Google Signals: aus**
- **Detaillierte Standort- und Gerätedaten: aus**
- Datenfreigabe an andere Google-Produkte: aus

## 6. Prüfen

GTM-Vorschaumodus (Tag Assistant) öffnen und testen:
1. Vor der Auswahl: GTM lädt gar nicht, keine Anfrage an `googletagmanager.com`.
2. „Alle ablehnen“: weiterhin keine Anfragen an Google.
3. Nur „Statistik“: GA4 feuert, Google-Ads-Tags sind blockiert.
4. „Alle akzeptieren“: alle Tags feuern, im Tab „Einwilligung“ stehen alle Werte auf `granted`.

## 7. Bei Änderungen

Werden neue Dienste ergänzt, `CONSENT_VERSION` in `consent.js` erhöhen.
Dann werden alle Besucher erneut gefragt, und die Datenschutzerklärung muss ergänzt werden.
