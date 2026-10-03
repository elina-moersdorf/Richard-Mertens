<?php
/* =========================================================
   Kontaktformular – Rechtsanwalt Richard Mertens
   Versand direkt über den STRATO-Webspace, ohne Drittanbieter.
   Es werden KEINE Formulardaten auf dem Server gespeichert –
   die Anfrage geht ausschließlich per E-Mail an die Kanzlei.
   ========================================================= */

declare(strict_types=1);

const MAIL_TO     = 'info@mertens-anwalt.de';      // Empfänger der Formularanfragen
const MAIL_FROM   = 'info@mertens-anwalt.de';      // muss ein bestehendes STRATO-Postfach im selben Paket sein
const SITE_NAME   = 'Website Richard Mertens';
const MIN_SECONDS = 3;                                 // schneller ausgefüllte Formulare gelten als Spam
const TOPICS      = ['Scheidung', 'Unterhalt', 'Sorge- und Umgangsrecht', 'Zugewinn und Vermögen', 'Sonstiges'];

$wantsJson = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');

function respond(bool $ok, string $message, bool $json): never
{
    if ($json) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code($ok ? 200 : 400);
        echo json_encode(['success' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    } else {
        // ohne JavaScript: zurück zur Seite bzw. Bestätigungsseite
        header('Location: ' . ($ok ? 'danke.html' : 'index.html#kontakt'), true, 303);
    }
    exit;
}

/* ---------- nur POST von dieser Website ---------- */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(false, 'Ungültige Anfrage.', $wantsJson);
}
$origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$host   = $_SERVER['HTTP_HOST'] ?? '';
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== $host) {
    respond(false, 'Ungültige Anfrage.', $wantsJson);
}

/* ---------- Spamschutz ohne Drittanbieter ---------- */
// 1. Fallen-Feld: für Menschen unsichtbar, Bots füllen es aus
if (trim((string)($_POST['website'] ?? '')) !== '') {
    respond(true, 'OK', $wantsJson);            // Bots bekommen eine scheinbare Erfolgsmeldung
}
// 2. Zeitprüfung: Zeitstempel wird per JavaScript beim Laden gesetzt
$ts = (int)($_POST['ts'] ?? 0);
if ($ts > 0 && (time() - intdiv($ts, 1000)) < MIN_SECONDS) {
    respond(true, 'OK', $wantsJson);
}

/* ---------- Eingaben prüfen ---------- */
$clean = static fn(string $key, int $max): string =>
    mb_substr(trim(str_replace(["\r", "\n"], ' ', (string)($_POST[$key] ?? ''))), 0, $max);

$name    = $clean('name', 120);
$phone   = $clean('phone', 40);
$email   = $clean('email', 160);
$topic   = $clean('anliegen', 60);
$message = mb_substr(trim((string)($_POST['message'] ?? '')), 0, 5000);

if ($name === '' || $message === '' || !in_array($topic, TOPICS, true)) {
    respond(false, 'Bitte füllen Sie alle Pflichtfelder aus.', $wantsJson);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, 'Bitte geben Sie eine gültige E-Mail-Adresse ein.', $wantsJson);
}
if ($phone !== '' && !preg_match('/^[0-9 +()\/.\-]{5,40}$/', $phone)) {
    respond(false, 'Bitte prüfen Sie die Telefonnummer.', $wantsJson);
}

/* ---------- E-Mail an die Kanzlei ---------- */
$subject = mb_encode_mimeheader('Neue Anfrage über die Website: ' . $topic, 'UTF-8', 'B');

$body = "Neue Anfrage über das Kontaktformular\n"
      . "=====================================\n\n"
      . "Name:     {$name}\n"
      . "E-Mail:   {$email}\n"
      . "Telefon:  " . ($phone !== '' ? $phone : '–') . "\n"
      . "Anliegen: {$topic}\n\n"
      . "Nachricht:\n{$message}\n\n"
      . "-------------------------------------\n"
      . 'Gesendet am ' . date('d.m.Y \u\m H:i') . " Uhr\n";

$headers = [
    'From'                      => mb_encode_mimeheader(SITE_NAME, 'UTF-8', 'B') . ' <' . MAIL_FROM . '>',
    'Reply-To'                  => $email,
    'MIME-Version'              => '1.0',
    'Content-Type'              => 'text/plain; charset=UTF-8',
    'Content-Transfer-Encoding' => '8bit',
    'X-Mailer'                  => 'PHP',
];

$sent = mail(MAIL_TO, $subject, $body, $headers, '-f' . MAIL_FROM);

if (!$sent) {
    respond(false, 'Die Anfrage konnte nicht gesendet werden.', $wantsJson);
}
respond(true, 'Vielen Dank. Ihre Anfrage ist angekommen.', $wantsJson);
