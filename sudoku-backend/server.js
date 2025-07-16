const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000", // Your React app URL
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Store room data
const rooms = new Map();
const playerSockets = new Map(); // socket.id -> player info

// Generate random room code
function generateRoomCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Calculate progress for a player
function calculateProgress(grid) {
    const filled = grid.flat().filter(cell => cell !== 0).length;
    const total = 81;
    return Math.round((filled / total) * 100);
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Create a new room
    socket.on('create_room', ({ playerName, puzzle, solution }) => {
        const roomCode = generateRoomCode();
        const roomData = {
            code: roomCode,
            host: socket.id,
            players: [{
                id: socket.id,
                name: playerName,
                progress: 0,
                grid: puzzle,
                isHost: true
            }],
            puzzle: puzzle,
            solution: solution,
            gameStarted: false,
            messages: []
        };

        rooms.set(roomCode, roomData);
        playerSockets.set(socket.id, { playerName, roomCode });

        socket.join(roomCode);
        socket.emit('room_created', { roomCode, players: roomData.players });

        console.log(`Room ${roomCode} created by ${playerName}`);
    });

    // Join an existing room
    socket.on('join_room', ({ roomCode, playerName }) => {
        const room = rooms.get(roomCode);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        if (room.players.length >= 4) { // Limit to 4 players
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        // Add player to room
        const newPlayer = {
            id: socket.id,
            name: playerName,
            progress: 0,
            grid: room.puzzle, // Start with the same puzzle
            isHost: false
        };

        room.players.push(newPlayer);
        playerSockets.set(socket.id, { playerName, roomCode });

        socket.join(roomCode);

        // Notify all players in room
        io.to(roomCode).emit('player_joined', {
            player: playerName,
            players: room.players,
            puzzle: room.puzzle
        });

        console.log(`${playerName} joined room ${roomCode}`);
    });

    // Handle game updates (cell changes)
    socket.on('game_update', ({ grid, progress }) => {
        const playerInfo = playerSockets.get(socket.id);
        if (!playerInfo) return;

        const room = rooms.get(playerInfo.roomCode);
        if (!room) return;

        // Update player's grid and progress
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            room.players[playerIndex].grid = grid;
            room.players[playerIndex].progress = progress;

            // Broadcast to all other players in the room
            socket.to(playerInfo.roomCode).emit('player_update', {
                playerId: socket.id,
                playerName: playerInfo.playerName,
                progress: progress,
                players: room.players
            });
        }
    });

    // Handle chat messages
    socket.on('chat_message', ({ message }) => {
        const playerInfo = playerSockets.get(socket.id);
        if (!playerInfo) return;

        const room = rooms.get(playerInfo.roomCode);
        if (!room) return;

        const chatMessage = {
            id: Date.now(),
            player: playerInfo.playerName,
            message: message,
            timestamp: new Date().toISOString()
        };

        room.messages.push(chatMessage);

        // Broadcast to all players in room
        io.to(playerInfo.roomCode).emit('chat_message', chatMessage);
    });

    // Handle section completion announcement
    socket.on('section_completed', ({ sectionType }) => {
        const playerInfo = playerSockets.get(socket.id);
        if (!playerInfo) return;

        socket.to(playerInfo.roomCode).emit('section_completed', {
            player: playerInfo.playerName,
            sectionType: sectionType
        });
    });

    // Handle game completion
    socket.on('game_completed', ({ time }) => {
        const playerInfo = playerSockets.get(socket.id);
        if (!playerInfo) return;

        const room = rooms.get(playerInfo.roomCode);
        if (!room) return;

        // Mark player as completed
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            room.players[playerIndex].completed = true;
            room.players[playerIndex].completionTime = time;
        }

        // Broadcast to all players in room
        io.to(playerInfo.roomCode).emit('game_completed', {
            player: playerInfo.playerName,
            time: time,
            players: room.players
        });
    });

    // Handle player disconnect
    socket.on('disconnect', () => {
        const playerInfo = playerSockets.get(socket.id);
        if (playerInfo) {
            const room = rooms.get(playerInfo.roomCode);
            if (room) {
                // Remove player from room
                room.players = room.players.filter(p => p.id !== socket.id);

                // If room is empty, delete it
                if (room.players.length === 0) {
                    rooms.delete(playerInfo.roomCode);
                    console.log(`Room ${playerInfo.roomCode} deleted`);
                } else {
                    // If host left, assign new host
                    if (room.host === socket.id && room.players.length > 0) {
                        room.host = room.players[0].id;
                        room.players[0].isHost = true;
                    }

                    // Notify remaining players
                    socket.to(playerInfo.roomCode).emit('player_left', {
                        player: playerInfo.playerName,
                        players: room.players
                    });
                }
            }

            playerSockets.delete(socket.id);
        }

        console.log('User disconnected:', socket.id);
    });

    // Get room info
    socket.on('get_room_info', ({ roomCode }) => {
        const room = rooms.get(roomCode);
        if (room) {
            socket.emit('room_info', {
                players: room.players,
                messages: room.messages,
                puzzle: room.puzzle
            });
        } else {
            socket.emit('error', { message: 'Room not found' });
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Basic health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        rooms: rooms.size,
        players: playerSockets.size
    });
});