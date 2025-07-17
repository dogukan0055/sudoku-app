// utils/socket.js

import { io } from 'socket.io-client';

const SOCKET_SERVER = 'https://sudoku-app-production.up.railway.app'; // your deployed backend

export const createSocketConnection = ({
    onRoomCreated,
    onPlayerJoined,
    onPlayerLeft,
    onPlayerUpdate,
    onChatMessage,
    onSectionCompleted,
    onGameCompleted,
    onError,
}) => {
    const socket = io(SOCKET_SERVER, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
        console.log('✅ Connected to server');
    });

    socket.on('disconnect', () => {
        console.log('❌ Disconnected from server');
    });

    if (onRoomCreated) socket.on('room_created', onRoomCreated);
    if (onPlayerJoined) socket.on('player_joined', onPlayerJoined);
    if (onPlayerLeft) socket.on('player_left', onPlayerLeft);
    if (onPlayerUpdate) socket.on('player_update', onPlayerUpdate);
    if (onChatMessage) socket.on('chat_message', onChatMessage);
    if (onSectionCompleted) socket.on('section_completed', onSectionCompleted);
    if (onGameCompleted) socket.on('game_completed', onGameCompleted);
    if (onError) socket.on('error', onError);

    return socket;
};
