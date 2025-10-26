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
let intervalId; // Para el ruido visual
let randomTimerId; // Para el temporizador de respuestas aleatorias

// *** CONTROL DE VELOCIDAD ***
const NORMAL_INTERVAL_MS = 8000; 
const FAST_INTERVAL_MS = 4000; 
let isFastSpeed = false; // Estado inicial: velocidad normal

// Elementos de audio
const staticAudio1 = document.getElementById('staticAudio1');
const staticAudio2 = document.getElementById('staticAudio2'); 
const sweepAudio = document.getElementById('sweepAudio');
const voiceEffectAudio = document.getElementById('voiceEffectAudio'); 

// Elementos visuales y de control
const energyBar = document.getElementById('energyBar');
let energyLevel = 0; 
let speakingTimeout; 
let currentVolume = 0.8; // Volumen inicial (80%)

// ----------------------------------------------------
// PASO 2: Lógica de Voz, Ruido y Volumen (Perilla)
// ----------------------------------------------------

// Función para ajustar el volumen de todos los audios
function setMasterVolume(volume) {
    currentVolume = Math.max(0, Math.min(1, volume)); // Limitar entre 0 y 1
    
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

    document.addEventListener('mousemove', ajustarVolumen);
    document.addEventListener('mouseup', detenerControlVolumen);
    document.addEventListener('touchmove', ajustarVolumen);
    document.addEventListener('touchend', detenerControlVolumen);
}

function ajustarVolumen(e) {
    if (!isDragging) return;

    const currentY = e.clientY || e.touches[0].clientY;
    const deltaY = startY - currentY; // Mover ARRIBA (Y menor) aumenta volumen
    
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
    
    setTimeout(() => {
        updateStatusMessage(); // Actualiza el mensaje de estado normal
    }, 1500); 
}


// Función para encontrar una voz en español de México (o similar)
function getMexicanVoice() {
    const voices = synth.getVoices();
    return voices.find(voice => voice.lang.includes('es-MX')) ||
           voices.find(voice => voice.lang.includes('es-ES')) ||
           voices.find(voice => voice.lang.startsWith('es'));
}

// *** FUNCIÓN CRÍTICA: HABLAR CON EFECTO ENTRECORTADO/ECO SIMULADO ***
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
        // Reproducir con el volumen maestro
        voiceEffectAudio.volume = currentVolume; 
        await voiceEffectAudio.play().catch(e => console.error("Error al reproducir voiceEffectAudio:", e));
    }

    const voice = getMexicanVoice();
    const voiceRate = isFastSpeed ? 1.4 : 1.0; 

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

        const fragmentLength = Math.floor(Math.random() * 3) + 1; 
        const fragment = textoArray.slice(currentIndex, currentIndex + fragmentLength).join('');
        
        display.innerHTML += fragment;
        currentIndex += fragmentLength;

        const fragmentUtterance = new SpeechSynthesisUtterance(fragment);
        
        if (voice) fragmentUtterance.voice = voice;
        fragmentUtterance.lang = 'es-MX'; 
        fragmentUtterance.rate = voiceRate;     
        fragmentUtterance.pitch = 1.0; 

        // Pequeño ruido de estática al inicio del fragmento (efecto entrecortado)
        if (staticAudio1) {
             staticAudio1.volume = currentVolume * 0.8;
             staticAudio1.play().catch(e => console.warn("Error al iniciar estática.", e));
             setTimeout(() => {
                 staticAudio1.volume = currentVolume * 0.6; 
             }, 50);
        }

        fragmentUtterance.onend = () => {
             const delay = Math.random() * 150 + 50; 
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
    }, 100); 
}

function detenerRuidoVisual() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

// Lógica de Audio de Fondo (Estática y Barrido)
async function iniciarRuidosDeFondo() {
    // Asegurarse de que el volumen maestro esté aplicado
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

// Actualiza el mensaje de estado general
function updateStatusMessage() {
    statusMessage.textContent = `Sistema listo. Guion: ${frasesGuion.length} | Aleatorias: ${frasesAleatorias.length}. (Modo ${isFastSpeed ? 'FAST' : 'NORMAL'} activo, siguiente en ${getCurrentInterval()/1000}s)`;
}


// ----------------------------------------------------
// PASO 3: Lógica de Velocidad (Botón SPEED)
// ----------------------------------------------------

function getCurrentInterval() {
    return isFastSpeed ? FAST_INTERVAL_MS : NORMAL_INTERVAL_MS;
}

function toggleSpeed() {
    isFastSpeed = !isFastSpeed; // Cambiar estado
    reiniciarTemporizadorAleatorio(); // Reiniciar el temporizador con el nuevo valor
    
    if (isFastSpeed) {
        statusMessage.textContent = "MODO VELOCIDAD (FAST): Respuestas más rápidas.";
    } else {
        statusMessage.textContent = "MODO VELOCIDAD (NORMAL): Respuestas normales.";
    }
    setTimeout(updateStatusMessage, 2000); // Volver al mensaje normal después de 2 segundos
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
    // El temporizador se reinicia dentro de hablarComoSpiritBox
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
    
    reiniciarTemporizadorAleatorio(); // Reinicia el temporizador aleatorio

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
    setTimeout(updateStatusMessage, 2000); // Volver al mensaje normal
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
    
    setMasterVolume(currentVolume); // Establecer el volumen inicial

    await cargarGuionPrincipal(); 
    await cargarFrasesAleatorias();

    if (!display.innerHTML.includes("ERROR CRÍTICO")) {
        iniciarRuidoVisual(); 
        reiniciarTemporizadorAleatorio();
        actualizarEnergyBar(20);
        updateStatusMessage(); // Mostrar el estado inicial
    }
}

document.addEventListener('DOMContentLoaded', inicializarSpiritBox);

// CRÍTICO PARA MÓVIL: Inicia el audio de fondo al primer toque
document.addEventListener('click', () => {
    if ((staticAudio1 && staticAudio1.paused) && !isSpeaking) {
        iniciarRuidosDeFondo();
        // Después del primer clic, removemos el listener 'once' y el mensaje de estado vuelve a la normalidad
        setTimeout(updateStatusMessage, 500); 
    }
}, { once: true });
