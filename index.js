const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let categories = [];
let letter = '';
let players = [];
let gameStarted = false;
let gameDuration = 0;
let gameTimer = null;
let gameHost = null;
let answers = {}; // Oyuncuların cevapları

// Sunucuya statik dosyalar yüklemek
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Lobi sayfasını göstermek
app.get('/lobby/:lobbyId', (req, res) => {
    res.sendFile(__dirname + '/public/lobby.html');
});

// Host sayfasından oyun başlatma
app.post('/start-game', (req, res) => {
    if (gameHost) {
        gameStarted = true;
        io.emit('game-start', { categories, letter, gameDuration });
        startGameTimer();
        res.send('Game started');
    }
});

// Oyunun bitmesi için Host tarafından tetiklenecek event
io.on('connection', (socket) => {
    console.log('Yeni bir oyuncu bağlandı');

    socket.on('join-game', (nickname, lobbyId) => {
        if (gameStarted) {
            socket.emit('game-started');
            return;
        }
        // Aynı oyuncunun birden fazla katılmasını engelleme
        if (players.some(player => player.id === socket.id)) {
            return;
        }

        players.push({ id: socket.id, nickname, lobbyId });
        socket.emit('welcome', { nickname, players });
        io.emit('update-players', players);
    });

    socket.on('create-lobby', (categoriesData, duration) => {
        categories = categoriesData;
        letter = getRandomLetter(); // Rastgele harf seçimi
        gameDuration = duration;
        gameHost = socket.id; // Host'u belirle
        const lobbyId = generateLobbyId();
        socket.emit('lobby-created', lobbyId);
        io.emit('update-players', players);
    });

    socket.on('start-game', () => {
        io.emit('game-start', { categories, letter, gameDuration });
    });

    socket.on('end-game', () => {
        // Oyun bitince tüm oyunculara sonuçları gönder
        io.emit('game-end', answers); 
    });

    socket.on('send-answer', (data) => {
        answers[socket.id] = { nickname: data.nickname, data: data.answers }; // Cevapları al
        io.emit('receive-answer', { id: socket.id, data });
    });

    socket.on('disconnect', () => {
        players = players.filter(player => player.id !== socket.id);
        io.emit('update-players', players);
        delete answers[socket.id]; // Cevaplardan sil
    });
});

// Oyun sayfası başlatılacak
function startGameTimer() {
    gameTimer = setInterval(() => {
        if (gameDuration > 0) {
            gameDuration--;
            io.emit('timer-update', { gameDuration });
        } else {
            clearInterval(gameTimer);
        }
    }, 1000);
}

// Rastgele bir harf seçme
function getRandomLetter() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return letters[Math.floor(Math.random() * letters.length)];
}

// Lobi id'si oluşturma (5 karakterli rastgele)
function generateLobbyId() {
    return Math.random().toString(36).substr(2, 5).toUpperCase();
}

server.listen(3000, () => {
    console.log('Sunucu çalışıyor http://localhost:3000');
});
