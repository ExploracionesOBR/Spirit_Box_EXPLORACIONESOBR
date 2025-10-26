// CÓDIGO DE JAVASCRIPT (Archivo script.js)

// ----------------------------------------------------
// PASO 1: Variables de Configuración
// ----------------------------------------------------

// URL de la base de datos (SheetDB.io) - Reemplaza si usas otra
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

// Elementos de audio (Variables que buscan los IDs SIMPLIFICADOS del HTML)
const staticAudio1 = document.getElementById('static1');     // static_loop.mp3
const staticAudio2 = document.getElementById('static2');     // static_loop2.mp3
const sweepAudio = document.getElementById('sweep');         // sweep_effect.mp3
const voiceEffectAudio = document.getElementById('voiceEffect'); // tatic_sweep_short.mp3
const startScreen = document.getElementById('startScreen'); // Elemento de inicio

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
    
    // Aplicar volumen a la estática y sweep
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

/**
 * Función MEJORADA para seleccionar la voz TTS más adecuada.
 */
function getMainVoice() {
    const voices = synth.getVoices();
    const esVoices = voices.filter(voice => voice.lang.startsWith('es'));
    
    // 1. Buscar voces de "hombre" o "masculino" (predefinidas)
    let bestVoice = esVoices.find(v => v.name.includes('male') || v.name.includes('Man') || v.name.includes('Jorge') || v.name.includes('Felipe'));
    
    // 2. Si no se encuentra, usar cualquier voz que suene "robótica" o de "alta calidad"
    if (!bestVoice) {
        bestVoice = esVoices.find(v => v.name.includes('Google') || v.name.includes('Microsoft') || v.default);
    }
    
    // 3. Si todo falla, usar la primera voz en español
    return bestVoice || esVoices[0] || null;
}

// Hablar la frase sin eco de síntesis (FUNCIÓN ESTABLE)
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

        // Bajar el ruido de fondo para que se escuche la voz
        if (staticAudio1) staticAudio1.volume = currentVolume * 0.1;
        if (sweepAudio) sweepAudio.volume = currentVolume * 0.1;

        utteranceMain.onend = () => {
            // Restaurar volumen del ruido de fondo al finalizar
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
    
    // Asegurar que los audios de fondo estén corriendo
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
            setTimeout(() => {
                // El audio tatic_sweep_short.mp3 simula el efecto de eco/glitch
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

    setMasterVolume(currentVolume); 

    iniciarRuidoVisual(); 
    currentStatusText.textContent = "SCANNING";
    actualizarEnergyBar(30); 
    reiniciarTemporizadorAleatorio(); 
}

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
 * FUNCIÓN CLAVE: Intenta iniciar la reproducción de todos los audios de fondo.
 */
async function iniciarRuidosDeFondo() {
    const audios = [staticAudio1, staticAudio2, sweepAudio];
    setMasterVolume(currentVolume); 
    
    for (const audio of audios) {
        if (audio) {
            audio.loop = true;
            
            if (audio.paused) {
                 try {
                    // Esta es la llamada crítica que necesita el click del usuario
                    await audio.play();
                } catch (e) {
                    // Si el error persiste, significa que el navegador está bloqueando
                    console.error("Error al intentar reproducir audio MP3. Asegúrate de hacer clic en la pantalla de inicio.", e);
                }
            }
        }
    }
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
    // Si la pantalla de inicio sigue visible, no inicies el temporizador
    if (frasesAleatorias.length === 0 || (startScreen && startScreen.style.display !== 'none')) return;
    
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


// Carga de Datos y Inicialización (SIN CAMBIOS)
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
        display.innerHTML = `[ERROR CRÍTICO] FALLO AL cargar ALEATORIAS. Verifica la URL de SheetDB.io y la conexión.`;
        statusMessage.textContent = "ERROR: No se pudo conectar a la base de datos (SheetDB).";
    }
}

async function inicializarSpiritBox() {
    display.innerHTML = "[Iniciando Sistema...]";
    
    // Forzar la carga de las voces antes de continuar
    synth.getVoices(); 

    setMasterVolume(currentVolume); 

    await cargarGuionPrincipal(); 
    await cargarFrasesAleatorias();

    if (!display.innerHTML.includes("ERROR CRÍTICO")) {
        iniciarRuidoVisual(); 
    }
    
    // Forzar la carga (preload) de todos los audios.
    if (staticAudio1) staticAudio1.load();
    if (staticAudio2) staticAudio2.load();
    if (sweepAudio) sweepAudio.load();
    if (voiceEffectAudio) voiceEffectAudio.load();
    
    // Esperamos el clic en la pantalla de inicio
    if (startScreen) {
        startScreen.addEventListener('click', handleStartClick, { once: true });
    }
}

// FUNCIÓN CLAVE QUE MANEJA EL CLIC DE INICIO Y ACTIVA LOS MP3
function handleStartClick() {
    // 1. Forzar la activación de los audios de fondo con el clic del usuario
    iniciarRuidosDeFondo(); 
    
    // 2. Ocultar la pantalla de inicio
    if (startScreen) {
        startScreen.style.display = 'none';
    }
    
    // 3. Finalizar la inicialización del Spirit Box
    currentStatusText.textContent = "IDLE";
    actualizarEnergyBar(20);
    reiniciarTemporizadorAleatorio();
    updateStatusMessage(); 
    statusMessage.textContent = "Sistema activado. Haga una pregunta.";
}


document.addEventListener('DOMContentLoaded', inicializarSpiritBox);
