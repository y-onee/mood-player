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
    if (event.data === YT.PlayerState.ENDED) {
        playNextSong();
    }
}

function playNextSong() {
    currentIndex++;
    if (currentIndex < currentPlaylist.length) {
        const videoId = currentPlaylist[currentIndex].video_id;
        if(videoId) ytPlayer.loadVideoById(videoId);
    } else {
        document.querySelector('.cassette').classList.remove('playing');
    }
}

function playSong(index) {
    currentIndex = index;
    const videoId = currentPlaylist[currentIndex].video_id;
    if(videoId) ytPlayer.loadVideoById(videoId);
    document.querySelector('.cassette').classList.add('playing');
}

const form = document.getElementById('mood-form');
const input = document.getElementById('mood-input');
const loading = document.getElementById('loading');
const cassetteElement = document.querySelector('.cassette');
const playerModal = document.getElementById('player-modal');
const playlistEl = document.getElementById('playlist');
const closeBtn = document.getElementById('close-btn');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mood = input.value.trim();
    if (!mood) return;

    input.blur(); // Hide keyboard on mobile
    cassetteElement.classList.add('playing');
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
            playerModal.classList.remove('hidden');
            if(ytPlayer && ytPlayer.loadVideoById) {
                playSong(0);
            } else {
                // If API isn't ready yet
                setTimeout(() => playSong(0), 1000);
            }
        } else {
            alert("This mood is too complex! No songs found.");
            cassetteElement.classList.remove('playing');
        }
    } catch (err) {
        console.error(err);
        alert("The tape got jammed. (Backend API Error)");
        cassetteElement.classList.remove('playing');
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

closeBtn.addEventListener('click', () => {
    playerModal.classList.add('hidden');
    cassetteElement.classList.remove('playing');
    if (ytPlayer && ytPlayer.pauseVideo) {
        ytPlayer.pauseVideo();
    }
});
