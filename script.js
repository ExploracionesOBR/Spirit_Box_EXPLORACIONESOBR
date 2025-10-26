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

// Elementos de audio (se buscarán en la raíz del repositorio)
const staticAudio1 = document.getElementById('staticAudio1');
const staticAudio2 = document.getElementById('staticAudio2'); 
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

    // 1. Detener audio de estática y barrido
    detenerRuidosDeFondo();
    
    // 2. Reproducir efecto de voz (corte brusco)
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
        iniciarRuidosDeFondo(); // Reinicia el audio de fondo
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

// Lógica de Audio de Fondo (Estática y Barrido) - CRUCIAL PARA MÓVIL
async function iniciarRuidosDeFondo() {
    // Intentamos reproducir todos los audios de estática
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
        // Fallo al reproducir. Es normal antes del primer toque, no afecta el resto del código.
        console.warn("Fallo al reproducir audio. Esto es común en navegadores móviles antes del primer toque.", e);
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
    // Aseguramos que el audio de fondo se inicie si el temporizador dispara primero
    iniciarRuidosDeFondo(); 
    
    if (isSpeaking || frasesAleatorias.length === 0) {
        reiniciarTemporizadorAleatorio();
        return;
    }
    
    actualizarEnergyBar(energyLevel + 40); 
    
    const randomIndex = Math.floor(Math.random() * frasesAleatorias.length);
    const fraseAleatoria = frasesAleatorias[randomIndex];

    hablarComoSpiritBox(fraseAleatoria);
    statusMessage.textContent = `¡Detección de voz! Respuesta aleatoria (${frasesAleatorias.length} opciones) activada.`;
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
    // CRÍTICO: Aseguramos que los audios se inicien al presionar el botón (si no se iniciaron antes)
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


// ----------------------------------------------------
// PASO 5: Carga de Datos desde SheetDB.io (Doble Carga)
// ----------------------------------------------------

// Carga el guion principal
async function cargarGuionPrincipal() {
    statusMessage.textContent = "Conectando a SheetDB (Guion Secuencial)...";
    try {
        const response = await fetch(APPS_SCRIPT_URL_GUION);
        const data = await response.json(); 
        
        if (Array.isArray(data) && data.length > 0) {
            // *** CLAVE CORREGIDA: Usamos la clave 'B' para la Respuesta hablada (Columna B) ***
            // Usamos slice(2) para saltar las dos primeras filas de encabezado/ejemplo
            frasesGuion = data.slice(2).map(row => row.B || '').filter(f => f.length > 0);
            
            statusMessage.textContent = `Guion Secuencial cargado con ${frasesGuion.length} respuestas.`;
        } else {
             statusMessage.textContent = "Advertencia: Hoja 'Guion' vacía o mal formato. Guion Secuencial desactivado.";
        }
    } catch (error) {
        console.error("Error al cargar guion principal:", error);
        statusMessage.textContent = "Error al conectar con Guion Secuencial. Usando respaldo de emergencia.";
    }
}

// Carga las frases aleatorias
async function cargarFrasesAleatorias() {
    statusMessage.textContent = "Conectando a SheetDB (Frases Aleatorias)...";
    try {
        const response = await fetch(APPS_SCRIPT_URL_ALEATORIAS);
        const data = await response.json(); 
        
        if (Array.isArray(data) && data.length > 0) {
            // *** CLAVE CORREGIDA: Usamos la clave 'B' para la Respuesta hablada (Columna B) ***
            // Usamos slice(2) para saltar las dos primeras filas de encabezado/ejemplo
            frasesAleatorias = data.slice(2).map(row => row.B || '').filter(f => f.length > 0);

            statusMessage.textContent = `Guion Aleatorio cargado con ${frasesAleatorias.length} respuestas. ¡Listo!`;
        } else {
            statusMessage.textContent = "Advertencia: Hoja 'Aleatorias' vacía. Desactivando modo automático.";
        }
    } catch (error) {
        console.error("Error al cargar frases aleatorias:", error);
        statusMessage.textContent = "Error al conectar con Frases Aleatorias. Modo automático desactivado.";
    }
}

// Función principal de inicialización (doble carga)
async function inicializarSpiritBox() {
    display.innerHTML = "[Iniciando Sistema...]";
    await cargarGuionPrincipal();
    await cargarFrasesAleatorias();

    // SOLO INICIAMOS EL RUIDO VISUAL Y EL TEMPORIZADOR. EL AUDIO INICIA CON EL PRIMER CLIC.
    iniciarRuidoVisual(); 
    reiniciarTemporizadorAleatorio();
    
    statusMessage.textContent = `Sistema cargado. Guion: ${frasesGuion.length} | Aleatorias: ${frasesAleatorias.length}.`;
    actualizarEnergyBar(20);
}

// Llama a la función de inicialización al cargar la página
document.addEventListener('DOMContentLoaded', inicializarSpiritBox);

// CRÍTICO PARA MÓVIL: Inicia el audio de fondo al primer toque
document.addEventListener('click', () => {
    // Si la estática está detenida y el sistema no está hablando, intenta iniciarla
    if ((staticAudio1 && staticAudio1.paused) && !isSpeaking) {
        iniciarRuidosDeFondo();
    }
}, { once: true });
