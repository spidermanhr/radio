<?php
// Provjera ako je stream URL poslan putem GET parametra
if (isset($_GET['stream_url'])) {
    $streamUrl = $_GET['stream_url'];

    // Uklonite znak ';' s URL-a ako postoji
    $streamUrl = rtrim($streamUrl, ';');

    // Funkcija za dohvat StreamTitle
    function getStreamTitle($streamUrl) {
        // Izvršavanje ffmpeg komande
        $command = "ffmpeg -i $streamUrl 2>&1";  // 2>&1 spaja izlaz i greške u jedan stream
        $output = shell_exec($command);

        // Debugging: Ispis cijelog izlaza za provjeru
        //echo "<pre>" . htmlspecialchars($output) . "</pre>";

        // Traži StreamTitle u izlazu
        if (preg_match('/StreamTitle\s*:\s*([^(\r\n)]+)/', $output, $matches)) {
            return trim($matches[1]); // Uklanja suvišne razmake
        }

        // Ako nije pronađen StreamTitle, vratiti default poruku
        return 'StreamTitle nije pronađen.';
    }

    // Dohvati trenutni StreamTitle
    $currentTitle1 = getStreamTitle($streamUrl);

// Inicijalizacija varijabli
$artist = '';
$song = '';
$album = '';

// Provjera ako StreamTitle sadrži " -"
if (strpos($currentTitle1, " -") !== false) {
    // Razdvajanje na izvođača i pjesmu
    $splitTitle = explode(" -", $currentTitle1);
    $artist = trim($splitTitle[0]);
    $song = trim($splitTitle[1]);

    // Provjera ako postoji i album
    if (count($splitTitle) > 2) {
        $album = trim($splitTitle[2]);
    }
} else {
    // Ako nema " -", cijeli naslov ide u izvođača
    $artist = $currentTitle1;
    $song = '';  // Pjesma nije definirana
}

// Ako postoji album, staviti ga u zagrade u pjesmi
if ($album) {
    $song .= " ($album)";
}

// Finalni izlaz kao CurrentTitle
$currentTitle = $artist . ' - ' . $song;

// Ako želite izlaz prikazati na ekranu
//echo $finalTitle;


    // Vraća samo StreamTitle (tekstualni sadržaj)
    echo "$currentTitle";
} else {
    echo 'Nema stream URL-a.';
}
?>
