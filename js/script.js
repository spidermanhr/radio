let songInfoInterval = null;
const audio = new Audio();
audio.crossOrigin = "anonymous";

// Provjera podrške za AudioContext
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = AudioContext ? new AudioContext() : null;

let analyser, source, gainNode;

if (audioContext) {
    analyser = audioContext.createAnalyser();
    source = audioContext.createMediaElementSource(audio);
    gainNode = audioContext.createGain();

    source.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioContext.destination);
} else {
    console.warn("Web Audio API (AudioContext) nije podržan u ovom pregledniku.");
}

let allStationsByFav = {};
let currentStations = []; // Niz stanica koje se trenutno prikazuju (za aktivni tab)
let currentlyPlayingStationObject = null; // Sprema cijeli objekt stanice koja trenutno svira
let isMuted = false;
let previousSong = '';
let activeNotification = null;
let activeFavCategory = '';

// Dohvat DOM elemenata
const stationButtonsContainer = document.getElementById('stationButtonsContainer');
const playPauseBtn = document.getElementById('playPauseBtn');
const playPauseIcon = document.getElementById('playPauseIcon');
const muteBtn = document.getElementById('muteBtn');
const muteIcon = document.getElementById('muteIcon');
const nowPlayingDisplay = document.getElementById('nowPlaying');
const currentSongDisplay = document.getElementById('currentSong');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValueDisplay = document.getElementById('volumeValue');
const tabControlsContainer = document.getElementById('tabControlsContainer');

// --- FUNKCIJE ---

// Pomoćna funkcija za normalizaciju URL-a
function normalizeUrl(url) {
    if (!url) return '';
    let normalized = url.trim();
    if (normalized.endsWith(';')) {
        normalized = normalized.slice(0, -1);
    }
    if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}

// Funkcija za ažuriranje prikaza "Trenutno slušate"
function updateNowPlayingDisplay() {
    if (audio.paused) {
        nowPlayingDisplay.textContent = 'Pauzirano.';
        currentSongDisplay.textContent = 'Pritisnite Play za nastavak.';
        stopNotifying();
        return;
    }

    // Ako imamo spremljen objekt stanice koja svira, koristimo njega
    if (currentlyPlayingStationObject) {
        nowPlayingDisplay.textContent = `Slušate: ${currentlyPlayingStationObject.name}`;
    } else {
        // Fallback ako iz nekog razloga currentlyPlayingStationObject nije postavljen
        nowPlayingDisplay.textContent = 'Slušate: N/A';
        currentSongDisplay.textContent = 'Odaberite stanicu.';
        stopNotifying();
    }
    // Metapodaci (pjesma) se ažuriraju preko fetchSongInfo
}

// Funkcija za ažuriranje stilova gumba stanica (aktivne stanice)
function updateStationButtonStyles() {
    const buttons = stationButtonsContainer.querySelectorAll('.station-btn');

    buttons.forEach((button) => {
        const stationIndexInTab = parseInt(button.dataset.index);
        const stationInTab = currentStations[stationIndexInTab];

        // Provjeravamo je li trenutna stanica koja svira ista kao gumb u DOM-u
        if (currentlyPlayingStationObject && stationInTab && 
            normalizeUrl(stationInTab.stream_url) === normalizeUrl(currentlyPlayingStationObject.stream_url) && 
            !audio.paused) {
            button.classList.add('active-station');
        } else {
            button.classList.remove('active-station');
        }
    });
}

// Funkcija za renderiranje gumba za stanice unutar aktivnog taba
function renderStationButtons() {
    stationButtonsContainer.innerHTML = ''; // Očisti prethodne gumbe

    if (currentStations.length === 0) {
        stationButtonsContainer.innerHTML = '<button class="station-btn">Nema dostupnih stanica u ovoj kategoriji.</button>';
        return;
    }

    currentStations.forEach((s, i) => {
        const button = document.createElement('button');
        button.classList.add('station-btn');
        button.textContent = s.name;
        button.dataset.index = i;
        button.onclick = () => {
            selectStation(parseInt(button.dataset.index));
        };
        stationButtonsContainer.appendChild(button);
    });

    updateStationButtonStyles(); // Ažuriraj boje gumba nakon renderiranja
}

// Funkcija za Play/Pause
function togglePlayPause(forcePlay = false) {
    if (audio.paused || forcePlay) {
        if (!currentlyPlayingStationObject && currentStations.length > 0) {
            // Ako nema odabrane stanice, odaberi prvu iz trenutnog taba
            currentlyPlayingStationObject = currentStations[0];
        } else if (currentStations.length === 0) {
            nowPlayingDisplay.textContent = 'Nema dostupnih radio stanica.';
            currentSongDisplay.textContent = '';
            return;
        }

        // Ako je forcePlay, koristimo trenutno odabrani objekt stanice
        // Inače, provjeravamo je li nešto već odabrano
        const stationToPlay = currentlyPlayingStationObject;

        if (!stationToPlay) {
            console.error("Nema stanice za puštanje.");
            return;
        }

        audio.src = stationToPlay.stream_url;

        // Odmah postavite naziv stanice čim se odabere i pokrene!
        nowPlayingDisplay.textContent = `Slušate: ${stationToPlay.name}`;


        try {
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
            audio.play();
            playPauseIcon.classList.remove('fa-play');
            playPauseIcon.classList.add('fa-pause');
            fetchSongInfo(); // Dohvati info o pjesmi
            clearInterval(songInfoInterval);
            songInfoInterval = setInterval(fetchSongInfo, 5000); // Svakih 5 sekundi
        } catch (e) {
            console.error("Greška pri puštanju zvuka:", e);
            nowPlayingDisplay.textContent = `Greška na stanici: ${stationToPlay.name}`;
            currentSongDisplay.textContent = 'Pokušajte ponovno ili odaberite drugu.';
            playPauseIcon.classList.remove('fa-pause');
            playPauseIcon.classList.add('fa-play');
        }
    } else {
        // Pauziraj reprodukciju
        audio.pause();
        playPauseIcon.classList.remove('fa-pause');
        playPauseIcon.classList.add('fa-play');
        nowPlayingDisplay.textContent = 'Pauzirano.';
        currentSongDisplay.textContent = 'Pritisnite Play za nastavak.';
        clearInterval(songInfoInterval);
        songInfoInterval = null;
        stopNotifying();
    }
    updateStationButtonStyles(); // Ažuriraj stil gumba nakon promjene statusa play/pause
}

// Funkcija za odabir i pokretanje stanice
function selectStation(index) {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }

    previousSong = ''; // Resetirajte previousSong kada se odabere nova stanica

    const selectedStation = currentStations[index];

    // Ako je ista stanica kliknuta i već svira, ne radi ništa
    if (currentlyPlayingStationObject && normalizeUrl(selectedStation.stream_url) === normalizeUrl(currentlyPlayingStationObject.stream_url) && !audio.paused) {
        return;
    }

    currentlyPlayingStationObject = selectedStation; // Postavi odabranu stanicu kao onu koja svira
    togglePlayPause(true); // Pokreni reprodukciju
}

// Funkcija za renderiranje tab gumba na temelju fav broja
function renderTabButtons(favCategories) {
    tabControlsContainer.innerHTML = ''; // Očisti prethodne tabove
    favCategories.forEach(favNumber => {
        const button = document.createElement('button');
        button.classList.add('tab-btn');
        button.textContent = `Favorite ${favNumber}`;
        button.dataset.favCategory = favNumber;
        button.onclick = () => switchTab(favNumber);
        tabControlsContainer.appendChild(button);
    });
}

// Funkcija za prebacivanje tabova (sada na temelju fav broja)
function switchTab(favNumber) {
    activeFavCategory = favNumber;
    currentStations = allStationsByFav[favNumber] || [];

    const tabButtons = tabControlsContainer.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        if (btn.dataset.favCategory == favNumber) {
            btn.classList.add('active-tab');
        } else {
            btn.classList.remove('active-tab');
        }
    });

    renderStationButtons(); // Ponovno renderiraj gumbe za novu kategoriju
    // updateStationButtonStyles(); // Ovo je već pozvano unutar renderStationButtons
}

// Funkcija za dohvaćanje informacija o pjesmi
async function fetchSongInfo() {
    // Koristimo currentlyPlayingStationObject za dohvat informacija o pjesmi
    if (!currentlyPlayingStationObject || audio.paused) {
        return;
    }

    const station = currentlyPlayingStationObject;
    const songInfoUrl = station.php_script ? `${station.php_script}?stream_url=${encodeURIComponent(station.stream_url)}` : station.stream_song_url;

    if (!songInfoUrl) {
        currentSongDisplay.textContent = 'Informacije o pjesmi nisu dostupne.';
        return;
    }

    try {
        const res = await fetch(songInfoUrl);
        if (!res.ok) throw new Error('Ne mogu dohvatiti pjesmu');
        const songInfo = await res.text();

        if (songInfo !== previousSong) {
            previousSong = songInfo;
            currentSongDisplay.textContent = `${songInfo}`;
            showNotification(station.name, songInfo);
        }
    } catch (e) {
        console.error('Greška pri dohvaćanju pjesme:', e);
        if (!audio.paused) {
            currentSongDisplay.textContent = 'Metapodaci nisu dostupni.';
        }
        showNotification(station.name, 'Ne mogu dohvatiti pjesmu');
    }
}

// Funkcija za prikaz obavijesti
function showNotification(stationName, songTitle) {
    if (Notification.permission === 'granted') {
        stopNotifying();
        activeNotification = new Notification(stationName, {
            body: songTitle ? songTitle : 'Reproducira se...',
            silent: true
        });
    }
}

// Funkcija za zatvaranje obavijesti
function stopNotifying() {
    if (activeNotification) {
        activeNotification.close();
        activeNotification = null;
    }
}

// Funkcija za prethodnu stanicu
function prevStation() {
    if (currentStations.length === 0) return;
    let newIndex = (currentStations.indexOf(currentlyPlayingStationObject) - 1 + currentStations.length) % currentStations.length;
    selectStation(newIndex);
}

// Funkcija za sljedeću stanicu
function nextStation() {
    if (currentStations.length === 0) return;
    let newIndex = (currentStations.indexOf(currentlyPlayingStationObject) + 1) % currentStations.length;
    selectStation(newIndex);
}

// Funkcija za zaustavljanje reprodukcije
function stop() {
    audio.pause();
    audio.currentTime = 0;
    nowPlayingDisplay.textContent = 'Slušate: N/A';
    currentSongDisplay.textContent = 'Zaustavljeno.';
    playPauseIcon.classList.remove('fa-pause');
    playPauseIcon.classList.add('fa-play');
    stopNotifying();
    currentlyPlayingStationObject = null; // Resetirajte odabranu stanicu
    updateStationButtonStyles(); // Ažurirajte stilove gumba
    clearInterval(songInfoInterval); // Zaustavi dohvaćanje informacija o pjesmi
    songInfoInterval = null;
    previousSong = ''; // Resetiraj prethodnu pjesmu
}

// Funkcija za isključivanje/uključivanje zvuka
function toggleMute() {
    isMuted = !isMuted;
    audio.muted = isMuted;

    if (isMuted) {
        muteIcon.classList.remove('fa-volume-up');
        muteIcon.classList.add('fa-volume-mute');
        volumeSlider.value = 0;
        volumeValueDisplay.textContent = 0;
    } else {
        muteIcon.classList.remove('fa-volume-mute');
        muteIcon.classList.add('fa-volume-up');
        // Vrati na prethodnu vrijednost ako je isključeno, inače koristi trenutnu
        volumeSlider.value = audio.volume === 0 ? 0.7 : audio.volume;
        volumeValueDisplay.textContent = Math.round(audio.volume * 100);
    }
}

// Funkcija za postavljanje glasnoće
function setVolume(value) {
    const volume = parseFloat(value);
    if (audioContext) {
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    } else {
        audio.volume = volume;
    }

    volumeValueDisplay.textContent = Math.round(volume * 100);

    if (volume > 0 && isMuted) {
        isMuted = false;
        audio.muted = false;
        muteIcon.classList.remove('fa-volume-mute');
        muteIcon.classList.add('fa-volume-up');
    } else if (volume === 0 && !isMuted) {
        isMuted = true;
        audio.muted = true;
        muteIcon.classList.remove('fa-volume-up');
        muteIcon.classList.add('fa-volume-mute');
    }
}

// Funkcija za traženje dozvole za obavijesti
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('Dozvola za obavijesti odobrena!');
            } else if (permission === 'denied') {
                console.warn('Dozvola za obavijesti odbijena.');
            }
        });
    }
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('AudioContext resumed successfully');
        }).catch(e => {
            console.error('Error resuming AudioContext:', e);
        });
    }
}

// Funkcija za učitavanje stanica iz 'streams.json'
async function loadStations() {
    try {
        const res = await fetch(`streams.json?_=${new Date().getTime()}`);
        if (!res.ok) throw new Error(`Ne mogu dohvatiti stanice: ${res.status}`);
        const data = await res.json();

        allStationsByFav = {};
        data.streams.forEach(station => {
            if (station.prikazi === 'D' && station.fav) {
                if (!allStationsByFav[station.fav]) {
                    allStationsByFav[station.fav] = [];
                }
                allStationsByFav[station.fav].push(station);
            }
        });

        const favCategories = Object.keys(allStationsByFav).sort((a, b) => parseInt(a) - parseInt(b));

        if (favCategories.length > 0) {
            renderTabButtons(favCategories);
            activeFavCategory = favCategories[0]; // Postavi prvi tab kao aktivni
            switchTab(activeFavCategory); // Prebaci na prvi tab
        } else {
            stationButtonsContainer.innerHTML = '<button class="station-btn">Nema dostupnih stanica za prikaz.</button>';
            nowPlayingDisplay.textContent = 'Nema aktivnih radio stanica.';
            currentSongDisplay.textContent = '';
            tabControlsContainer.style.display = 'none';
        }
        updateNowPlayingDisplay(); // Inicijalni prikaz
    } catch (e) {
        console.error('Greška pri učitavanju stanica:', e);
        stationButtonsContainer.innerHTML = '<button class="station-btn">Greška učitavanja</button>';
        nowPlayingDisplay.textContent = 'Greška: Ne mogu učitati stanice.';
        currentSongDisplay.textContent = 'Provjerite streams.json datoteku.';
        tabControlsContainer.style.display = 'none';
    }
}

// --- Inicijalizacija i Event Listeneri ---
window.addEventListener('load', () => {
    loadStations();
    requestNotificationPermission();

    const initialVolume = parseFloat(volumeSlider.value);
    setVolume(initialVolume);

    playPauseBtn.addEventListener('click', () => togglePlayPause());
    muteBtn.addEventListener('click', toggleMute);
    document.getElementById('stopBtn').addEventListener('click', stop);
    document.getElementById('prevPageBtn').addEventListener('click', prevStation);
    document.getElementById('nextPageBtn').addEventListener('click', nextStation);
    volumeSlider.addEventListener('input', (e) => setVolume(e.target.value));

    // Ažuriraj ikone play/mute na temelju inicijalnog stanja
    if (audio.paused) {
        playPauseIcon.classList.remove('fa-pause');
        playPauseIcon.classList.add('fa-play');
    } else {
        playPauseIcon.classList.remove('fa-play');
        playPauseIcon.classList.add('fa-pause');
    }

    if (audio.muted) {
        muteIcon.classList.remove('fa-volume-up');
        muteIcon.classList.add('fa-volume-mute');
    } else {
        muteIcon.classList.remove('fa-volume-mute');
        muteIcon.classList.add('fa-volume-up');
    }
});
