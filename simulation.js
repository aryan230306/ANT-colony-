class Simulation {
    constructor(canvas, width, height) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = width;
        this.height = height;

        // --- WORLD SIZE ---
        this.worldW = this.width;
        this.worldH = this.height;

        // --- CITY LAYOUT ---
        this.roadWidth = 36;
        this.blockSize = 130;
        this.cellSize = this.roadWidth + this.blockSize;

        // Grid for pheromones & obstacles
        this.scale = 4;
        this.gridW = Math.ceil(this.worldW / this.scale);
        this.gridH = Math.ceil(this.worldH / this.scale);
        this.numCells = this.gridW * this.gridH;

        // Pheromone Grids
        this.homeGrid = new Float32Array(this.numCells);
        this.foodGrid = new Float32Array(this.numCells);
        this.nextHomeGrid = new Float32Array(this.numCells);
        this.nextFoodGrid = new Float32Array(this.numCells);

        // MMAS
        this.tMin = 3.0;
        this.tMax = 200;

        // Obstacle Grid
        this.obstacles = new Uint8Array(this.numCells);

        // Trail overlay
        this.trailCanvas = document.createElement('canvas');
        this.trailCanvas.width = this.gridW;
        this.trailCanvas.height = this.gridH;
        this.trailCtx = this.trailCanvas.getContext('2d');
        this.trailImageData = this.trailCtx.createImageData(this.gridW, this.gridH);
        this.trailPixels = new Uint8ClampedArray(this.trailImageData.data.buffer);

        // Build road layout and cache city drawing
        this.buildCityGrid();
        this.cityCanvas = document.createElement('canvas');
        this.cityCanvas.width = this.worldW;
        this.cityCanvas.height = this.worldH;
        this.cityCtx = this.cityCanvas.getContext('2d');
        this.drawCityToCache();

        // Place nest and food (initially empty)
        this.nest = null;
        this.foodSources = [];

        this.ants = [];
        this.frame = 0;
    }

    // ---- ROAD GRID ----
    isRoadPixel(px, py) {
        const modX = px % this.cellSize;
        const modY = py % this.cellSize;
        return modX < this.roadWidth || modY < this.roadWidth;
    }

    buildCityGrid() {
        this.obstacles.fill(1);
        for (let py = 0; py < this.worldH; py++) {
            for (let px = 0; px < this.worldW; px++) {
                if (this.isRoadPixel(px, py)) {
                    const gx = Math.floor(px / this.scale);
                    const gy = Math.floor(py / this.scale);
                    if (gx >= 0 && gx < this.gridW && gy >= 0 && gy < this.gridH) {
                        this.obstacles[gy * this.gridW + gx] = 0;
                    }
                }
            }
        }
    }

    // ---- DRAW CITY (cached to offscreen canvas) ----
    drawCityToCache() {
        const ctx = this.cityCtx;
        const rw = this.roadWidth;
        const bs = this.blockSize;
        const cs = this.cellSize;

        // Background grass
        ctx.fillStyle = '#5a8f3d';
        ctx.fillRect(0, 0, this.worldW, this.worldH);

        // Draw building blocks
        const blockColors = [
            '#c0392b', '#e74c3c', '#d35400', '#e67e22', '#b8860b',
            '#8B4513', '#A0522D', '#CD853F', '#cc6633', '#bf4040'
        ];
        const roofHighlights = [
            '#e8695f', '#f19898', '#f0984d', '#f5b87a', '#daa520',
            '#a56432', '#c0764a', '#e0b090', '#dd8855', '#d06060'
        ];

        let blockIndex = 0;
        for (let by = 0; by < this.worldH; by += cs) {
            for (let bx = 0; bx < this.worldW; bx += cs) {
                const x = bx + rw;
                const y = by + rw;
                const w = Math.min(bs, this.worldW - x);
                const h = Math.min(bs, this.worldH - y);
                if (w <= 0 || h <= 0) continue;

                // Deterministic seed for this block
                const seed = (Math.floor(bx / cs) * 31 + Math.floor(by / cs) * 17) % 10;
                const isPark = seed === 2 || seed === 7; // ~20% parks

                if (isPark) {
                    // Green park
                    ctx.fillStyle = '#4a9e2f';
                    ctx.fillRect(x, y, w, h);
                    // Grass texture
                    ctx.fillStyle = '#3d8825';
                    for (let i = 0; i < 15; i++) {
                        const gx = x + ((seed * 37 + i * 53) % w);
                        const gy = y + ((seed * 19 + i * 41) % h);
                        ctx.fillRect(gx, gy, 6, 6);
                    }
                    // Trees
                    ctx.fillStyle = '#2d7a1a';
                    for (let i = 0; i < 6; i++) {
                        const tx = x + 15 + ((seed * 23 + i * 47) % (w - 30));
                        const ty = y + 15 + ((seed * 11 + i * 31) % (h - 30));
                        ctx.beginPath();
                        ctx.arc(tx, ty, 8 + (i % 3) * 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    // Tree trunks
                    ctx.fillStyle = '#5a3a1a';
                    for (let i = 0; i < 6; i++) {
                        const tx = x + 15 + ((seed * 23 + i * 47) % (w - 30));
                        const ty = y + 15 + ((seed * 11 + i * 31) % (h - 30));
                        ctx.fillRect(tx - 1.5, ty - 1.5, 3, 3);
                    }
                    // Pond in some parks
                    if (seed === 2) {
                        ctx.fillStyle = '#4aa8d8';
                        ctx.beginPath();
                        ctx.ellipse(x + w/2, y + h/2, 20, 14, 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#6bc4e8';
                        ctx.beginPath();
                        ctx.ellipse(x + w/2 - 3, y + h/2 - 3, 8, 5, -0.3, 0, Math.PI * 2);
                        ctx.fill();
                    }
                } else {
                    // Building block
                    const ci = (seed + blockIndex) % blockColors.length;
                    
                    // Building shadow
                    ctx.fillStyle = 'rgba(0,0,0,0.15)';
                    ctx.fillRect(x + 4, y + 4, w - 4, h - 4);
                    
                    // Main building
                    ctx.fillStyle = blockColors[ci];
                    ctx.fillRect(x + 2, y + 2, w - 8, h - 8);
                    
                    // Roof highlight
                    ctx.fillStyle = roofHighlights[ci];
                    ctx.fillRect(x + 4, y + 4, w - 14, 8);
                    
                    // Windows
                    ctx.fillStyle = 'rgba(180, 220, 255, 0.7)';
                    const winSize = 6;
                    const winGap = 14;
                    for (let wy = y + 18; wy < y + h - 16; wy += winGap) {
                        for (let wx = x + 10; wx < x + w - 16; wx += winGap) {
                            ctx.fillRect(wx, wy, winSize, winSize);
                        }
                    }
                    
                    // Building outline
                    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + 2, y + 2, w - 8, h - 8);
                }
                blockIndex++;
            }
        }

        // Draw roads
        ctx.fillStyle = '#707070';
        for (let y = 0; y < this.worldH; y += cs) {
            ctx.fillRect(0, y, this.worldW, rw); // Horizontal roads
        }
        for (let x = 0; x < this.worldW; x += cs) {
            ctx.fillRect(x, 0, rw, this.worldH); // Vertical roads
        }

        // Road markings (dashed center lines)
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 10]);
        // Horizontal road center lines
        for (let y = 0; y < this.worldH; y += cs) {
            ctx.beginPath();
            ctx.moveTo(0, y + rw / 2);
            ctx.lineTo(this.worldW, y + rw / 2);
            ctx.stroke();
        }
        // Vertical road center lines
        for (let x = 0; x < this.worldW; x += cs) {
            ctx.beginPath();
            ctx.moveTo(x + rw / 2, 0);
            ctx.lineTo(x + rw / 2, this.worldH);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // Crosswalks at intersections
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (let iy = 0; iy < this.worldH; iy += cs) {
            for (let ix = 0; ix < this.worldW; ix += cs) {
                // Horizontal crosswalk stripes (just past intersection)
                for (let s = 0; s < rw; s += 6) {
                    ctx.fillRect(ix + rw + 2, iy + s, 10, 3);
                    if (ix > 0) ctx.fillRect(ix - 12, iy + s, 10, 3);
                }
            }
        }

        // Sidewalks (thin strip at block edges)
        ctx.fillStyle = '#999';
        for (let by = 0; by < this.worldH; by += cs) {
            for (let bx = 0; bx < this.worldW; bx += cs) {
                const x = bx + rw;
                const y = by + rw;
                const w = Math.min(bs, this.worldW - x);
                const h = Math.min(bs, this.worldH - y);
                if (w <= 0 || h <= 0) continue;
                ctx.fillRect(x, y, w, 2);
                ctx.fillRect(x, y, 2, h);
                ctx.fillRect(x, y + h - 2, w, 2);
                ctx.fillRect(x + w - 2, y, 2, h);
            }
        }
    }



    // ---- PHEROMONE / OBSTACLE ----
    isObstacle(x, y) {
        const gx = Math.floor(x / this.scale);
        const gy = Math.floor(y / this.scale);
        if (gx < 0 || gx >= this.gridW || gy < 0 || gy >= this.gridH) return true;
        return this.obstacles[gy * this.gridW + gx] === 1;
    }

    addPheromone(grid, x, y, amount) {
        const gx = Math.floor(x / this.scale);
        const gy = Math.floor(y / this.scale);
        if (gx >= 0 && gx < this.gridW && gy >= 0 && gy < this.gridH) {
            let idx = gy * this.gridW + gx;
            grid[idx] = Math.max(0, Math.min(grid[idx] + amount, this.tMax));
        }
    }

    getPheromone(grid, x, y) {
        const gx = Math.floor(x / this.scale);
        const gy = Math.floor(y / this.scale);
        let sum = 0;
        for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
                let cx = gx + ox, cy = gy + oy;
                if (cx >= 0 && cx < this.gridW && cy >= 0 && cy < this.gridH) {
                    let idx = cy * this.gridW + cx;
                    if (this.obstacles[idx] !== 1) sum += grid[idx];
                }
            }
        }
        return sum;
    }

    diffuseAndEvaporate() {
        const evapRate = window.simEvap || 0.001;
        for (let y = 1; y < this.gridH - 1; y++) {
            for (let x = 1; x < this.gridW - 1; x++) {
                const idx = y * this.gridW + x;
                if (this.obstacles[idx] === 1) {
                    this.nextHomeGrid[idx] = 0;
                    this.nextFoodGrid[idx] = 0;
                    continue;
                }
                let sH = 0, sF = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const ni = (y+dy)*this.gridW + (x+dx);
                        sH += this.homeGrid[ni];
                        sF += this.foodGrid[ni];
                    }
                }
                let bH = this.homeGrid[idx] * 0.98 + (sH/9) * 0.02;
                let bF = this.foodGrid[idx] * 0.98 + (sF/9) * 0.02;
                let nH = bH * (1 - evapRate);
                let nF = bF * (1 - evapRate);
                if (bH > this.tMin) nH = Math.max(nH, this.tMin);
                if (bF > this.tMin) nF = Math.max(nF, this.tMin);
                this.nextHomeGrid[idx] = Math.min(nH, this.tMax);
                this.nextFoodGrid[idx] = Math.min(nF, this.tMax);
            }
        }
        let t;
        t = this.homeGrid; this.homeGrid = this.nextHomeGrid; this.nextHomeGrid = t;
        t = this.foodGrid; this.foodGrid = this.nextFoodGrid; this.nextFoodGrid = t;
    }

    spawnOneAnt() {
        if (!this.nest) return;
        let restingAnt = this.ants.find(a => a.isResting);
        if (restingAnt) {
            restingAnt.isResting = false;
        } else {
            this.ants.push(new Ant(this.nest.x, this.nest.y));
        }
    }

    setNest(x, y) {
        // Snap to nearest road center
        const cs = this.cellSize;
        const rw = this.roadWidth;
        const snapX = Math.round(x / cs) * cs + rw / 2;
        const snapY = Math.round(y / cs) * cs + rw / 2;
        this.nest = { x: snapX, y: snapY, radius: 14 };
    }

    addFood(x, y) {
        // Snap to nearest road center
        const cs = this.cellSize;
        const rw = this.roadWidth;
        const snapX = Math.round(x / cs) * cs + rw / 2;
        const snapY = Math.round(y / cs) * cs + rw / 2;
        this.foodSources.push({ x: snapX, y: snapY, radius: 14 });
    }

    addObstacle(x, y, radius = 22) {
        // Draw a rock on the city cache
        const ctx = this.cityCtx;
        ctx.save();
        ctx.translate(x, y);
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;
        
        ctx.beginPath();
        const pts = 8;
        for (let i = 0; i < pts; i++) {
            const angle = (i / pts) * Math.PI * 2;
            const r = radius * (0.8 + Math.random() * 0.4); // Jagged edge
            ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        
        // Rock gradient
        const rg = ctx.createRadialGradient(-radius*0.3, -radius*0.3, 0, 0, 0, radius);
        rg.addColorStop(0, '#888');
        rg.addColorStop(1, '#444');
        ctx.fillStyle = rg;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#333';
        ctx.stroke();
        
        // Crack details
        ctx.beginPath();
        ctx.moveTo(-radius*0.5, -radius*0.2);
        ctx.lineTo(0, radius*0.1);
        ctx.lineTo(radius*0.4, radius*0.6);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();

        const gx = Math.floor(x / this.scale);
        const gy = Math.floor(y / this.scale);
        const rc = Math.ceil(radius / this.scale);
        for (let dy = -rc; dy <= rc; dy++) {
            for (let dx = -rc; dx <= rc; dx++) {
                if (dx*dx + dy*dy <= rc*rc) {
                    const cx = gx+dx, cy = gy+dy;
                    if (cx >= 0 && cx < this.gridW && cy >= 0 && cy < this.gridH) {
                        this.obstacles[cy * this.gridW + cx] = 1;
                    }
                }
            }
        }
    }

    update() {
        this.frame++;
        this.diffuseAndEvaporate();
        for (let ant of this.ants) ant.update(this);
    }

    clear() {
        this.ants = [];
        this.homeGrid.fill(0);
        this.foodGrid.fill(0);
        this.nextHomeGrid.fill(0);
        this.nextFoodGrid.fill(0);
    }

    clearObstacles() {
        this.buildCityGrid();
        this.drawCityToCache();
    }

    // ---- DRAW ----
    drawLaddoo(x, y, r) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x+1, y+r*0.5, r*0.7, r*0.25, 0, 0, Math.PI*2);
        ctx.fill();
        const g = ctx.createRadialGradient(x-r*0.2, y-r*0.2, r*0.1, x, y, r);
        g.addColorStop(0, '#ffd966');
        g.addColorStop(0.5, '#f5c542');
        g.addColorStop(1, '#b8860b');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,230,0.4)';
        ctx.beginPath();
        ctx.ellipse(x-r*0.2, y-r*0.25, r*0.25, r*0.18, -0.5, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }

    drawNest(x, y, r) {
        const ctx = this.ctx;
        const mg = ctx.createRadialGradient(x, y, r*0.2, x, y, r*1.4);
        mg.addColorStop(0, 'rgba(50,30,10,0.9)');
        mg.addColorStop(0.6, 'rgba(70,45,20,0.5)');
        mg.addColorStop(1, 'rgba(70,45,20,0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(x, y, r*1.4, 0, Math.PI*2);
        ctx.fill();
        const hg = ctx.createRadialGradient(x, y, 0, x, y, r*0.5);
        hg.addColorStop(0, '#050302');
        hg.addColorStop(1, '#1a1008');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(x, y, r*0.5, 0, Math.PI*2);
        ctx.fill();
    }

    draw() {
        const ctx = this.ctx;
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.save();

        // 1. Cached city map
        ctx.drawImage(this.cityCanvas, 0, 0);

        // 2. Pheromone trails
        const data = this.trailPixels;
        for (let i = 0; i < this.numCells; i++) {
            const pi = i * 4;
            if (this.obstacles[i] === 1) {
                data[pi] = 0; data[pi+1] = 0; data[pi+2] = 0; data[pi+3] = 0;
            } else {
                let intensity = Math.max(this.homeGrid[i], this.foodGrid[i]);
                if (intensity > 0.05) {
                    let alpha = Math.min(230, intensity * 22);
                    let r, g, b;
                    if (intensity > 8) {
                        r = 255; g = 70 + Math.floor(Math.min(60, intensity*0.4)); b = 170;
                    } else {
                        r = 240; g = 120; b = 170;
                        alpha = Math.max(80, alpha);
                    }
                    if (intensity > 25 && this.frame % 3 === 0 && ((i*7+this.frame) % 47) < 2) {
                        r = 255; g = 230; b = 245; alpha = 255;
                    }
                    data[pi] = r; data[pi+1] = g; data[pi+2] = b; data[pi+3] = Math.floor(alpha);
                } else {
                    data[pi] = 0; data[pi+1] = 0; data[pi+2] = 0; data[pi+3] = 0;
                }
            }
        }
        this.trailCtx.putImageData(this.trailImageData, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(this.trailCanvas, 0, 0, this.worldW, this.worldH);

        // 3. Nest
        if (this.nest) {
            this.drawNest(this.nest.x, this.nest.y, this.nest.radius);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('🏠 Nest', this.nest.x, this.nest.y - this.nest.radius - 5);
        }

        // 4. Food
        for (let f of this.foodSources) {
            this.drawLaddoo(f.x, f.y, f.radius);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('🍬 Laddoo', f.x, f.y - f.radius - 5);
        }

        // 5. Ants
        for (let ant of this.ants) ant.draw(ctx);

        ctx.restore();
    }
}
