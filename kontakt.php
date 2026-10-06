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

// Anhänge: werden nicht gespeichert, sondern nur an die E-Mail gehängt
const MAX_FILES      = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;   // je Datei
const MAX_ALL_BYTES  = 15 * 1024 * 1024;   // zusammen
// erlaubte Endungen und der tatsächliche Dateiinhalt (geprüft per finfo, nicht per Browser-Angabe)
const FILE_TYPES = [
    'pdf'  => ['application/pdf'],
    'jpg'  => ['image/jpeg'],
    'jpeg' => ['image/jpeg'],
    'png'  => ['image/png'],
    'doc'  => ['application/msword', 'application/CDFV2', 'application/x-ole-storage'],
    'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/octet-stream'],
];

$wantsJson = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');
$isEnglish = (($_POST['lang'] ?? '') === 'en');   // englisches Formular unter /en/

function respond(bool $ok, string $message, bool $json): never
{
    global $isEnglish;
    if ($json) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code($ok ? 200 : 400);
        echo json_encode(['success' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    } else {
        // ohne JavaScript: zurück zur Seite bzw. Bestätigungsseite der jeweiligen Sprache
        $target = $isEnglish
            ? ($ok ? 'en/thank-you.html' : 'en/#contact')
            : ($ok ? 'danke.html' : 'index.html#kontakt');
        header('Location: ' . $target, true, 303);
    }
    exit;
}

/* ---------- nur POST von dieser Website ---------- */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(false, 'Ungültige Anfrage.', $wantsJson);
}

$fileError = $isEnglish
    ? 'The documents could not be accepted. Please send up to 5 files (PDF, JPG, PNG, Word), 15 MB in total.'
    : 'Die Unterlagen konnten nicht angenommen werden. Bitte senden Sie bis zu 5 Dateien (PDF, JPG, PNG, Word), zusammen höchstens 15 MB.';

// Upload größer als die Server-Grenze: PHP verwirft dann den ganzen Formularinhalt
if (empty($_POST) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    respond(false, 'Die Unterlagen sind zu groß. Bitte senden Sie zusammen höchstens 15 MB. / The documents are too large. Please send no more than 15 MB in total.', $wantsJson);
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

/* ---------- Anhänge prüfen ---------- */
$attachments = [];
$upload = $_FILES['anhang'] ?? null;
if (is_array($upload) && is_array($upload['name'])) {
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $total = 0;
    foreach ($upload['name'] as $i => $original) {
        $error = $upload['error'][$i];
        if ($error === UPLOAD_ERR_NO_FILE) {
            continue;                                   // leeres Feld
        }
        if ($error !== UPLOAD_ERR_OK || !is_uploaded_file($upload['tmp_name'][$i])) {
            respond(false, $fileError, $wantsJson);
        }
        $size = (int)$upload['size'][$i];
        $ext  = strtolower(pathinfo((string)$original, PATHINFO_EXTENSION));
        $mime = (string)$finfo->file($upload['tmp_name'][$i]);
        $total += $size;
        if (
            count($attachments) >= MAX_FILES
            || $size <= 0 || $size > MAX_FILE_BYTES || $total > MAX_ALL_BYTES
            || !isset(FILE_TYPES[$ext]) || !in_array($mime, FILE_TYPES[$ext], true)
        ) {
            respond(false, $fileError, $wantsJson);
        }
        // Dateiname bereinigen: nur sichere Zeichen, Endung bleibt erhalten
        $base = preg_replace('/[^A-Za-z0-9._-]+/', '_', pathinfo((string)$original, PATHINFO_FILENAME));
        $base = trim(mb_substr((string)$base, 0, 80), '._') ?: 'anhang';
        $attachments[] = [
            'name' => $base . '.' . $ext,
            'mime' => FILE_TYPES[$ext][0],
            'data' => (string)file_get_contents($upload['tmp_name'][$i]),
        ];
    }
}

/* ---------- E-Mail an die Kanzlei ---------- */
$subject = mb_encode_mimeheader(
    'Neue Anfrage über die Website' . ($isEnglish ? ' (Englisch)' : '') . ': ' . $topic,
    'UTF-8',
    'B'
);

$body = "Neue Anfrage über das Kontaktformular\n"
      . "=====================================\n\n"
      . "Name:     {$name}\n"
      . "E-Mail:   {$email}\n"
      . "Telefon:  " . ($phone !== '' ? $phone : '–') . "\n"
      . "Anliegen: {$topic}\n"
      . 'Sprache:  ' . ($isEnglish ? 'Englisch (Anfrage über die englische Seite)' : 'Deutsch') . "\n\n"
      . "Nachricht:\n{$message}\n\n"
      . 'Anhänge:  ' . ($attachments ? implode(', ', array_column($attachments, 'name')) : '–') . "\n\n"
      . "-------------------------------------\n"
      . 'Gesendet am ' . date('d.m.Y \u\m H:i') . " Uhr\n";

$headers = [
    'From'         => mb_encode_mimeheader(SITE_NAME, 'UTF-8', 'B') . ' <' . MAIL_FROM . '>',
    'Reply-To'     => $email,
    'MIME-Version' => '1.0',
    'X-Mailer'     => 'PHP',
];

if ($attachments) {
    // Text + Dateien als multipart/mixed
    $boundary = 'rm-' . bin2hex(random_bytes(12));
    $headers['Content-Type'] = "multipart/mixed; boundary=\"{$boundary}\"";
    $mailBody = "--{$boundary}\r\n"
              . "Content-Type: text/plain; charset=UTF-8\r\n"
              . "Content-Transfer-Encoding: 8bit\r\n\r\n"
              . $body . "\r\n";
    foreach ($attachments as $file) {
        $mailBody .= "--{$boundary}\r\n"
                   . "Content-Type: {$file['mime']}; name=\"{$file['name']}\"\r\n"
                   . "Content-Transfer-Encoding: base64\r\n"
                   . "Content-Disposition: attachment; filename=\"{$file['name']}\"\r\n\r\n"
                   . chunk_split(base64_encode($file['data'])) . "\r\n";
    }
    $mailBody .= "--{$boundary}--\r\n";
} else {
    $headers['Content-Type'] = 'text/plain; charset=UTF-8';
    $headers['Content-Transfer-Encoding'] = '8bit';
    $mailBody = $body;
}

$sent = mail(MAIL_TO, $subject, $mailBody, $headers, '-f' . MAIL_FROM);

if (!$sent) {
    respond(false, 'Die Anfrage konnte nicht gesendet werden.', $wantsJson);
}
respond(true, 'Vielen Dank. Ihre Anfrage ist angekommen.', $wantsJson);
