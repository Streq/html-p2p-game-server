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

// game logic
let localScore = 0;
let remoteScore = 0;
let localMove = null;
let remoteMove = null;

// Event listeners
createBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value;
    socket.send(JSON.stringify({ type: 'create_room', roomId }));
});

joinBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value;
    socket.send(JSON.stringify({ type: 'join_room', roomId }));
});

function enableGameButtons(enabled) {
    moveButtons.forEach((btn) => {
        btn.disabled = !enabled; // Disable buttons if 'enabled' is false
    });
}

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
            socket.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
            console.log("Sent ICE candidate:", event.candidate);
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
    

    localConnection.onsignalingstatechange = () => {
        console.log("Signaling state:", localConnection.signalingState);
    };
    
    localConnection.onconnectionstatechange = () => {
        console.log("Connection state:", localConnection.connectionState);
    };
    
    localConnection.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", localConnection.iceConnectionState);
    };
}

function handleSignalingData(data) {
    if (data.offer) {
        if (localConnection.signalingState === "stable") {
            localConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
                .then(() => localConnection.createAnswer())
                .then((answer) => localConnection.setLocalDescription(answer))
                .then(() => {
                    socket.send(JSON.stringify({ type: "answer", answer: localConnection.localDescription }));
                })
                .catch((err) => console.error("Error handling offer:", err));
        } else {
            console.warn("Received offer in invalid state:", localConnection.signalingState);
        }
    } else if (data.answer) {
        if (localConnection.signalingState === "have-local-offer") {
            localConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
                .catch((err) => console.error("Error setting remote answer:", err));
        } else {
            console.warn("Received answer in invalid state:", localConnection.signalingState);
        }
    } else if (data.candidate) {
        localConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
            .then(() => console.log("Added ICE candidate:", data.candidate))
            .catch((err) => console.error("Error adding ICE candidate:", err));
    }
}


function setupDataChannel() {
    dataChannel.onopen = () => {
        console.log('Data channel is open');
        enableGameButtons(true);
    };
    
    dataChannel.onclose = () => {
        console.log('Data channel is closed');
        enableGameButtons(false);
    };
    
    dataChannel.onerror = (err) => {
        console.error('Data channel error:', err);
    };
    
    dataChannel.onmessage = (event) => {
        console.log('Received message:', event.data);
        processRemoteMove(event.data);
    };
}


function sendMove(move) {
    if (dataChannel.readyState === 'open') {
        dataChannel.send(move);
        processLocalMove(move);
    } else {
        console.error('Data channel is not open. Current state:', dataChannel.readyState);
    }
}


function processLocalMove(move) {
    localMove = move;
    status.textContent = `You played: ${move}`;
    if (remoteMove) {
        determineResult();
    }
}

function processRemoteMove(move) {
    remoteMove = move;
    status.textContent += ` | Opponent played: ${move}`;
    if (localMove) {
        determineResult();
    }
}

function determineResult() {
    // Determine the outcome
    const outcome = getResult(localMove, remoteMove);

    if (outcome === "win") {
        localScore += 2;
        status.textContent = `You win this round!`;
    } else if (outcome === "lose") {
        remoteScore += 2;
        status.textContent = `You lose this round!`;
    } else {
        localScore += 1;
        remoteScore += 1;
        status.textContent = `It's a draw!`;
    }

    // Update the score display
    score.textContent = `Your Score: ${localScore} | Opponent Score: ${remoteScore}`;

    // Reset moves
    localMove = null;
    remoteMove = null;

    enableGameButtons(true);

    // Check for a winner
    checkGameEnd();
}

function getResult(local, remote) {
    if (local === remote) return "draw";

    if (
        (local === "rock" && remote === "scissors") ||
        (local === "scissors" && remote === "paper") ||
        (local === "paper" && remote === "rock")
    ) {
        return "win";
    }

    return "lose";
}

function checkGameEnd() {
    if (localScore >= 10 || remoteScore >= 10) {
        const winner = localScore >= 10 ? "You win!" : "You lose!";
        status.textContent = winner;

        // Disable game buttons and close the data channel
        enableGameButtons(false);
        if (dataChannel) dataChannel.close();
        if (localConnection) localConnection.close();
    }
}

