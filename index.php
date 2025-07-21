<!DOCTYPE html>
<html lang="hr">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mini Radio Player</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"
        integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Play:wght@400;700&display=swap" rel="stylesheet">
    <link href="css/style.css?v=<?= time() ?>" rel="stylesheet">
</head>

<body>
    <div class="player">

        <div class="tab-controls" id="tabControlsContainer">
            </div>

        <div class="station-buttons-container" id="stationButtonsContainer">
            <button class="station-btn active-station">Učitavanje...</button>
        </div>
        <div class="control-buttons-container">
            <button class="btn btn-primary btn-lg" id="prevPageBtn"><i class="fas fa-backward"></i></button>
            <button class="btn btn-primary btn-lg" id="playPauseBtn"><i class="fas fa-play" id="playPauseIcon"></i></button>
            <button class="btn btn-primary btn-lg" id="stopBtn"><i class="fas fa-stop"></i></button>
            <button class="btn btn-primary btn-lg" id="nextPageBtn"><i class="fas fa-forward"></i></button>
            <button class="btn btn-primary btn-lg" id="muteBtn"><i class="fas fa-volume-up" id="muteIcon"></i></button>
        </div>

        <div id="nowPlaying">Trenutno ne svira ništa</div>
        <div id="currentSong">&nbsp;</div>

        <div id="volumeControl">
            <span style="margin-right: 10px; width:20px;">0</span>
            <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="1.0"> <span id="volumeValue" style="margin-left: 10px; width:20px;">100</span> </div>
    </div>

    <script src="js/script.js"></script>
</body>

</html>
