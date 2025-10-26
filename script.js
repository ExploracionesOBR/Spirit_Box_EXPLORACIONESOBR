// CÓDIGO DE JAVASCRIPT (Archivo script.js)

// ----------------------------------------------------
// PASO 1: Variables de Configuración
// ----------------------------------------------------

// *** URL DE TU API DE SHEETDB.IO (MANTÉN TU URL CORRECTA AQUÍ) ***
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

// *** AJUSTE DE TIEMPO: REDUCIDO A 8 SEGUNDOS ***
const RANDOM_INTERVAL_MS = 8000; 

// Elementos de audio (se buscarán en la raíz del repositorio)
const staticAudio1 = document.getElementById('staticAudio1');
const staticAudio2 = document.getElementById('staticAudio2'); 
const sweepAudio = document.getElementById('sweepAudio');
const voiceEffectAudio = document.getElementById('voiceEffectAudio'); 

const energyBar = document.getElementById('energyBar');
let energyLevel = 0; 
let speakingTimeout; // Para el efecto entrecortado

// ----------------------------------------------------
// PASO 2: Lógica de Voz y Ruido
// ----------------------------------------------------

// Función para encontrar una voz en español de México (o similar)
function getMexicanVoice() {
    const voices = synth.getVoices();
    // Priorizamos voces de México, luego de España, luego cualquier español.
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
    
    // Reproducir efecto inicial de ruido/barrido
    if (voiceEffectAudio) {
        voiceEffectAudio.currentTime = 0;
        await voiceEffectAudio.play().catch(e => console.error("Error al reproducir voiceEffectAudio:", e));
    }

    const voice = getMexicanVoice();
    let utterance = new SpeechSynthesisUtterance(texto);
    
    // AJUSTES DE VOZ PARA SER MÁS NORMALES Y CREÍBLES (MEXICANO/ESPAÑOL)
    if (voice) {
        utterance.voice = voice;
    } else {
        utterance.lang = 'es-MX'; 
    }
    utterance.rate = 1.0;     
    utterance.pitch = 1.0; // Tono neutro

    const textoArray = texto.toUpperCase().split('');
    let currentIndex = 0;
    const totalDuration = texto.length * 150; // Estimación de duración total (150ms por caracter)

    display.innerHTML = "";
    actualizarEnergyBar(100);

    // Función que simula el entrecortado
    function speakFragment() {
        if (!isSpeaking || currentIndex >= textoArray.length) {
            // FIN DE LA FRASE
            isSpeaking = false;
            if (voiceEffectAudio) voiceEffectAudio.pause();
            iniciarRuidosDeFondo(); 
            iniciarRuidoVisual(); 
            actualizarEnergyBar(30); 
            reiniciarTemporizadorAleatorio(); // Reinicia el temporizador de aleatorias
            return;
        }

        const fragmentLength = Math.floor(Math.random() * 3) + 1; // 1 a 3 caracteres por fragmento
        const fragment = textoArray.slice(currentIndex, currentIndex + fragmentLength).join('');
        
        display.innerHTML += fragment;
        currentIndex += fragmentLength;

        // Reproducir fragmento de voz
        const fragmentUtterance = new SpeechSynthesisUtterance(fragment);
        fragmentUtterance.lang = utterance.lang;
        fragmentUtterance.rate = utterance.rate;
        fragmentUtterance.pitch = utterance.pitch;
        if (voice) fragmentUtterance.voice = voice;

        // Pequeño ruido de estática al inicio del fragmento (efecto entrecortado)
        if (staticAudio1) {
             staticAudio1.volume = 0.8;
             staticAudio1.play().catch(e => console.warn("Error al iniciar estática.", e));
             setTimeout(() => {
                 staticAudio1.volume = 0.6; // Bajar volumen al hablar
             }, 50);
        }


        fragmentUtterance.onend = () => {
             // Pequeño delay de 50ms a 200ms para el "glitch"
             const delay = Math.random() * 150 + 50; 
             speakingTimeout = setTimeout(speakFragment, delay);
        };
        
        // Manejo de interrupción si el usuario presiona otro botón
        if (isSpeaking) {
             synth.speak(fragmentUtterance);
        } else {
             synth.cancel();
        }
    }

    speakFragment();
}


// Genera un fragmento de texto de ruido (sin cambios)
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

// Lógica de Audio de Fondo (Estática y Barrido) - CRUCIAL PARA MÓVIL
async function iniciarRuidosDeFondo() {
    try {
        if (staticAudio1) {
            staticAudio1.volume = 0.6;
            await staticAudio1.play();
        }
        if (staticAudio2) {
            staticAudio2.volume = 0.3;
            await staticAudio2.play();
        }
        if (sweepAudio) {
            sweepAudio.volume = 0.3; 
            sweepAudio.loop = true; 
            await sweepAudio.play();
        }
    } catch (e) {
        console.warn("Fallo al reproducir audio. Intenta tocar la pantalla.", e);
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


// ----------------------------------------------------
// PASO 3: Lógica de Respuesta Aleatoria (Automática)
// ----------------------------------------------------

function dispararRespuestaAleatoria() {
    iniciarRuidosDeFondo(); 
    
    // *** CAMBIO: Si no hay frases aleatorias, reiniciamos el temporizador para verificar de nuevo. ***
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
    
    randomTimerId = setTimeout(dispararRespuestaAleatoria, RANDOM_INTERVAL_MS);
    if (!isSpeaking) {
        statusMessage.textContent = `Sistema listo. Guion: ${frasesGuion.length} | Aleatorias: ${frasesAleatorias.length}. (Modo AUTO activo, siguiente en ${RANDOM_INTERVAL_MS/1000}s)`;
    }
    actualizarEnergyBar(20 + Math.random() * 20); 
}

function reiniciarTemporizadorAleatorio() {
    clearTimeout(randomTimerId);
    iniciarTemporizadorAleatorio();
}


// ----------------------------------------------------
// PASO 4: Lógica del Guion (Activado por el botón)
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
    
    // *** CAMBIO: El guion no se repite si termina, se queda en la última frase. ***
    if (fraseActualIndex >= frasesGuion.length) {
        statusMessage.textContent = "FIN DEL GUION. Pulsa para la última frase.";
        fraseActualIndex = frasesGuion.length - 1; 
    }

    const fraseSecreta = frasesGuion[fraseActualIndex];
    
    statusMessage.textContent = `Reproduciendo Frase Guion #${fraseActualIndex + 1}`; 
    
    hablarComoSpiritBox(fraseSecreta);
    
    // Solo avanza si no es la última frase
    if (fraseActualIndex < frasesGuion.length - 1) {
        fraseActualIndex++;
    }
}


// ----------------------------------------------------
// PASO 5: Carga de Datos desde SheetDB.io (Doble Carga)
// ----------------------------------------------------

// Carga el guion principal
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
            statusMessage.textContent = `Guion Secuencial cargado con ${frasesGuion.length} respuestas.`;
        } else {
             statusMessage.textContent = "Advertencia: Hoja 'Guion' vacía o mal formato.";
        }
    } catch (error) {
        console.error("Error al cargar guion principal:", error);
        display.innerHTML = `[ERROR CRÍTICO] FALLO AL CARGAR GUION: ${error.message}. Verifica la URL de SheetDB.io.`;
        statusMessage.textContent = "ERROR: No se pudo conectar a la base de datos (SheetDB).";
    }
}

// Carga las frases aleatorias
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
            statusMessage.textContent = `Guion Aleatorio cargado con ${frasesAleatorias.length} respuestas. ¡Listo!`;
        } else {
            statusMessage.textContent = "Advertencia: Hoja 'Aleatorias' vacía.";
        }
    } catch (error) {
        console.error("Error al cargar frases aleatorias:", error);
        display.innerHTML = `[ERROR CRÍTICO] FALLO AL CARGAR ALEATORIAS: ${error.message}. Verifica la URL de SheetDB.io.`;
        statusMessage.textContent = "ERROR: No se pudo conectar a la base de datos (SheetDB).";
    }
}

// Función principal de inicialización (doble carga)
async function inicializarSpiritBox() {
    display.innerHTML = "[Iniciando Sistema...]";
    await cargarGuionPrincipal(); 
    await cargarFrasesAleatorias();

    if (!display.innerHTML.includes("ERROR CRÍTICO")) {
        iniciarRuidoVisual(); 
        reiniciarTemporizadorAleatorio();
        statusMessage.textContent = `Sistema cargado. Guion: ${frasesGuion.length} | Aleatorias: ${frasesAleatorias.length}.`;
        actualizarEnergyBar(20);
    }
}

document.addEventListener('DOMContentLoaded', inicializarSpiritBox);

document.addEventListener('click', () => {
    if ((staticAudio1 && staticAudio1.paused) && !isSpeaking) {
        iniciarRuidosDeFondo();
    }
}, { once: true });
