const express = require('express');
const cors = require('cors');
const http = require('http');
const {Server} = require('socket.io');
const fs = require('fs');
const path = require('path');
const axios = require('axios');


// 1) Création de l'appli Express
const app = express();
app.use(cors());

// 2) Middleware pour parser le body JSON
app.use(express.json({limit: '50mb'})); // Pour éviter les erreurs PayloadTooLarge

// 3) Création d'un serveur HTTP "classique" sur lequel on va brancher Socket.IO
const server = http.createServer(app);

// 4) Création du serveur Socket.IO (relié au serveur HTTP)
const io = new Server(server, {
    cors: {
        origin: "*", // autorise toutes les origines, ou spécifiez l'URL de votre front si besoin
    }
});

// 5) Variables pour stocker nos données reçues + logs
let lastData = null;      // dernière data brute interceptée
let logs = [];            // ensemble des logs/frames
let statsGlobales = {};   // stats agrégées


const loadDataFromFile = () => {
    try {
        const dataPath = path.join(__dirname, 'data.json');
        if (fs.existsSync(dataPath)) {
            console.log('Chargement des données initiales depuis data.json...');
            const fileContent = fs.readFileSync(dataPath, 'utf-8');
            processInterceptedData(JSON.parse(fileContent)); // Charger les données dans lastData
        } else {
            console.log('data.json introuvable. Utilisation des valeurs par défaut.');
        }
    } catch (err) {
        console.error('Erreur lors du chargement de data.json :', err);
    }
};

loadDataFromFile();


// 6) Endpoint POST pour recevoir les données interceptées
app.post('/intercepted', (req, res) => {
        const {url, status, response} = req.body;

        console.log("=== [NodeJS] Données interceptées ===");
        console.log("URL :", url);
        console.log("Status :", status);

        try {
            // On parse la réponse reçue (JSON)
            const parsedData = JSON.parse(response);

            // On délègue le traitement des données à une sous-fonction
            processInterceptedData(parsedData);

            // Chemin du fichier data.json
            const filePath = path.join(__dirname, 'data.json');

            // Lecture du fichier existant et ajout des nouvelles données
            // Sauvegarde dans le fichier data.json
            fs.writeFile(filePath, JSON.stringify(parsedData, null, 2), (writeErr) => {
                if (writeErr) {
                    console.error("Erreur lors de l'écriture dans data.json :", writeErr);

                }

            });
            // Réponse au client (Tampermonkey)
            res.json({success: true, message: 'Données bien reçues par le serveur local'});
        } catch
            (err) {
            console.error("Erreur lors du parse JSON :", err);
            res.status(400).json({success: false, message: 'Erreur de parsing JSON'});
        }
    }
)
;

function processInterceptedData(data) {
    // Ex. on stocke la donnée complète
    lastData = data;
    logs = [];
    statsGlobales = {};


    // Ex. on complète le log avec frames si dispo
    if (data.frames) {
        logs.push(...data.frames);
    }

    // Ex. on met à jour des stats globales
    if (data.scores) {
        const [score0, score1] = data.scores;
        statsGlobales.score0 = score0;
        statsGlobales.score1 = score1;
    }

    // Ex. si metadata
    if (data.metadata) {
        statsGlobales.metadata = data.metadata;
    }

    // Diffusion aux clients via Socket.IO
    io.emit('newData', {
        lastData,
        logs,
        statsGlobales
    });
}

// 7) Route pour servir les fichiers statiques (notre page HTML / JS / CSS)
app.use(express.static('public'));

// 8) Quand un client se connecte en Socket.IO
io.on('connection', (socket) => {
    console.log("Un client s'est connecté au WebSocket Socket.IO !");

    // On peut lui envoyer les infos courantes dès la connexion
    if (lastData) {
        socket.emit('newData', {
            lastData,
            logs,
            statsGlobales
        });
    }

    socket.on('loadBattle', async (battleId) => {
        console.log(`Demande de chargement pour le Battle ID : ${battleId}`);

        try {
            // Récupération des données via l'API
            const battleData = await fetchBattleData(battleId);

            processInterceptedData(battleData);
        } catch (error) {
            console.error(`Erreur lors du chargement du Battle ID ${battleId}:`, error.message);
            socket.emit('errorLoad', { message: 'Impossible de charger les données du Battle ID.' });
        }
    });
});


async function fetchBattleData(battleId) {
    // Exemple d'implémentation pour récupérer les données (à adapter selon vos besoins)
    try {
        const response = await axios.post(
            'https://www.codingame.com/services/gameResultRemoteService/findByGameId',
            JSON.stringify([battleId, null]), // Corps de la requête
            {
                headers: {
                    'Content-Type': 'application/json', // Header requis
                },
            }
        );

        // Retourne les données reçues
        return response.data;
    } catch (error) {
        console.error(`Erreur lors de la récupération des données pour Battle ID ${battleId}:`, error.message);
        throw new Error('Impossible de récupérer les données de la bataille.');
    }
}

// 9) On lance le serveur sur le port 3000
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Serveur NodeJS + Socket.IO démarré sur http://localhost:${PORT}`);
});
