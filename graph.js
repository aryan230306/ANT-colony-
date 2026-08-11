class Node {
    constructor(id, x, y, isNest = false, isFood = false) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.isNest = isNest;
        this.isFood = isFood;
        this.edges = [];
    }
}

class Edge {
    constructor(id, nodeA, nodeB, controlX, controlY) {
        this.id = id;
        this.nodeA = nodeA;
        this.nodeB = nodeB;
        
        // Control point for quadratic bezier
        this.cx = controlX;
        this.cy = controlY;
        
        this.pheromone = 0; // Starts at 0, no trail
        this.length = this.calculateLength();
        
        // Bidirectional edges
        nodeA.edges.push(this);
        nodeB.edges.push(this);
    }
    
    // Evaluate position on the curve at parameter t (0 to 1)
    getPoint(t) {
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        
        const x = uu * this.nodeA.x + 2 * u * t * this.cx + tt * this.nodeB.x;
        const y = uu * this.nodeA.y + 2 * u * t * this.cy + tt * this.nodeB.y;
        
        return { x, y };
    }
    
    // Get the tangent angle (direction) at parameter t
    getTangentAngle(t) {
        const dx = 2 * (1 - t) * (this.cx - this.nodeA.x) + 2 * t * (this.nodeB.x - this.cx);
        const dy = 2 * (1 - t) * (this.cy - this.nodeA.y) + 2 * t * (this.nodeB.y - this.cy);
        return Math.atan2(dy, dx);
    }
    
    calculateLength() {
        // Approximate arc length by sampling
        let len = 0;
        let prev = this.getPoint(0);
        const steps = 50;
        for (let i = 1; i <= steps; i++) {
            const pt = this.getPoint(i / steps);
            len += Math.hypot(pt.x - prev.x, pt.y - prev.y);
            prev = pt;
        }
        return len;
    }
}

class Graph {
    constructor(width, height) {
        this.nodes = [];
        this.edges = [];
        
        // Create standard fixed layout mirroring the reference image
        // Nest on left, Food on right
        const nestX = 100;
        const nestY = height - 100;
        const foodX = width - 150;
        const foodY = height / 2;
        
        const nestNode = new Node('nest', nestX, nestY, true, false);
        const foodNode = new Node('food', foodX, foodY, false, true);
        
        this.nodes.push(nestNode, foodNode);
        
        // We add 4 curved edges (Paths A, B, C, D)
        // Path A: Top, very curved, longest
        this.edges.push(new Edge('A', nestNode, foodNode, width * 0.4, -200));
        
        // Path B: Middle top
        this.edges.push(new Edge('B', nestNode, foodNode, width * 0.4, height * 0.3));
        
        // Path C: Middle bottom
        this.edges.push(new Edge('C', nestNode, foodNode, width * 0.6, height * 0.9));
        
        // Path D: Bottom, almost straight, shortest
        // Control point roughly exactly halfway on the straight line to make it linear
        this.edges.push(new Edge('D', nestNode, foodNode, (nestX + foodX)/2 + 20, (nestY + foodY)/2 + 20));
    }
}
