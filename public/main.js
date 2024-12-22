// Connection au serveur Socket.IO (assume que le serveur est sur la même machine, port 3000)
import {Tree, TreeNode} from './tree.js';
//814834100

const socket = io.connect(window.location.origin, {
    path: '/socket.io'
});

socket.on('connect', () => {
    console.log("Connecté au serveur Socket.IO !");
});


let chartPlayer0 = null;
let chartPlayer1 = null;
let chartLinePlayer0 = null;
let chartLinePlayer1 = null;

let abcdTab = [];

let currentFrameId = 0;
let totalFrames = 100;
let activeHeatmap = null;

const singleMapping = {
    "A": "a.png",
    "B": "b.png",
    "C": "c.png",
    "D": "d.png",
    "_": "wall.png"
};

// 2) Pour code plus complexes, on se base sur (owner, code):
//    Si owner=0 => "bxxx.png", si owner=1 => "oxxx.png".
const multiMapping = {
    "BASIC": {0: "obas.png", 1: "bbas.png"},  // GROWTH BASIC
    "HARVESTER": {0: "ohar.png", 1: "bhar.png"},  // HARVESTER
    "ROOT": {0: "oroot.png", 1: "broot.png"},
    "SPORER": {0: "ospo.png", 1: "bspo.png"},  // SPORER
    "TENTACLE": {0: "oten.png", 1: "bten.png"},
    "X": {1: "wall.png"}
};


// Références DOM
const statsList = document.getElementById('statsList');
const canvas = document.getElementById('myCanvas');
const btnStart = document.getElementById('btnStart');
const btnPrevious = document.getElementById('btnPrevious');
const btnPlayPause = document.getElementById('btnPlayPause');
const btnNext = document.getElementById('btnNext');
const btnEnd = document.getElementById('btnEnd');
const currentFrameSpan = document.getElementById('currentFrameId');
const totalFramesSpan = document.getElementById('totalFrames');
const ctxAnim = canvas.getContext('2d');
const heatmapControls = document.getElementById("heatmapControls");
const heatmapButtonsContainer = document.getElementById("heatmapButtons");
const battleIdInput = document.getElementById('battleId');
const loadBattleButton = document.getElementById('loadBattle');
const errorMessageElement = document.getElementById('errorMessage');


// Événement 'newData' => quand le serveur reçoit de nouvelles infos

let isPlaying = false;
let playInterval;
let lastlogs = null;
let heatmaps = [];

let tree0 = new Tree();
let tree1 = new Tree();


function updateDrawTree() {
    updateTree(lastlogs);

    drawRadialTree(tree0, 'tree0Canvas');
    drawRadialTree(tree1, 'tree1Canvas');
}

socket.on('errorLoad', (payload) => {

    console.log("Erreur lors du chargement du Battle ID :", payload);
    displayError(payload.message || 'Une erreur est survenue.');
});


socket.on('newData', (payload) => {
    console.log("Nouvelles données reçues :", payload);

    const {lastData, logs, statsGlobales} = payload;
    lastlogs = logs;

    const {commandsCount, allLogs} = analyzeAllFrames(logs || []);

    initAnimationData(logs);

    getabcd(logs);

    parseGameData(lastData)


    updateStats(statsGlobales);

    updateHeatMap(logs);


    updatePieCharts(commandsCount);
    updateLineCharts(abcdTab);
    updateDrawTree();

    drawAnimation(logs);

    buildFramesTable(logs);

    goToFrame(1);

    hideError();
});


loadBattleButton.addEventListener('click', () => {
    handleBattleIdSubmission();
});

// Listener pour appuyer sur "Enter" dans le champ d'entrée
battleIdInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        handleBattleIdSubmission();
    }
});

// Fonction pour traiter la soumission du Battle ID
function handleBattleIdSubmission() {
    const battleId = battleIdInput.value.trim(); // Récupère la valeur de l'input
    if (battleId) {
        console.log(`Requête pour charger le Battle ID : ${battleId}`);

        socket.emit('loadBattle', battleId);
    } else {
        displayError('Veuillez entrer un Battle ID valide.');
    }
}

function displayError(message) {
    errorMessageElement.textContent = message;
    errorMessageElement.style.display = 'block';
}

function hideError() {
    errorMessageElement.textContent = '';
    errorMessageElement.style.display = 'none';
}

function applyFrameTree(raw) {
    const lines = raw.split('\n');

    const groups = [];

    // Itérer à partir de la troisième ligne et regrouper par 8 lignes
    for (let i = 5; i < lines.length; i += 8) {
        const group = lines.slice(i, i + 8);
        groups.push(group);
    }

    const spores = [];

    groups.forEach((group, index) => {
        const unk = parseInt(group[0], 10); // Propriétaire
        const owner = parseInt(group[3], 10); // Propriétaire
        const id = parseInt(group[4], 10); // ID
        let type = group[5]; // Type
        const direction = group[6]; // Direction
        const positionMatch = group[7].match(/(\d+)\s+(\d+)_+(\d+)\s+(\d+)/);

        let a, b, x, y;

        if (unk === 1 && positionMatch) {
            x = parseInt(positionMatch[1], 10);
            a = parseInt(positionMatch[2], 10);
            b = parseInt(positionMatch[3], 10);
            y = parseInt(positionMatch[4], 10);

            if (a !== y) {
                let bx = x;
                let ay = y;
                x = b;
                y = a;
                a = ay;
                b = bx;
            }

            let s = {owner, x, y, a, b};

            spores.push(s);
        }
    });


    groups.forEach((group, index) => {
        // console.log(`Traitement du groupe ${index + 1} :`, group);

        // Extraction des variables depuis le groupe
        const unk = parseInt(group[0], 10); // Propriétaire
        const owner = parseInt(group[3], 10); // Propriétaire
        const id = parseInt(group[4], 10); // ID
        let type = group[5]; // Type
        const direction = group[6]; // Direction
        const positionMatch = group[7].match(/(\d+)\s+(\d+)_+(\d+)\s+(\d+)/);

        let a, b, x, y;

        if (unk === 3) {
            const positionSplit = group[7].split(" ");
            if (positionSplit.length >= 2) {
                x = parseInt(positionSplit[0], 10);
                y = parseInt(positionSplit[1], 10);
            }

            if (owner === 0) tree0.findNodeByCoordinates(tree0.root, x, y).kill()
            if (owner === 1) tree1.findNodeByCoordinates(tree1.root, x, y).kill()

            // console.log(group)

        } else {
            let swap = false;
            if (positionMatch) {
                x = parseInt(positionMatch[1], 10);
                a = parseInt(positionMatch[2], 10);
                b = parseInt(positionMatch[3], 10);
                y = parseInt(positionMatch[4], 10);

                if (a === y) {
                    let bx = x;
                    let ay = y;
                    x = b;
                    y = a;
                    a = ay;
                    b = bx;

                    swap = true;

                }
            } else {
                const positionSplit = group[7].split(" ");
                if (positionSplit.length >= 2) {
                    x = parseInt(positionSplit[0], 10);
                    y = parseInt(positionSplit[1], 10);
                }
            }


            if (direction !== "" && type === "") {
                type = "ROOT"
            }


            if (type !== "") {

                let und = false;

                if (a === undefined) {
                    spores.forEach(s => {
                        if (s.owner === owner && s.b === x && s.a === y) {
                            a = s.y;
                            b = s.x;
                        }
                    });
                    und = true;

                }

                if (a !== undefined) {
                    // console.log("ADD", x, y, a, b, und, swap)

                    if (owner === 0) tree0.addChildToParent(b, a, x, y, type, type === "ROOT");
                    if (owner === 1) tree1.addChildToParent(b, a, x, y, type, type === "ROOT");
                } else {
                    console.log("ERREUR", x, y, a, b, type, direction, spores)
                }
            }
        }
    });
}

function applyFirstFrameTree(raw) {
    const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);


    // 1) La première ligne doit être "22 11"
    const [widthStr, heightStr] = lines[0].split(" ");
    const width = parseInt(widthStr, 10);
    const height = parseInt(heightStr, 10);

    const expectedCellsCount = width * height;
    const remainingLines = lines.slice(1 + expectedCellsCount);

    if (remainingLines.length === 4) {
        parseStartTree(remainingLines[1], tree0)
        parseStartTree(remainingLines[3], tree1)
    }

}

function updateTree(logs) {
    tree0 = new Tree();
    tree1 = new Tree();

    tree0.color = "#ff5900";
    tree1.color = "#2f9dcc";


    const initFrame = logs.find(f => f.agentId === -1 && f.keyframe === true);
    if (!initFrame) {
        console.log("Pas de frame d'initialisation trouvé !");
        return;
    }

    const lines = initFrame.view.split("\n");
    const secondLine = lines[1];

    let jsonView = null;
    try {
        jsonView = JSON.parse(secondLine.trim());
    } catch (err) {
        console.error("Erreur parse JSON du view:", err);
        return;
    }

    const rawGraphicsBase = jsonView.global.graphics;
    if (!rawGraphicsBase) {
        console.warn("Pas de global.graphics trouvé !");
        return;
    }

    applyFirstFrameTree(rawGraphicsBase);

    for (let i = 0; i < currentFrameId; i++) {
        const currentFrame = logs[i * 2 + 2];
        if (!currentFrame) {
            console.error("Pas de current trouvé !");
            break;
        }
        const currentLines = currentFrame.view.split("\n");
        const currentSecondLine = currentLines[1];

        let currentJsonView = null;
        try {
            currentJsonView = JSON.parse(currentSecondLine.trim());
        } catch (err) {
            console.error("Erreur parse JSON du currentView:", err);
            return;
        }

        const currentRawGraphicsBase = currentJsonView.graphics;
        if (!currentRawGraphicsBase) {
            console.warn("Pas de global.graphics current trouvé !");
            return;
        }

        // console.log("Frame", i);
        applyFrameTree(currentRawGraphicsBase);
    }

    // tree0.print()
    // tree1.print()
}


function createMiniMapElement(miniMapHTML) {
    // On crée la <table>
    const table = document.createElement('table');
    table.classList.add('miniMapTable');

    // Pour chaque ligne du miniMapHTML...
    miniMapHTML.forEach(rowLine => {
        // rowLine ex: "7;-1;0 0;0;0 3;1;0 0;0;0 1;-1;0"

        // On découpe la ligne en cellules, séparées par des espaces
        const rowParts = rowLine.split(/\s+/);
        // rowParts ex: ["7;-1;0", "0;0;0", "3;1;0", "0;0;0;0", "1;-1;0"]

        // On crée un <tr>
        const tr = document.createElement('tr');

        // Pour chaque cellule (ex: "7;-1;0")
        rowParts.forEach(cellData => {
            const [typeStr, ownerStr, dirStr] = cellData.split(';');
            const type = parseInt(typeStr, 10);
            const owner = parseInt(ownerStr, 10);
            const dir = parseInt(dirStr, 10); // direction si besoin

            // On crée le <td>
            const td = document.createElement('td');

            // Ici, on insère un <img> en fonction du type/owner
            // => À adapter à votre logique d’images
            // Pour l'exemple, on fait un mapping minimal :
            const img = document.createElement('img');
            img.src = getMiniMapImageSrc(type, owner);
            // ou img.src = `/img/tile_${type}_${owner}.png` par exemple

            // (Optionnel) Si vous souhaitez faire tourner l’image en fonction de `dir`,
            // vous pouvez appliquer un style transform :
            switch (dir) {
                case 1: img.style.transform = 'rotate(-90deg)'; break;
                case 4: img.style.transform = 'rotate(180deg)'; break;
                case 3: img.style.transform = 'rotate(90deg)'; break;
                default: break; // 0 => pas de rotation
            }


            let txtToAdd = "[" + type + "," + owner + "," + dir + "]";

            // td.appendChild(document.createTextNode(txtToAdd));

            if (type !== 0)
                td.appendChild(img);
            tr.appendChild(td);
        });

        table.appendChild(tr);
    });

    // On enveloppe la table dans un <div> (pour respecter le style .miniMapHtml)
    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = "miniMapHtml";
    wrapperDiv.appendChild(table);

    return wrapperDiv;
}

/**
 * Exemple de fonction de mapping pour obtenir le chemin de l’image en fonction de (type, owner).
 * À vous de l’adapter selon votre nomenclature d’images.
 */
function getMiniMapImageSrc(type, owner) {
    // Déterminer le préfixe selon le owner
    let prefix = "";
    if (owner === 0) prefix = "b"; // OPP
    if (owner === 1) prefix = "o"; // ME
    // Si owner === -1 (OWNER_NULL), on peut laisser vide ou renvoyer un default

    switch (type) {
        case 0: // TYPE_EMPTY
            return "/img/empty.png";

        case 1: // TYPE_WALL
            return "/img/wall.png";

        case 2: // TYPE_ROOT
            // /img/broot.png ou /img/oroot.png
            return `/img/${prefix}root.png`;

        case 3: // TYPE_BASIC
            // /img/bbas.png ou /img/obas.png
            return `/img/${prefix}bas.png`;

        case 4: // TYPE_TENTACLE
            // /img/bten.png ou /img/oten.png
            return `/img/${prefix}ten.png`;

        case 5: // TYPE_HARVESTER
            // /img/bhar.png ou /img/ohar.png
            return `/img/${prefix}har.png`;

        case 6: // TYPE_SPORER
            // /img/bspo.png ou /img/ospo.png
            return `/img/${prefix}spo.png`;

        case 7: // TYPE_A
            // Ressources => pas de préfixe
            return "/img/a.png";

        case 8: // TYPE_B
            return "/img/b.png";

        case 9: // TYPE_C
            return "/img/c.png";

        case 10: // TYPE_D
            return "/img/d.png";

        default:
            // Par défaut, on renvoie une image fallback
            return "/img/default.png";
    }


}

function parseHeatmaps(log, tour, heatmaps) {
    if (log === undefined) return
    const lines = log.split('\n'); // On sépare le log en lignes
    let currentHeatmap = null;     // Objet temporaire pour une heatmap en cours de lecture

    for (let rawLine of lines) {
        const line = rawLine.trim();

        // Début d'une heatmap : "Heatmap:GlobalHeatMap"
        if (line.startsWith('Heatmap:')) {
            const name = line.split(':')[1]?.trim(); // Récupération du nom
            currentHeatmap = {name, tour, values: []};
            continue;
        }

        // Fin d'une heatmap : "endHeatMap"
        if (line.startsWith('endHeatMap')) {
            if (currentHeatmap) {
                // Recherche ou création d'une heatmap avec ce nom
                let heatmap = heatmaps.find(h => h.name === currentHeatmap.name);
                if (!heatmap) {
                    heatmap = {name: currentHeatmap.name, values: []};
                    heatmaps.push(heatmap);
                }
                // Ajout des données pour le tour courant
                heatmap.values.push({
                    tour: currentHeatmap.tour,
                    values: currentHeatmap.values
                });
                currentHeatmap = null;
            }
            continue;
        }

        // Si on est au sein d'une heatmap, on stocke les lignes de valeurs
        if (currentHeatmap && line.length > 0) {
            // Découpe la ligne en nombres
            const row = line
                .split(' ')
                .map(value => parseInt(value, 10)); // parseInt pour obtenir des nombres
            currentHeatmap.values.push(row);
        }
    }
}


function updateHeatMap(logs) {

    heatmaps = []

    const grouped = {};
    let pos = -1;
    logs.forEach(f => {

        if (pos >= 0) {

            const fn = Math.floor(pos / 2);
            if (!grouped[fn]) {
                grouped[fn] = {};
            }
            grouped[fn][f.agentId] = f;
        }
        pos++;
    });


    // tri sur les indices de frames, si besoin
    const frameNumbers = Object.keys(grouped).map(n => parseInt(n)).sort((a, b) => a - b);

    frameNumbers.forEach(fn => {
        parseHeatmaps(grouped[fn][0].stderr, fn, heatmaps);

    });

    if (heatmaps.length > 0) {
        heatmapControls.style.display = "block";

        while (heatmapButtonsContainer.firstChild) {
            heatmapButtonsContainer.removeChild(heatmapButtonsContainer.firstChild);
        }

        // Générer un bouton pour chaque heatmap
        heatmaps.forEach(heatmap => {
            const button = document.createElement("button");
            button.textContent = heatmap.name;
            button.classList.add("heatmap-toggle-button");

            // Ajouter un gestionnaire d'événement pour le clic
            button.addEventListener("click", () => {
                // Désactiver tous les autres boutons

                if (button.classList.contains("active")) {
                    document.querySelectorAll(".heatmap-toggle-button").forEach(btn => {
                        btn.classList.remove("active");
                    });

                    activeHeatmap = null;

                } else {
                    document.querySelectorAll(".heatmap-toggle-button").forEach(btn => {
                        btn.classList.remove("active");
                    });

                    // Activer le bouton cliqué
                    button.classList.add("active");

                    // Mettre à jour la heatmap active
                    activeHeatmap = heatmap.name;

                }

                drawAnimation(logs);


            });

            // Ajouter le bouton au conteneur
            heatmapButtonsContainer.appendChild(button);
        });
    } else {
        heatmapControls.style.display = "none";
    }
}


function toggleHeatmap(heatmapName, button) {
    const isVisible = button.getAttribute("data-visible") === "true";
    button.setAttribute("data-visible", !isVisible);
    button.textContent = isVisible ? `Afficher ${heatmapName}` : `Masquer ${heatmapName}`;

    // Logique pour afficher/masquer la heatmap dans l'interface (à implémenter selon vos besoins)
    console.log(`${isVisible ? "Masquer" : "Afficher"} la heatmap: ${heatmapName}`);
}


function parseGameData(gameData) {
    // console.log(gameData);
    // Récupérer les informations
    const gameId = gameData.gameId;
    const seed = gameData.refereeInput.match(/seed=(-?\d+)/)[1]; // Extraire le seed, y compris les

    const scores = gameData.scores.join(" - "); // Convertir les scores en chaîne
    const tooltip = JSON.parse(gameData.tooltips[0]); // Parse le tooltip JSON

    // Mise à jour des éléments HTML
    document.getElementById('gameId').textContent = gameId;
    document.getElementById('seed').textContent = seed;
    document.getElementById('scores').textContent = scores;
}


function initAnimationData(logs) {
    // Détermine totalFrames à partir de logs
    const initIndex = logs.findIndex(f => f.agentId === -1 && f.keyframe === true);
    // Exemple : toutes les frames après l’init, en comptant 1 log sur 2
    totalFrames = Math.floor((logs.length - (initIndex + 1)) / 2);

    totalFramesSpan.textContent = totalFrames;
}

btnStart.addEventListener('click', () => {
    goToFrame(0);
});

btnPrevious.addEventListener('click', () => {
    goToFrame(currentFrameId - 1);
});

btnNext.addEventListener('click', () => {
    goToFrame(currentFrameId + 1);
});

btnEnd.addEventListener('click', () => {
    goToFrame(totalFrames);
});

btnPlayPause.addEventListener('click', () => {
    if (!isPlaying) {
        isPlaying = true;
        btnPlayPause.textContent = 'Pause';
        playInterval = setInterval(() => {
            if (currentFrameId < totalFrames) {
                goToFrame(currentFrameId + 1);
            } else {
                clearInterval(playInterval);
                isPlaying = false;
                btnPlayPause.textContent = 'Play';
            }
        }, 500); // 500ms = 2 frames/s, ajuster selon besoin
    } else {
        // Pause
        isPlaying = false;
        btnPlayPause.textContent = 'Play';
        clearInterval(playInterval);
    }
});

function goToFrame(frameIndex) {
    if (frameIndex < 0) frameIndex = 0;
    if (frameIndex > totalFrames) frameIndex = totalFrames;

    currentFrameId = frameIndex;

    drawAnimation(lastlogs);
    buildFramesTable(lastlogs);


    updateFrameIdDisplay();

    updateDrawTree();


}

function updateFrameIdDisplay() {
    currentFrameSpan.textContent = currentFrameId;
}

function buildFramesTable(frames) {
    // 1) Groupement par frameNumber
    const grouped = {};
    let pos = -1;
    frames.forEach(f => {

        if (pos >= 0) {

            const fn = Math.floor(pos / 2);
            if (!grouped[fn]) {
                grouped[fn] = {};
            }
            grouped[fn][f.agentId] = f;
        }
        pos++;
    });

    // 2) Pour chaque frameNumber, on crée une ligne <tr>
    //    avec 3 <td> : frame#, logs joueur0, logs joueur1
    const tbody = document.querySelector("#framesTable tbody");
    if (!tbody) return;

    // on efface d'abord le contenu existant
    tbody.innerHTML = "";

    // tri sur les indices de frames, si besoin
    const frameNumbers = Object.keys(grouped).map(n => parseInt(n)).sort((a, b) => a - b);

    frameNumbers.forEach(fn => {
        const row = document.createElement('tr');
        row.addEventListener('click', () => goToFrame(fn));
        // Colonne Frame #
        const tdFrameIndex = document.createElement('td');
        tdFrameIndex.className = "frameIndexCell";
        tdFrameIndex.textContent = fn;  // "Frame #"
        row.appendChild(tdFrameIndex);

        // Colonne logs Joueur 0
        const tdLogs0 = document.createElement('td');
        tdLogs0.className = "logsCell";
        if (grouped[fn][0]) {
            tdLogs0.appendChild(buildLogsElement(grouped[fn][0].stdout, grouped[fn][0].stderr));
        }
        row.appendChild(tdLogs0);

        // Colonne logs Joueur 1
        const tdLogs1 = document.createElement('td');
        tdLogs1.className = "logsCell";
        if (grouped[fn][1]) {
            tdLogs1.appendChild(buildLogsElement(grouped[fn][1].stdout, grouped[fn][1].stderr));
        }
        row.appendChild(tdLogs1);

        tbody.appendChild(row);
    });
}

/**
 * buildLogsElement : Crée un <div> (ou fragment) contenant
 *  - les lignes stdout en normal
 *  - les lignes stderr en rouge
 */
function buildLogsElement(stdoutText, stderrText) {
    const container = document.createElement('div');

    // stdout => lignes
    if (stdoutText) {
        const linesOut = stdoutText.split("\n").map(l => l.trim()).filter(Boolean);
        linesOut.forEach(line => {
            const div = document.createElement('div');
            div.className = "stdoutLine";
            div.textContent = line;
            container.appendChild(div);
        });
    }

    // stderr => lignes
    if (stderrText) {
        const linesErr = stderrText.split("\n");
        let inMiniMap = false;
        let miniMapHTML = [];

        for (let rawLine of linesErr) {
            let line = rawLine.trim();

            if (line.startsWith("MINI MAP")) {
                inMiniMap = true;
                continue;
            }
            if (line.startsWith("END MINI MAP")) {
                inMiniMap = false;

                const divMap = createMiniMapElement(miniMapHTML);
                container.appendChild(divMap);

                miniMapHTML = [];
                continue;
            }

            if (inMiniMap) {
                // on stocke la ligne brute
                miniMapHTML.push(line);
            } else {
                // ligne stderr classique
                if (line.length > 0) {
                    const div = document.createElement('div');
                    div.className = "stderrLine";
                    div.textContent = line;
                    container.appendChild(div);
                }
            }

        }
    }
    return container;

}


function analyzeAllFrames(frames) {
    const commandsCount = {0: {}, 1: {}};
    const allLogs = {0: [], 1: []};

    frames.forEach(frame => {
        const {agentId, commands, logs} = parseCommandsFromFrame(frame);

        commands.forEach(cmd => {
            if (!commandsCount[agentId][cmd]) commandsCount[agentId][cmd] = 0;
            commandsCount[agentId][cmd]++;
        });

        if (agentId !== -1)
            allLogs[agentId].push(...logs);
    });

    return {commandsCount, allLogs};
}

function extractCommand(line) {
    // Majuscules, supprime espaces en trop
    const ucLine = line.toUpperCase().trim();

    if (ucLine.startsWith("WAIT")) {
        // return "WAIT";
        return null;
    }
    if (ucLine.startsWith("SPORE")) {
        return "SPORE";
    }
    if (ucLine.startsWith("GROW")) {
        // On recherche si on a BASIC, HARVESTER, SPORER, TENTACLE...
        if (ucLine.includes("BASIC")) return "GROW BASIC";
        if (ucLine.includes("HARVESTER")) return "GROW HARVESTER";
        if (ucLine.includes("SPORER")) return "GROW SPORER";
        if (ucLine.includes("TENTACLE")) return "GROW TENTACLE";
        // Sinon commande GROW "générique"
        return "GROW";
    }
    // Cas si on a GROW ??? => on le mappe aussi vers GROWTH ?
    // if (ucLine.startsWith("GROW ")) { ... }

    return null; // ligne non reconnue comme commande
}

// Petite fonction pour éviter l'injection HTML
function escapeHTML(str) {
    return str.replace(/[<>&"]/g, c => {
        switch (c) {
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '&':
                return '&amp;';
            case '"':
                return '&quot;';
        }
    });
}

function parseCommandsFromFrame(frame) {
    const {agentId, stdout = "", stderr = ""} = frame;

    // On sépare stdout en lignes
    const linesOut = stdout.split("\n").map(l => l.trim()).filter(Boolean);
    // On sépare stderr en lignes
    const linesErr = stderr.split("\n").map(l => l.trim()).filter(Boolean);

    // On va stocker les commandes trouvées, et aussi l’ensemble des logs
    const foundCommands = [];
    const logsOutput = []; // pour un affichage complet plus tard

    linesOut.forEach(line => {
        logsOutput.push({type: "stdout", line});
        const cmd = extractCommand(line);
        if (cmd) foundCommands.push(cmd);
    });

    linesErr.forEach(line => {
        logsOutput.push({type: "stderr", line});
        const cmd = extractCommand(line);
        if (cmd) foundCommands.push(cmd);
    });

    // foundCommands = ["WAIT", "GROWTH BASIC", ...]
    return {agentId, commands: foundCommands, logs: logsOutput};
}


function transformStatsData(statsData) {
    // Les "labels" (en abscisse) seront simplement les valeurs "i"
    const labels = statsData.map(entry => entry.i);

    // Les données du joueur 0 (une liste de points pour a, b, c, d)
    const dataPlayer0 = {
        a: statsData.map(entry => entry.player0.a),
        b: statsData.map(entry => entry.player0.b),
        c: statsData.map(entry => entry.player0.c),
        d: statsData.map(entry => entry.player0.d),
    };

    // Les données du joueur 1
    const dataPlayer1 = {
        a: statsData.map(entry => entry.player1.a),
        b: statsData.map(entry => entry.player1.b),
        c: statsData.map(entry => entry.player1.c),
        d: statsData.map(entry => entry.player1.d),
    };

    return {labels, dataPlayer0, dataPlayer1};
}

function createLineChart(ctx, title, dataObj, labels, color) {

    const backgroundColors = labels.map((_, i) => shadeColor(color, i * 40 - 40));

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels, // ex: [0, 1, 2, 3, ...]
            datasets: [
                {
                    label: 'Ressource A',
                    data: dataObj.a,      // ex: [9, 9, 10, ...] pour le joueur
                    borderColor: backgroundColors[0], // couleur du trait
                    backgroundColor: backgroundColors[0], // couleur de fond (transparente, ou légère opacité)
                    fill: false,
                },
                {
                    label: 'Ressource B',
                    data: dataObj.b,
                    borderColor: backgroundColors[1],
                    backgroundColor: backgroundColors[1],
                    fill: false,
                },
                {
                    label: 'Ressource C',
                    data: dataObj.c,
                    borderColor: backgroundColors[2],
                    backgroundColor: backgroundColors[2],
                    fill: false,
                },
                {
                    label: 'Ressource D',
                    data: dataObj.d,
                    borderColor: backgroundColors[3],
                    backgroundColor: backgroundColors[3],
                    fill: false,
                },
            ]
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: title
                },
                legend: {
                    display: true
                },
            },
            scales: {
                x: {
                    title: {display: true, text: 'Itération (i)'},
                },
                y: {
                    title: {display: true, text: 'Valeur'},
                    beginAtZero: true
                }
            }
        }
    });
}

function updateLineCharts(statsData) {
    // On commence par transformer les données
    const {labels, dataPlayer0, dataPlayer1} = transformStatsData(statsData);

    // Récupération du canvas pour le joueur 0
    const canvasPlayer0 = document.getElementById('linePlayer0');
    if (canvasPlayer0) {
        const ctx0 = canvasPlayer0.getContext('2d');
        // S'il y avait déjà un graphique, on le détruit avant de le recréer
        if (chartLinePlayer0) {
            chartLinePlayer0.destroy();
        }
        // On crée le nouveau
        chartLinePlayer0 = createLineChart(ctx0, 'Évolution Ressources Joueur 0', dataPlayer0, labels, "#ff5900");
    }

    // Récupération du canvas pour le joueur 1
    const canvasPlayer1 = document.getElementById('linePlayer1');
    if (canvasPlayer1) {
        const ctx1 = canvasPlayer1.getContext('2d');
        if (chartLinePlayer1) {
            chartLinePlayer1.destroy();
        }
        chartLinePlayer1 = createLineChart(ctx1, 'Évolution Ressources Joueur 1', dataPlayer1, labels, "#2f9dcc");
    }
}


function createPieChart(ctx, title, dataObj, color) {

// dataObj est un { "WAIT": 10, "SPORE": 5, ... }

    const labels = Object.keys(dataObj);
    const values = Object.values(dataObj);

// Couleurs (option simple) : on peut générer un tableau, ou un dégradé...

// Pour un style plus sympa, on fait un tableau de couleurs tout en nuance de `color`.

    const backgroundColors = labels.map((_, i) => shadeColor(color, i * 20 - 40));
    return new Chart(ctx, {
        type: 'pie',
        data: {
            labels,
            datasets: [
                {
                    data: values,
                    backgroundColor: backgroundColors,
                },
            ],
        },
        options: {
            // Désactive la réactivité
            responsive: false,

            // Si vous voulez que le donut occupe tout l'espace disponible (dans la zone 400x400),
            // vous pouvez également ajouter 'maintainAspectRatio: false' ici,
            // mais assurez-vous que c'est bien le comportement souhaité :
            // maintainAspectRatio: false,

            plugins: {
                title: {
                    display: true,
                    text: title,
                },
                legend: {
                    // display: false,
                    // La légende reste en bas
                    position: 'bottom',
                    // Alignement à droite
                    align: 'start',
                    labels: {
                        boxWidth: 20, // Taille du carré de couleur
                        padding: 10, // Espace entre chaque ligne
                    },
                },

            },
        },
    });
}

function updatePieCharts(commandsCount) {
    // Joueur 0
    const canvas0 = document.getElementById('piePlayer0');
    if (canvas0) {
        const ctx0 = canvas0.getContext('2d');

        if (chartPlayer0) {
            chartPlayer0.destroy(); // si un chart existait déjà, on le détruit d'abord
        }
        chartPlayer0 = createPieChart(ctx0, "Commands Player 0", commandsCount[0], "#ff5900");
    }

    // Joueur 1
    const canvas1 = document.getElementById('piePlayer1');
    if (canvas1) {
        const ctx1 = canvas1.getContext('2d');

        if (chartPlayer1) {
            chartPlayer1.destroy();
        }
        chartPlayer1 = createPieChart(ctx1, "Commands Player 1", commandsCount[1], "#2f9dcc");
    }
}


function shadeColor(color, percent) {
    // color = "#ff5900" par ex
    // percent = +/- un ratio
    // On convertit en R, G, B => on applique un ratio
    // Simplification possible ou usage d’une lib. Cf. snippet ci-dessous:
    const num = parseInt(color.replace("#", ""), 16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00FF) + percent;
    let b = (num & 0x0000FF) + percent;
    r = (r < 255) ? (r < 0 ? 0 : r) : 255;
    g = (g < 255) ? (g < 0 ? 0 : g) : 255;
    b = (b < 255) ? (b < 0 ? 0 : b) : 255;
    return `rgb(${r},${g},${b})`;
}


// Mises à jour stats
function updateStats(statsGlobales) {
    let metadata = statsGlobales.metadata;
    displayLeaderIndicator(statsGlobales);

    // 2) Affichage des scores
    displayScores(statsGlobales);

    // 3) Affichage détaillé dans statsList
    statsList.innerHTML = "<h3>Stats & Metadata</h3>";

    if (!metadata) {
        statsList.innerHTML += "<p>Aucune metadata disponible.</p>";
        return;
    }

    // 4) On peut regrouper toutes les stats "comparables" dans un tableau d’objets
    const comparables = [
        {label: "ExecutionTime (ms)", key0: "executionTime_0", key1: "executionTime_1", maxHint: 3000},
        {label: "harvest A", key0: "harvestedProteins_A_0", key1: "harvestedProteins_A_1"},
        {label: "harvest B", key0: "harvestedProteins_B_0", key1: "harvestedProteins_B_1"},
        {label: "harvest C", key0: "harvestedProteins_C_0", key1: "harvestedProteins_C_1"},
        {label: "harvest D", key0: "harvestedProteins_D_0", key1: "harvestedProteins_D_1"},
        {label: "Growth Basic", key0: "growthTypes_basic_0", key1: "growthTypes_basic_1"},
        {label: "Growth Harvester", key0: "growthTypes_harvester_0", key1: "growthTypes_harvester_1"},
        {label: "Growth Sporer", key0: "growthTypes_sporer_0", key1: "growthTypes_sporer_1"},
        {label: "Growth Tentacle", key0: "growthTypes_tentacle_0", key1: "growthTypes_tentacle_1"},
        {label: "Growth Root", key0: "growthTypes_root_0", key1: "growthTypes_root_1"},
        {label: "Kill Basic", key0: "deathTypes_basic_1", key1: "deathTypes_basic_0"},
        {label: "Kill Harvester", key0: "deathTypes_harvester_1", key1: "deathTypes_harvester_0"},
        {label: "Kill Sporer", key0: "deathTypes_sporer_1", key1: "deathTypes_sporer_0"},
        {label: "Kill Tentacle", key0: "deathTypes_tentacle_1", key1: "deathTypes_tentacle_0"},
        {label: "Kill Root", key0: "deathTypes_root_1", key1: "deathTypes_root_0"},
        {label: "Absorbed Proteins A", key0: "absorbedProteins_A_0", key1: "absorbedProteins_A_1"},
        {label: "Absorbed Proteins B", key0: "absorbedProteins_B_0", key1: "absorbedProteins_B_1"},
        {label: "Absorbed Proteins C", key0: "absorbedProteins_C_0", key1: "absorbedProteins_C_1"},
        {label: "Absorbed Proteins D", key0: "absorbedProteins_D_0", key1: "absorbedProteins_D_1"},
        {label: "Total Spore Distance", key0: "totalSporeDistance_0", key1: "totalSporeDistance_1"},
        {label: "Wall Points", key0: "wallPoints_0", key1: "wallPoints_1"},
        {label: "Organisms At Game End", key0: "organismsAtGameEnd_0", key1: "organismsAtGameEnd_1"},
        {label: "Cascade Children kills", key0: "cascadeChildrenDeaths_1", key1: "cascadeChildrenDeaths_0"},
        {label: "Protein Thefts", key0: "proteinThefts_0", key1: "proteinThefts_1"}
    ];

    // 5) Construire le HTML des comparaisons
    comparables.forEach(item => {
        const val0 = metadata[item.key0] || 0;
        const val1 = metadata[item.key1] || 0;
        statsList.innerHTML += buildCompareRow(item.label, val0, val1, item.maxHint || 50);
    });

}

function displayLeaderIndicator(statsGlobales) {
    const leaderIndicator = document.getElementById('leaderIndicator');

    if (statsGlobales.score0 == null || statsGlobales.score1 == null) {
        leaderIndicator.textContent = "Scores indisponibles.";
        return;
    }
    // Compare score0 vs score1
    if (statsGlobales.score0 > statsGlobales.score1) {
        leaderIndicator.innerHTML = `
      <span style="color: var(--color-player0)">Joueur 0</span> mène avec 
      <strong>${(statsGlobales.score0 - statsGlobales.score1).toFixed(2)}</strong> points d'avance !
    `;
    } else if (statsGlobales.score1 > statsGlobales.score0) {
        leaderIndicator.innerHTML = `
      <span style="color: var(--color-player1)">Joueur 1</span> mène avec 
      <strong>${(statsGlobales.score1 - statsGlobales.score0).toFixed(2)}</strong> points d'avance !
    `;
    } else {
        leaderIndicator.textContent = "Égalité parfaite !";
    }
}

function displayScores(statsGlobales) {
    // On va remplacer le contenu de statsZone par un bloc "scores", puis le reste
    // ou alors on cible un petit div dédié. Pour l’exemple, on fait simple :
    statsList.innerHTML = "";

    // Construction d’un bloc HTML pour les scores
    const score0 = (statsGlobales.score0 != null) ? statsGlobales.score0 : "-";
    const score1 = (statsGlobales.score1 != null) ? statsGlobales.score1 : "-";

    // HTML d’affichage
    statsList.innerHTML += `
    <div class="scoreWrapper">
      <div class="scoreBox player0">
        Joueur 0 : <span>${score0}</span>
      </div>
      <div class="scoreBox player1">
        Joueur 1 : <span>${score1}</span>
      </div>
    </div>
  `;
}

function buildCompareRow(label, val0, val1, maxHint) {
    // maxHint est la valeur "max" de référence pour la largeur.
    // On peut aussi prendre Math.max(val0, val1) pour l’échelle, mais parfois on veut un maximum un peu stable.
    let maxVal = val0 + val1;
    let width0;
    let width1;

    if (maxVal === 0) {
        maxVal = 100;
        width0 = 10;
        width1 = 10;
    } else {
        // Calcul des largeurs en pourcentage
        width0 = (val0 / maxVal) * 100;
        width1 = (val1 / maxVal) * 100;

        if (width0 <= 10) {
            width0 = 10;
            width1 = 90;
        }
        if (width1 <= 10) {
            width1 = 10;
            width0 = 90;
        }
    }

    // Qui domine ? (petit highlight si valX est plus grand)
    const classDominant0 = (val0 > val1) ? "dominant" : "";
    const classDominant1 = (val1 > val0) ? "dominant" : "";

    // On fait un double bar "face-à-face" (left->right pour 1, right->left pour 0).
    // Mais pour la démo, on va aligner 0 à gauche, 1 à droite, superposés :
    return `
    <div class="statCompareRow">
      <div class="statLabel">${label}:</div>
      <div class="barCompare">
        <div class="barValue0 /*${classDominant0}*/" style="width:${width0}%;">
          ${val0}
        </div>
        <div class="barValue1 /*${classDominant1}*/" style="width:${width1}%; margin-left: auto;">
          ${val1}
        </div>
      </div>
    </div>
  `;
}


let images = {}; // contiendra toutes les images chargées

loadAllImages()
    .then(() => {
        // console.log("Toutes les images sont chargées !");
        // On peut maintenant dessiner
        // e.g. start the game, or call drawAnimation(...)
    })
    .catch(err => console.error(err));

function loadAllImages() {
    return new Promise((resolve, reject) => {
        const promises = [];

        // 1) Charger les "singleMapping"
        Object.entries(singleMapping).forEach(([code, filename]) => {
            const key = code; // ex: "A", "B", "X"
            promises.push(loadImage(key, `/img/${filename}`));
        });

        // 2) Charger les "multiMapping"
        Object.entries(multiMapping).forEach(([code, owners]) => {
            // code ex: "BAS"
            // owners ex: {0: "bbas.png", 1: "obas.png"}
            Object.entries(owners).forEach(([ownerStr, filename]) => {
                const key = `${code}_${ownerStr}`; // ex: "BAS_0"
                promises.push(loadImage(key, `/img/${filename}`));
            });
        });

        // Quand toutes les promesses de chargement sont terminées, on résout
        Promise.all(promises).then(() => resolve()).catch(err => reject(err));
    });
}

// Helper : loadImage(key, url) => Promise
function loadImage(key, url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => {
            images[key] = img; // on stocke dans le dictionnaire global
            resolve();
        };
        img.onerror = (e) => reject(`Erreur chargement image ${url}: ${e}`);
    });
}


function applyFrameGraphics(cells, graphics) {
    // Séparer les lignes à partir des données de la chaîne graphics
    const lines = graphics.split('\n');

    // Initialiser un tableau pour stocker les groupes de 8 lignes
    const groups = [];

    // Itérer à partir de la troisième ligne et regrouper par 8 lignes
    for (let i = 5; i < lines.length; i += 8) {
        const group = lines.slice(i, i + 8);
        groups.push(group);
    }

    // console.log(graphics);
    // console.log(lines);

    // Appliquer les groupes aux cellules
    groups.forEach((group, index) => {
        // console.log(`Traitement du groupe ${index + 1} :`, group);

        // Extraction des variables depuis le groupe
        const unk = parseInt(group[0], 10); // Propriétaire
        const owner = parseInt(group[3], 10); // Propriétaire
        const id = parseInt(group[4], 10); // ID
        let type = group[5]; // Type
        const direction = group[6]; // Direction
        const positionMatch = group[7].match(/(\d+)\s+(\d+)_+(\d+)\s+(\d+)/);

        let a, b, x, y;

        if (positionMatch) {
            x = parseInt(positionMatch[1], 10);
            a = parseInt(positionMatch[2], 10);
            b = parseInt(positionMatch[3], 10);
            y = parseInt(positionMatch[4], 10);

            if (a === y) {
                x = b;
                y = a;
            }
        } else {
            const positionSplit = group[7].split(" ");
            if (positionSplit.length >= 2) {
                x = parseInt(positionSplit[0], 10);
                y = parseInt(positionSplit[1], 10);
            }
        }


        if (direction !== "" && type === "") {
            type = "ROOT"
        }

        if (type !== "") {

            cells[y][x] = {unk, owner, id, code: type, dir: direction, dead: unk === 3};

            // console.log(`Cellule (${x}, ${y}) :`, cells[y][x]);
        } else {
            // console.error("Échec : 'type' est vide.");

        }
    });

}

function getabcd(logs) {
    abcdTab = [];

    for (let i = 0; i < totalFrames; i++) {


        const currentFrame = logs[i * 2 + 2];
        if (!currentFrame) {
            console.error("Pas de current trouvé !", i, totalFrames);
            return;
        }
        const currentLines = currentFrame.view.split("\n");
        const currentSecondLine = currentLines[1];

        let currentJsonView = null;
        try {
            currentJsonView = JSON.parse(currentSecondLine.trim());
        } catch (err) {
            console.error("Erreur parse JSON du currentView:", err);
            return;
        }

        const currentRawGraphicsBase = currentJsonView.graphics;
        if (!currentRawGraphicsBase) {
            console.warn("Pas de global.graphics current trouvé !");
            return;
        }


        const player0Values = currentRawGraphicsBase.split("\n")[0]?.split(" ").map(Number);
        const player1Values = currentRawGraphicsBase.split("\n")[2]?.split(" ").map(Number);

        if (!player0Values || player0Values.length !== 4) {
            console.warn(`Valeurs incorrectes pour le joueur 0 à l'itération ${i}`);
            continue;
        }

        if (!player1Values || player1Values.length !== 4) {
            console.warn(`Valeurs incorrectes pour le joueur 1 à l'itération ${i}`);
            continue;
        }

        // Stockage dans le tableau
        abcdTab.push({
            i,
            player0: {
                a: player0Values[0],
                b: player0Values[1],
                c: player0Values[2],
                d: player0Values[3],
            },
            player1: {
                a: player1Values[0],
                b: player1Values[1],
                c: player1Values[2],
                d: player1Values[3],
            },
        });
    }
}

function drawAnimation(logs) {
    // 1) Effacer le canvas
    ctxAnim.clearRect(0, 0, canvas.width, canvas.height);

    // 2) Récupérer le premier frame qui contient l'initialisation (agentId === -1 ?)
    const initFrame = logs.find(f => f.agentId === -1 && f.keyframe === true);
    if (!initFrame) {
        console.log("Pas de frame d'initialisation trouvé !");
        return;
    }

    const lines = initFrame.view.split("\n");
    const secondLine = lines[1];

    let jsonView = null;
    try {
        jsonView = JSON.parse(secondLine.trim());
    } catch (err) {
        console.error("Erreur parse JSON du view:", err);
        return;
    }

    const rawGraphicsBase = jsonView.global.graphics;
    if (!rawGraphicsBase) {
        console.warn("Pas de global.graphics trouvé !");
        return;
    }
    let {width, height, cells} = parseGrid(rawGraphicsBase);


    let cellSize = 920 / width;

    for (let i = 0; i < currentFrameId; i++) {
        const currentFrame = logs[i * 2 + 2];
        if (!currentFrame) {
            console.error("Pas de current trouvé !");
            break;
        }
        const currentLines = currentFrame.view.split("\n");
        const currentSecondLine = currentLines[1];

        let currentJsonView = null;
        try {
            currentJsonView = JSON.parse(currentSecondLine.trim());
        } catch (err) {
            console.error("Erreur parse JSON du currentView:", err);
            return;
        }

        const currentRawGraphicsBase = currentJsonView.graphics;
        if (!currentRawGraphicsBase) {
            console.warn("Pas de global.graphics current trouvé !");
            return;
        }

        applyFrameGraphics(cells, currentRawGraphicsBase);
    }


    drawGrid(cells, width, height, cellSize);

}

function getCellImage(owner, code) {
    // 1) Vérifier si le code est dans singleMapping
    if (singleMapping[code]) {
        return images[code]; // ex: "A" => images["A"]
    }

    // 2) Sinon, check si c’est dans multiMapping
    //    ex: code = "BAS" => multiMapping["BAS"] => {0: "bbas.png", 1: "obas.png"}
    //    => la clé images["BAS_0"] ou images["BAS_1"]
    if (multiMapping[code]) {
        const key = `${code}_${owner}`; // ex: "BAS_0"
        return images[key];
    }

    // 3) Sinon, retourne une image par défaut ou rien
    return null;
}


function getColorFromOwnerAndCode(owner, code) {
    // Combine owner et code pour générer un hash
    const input = `${owner}:${code}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = (hash * 31 + input.charCodeAt(i)) & 0xFFFFFFFF;
    }

    // Décomposer le hash en composantes de couleur
    const r = Math.abs((hash >> 16) & 0xFF); // Rouge
    const g = Math.abs((hash >> 8) & 0xFF);  // Vert
    const b = Math.abs(hash & 0xFF);         // Bleu

    // Améliorer la diversité des couleurs avec des ajustements
    const boostFactor = 1.2; // Augmente la luminosité
    const boostedR = Math.min(255, Math.floor(r * boostFactor));
    const boostedG = Math.min(255, Math.floor(g * boostFactor));
    const boostedB = Math.min(255, Math.floor(b * boostFactor));

    return `rgb(${boostedR}, ${boostedG}, ${boostedB})`;
}

function getColorFromValue(value, min, max) {
    const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));

    // Calculer les composantes de couleur
    const red = Math.floor(255 * Math.min(ratio * 2, 1)); // Augmente après la moitié
    const green = Math.floor(255 * (1 - Math.abs(ratio * 2 - 1))); // Max au milieu
    const blue = Math.floor(255 * Math.min((1 - ratio) * 2, 1)); // Diminue après la moitié

    return `rgb(${red},${green},${blue})`;
}

function drawHeatmap(heatmapName, currentFrame, ctxAnim, cellSize, width, height) {
    const heatmap = heatmaps.find(h => h.name === heatmapName);
    if (!heatmap) return;

    const frameData = heatmap.values.find(frame => frame.tour === currentFrame);
    if (!frameData) return;

    const data = frameData.values;

    const allValues = heatmap.values.flatMap(frame => frame.values.flat())
        .filter(v => v >= 0); // Exclure les valeurs négatives

// Calculer les valeurs minimale et maximale
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);

    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            const value = Math.round(data[r]?.[c]) ?? -1; // Valeur par défaut si hors limites
            const color = value >= 0 ? getColorFromValue(value, minValue, maxValue) : "#ccc"; // Couleur par défaut pour les cases sans données

            ctxAnim.fillStyle = color;
            ctxAnim.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
            /*
                        if (value >= 0) {
                            ctxAnim.fillStyle = "#000"; // Couleur du texte (noir par défaut)
                            ctxAnim.fillText(value, c * cellSize + 2, r * cellSize + 10); // Affiche la valeur dans le coin haut-gauche de la cellule
                        }*/
        }
    }
}

function drawGrid(cells, width, height, cellSize) {

    ctxAnim.fillStyle = "#511e2b";
    ctxAnim.fillRect(0, 0, cellSize * width, cellSize * height);

    if (activeHeatmap != null) {
        drawHeatmap(activeHeatmap, currentFrameId, ctxAnim, cellSize, width, height);
    }


    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            let {owner, code, dir, unk, dead} = cells[r][c];

            const x = c * cellSize;
            const y = r * cellSize;

            // Récupère l'image correspondante
            const img = getCellImage(owner, code);

            if (img) {
                ctxAnim.save(); // Sauvegarde l'état actuel du contexte

                // Positionne le contexte au centre de la cellule pour effectuer une rotation
                ctxAnim.translate(x + cellSize / 2, y + cellSize / 2);

                if (code !== "ROOT" && code !== "BASIC") {
                    switch (dir) {
                        case 'N':
                            ctxAnim.rotate(-Math.PI / 2); // Rotation -90° (sens horaire)
                            break;
                        case 'S':
                            ctxAnim.rotate(Math.PI / 2); // Rotation 90° (sens horaire)
                            break;
                        case 'W':
                            ctxAnim.rotate(Math.PI); // Rotation 180°
                            break;
                        case 'E':
                        default:
                            // Pas de rotation pour 'E' ou direction par défaut
                            break;
                    }
                }
                // Dessine l'image avec un décalage pour compenser le translate
                ctxAnim.drawImage(img, -cellSize / 2, -cellSize / 2, cellSize, cellSize);

                ctxAnim.restore();
            } else {
                // Si pas d'image trouvée, dessiner un carré gris par défaut
                /*
                 ctxAnim.fillStyle = getColorFromOwnerAndCode(owner, code);
                 ctxAnim.fillRect(x, y, cellSize, cellSize);

                 ctxAnim.strokeStyle = "#999";
                 ctxAnim.strokeRect(x, y, cellSize, cellSize);

                 // Affichage du code dans la cellule
                 ctxAnim.fillStyle = "#000"; // Noir pour le texte
                 ctxAnim.font = `${Math.floor(cellSize * 0.2)}px Arial`; // Taille proportionnelle à la cellule
                 ctxAnim.textAlign = "center"; // Centrer horizontalement
                 ctxAnim.textBaseline = "middle"; // Centrer verticalement
                 ctxAnim.fillText(code, x + cellSize / 2, y + cellSize / 2);


                 */
            }

            if (unk !== undefined && false) {
                ctxAnim.fillStyle = "#000"; // Noir pour le texte
                ctxAnim.font = `${Math.floor(cellSize * 0.2)}px Arial`; // Taille proportionnelle à la cellule
                ctxAnim.textAlign = "center"; // Centrer horizontalement
                ctxAnim.textBaseline = "middle"; // Centrer verticalement
                ctxAnim.fillText(unk, x + cellSize / 2, y + cellSize / 2);
            }

            if (dead) {
                ctxAnim.fillStyle = "rgba(255, 0, 0, 0.5)";
                ctxAnim.fillRect(x, y, cellSize, cellSize);
            }


            // Dessin du contour (optionnel)
            ctxAnim.strokeStyle = "#999";
            ctxAnim.strokeRect(x, y, cellSize, cellSize);
        }
    }
}

function getCellColor(owner, code) {
    // Exemple :
    //  - 'X' => gris
    //  - 'B' => bleu
    //  - 'A' => vert
    //  - 'C' => violet
    //  - 'D' => jaune
    //  - ...
    //  - Sinon => blanc
    let baseColor = "#ffffff";

    switch (code) {
        case "X":
            baseColor = "#dddddd";
            break;
        case "B":
            baseColor = "#66aaff";
            break;
        case "A":
            baseColor = "#66ffaa";
            break;
        case "C":
            baseColor = "#cc88ff";
            break;
        case "D":
            baseColor = "#f5de6b";
            break;
    }

    // On peut aussi tenir compte de owner:
    // si owner === 1, on modifie un peu la teinte, etc.
    if (owner === 1 && code !== "X") {
        // foncer un peu la couleur
        baseColor = darkenColor(baseColor, 0.2);
    }

    return baseColor;
}

/**
 * darkenColor(hexColor, factor)
 *   factor = 0.2 => fonce de 20%
 */
function darkenColor(hex, factor) {
    // parse hex => r,g,b
    let c = parseInt(hex.slice(1), 16);
    let r = (c >> 16) & 0xff;
    let g = (c >> 8) & 0xff;
    let b = c & 0xff;

    // apply factor
    r = Math.floor(r * (1 - factor));
    g = Math.floor(g * (1 - factor));
    b = Math.floor(b * (1 - factor));

    // back to hex
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function parseGrid(rawGraphics) {
    // Découpage des lignes
    const lines = rawGraphics.split("\n").map(l => l.trim()).filter(Boolean);


    // 1) La première ligne doit être "22 11"
    const [widthStr, heightStr] = lines[0].split(" ");
    const width = parseInt(widthStr, 10);
    const height = parseInt(heightStr, 10);


    // 2) On s'attend à ce que les lignes suivantes décrivent les cases
    //    On veut "width * height" cases
    const expectedCellsCount = width * height;
    const cellLines = lines.slice(1, 1 + expectedCellsCount);

    // 3) On construit un tableau 2D "cells"
    const cells = [];
    for (let r = 0; r < height; r++) {
        cells[r] = [];
        for (let c = 0; c < width; c++) {
            // index linéaire = r * width + c
            const lineIndex = r * width + c;
            const line = cellLines[lineIndex];
            // ex: "0 B" => on split
            const parts = line.split(" ");
            const owner = parseInt(parts[0], 10);   // ex: 0 ou 1
            const code = parts[1];                 // ex: 'B', 'X', 'A'...

            cells[r][c] = {owner, code};
        }
    }


    const remainingLines = lines.slice(1 + expectedCellsCount);


    if (remainingLines.length === 4) {
        parseStart(remainingLines[1], 0, cells)
        parseStart(remainingLines[3], 1, cells)
    }

    // console.log("remainingLines", remainingLines);

    return {width, height, cells};
}

function parseStartTree(data, tree) {
    const parts = data.split(" ");

    const id = parseInt(parts[0], 10);
    const x = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    const type = parts[3];
    const dir = parts[4];
    const parent = parseInt(parts[5], 10);


    tree.setRoot(x, y, "ROOT", true);
}

function parseStart(line, owner, cells) {
    const parts = line.split(" ");


    // Extraire les parties
    const id = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    const x = parseInt(parts[2], 10);
    const type = parts[3];
    const dir = parts[4];
    const parent = parseInt(parts[5], 10);

    // console.log("parseStart", id, x, y, type, dir, parent)

    cells[x][y] = {owner, code: type, id, dir, parent};

}

function drawTree(tree, canvasId) {
    // Récupère le canvas et son contexte 2D
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Effacer le canvas avant de dessiner
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // S'il n'y a pas de racine, on ne dessine rien
    if (!tree.root) return;

    /**
     * Fonction récursive qui dessine un nœud et ses enfants
     * @param {TreeNode} node - Le nœud courant
     * @param {number} x - Position x du nœud courant
     * @param {number} y - Position y du nœud courant
     * @param {number} angle - Angle de propagation
     * @param {number} distance - Distance entre les niveaux
     */
    function drawNode(node, x, y, angle, distance) {
        // Dessiner un petit cercle pour représenter le nœud
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = node.alive ? tree.color : 'gray';
        ctx.fill();
        ctx.closePath();

        // Écrire le type du nœud (optionnel)
        ctx.fillStyle = 'black';
        ctx.font = '10px Arial';
        ctx.fillText(node.data.x + ";" + node.data.y, x - 3, y + 3);

        // Gérer l'emplacement des enfants
        const childrenCount = node.children.length;
        if (childrenCount === 0) return;

        // Calculer l'angle de séparation entre chaque enfant
        // On peut moduler l'angle total selon le nombre d’enfants
        const angleStep = Math.PI / (childrenCount + 1);
        let currentAngle = angle - (angleStep * (childrenCount - 1) / 2);

        for (const child of node.children) {
            // Calculer les coordonnées (childX, childY) du child
            const childX = x + distance * Math.cos(currentAngle);
            const childY = y + distance * Math.sin(currentAngle);

            // Dessiner une ligne reliant le parent à l’enfant
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(childX, childY);
            ctx.strokeStyle = 'black';
            ctx.stroke();
            ctx.closePath();

            // Dessin récursif du nœud enfant
            drawNode(child, childX, childY, currentAngle, distance * 0.7);

            // Incrémenter l'angle pour le prochain enfant
            currentAngle += angleStep;
        }
    }

    // Dessin de la racine en haut, centrée
    // (x = canvas.width / 2, y = 40) => départ au milieu, en haut
    drawNode(tree.root, canvas.width / 2, 40, Math.PI / 2, 80);
}

/**
 * Calcule la profondeur maximale (hauteur) d'un arbre.
 * @param {TreeNode} node
 * @returns {number}
 */
function findMaxDepth(node) {
    if (!node) return 0;
    if (node.children.length === 0) return 1;
    let maxChildDepth = 0;
    for (const child of node.children) {
        const depth = findMaxDepth(child);
        if (depth > maxChildDepth) {
            maxChildDepth = depth;
        }
    }
    return 1 + maxChildDepth;
}

/**
 * Dessine une forme selon le type (ROOT, BASIC, HARVESTER, SPORER, TENTACLE).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} size - rayon ou « taille » du nœud
 * @param {string} type
 * @param {boolean} alive
 * @param {string} color - couleur quand vivant
 */
function drawNodeShape(ctx, x, y, size, type, alive, color) {
    // Couleur de remplissage (soit tree.color, soit gris)
    ctx.fillStyle = alive ? color : 'gray';

    switch (type) {
        case 'ROOT':
            // Dessinons un hexagone, par exemple, pour la racine
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const px = x + size * Math.cos(angle);
                const py = y + size * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            break;

        case 'TENTACLE':
            // Un triangle équilatéral
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const angle = (2 * Math.PI / 3) * i - Math.PI / 2;
                const px = x + size * Math.cos(angle);
                const py = y + size * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            break;

        case 'HARVESTER':
            // Un pentagone
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (2 * Math.PI / 5) * i - Math.PI / 2;
                const px = x + size * Math.cos(angle);
                const py = y + size * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            break;

        case 'SPORER':
            // Un rectangle (centré autour de (x, y))
            ctx.beginPath();
            ctx.rect(x - size, y - size / 2, size * 2, size);
            ctx.fill();
            break;

        case 'BASIC':
        default:
            // Un cercle pour BASIC (ou type inconnu)
            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            ctx.fill();
            ctx.closePath();
            break;
    }
}

/**
 * Dessine un arbre en disposition radiale (racine au centre).
 * @param {Tree} tree - Votre instance de Tree (qui a une propriété `root`)
 * @param {string} canvasId - L'ID du <canvas>
 */
function drawRadialTree(tree, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!tree.root) return;

    // -- Paramètres de taille --
    const nodeRadius = 6;   // taille "de base" des nœuds
    const padding = 10;     // marge
    const minSide = Math.min(canvas.width, canvas.height);
    // Rayon max disponible depuis le centre
    const maxRadius = (minSide / 2) - nodeRadius - padding;

    // -- Calcul de la profondeur max --
    const maxDepth = findMaxDepth(tree.root);
    // Espace entre les niveaux
    const radiusStep = (maxDepth > 1) ? (maxRadius / (maxDepth - 1)) : 0;

    // -- Centre du canvas --
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    /**
     * Dessine récursivement un nœud et ses enfants
     * @param {TreeNode} node
     * @param {number} startAngle
     * @param {number} endAngle
     * @param {number} level
     * @returns {{ x: number, y: number }}
     */
    function drawNode(node, startAngle, endAngle, level) {
        let x, y;

        // Niveau 0 => racine au centre
        if (level === 0) {
            x = centerX;
            y = centerY;
        } else {
            const angle = (startAngle + endAngle) / 2;
            const r = radiusStep * level;
            x = centerX + r * Math.cos(angle);
            y = centerY + r * Math.sin(angle);
        }

        // -- Dessin du nœud (forme selon type) --
        drawNodeShape(ctx, x, y, nodeRadius, node.data.type, node.alive, tree.color);

        // -- Dessin du texte (petite légende) si besoin --
        ctx.fillStyle = 'black';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // ctx.fillText(node.data.x + ";" + node.data.y, x, y);

        // -- Dessin des liens vers les enfants --
        const nbChildren = node.children.length;
        if (nbChildren > 0) {
            const angleTotal = endAngle - startAngle;
            const anglePerChild = angleTotal / nbChildren;

            node.children.forEach((child, index) => {
                const childStart = startAngle + index * anglePerChild;
                const childEnd = childStart + anglePerChild;

                // Dessin récursif
                const {x: cx, y: cy} = drawNode(child, childStart, childEnd, level + 1);

                // Dessiner la ligne reliant le parent et l'enfant
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(cx, cy);
                ctx.strokeStyle = child.data.first ? 'grey' : 'black';
                ctx.lineWidth = 1;
                if (child.data.first) {
                    ctx.setLineDash([5, 5]); // Ligne en pointillés si 'first'
                } else {
                    ctx.setLineDash([]); // Ligne continue sinon
                }
                ctx.stroke();

                // Ajouter une flèche au milieu du trait
                const midX = (x + cx) / 2; // Point milieu en X
                const midY = (y + cy) / 2; // Point milieu en Y

                const arrowLength = 6; // Longueur de la flèche plus petite
                const arrowWidth = 3;   // Largeur de la base de la flèche plus petite

                // Calculer la direction de la flèche
                const angle = Math.atan2(cy - y, cx - x);

                // Points de la flèche
                const arrowX1 = midX - arrowLength * Math.cos(angle - Math.PI / 6);
                const arrowY1 = midY - arrowLength * Math.sin(angle - Math.PI / 6);

                const arrowX2 = midX - arrowLength * Math.cos(angle + Math.PI / 6);
                const arrowY2 = midY - arrowLength * Math.sin(angle + Math.PI / 6);

                // Dessiner la flèche
                ctx.beginPath();
                ctx.moveTo(midX, midY);
                ctx.lineTo(arrowX1, arrowY1);
                ctx.lineTo(arrowX2, arrowY2);
                ctx.lineTo(midX, midY);
                ctx.fillStyle = child.data.first ? 'grey' : 'black';
                ctx.fill();
                ctx.closePath();
            });

        }

        // Retourne la position du nœud, pour relier parent/enfant
        return {x, y};
    }

    // On lance le dessin depuis la racine (0, 2π)
    drawNode(tree.root, 0, 2 * Math.PI, 0);
}
