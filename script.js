// 📍 INICIO DE SCRIPT ANTI-CACHÉ
(function() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            if (registrations.length) {
                console.log('[ANTI-CACHE] Des-registrando Service Workers...');
                for(let registration of registrations) { registration.unregister(); }
                console.log('[ANTI-CACHE] Service Workers eliminados. Recargando...');
                location.reload(true);
            } else { console.log('[ANTI-CACHE] No se encontraron Service Workers.'); }
        });
    }
    if (window.caches) {
        caches.keys().then(function(names) {
            for (let name of names) {
                console.log('[ANTI-CACHE] Eliminando caché:', name);
                caches.delete(name);
            }
        });
    }
})();

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzOf3crQxBdPylwMTAd34W-nBShN31MkIUtaMdKsZHMZVVniI2HjMesD6DpOlO363T1/exec";

// --- Variables Globales ---
let isRunning = false;
let currentFilter = 'none'; 
let scanSpeed = 0; 

// Elementos del DOM
const mainViewArea = document.getElementById('main-view-area');
const videoBg = document.getElementById('bg-camera-feed');
const mainFilterCanvas = document.getElementById('main-filter-canvas');
let mainFilterCtx; 

const micStatus = document.getElementById('mic-status');
const magStatus = document.getElementById('mag-status');
const proxStatus = document.getElementById('prox-status');

let energyHistory = new Array(50).fill(0);
let energyCanvas, energyCtx;

// Audio
let audioCtx, masterGain;
let audioSource_Fondo1, gain_Fondo1, audioBuffer_Fondo1;
let audioSource_Fondo2, gain_Fondo2, audioBuffer_Fondo2;
let reverb, reverbGain, distortionNode;
let scanTimer = null; 

// Voz y Sensores
let isSpeaking = false; 
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition, isRecognizing = false;
let programadoData = new Map();
let automaticoData = [];
let currentTemp = 19.8;
let proximitySensor, magnetometer, orientationSensor;
let emfValue = 0;
let emfSimInterval = null;
let visualLoopInterval; 

// IA (SLS)
let poseDetector; 
let latestPoses = []; 
let isDetectingPose = false; 

// Estado de UI
let spiritBoxState = "OFF";
let spiritBoxTimeout = null;
let uiVisible = false; // El UI flotante está oculto al inicio
let uiHideTimeout = null;
let panelVisible = true; // El panel L está visible al inicio

// Gestos
let zoom = 1.0;
let maxZoom = 5.0;
let initialPinchDist = 0;
let isPinching = false;

// Cámara
let videoTrack;
let isTorchOn = false;
let lastFrameTime = 0;
let frameCount = 0;
let lastFpsUpdate = 0;

// --- Funciones de Inicialización ---

async function startCamera() {
    // 📍 CORRECCIÓN CRÍTICA: Envolver en una Promesa para que window.onload funcione
    return new Promise(async (resolve, reject) => {
        try {
            const constraints = {
                video: {
                    facingMode: { ideal: "environment" },
                    width: { ideal: 4096 }, 
                    height: { ideal: 2160 },
                    frameRate: { ideal: 60 }
                },
                audio: false
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            videoTrack = stream.getVideoTracks()[0]; 
            
            if (videoTrack && typeof videoTrack.applyConstraints === 'function') {
                videoTrack.applyConstraints({
                    advanced: [{ focusMode: 'continuous' }]
                }).catch(e => console.warn("No se pudo aplicar 'focusMode: continuous'", e));
                
                const capabilities = videoTrack.getCapabilities();
                if (!capabilities.torch) {
                    document.getElementById('hud-torch-button').style.display = 'none';
                }
            }
            
            videoBg.srcObject = stream;
            
            videoBg.onloadedmetadata = () => {
                // Asignar canvas de energía AQUÍ
                energyCanvas = document.getElementById('energy-canvas');
                if (energyCanvas) { 
                    energyCtx = energyCanvas.getContext('2d');
                }
                
                // Asignar canvas de filtro AQUÍ
                mainFilterCtx = mainFilterCanvas.getContext('2d', { willReadFrequently: true });
                
                resizeAllCanvas(); 
                
                try {
                    const settings = videoTrack.getSettings();
                    const res = settings.height || videoBg.videoHeight;
                    document.getElementById('cam-res').innerText = `${res}`;
                } catch(e) {
                    document.getElementById('cam-res').innerText = `${videoBg.videoHeight}`;
                }
                
                drawLoop(); 
                resolve(); // ¡LA CORRECCIÓN! Indicar que la cámara está lista
            };
        } catch (e) { 
            console.error("Error de cámara, la app no puede iniciar", e); 
            document.getElementById('loading-text').innerText = "ERROR DE CÁMARA";
            reject(e); // Rechazar la promesa
        }
    });
}

function resizeAllCanvas() {
    const w = mainViewArea.clientWidth; 
    const h = mainViewArea.clientHeight; 
    
    if (mainFilterCanvas) {
        mainFilterCanvas.width = w;
        mainFilterCanvas.height = h;
    }
    
    if(energyCanvas) {
        resizeEnergyCanvas();
    }
}

async function initMLModel() {
    try {
        const model = poseDetection.SupportedModels.MoveNet;
        const detectorConfig = {
            modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING,
            maxPoses: 6 
        };
        poseDetector = await poseDetection.createDetector(model, detectorConfig);
        console.log("MoveNet (IA Multi-Pose) cargado.");
    } catch (e) {
        console.error("Error al cargar modelo de IA:", e);
    }
}

// --- Bucles de Dibujo y Detección ---

async function drawLoop() {
    const now = performance.now();
    frameCount++;
    if (now - lastFpsUpdate > 1000) {
        const fps = frameCount;
        document.getElementById('cam-fps').innerText = fps;
        frameCount = 0;
        lastFpsUpdate = now;
    }

    if (mainFilterCanvas.style.display === 'block' && latestPoses && mainFilterCtx) {
        const w = mainFilterCanvas.width;
        const h = mainFilterCanvas.height;
        mainFilterCtx.clearRect(0, 0, w, h);
        drawAllSkeletons(latestPoses); 
    }
    
    requestAnimationFrame(drawLoop);
}

async function detectPoseLoop() {
    while (true) {
        if (currentFilter === 'sls' && poseDetector && videoBg.readyState === videoBg.HAVE_ENOUGH_DATA) {
            if (!isDetectingPose) {
                isDetectingPose = true;
                const poses = await poseDetector.estimatePoses(videoBg); 
                latestPoses = poses; 
                isDetectingPose = false;
            }
            await new Promise(r => setTimeout(r, 100)); // 10 FPS
        } else {
            latestPoses = []; 
            await new Promise(r => setTimeout(r, 500));
        }
    }
}

// 📍 CORRECCIÓN SLS (P3): Colores hardcodeados
const confidenceThreshold = 0.3; 
const skeletonMap = [
    ['left_shoulder', 'right_shoulder'], ['left_shoulder', 'left_elbow'],
    ['left_elbow', 'left_wrist'], ['right_shoulder', 'right_elbow'],
    ['right_elbow', 'right_wrist'], ['left_shoulder', 'left_hip'],
    ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'],
    ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
    ['right_hip', 'right_knee'], ['right_knee', 'right_ankle']
];

function drawAllSkeletons(poses) {
    const ctx = mainFilterCtx; 
    ctx.strokeStyle = '#39FF14'; // VERDE NEÓN
    ctx.fillStyle = '#FF3333';   // ROJO ALERTA
    ctx.lineWidth = 4;           // MÁS GRUESAS
    ctx.filter = 'drop-shadow(0 0 6px #39FF14)'; // BRILLO VERDE

    const videoW = videoBg.videoWidth;
    const videoH = videoBg.videoHeight;
    const canvasW = mainFilterCanvas.width;
    const canvasH = mainFilterCanvas.height;
    
    const videoAspect = videoW / videoH;
    const canvasAspect = canvasW / canvasH;
    
    let scale, offsetX, offsetY;
    
    if (canvasAspect > videoAspect) {
        scale = canvasW / videoW;
        offsetX = 0;
        offsetY = (canvasH - videoH * scale) / 2;
    } else {
        scale = canvasH / videoH;
        offsetX = (canvasW - videoW * scale) / 2;
        offsetY = 0;
    }

    poses.forEach(pose => {
        if (pose.score > confidenceThreshold) {
            drawKeypoints(pose.keypoints, scale, offsetX, offsetY);
            drawConnections(pose.keypoints, scale, offsetX, offsetY);
        }
    });
    ctx.filter = 'none';
}

function drawKeypoints(keypoints, scale, offsetX, offsetY) {
    const ctx = mainFilterCtx;
    for (let i = 0; i < keypoints.length; i++) {
        const keypoint = keypoints[i];
        if (keypoint.score > confidenceThreshold) {
            ctx.beginPath();
            ctx.arc(keypoint.x * scale + offsetX, keypoint.y * scale + offsetY, 5, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

function drawConnections(keypoints, scale, offsetX, offsetY) {
    const ctx = mainFilterCtx;
    const keypointMap = new Map();
    keypoints.forEach(keypoint => keypointMap.set(keypoint.name, keypoint));

    skeletonMap.forEach(connection => {
        const start = keypointMap.get(connection[0]);
        const end = keypointMap.get(connection[1]);
        if (start && end && start.score > confidenceThreshold && end.score > confidenceThreshold) {
            ctx.beginPath();
            ctx.moveTo(start.x * scale + offsetX, start.y * scale + offsetY);
            ctx.lineTo(end.x * scale + offsetX, end.y * scale + offsetY);
            ctx.stroke();
        }
    });
}

// --- Funciones de UI (Lógica de Botones) ---

function setFilter(f) {
    event.stopPropagation(); 
    document.querySelectorAll('.filter-btn').forEach(b => {
        if (b.id !== 'btn-panel') {
            b.classList.remove('active');
        }
    });
    
    mainViewArea.classList.remove('filter-vno', 'filter-neg');
    mainFilterCanvas.style.display = 'none';
    
    if (currentFilter === f) {
        currentFilter = 'none'; 
    } else {
        currentFilter = f;
        if (f === 'vno') {
            mainViewArea.classList.add('filter-vno');
        } else if (f === 'neg') {
            mainViewArea.classList.add('filter-neg');
        } else if (f === 'sls') {
            mainFilterCanvas.style.display = 'block';
        }
        const targetBtn = event ? event.target.closest('.filter-btn') : null;
        if(targetBtn) targetBtn.classList.add('active');
    }
    
    resetHideUITimer();
}

async function toggleTorch(event) {
    event.stopPropagation(); 
    
    if (!videoTrack || typeof videoTrack.applyConstraints !== 'function') {
        document.getElementById('hud-torch-button').style.display = 'none';
        return;
    }
    try {
        isTorchOn = !isTorchOn;
        await videoTrack.applyConstraints({ advanced: [{ torch: isTorchOn }] });
        document.getElementById('hud-torch-button').classList.toggle('active', isTorchOn);
    } catch (e) {
        console.error("Error al activar linterna:", e);
        isTorchOn = false; 
        document.getElementById('hud-torch-button').classList.toggle('active', false);
        document.getElementById('hud-torch-button').style.display = 'none';
    }
    
    resetHideUITimer();
}

// Botón del Panel (PAN)
function togglePanel(event) {
    event.stopPropagation();
    const btn = document.getElementById('btn-panel');
    panelVisible = !panelVisible; // Invertir estado
    
    document.body.classList.toggle('panels-hidden', !panelVisible);
    btn.classList.toggle('active', !panelVisible); // Se activa cuando los paneles están OCULTOS
    
    setTimeout(resizeAllCanvas, 500); 
    resetHideUITimer();
}

// --- Lógica de Audio (Sin cambios) ---
async function loadAudio(url) {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await audioCtx.decodeAudioData(arrayBuffer);
    } catch (e) { console.error(`Error cargando audio: ${url}`, e); throw e; }
}
async function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    try {
        updateLoadingProgress(55, "CARGANDO AUDIO...");
        [audioBuffer_Fondo1, audioBuffer_Fondo2] = await Promise.all([
            loadAudio('FONDO_1.mp3'),
            loadAudio('FONDO_2.mp3')
        ]);
        updateLoadingProgress(65, "AUDIO CARGADO");
    } catch (e) { console.error("Error al cargar audios de fondo:", e); updateLoadingProgress(65, "ERROR DE AUDIO"); return; }
    gain_Fondo1 = audioCtx.createGain(); gain_Fondo1.gain.value = 0; gain_Fondo1.connect(masterGain);
    gain_Fondo2 = audioCtx.createGain(); gain_Fondo2.gain.value = 0; gain_Fondo2.connect(masterGain);
    reverbGain = audioCtx.createGain(); reverbGain.gain.value = 0.8;
    let delay = audioCtx.createDelay(1.0); delay.delayTime.value = 0.5; 
    let fb = audioCtx.createGain(); fb.gain.value = 0.6;
    reverbGain.connect(delay); delay.connect(fb); fb.connect(delay);
    delay.connect(masterGain); 
    distortionNode = audioCtx.createWaveShaper(); distortionNode.curve = makeDistortionCurve(50);
    distortionNode.oversample = '4x'; distortionNode.connect(reverbGain);
    initSpeechRec();
}
function playFondo1() {
    if (!audioBuffer_Fondo1) return;
    if (audioSource_Fondo1) { try { audioSource_Fondo1.stop(); } catch(e){} }
    audioSource_Fondo1 = audioCtx.createBufferSource();
    audioSource_Fondo1.buffer = audioBuffer_Fondo1;
    audioSource_Fondo1.loop = true;
    audioSource_Fondo1.connect(gain_Fondo1);
    audioSource_Fondo1.start();
}
function playFondo2_Fragment() {
    if (!audioBuffer_Fondo2 || !isRunning || spiritBoxState !== "SCANNING") return;
    if (audioSource_Fondo2) { try { audioSource_Fondo2.stop(); } catch(e){} }
    audioSource_Fondo2 = audioCtx.createBufferSource();
    audioSource_Fondo2.buffer = audioBuffer_Fondo2;
    audioSource_Fondo2.connect(gain_Fondo2);
    const duration = audioBuffer_Fondo2.duration;
    const startTime = Math.random() * (duration - 2);
    const fragmentDuration = 0.8 + Math.random() * 1.2;
    audioSource_Fondo2.start(0, startTime, fragmentDuration);
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(playFondo2_Fragment, fragmentDuration * 1000 + (Math.random() * 300));
}
function makeDistortionCurve(amount) {
    let k = typeof amount === 'number' ? amount : 50, n_samples = 44100,
        curve = new Float32Array(n_samples), deg = Math.PI / 180, i = 0, x;
    for ( ; i < n_samples; ++i ) {
        x = i * 2 / n_samples - 1;
        curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
    }
    return curve;
}

// --- Lógica de Sensores (Sin cambios) ---
let sensorPermissionsRequested = false;
async function requestAllPermissions() {
    if (sensorPermissionsRequested) { initSensor(); return; }
    sensorPermissionsRequested = true;
    console.log("Solicitando permisos de sensores...");
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const status = await DeviceOrientationEvent.requestPermission();
            if (status === 'granted') { initSensor(); } 
            else { setSensorStatus('mag', 'unavailable'); setSensorStatus('prox', 'simulated'); startEmfSimulation(); }
        } catch (e) { console.warn("Error permiso orientación", e); initSensor(); }
    } else { console.log("Permiso orientación no requerido"); initSensor(); }
}
function initSensor() {
    if ('AbsoluteOrientationSensor' in window) {
        try {
            orientationSensor = new AbsoluteOrientationSensor({ frequency: 10 });
            orientationSensor.onreading = () => {
                let q = orientationSensor.quaternion;
                let yaw = Math.atan2(2 * (q[0] * q[1] + q[2] * q[3]), 1 - 2 * (q[1] * q[1] + q[2] * q[2])) * (180 / Math.PI);
                document.getElementById('compass-needle').style.transform = `translateX(-50%) rotate(${-yaw}deg)`;
                setSensorStatus('mag', 'connected');
            };
            orientationSensor.onerror = (e) => { setSensorStatus('mag', 'unavailable'); };
            orientationSensor.start();
        } catch (e) { setSensorStatus('mag', 'unavailable'); }
    } else { setSensorStatus('mag', 'unavailable'); }
    if ('Magnetometer' in window) {
        try {
            magnetometer = new Magnetometer({ frequency: 10 });
            magnetometer.onreading = () => {
                let strength = Math.sqrt(magnetometer.x**2 + magnetometer.y**2 + magnetometer.z**2);
                emfValue = Math.min(100, (strength / 100) * 100); 
                setSensorStatus('prox', 'connected');
            };
            magnetometer.onerror = (e) => { initProximitySensor(); };
            magnetometer.start();
        } catch (e) { initProximitySensor(); }
    } else { initProximitySensor(); }
}
function initProximitySensor() {
    if ('ProximitySensor' in window) {
        try {
            proximitySensor = new ProximitySensor();
            proximitySensor.onreading = () => {
                const maxDist = 10, minDist = 2;  
                let dist = proximitySensor.value;
                if (dist <= minDist) emfValue = 100;
                else if (dist >= maxDist) emfValue = 0;
                else emfValue = 100 * (1 - (dist - minDist) / (maxDist - minDist));
                setSensorStatus('prox', 'fallback');
            };
            proximitySensor.onerror = (e) => { setSensorStatus('prox', 'simulated'); startEmfSimulation(); };
            proximitySensor.start();
        } catch(e) { setSensorStatus('prox', 'simulated'); startEmfSimulation(); }
    } else { setSensorStatus('prox', 'simulated'); startEmfSimulation(); }
}
function startEmfSimulation() {
    if (emfSimInterval) return;
    emfSimInterval = setInterval(() => { emfValue = Math.random() * 100; }, 200);
}
function stopSensor() {
    if (proximitySensor) proximitySensor.stop();
    if (magnetometer) magnetometer.stop();
    if (orientationSensor) orientationSensor.stop();
    if (emfSimInterval) clearInterval(emfSimInterval);
    emfSimInterval = null; emfValue = 0;
    setSensorStatus('prox', 'off'); setSensorStatus('mag', 'off');
}

function startVisualLoop() {
    if (visualLoopInterval) clearInterval(visualLoopInterval); 
    visualLoopInterval = setInterval(() => {
        let intensity = emfValue; 
        const needle = document.getElementById('detector-dial-needle');
        if (needle) {
            needle.style.transform = `translateX(-50%) rotate(${-60 + (intensity/100)*120}deg)`;
        }
        updateEnergyGraph(intensity); 
    }, 150); 
}

// --- Lógica Spirit Box (Sin cambios) ---
const pwr = document.getElementById('knob-power');
pwr.addEventListener('click', async (e) => {
    e.stopPropagation();
    if(!audioCtx) await initAudio();
    if(!audioCtx) return; 
    isRunning = !isRunning;
    pwr.classList.toggle('active', isRunning);
    if(isRunning) {
        pwr.style.transform = 'rotate(0deg)';
        if(audioCtx.state === 'suspended') {
            audioCtx.resume();
            const silentUtterance = new SpeechSynthesisUtterance(" ");
            silentUtterance.volume = 0; window.speechSynthesis.speak(silentUtterance);
        }
        playFondo1();
        gain_Fondo1.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.5);
        gain_Fondo2.gain.linearRampToValueAtTime(0.7, audioCtx.currentTime + 0.5);
        requestAllPermissions();
        spiritBoxState = "SCANNING";
        playFondo2_Fragment();
        runSpiritBoxLoop();
    } else {
        pwr.style.transform = 'rotate(135deg)';
        gain_Fondo1.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
        gain_Fondo2.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
        if (audioSource_Fondo1) { try { audioSource_Fondo1.stop(); } catch(e){} }
        if (audioSource_Fondo2) { try { audioSource_Fondo2.stop(); } catch(e){} }
        if (scanTimer) clearTimeout(scanTimer);
        spiritBoxState = "OFF";
        if (spiritBoxTimeout) clearTimeout(spiritBoxTimeout);
        if (isRecognizing) recognition.abort();
        window.speechSynthesis.cancel();
        isSpeaking = false; isRecognizing = false;
        setSensorStatus('mic', 'off');
        stopSensor();
    }
});
document.getElementById('knob-scan').addEventListener('click', function(e) {
    e.stopPropagation();
});
document.getElementById('vol-slider').addEventListener('input', (e) => {
    e.stopPropagation();
    const vol = e.target.value;
    if(masterGain) masterGain.gain.value = vol/100;
    document.getElementById('vol-percent').innerText = `${vol}%`;
});
function hideLoadingScreen() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 500); 
    }
}
const loadingText = document.getElementById('loading-text');
const loadingBar = document.getElementById('loading-bar');
function updateLoadingProgress(percent, text) {
    if (loadingBar) loadingBar.style.width = percent + '%';
    if (loadingText) loadingText.innerText = `${text} [ ${percent}% ]`;
}
async function loadSheetData() {
    try {
        updateLoadingProgress(25, "CONECTANDO CON API-OBR");
        const response = await fetch(GOOGLE_SCRIPT_URL);
        updateLoadingProgress(50, "RECIBIENDO DATOS");
        if (!response.ok) throw new Error(`Error de red: ${response.statusText}`);
        const data = await response.json();
        if (!audioCtx) await initAudio(); 
        updateLoadingProgress(75, "PROCESANDO RESPUESTAS");
        automaticoData = data.automatico.map(r => r.TEXTO).filter(t => t);
        data.programado.forEach(r => {
            let p = (r.PREGUNTA || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            let res = r.RESPUESTA;
            if (p && res) { programadoData.set(p, res); }
        });
        updateLoadingProgress(100, "SINCRONIZACIÓN COMPLETA");
        console.log(`%c[SISTEMA OBR] Sincronización completa: ${automaticoData.length} AUTO | ${programadoData.size} PROG.`, "color: #39FF14; font-weight: bold;");
    } catch (e) { 
        console.error("Error cargando datos de Google Apps Script", e); 
        updateLoadingProgress(100, "ERROR DE SINCRONIZACIÓN");
    } finally {
        setTimeout(hideLoadingScreen, 500); 
    }
}
function speak(text) {
    if (!text || isSpeaking) return;
    spiritBoxState = "SPEAKING";
    isSpeaking = true;
    if (scanTimer) clearTimeout(scanTimer);
    const words = text.split(' ');
    let wordIndex = 0;
    function speakWordByWord() {
        if (wordIndex >= words.length || !isRunning) {
            isSpeaking = false; spiritBoxState = "SCANNING";
            gain_Fondo1.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.2);
            gain_Fondo2.gain.linearRampToValueAtTime(0.7, audioCtx.currentTime + 0.2);
            if (isRunning) { playFondo2_Fragment(); setTimeout(runSpiritBoxLoop, 2000); }
            return;
        }
        const word = words[wordIndex];
        const u = new SpeechSynthesisUtterance(word);
        u.lang = 'es-MX'; u.volume = 1.0;
        u.pitch = 0.1 + Math.random() * 0.7;
        u.rate = 0.9 + Math.random() * 0.4;
        u.onstart = () => {
            gain_Fondo1.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime); 
            gain_Fondo2.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime);
        };
        u.onend = () => {
            wordIndex++;
            gain_Fondo1.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime);
            gain_Fondo2.gain.linearRampToValueAtTime(0.7, audioCtx.currentTime);
            setTimeout(speakWordByWord, 100 + Math.random() * 400);
        };
        window.speechSynthesis.speak(u);
    }
    speakWordByWord();
    emfValue = 80 + Math.random() * 20;
}
function runSpiritBoxLoop() {
    if (!isRunning || spiritBoxState === "SPEAKING") return;
    spiritBoxState = "LISTENING";
    if (audioSource_Fondo2) { try { audioSource_Fondo2.stop(); } catch(e){} }
    if (scanTimer) clearTimeout(scanTimer);
    gain_Fondo2.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
    try { if (!isRecognizing) recognition.start(); } 
    catch(e) { console.warn("Error recognition", e); setSensorStatus('mic', 'unavailable'); if (isRunning) setTimeout(runSpiritBoxLoop, 2000); return; }
    spiritBoxTimeout = setTimeout(() => {
        if (spiritBoxState !== "LISTENING") return; 
        console.log("Timeout: No se detectó comando.");
        if (isRecognizing) recognition.abort();
        isRecognizing = false;
        gain_Fondo2.gain.linearRampToValueAtTime(0.7, audioCtx.currentTime + 0.2);
        spiritBoxState = "SCANNING";
        playFondo2_Fragment(); 
        if (automaticoData.length > 0) {
            setTimeout(() => {
                if (isRunning) { speak(automaticoData[Math.floor(Math.random() * automaticoData.length)]); }
            }, 1000 + Math.random() * 2000);
        } else { setTimeout(runSpiritBoxLoop, 3000); }
    }, 5000);
}
function initSpeechRec() {
    if(!SpeechRecognition) { setSensorStatus('mic', 'unavailable'); return; }
    recognition = new SpeechRecognition(); 
    recognition.lang = 'es-MX'; recognition.continuous = false;
    recognition.onstart = () => { isRecognizing = true; setSensorStatus('mic', 'connected'); };
    recognition.onend = () => { isRecognizing = false; setSensorStatus('mic', 'off'); };
    recognition.onerror = (e) => { isRecognizing = false; setSensorStatus('mic', 'unavailable'); console.warn("Error Rec:", e.error); };
    recognition.onresult = (e) => {
        if (spiritBoxTimeout) clearTimeout(spiritBoxTimeout); 
        let t = e.results[0][0].transcript.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
        console.log("Comando detectado:", t);
        if (programadoData.has(t)) { speak(programadoData.get(t)); } 
        else { if (automaticoData.length > 0) { speak(automaticoData[Math.floor(Math.random() * automaticoData.length)]); } }
    };
}
function updateEnergyGraph(value) {
    if (!energyCtx || !energyCanvas) return; 
    energyHistory.push(value);
    if (energyHistory.length > 50) energyHistory.shift();
    let w = energyCanvas.width; let h = energyCanvas.height;
    if (w === 0 || h === 0) { resizeEnergyCanvas(); w = energyCanvas.width; h = energyCanvas.height; if(w === 0 || h === 0) return; }
    energyCtx.clearRect(0, 0, w, h);
    let step = w / energyHistory.length;
    energyCtx.beginPath(); energyCtx.strokeStyle = '#39FF14'; energyCtx.lineWidth = 1.5;
    energyCtx.moveTo(0, h - (energyHistory[0] / 100 * h));
    for(let i=1; i<energyHistory.length; i++) { energyCtx.lineTo(i * step, h - (energyHistory[i] / 100 * h)); }
    energyCtx.stroke();
    energyCtx.beginPath(); energyCtx.strokeStyle = '#FF3333'; energyCtx.lineWidth = 1; 
    let inPeak = false;
    for(let i=0; i<energyHistory.length; i++) {
        let val = energyHistory[i]; let y = h - (val / 100 * h);
        if (val > 80) { if (!inPeak) { energyCtx.moveTo(i * step, y); inPeak = true; } else { energyCtx.lineTo(i * step, y); } } 
        else { inPeak = false; }
    }
    energyCtx.stroke(); 
}
function resizeEnergyCanvas() {
    if(energyCanvas && energyCanvas.parentElement) {
        const rect = energyCanvas.parentElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            energyCanvas.width = rect.width;
            energyCanvas.height = rect.height;
        }
    }
}
function updateSensorReadings() {
    if (!isRunning) {
        currentTemp += (Math.random()*0.04 - 0.02); 
        document.getElementById('temp-val').innerText = currentTemp.toFixed(1)+"°C";
    }
}

// --- 📍 NUEVA LÓGICA DE UI (P5, P14) ---

const followContainer = document.getElementById('follow-container');
const floatingControls = document.getElementById('hud-floating-controls');

// Clic en el fondo de la cámara
function handleUITap(event) {
    requestAllPermissions(); // Activar sensores en el primer toque
    if (isPinching) return; // No hacer nada si es zoom
    
    if (uiVisible) { hideControls(); } 
    else { showControls(); }
}

// Clic en los paneles de cabina (para evitar que se cierren)
function handlePanelClick(event) {
    event.stopPropagation();
    // Si la UI flotante está visible, reiniciar su timer
    if (uiVisible) {
        resetHideUITimer();
    }
}
// Clic en los controles flotantes (para evitar que se cierren)
function handleFloatingControlsClick(event) {
    event.stopPropagation();
}

function showControls() {
    document.body.classList.remove('ui-hidden');
    uiVisible = true;
    resetHideUITimer();
    
    // Detener y ocultar "Síguenos"
    followContainer.style.opacity = 0;
    if (followAnimationRunning) {
        followSteps.forEach(s => {
            s.style.display = 'none';
            s.classList.remove('fade-in', 'fade-out');
        });
        followAnimationRunning = false;
    }
}

function hideControls() {
    document.body.classList.add('ui-hidden');
    uiVisible = false;
    if (uiHideTimeout) clearTimeout(uiHideTimeout);
    
    // Iniciar animación "Síguenos" solo si los paneles están visibles
    if (panelVisible) {
        runFollowAnimation();
    }
}

function resetHideUITimer() {
    if (uiHideTimeout) clearTimeout(uiHideTimeout);
    uiHideTimeout = setTimeout(hideControls, 4000); // 4 segundos
}

// --- Animación "Síguenos" ---
const followSteps = document.querySelectorAll('.follow-step');
let followAnimationRunning = false;
async function runFollowAnimation() {
    // Solo correr si la UI está oculta y no está ya corriendo
    if (uiVisible || followAnimationRunning) return; 
    
    followAnimationRunning = true;
    followContainer.style.opacity = 1; // Hacer visible el contenedor
    
    const text = document.getElementById('follow-text');
    text.style.display = 'block'; text.classList.remove('fade-out'); text.classList.add('fade-in');
    await new Promise(r => setTimeout(r, 2500)); 
    if(uiVisible) { followAnimationRunning = false; followContainer.style.opacity = 0; return; } 
    text.classList.remove('fade-in'); text.classList.add('fade-out'); 
    await new Promise(r => setTimeout(r, 1000));
    text.style.display = 'none';
    
    const icons = document.getElementById('follow-icons');
    icons.style.display = 'flex'; icons.classList.remove('fade-out'); icons.classList.add('fade-in');
    await new Promise(r => setTimeout(r, 2500)); 
    if(uiVisible) { followAnimationRunning = false; followContainer.style.opacity = 0; return; } 
    icons.classList.remove('fade-in'); icons.classList.add('fade-out');
    await new Promise(r => setTimeout(r, 1000));
    icons.style.display = 'none';

    const handle = document.getElementById('follow-handle');
    handle.style.display = 'block'; handle.classList.remove('fade-out'); handle.classList.add('fade-in');
    await new Promise(r => setTimeout(r, 2500)); 
    if(uiVisible) { followAnimationRunning = false; followContainer.style.opacity = 0; return; } 
    handle.classList.remove('fade-in'); handle.classList.add('fade-out');
    await new Promise(r => setTimeout(r, 1000));
    handle.style.display = 'none';

    followContainer.style.opacity = 0; // Ocultar al final
    followAnimationRunning = false;
}

// --- Lógica de Zoom/Pan (P5) ---
const appUI = document.getElementById('app-ui');
function getPinchDist(e) {
    const t1 = e.touches[0]; const t2 = e.touches[1];
    return Math.sqrt(Math.pow(t1.clientX - t2.clientX, 2) + Math.pow(t1.clientY - t2.clientY, 2));
}
appUI.addEventListener('touchstart', (e) => {
    if (!e.target.closest('#main-view-area')) return;
    if (e.touches.length === 2) {
        isPinching = true; 
        initialPinchDist = getPinchDist(e);
    }
});
appUI.addEventListener('touchmove', (e) => {
    if (!e.target.closest('#main-view-area')) return;
    
    if (isPinching && e.touches.length === 2) {
        e.preventDefault(); 
        const newPinchDist = getPinchDist(e);
        const zoomFactor = newPinchDist / initialPinchDist;
        let newZoom = zoom * zoomFactor;
        newZoom = Math.max(1.0, Math.min(newZoom, maxZoom));
        zoom = newZoom;
        initialPinchDist = newPinchDist;
        videoBg.style.transform = `translate(-50%, -50%) scale(${zoom})`;
    }
});
appUI.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) isPinching = false;
    if (zoom === 1) {
        videoBg.style.transform = `translate(-50%, -50%) scale(1)`;
    }
});

// --- Carga Inicial ---
window.onload = () => {
    // 📍 CORRECCIÓN: Encadenar promesas para asegurar el orden de carga
    startCamera()
        .then(() => {
            // Funciones que dependen de la cámara
            startVisualLoop(); 
            initMLModel(); 
            detectPoseLoop(); 
            
            setInterval(updateSensorReadings, 2000); 
            
            // Iniciar ciclo de "Síguenos" (se mostrará cuando la UI esté oculta)
            setInterval(runFollowAnimation, 20000); 
            
            hideControls(); // Ocultar UI flotante al inicio
            
            // Cargar datos de Google Sheets
            return loadSheetData(); // Esto oculta la pantalla de carga al final
        })
        .catch(err => {
            console.error("Error crítico en la inicialización:", err);
            document.getElementById('loading-text').innerText = "ERROR AL INICIAR";
            // Aún así, intentar ocultar la carga para que el error sea visible
            setTimeout(hideLoadingScreen, 500);
        });
    
    resizeAllCanvas(); 
};

window.onresize = () => {
    resizeAllCanvas(); 
};
