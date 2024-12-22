const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Autoriser les requêtes CORS (vous pouvez restreindre à des domaines spécifiques si nécessaire)
app.use(cors());

// Augmente la taille maximale du body à 10 Mo (ajustez selon vos besoins)
app.use(express.json({ limit: '10mb' }));

app.post('/intercepted', (req, res) => {
    console.log("=== [NodeJS] Données interceptées reçues ===");
    console.log(req.body); // Affiche les données reçues
    res.json({ success: true, message: 'Données bien reçues par le serveur local' });
});

app.listen(PORT, () => {
    console.log(`Serveur NodeJS démarré sur http://localhost:${PORT}`);
});
