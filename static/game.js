// ===============================
// SINGLE STARFIELD INIT (no duplicates)
// ===============================
(function createStarfield() {
    const starsContainer = document.querySelector('.stars');
    if (!starsContainer) return;
    const numStars = 200;
    for (let i = 0; i < numStars; i++) {
        const star = document.createElement('div');
        star.classList.add('stationary-star');
        star.style.top = `${Math.random() * 100}vh`;
        star.style.left = `${Math.random() * 100}vw`;
        const size = (Math.random() * 2 + 0.6).toFixed(2);
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.animationDelay = `${Math.random() * 5}s`;
        starsContainer.appendChild(star);
    }
})();


// ===============================
// GAME CONSTANTS + STATE
// ===============================
const gridContainer = document.querySelector('.grid-container');
const turnIndicator = document.getElementById('turn-indicator');
const winnerMessage = document.getElementById('winner-message');
const player1Score = document.getElementById('player1-score');
const player2Score = document.getElementById('player2-score');
const resetBtn = document.getElementById('reset-btn');

const rows = 8;
const cols = 8;

const players = [
    { id: 1, color: 'red', isAI: false },
    { id: 2, color: 'blue', isAI: true }
];

let currentPlayerIndex = 0;
let grid = [];
let gameStarted = false;
let inputLocked = false;


// ===============================
// UTILITIES
// ===============================
function getCriticalMass(r, c) {
    const isCorner = (r === 0 || r === rows - 1) && (c === 0 || c === cols - 1);
    const isEdge = !isCorner && (r === 0 || r === rows - 1 || c === 0 || c === cols - 1);
    if (isCorner) return 2;
    if (isEdge) return 3;
    return 4;
}

function updateTurnIndicator() {
    const current = players[currentPlayerIndex];
    const type = current.isAI ? "AI" : "Player";
    turnIndicator.textContent = `${type}'s Turn (${current.color})`;
    turnIndicator.style.color = current.color;
}

// ===============================
// INITIALIZE / RESET
// ===============================
function initializeGrid() {
    if (!gridContainer) return;
    gridContainer.innerHTML = '';
    winnerMessage.style.display = 'none';
    turnIndicator.style.display = 'block';
    gameStarted = false;
    inputLocked = false;
    currentPlayerIndex = 0;

    grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({ orbs: 0, player: null }))
    );

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', () => handleCellClick(r, c));
            gridContainer.appendChild(cell);
        }
    }

    updateTurnIndicator();
    updateScores();
}

resetBtn?.addEventListener('click', initializeGrid);

initializeGrid();


// ===============================
// CLICK HANDLING
// ===============================
function handleCellClick(r, c) {
    if (inputLocked) return;
    const current = players[currentPlayerIndex];
    if (current.isAI) return;

    const cellState = grid[r][c];
    if (cellState.player !== null && cellState.player.id !== current.id) return;

    if (!gameStarted) gameStarted = true;

    cellState.player = current;
    cellState.orbs++;
    updateCell(r, c);

    if (cellState.orbs >= getCriticalMass(r, c)) {
        explodeAndResolve([[r, c]]).catch(console.error);
    } else {
        switchTurn();
    }
}


// ===============================
// EXPLOSION QUEUE (robust)
// ===============================
async function explodeAndResolve(initialQueue) {
    inputLocked = true;
    const queue = initialQueue.slice();

    while (queue.length > 0) {
        const [row, col] = queue.shift();
        const cell = grid[row][col];

        if (cell.orbs < getCriticalMass(row, col)) continue;

        const distribute = getCriticalMass(row, col);
        const explodingPlayer = cell.player;

        const sourceEl = gridContainer.querySelector(`[data-row='${row}'][data-col='${col}']`);

        cell.orbs -= distribute;
        if (cell.orbs <= 0) {
            cell.orbs = 0;
            cell.player = null;
        }
        updateCell(row, col);

        const neighbors = [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1]
        ];
        const animationPromises = [];

        for (const [dr, dc] of neighbors) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

            const endEl = gridContainer.querySelector(`[data-row='${nr}'][data-col='${nc}']`);
            if (sourceEl && endEl) {
                animationPromises.push(animateOrbFromTo(sourceEl, endEl, explodingPlayer ? explodingPlayer.color : 'transparent'));
            }
        }

        await Promise.all(animationPromises);

        for (const [dr, dc] of neighbors) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

            const nCell = grid[nr][nc];
            nCell.player = explodingPlayer || null;
            nCell.orbs++;
            updateCell(nr, nc);

            if (nCell.orbs >= getCriticalMass(nr, nc)) {
                queue.push([nr, nc]);
            }
        }
    }

    updateScores();

    if (checkWinCondition()) {
        endGame();
        return;
    }

    inputLocked = false;
    switchTurn();
}

function animateOrbFromTo(startCellEl, endCellEl, color) {
    return new Promise(resolve => {
        
        const orb = document.createElement("div");
        orb.classList.add("moving-orb");
        orb.style.backgroundColor = color;

        // Append first so offsetLeft works
        gridContainer.appendChild(orb);

        // START POS (relative to gridContainer)
        const start = {
            x: startCellEl.offsetLeft + startCellEl.clientWidth / 2,
            y: startCellEl.offsetTop + startCellEl.clientHeight / 2
        };

        const end = {
            x: endCellEl.offsetLeft + endCellEl.clientWidth / 2,
            y: endCellEl.offsetTop + endCellEl.clientHeight / 2
        };

        // Place orb at start
        orb.style.transform = `translate3d(${start.x - 10}px, ${start.y - 10}px, 0)`;

        requestAnimationFrame(() => {
            orb.style.transform = `translate3d(${end.x - 10}px, ${end.y - 10}px, 0)`;
        });

        setTimeout(() => {
            orb.remove();
            resolve();
        }, 450);
    });
}



// ===============================
// RENDER CELL (visual orbs)
// ===============================
function updateCell(r, c) {
    const cellEl = gridContainer.querySelector(`[data-row='${r}'][data-col='${c}']`);
    const state = grid[r][c];
    if (!cellEl) return;

    cellEl.innerHTML = '';
    const container = document.createElement('div');
    container.classList.add('orb-container');

    if (state.player && state.orbs > 0) {
        const count = state.orbs;
        const radius = count === 1 ? 0 : Math.min(14, 8 + (count - 2) * 2);
        for (let i = 0; i < count; i++) {
            const orb = document.createElement('div');
            orb.classList.add('orb');
            orb.style.backgroundColor = state.player.color;

            const angle = (i / Math.max(count, 1)) * (2 * Math.PI);
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);

            orb.style.left = `calc(50% - 10px + ${x}px)`;
            orb.style.top = `calc(50% - 10px + ${y}px)`;
            container.appendChild(orb);
        }
    }

    cellEl.appendChild(container);
}


// ===============================
// SCORE & WIN LOGIC
// ===============================
function updateScores() {
    let p1 = 0, p2 = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c].player) {
                if (grid[r][c].player.id === 1) p1 += grid[r][c].orbs;
                else p2 += grid[r][c].orbs;
            }
        }
    }
    player1Score.textContent = `Player 1: ${p1}`;
    player2Score.textContent = `AI: ${p2}`;
}

function checkWinCondition() {
    if (!gameStarted) return false;
    const active = new Set();
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c].player) active.add(grid[r][c].player.id);
        }
    }
    return active.size === 1;
}

function endGame() {
    updateScores();
    const activePlayers = new Set();
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c].player) activePlayers.add(grid[r][c].player.id);
        }
    }

    let winnerId = null;
    if (activePlayers.size === 1) {
        winnerId = [...activePlayers][0];
    } else {
        winnerId = players[(currentPlayerIndex + players.length - 1) % players.length].id;
    }

    const winner = players.find(p => p.id === winnerId) || players[0];
    const type = winner.isAI ? "AI" : "Player";

    winnerMessage.textContent = `${type} (${winner.color}) Wins!`;
    winnerMessage.style.color = winner.color;
    winnerMessage.style.display = 'block';

    turnIndicator.style.display = 'none';
    inputLocked = true;
}


// ===============================
// TURN SWITCH & AI
// ===============================
function switchTurn() {
    updateScores();

    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    updateTurnIndicator();

    const current = players[currentPlayerIndex];
    if (current.isAI) {
        inputLocked = true;
        setTimeout(() => {
            makeAIMove().catch(console.error);
        }, 650);
    }
}

async function makeAIMove() {
    const ai = players[currentPlayerIndex];
    const moves = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const s = grid[r][c];
            if (s.player === null || s.player.id === ai.id) moves.push([r, c]);
        }
    }

    if (moves.length === 0) {
        inputLocked = false;
        switchTurn();
        return;
    }

    let bestMoves = [];
    let bestScore = -Infinity;
    for (const [r, c] of moves) {
        const s = grid[r][c];
        const distToCrit = getCriticalMass(r, c) - (s.orbs + 1);
        const score = -distToCrit;
        if (score > bestScore) {
            bestScore = score;
            bestMoves = [[r, c]];
        } else if (score === bestScore) {
            bestMoves.push([r, c]);
        }
    }

    const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    const [mr, mc] = chosen;

    if (!gameStarted) gameStarted = true;
    const cell = grid[mr][mc];
    cell.player = ai;
    cell.orbs++;
    updateCell(mr, mc);

    if (cell.orbs >= getCriticalMass(mr, mc)) {
        await explodeAndResolve([[mr, mc]]);
    } else {
        inputLocked = false;
        switchTurn();
    }
}
