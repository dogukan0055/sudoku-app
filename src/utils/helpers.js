// src/utils/helpers.js

export const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const calculateProgress = (grid) => {
    const filled = grid.flat().filter(cell => cell !== 0).length;
    return Math.round((filled / 81) * 100);
};
