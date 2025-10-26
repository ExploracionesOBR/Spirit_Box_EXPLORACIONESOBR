// CÓDIGO DE JAVASCRIPT (Archivo script.js)

// ----------------------------------------------------
// PASO 1: Variables de Configuración
// ----------------------------------------------------

// *** ¡VERIFICA ESTA URL! ***
const APPS_SCRIPT_URL_GUION = "https://sheetdb.io/api/v1/ej186l5av6pq2"; 
// La URL para las frases aleatorias es la MISMA, pero debe apuntar a la hoja "Aleatorias"
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
const RANDOM_INTERVAL_MS = 15000; 

// Elementos de audio (se buscarán en la raíz del repositorio)
const staticAudio1 = document.getElementById('staticAudio1');
const staticAudio2 = document.getElementById('staticAudio2'); 
const sweepAudio = document.getElementById('sweepAudio');
const voiceEffectAudio = document.getElementById('voiceEffectAudio'); 

const energyBar = document.getElementById('energyBar');
let energyLevel = 0; 

// [ ... Las funciones hablarComoSpiritBox(), generarRuidoTexto(), iniciarRuidoVisual(), etc. son las mismas ... ]

// Función para simular el efecto de voz
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
        await voiceEffectAudio.play().catch(e => console.error("Error al reproducir voiceEffectAudio:", e));
    }
    display.innerHTML = `<span class="frase-actual">${texto}</span>`;
    actualizarEnergyBar(100); 
    let utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-MX'; 
    utterance.rate = 1.0;     
    utterance.pitch = 0.9;    
    utterance.onend = () => {
        isSpeaking = false;
        if (voiceEffectAudio) voiceEffectAudio.pause();
        iniciarRuidosDeFondo(); 
        iniciarRuidoVisual(); 
        actualizarEnergyBar(30); 
        reiniciarTemporizadorAleatorio(); 
    };
    synth.speak(utterance);
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
        statusMessage.textContent = "FIN DEL GUION. Reiniciando la secuencia.";
        fraseActualIndex = 0; 
    }
    const fraseSecreta = frasesGuion[fraseActualIndex];
    statusMessage.textContent = `Reproduciendo Frase Guion #${fraseActualIndex + 1}`; 
    hablarComoSpiritBox(fraseSecreta);
    fraseActualIndex++;
}


// Carga el guion principal
async function cargarGuionPrincipal() {
    statusMessage.textContent = "Conectando a SheetDB (Guion Secuencial)...";
    try {
        const response = await fetch(APPS_SCRIPT_URL_GUION);
        // *** CRÍTICO: Comprobamos si la respuesta es OK antes de intentar leer JSON ***
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
        // *** MENSAJE DE ERROR MÁS CLARO PARA EL USUARIO ***
        display.innerHTML = `[ERROR CRÍTICO] FALLO AL CARGAR GUION: ${error.message}. Verifica la URL de SheetDB.io y la conexión.`;
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
        display.innerHTML = `[ERROR CRÍTICO] FALLO AL CARGAR ALEATORIAS: ${error.message}. Verifica la URL de SheetDB.io y la conexión.`;
        statusMessage.textContent = "ERROR: No se pudo conectar a la base de datos (SheetDB).";
    }
}

// Función principal de inicialización (doble carga)
async function inicializarSpiritBox() {
    display.innerHTML = "[Iniciando Sistema...]";
    // Si la carga de GUION PRINCIPAL falla, el código se detendrá allí y mostrará el error.
    await cargarGuionPrincipal(); 
    await cargarFrasesAleatorias();

    // Solo continuamos si no hay un error crítico visible en la pantalla
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
