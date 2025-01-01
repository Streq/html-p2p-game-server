// server.js
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

// Serve the client files
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url.startsWith("/game/")) {
        fs.readFile('index.html', (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading index.html');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
    } else if (req.url === '/client.js') {
        fs.readFile('client.js', (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading client.js');
            } else {
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.end(data);
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

const wss = new WebSocket.Server({ server });

let rooms = {}; // Stores active rooms and players

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'create_room': {
                const roomId = data.roomId;
                if (!rooms[roomId]) {
                    createRoom(roomId, ws);

                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Room already exists' }));
                }
                break;
            }
            case 'join_room': {
                const roomId = data.roomId;
                if (rooms[roomId] && !rooms[roomId].guest) {
                    joinRoom(roomId, ws);
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: `Room ${roomId} is full or does not exist` }));
                }
                break;
            }
            case 'join_or_create_room': {
                const roomId = data.roomId;
                joinOrCreateRoom(roomId, ws);
                break;
            }
        }
    });

    ws.on('close', () => {
        // Clean up rooms when players disconnect
        for (const [roomId, room] of Object.entries(rooms)) {
            if (room.host === ws || room.guest === ws) {
                delete rooms[roomId];
                break;
            }
        }
    });
});

server.listen(8080, () => {
    console.log('Server is running on http://localhost:8080');
});

function joinOrCreateRoom(roomId, ws){
    if (rooms[roomId]){
        joinRoom(roomId, ws);
    } else {
        createRoom(roomId, ws);
    }
}

function joinRoom(roomId, ws) {
    rooms[roomId].guest = ws;

    console.log(`room ${roomId} joined`);
    // Notify both players
    rooms[roomId].host.send(JSON.stringify({ type: 'player_joined' }));
    ws.send(JSON.stringify({ type: 'room_joined', roomId }));
    // Relay messages for signaling
    rooms[roomId].host.on('message', (msg) => {
        rooms[roomId].guest.send(msg.toString());
    });
    ws.on('message', (msg) => {
        rooms[roomId].host.send(msg.toString());
    });
}

function createRoom(roomId, ws) {
    if(Object.keys(rooms).length >= 50){
        ws.send(JSON.stringify({ type: 'error', message: 'Too many ongoing rooms, please try again.'}));
        return;
    }
    rooms[roomId] = { host: ws, guest: null };
    console.log(`room ${roomId} created`);
    ws.send(JSON.stringify({ type: 'room_created', roomId }));
}

