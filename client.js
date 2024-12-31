// client.js
const serverUrl = `ws://${window.location.host}`;
const socket = new WebSocket(serverUrl);
let localConnection, dataChannel;

// DOM elements
const lobby = document.getElementById('lobby');
const game = document.getElementById('game');
const roomIdInput = document.getElementById('roomId');
const createBtn = document.getElementById('createRoom');
const joinBtn = document.getElementById('joinRoom');
const moveButtons = document.querySelectorAll('.move');
const status = document.getElementById('status');
const score = document.getElementById('score');

let localScore = 0;
let remoteScore = 0;

// Event listeners
createBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value;
    socket.send(JSON.stringify({ type: 'create_room', roomId }));
});

joinBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value;
    socket.send(JSON.stringify({ type: 'join_room', roomId }));
});

moveButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        const move = btn.dataset.move;
        sendMove(move);
    });
});

// Socket message handler
socket.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data); // Parse the incoming message as JSON
        switch (data.type) {
            case 'room_created':
                status.textContent = `Room ${data.roomId} created. Waiting for a player to join...`;
                break;
            case 'room_joined':
                status.textContent = `Joined room ${data.roomId}. Starting game...`;
                startGame();
                break;
            case 'player_joined':
                status.textContent = `A player has joined your room. Starting game...`;
                startGame();
                break;
            case 'error':
                status.textContent = `Error: ${data.message}`;
                break;
            default:
                handleSignalingData(data);
                break;
        }
    } catch (err) {
        console.error('Invalid message received:', event.data, err);
    }
};

// WebRTC setup
function startGame() {
    lobby.style.display = 'none';
    game.style.display = 'block';

    localConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    });

    dataChannel = localConnection.createDataChannel('game');
    setupDataChannel();

    localConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
    };

    localConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel();
    };

    localConnection.createOffer()
        .then((offer) => {
            localConnection.setLocalDescription(offer);
            socket.send(JSON.stringify({ type: 'offer', offer }));
        });
}

function handleSignalingData(data) {
    if (data.offer) {
        localConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        localConnection.createAnswer()
            .then((answer) => {
                localConnection.setLocalDescription(answer);
                socket.send(JSON.stringify({ type: 'answer', answer }));
            });
    } else if (data.answer) {
        localConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.candidate) {
        localConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
}

function setupDataChannel() {
    dataChannel.onmessage = (event) => {
        const move = event.data;
        processRemoteMove(move);
    };
}

function sendMove(move) {
    dataChannel.send(move);
    processLocalMove(move);
}

function processLocalMove(move) {
    status.textContent = `You played: ${move}`;
    checkGameEnd();
}

function processRemoteMove(move) {
    status.textContent += ` | Opponent played: ${move}`;
    checkGameEnd();
}

function checkGameEnd() {
    if (localScore >= 10 || remoteScore >= 10) {
        status.textContent = localScore >= 10 ? 'You win!' : 'You lose!';
        dataChannel.close();
        localConnection.close();
    }
}
