export class TreeNode {
    constructor(x, y, type, first = false) {
        this.data = { x, y, type, first };
        this.children = [];
        this.alive = true;
    }

    // Ajouter un fils
    addChild(x, y, type, first = false) {
        const childNode = new TreeNode(x, y, type, first);
        this.children.push(childNode);
        return childNode;
    }

    kill() {
        this.alive = false;
        for (const child of this.children) {
            if(!child.data.first)
                child.kill();
        }
    }
}

export class Tree {
    constructor() {
        this.root = null;
        this.color = "#00ff00";
    }

    // Initialiser la racine de l'arbre
    setRoot(x, y, type, first = false) {
        this.root = new TreeNode(x, y, type, first);
    }

    // Trouver un nœud par ses coordonnées x, y
    findNodeByCoordinates(node, x, y) {
        if (!node) return null;

        if (node.data.x === x && node.data.y === y) {
            return node;
        }

        for (const child of node.children) {
            const result = this.findNodeByCoordinates(child, x, y);
            if (result) return result;
        }

        return null;
    }

    // Ajouter un fils à un parent spécifié par ses coordonnées x, y
    addChildToParent(parentX, parentY, x, y, type, first = false) {
        const parentNode = this.findNodeByCoordinates(this.root, parentX, parentY);

        if (!parentNode) {
            console.error(`Parent node with coordinates (${parentX}, ${parentY}) not found.`);
        }else
            parentNode.addChild(x, y, type, first);
    }

    // Afficher l'arbre (pour le débogage)
    print(node = this.root, level = 0) {
        if (!node) return;

        console.log(`${'  '.repeat(level)}Node: (${node.data.x}, ${node.data.y}), Type: ${node.data.type}, First: ${node.data.first}`);

        for (const child of node.children) {
            this.print(child, level + 1);
        }
    }
}


