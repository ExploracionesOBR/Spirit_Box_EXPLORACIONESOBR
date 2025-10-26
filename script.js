// CÓDIGO DE JAVASCRIPT (Archivo script.js)

// ----------------------------------------------------
// PASO 1: Variables de Configuración
// ----------------------------------------------------

// *** URL DE TU API DE SHEETDB.IO ***
const APPS_SCRIPT_URL_GUION = "https://sheetdb.io/api/v1/ej186l5av6pq2"; 
// La URL para las frases aleatorias es la MISMA, pero debe apuntar a la hoja "Aleatorias"
const APPS_SCRIPT_URL_ALEATORIAS = APPS_SCRIPT_URL_GUION + "?sheet=Aleatorias"; 

let frasesGuion = [];       // Almacena las frases secuenciales (Hoja Guion)
let frasesAleatorias = [];  // Almacena las frases aleatorias (Hoja Aleatorias)
let fraseActualIndex = 0;   // Contador secuencial

const synth = window.speechSynthesis;
let display = document.getElementById('display');
let statusMessage = document.getElementById('status');
let isSpeaking = false;
let intervalId; 
let randomTimerId; // ID del temporizador para respuestas automáticas
const RANDOM_INTERVAL_MS = 15000; // 15 segundos (Tiempo de espera antes de respuesta aleatoria)

// Elementos de audio
const staticAudio1 = document.getElementById('staticAudio1');
const staticAudio2 = document.getElementById('staticAudio2'); // NUEVO AUDIO
const sweepAudio = document.getElementById('sweepAudio');
const voiceEffectAudio = document.getElementById('voiceEffectAudio'); 

// Elementos visuales
const energyBar = document.getElementById('energyBar');
let energyLevel = 0; // 0-100 para la barra de energía


// ----------------------------------------------------
// PASO 2: Lógica de Voz y Ruido
// ----------------------------------------------------

// Función para simular el efecto de voz
async function hablarComoSpiritBox(texto) {
    if (!synth) {
        display.innerHTML = "[ERROR: Voz no soportada]";
        return;
    }

    detenerRuidoVisual(); 
    synth.cancel(); 
    isSpeaking = true;

    // Detener audio de estática y barrido
    detenerRuidosDeFondo();
    
    // Reproducir efecto de voz (solo si existe)
    if (voiceEffectAudio) {
        voiceEffectAudio.currentTime = 0;
        await voiceEffectAudio.play().catch(e => console.error("Error al reproducir voiceEffectAudio:", e));
    }

    display.innerHTML = `<span class="frase-actual">${texto}</span>`;
    actualizarEnergyBar(100); // Barra de energía al máximo al hablar

    let utterance = new SpeechSynthesisUtterance(texto);
    
    // AJUSTE DE VOZ: Español neutro/mexicano con tono moderado
    utterance.lang = 'es-MX'; 
    utterance.rate = 1.0;     
    utterance.pitch = 0.9;    
    
    utterance.onend = () => {
        isSpeaking = false;
        // Volvemos a los ruidos de fondo y visuales
        if (voiceEffectAudio) voiceEffectAudio.pause();
        iniciarRuidosDeFondo(); 
        iniciarRuidoVisual(); 
        actualizarEnergyBar(30); 
        reiniciarTemporizadorAleatorio(); 
    };

    synth.speak(utterance);
    console.log(`[Voz] Diciendo: ${texto}`);
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

// Lógica de Audio de Fondo (Estática y Barrido)
async function iniciarRuidosDeFondo() {
    // Intentamos reproducir staticAudio1 y staticAudio2
    if (staticAudio1) {
        staticAudio1.volume = 0.6;
        await staticAudio1.play().catch(e => console.warn("No se pudo reproducir staticAudio1:", e));
    }
    if (staticAudio2) {
        staticAudio2.volume = 0.3; // Volumen más bajo para el segundo loop
        await staticAudio2.play().catch(e => console.warn("No se pudo reproducir staticAudio2:", e));
    }
    
    if (sweepAudio) {
        sweepAudio.volume = 0.3; 
        sweepAudio.loop = true; 
        await sweepAudio.play().catch(e => console.warn("No se pudo reproducir sweepAudio:", e));
    }
}

function detenerRuidosDeFondo() {
    if (staticAudio1) staticAudio1.pause();
    if (staticAudio2) staticAudio2.pause();
    if (sweepAudio) sweepAudio.pause();
}

// Lógica de Barra de Energía
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
    if (isSpeaking || frasesAleatorias.length === 0) {
        reiniciarTemporizadorAleatorio();
        return;
    }
    
    actualizarEnergyBar(energyLevel + 40); 
    
    const randomIndex = Math.floor(Math.random() * frasesAleatorias.length);
    const fraseAleatoria = frasesAleatorias[randomIndex];

    hablarComoSpiritBox(fraseAle
