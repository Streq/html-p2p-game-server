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
    

    localConnection.onconnectionstatechange = () => {
        console.log('Connection state:', localConnection.connectionState);
    };
    localConnection.onsignalingstatechange = () => {
        console.log('Signaling state:', localConnection.signalingState);
    };
}

function handleSignalingData(data) {
    if (data.offer) {
        // Only the guest sets the remote offer and creates an answer
        if (!localConnection.localDescription) {
            localConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
                .then(() => localConnection.createAnswer())
                .then((answer) => localConnection.setLocalDescription(answer))
                .then(() => {
                    socket.send(JSON.stringify({ type: 'answer', answer: localConnection.localDescription }));
                })
                .catch((err) => console.error('Error handling offer:', err));
        }
    } else if (data.answer) {
        // Only the host sets the remote answer
        if (localConnection.localDescription && localConnection.signalingState === 'have-local-offer') {
            localConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
                .catch((err) => console.error('Error setting remote answer:', err));
        }
    } else if (data.candidate) {
        localConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
            .catch((err) => console.error('Error adding ICE candidate:', err));
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
