document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('simCanvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const sim = new Simulation(canvas, canvas.width, canvas.height);

    // UI Elements
    const antCountVal = document.getElementById('antCountVal');
    const btnDeploy = document.getElementById('btnDeploy');
    const evapRateSlider = document.getElementById('evaporationRate');
    const evapRateVal = document.getElementById('evaporationRateVal');
    const exploreSlider = document.getElementById('exploreWeight');
    const exploreVal = document.getElementById('exploreWeightVal');
    const depositSlider = document.getElementById('depositAmount');
    const depositVal = document.getElementById('depositAmountVal');
    const antSpeedSlider = document.getElementById('antSpeed');
    const antSpeedVal = document.getElementById('antSpeedVal');

    const clickModes = document.getElementsByName('clickMode');

    const btnPause = document.getElementById('btnPause');
    const btnReset = document.getElementById('btnReset');
    const btnClearObs = document.getElementById('btnClearObs');
    const btnShowUI = document.getElementById('btnShowUI');
    const btnHideUI = document.getElementById('btnHideUI');
    const uiPanel = document.getElementById('uiPanel');

    let isPaused = false;

    // Globals for ant.js / simulation.js
    window.simEvap = parseFloat(evapRateSlider.value);
    window.simExplore = parseFloat(exploreSlider.value);
    window.simDeposit = parseFloat(depositSlider.value);
    window.simSpeed = parseFloat(antSpeedSlider.value);

    // --- Event Listeners ---
    btnDeploy.addEventListener('click', () => {
        if (!sim.nest) {
            alert("Please place a Nest first by selecting 'Nest' and clicking on the road!");
            return;
        }
        sim.spawnOneAnt();
    });

    evapRateSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        evapRateVal.textContent = (val * 100).toFixed(1) + '%';
        window.simEvap = val;
    });

    exploreSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        exploreVal.textContent = Math.round(val * 100) + '%';
        window.simExplore = val;
    });

    depositSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        depositVal.textContent = val;
        window.simDeposit = val;
    });

    antSpeedSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        antSpeedVal.textContent = val.toFixed(1);
        window.simSpeed = val;
    });

    canvas.addEventListener('mousedown', (e) => {
        // Normal left-click: place food or obstacle
        if (e.button === 0) {
            isDragging = true;
            handleCanvasInteraction(e);
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            handleCanvasInteraction(e);
        }
    });

    window.addEventListener('mouseup', (e) => {
        isDragging = false;
    });

    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // --- Canvas interaction (food/obstacle placement) ---
    let isDragging = false;

    function handleCanvasInteraction(e) {
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        let mode = 'food';
        for (let radio of clickModes) {
            if (radio.checked) mode = radio.value;
        }

        if (mode === 'nest') {
            if (e.type === 'mousedown') {
                sim.setNest(sx, sy);
            }
        } else if (mode === 'food') {
            if (e.type === 'mousedown') {
                sim.addFood(sx, sy);
            }
        } else if (mode === 'obstacle') {
            sim.addObstacle(sx, sy, 22);
        }
    }

    // --- Buttons ---
    btnPause.addEventListener('click', () => {
        isPaused = !isPaused;
        btnPause.textContent = isPaused ? 'Resume' : 'Pause';
    });

    btnReset.addEventListener('click', () => { sim.clear(); });
    btnClearObs.addEventListener('click', () => { sim.clearObstacles(); });

    function hideUI() {
        uiPanel.classList.add('hidden');
        btnShowUI.classList.remove('hidden');
    }
    function showUI() {
        uiPanel.classList.remove('hidden');
        btnShowUI.classList.add('hidden');
    }
    btnShowUI.addEventListener('click', showUI);
    btnHideUI.addEventListener('click', hideUI);

    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'h') {
            if (uiPanel.classList.contains('hidden')) showUI();
            else hideUI();
        }
    });

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        sim.width = canvas.width;
        sim.height = canvas.height;
    });

    // --- Main loop ---
    function loop() {
        if (!isPaused) {
            sim.update();
            antCountVal.textContent = sim.ants.filter(a => !a.isResting).length;
        }
        sim.draw();
        requestAnimationFrame(loop);
    }
    loop();
});
