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
let speakingSafetyTimeout; 

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

function setMasterVolume(volume) {
    currentVolume = Math.max(0, Math.min(1, volume)); 
    
    // Establecer volumenes, asegurando que se apliquen siempre.
    if (!isSpeaking) {
        if (staticAudio1) staticAudio1.volume = currentVolume * 0.75; 
        if (staticAudio2) staticAudio2.volume = currentVolume * 0.45;
        if (sweepAudio) sweepAudio.volume = currentVolume * 0.45;
    }
    
    if (voiceEffectAudio) voiceEffectAudio.volume = currentVolume; // Volumen para el glitch

    statusMessage.textContent = `FRECUENCIA: ${(currentVolume * 100).toFixed(0)}%`;

    // Rotación visual de la perilla de volumen
    const dial = document.getElementById('volumeDial');
    if (dial) {
        const rotation = (currentVolume * 270) - 135; 
        dial.style.transform = `rotate(${rotation}deg)`;
    }
}

// Lógica de control de volumen con el mouse/touch (SIN CAMBIOS)
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


function getMainVoice() {
    const voices = synth.getVoices();
    const esVoices = voices.filter(voice => voice.lang.startsWith('es'));
    return esVoices.find(v => v.name.includes('male') || v.name.includes('Man') || v.name.includes('Jorge')) || esVoices[0] || null;
}

async function speakMainPhrase(text) {
    return new Promise(resolve => {
        const mainVoice = getMainVoice();
        if (!mainVoice) {
            console.error("No se encontró una voz en español.");
            resolve();
            return;
        }

        const utteranceMain = new SpeechSynthesisUtterance(text);
        utteranceMain.voice = mainVoice;
        utteranceMain.lang = mainVoice.lang;
        utteranceMain.rate = isFastSpeed ? 1.5 : 1.3;
        utteranceMain.pitch = 1.0;
        utteranceMain.volume = currentVolume;

        // Bajar el ruido de fondo antes de la voz principal
        if (staticAudio1) staticAudio1.volume = currentVolume * 0.1;
        if (sweepAudio) sweepAudio.volume = currentVolume * 0.1;

        utteranceMain.onend = () => {
            if (staticAudio1) staticAudio1.volume = currentVolume * 0.6;
            resolve();
        };
        utteranceMain.onerror = () => {
             console.warn(`Error de síntesis de voz para ${text}.`);
             resolve();
        };

        if (isSpeaking) {
            synth.speak(utteranceMain);
        } else {
            resolve();
        }
    });
}


async function hablarComoSpiritBox(texto) {
    if (!synth || isSpeaking) {
        display.innerHTML = "[ERROR: Voz no soportada o ya está hablando]";
        return;
    }

    detenerRuidoVisual(); 
    synth.cancel(); 
    isSpeaking = true;
    
    // Aseguramos que los audios de fondo estén corriendo antes de hablar
    iniciarRuidosDeFondo(); 

    const upperText = texto.toUpperCase();
    display.innerHTML = upperText;
    currentStatusText.textContent = "TRANSMITIENDO...";
    actualizarEnergyBar(100);
    
    const estimatedDurationMs = (texto.length / 1.3) * 120 + 3000; 
    
    clearTimeout(speakingSafetyTimeout);
    speakingSafetyTimeout = setTimeout(() => {
        if (isSpeaking) {
            console.warn("TIMEOUT DE SEGURIDAD: La voz tardó demasiado. Forzando el restablecimiento del estado.");
            limpiarEstadoHablando();
        }
    }, estimatedDurationMs); 
    
    // 1. REPRODUCIR EL GLITCH/IMPACTO CON SINCRONIZACIÓN
    if (voiceEffectAudio) {
        voiceEffectAudio.currentTime = 0;
        voiceEffectAudio.volume = currentVolume; 
        
        await new Promise(resolve => {
            // Un pequeño delay para que el glitch no se pise con la estática al bajar
            setTimeout(() => {
                voiceEffectAudio.play().catch(e => console.error("Error al reproducir voiceEffectAudio:", e));
                resolve();
            }, 50); 
        });
    }

    // 2. Ejecutar la voz principal
    await speakMainPhrase(upperText);
    
    // 3. Limpieza
    if (isSpeaking) {
        limpiarEstadoHablando();
    }
}

function limpiarEstadoHablando() {
    clearTimeout(speakingSafetyTimeout);
    isSpeaking = false;
    
    synth.cancel(); 
    
    if (voiceEffectAudio) {
        voiceEffectAudio.pause();
        voiceEffectAudio.currentTime = 0;
    }

    // Restablecer volúmenes de fondo al terminar
    setMasterVolume(currentVolume); 

    iniciarRuidoVisual(); 
    currentStatusText.textContent = "SCANNING";
    actualizarEnergyBar(30); 
    reiniciarTemporizadorAleatorio(); 
}

// *** LÓGICA DE AUDIO MEJORADA PARA FORZAR REPRODUCCIÓN ***
function generarRuidoFrecuencias(numChars = 200) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_#@*/\\|~^`-+=<>"; 
    let noise = "";
    for (let i = 0; i < numChars; i++) {
        noise += chars.charAt(Math.floor(Math.random() * chars.length));
        if (Math.random() < 0.02) noise += '\n'; 
    }
    return noise;
}

function iniciarRuidoVisual() {
    if (intervalId) return; 
    intervalId = setInterval(() => {
        if (!isSpeaking) {
            const displayElement = document.getElementById('display');
            const container = document.getElementById('display-container');
            if (displayElement && container) {
                const charWidth = 10; 
                const lineHeight = 1.2; 
                const numCols = Math.floor(container.offsetWidth / charWidth);
                const numRows = Math.floor(container.offsetHeight / (parseFloat(getComputedStyle(displayElement).fontSize) * lineHeight));
                const totalChars = numCols * numRows * 1.2; 
                displayElement.innerHTML = generarRuidoFrecuencias(totalChars);
            } else {
                display.innerHTML = generarRuidoFrecuencias(200); 
            }
        }
    }, 70); 
}

function detenerRuidoVisual() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

/**
 * Intenta iniciar la reproducción de todos los audios de fondo y los pone en bucle.
 * Esta es la función que se llama con el primer clic para sortear las restricciones del navegador.
 */
async function iniciarRuidosDeFondo() {
    const audios = [staticAudio1, staticAudio2, sweepAudio];
    setMasterVolume(currentVolume); 
    
    for (const audio of audios) {
        if (audio) {
            // Aseguramos que esté en bucle y cargado
            audio.loop = true;
            audio.load();
            
            // Intentamos reproducir
            if (audio.paused) {
                 try {
                    await audio.play();
                } catch (e) {
                    // Si falla, es probable que se deba a la falta de interacción,
                    // pero el listener del documento debería manejar esto.
                    console.warn(`Fallo al reproducir ${audio.id}:`, e);
                }
            }
        }
    }
}
// *** FIN LÓGICA DE AUDIO MEJORADA ***

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


// Lógica de Velocidad, Respuesta Aleatoria y Guion (SIN CAMBIOS)
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


// Carga de Datos y Inicialización
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
    
    // 1. Establecer el volumen inicial (y rotar la perilla)
    setMasterVolume(currentVolume); 

    // 2. Cargar datos
    await cargarGuionPrincipal(); 
    await cargarFrasesAleatorias();

    if (!display.innerHTML.includes("ERROR CRÍTICO")) {
        iniciarRuidoVisual(); 
        reiniciarTemporizadorAleatorio();
        currentStatusText.textContent = "IDLE";
        actualizarEnergyBar(20);
        updateStatusMessage(); 
    }
    
    // 3. Forzar la carga de todos los audios.
    if (staticAudio1) staticAudio1.load();
    if (staticAudio2) staticAudio2.load();
    if (sweepAudio) sweepAudio.load();
    if (voiceEffectAudio) voiceEffectAudio.load();
    
    // 4. Intenta iniciar la reproducción forzada (esto puede fallar aquí, pero prepara el terreno)
    iniciarRuidosDeFondo();
}

document.addEventListener('DOMContentLoaded', inicializarSpiritBox);

// Listener para el primer click del usuario (¡CRUCIAL!)
document.addEventListener('click', () => {
    // Si los audios están pausados, el clic del usuario los activará.
    iniciarRuidosDeFondo();
}, { once: true });
