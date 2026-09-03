const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const btnShowUI = document.getElementById('btnShowUI');
const uiPanel = document.getElementById('uiPanel');
const btnHideUI = document.getElementById('btnHideUI');
const numCitiesInput = document.getElementById('numCities');
const btnGenerate = document.getElementById('btnGenerate');
const popSizeInput = document.getElementById('popSize');
const popSizeVal = document.getElementById('popSizeVal');
const mutationRateInput = document.getElementById('mutationRate');
const mutationRateVal = document.getElementById('mutationRateVal');
const btnStart = document.getElementById('btnStart');
const btnPause = document.getElementById('btnPause');
const btnClear = document.getElementById('btnClear');
const bestDistanceEl = document.getElementById('bestDistance');
const iterationCountEl = document.getElementById('iterationCount');

// Global State
let width, height;
let cities = [];
let distances = [];
let population = [];
let bestTour = [];
let bestDistance = Infinity;
let isRunning = false;
let animationId = null;
let generations = 0;

// GA Parameters
let popSize = 100;
let mutationRate = 0.05;

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    draw();
}

window.addEventListener('resize', resize);
resize();

// UI Event Listeners
btnShowUI.addEventListener('click', () => {
    uiPanel.classList.remove('hidden');
    btnShowUI.classList.add('hidden');
});

btnHideUI.addEventListener('click', () => {
    uiPanel.classList.add('hidden');
    btnShowUI.classList.remove('hidden');
});

document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'h') {
        if (uiPanel.classList.contains('hidden')) {
            uiPanel.classList.remove('hidden');
            btnShowUI.classList.add('hidden');
        } else {
            uiPanel.classList.add('hidden');
            btnShowUI.classList.remove('hidden');
        }
    }
});

// Update input labels
if (popSizeInput && mutationRateInput) {
    [
        [popSizeInput, popSizeVal, '', parseInt],
        [mutationRateInput, mutationRateVal, '%', (v) => (parseFloat(v) * 100).toFixed(0)]
    ].forEach(([input, valEl, suffix, transform]) => {
        input.addEventListener('input', () => {
            const val = transform ? transform(input.value) : input.value;
            valEl.textContent = val + suffix;
            updateParams();
        });
    });
}

function updateParams() {
    if (popSizeInput) popSize = parseInt(popSizeInput.value);
    if (mutationRateInput) mutationRate = parseFloat(mutationRateInput.value);
}

// Interacting with Canvas
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    addCity(x, y);
    resetGA();
    draw();
});

btnGenerate.addEventListener('click', () => {
    const n = parseInt(numCitiesInput.value);
    generateRandomCities(n);
});

btnStart.addEventListener('click', () => {
    if (cities.length < 3) {
        alert("Please add at least 3 cities.");
        return;
    }
    if (!isRunning) {
        isRunning = true;
        btnStart.textContent = "Restart Search";
        if (population.length === 0) {
            initGA();
        }
        loop();
    } else {
        // Restart
        resetGA();
        initGA();
    }
});

btnPause.addEventListener('click', () => {
    isRunning = false;
    if (animationId) cancelAnimationFrame(animationId);
    btnStart.textContent = "Resume Search";
});

btnClear.addEventListener('click', () => {
    isRunning = false;
    if (animationId) cancelAnimationFrame(animationId);
    cities = [];
    bestTour = [];
    bestDistance = Infinity;
    generations = 0;
    population = [];
    updateStats();
    btnStart.textContent = "Start Search";
    draw();
});

// TSP Logic
function addCity(x, y) {
    cities.push({ x, y });
}

function generateRandomCities(n) {
    cities = [];
    const paddingX = 50;
    const paddingBottom = 50;
    const paddingTop = 120; // Increased top padding to avoid the top UI bar
    for (let i = 0; i < n; i++) {
        cities.push({
            x: paddingX + Math.random() * (width - 2 * paddingX),
            y: paddingTop + Math.random() * (height - paddingTop - paddingBottom)
        });
    }
    resetGA();
    draw();
}

function calculateDistanceMatrix() {
    const n = cities.length;
    distances = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i !== j) {
                const dx = cities[i].x - cities[j].x;
                const dy = cities[i].y - cities[j].y;
                distances[i][j] = Math.hypot(dx, dy);
            }
        }
    }
}

function calcTourDistance(tour) {
    let d = 0;
    for (let i = 0; i < tour.length; i++) {
        const from = tour[i];
        const to = tour[(i + 1) % tour.length];
        d += distances[from][to];
    }
    return d;
}

function resetGA() {
    bestDistance = Infinity;
    bestTour = [];
    generations = 0;
    population = [];
    if (cities.length > 1) {
        calculateDistanceMatrix();
    }
    updateStats();
}

function initGA() {
    const n = cities.length;
    population = [];
    // Create base array [0, 1, ..., n-1]
    const baseTour = Array.from({length: n}, (_, i) => i);
    
    for (let i = 0; i < popSize; i++) {
        // Shuffle to create a random tour
        const tour = [...baseTour];
        for (let k = tour.length - 1; k > 0; k--) {
            const j = Math.floor(Math.random() * (k + 1));
            [tour[k], tour[j]] = [tour[j], tour[k]];
        }
        population.push(tour);
    }
    evaluatePopulation();
}

function evaluatePopulation() {
    for (let i = 0; i < popSize; i++) {
        const d = calcTourDistance(population[i]);
        if (d < bestDistance) {
            bestDistance = d;
            bestTour = [...population[i]];
        }
    }
    updateStats();
}

function tournamentSelection() {
    // Select 3 random individuals, return the best
    let bestIdx = Math.floor(Math.random() * popSize);
    let bestFit = calcTourDistance(population[bestIdx]);
    
    for(let i=0; i<2; i++) {
        const idx = Math.floor(Math.random() * popSize);
        const fit = calcTourDistance(population[idx]);
        if (fit < bestFit) {
            bestFit = fit;
            bestIdx = idx;
        }
    }
    return population[bestIdx];
}

function crossover(parent1, parent2) {
    const start = Math.floor(Math.random() * parent1.length);
    const end = Math.floor(Math.random() * parent1.length);
    const min = Math.min(start, end);
    const max = Math.max(start, end);

    const child = Array(parent1.length).fill(-1);
    
    // Copy sub-array from parent1
    for (let i = min; i <= max; i++) {
        child[i] = parent1[i];
    }

    // Fill the rest from parent2 in order
    let p2Index = 0;
    for (let i = 0; i < child.length; i++) {
        if (child[i] === -1) {
            while (child.includes(parent2[p2Index])) {
                p2Index++;
            }
            child[i] = parent2[p2Index];
        }
    }
    return child;
}

function mutate(tour) {
    if (Math.random() < mutationRate) {
        const i = Math.floor(Math.random() * tour.length);
        const j = Math.floor(Math.random() * tour.length);
        [tour[i], tour[j]] = [tour[j], tour[i]];
    }
}

function nextGeneration() {
    if (cities.length < 3) return;
    
    const newPopulation = [];
    
    // Elitism: carry over the best tour unconditionally
    newPopulation.push([...bestTour]);

    for (let i = 1; i < popSize; i++) {
        const parent1 = tournamentSelection();
        const parent2 = tournamentSelection();
        
        const child = crossover(parent1, parent2);
        mutate(child);
        
        newPopulation.push(child);
    }

    population = newPopulation;
    evaluatePopulation();
    generations++;
}

function updateStats() {
    bestDistanceEl.textContent = bestDistance === Infinity ? '∞' : Math.round(bestDistance);
    iterationCountEl.textContent = generations;
}

// Rendering
function draw() {
    ctx.clearRect(0, 0, width, height);

    if (cities.length < 2) {
        drawCities();
        return;
    }

    // Draw some population paths in the background to show exploration
    if (population.length > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        // Just draw a few so it's not messy
        for(let i = 0; i < Math.min(20, population.length); i++) {
            const tour = population[i];
            ctx.beginPath();
            ctx.moveTo(cities[tour[0]].x, cities[tour[0]].y);
            for (let j = 1; j < tour.length; j++) {
                ctx.lineTo(cities[tour[j]].x, cities[tour[j]].y);
            }
            ctx.lineTo(cities[tour[0]].x, cities[tour[0]].y);
            ctx.stroke();
        }
    }

    // Draw best tour
    if (bestTour.length === cities.length) {
        ctx.beginPath();
        ctx.moveTo(cities[bestTour[0]].x, cities[bestTour[0]].y);
        for (let i = 1; i < cities.length; i++) {
            ctx.lineTo(cities[bestTour[i]].x, cities[bestTour[i]].y);
        }
        ctx.lineTo(cities[bestTour[0]].x, cities[bestTour[0]].y);
        ctx.strokeStyle = '#ff2a85';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    drawCities();
}

function drawCities() {
    // Map city original index to its order in the best tour
    let orderMap = {};
    if (bestTour.length === cities.length) {
        for (let j = 0; j < bestTour.length; j++) {
            orderMap[bestTour[j]] = j;
        }
    } else {
        for (let j = 0; j < cities.length; j++) {
            orderMap[j] = j;
        }
    }

    for (let i = 0; i < cities.length; i++) {
        ctx.beginPath();
        ctx.arc(cities[i].x, cities[i].y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ff7eb3';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = 'white';
        ctx.font = '10px Inter';
        ctx.fillText(orderMap[i], cities[i].x + 8, cities[i].y - 8);
    }
}

function loop() {
    if (!isRunning) return;
    
    // Do a few generations per frame
    for(let i=0; i<3; i++) {
        nextGeneration();
    }
    draw();
    
    animationId = requestAnimationFrame(loop);
}

// Initialize
updateParams();
// Generate initial cities so it's not blank
generateRandomCities(15);
