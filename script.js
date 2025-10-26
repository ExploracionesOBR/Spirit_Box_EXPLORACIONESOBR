// CÓDIGO DE JAVASCRIPT (Archivo script.js)

// ----------------------------------------------------
// PASO 1: Variables de Configuración
// ----------------------------------------------------

const APPS_SCRIPT_URL_GUION = "https://sheetdb.io/api/v1/ej186l5av6pq2"; 
const APPS_SCRIPT_URL_ALEATORIAS = APPS_SCRIPT_URL_GUION + "?sheet=Aleatorias"; 

let frasesGuion = [];       
let frasesAleatorias = [];  
let fraseActualIndex = 0;   

const synth = window.speechSynthesis;
let display = document.getElementById('display');
let statusMessage = document.getElementById('status');
let isSpeaking = false;
let intervalId; 
let randomTimerId; 

// *** CONTROL DE TIEMPO AUTOMÁTICO (Speed) ***
const NORMAL_INTERVAL_MS = 8000; 
const FAST_INTERVAL_MS = 4000; 
let isFastSpeed = false; 

// Elementos de audio
const staticAudio1 = document.getElementById('staticAudio1');
const staticAudio2 = document.getElementById('staticAudio2'); 
const sweepAudio = document.getElementById('sweepAudio');
const voiceEffectAudio = document.getElementById('voiceEffectAudio'); 

// Elementos visuales y de control
const energyBar = document.getElementById('energyBar');
let energyLevel = 0; 
let speakingTimeout; 
let currentVolume = 0.8; 

// ----------------------------------------------------
// PASO 2: Lógica de Voz, Ruido y Volumen (Perilla)
// ----------------------------------------------------

// Función para ajustar el volumen de todos los audios
function setMasterVolume(volume) {
    currentVolume = Math.max(0, Math.min(1, volume)); 
    
    if (staticAudio1) staticAudio1.volume = currentVolume * 0.75; 
    if (staticAudio2) staticAudio2.volume = currentVolume * 0.45;
    if (sweepAudio) sweepAudio.volume = currentVolume * 0.45;
    if (voiceEffectAudio) voiceEffectAudio.volume = currentVolume;
    
    statusMessage.textContent = `VOLUMEN: ${(currentVolume * 100).toFixed(0)}%`;
}

// Lógica de control de volumen con el mouse/touch
let isDragging = false;
let startY = 0; 

function iniciarControlVolumen(e) {
    e.preventDefault(); 
    isDragging = true;
    startY = e.clientY || e.touches[0].clientY;
    
    // Obtener el dial de volumen del HTML
    const dial = document.getElementById('volumeDial'); 
    if (dial) {
        dial.classList.add('grabbing');
    }

    document.addEventListener('mousemove', ajustarVolumen);
    document.addEventListener('mouseup', detenerControlVolumen);
    document.addEventListener('touchmove', ajustarVolumen);
    document.addEventListener('touchend', detenerControlVolumen);
}

function ajustarVolumen(e) {
    if (!isDragging) return;

    const currentY = e.clientY || e.touches[0].clientY;
    const deltaY = startY - currentY; 
    
    const sensitivity = 0.005; 
    let newVolume = currentVolume + deltaY * sensitivity;

    setMasterVolume(newVolume);
    
    startY = currentY; 
}

function detenerControlVolumen() {
    isDragging = false;
    document.removeEventListener('mousemove', ajustarVolumen);
    document.removeEventListener('mouseup', detenerControlVolumen);
    document.removeEventListener('touchmove', ajustarVolumen);
    document.removeEventListener('touchend', detenerControlVolumen);
    
    const dial = document.getElementById('volumeDial');
    if (dial) {
        dial.classList.remove('grabbing');
    }

    setTimeout(() => {
        updateStatusMessage(); 
    }, 1500); 
}


// Función para encontrar una voz en español de México (o similar)
function getMexicanVoice() {
    const voices = synth.getVoices();
    return voices.find(voice => voice.lang.includes('es-MX')) ||
           voices.find(voice => voice.lang.includes('es-ES')) ||
           voices.find(voice => voice.lang.startsWith('es'));
}

// *** FUNCIÓN CRÍTICA: HABLAR CON EFECTO ENTRECORTADO/ECO SIMULADO (ULTRA RÁPIDO) ***
async function hablarComoSpiritBox(texto) {
    if (!synth) {
        display.innerHTML = "[ERROR: Voz no soportada]";
        return;
    }

    detenerRuidoVisual(); 
    synth.cancel(); 
    isSpeaking = true;
    detenerRuidosDeFondo();
    
    if (voiceEffectAudio) {
        voiceEffectAudio.currentTime = 0;
        voiceEffectAudio.volume = currentVolume; 
        await voiceEffectAudio.play().catch(e => console.error("Error al reproducir voiceEffectAudio:", e));
    }

    const voice = getMexicanVoice();
    
    // Configuración para una voz más rápida y menos robótica (más natural)
    const voiceRateBase = 1.25; // Lectura de texto más rápida
    const voicePitchBase = 0.95; // Pitch cercano a 1.0 (menos robótico)

    const actualVoiceRate = isFastSpeed ? voiceRateBase * 1.3 : voiceRateBase; 


    const textoArray = texto.toUpperCase().split('');
    let currentIndex = 0;
    
    display.innerHTML = "";
    actualizarEnergyBar(100);

    function speakFragment() {
        if (!isSpeaking || currentIndex >= textoArray.length) {
            // FIN DE LA FRASE
            isSpeaking = false;
            if (voiceEffectAudio) voiceEffectAudio.pause();
            iniciarRuidosDeFondo(); 
            iniciarRuidoVisual(); 
            actualizarEnergyBar(30); 
            reiniciarTemporizadorAleatorio(); 
            return;
        }

        // Fragmentos de 1 a 2 caracteres para máxima distorsión y velocidad de aparición
        const fragmentLength = Math.floor(Math.random() * 2) + 1; 
        const fragment = textoArray.slice(currentIndex, currentIndex + fragmentLength).join('');
        
        display.innerHTML += fragment; 
        currentIndex += fragmentLength;

        const fragmentUtterance = new SpeechSynthesisUtterance(fragment);
        
        if (voice) fragmentUtterance.voice = voice;
        fragmentUtterance.lang = 'es-MX'; 
        fragmentUtterance.rate = actualVoiceRate;     
        fragmentUtterance.pitch = voicePitchBase; 

        if (staticAudio1) {
             staticAudio1.volume = currentVolume * 0.8;
             staticAudio1.play().catch(e => console.warn("Error al iniciar estática.", e));
             setTimeout(() => {
                 staticAudio1.volume = currentVolume * 0.6; 
             }, 50);
        }

        fragmentUtterance.onend = () => {
             // Pausa ultra-rápida (5ms a 20ms) para máximo efecto entrecortado/eco
             const delay = Math.random() * 15 + 5; 
             speakingTimeout = setTimeout(speakFragment, delay);
        };
        
        if (isSpeaking) {
             synth.speak(fragmentUtterance);
        } else {
             synth.cancel();
        }
    }

    speakFragment();
}

function generarRuidoTexto() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_#@* ";
    let noise = "";
    for (let i = 0; i < 30; i++) {
        noise += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return noise;
}

function iniciarRuidoVisual() {
    if (intervalId) return; 
    intervalId = setInterval(() => {
        if (!isSpeaking) {
             display.innerHTML = generarRuidoTexto();
        }
    }, 50); // Ruido visual más rápido aún (antes 70ms)
}

function detenerRuidoVisual() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

async function iniciarRuidosDeFondo() {
    setMasterVolume(currentVolume); 
    try {
        if (staticAudio1 && staticAudio1.paused) await staticAudio1.play();
        if (staticAudio2 && staticAudio2.paused) await staticAudio2.play();
        if (sweepAudio && sweepAudio.paused) await sweepAudio.play();
    } catch (e) {
        console.warn("Fallo al reproducir audio. Esto es normal antes del primer toque del usuario.", e);
    }
}

function detenerRuidosDeFondo() {
    if (staticAudio1) staticAudio1.pause();
    if (staticAudio2) staticAudio2.pause();
    if (sweepAudio) sweepAudio.pause();
}

function actualizarEnergyBar(level) {
    energyLevel = Math.max(0, Math.min(100, level)); 
    if (energyBar) {
        energyBar.style.width = `${energyLevel}%`;
    }
}

function getCurrentInterval() {
    return isFastSpeed ? FAST_INTERVAL_MS : NORMAL_INTERVAL_MS;
}

function updateStatusMessage() {
    statusMessage.textContent = `Sistema listo. Guion: ${frasesGuion.length} | Aleatorias: ${frasesAleatorias.length}. (Modo ${isFastSpeed ? 'FAST' : 'NORMAL'} activo, siguiente en ${getCurrentInterval()/1000}s)`;
}


// ----------------------------------------------------
// PASO 3: Lógica de Velocidad (Botón SPEED)
// ----------------------------------------------------

function toggleSpeed() {
    isFastSpeed = !isFastSpeed; 
    reiniciarTemporizadorAleatorio(); 
    
    if (isFastSpeed) {
        statusMessage.textContent = "MODO VELOCIDAD (FAST): Respuestas más rápidas.";
    } else {
        statusMessage.textContent = "MODO VELOCIDAD (NORMAL): Respuestas normales.";
    }
    setTimeout(updateStatusMessage, 2000); 
}


// ----------------------------------------------------
// PASO 4: Lógica de Respuesta Aleatoria (Automática)
// ----------------------------------------------------

function dispararRespuestaAleatoria() {
    iniciarRuidosDeFondo(); 
    
    if (isSpeaking || frasesAleatorias.length === 0) {
        reiniciarTemporizadorAleatorio();
        return;
    }
    
    actualizarEnergyBar(energyLevel + 40); 
    
    const randomIndex = Math.floor(Math.random() * frasesAleatorias.length);
    const fraseAleatoria = frasesAleatorias[randomIndex];

    hablarComoSpiritBox(fraseAleatoria);
    statusMessage.textContent = `¡Detección de voz! Respuesta aleatoria activada.`;
}

function iniciarTemporizadorAleatorio() {
    if (frasesAleatorias.length === 0) return;
    
    const interval = getCurrentInterval();
    
    randomTimerId = setTimeout(dispararRespuestaAleatoria, interval);
    if (!isSpeaking) {
        updateStatusMessage();
    }
    actualizarEnergyBar(20 + Math.random() * 20); 
}

function reiniciarTemporizadorAleatorio() {
    clearTimeout(randomTimerId);
    iniciarTemporizadorAleatorio();
}


// ----------------------------------------------------
// PASO 5: Lógica del Guion (Botón EVP MODE)
// ----------------------------------------------------

function activarTruco() {
    iniciarRuidosDeFondo(); 
    
    if (isSpeaking) {
        statusMessage.textContent = "¡Esperando a que el espíritu termine de hablar!";
        return;
    }
    
    reiniciarTemporizadorAleatorio(); 

    if (frasesGuion.length === 0) {
        statusMessage.textContent = "Error: Guion secuencial no cargado. Revisa la hoja 'Guion'.";
        return;
    }
    
    if (fraseActualIndex >= frasesGuion.length) {
        statusMessage.textContent = "FIN DEL GUION. Pulsa para la última frase.";
        fraseActualIndex = frasesGuion.length - 1; 
    }

    const fraseSecreta = frasesGuion[fraseActualIndex];
    
    statusMessage.textContent = `Reproduciendo Frase Guion #${fraseActualIndex + 1}`; 
    
    hablarComoSpiritBox(fraseSecreta);
    
    if (fraseActualIndex < frasesGuion.length - 1) {
        fraseActualIndex++;
    }
    setTimeout(updateStatusMessage, 2000); 
}


// ----------------------------------------------------
// PASO 6: Carga de Datos y Inicialización
// ----------------------------------------------------

async function cargarGuionPrincipal() {
    statusMessage.textContent = "Conectando a SheetDB (Guion Secuencial)...";
    try {
        const response = await fetch(APPS_SCRIPT_URL_GUION);
        if (!response.ok) {
            throw new Error(`Error de red o API. Código: ${response.status}`);
        }
        const data = await response.json(); 
        
        if (Array.isArray(data) && data.length > 0) {
            frasesGuion = data.slice(2).map(row => row.B || '').filter(f => f.length > 0);
        }
    } catch (error) {
        console.error("Error al cargar guion principal:", error);
        display.innerHTML = `[ERROR CRÍTICO] FALLO AL CARGAR GUION. Verifica la URL de SheetDB.io y la conexión.`;
        statusMessage.textContent = "ERROR: No se pudo conectar a la base de datos (SheetDB).";
    }
}

async function cargarFrasesAleatorias() {
    statusMessage.textContent = "Conectando a SheetDB (Frases Aleatorias)...";
    try {
        const response = await fetch(APPS_SCRIPT_URL_ALEATORIAS);
        if (!response.ok) {
            throw new Error(`Error de red o API. Código: ${response.status}`);
        }
        const data = await response.json(); 
        
        if (Array.isArray(data) && data.length > 0) {
            frasesAleatorias = data.slice(2).map(row => row.B || '').filter(f => f.length > 0);
        }
    } catch (error) {
        console.error("Error al cargar frases aleatorias:", error);
        display.innerHTML = `[ERROR CRÍTICO] FALLO AL CARGAR ALEATORIAS. Verifica la URL de SheetDB.io y la conexión.`;
        statusMessage.textContent = "ERROR: No se pudo conectar a la base de datos (SheetDB).";
    }
}

async function inicializarSpiritBox() {
    display.innerHTML = "[Iniciando Sistema...]";
    
    setMasterVolume(currentVolume); 
    
    await cargarGuionPrincipal(); 
    await cargarFrasesAleatorias();

    if (!display.innerHTML.includes("ERROR CRÍTICO")) {
        iniciarRuidoVisual(); 
        reiniciarTemporizadorAleatorio();
        actualizarEnergyBar(20);
        updateStatusMessage(); 
    }
}

document.addEventListener('DOMContentLoaded', inicializarSpiritBox);

document.addEventListener('click', () => {
    if ((staticAudio1 && staticAudio1.paused) && !isSpeaking) {
        iniciarRuidosDeFondo();
        setTimeout(updateStatusMessage, 500); 
    }
}, { once: true });
