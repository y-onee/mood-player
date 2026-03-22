const API_URL = "https://uqgibe2e90.execute-api.us-east-1.amazonaws.com/recommend";

let ytPlayer;
let currentPlaylist = [];
let currentIndex = 0;

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
        playNextSong();
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
}

const form = document.getElementById('mood-form');
const input = document.getElementById('mood-input');
const loading = document.getElementById('loading');
const cassetteElement = document.getElementById('cassette');
const playlistEl = document.getElementById('playlist');

const screws = document.querySelectorAll('.screw');
screws.forEach(screw => {
    screw.addEventListener('click', () => {
        cassetteElement.classList.toggle('flipped');
    });
});

const btnPrev = document.getElementById('btn-prev');
const btnPlayPause = document.getElementById('btn-play-pause');
const btnNext = document.getElementById('btn-next');
const playerControls = document.getElementById('player-controls');

if(btnPrev) {
    btnPrev.addEventListener('click', () => {
        if (currentIndex > 0) playSong(currentIndex - 1);
    });
}
if(btnNext) {
    btnNext.addEventListener('click', () => {
        if (currentIndex < currentPlaylist.length - 1) playSong(currentIndex + 1);
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

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mood = input.value.trim();
    if (!mood) return;

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
        
        if (currentPlaylist.length > 0) {
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
            <span class="title">${song.title} - ${song.artist}</span>
            <span class="reason">${song.reason}</span>
        `;
        li.addEventListener('click', () => playSong(i));
        if (i === currentIndex) {
            li.style.background = 'rgba(255, 255, 255, 0.8)';
            li.style.borderRadius = '5px';
        }
        playlistEl.appendChild(li);
    });
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}
