import React, { useState, useEffect, useCallback } from 'react';
import { Users, MessageCircle, Send, Home, Play, UserPlus, Trophy, Clock, User } from 'lucide-react';
import io from 'socket.io-client';
import { formatTime, calculateProgress } from './utils/helpers'; // Import helper functions
import { generateSudoku, createEmptyGrid } from './utils/sudoku'; // Import Sudoku generation logic
import { createSocketConnection } from './utils/socket';

// Socket.IO connection
const SOCKET_SERVER = 'sudoku-app-production.up.railway.app'; // Change this to your server URL

const SudokuGame = () => {
  const [gameMode, setGameMode] = useState('menu'); // menu, offline, online, host, join
  const [currentLevel, setCurrentLevel] = useState(1);
  const [difficulty, setDifficulty] = useState('easy');
  const [grid, setGrid] = useState(createEmptyGrid());
  // eslint-disable-next-line
  const [solution, setSolution] = useState(createEmptyGrid());
  const [initialGrid, setInitialGrid] = useState(createEmptyGrid());
  const [selectedCell, setSelectedCell] = useState({ row: -1, col: -1 });
  const [errors, setErrors] = useState(createEmptyGrid());
  const [gameTime, setGameTime] = useState(0);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [isGameActive, setIsGameActive] = useState(false);

  // Online multiplayer states
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [socket, setSocket] = useState(null);
  // eslint-disable-next-line
  const [isConnected, setIsConnected] = useState(false);
  const [showChat, setShowChat] = useState(false);
  // eslint-disable-next-line
  const [playerProgress, setPlayerProgress] = useState({});

  // Timer effect
  useEffect(() => {
    let interval;
    if (isGameActive && !isGameComplete) {
      interval = setInterval(() => {
        setGameTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGameActive, isGameComplete]);

  // Socket.IO connection for online play
  const connectSocket = useCallback(() => {
    const newSocket = createSocketConnection({
      onRoomCreated: ({ roomCode, players }) => {
        setRoomCode(roomCode);
        setPlayers(players);
        addMessage(`Room ${roomCode} created! Share this code with friends.`, 'system');
      },
      onPlayerJoined: ({ player, players, puzzle }) => {
        setPlayers(players);
        if (puzzle) {
          setGrid(puzzle);
          setInitialGrid(puzzle.map(row => [...row]));
        }
        addMessage(`${player} joined the game`, 'system');
      },
      onPlayerLeft: ({ player, players }) => {
        setPlayers(players);
        addMessage(`${player} left the game`, 'system');
      },
      onPlayerUpdate: ({ playerName, progress, players }) => {
        setPlayers(players);
        setPlayerProgress(prev => ({
          ...prev,
          [playerName]: progress
        }));
      },
      onChatMessage: ({ player, message, timestamp }) => {
        addMessage(`${player}: ${message}`, 'chat');
      },
      onSectionCompleted: ({ player, sectionType }) => {
        addMessage(`${player} completed a ${sectionType}!`, 'achievement');
      },
      onGameCompleted: ({ player, time }) => {
        addMessage(`${player} completed the puzzle in ${formatTime(time)}!`, 'achievement');
      },
      onError: ({ message }) => {
        addMessage(`Error: ${message}`, 'error');
      },
    });

    setSocket(newSocket);
    return newSocket;
  }, []);


  // Clean up socket on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  const addMessage = (text, type = 'chat') => {
    const message = {
      id: Date.now(),
      text,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, message]);
  };

  const sendMessage = () => {
    if (currentMessage.trim() && socket) {
      socket.emit('chat_message', { message: currentMessage });
      setCurrentMessage('');
    }
  };

  const sendEmoji = (emoji) => {
    if (socket) {
      socket.emit('chat_message', { message: emoji });
    }
  };

  const generateNewGame = (diff = difficulty) => {
    const { puzzle, solution: sol } = generateSudoku(diff);
    setGrid(puzzle);
    setSolution(sol);
    setInitialGrid(puzzle.map(row => [...row]));
    setErrors(Array(9).fill().map(() => Array(9).fill(false)));
    setGameTime(0);
    setIsGameComplete(false);
    setIsGameActive(true);
    setSelectedCell({ row: -1, col: -1 });
  };

  const isValidMove = (row, col, num) => {
    // Check row
    for (let i = 0; i < 9; i++) {
      if (i !== col && grid[row][i] === num) return false;
    }

    // Check column
    for (let i = 0; i < 9; i++) {
      if (i !== row && grid[i][col] === num) return false;
    }

    // Check 3x3 box
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let i = startRow; i < startRow + 3; i++) {
      for (let j = startCol; j < startCol + 3; j++) {
        if (i !== row && j !== col && grid[i][j] === num) return false;
      }
    }

    return true;
  };

  const handleCellClick = (row, col) => {
    if (initialGrid[row][col] === 0) {
      setSelectedCell({ row, col });
    }
  };

  const handleNumberInput = (num) => {
    if (selectedCell.row !== -1 && selectedCell.col !== -1) {
      const newGrid = [...grid];
      const newErrors = [...errors];

      if (num === 0) {
        newGrid[selectedCell.row][selectedCell.col] = 0;
        newErrors[selectedCell.row][selectedCell.col] = false;
      } else if (isValidMove(selectedCell.row, selectedCell.col, num)) {
        newGrid[selectedCell.row][selectedCell.col] = num;
        newErrors[selectedCell.row][selectedCell.col] = false;

        // Check if game is complete
        const isComplete = newGrid.every(row => row.every(cell => cell !== 0));
        if (isComplete) {
          setIsGameComplete(true);
          setIsGameActive(false);
          if (socket) {
            socket.emit('game_completed', { time: gameTime });
          }
        }
      } else {
        newErrors[selectedCell.row][selectedCell.col] = true;
      }

      setGrid(newGrid);
      setErrors(newErrors);

      // Send update to other players if online
      if (socket) {
        socket.emit('game_update', {
          grid: newGrid,
          progress: calculateProgress(newGrid)
        });
      }
    }
  };

  // eslint-disable-next-line
  const generateRoomCode = () => {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  };

  const hostGame = () => {
    if (playerName.trim()) {
      const newSocket = connectSocket();
      const { puzzle, solution: sol } = generateSudoku();

      setGrid(puzzle);
      setSolution(sol);
      setInitialGrid(puzzle.map(row => [...row]));
      setErrors(Array(9).fill().map(() => Array(9).fill(false)));
      setGameTime(0);
      setIsGameComplete(false);
      setIsGameActive(true);
      setSelectedCell({ row: -1, col: -1 });
      setGameMode('online');

      // Wait for socket to connect before creating room
      newSocket.on('connect', () => {
        newSocket.emit('create_room', {
          playerName: playerName,
          puzzle: puzzle,
          solution: sol
        });
      });
    }
  };

  const joinGame = () => {
    if (playerName.trim() && roomCode.trim()) {
      const newSocket = connectSocket();
      setGameMode('online');

      // Wait for socket to connect before joining room
      newSocket.on('connect', () => {
        newSocket.emit('join_room', {
          roomCode: roomCode,
          playerName: playerName
        });
      });
    }
  };

  const nextLevel = () => {
    setCurrentLevel(prev => prev + 1);
    const newDiff = currentLevel >= 5 ? 'hard' : currentLevel >= 3 ? 'medium' : 'easy';
    setDifficulty(newDiff);
    generateNewGame(newDiff);
  };

  const getCellClassName = (row, col) => {
    let className = 'w-8 h-8 border border-gray-400 flex items-center justify-center text-sm font-medium cursor-pointer select-none ';

    // Initial numbers (uneditable)
    if (initialGrid[row][col] !== 0) {
      className += 'bg-gray-100 text-gray-800 font-bold ';
    } else {
      className += 'bg-white hover:bg-blue-50 ';
    }

    // Selected cell
    if (selectedCell.row === row && selectedCell.col === col) {
      className += 'bg-blue-600 ';
    }

    // Error highlighting
    if (errors[row][col]) {
      className += 'bg-red-200 ';
    }

    // Grid borders
    if (row % 3 === 0 && row !== 0) className += 'border-t-2 border-t-black ';
    if (col % 3 === 0 && col !== 0) className += 'border-l-2 border-l-black ';
    if (row === 8) className += 'border-b-2 border-b-black ';
    if (col === 8) className += 'border-r-2 border-r-black ';

    return className;
  };

  // Menu Screen
  if (gameMode === 'menu') {
    return (
      <div className={`
        min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 
        flex items-center justify-center`}>
        <div className={`
          max-w-xl w-full mx-auto bg-white/90 backdrop-blur-sm 
          rounded-xl shadow-2xl p-8`}>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Sudoku</h1>
            <p className="text-gray-600">Challenge your mind!</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => {
                setGameMode('offline');
                setCurrentLevel(1);
                setDifficulty('easy');
                generateNewGame('easy');
              }}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2"
            >
              <Play size={20} />
              Play Offline
            </button>

            <button
              onClick={() => setGameMode('host')}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2"
            >
              <Users size={20} />
              Host Game
            </button>

            <button
              onClick={() => setGameMode('join')}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2"
            >
              <UserPlus size={20} />
              Join Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Host Game Screen
  if (gameMode === 'host') {
    return (
      <div className={`
        min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4
        flex items-center justify-center`}>
        <div className={`
          max-w-xl w-full mx-auto bg-white/90 backdrop-blur-sm 
          rounded-xl shadow-2xl p-8`}>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">Host Game</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your name"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={hostGame}
                disabled={!playerName.trim()}
                className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-2 px-4 rounded-lg"
              >
                Create Room
              </button>
              <button
                onClick={() => setGameMode('menu')}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
              >
                <Home size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Join Game Screen
  if (gameMode === 'join') {
    return (
      <div className={`
        min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4
        flex items-center justify-center`}>
        <div className={`
          max-w-xl w-full mx-auto bg-white/90 backdrop-blur-sm 
          rounded-xl shadow-2xl p-8`}>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">Join Game</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter room code"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={joinGame}
                disabled={!playerName.trim() || !roomCode.trim()}
                className="flex-1 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white font-semibold py-2 px-4 rounded-lg"
              >
                Join Room
              </button>
              <button
                onClick={() => setGameMode('menu')}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
              >
                <Home size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Game Screen (both offline and online)
  return (
    <div className={`
      min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4
      container mx-auto max-w-7xl flex flex-col lg:flex-row gap-6`}>
      <div className={`
        flex-1 lg:max-w-2xl mx-auto w-full`}>
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGameMode('menu')}
                className="p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
              >
                <Home size={16} />
              </button>
              <div>
                <h1 className="text-lg font-bold">Sudoku</h1>
                <p className="text-sm text-gray-600">
                  {gameMode === 'offline' ? `Level ${currentLevel} - ${difficulty}` : `Room: ${roomCode}`}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Clock size={16} />
                {formatTime(gameTime)}
              </div>
              {gameMode === 'online' && (
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <User size={16} />
                  {players.length}
                </div>
              )}
            </div>
          </div>

          {gameMode === 'online' && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setShowChat(!showChat)}
                className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded-lg text-sm"
              >
                <MessageCircle size={16} />
                Chat
              </button>
              <div className="text-sm text-gray-600">
                Progress: {calculateProgress(grid)}%
              </div>
            </div>
          )}
        </div>

        {/* Sudoku Grid */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-9 gap-0 border-2 border-black w-fit mx-auto">
            {grid.map((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={getCellClassName(rowIndex, colIndex)}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                >
                  {cell !== 0 ? cell : ''}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Number Input */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="grid grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                onClick={() => handleNumberInput(num)}
                className="h-12 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg"
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => handleNumberInput(0)}
              className="h-12 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Side panel for online mode */}
      {gameMode === 'online' && (
        <div className={`
          lg:w-80 space-y-4`}>
          {/* Game completion message */}
          {isGameComplete && (
            <div className="bg-green-100 border border-green-400 rounded-xl p-6">
              <div className="flex items-center gap-2 text-green-700">
                <Trophy size={20} />
                <span className="font-semibold">Congratulations!</span>
              </div>
              <p className="text-green-600 text-sm">
                Completed in {formatTime(gameTime)}
              </p>
              {gameMode === 'offline' && (
                <button
                  onClick={nextLevel}
                  className="mt-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg"
                >
                  Next Level
                </button>
              )}
            </div>
          )}

          {/* Chat panel */}
          {showChat && (
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-4">
              <div className="h-[400px] overflow-y-auto mb-4 border rounded-lg p-4">
                {messages.map(msg => (
                  <div key={msg.id} className={`text-sm mb-1 ${msg.type === 'system' ? 'text-gray-600 italic' :
                    msg.type === 'achievement' ? 'text-green-600 font-semibold' :
                      'text-gray-800'
                    }`}>
                    <span className="text-xs text-gray-500">{msg.timestamp}</span> {msg.text}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Type a message..."
                  />
                  <button
                    onClick={sendMessage}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                  >
                    <Send size={20} />
                  </button>
                </div>

                <div className="flex gap-2 text-xl justify-center">
                  {['🎉', '👍', '😊', '🔥', '💪', '🧠'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => sendEmoji(emoji)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SudokuGame;