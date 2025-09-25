// --- DOM Elements ---
const gameStatusEl = document.getElementById('game-status');
const boneyardCountEl = document.getElementById('boneyard-count');
const scoreboardEl = document.getElementById('scoreboard');
const playerHandEl = document.getElementById('player-hand');
const playerDominoCountEl = document.getElementById('player-domino-count');
const newGameBtn = document.getElementById('new-game-btn');
const boneyardEl = document.getElementById('boneyard');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const gameSetupModal = document.getElementById('game-setup-modal');
const scoreboardHeader = document.getElementById('scoreboard-header');
const scoreboardArrow = document.getElementById('scoreboard-arrow');
const darkModeToggle = document.getElementById('dark-mode-toggle');

// --- Game State ---
let gameState = {};
let setupState = {};
let draggedState = {
    index: null,
    offsetX: 0,
    offsetY: 0
};
let touchState = {
    index: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    active: false,
    isDragging: false
};
let lastTap = { time: 0, index: null };
let animationFrameId = null;


// --- Game Logic ---
function createDomino(v1, v2) {
    return { v1, v2, isDouble: v1 === v2, x: 0, y: 0 };
}

function createDominoSet(max) {
    const dominoes = [];
    for (let i = 0; i <= max; i++) {
        for (let j = i; j <= max; j++) {
            dominoes.push(createDomino(i, j));
        }
    }
    return dominoes;
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function createDominoElement(domino, isHorizontal = false) {
    const el = document.createElement('div');
    el.className = `domino ${isHorizontal ? 'horizontal' : ''}`;
    el.dataset.v1 = domino.v1;
    el.dataset.v2 = domino.v2;

    const half1 = document.createElement('div');
    half1.className = 'domino-half pip-container';
    half1.dataset.value = domino.v1;
    for(let i=1; i<=domino.v1; i++) {
        const pip = document.createElement('div');
        pip.className = `pip pip-${i}`;
        half1.appendChild(pip);
    }
    
    const divider = document.createElement('div');
    divider.className = 'domino-divider';

    const half2 = document.createElement('div');
    half2.className = 'domino-half pip-container';
    half2.dataset.value = domino.v2;
    for(let i=1; i<=domino.v2; i++) {
        const pip = document.createElement('div');
        pip.className = `pip pip-${i}`;
        half2.appendChild(pip);
    }

    el.appendChild(half1);
    el.appendChild(divider);
    el.appendChild(half2);
    return el;
}

function calculateNewDominoPosition(hand) {
    const newIndex = hand.length - 1;
    const containerWidth = playerHandEl.clientWidth;
    const dominoWidth = window.innerWidth < 768 ? 70 : 80;
    const dominoHeight = window.innerWidth < 768 ? 35 : 40;
    const margin = 10;
    
    if (containerWidth === 0) return { x: 5, y: 5 };

    const numPerRow = Math.floor(containerWidth / (dominoWidth + margin));
    const x = (newIndex % numPerRow) * (dominoWidth + margin) + 5;
    const y = Math.floor(newIndex / numPerRow) * (dominoHeight + margin) + 5;
    return { x, y };
}

function findDominoInHand(playerIndex, domino) {
    const hand = gameState.players[playerIndex].hand;
    return hand.findIndex(d => (d.v1 === domino.v1 && d.v2 === domino.v2) || (d.v1 === domino.v2 && d.v2 === domino.v1));
}

function showModal(title, body, buttonText = 'OK', callback = null) {
    const modalButton = document.getElementById('modal-button');
    modalTitle.textContent = title;
    modalBody.innerHTML = body;
    
    const newButton = modalButton.cloneNode(true);
    newButton.textContent = buttonText;
    modalButton.parentNode.replaceChild(newButton, modalButton);
    
    newButton.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (callback) callback();
    }, { once: true });

    modal.classList.remove('hidden');
}

function initGame(isNewGame = true) {
    if (isNewGame) {
        gameState.players = [{ name: 'You', score: 0, isAI: false }];
        for (let i = 1; i <= setupState.players; i++) {
            gameState.players.push({ name: `AI Player ${i}`, score: 0, isAI: true });
        }
        gameState.gameMode = setupState.gameMode;
        gameState.totalRounds = setupState.rounds;

        if(gameState.gameMode === 'quick') {
            gameState.roundsPlayed = 1;
        } else {
            gameState.currentRound = 12;
        }
    } else {
         if(gameState.gameMode === 'quick') {
            gameState.roundsPlayed++;
        } else {
            gameState.currentRound--;
        }
    }

    if ((gameState.gameMode === 'traditional' && gameState.currentRound < 0) || (gameState.gameMode === 'quick' && gameState.roundsPlayed > gameState.totalRounds)) {
        endGame();
        return;
    }

    const totalPlayers = gameState.players.length;
    const dominoesToDraw = totalPlayers <= 4 ? 15 : (totalPlayers <= 6 ? 12 : 11);
    
    let dominoSet = createDominoSet(12);
    shuffle(dominoSet);
    
    let engineValue;
    if (gameState.gameMode === 'quick') {
        engineValue = Math.floor(Math.random() * 13);
    } else {
        engineValue = gameState.currentRound;
    }
    
    const engineIndex = dominoSet.findIndex(d => d.v1 === engineValue && d.v2 === engineValue);
    const engineDomino = dominoSet.splice(engineIndex, 1)[0];
    
    gameState.engine = engineDomino;
    gameState.boneyard = dominoSet;
    
    gameState.players.forEach((player) => {
        player.hand = gameState.boneyard.splice(0, dominoesToDraw);
    });
    
    const playerHand = gameState.players[0].hand;
    const containerWidth = playerHandEl.clientWidth;
    const dominoWidth = window.innerWidth < 768 ? 70 : 80;
    const dominoHeight = window.innerWidth < 768 ? 35 : 40;
    const margin = 10;
    const numPerRow = Math.floor(containerWidth / (dominoWidth + margin));

    playerHand.forEach((domino, index) => {
        domino.x = (index % numPerRow) * (dominoWidth + margin) + 5;
        domino.y = Math.floor(index / numPerRow) * (dominoHeight + margin) + 5;
    });

    gameState.trains = {};
    gameState.players.forEach((player, index) => {
        gameState.trains[`player${index}`] = { path: [], isOpen: false, owner: index };
    });
    gameState.trains.mexican = { path: [], isOpen: true, owner: null };
    
    gameState.isRoundOver = false;
    gameState.currentPlayer = 0;
    gameState.selectedDomino = null;
    gameState.mustSatisfyDouble = false;
    
    scoreboardEl.classList.add('hidden');
    scoreboardArrow.classList.remove('rotated');

    renderAll();
    const roundText = gameState.gameMode === 'quick' ? `Round ${gameState.roundsPlayed} of ${gameState.totalRounds}` : `Round ${13 - gameState.currentRound}`;
    gameStatusEl.textContent = `${roundText}: Engine is Double-${engineValue}. Your turn.`;
}

function renderAll() {
    renderTrains();
    renderPlayerHand();
    renderBoneyard();
    renderScoreboard();
}

function createTrainRow(key, labelText) {
    const train = gameState.trains[key];
    const trackRow = document.createElement('div');
    trackRow.className = 'flex flex-col md:flex-row md:items-center py-2';

    const label = document.createElement('div');
    label.className = 'w-full text-left text-sm md:text-base font-semibold text-gray-600 shrink-0 flex items-center justify-start md:w-48 md:justify-end md:text-right md:pr-4';
    label.textContent = labelText;

    const trainTrack = document.createElement('div');
    trainTrack.className = 'train-track';
    trainTrack.dataset.trainKey = key;

    const engineEl = createDominoElement(gameState.engine, true);
    engineEl.style.cursor = 'default';
    engineEl.style.opacity = '0.7';

    const pathContainer = document.createElement('div');
    pathContainer.className = 'train-path';

    train.path.forEach(domino => {
        pathContainer.appendChild(createDominoElement(domino, true));
    });

    const dominoWidth = window.innerWidth < 768 ? 70 : 80;
    const isMobile = window.innerWidth <= 768;

    if (!isMobile && train.path.length > 3) {
        const offset = (train.path.length - 3) * (dominoWidth + 2);
        pathContainer.style.transform = `translateX(-${offset}px)`;
    } else {
        pathContainer.style.transform = `translateX(0px)`;
    }

    trainTrack.appendChild(engineEl);
    trainTrack.appendChild(pathContainer);
    
    trackRow.appendChild(label);
    trackRow.appendChild(trainTrack);

    if (train.isOpen && train.owner !== null) {
        const marker = document.createElement('span');
        marker.className = 'text-2xl ml-2';
        marker.textContent = '🚂';
        label.appendChild(marker);
    }
    return trackRow;
}

function renderTrains() {
    const boardArea = document.getElementById('board-area');
    boardArea.innerHTML = '';

    gameState.players.forEach((player, index) => {
        if (player.isAI) {
            boardArea.appendChild(createTrainRow(`player${index}`, `${player.name} (${player.hand.length} left)`));
        }
    });
    boardArea.appendChild(createTrainRow('mexican', 'Mexican Train'));
    const humanPlayer = gameState.players[0];
    boardArea.appendChild(createTrainRow('player0', `Your Train (${humanPlayer.hand.length} left)`));
    
    updatePlayableTrains();
}

function getTrainEndValue(train) {
    if (train.path.length === 0) {
        return gameState.engine.v1;
    }
    const lastDomino = train.path[train.path.length - 1];
    return lastDomino.v2;
}

function updatePlayableTrains() {
    const domino = gameState.selectedDomino;
    document.querySelectorAll('.train-track').forEach(el => el.classList.remove('playable'));

    if (!domino) return;
    
    Object.keys(gameState.trains).forEach(key => {
        const train = gameState.trains[key];
        const canPlayOnTrain = (key === 'mexican') || 
                               (key === `player${gameState.currentPlayer}`) || 
                               (train.isOpen);

        if (canPlayOnTrain) {
            const endValue = getTrainEndValue(train);
            if (domino.v1 === endValue || domino.v2 === endValue) {
               const trainEl = document.querySelector(`.train-track[data-train-key="${key}"]`);
               if (trainEl) trainEl.classList.add('playable');
            }
        }
    });
}

function renderPlayerHand() {
    playerHandEl.innerHTML = '';
    const player = gameState.players[0];
    player.hand.forEach((domino, index) => {
        const el = createDominoElement(domino, true);
        el.dataset.index = index;
        el.draggable = true;
        el.style.left = `${domino.x}px`;
        el.style.top = `${domino.y}px`;

        el.addEventListener('click', () => {
            document.querySelectorAll('.domino.selected').forEach(d => d.classList.remove('selected'));
            el.classList.add('selected');
            gameState.selectedDomino = domino;
            updatePlayableTrains();
        });

        el.addEventListener('dblclick', () => {
            const handDomino = gameState.players[0].hand[index];
            [handDomino.v1, handDomino.v2] = [handDomino.v2, handDomino.v1];
            renderPlayerHand();
        });

        playerHandEl.appendChild(el);
    });
    playerDominoCountEl.textContent = player.hand.length;
}

function renderBoneyard() {
    boneyardCountEl.textContent = gameState.boneyard.length;
}

function renderScoreboard() {
    scoreboardEl.innerHTML = '';
    gameState.players.forEach(player => {
        const scoreRow = document.createElement('div');
        scoreRow.className = 'flex justify-between items-center bg-gray-50 p-2 rounded';
        scoreRow.innerHTML = `
            <span class="font-medium">${player.name}</span>
            <span class="font-bold text-lg">${player.score}</span>
        `;
        scoreboardEl.appendChild(scoreRow);
    });
}

function handleTrainClick(e) {
    const trainEl = e.target.closest('.train-track.playable');
    if (!trainEl) return;
    
    const trainKey = trainEl.dataset.trainKey;
    const domino = gameState.selectedDomino;

    if (playDomino(gameState.currentPlayer, domino, trainKey)) {
        gameState.selectedDomino = null;
        renderAll();
        
        if (!domino.isDouble) {
            setTimeout(nextTurn, 500);
        } else {
            gameStatusEl.textContent = "You played a double! Play another domino.";
            if(!canPlayerPlay(0)){
                showModal("Double Trouble", "You can't satisfy your double. You must draw.", "Draw", () => {
                    handleBoneyardClick();
                     if(!canPlayerPlay(0)){
                         showModal("Still Stuck", "You still can't satisfy the double. Your train is now open.", "OK", () => {
                              gameState.trains[`player${gameState.currentPlayer}`].isOpen = true;
                              renderAll();
                              setTimeout(nextTurn, 500);
                         });
                     }
                });
            }
        }
    }
}

function canPlayerPlay(playerIndex) {
    const player = gameState.players[playerIndex];
    for (const domino of player.hand) {
        for (const key of Object.keys(gameState.trains)) {
            const train = gameState.trains[key];
            const canPlayOnTrain = (key === 'mexican') || (key === `player${playerIndex}`) || train.isOpen;
            if (canPlayOnTrain) {
                const endValue = getTrainEndValue(train);
                if (domino.v1 === endValue || domino.v2 === endValue) {
                    return true;
                }
            }
        }
    }
    return false;
}

function playDomino(playerIndex, domino, trainKey) {
    const train = gameState.trains[trainKey];
    const endValue = getTrainEndValue(train);
    
    if (domino.v1 !== endValue && domino.v2 !== endValue) return false;

    const handIndex = findDominoInHand(playerIndex, domino);
    if(handIndex === -1) return false;
    
    const playedDomino = gameState.players[playerIndex].hand.splice(handIndex, 1)[0];

    if(playedDomino.v1 !== endValue) {
        [playedDomino.v1, playedDomino.v2] = [playedDomino.v2, playedDomino.v1];
    }
    
    train.path.push(playedDomino);

    if(trainKey === `player${playerIndex}`) {
        train.isOpen = false;
    }
    
    if (checkRoundOver()) {
        endRound();
        return true;
    }

    return true;
}

function handleBoneyardClick() {
    if (gameState.currentPlayer !== 0) return;
    if(canPlayerPlay(0)) {
        showModal("Wait!", "You have a valid move. You don't need to draw.");
        return;
    }

    if (gameState.boneyard.length > 0) {
        const newDomino = gameState.boneyard.pop();
        const playerHand = gameState.players[0].hand;
        playerHand.push(newDomino);

        const pos = calculateNewDominoPosition(playerHand);
        newDomino.x = pos.x;
        newDomino.y = pos.y;
        
        renderPlayerHand();
        renderBoneyard();

        const endValues = Object.keys(gameState.trains).map(key => {
            const train = gameState.trains[key];
            const canPlayOnTrain = (key === 'mexican') || (key === `player0`) || train.isOpen;
            return canPlayOnTrain ? getTrainEndValue(train) : null;
        }).filter(v => v !== null);

        if (endValues.includes(newDomino.v1) || endValues.includes(newDomino.v2)) {
            showModal("Good Draw!", "You drew a playable domino. Make your move.", "OK");
            gameState.selectedDomino = newDomino;
            renderPlayerHand();
            const justDrawnDominoEl = Array.from(playerHandEl.children).find(el => el.dataset.v1 == newDomino.v1 && el.dataset.v2 == newDomino.v2);
            if(justDrawnDominoEl) justDrawnDominoEl.classList.add('selected');
            updatePlayableTrains();
        } else {
            gameState.trains.player0.isOpen = true;
            renderAll();
            showModal("No Luck", "You couldn't play the drawn domino. Your train is now open.", "OK", () => {
                setTimeout(nextTurn, 500);
            });
        }
    } else {
        showModal("Boneyard Empty", "No more dominoes to draw. You must pass.", "OK", () => {
            gameState.trains.player0.isOpen = true;
            renderAll();
            setTimeout(nextTurn, 500);
        });
    }
}

function nextTurn() {
    if (gameState.isRoundOver) return;
    gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;
    if (gameState.players[gameState.currentPlayer].isAI) {
        gameStatusEl.textContent = `${gameState.players[gameState.currentPlayer].name} is thinking...`;
        setTimeout(handleAITurn, 1000);
    } else {
        gameStatusEl.textContent = "Your turn.";
    }
}

function handleAITurn() {
    const playerIndex = gameState.currentPlayer;
    const player = gameState.players[playerIndex];
    
    let move = findBestAIMove(playerIndex);
    
    if (move) {
        playDomino(playerIndex, move.domino, move.trainKey);
        renderAll();
        if(move.domino.isDouble) {
            gameStatusEl.textContent = `${player.name} played a double! It will play again.`;
            setTimeout(handleAITurn, 1000); 
            return;
        }
    } else {
        if (gameState.boneyard.length > 0) {
            const newDomino = gameState.boneyard.pop();
            player.hand.push(newDomino);
            renderBoneyard();
            move = findBestAIMove(playerIndex, newDomino);
            if (move) {
                playDomino(playerIndex, move.domino, move.trainKey);
                renderAll();
            } else {
                gameState.trains[`player${playerIndex}`].isOpen = true;
                renderAll();
            }
        } else {
            gameState.trains[`player${playerIndex}`].isOpen = true;
            renderAll();
        }
    }

    if (checkRoundOver()) {
        endRound();
    } else {
        setTimeout(nextTurn, 1000);
    }
}

function findBestAIMove(playerIndex, specificDomino = null) {
    const hand = specificDomino ? [specificDomino] : gameState.players[playerIndex].hand;
    let possibleMoves = [];

    for (const domino of hand) {
        for (const key of Object.keys(gameState.trains)) {
            const train = gameState.trains[key];
            const canPlayOnTrain = (key === 'mexican') || (key === `player${playerIndex}`) || train.isOpen;
            if (canPlayOnTrain) {
                const endValue = getTrainEndValue(train);
                if (domino.v1 === endValue || domino.v2 === endValue) {
                    let score = 0;
                    score += domino.v1 + domino.v2;
                    if (key === `player${playerIndex}`) score += 5;
                    if (key === 'mexican') score += 2;
                    if (domino.isDouble) score -= 10;
                    possibleMoves.push({ domino, trainKey: key, score });
                }
            }
        }
    }
    if(possibleMoves.length === 0) return null;

    possibleMoves.sort((a, b) => b.score - a.score);
    return possibleMoves[0];
}

function checkRoundOver() {
    if (gameState.players.some(p => p.hand.length === 0)) return true;
    if (gameState.boneyard.length === 0) {
        return !gameState.players.some((p, i) => canPlayerPlay(i));
    }
    return false;
}

function endRound() {
    if (gameState.isRoundOver) return;
    gameState.isRoundOver = true;

    scoreboardEl.classList.remove('hidden');
    scoreboardArrow.classList.add('rotated');

    let roundScores = [];
    let winnerName = '';
    gameState.players.forEach((player, i) => {
        let score = player.hand.reduce((sum, d) => sum + d.v1 + d.v2, 0);
        if (player.hand.length === 0) {
            winnerName = player.name;
            score = 0;
        }
        player.score += score;
        roundScores.push(`${player.name}: +${score} (Total: ${player.score})`);
    });

    const winnerText = winnerName ? `${winnerName} won the round!` : 'The round is blocked!';
    
    let isLastRound = false;
    if (gameState.gameMode === 'quick' && gameState.roundsPlayed >= gameState.totalRounds) {
        isLastRound = true;
    } else if (gameState.gameMode === 'traditional' && gameState.currentRound <= 0) {
        isLastRound = true;
    }

    const buttonText = isLastRound ? "See Final Results" : "Next Round";
    const callback = isLastRound ? endGame : () => initGame(false);

    showModal(winnerText, `Scores:<br>${roundScores.join('<br>')}`, buttonText, callback);
}

function endGame() {
     gameState.players.sort((a,b) => a.score - b.score);
     const winner = gameState.players[0];
     let scoreSummary = gameState.players.map(p => `${p.name}: ${p.score} points`).join('<br>');
     showModal(`Game Over! ${winner.name} wins!`, `Final Scores:<br>${scoreSummary}`, "Play Again", promptNewGame);
}

// --- Drag and Drop Handlers ---
function handleDragStart(e) {
    const dominoEl = e.target.closest('.domino');
    draggedState.index = parseInt(dominoEl.dataset.index);
    draggedState.offsetX = e.clientX - dominoEl.getBoundingClientRect().left;
    draggedState.offsetY = e.clientY - dominoEl.getBoundingClientRect().top;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
        dominoEl.classList.add('dragging');
    }, 0);
}

function handleDragEnd(e) {
    const dominoEl = document.querySelector(`.domino[data-index="${draggedState.index}"]`);
    if(dominoEl) dominoEl.classList.remove('dragging');
    draggedState.index = null;
}

function handleDragOver(e) {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();
    if (draggedState.index === null) return;
    
    const handRect = playerHandEl.getBoundingClientRect();

    if (e.clientX >= handRect.left && e.clientX <= handRect.right && e.clientY >= handRect.top && e.clientY <= handRect.bottom) {
        const dominoToMove = gameState.players[0].hand[draggedState.index];
        dominoToMove.x = e.clientX - handRect.left - draggedState.offsetX;
        dominoToMove.y = e.clientY - handRect.top - draggedState.offsetY;
    }
    
    renderPlayerHand();
}

// --- Touch Handlers using requestAnimationFrame ---
function updateDragPosition() {
    if (!touchState.active || !touchState.isDragging) return;

    const dominoEl = document.querySelector(`.domino[data-index="${touchState.index}"]`);
    if (dominoEl) {
        const deltaX = touchState.currentX - touchState.startX;
        const deltaY = touchState.currentY - touchState.startY;
        dominoEl.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    }
    
    animationFrameId = requestAnimationFrame(updateDragPosition);
}

function handleTouchStart(e) {
    const dominoEl = e.target.closest('.domino');
    if (!dominoEl) return;
    e.preventDefault();

    const index = parseInt(dominoEl.dataset.index);
    const touch = e.touches[0];

    touchState = {
        ...touchState,
        index: index,
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        active: true,
        isDragging: false
    };
    dominoEl.classList.add('dragging');
}

function handleTouchMove(e) {
    if (!touchState.active) return;
    e.preventDefault();

    const touch = e.touches[0];
    touchState.currentX = touch.clientX;
    touchState.currentY = touch.clientY;

    if (!touchState.isDragging) {
        const deltaX = Math.abs(touchState.currentX - touchState.startX);
        const deltaY = Math.abs(touchState.currentY - touchState.startY);
        if (deltaX > 5 || deltaY > 5) {
            touchState.isDragging = true;
            animationFrameId = requestAnimationFrame(updateDragPosition);
        }
    }
}

function handleTouchEnd(e) {
    if (!touchState.active) return;
    
    cancelAnimationFrame(animationFrameId);

    const dominoEl = document.querySelector(`.domino[data-index="${touchState.index}"]`);
    if(dominoEl) {
        dominoEl.classList.remove('dragging');
        dominoEl.style.transform = '';
    }

    if (touchState.isDragging) {
        const handRect = playerHandEl.getBoundingClientRect();
        const lastTouch = e.changedTouches[0];
        
        const dominoData = gameState.players[0].hand[touchState.index];
        const initialDomino = { x: dominoData.x, y: dominoData.y };

        const deltaX = lastTouch.clientX - touchState.startX;
        const deltaY = lastTouch.clientY - touchState.startY;

        const finalX = initialDomino.x + deltaX;
        const finalY = initialDomino.y + deltaY;
        
        if (lastTouch.clientX >= handRect.left && lastTouch.clientX <= handRect.right && lastTouch.clientY >= handRect.top && lastTouch.clientY <= handRect.bottom) {
            dominoData.x = finalX;
            dominoData.y = finalY;
        }
        renderPlayerHand();

    } else {
        const currentTime = Date.now();
        const dominoIndex = touchState.index;

        if (lastTap.index === dominoIndex && (currentTime - lastTap.time) < 300) {
            const handDomino = gameState.players[0].hand[dominoIndex];
            [handDomino.v1, handDomino.v2] = [handDomino.v2, handDomino.v1];
            renderPlayerHand();
            lastTap = { time: 0, index: null };
        } else {
            const domino = gameState.players[0].hand[dominoIndex];
            document.querySelectorAll('.domino.selected').forEach(d => d.classList.remove('selected'));
            dominoEl.classList.add('selected');
            gameState.selectedDomino = domino;
            updatePlayableTrains();
            lastTap = { time: currentTime, index: dominoIndex };
        }
    }
    
    touchState.active = false;
}

// --- Setup Modal & Dark Mode Logic ---
function updateSetupState() {
    const startBtn = document.getElementById('start-game-btn');
    let ready = false;
    if (setupState.gameMode === 'traditional' && setupState.players) {
        ready = true;
    } else if (setupState.gameMode === 'quick' && setupState.rounds && setupState.players) {
        ready = true;
    }
    startBtn.disabled = !ready;
}

function promptNewGame() {
    setupState = {};
    document.querySelectorAll('#game-setup-modal .setup-btn.selected').forEach(el => el.classList.remove('selected'));
    document.getElementById('setup-rounds-section').classList.add('hidden');
    document.getElementById('setup-players-section').classList.add('hidden');
    document.getElementById('start-game-btn').disabled = true;
    gameSetupModal.classList.remove('hidden');
}

function setupDarkMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.classList.add('dark-mode');
        darkModeToggle.textContent = '☀️';
    } else {
        darkModeToggle.textContent = '🌙';
    }

    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
            darkModeToggle.textContent = '☀️';
        } else {
            localStorage.setItem('theme', 'light');
            darkModeToggle.textContent = '🌙';
        }
    });
}

// --- Event Listeners ---
scoreboardHeader.addEventListener('click', () => {
    scoreboardEl.classList.toggle('hidden');
    scoreboardArrow.classList.toggle('rotated');
});

document.getElementById('setup-game-mode').addEventListener('click', e => {
    if (e.target.tagName !== 'BUTTON') return;
    document.querySelectorAll('#setup-game-mode .setup-btn').forEach(btn => btn.classList.remove('selected'));
    e.target.classList.add('selected');
    setupState.gameMode = e.target.dataset.value;
    
    if (setupState.gameMode === 'quick') {
        document.getElementById('setup-rounds-section').classList.remove('hidden');
    } else {
        document.getElementById('setup-rounds-section').classList.add('hidden');
        setupState.rounds = 13;
        document.getElementById('setup-players-section').classList.remove('hidden');
    }
    updateSetupState();
});

document.getElementById('setup-rounds').addEventListener('click', e => {
    if (e.target.tagName !== 'BUTTON') return;
    document.querySelectorAll('#setup-rounds .setup-btn').forEach(btn => btn.classList.remove('selected'));
    e.target.classList.add('selected');
    setupState.rounds = parseInt(e.target.dataset.value, 10);
    document.getElementById('setup-players-section').classList.remove('hidden');
    updateSetupState();
});

document.getElementById('setup-players').addEventListener('click', e => {
    if (e.target.tagName !== 'BUTTON') return;
    document.querySelectorAll('#setup-players .setup-btn').forEach(btn => btn.classList.remove('selected'));
    e.target.classList.add('selected');
    setupState.players = parseInt(e.target.dataset.value, 10);
    updateSetupState();
});

document.getElementById('start-game-btn').addEventListener('click', () => {
    gameSetupModal.classList.add('hidden');
    initGame(true);
});

document.getElementById('close-setup-modal').addEventListener('click', () => {
    gameSetupModal.classList.add('hidden');
});

document.getElementById('board-area').addEventListener('click', handleTrainClick);
boneyardEl.addEventListener('click', handleBoneyardClick);
newGameBtn.addEventListener('click', promptNewGame);

playerHandEl.addEventListener('dragstart', handleDragStart);
playerHandEl.addEventListener('dragend', handleDragEnd);
playerHandEl.addEventListener('dragover', handleDragOver);
playerHandEl.addEventListener('drop', handleDrop);

playerHandEl.addEventListener('touchstart', handleTouchStart, { passive: false });
playerHandEl.addEventListener('touchmove', handleTouchMove, { passive: false });
playerHandEl.addEventListener('touchend', handleTouchEnd);

// --- Initial Load ---
setupDarkMode();
showModal(
    "Welcome to Mexican Train!",
    "The goal is to be the first to play all your dominoes. The player with the lowest score at the end wins. Click 'New Game' to begin!",
    "Got it!"
);
