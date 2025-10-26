// CÓDIGO DE JAVASCRIPT (Archivo script.js)

// ----------------------------------------------------
// PASO 1: Variables de Configuración
// ----------------------------------------------------

// *** URL DE TU API DE SHEETDB.IO ***
const APPS_SCRIPT_URL = "https://sheetdb.io/api/v1/ej186l5av6pq2"; 

let frasesGuion = [];       // Almacena las frases cargadas
let fraseActualIndex = 0;   // Contador secuencial para el guion

const synth = window.speechSynthesis;
let display = document.getElementById('display');
let statusMessage = document.getElementById('status');
let isSpeaking = false;
let intervalId; 

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

    // Muestra la frase en la pantalla con efecto glitch
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
    // Genera una secuencia aleatoria de 30 caracteres
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
    
    // Si llegamos al final del guion, reiniciamos la secuencia
    if (fraseActualIndex >= frasesGuion.length) {
        statusMessage.textContent = "FIN DEL GUION. Reiniciando la secuencia.";
        fraseActualIndex = 0; 
    }

    // Obtiene la frase secuencial del guion y la reproduce
    const fraseSecreta = frasesGuion[fraseActualIndex];
    
    // Mostramos el número de respuesta antes de aumentar el contador
    statusMessage.textContent = `Reproduciendo Frase #${fraseActualIndex + 1}`; 
    
    hablarComoSpiritBox(fraseSecreta);
    fraseActualIndex++;

    
}


// ----------------------------------------------------
// PASO 4: Carga de Datos desde SheetDB.io (¡CORREGIDO!)
// ----------------------------------------------------

async function cargarGuionDesdeSheets() {
    statusMessage.textContent = "Conectando a SheetDB.io...";
    try {
        const response = await fetch(APPS_SCRIPT_URL);
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}. Revisa la URL de SheetDB.`);
        }
        
        const data = await response.json(); 
        
        if (Array.isArray(data) && data.length > 0) {
            
            // *** CORRECCIÓN CLAVE: Usamos .slice(1) para ignorar la fila de guía/encabezado duplicado.
            // Además, usamos la clave 'A' que nos da el JSON.
            frasesGuion = data.slice(1).map(row => row.A || ''); 

            // Filtramos cualquier posible fila vacía que haya generado SheetDB
            frasesGuion = frasesGuion.filter(f => f.length > 0);

            statusMessage.textContent = `Guion cargado con ${frasesGuion.length} respuestas. ¡Listo!`;
            
        } else {
            frasesGuion = ["Error de datos", "Revisa tu Sheet DB", "No hay frases"];
            statusMessage.textContent = "Advertencia: Guion vacío o con formato incorrecto. Usando respaldo.";
        }
    } catch (error) {
        console.error("Error al cargar el guion:", error);
        frasesGuion = ["Error de conexión", "Inténtalo de nuevo"];
        statusMessage.textContent = "Error al conectar con SheetDB. Usando respaldo de emergencia.";
    }
    
    // Inicia la simulación de ruido una vez que los datos están cargados
    iniciarRuidoAleatorio();
}

// Llama a la función de carga al iniciar la página
cargarGuionDesdeSheets();
