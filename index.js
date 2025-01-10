// Gerekli kütüphaneleri dahil et
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Express uygulamasını başlat
const app = express();

// HTTP sunucusunu başlat
const server = http.createServer(app);

// Socket.io bağlantısını başlat
const io = socketIo(server);

let categories = [];
let letter = '';
let players = [];
let gameDuration = 0;
let gameTimer = null;
let gameHost = null;
let answers = {}; // Oyuncuların cevapları

// Sunucuyu çalıştırmak için /public dizinindeki statik dosyaları sun
app.use(express.static('public'));

// Anasayfayı (index.html) istemciye gönder
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Lobi sayfasını (lobby.html) istemciye gönder
app.get('/lobby/:lobbyId', (req, res) => {
    res.sendFile(__dirname + '/public/lobby.html');
});

// Lobi oluşturma ve oyun başlatma
app.post('/start-game', (req, res) => {
    if (gameHost) {
        gameStarted = true;
        io.emit('game-start', { categories, letter, gameDuration });
        startGameTimer();
        res.send('Game started');
    }
});

// Socket.io ile bağlantı kurma
io.on('connection', (socket) => {
    console.log('Bir oyuncu bağlandı: ' + socket.id);

    // Oyuncu oyuna katıldığında
    socket.on('join-game', (nickname, lobbyId) => {
        if (players.some(player => player.id === socket.id)) {
            return; // Aynı oyuncu birden fazla katılamaz
        }

        players.push({ id: socket.id, nickname, lobbyId });
        socket.emit('welcome', { nickname, players });
        io.emit('update-players', players);
    });

    // Lobi oluşturulduğunda
    socket.on('create-lobby', (categoriesData, duration) => {
        categories = categoriesData;
        letter = getRandomLetter(); // Rastgele bir harf seç
        gameDuration = duration;
        gameHost = socket.id; // Oyunun hostu olarak bu oyuncuyu belirle
        const lobbyId = generateLobbyId(); // Rastgele bir lobi ID'si oluştur
        socket.emit('lobby-created', lobbyId);
        io.emit('update-players', players);
    });

    // Oyun başladığında
    socket.on('start-game', () => {
        io.emit('game-start', { categories, letter, gameDuration });
    });

    // Cevapları gönderdiğinde
    socket.on('send-answer', (data) => {
        answers[socket.id] = { nickname: data.nickname, data: data.answers };
        io.emit('receive-answer', { id: socket.id, data });
    });

    // Bağlantı kesildiğinde
    socket.on('disconnect', () => {
        players = players.filter(player => player.id !== socket.id);
        io.emit('update-players', players);
        delete answers[socket.id]; // Cevaplardan bu oyuncuyu sil
    });

    // Oyun bitiminde sonuçları gönder
    socket.on('end-game', () => {
        io.emit('game-end', answers); // Zaman bittiğinde oyun bitişi
    });
});

// Oyun sayfası başlatılacak (geri sayım fonksiyonu)
function startGameTimer() {
    gameTimer = setInterval(() => {
        if (gameDuration > 0) {
            gameDuration--;
            io.emit('timer-update', { gameDuration });
        } else {
            clearInterval(gameTimer); // Zaman bittiğinde geri sayım durur
            io.emit('game-end', answers); // Oyun bitince sonuçları gönder
        }
    }, 1000);
}

// Rastgele bir harf seçme
function getRandomLetter() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return letters[Math.floor(Math.random() * letters.length)];
}

// Lobi ID'si oluşturma
function generateLobbyId() {
    return Math.random().toString(36).substr(2, 5).toUpperCase();
}

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
