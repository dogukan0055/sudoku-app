// src/utils/sudoku.js

export const createEmptyGrid = () => Array(9).fill().map(() => Array(9).fill(0));

export const isValid = (grid, row, col, num) => {
    for (let x = 0; x < 9; x++) {
        if (grid[row][x] === num || grid[x][col] === num) return false;
    }

    const startRow = row - row % 3;
    const startCol = col - col % 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (grid[startRow + i][startCol + j] === num) return false;
        }
    }
    return true;
};

export const solve = (grid) => {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (grid[row][col] === 0) {
                for (let num = 1; num <= 9; num++) {
                    if (isValid(grid, row, col, num)) {
                        grid[row][col] = num;
                        if (solve(grid)) return true;
                        grid[row][col] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
};

export const generateSudoku = (difficulty = 'easy') => {
    const grid = createEmptyGrid();

    const fillBox = (row, col) => {
        const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const idx = Math.floor(Math.random() * nums.length);
                grid[row + i][col + j] = nums[idx];
                nums.splice(idx, 1);
            }
        }
    };

    for (let box = 0; box < 9; box += 3) {
        fillBox(box, box);
    }

    solve(grid);

    const cellsToRemove = {
        easy: 35,
        medium: 45,
        hard: 55
    };

    const puzzle = grid.map(row => [...row]);
    const solution = grid.map(row => [...row]);
    let removed = 0;
    const target = cellsToRemove[difficulty] || 35;

    while (removed < target) {
        const row = Math.floor(Math.random() * 9);
        const col = Math.floor(Math.random() * 9);
        if (puzzle[row][col] !== 0) {
            puzzle[row][col] = 0;
            removed++;
        }
    }

    return { puzzle, solution };
};
