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
const currentStatusText = document.getElementById('currentStatusText');
let energyLevel = 0; 
let currentVolume = 0.8; 

// ----------------------------------------------------
// PASO 2: Lógica de Voz, Ruido y Volumen (Perilla)
// ----------------------------------------------------

// Función para ajustar el volumen de todos los audios
function setMasterVolume(volume) {
    currentVolume = Math.max(0, Math.min(1, volume)); 
    
    if (voiceEffectAudio) voiceEffectAudio.volume = currentVolume;
    
    // Establecer un volumen base para la estática cuando no hay habla activa
    if (!isSpeaking) {
        if (staticAudio1) staticAudio1.volume = currentVolume * 0.75; 
        if (staticAudio2) staticAudio2.volume = currentVolume * 0.45;
        if (sweepAudio) sweepAudio.volume = currentVolume * 0.45;
    }
    
    statusMessage.textContent = `FRECUENCIA: ${(currentVolume * 100).toFixed(0)}%`;
}

// Lógica de control de volumen con el mouse/touch (Sin cambios)
let isDragging = false;
let startY = 0; 

function iniciarControlVolumen(e) {
    e.preventDefault(); 
    isDragging = true;
    startY = e.clientY || e.touches[0].clientY;

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


// *** NUEVA FUNCIÓN: Obtener la voz específica por tipo ***
function getVoiceByType(type) {
    const voices = synth.getVoices();
    const esVoices = voices.filter(voice => voice.lang.startsWith('es'));

    // Priorizar voces por tono o nombre que sugieran el tipo
    switch (type.toUpperCase()) {
        case 'MASCULINO':
            // Buscar una voz de tono bajo o genérica
            return esVoices.find(v => v.name.includes('male') || v.name.includes('Man') || v.name.includes('Jorge') || v.name.includes('Juan')) || esVoices[0]; 
        case 'DAMA':
            // Buscar una voz femenina (la mayoría de las voces son femeninas por defecto)
            return esVoices.find(v => v.name.includes('female') || v.name.includes('Woman') || v.name.includes('Laura') || v.name.includes('Beatriz') || v.name.includes('Zira')) || esVoices[1] || esVoices[0]; 
        case 'JUVENIL':
            // Buscar una voz con un tono ligeramente más alto o infantil (si es posible)
            return esVoices.find(v => v.name.includes('child') || v.name.includes('Kid') || v.name.includes('niño')) || esVoices[2] || esVoices[0];
        default:
            return esVoices[0] || null;
    }
}

// *** NUEVA FUNCIÓN: Hablar un fragmento de voz individual ***
function speakIndividualVoice(text, voiceType, volumeMultiplier, delayMs, rate, pitch) {
    return new Promise(resolve => {
        setTimeout(() => {
            const voice = getVoiceByType(voiceType);
            if (!voice) {
                console.error("Voz no encontrada para el tipo:", voiceType);
                resolve();
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.voice = voice;
            utterance.lang = voice.lang;
            utterance.rate = rate;
            utterance.pitch = pitch;
            utterance.volume = currentVolume * volumeMultiplier; // Aplicar el multiplicador de eco/volumen

            utterance.onend = resolve;
            utterance.onerror = resolve; // Asegurar que el Promise se resuelva incluso en caso de error

            if (isSpeaking) {
                synth.speak(utterance);
            } else {
                resolve();
            }
        }, delayMs);
    });
}


// *** FUNCIÓN CRÍTICA: LECTURA CON ECO DE MÚLTIPLES VOCES (SIN DELETREO) ***
async function hablarComoSpiritBox(texto) {
    if (!synth || isSpeaking) {
        display.innerHTML = "[ERROR: Voz no soportada o ya está hablando]";
        return;
    }

    detenerRuidoVisual(); 
    synth.cancel(); 
    isSpeaking = true;
    
    iniciarRuidosDeFondo(); 

    // Muestra el texto completo al inicio
    const upperText = texto.toUpperCase();
    display.innerHTML = upperText;
    currentStatusText.textContent = "TRANSMITIENDO...";
    actualizarEnergyBar(100);
    
    // Configuraciones de voz base (alta velocidad, tono neutro)
    const baseRate = isFastSpeed ? 1.6 : 1.4;
    const basePitch = 1.0; 
    
    // --- LÓGICA DE INTERFERENCIA DE AUDIO Y VOZ PRINCIPAL ---

    // 1. Bajar el volumen de los ruidos de fondo antes de la voz principal
    if (staticAudio1) staticAudio1.volume = currentVolume * 0.1; 
    if (staticAudio2) staticAudio2.volume = currentVolume * 0.05; 
    if (sweepAudio) sweepAudio.volume = currentVolume * 0.1; 

    // 2. Reproducir el efecto de impacto/glitch al inicio
    if (voiceEffectAudio) {
        voiceEffectAudio.currentTime = 0;
        voiceEffectAudio.volume = currentVolume; 
        await voiceEffectAudio.play().catch(e => console.error("Error al reproducir voiceEffectAudio:", e));
    }

    // 3. Hablar la voz principal (MASCULINO)
    const principalPromise = speakIndividualVoice(
        upperText, 
        'MASCULINO', 
        1.0, // Volumen total
        0,   // Sin delay
        baseRate, 
        basePitch
    );

    // 4. Configurar el Eco con las otras dos voces (se lanzan casi simultáneamente)
    const echoDelayBase = 50; // Milisegundos de delay entre la voz principal y el eco
    
    // Voz Secundaria (DAMA): Volumen medio-bajo, ligero delay y tono ligeramente más alto
    const secondaryPromise = speakIndividualVoice(
        upperText, 
        'DAMA', 
        0.5, // 50% del volumen base
        echoDelayBase + Math.random() * 50, // 50ms a 100ms de delay
        baseRate * 0.95, // Ligeramente más lenta
        1.1 // Tono ligeramente más alto
    );

    // Voz Terciaria (JUVENIL): Volumen bajo, mayor delay y tono más bajo/alto (aleatorio)
    const tertiaryPromise = speakIndividualVoice(
        upperText, 
        'JUVENIL', 
        0.3, // 30% del volumen base
        echoDelayBase + 100 + Math.random() * 100, // 150ms a 250ms de delay
        baseRate * 1.05, // Ligeramente más rápida
        0.9 // Tono ligeramente más bajo
    );
    
    // 5. Esperar a que TODAS las voces terminen
    await Promise.all([principalPromise, secondaryPromise, tertiaryPromise]);
    
    // --- LIMPIEZA FINAL ---
    
    isSpeaking = false;
    if (voiceEffectAudio) voiceEffectAudio.pause();
    
    // Restablecer volúmenes de fondo al terminar
    setMasterVolume(currentVolume); 

    iniciarRuidoVisual(); 
    currentStatusText.textContent = "SCANNING";
    actualizarEnergyBar(30); 
    reiniciarTemporizadorAleatorio(); 
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
    }, 50); 
}

function detenerRuidoVisual() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

async function iniciarRuidosDeFondo() {
    try {
        if (staticAudio1 && staticAudio1.paused) await staticAudio1.play();
        if (staticAudio2 && staticAudio2.paused) await staticAudio2.play();
        if (sweepAudio && sweepAudio.paused) await sweepAudio.play();
    } catch (e) {
        console.warn("Fallo al reproducir audio. Esto es normal antes del primer toque del usuario.", e);
    }
}

function detenerRuidosDeFondo() {
    setMasterVolume(currentVolume);
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
    currentStatusText.textContent = "SCANNING";
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
        currentStatusText.textContent = "IDLE";
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
