// CÓDIGO DE JAVASCRIPT (Archivo script.js)

// ----------------------------------------------------
// PASO 1: Variables de Configuración
// ----------------------------------------------------

// *** REEMPLAZA ESTA URL con la URL de Despliegue que obtuviste en el Paso 3 ***
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztaRku_s5CgBsgidkNvf3PQnc-UIHg6V6B0VIPfVRKcn-jMho8yorBS6Y3XQiXg9zF/exec"; 

let frasesGuion = [];       // Almacena las frases cargadas del Sheet
let fraseActualIndex = 0;   // Contador para saber qué frase del guion sigue

const synth = window.speechSynthesis;
let display = document.getElementById('display');
let statusMessage = document.getElementById('status');
let isSpeaking = false;
let intervalId; // Para controlar el ruido aleatorio


// ----------------------------------------------------
// PASO 2: Lógica de Voz y Ruido
// ----------------------------------------------------

// Función para simular el efecto de voz de Spirit Box (con distorsión)
function hablarComoSpiritBox(texto) {
    if (!synth) {
        display.innerHTML = "[ERROR: Voz no soportada]";
        return;
    }

    // Detiene cualquier habla actual, incluyendo el ruido
    detenerRuido();
    synth.cancel(); 
    isSpeaking = true;

    // Muestra la frase en la pantalla con efecto
    display.innerHTML = `<span class="frase-actual">${texto}</span>`;

    let utterance = new SpeechSynthesisUtterance(texto);
    
    // Configuración de la voz para efecto 'espeluznante'
    utterance.lang = 'es-ES'; 
    utterance.rate = 0.8;    // Velocidad: Ligeramente más lenta
    utterance.pitch = 0.5;   // Tono: Más bajo
    
    utterance.onend = () => {
        isSpeaking = false;
        // Una vez que termina de hablar, volvemos al modo de ruido
        iniciarRuidoAleatorio(); 
    };

    synth.speak(utterance);
    
    console.log(`[TRUCO] Diciendo: ${texto}`);
}

// Genera un fragmento de texto de ruido (simula el barrido de radio)
function generarRuidoTexto() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_#@* ";
    let noise = "";
    for (let i = 0; i < 30; i++) {
        noise += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return noise;
}

function iniciarRuidoAleatorio() {
    if (intervalId) return; 

    // Muestra ruido de texto parpadeante cada 100ms
    intervalId = setInterval(() => {
        if (!isSpeaking) {
             display.innerHTML = generarRuidoTexto();
        }
    }, 100); 

    // Opcional: añade el sonido de estática de radio de fondo aquí.
}

function detenerRuido() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}


// ----------------------------------------------------
// PASO 3: Lógica del Guion (Activado por el botón)
// ----------------------------------------------------

function activarTruco() {
    if (isSpeaking) {
        statusMessage.textContent = "¡Esperando a que el espíritu termine de hablar!";
        return;
    }

    if (frasesGuion.length === 0) {
        statusMessage.textContent = "Error: Guion no cargado.";
        return;
    }
    
    if (fraseActualIndex >= frasesGuion.length) {
        statusMessage.textContent = "FIN DEL GUION. Reiniciando la secuencia.";
        fraseActualIndex = 0; // Reinicia para demostraciones continuas
    }

    // Obtiene la frase secuencial del guion
    const fraseSecreta = frasesGuion[fraseActualIndex];
    
    // Ejecuta la función de voz y avanza el índice
    hablarComoSpiritBox(fraseSecreta);
    fraseActualIndex++;

    statusMessage.textContent = `Pregunta ${fraseActualIndex} activada.`;
}


// ----------------------------------------------------
// PASO 4: Carga de Datos desde Google Sheets
// ----------------------------------------------------

async function cargarGuionDesdeSheets() {
    statusMessage.textContent = "Conectando a Google Sheets...";
    try {
        const response = await fetch(APPS_SCRIPT_URL);
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.frases && data.frases.length > 0) {
            frasesGuion = data.frases;
            statusMessage.textContent = `Guion cargado con ${frasesGuion.length} respuestas. ¡Listo!`;
        } else {
            frasesGuion = ["Hola", "No hay frases", "Cargadas"];
            statusMessage.textContent = "Advertencia: Guion cargado sin frases. Usando respaldo.";
        }
    } catch (error) {
        console.error("Error al cargar el guion:", error);
        frasesGuion = ["Error de conexión", "Inténtalo de nuevo"];
        statusMessage.textContent = "Error al conectar con Sheets. Usando respaldo de emergencia.";
    }
    
    // Inicia la simulación de ruido una vez que los datos están cargados
    iniciarRuidoAleatorio();
}

// Llama a la función de carga al iniciar la página
cargarGuionDesdeSheets();
