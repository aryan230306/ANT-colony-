class Ant {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = window.simSpeed || 1.5;
        this.hasFood = false;
        this.isResting = false;

        // Sensory parameters
        this.sensorAngle = Math.PI / 4;
        this.sensorDist = 24;

        // Animation
        this.legPhase = Math.random() * Math.PI * 2;

        // Stuck detection
        this.stuckCount = 0;
        this.lastX = x;
        this.lastY = y;
        
        // Path Memory (to remember route back home)
        this.pathMemory = [];
        this.frameCount = 0;
        
        // Unique color variation
        this.bodyHue = 15 + Math.random() * 10;
        this.bodyLight = 12 + Math.random() * 8;
    }

    sense(sim, grid, targetAngle) {
        const sx = this.x + Math.cos(targetAngle) * this.sensorDist;
        const sy = this.y + Math.sin(targetAngle) * this.sensorDist;
        return sim.getPheromone(grid, sx, sy);
    }

    // Find walkable directions (road-aware)
    findRoadDirections(sim) {
        const dirs = [];
        const step = 12; // Look further ahead to avoid getting stuck
        const margin = 5; // Keep a wider margin from obstacles
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
            const nx = this.x + Math.cos(a) * step;
            const ny = this.y + Math.sin(a) * step;
            const mx = this.x + Math.cos(a) * (step / 2); // Check midpoint too
            const my = this.y + Math.sin(a) * (step / 2);

            // Check the endpoint and midpoint, with margins
            if (!sim.isObstacle(nx, ny) && 
                !sim.isObstacle(nx + margin, ny) && 
                !sim.isObstacle(nx - margin, ny) && 
                !sim.isObstacle(nx, ny + margin) && 
                !sim.isObstacle(nx, ny - margin) &&
                !sim.isObstacle(mx, my)) {
                dirs.push(a);
            }
        }
        return dirs;
    }

    update(sim) {
        if (this.isResting) return;

        this.speed = window.simSpeed || 1.5;
        const exploreWeight = window.simExplore || 0.2;
        const turnSpeed = 0.3;

        const readGrid = this.hasFood ? sim.homeGrid : sim.foodGrid;
        const writeGrid = this.hasFood ? sim.foodGrid : sim.homeGrid;

        // Get available road directions
        const roadDirs = this.findRoadDirections(sim);

        if (roadDirs.length === 0) {
            // Stuck! Try random angles to escape
            this.angle += Math.PI / 2;
        } else {
            this.frameCount++;
            if (!this.hasFood && this.frameCount % 20 === 0) {
                // Remember path while exploring
                this.pathMemory.push({x: this.x, y: this.y});
            }

            // Sense pheromones along available road directions
            let bestAngle = this.angle;
            let bestWeight = -1;

            // Check current direction first (prefer continuing straight)
            const wCenter = this.sense(sim, readGrid, this.angle);
            const wLeft = this.sense(sim, readGrid, this.angle - this.sensorAngle);
            const wRight = this.sense(sim, readGrid, this.angle + this.sensorAngle);
            let totalWeight = wCenter + wLeft + wRight;

            // Only follow pheromones when searching for food. 
            // When returning, rely strictly on memory to avoid wandering.
            if (!this.hasFood && totalWeight > 0.001) {
                // Follow pheromone trail
                let pL = wLeft / totalWeight;
                let pC = wCenter / totalWeight;
                let pR = wRight / totalWeight;

                pL = pL * (1 - exploreWeight) + (exploreWeight / 3);
                pC = pC * (1 - exploreWeight) + (exploreWeight / 3);
                pR = pR * (1 - exploreWeight) + (exploreWeight / 3);

                let newTotal = pL + pC + pR;
                pL /= newTotal; pC /= newTotal; pR /= newTotal;

                let r = Math.random();
                if (r < pL) {
                    this.angle -= turnSpeed;
                } else if (r >= pL + pC) {
                    this.angle += turnSpeed;
                }
                // else keep straight
            } else {
                // No pheromone (or returning home): navigate towards target
                let targetX = sim.nest.x;
                let targetY = sim.nest.y;
                if (!this.hasFood && sim.foodSources.length > 0) {
                    // Pick the CLOSEST food source, not always the first one
                    let closestFood = sim.foodSources[0];
                    let closestDist = Math.hypot(this.x - closestFood.x, this.y - closestFood.y);
                    for (let i = 1; i < sim.foodSources.length; i++) {
                        let d = Math.hypot(this.x - sim.foodSources[i].x, this.y - sim.foodSources[i].y);
                        if (d < closestDist) {
                            closestDist = d;
                            closestFood = sim.foodSources[i];
                        }
                    }
                    targetX = closestFood.x;
                    targetY = closestFood.y;
                } else if (this.hasFood) {
                    // Retrace steps using path memory
                    while (this.pathMemory.length > 0) {
                        let lastPoint = this.pathMemory[this.pathMemory.length - 1];
                        if (Math.hypot(this.x - lastPoint.x, this.y - lastPoint.y) < 20) {
                            this.pathMemory.pop(); // Reached this waypoint, target the next one
                        } else {
                            targetX = lastPoint.x;
                            targetY = lastPoint.y;
                            break;
                        }
                    }
                }

                let angleToTarget = Math.atan2(targetY - this.y, targetX - this.x);

                // Find the road direction closest to the target direction
                let bestDiff = Infinity;
                for (let rd of roadDirs) {
                    let diff = rd - angleToTarget;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    if (Math.abs(diff) < Math.abs(bestDiff)) {
                        bestDiff = diff;
                        bestAngle = rd;
                    }
                }

                if (this.hasFood) {
                    // Strong bias toward target road when returning
                    this.angle = bestAngle + (Math.random() - 0.5) * 0.2;
                } else {
                    // Some exploration when searching
                    if (Math.random() < 0.7) {
                        this.angle = bestAngle + (Math.random() - 0.5) * 0.3;
                    } else {
                        // Random road direction for exploration
                        this.angle = roadDirs[Math.floor(Math.random() * roadDirs.length)];
                    }
                }
            }
        }

        // Tiny biological jitter
        this.angle += (Math.random() - 0.5) * 0.05;

        // Move
        let nx = this.x + Math.cos(this.angle) * this.speed;
        let ny = this.y + Math.sin(this.angle) * this.speed;

        // World bounds
        if (nx < 2 || nx >= sim.worldW - 2) {
            this.angle = Math.PI - this.angle;
            nx = Math.max(2, Math.min(nx, sim.worldW - 3));
        }
        if (ny < 2 || ny >= sim.worldH - 2) {
            this.angle = -this.angle;
            ny = Math.max(2, Math.min(ny, sim.worldH - 3));
        }

        // Check obstacle (building or rock) with a body margin
        const margin = 4;
        if (sim.isObstacle(nx, ny) || 
            sim.isObstacle(nx + margin, ny) || 
            sim.isObstacle(nx - margin, ny) || 
            sim.isObstacle(nx, ny + margin) || 
            sim.isObstacle(nx, ny - margin)) {
            
            // Fix: Push the ant BACKWARDS before reversing its angle
            this.x -= Math.cos(this.angle) * 10;
            this.y -= Math.sin(this.angle) * 10;
            
            // Now reverse and bounce to find another route
            this.angle += Math.PI + (Math.random() - 0.5); 
        } else {
            this.x = nx;
            this.y = ny;
        }

        // Deposit pheromones
        const depositAmount = window.simDeposit || 50;
        sim.addPheromone(writeGrid, this.x, this.y, depositAmount);

        // Check food arrival
        if (!this.hasFood) {
            for (let i = sim.foodSources.length - 1; i >= 0; i--) {
                let f = sim.foodSources[i];
                if (Math.hypot(this.x - f.x, this.y - f.y) < f.radius) {
                    this.hasFood = true;
                    this.angle += Math.PI;
                    // Track food pickups — vanish after 10
                    f.pickups = (f.pickups || 0) + 1;
                    if (f.pickups >= 10) {
                        sim.foodSources.splice(i, 1);
                    }
                    break;
                }
            }
        } else {
            // Check nest arrival
            if (Math.hypot(this.x - sim.nest.x, this.y - sim.nest.y) < sim.nest.radius) {
                this.hasFood = false;
                this.isResting = true;
                this.angle += Math.PI;
                this.pathMemory = []; // Clear memory for the next trip
            }
        }

        this.legPhase += this.speed * 0.5;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Ground shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(0, 1, 6, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();

        const bodyColor = `hsl(${this.bodyHue}, 30%, ${this.bodyLight}%)`;
        const legColor = `hsl(${this.bodyHue}, 25%, ${this.bodyLight + 5}%)`;

        ctx.strokeStyle = legColor;
        ctx.lineWidth = 1.0;
        ctx.lineCap = 'round';

        const lOff = Math.sin(this.legPhase) * 2;

        // 6 legs with curves
        ctx.beginPath();
        ctx.moveTo(2.5, -1.5); ctx.quadraticCurveTo(5, -4 - lOff, 7, -7 - lOff); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(2.5, 1.5); ctx.quadraticCurveTo(5, 4 + lOff, 7, 7 + lOff); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -1.8); ctx.quadraticCurveTo(1.5 + lOff, -5.5, 2.5 + lOff, -8.5); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 1.8); ctx.quadraticCurveTo(1.5 - lOff, 5.5, 2.5 - lOff, 8.5); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-3.5, -1.5); ctx.quadraticCurveTo(-5 - lOff, -5, -7.5 - lOff, -7); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-3.5, 1.5); ctx.quadraticCurveTo(-5 + lOff, 5, -7.5 + lOff, 7); ctx.stroke();

        // Body
        ctx.fillStyle = bodyColor;
        ctx.beginPath(); ctx.ellipse(-4.5, 0, 4, 3, 0, 0, Math.PI * 2); ctx.fill(); // Abdomen
        ctx.fillStyle = `hsl(${this.bodyHue}, 20%, ${this.bodyLight + 8}%)`;
        ctx.beginPath(); ctx.ellipse(-5, -0.8, 1.8, 1.2, -0.3, 0, Math.PI * 2); ctx.fill(); // Sheen
        ctx.fillStyle = bodyColor;
        ctx.beginPath(); ctx.ellipse(0, 0, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill(); // Thorax
        ctx.beginPath(); ctx.ellipse(3.5, 0, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill(); // Head

        // Eyes
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(4.8, -1, 0.6, 0, Math.PI * 2);
        ctx.arc(4.8, 1, 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Antennae
        ctx.strokeStyle = legColor;
        ctx.lineWidth = 0.7;
        const aWave = Math.sin(this.legPhase * 0.7) * 1.2;
        ctx.beginPath(); ctx.moveTo(5.5, -1.3); ctx.quadraticCurveTo(8, -2.5 + aWave, 9.5, -4 + aWave); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5.5, 1.3); ctx.quadraticCurveTo(8, 2.5 - aWave, 9.5, 4 - aWave); ctx.stroke();

        // Food crumb
        if (this.hasFood) {
            const cG = ctx.createRadialGradient(8, 0, 0.5, 8, 0, 2.5);
            cG.addColorStop(0, '#ffd966');
            cG.addColorStop(1, '#d4a017');
            ctx.fillStyle = cG;
            ctx.beginPath();
            ctx.arc(8, 0, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
