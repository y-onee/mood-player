const API_URL = "https://uqgibe2e90.execute-api.us-east-1.amazonaws.com/recommend";
const RADIO_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/radio`;
const RADIO_HANDLE_KEY = "armyRadioHandle";
const RADIO_HANDLE = getStationName();

let ytPlayer;
let currentPlaylist = [];
let currentIndex = 0;
let radioSocket;
let radioConnected = false;
let activeStations = [];
let currentStationId = null;
let currentListenerStationId = null;
let stationName = RADIO_HANDLE;
let radioMode = "solo";
let pendingBroadcast = false;

function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('youtube-embed', {
        height: '100%',
        width: '100%',
        videoId: '',
        playerVars: {
            'autoplay': 1,
            'controls': 1
        },
        events: {
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerStateChange(event) {
    const playPauseBtn = document.getElementById('btn-play-pause');
    if (event.data === YT.PlayerState.PLAYING) {
        if(playPauseBtn) playPauseBtn.textContent = '⏸';
        document.querySelector('.cassette-front').classList.add('playing');
        document.querySelector('.cassette-back').classList.add('playing');
    } else if (event.data === YT.PlayerState.PAUSED) {
        if(playPauseBtn) playPauseBtn.textContent = '⏵';
        document.querySelector('.cassette-front').classList.remove('playing');
        document.querySelector('.cassette-back').classList.remove('playing');
    } else if (event.data === YT.PlayerState.ENDED) {
        if (radioMode === 'listening') {
            return;
        }
        playNextSong();
    }
    if (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.PAUSED) {
        syncBroadcastState(true);
    }
}

function highlightCurrentSong() {
    const listItems = document.querySelectorAll('#playlist li');
    listItems.forEach((li, index) => {
        if (index === currentIndex) {
            li.style.background = 'rgba(255, 255, 255, 0.8)';
            li.style.borderRadius = '5px';
        } else {
            li.style.background = 'transparent';
        }
    });
}

function playNextSong() {
    currentIndex++;
    if (currentIndex < currentPlaylist.length) {
        const videoId = currentPlaylist[currentIndex].video_id;
        if(videoId) ytPlayer.loadVideoById(videoId);
        highlightCurrentSong();
        syncBroadcastState(true);
    } else {
        document.querySelector('.cassette-front').classList.remove('playing');
        document.querySelector('.cassette-back').classList.remove('playing');
    }
}

function playSong(index) {
    currentIndex = index;
    const videoId = currentPlaylist[currentIndex].video_id;
    if(videoId) ytPlayer.loadVideoById(videoId);
    document.querySelector('.cassette-front').classList.add('playing');
    document.querySelector('.cassette-back').classList.add('playing');
    highlightCurrentSong();
    syncBroadcastState(true);
}

const form = document.getElementById('mood-form');
const input = document.getElementById('mood-input');
const loading = document.getElementById('loading');
const cassetteElement = document.getElementById('cassette');
const playlistEl = document.getElementById('playlist');
const stationsListEl = document.getElementById('stations-list');
const stationCountEl = document.getElementById('station-count');
const radioStatusTextEl = document.getElementById('radio-status-text');
const radioConnectionStateEl = document.getElementById('radio-connection-state');
const leaveStationBtn = document.getElementById('leave-station-btn');

const screws = document.querySelectorAll('.screw');
screws.forEach(screw => {
    screw.addEventListener('click', () => {
        cassetteElement.classList.toggle('flipped');
    });
});

const btnPrev = document.getElementById('btn-prev');
const btnPlayPause = document.getElementById('btn-play-pause');
const btnNext = document.getElementById('btn-next');

if(btnPrev) {
    btnPrev.addEventListener('click', () => {
        if (radioMode !== 'listening' && currentIndex > 0) playSong(currentIndex - 1);
    });
}
if(btnNext) {
    btnNext.addEventListener('click', () => {
        if (radioMode !== 'listening' && currentIndex < currentPlaylist.length - 1) playSong(currentIndex + 1);
    });
}
if(btnPlayPause) {
    btnPlayPause.addEventListener('click', () => {
        if (!ytPlayer || !ytPlayer.getPlayerState) return;
        const state = ytPlayer.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
            ytPlayer.pauseVideo();
        } else {
            ytPlayer.playVideo();
        }
    });
}
if (leaveStationBtn) {
    leaveStationBtn.addEventListener('click', leaveCurrentStation);
}

connectRadio();
setInterval(() => {
    if (radioMode === 'broadcasting') {
        syncBroadcastState(false);
    }
}, 5000);

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mood = input.value.trim();
    if (!mood) return;

    if (radioMode === 'listening') {
        leaveCurrentStation();
    }

    input.blur();
    document.querySelector('.cassette-front').classList.add('playing');
    document.querySelector('.cassette-back').classList.add('playing');
    loading.classList.remove('hidden');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mood })
        });

        if (!response.ok) throw new Error("API request failed");
        
        const data = await response.json();
        const recommendations = data.recommendations || [];

        currentPlaylist = recommendations.filter(r => r.video_id);
        currentIndex = 0;
        
        if (currentPlaylist.length > 0) {
            pendingBroadcast = true;
            stationName = createStationName(mood);
            renderPlaylist();
            cassetteElement.classList.add('flipped');
            if(ytPlayer && ytPlayer.loadVideoById) {
                playSong(0);
            } else {
                setTimeout(() => playSong(0), 1000);
            }
        } else {
            alert("This mood is too complex! No songs found.");
            document.querySelector('.cassette-front').classList.remove('playing');
            document.querySelector('.cassette-back').classList.remove('playing');
        }
    } catch (err) {
        console.error(err);
        alert("The tape got jammed. (Backend API Error)");
        document.querySelector('.cassette-front').classList.remove('playing');
        document.querySelector('.cassette-back').classList.remove('playing');
    } finally {
        loading.classList.add('hidden');
    }
});

function renderPlaylist() {
    playlistEl.innerHTML = '';
    currentPlaylist.forEach((song, i) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="title">${escapeHtml(song.title)} - ${escapeHtml(song.artist)}</span>
            <span class="reason">${escapeHtml(song.reason || '')}</span>
        `;
        li.addEventListener('click', () => {
            if (radioMode !== 'listening') {
                playSong(i);
            }
        });
        if (i === currentIndex) {
            li.style.background = 'rgba(255, 255, 255, 0.8)';
            li.style.borderRadius = '5px';
        }
        playlistEl.appendChild(li);
    });
}

function connectRadio() {
    setRadioConnectionState('Connecting', false);
    radioSocket = new WebSocket(RADIO_URL);

    radioSocket.addEventListener('open', () => {
        radioConnected = true;
        setRadioConnectionState('Live', true);
        setRadioStatus(radioMode === 'broadcasting'
            ? `Broadcasting as ${stationName}.`
            : radioMode === 'listening'
                ? 'Tuned in to a live station.'
                : 'Pick a station or start your own mood session.');
        requestStations();
        if (pendingBroadcast) {
            ensureBroadcastSession();
        } else if (currentListenerStationId) {
            sendRadioMessage({ type: 'tune_in', station_id: currentListenerStationId });
        }
    });

    radioSocket.addEventListener('message', (event) => {
        handleRadioMessage(JSON.parse(event.data));
    });

    radioSocket.addEventListener('close', () => {
        radioConnected = false;
        if (currentStationId) {
            pendingBroadcast = true;
            currentStationId = null;
        }
        setRadioConnectionState('Offline', false);
        setRadioStatus('Radio connection lost. Retrying...');
        setTimeout(connectRadio, 2000);
    });

    radioSocket.addEventListener('error', () => {
        setRadioConnectionState('Error', false);
    });
}

function handleRadioMessage(message) {
    if (message.error) {
        setRadioStatus(message.error);
        return;
    }

    if (message.type === 'stations_list') {
        activeStations = message.stations || [];
        renderStations();
        return;
    }

    if (message.type === 'broadcast_started') {
        currentStationId = message.station_id;
        radioMode = 'broadcasting';
        pendingBroadcast = false;
        setRadioStatus(`Broadcasting as ${stationName}.`);
        renderStations();
        return;
    }

    if (message.type === 'tuned_in') {
        radioMode = 'listening';
        currentListenerStationId = message.station_id;
        setRadioStatus(`Tuned in to ${message.name}.`);
        leaveStationBtn.classList.remove('hidden');
        syncRemoteSong(message.song, true);
        renderStations();
        return;
    }

    if (message.type === 'tuned_out') {
        radioMode = currentStationId ? 'broadcasting' : 'solo';
        currentListenerStationId = null;
        leaveStationBtn.classList.add('hidden');
        setRadioStatus(currentStationId ? `Broadcasting as ${stationName}.` : 'You left the station.');
        renderStations();
        return;
    }

    if (message.type === 'song_update' && radioMode === 'listening') {
        syncRemoteSong(message.song, false);
        return;
    }

    if (message.type === 'station_ended' && currentListenerStationId === message.station_id) {
        radioMode = currentStationId ? 'broadcasting' : 'solo';
        currentListenerStationId = null;
        leaveStationBtn.classList.add('hidden');
        setRadioStatus('That station went off air.');
        renderStations();
    }
}

function requestStations() {
    sendRadioMessage({ type: 'get_stations' });
}

function sendRadioMessage(payload) {
    if (!radioSocket || radioSocket.readyState !== WebSocket.OPEN) {
        return false;
    }
    radioSocket.send(JSON.stringify(payload));
    return true;
}

function renderStations() {
    stationCountEl.textContent = activeStations.length;

    if (!activeStations.length) {
        stationsListEl.innerHTML = '<div class="empty-stations">No stations live yet. Start a mood session to go on air.</div>';
        return;
    }

    stationsListEl.innerHTML = '';

    activeStations.forEach((station) => {
        const card = document.createElement('article');
        const isOwnStation = station.station_id === currentStationId;
        const isCurrentListen = station.station_id === currentListenerStationId;
        card.className = `station-card${isOwnStation || isCurrentListen ? ' active-station' : ''}`;

        const songLine = station.song && station.song.title
            ? `<p class="station-song"><strong>Now playing:</strong> ${escapeHtml(station.song.title)} - ${escapeHtml(station.song.artist || 'Unknown artist')}</p>`
            : '<p class="station-empty">Waiting for the next song update.</p>';

        const buttonLabel = isOwnStation ? 'Your Station' : isCurrentListen ? 'Listening' : 'Tune In';
        const buttonDisabled = isOwnStation || !radioConnected || radioMode === 'broadcasting';

        card.innerHTML = `
            <div class="station-card-header">
                <div>
                    <h3>${escapeHtml(station.name)}</h3>
                    <p class="station-meta">${station.listener_count} listener${station.listener_count === 1 ? '' : 's'}</p>
                </div>
                <div class="radio-pill ${isCurrentListen || isOwnStation ? 'online' : ''}">${isOwnStation ? 'On Air' : isCurrentListen ? 'Synced' : 'Live'}</div>
            </div>
            ${songLine}
            <div class="station-actions">
                <button type="button" ${buttonDisabled ? 'disabled' : ''}>${buttonLabel}</button>
            </div>
        `;

        const button = card.querySelector('button');
        if (!buttonDisabled) {
            button.addEventListener('click', () => tuneIntoStation(station.station_id));
        }

        stationsListEl.appendChild(card);
    });
}

function tuneIntoStation(stationId) {
    if (!radioConnected || stationId === currentStationId || radioMode === 'broadcasting') {
        return;
    }
    if (currentListenerStationId && currentListenerStationId !== stationId) {
        sendRadioMessage({ type: 'tune_out', station_id: currentListenerStationId });
    }
    currentListenerStationId = stationId;
    radioMode = 'listening';
    leaveStationBtn.classList.remove('hidden');
    setRadioStatus('Tuning into the station...');
    sendRadioMessage({ type: 'tune_in', station_id: stationId });
}

function leaveCurrentStation() {
    if (!currentListenerStationId) {
        return;
    }
    sendRadioMessage({ type: 'tune_out', station_id: currentListenerStationId });
}

function ensureBroadcastSession() {
    if (!currentPlaylist.length) {
        return;
    }

    if (!radioConnected) {
        pendingBroadcast = true;
        setRadioStatus('Playlist ready. Waiting for radio connection...');
        return;
    }

    const payload = {
        type: currentStationId ? 'song_update' : 'broadcast',
        station_id: currentStationId,
        name: stationName,
        song: buildCurrentSongPayload(),
    };

    sendRadioMessage(payload);
}

function syncBroadcastState(force) {
    if (radioMode !== 'broadcasting' && !pendingBroadcast) {
        return;
    }
    if (!currentPlaylist.length || !ytPlayer || !ytPlayer.getCurrentTime) {
        return;
    }

    if (pendingBroadcast || !currentStationId) {
        ensureBroadcastSession();
        return;
    }

    if (!force && ytPlayer.getPlayerState && ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING) {
        return;
    }

    sendRadioMessage({
        type: 'song_update',
        station_id: currentStationId,
        song: buildCurrentSongPayload(),
    });
}

function buildCurrentSongPayload() {
    const song = currentPlaylist[currentIndex] || {};
    return {
        video_id: song.video_id,
        title: song.title,
        artist: song.artist,
        reason: song.reason,
        position: ytPlayer && ytPlayer.getCurrentTime ? Math.floor(ytPlayer.getCurrentTime()) : 0,
        is_playing: ytPlayer && ytPlayer.getPlayerState ? ytPlayer.getPlayerState() === YT.PlayerState.PLAYING : true,
        updated_at: Date.now(),
    };
}

function syncRemoteSong(song, forceReload) {
    if (!song || !song.video_id || !ytPlayer) {
        return;
    }

    const remoteEntry = {
        video_id: song.video_id,
        title: song.title || 'Live song',
        artist: song.artist || '',
        reason: 'Synced from a live station.',
    };
    currentPlaylist = [remoteEntry];
    currentIndex = 0;
    renderPlaylist();
    cassetteElement.classList.add('flipped');

    const currentVideoId = ytPlayer.getVideoData ? ytPlayer.getVideoData().video_id : '';
    const targetPosition = Number(song.position || 0);

    if (forceReload || currentVideoId !== song.video_id) {
        ytPlayer.loadVideoById(song.video_id, targetPosition);
    } else if (ytPlayer.getCurrentTime && Math.abs(ytPlayer.getCurrentTime() - targetPosition) > 2) {
        ytPlayer.seekTo(targetPosition, true);
    }

    if (song.is_playing === false) {
        window.setTimeout(() => {
            if (ytPlayer.pauseVideo) {
                ytPlayer.pauseVideo();
            }
        }, 250);
    } else if (ytPlayer.playVideo) {
        ytPlayer.playVideo();
    }
}

function setRadioStatus(message) {
    radioStatusTextEl.textContent = message;
}

function setRadioConnectionState(label, online) {
    radioConnectionStateEl.textContent = label;
    radioConnectionStateEl.classList.toggle('online', online);
    radioConnectionStateEl.classList.toggle('offline', !online);
}

function getStationName() {
    const existing = window.localStorage.getItem(RADIO_HANDLE_KEY);
    if (existing) {
        return existing;
    }
    const generated = `ARMY-${Math.random().toString(36).slice(2, 6).toUpperCase()}'s Radio`;
    window.localStorage.setItem(RADIO_HANDLE_KEY, generated);
    return generated;
}

function createStationName(mood) {
    return `${RADIO_HANDLE} (${mood.slice(0, 24)})`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

window.addEventListener('beforeunload', () => {
    if (currentListenerStationId) {
        sendRadioMessage({ type: 'tune_out', station_id: currentListenerStationId });
    }
    if (radioSocket && radioSocket.readyState === WebSocket.OPEN) {
        radioSocket.close();
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}
