const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const startButton = document.getElementById("startButton");
const switchButton = document.getElementById("switchButton");

const status = document.getElementById("status");

const flash = document.getElementById("flash");
const miniatura = document.getElementById("miniaturaCaptura");
const descargaCaptura = document.getElementById("descargaCaptura");

const ctx = canvas.getContext("2d");

let stream = null;
let camaraFrontal = true;
let camaraActiva = false;


// =====================================================
// BOTONES
// (se registran YA, antes de tocar MediaPipe, para que
// la cámara funcione aunque los modelos fallen al cargar)
// =====================================================

startButton.addEventListener("click", toggleCamara);
switchButton.addEventListener("click", cambiarCamara);


// =====================================================
// CONEXIONES DEL CUERPO
// =====================================================

const conexionesCuerpo = [
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10],
    [11, 12],
    [11, 13], [13, 15],
    [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24],
    [23, 25], [25, 27],
    [24, 26], [26, 28],
    [27, 29], [29, 31],
    [28, 30], [30, 32]
];


// =====================================================
// CONEXIONES DE LA MANO
// =====================================================

const conexionesMano = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17]
];


// =====================================================
// BRILLO ADAPTATIVO SEGÚN EL AMBIENTE
// Mide la luminosidad real del video y calcula, poco a
// poco (sin parpadeos), cuánto brillo/contraste aplicar.
// Se usa tanto para lo que ves como para lo que analizan
// los modelos de manos y cuerpo.
// =====================================================

const sampleCanvas = document.createElement("canvas");
sampleCanvas.width = 16;
sampleCanvas.height = 9;
const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });

let filtroActual = { brillo: 1.0, contraste: 1.0, saturacion: 1.0 };
let contadorMuestreo = 0;

function medirLuminosidadPromedio() {

    if (!video.videoWidth || !video.videoHeight) {
        return 128; // valor neutro si aún no hay video
    }

    sampleCtx.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);

    let datos;
    try {
        datos = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
    } catch (error) {
        return 128;
    }

    let total = 0;
    let pixeles = 0;

    for (let i = 0; i < datos.length; i += 4) {
        const r = datos[i];
        const g = datos[i + 1];
        const b = datos[i + 2];
        // luminancia percibida
        total += (0.299 * r) + (0.587 * g) + (0.114 * b);
        pixeles++;
    }

    return total / pixeles; // 0 (muy oscuro) - 255 (muy claro)
}

function calcularFiltroObjetivo(luminosidad) {

    // Ambiente muy oscuro
    if (luminosidad < 50) {
        return { brillo: 2.0, contraste: 1.4, saturacion: 1.15 };
    }
    // Ambiente oscuro
    if (luminosidad < 90) {
        return { brillo: 1.6, contraste: 1.25, saturacion: 1.1 };
    }
    // Ambiente algo bajo de luz
    if (luminosidad < 130) {
        return { brillo: 1.25, contraste: 1.1, saturacion: 1.05 };
    }
    // Ambiente normal
    if (luminosidad < 190) {
        return { brillo: 1.0, contraste: 1.0, saturacion: 1.0 };
    }
    // Ambiente muy claro / sobreexpuesto: bajar un poco
    return { brillo: 0.9, contraste: 0.95, saturacion: 0.95 };
}

function actualizarBrilloAdaptativo() {

    // Solo recalcular cada cierto número de cuadros (rendimiento)
    contadorMuestreo++;
    if (contadorMuestreo % 12 !== 0) return;

    const luminosidad = medirLuminosidadPromedio();
    const objetivo = calcularFiltroObjetivo(luminosidad);

    // Transición suave para evitar parpadeos bruscos
    const suavizado = 0.15;
    filtroActual.brillo += (objetivo.brillo - filtroActual.brillo) * suavizado;
    filtroActual.contraste += (objetivo.contraste - filtroActual.contraste) * suavizado;
    filtroActual.saturacion += (objetivo.saturacion - filtroActual.saturacion) * suavizado;

    const filtroCSS =
        `brightness(${filtroActual.brillo.toFixed(2)}) ` +
        `contrast(${filtroActual.contraste.toFixed(2)}) ` +
        `saturate(${filtroActual.saturacion.toFixed(2)})`;

    // Aplica el mismo realce a lo que ves...
    video.style.filter = filtroCSS;
    // ...y a lo que analizan los modelos (canvas oculto)
    brightCtx.filter = filtroCSS;
}


// =====================================================
// FRAME MEJORADO PARA LOS MODELOS
// =====================================================

const brightCanvas = document.createElement("canvas");
const brightCtx = brightCanvas.getContext("2d");

function obtenerFrameMejorado() {

    if (!video.videoWidth || !video.videoHeight) {
        return video;
    }

    brightCanvas.width = video.videoWidth;
    brightCanvas.height = video.videoHeight;

    brightCtx.drawImage(video, 0, 0, brightCanvas.width, brightCanvas.height);

    return brightCanvas;
}


// =====================================================
// ESPEJO (modo selfie en cámara frontal)
// =====================================================

function actualizarEspejo() {
    video.classList.toggle("mirror", camaraFrontal);
    canvas.classList.toggle("mirror", camaraFrontal);
}


// =====================================================
// INICIAR CÁMARA
// =====================================================

async function iniciarCamara() {

    try {

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: camaraFrontal ? "user" : "environment",
                width: { ideal: 960 },
                height: { ideal: 540 }
            },
            audio: false
        });

        video.srcObject = stream;
        await video.play();

        camaraActiva = true;
        actualizarEspejo();
        ajustarCanvas();

        startButton.textContent = "⏹️ Detener cámara";

        status.textContent = camaraFrontal
            ? "🟢 Cámara frontal activa — rastreo iniciado"
            : "🟢 Cámara trasera activa — rastreo iniciado";

    } catch (error) {
        console.error(error);

        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            status.textContent = "❌ Permiso de cámara denegado. Revisa los ajustes del navegador.";
        } else if (error.name === "NotFoundError") {
            status.textContent = "❌ No se encontró ninguna cámara disponible.";
        } else if (error.name === "NotReadableError") {
            status.textContent = "❌ La cámara está siendo usada por otra app.";
        } else {
            status.textContent = "❌ No se pudo acceder a la cámara.";
        }
    }
}


// =====================================================
// DETENER CÁMARA
// =====================================================

function detenerCamara() {

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    camaraActiva = false;
    video.srcObject = null;
    video.style.filter = "";

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ultimoCuerpo = null;
    ultimasManos = [];

    startButton.textContent = "📷 Iniciar cámara";
    status.textContent = "Cámara detenida";
}


// =====================================================
// TOGGLE INICIAR / DETENER
// =====================================================

function toggleCamara() {
    if (camaraActiva) {
        detenerCamara();
    } else {
        iniciarCamara();
    }
}


// =====================================================
// CAMBIAR CÁMARA (frontal / trasera)
// =====================================================

async function cambiarCamara() {

    camaraFrontal = !camaraFrontal;

    if (camaraActiva) {
        await iniciarCamara();
    } else {
        actualizarEspejo();
    }
}


// =====================================================
// AJUSTAR CANVAS
// =====================================================

function ajustarCanvas() {

    if (!video.videoWidth || !video.videoHeight) {
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
}

video.addEventListener("loadedmetadata", ajustarCanvas);


// =====================================================
// DIBUJAR PUNTO
// =====================================================

function dibujarPunto(x, y, radio = 5) {
    ctx.beginPath();
    ctx.arc(x * canvas.width, y * canvas.height, radio, 0, Math.PI * 2);
    ctx.fill();
}


// =====================================================
// DIBUJAR LÍNEA
// =====================================================

function dibujarLinea(puntoA, puntoB, ancho = 4) {
    ctx.beginPath();
    ctx.moveTo(puntoA.x * canvas.width, puntoA.y * canvas.height);
    ctx.lineTo(puntoB.x * canvas.width, puntoB.y * canvas.height);
    ctx.lineWidth = ancho;
    ctx.stroke();
}


// =====================================================
// VALIDACIÓN DE CUERPO REAL
// Evita dibujar el esqueleto verde cuando solo se ve
// una mano o un brazo y el modelo "inventa" una postura.
// Exige ver al menos un hombro Y una cadera con buena
// confianza antes de aceptar la detección.
// =====================================================

const UMBRAL_VISIBILIDAD = 0.55;

function visible(punto) {
    return punto && (punto.visibility === undefined || punto.visibility >= UMBRAL_VISIBILIDAD);
}

function esCuerpoValido(landmarks) {

    if (!landmarks) return false;

    const hombroIzq = landmarks[11];
    const hombroDer = landmarks[12];
    const caderaIzq = landmarks[23];
    const caderaDer = landmarks[24];

    const hayHombro = visible(hombroIzq) || visible(hombroDer);
    const hayCadera = visible(caderaIzq) || visible(caderaDer);

    // Se necesita al menos un hombro Y una cadera reales
    // para considerar que hay un torso/cuerpo en cámara.
    return hayHombro && hayCadera;
}


// =====================================================
// PUNTOS INTERMEDIOS EN EXTREMIDADES
// Añade puntos entre las articulaciones principales
// (hombro-codo, codo-muñeca, cadera-rodilla, rodilla-
// tobillo) para dar sensación de mayor flexibilidad.
// =====================================================

function dibujarPuntosIntermedios(puntoA, puntoB, cantidad = 2, radio = 3.5) {

    if (!puntoA || !puntoB) return;

    for (let i = 1; i <= cantidad; i++) {
        const t = i / (cantidad + 1);
        const x = puntoA.x + (puntoB.x - puntoA.x) * t;
        const y = puntoA.y + (puntoB.y - puntoA.y) * t;
        dibujarPunto(x, y, radio);
    }
}

const segmentosConPuntosExtra = [
    [11, 13], [13, 15], // brazo izquierdo: hombro-codo, codo-muñeca
    [12, 14], [14, 16], // brazo derecho
    [23, 25], [25, 27], // pierna izquierda: cadera-rodilla, rodilla-tobillo
    [24, 26], [26, 28]  // pierna derecha
];


// =====================================================
// DIBUJAR CUERPO
// =====================================================

function dibujarCuerpo(landmarks) {

    if (!landmarks) return;

    ctx.strokeStyle = "#00ff66";
    ctx.lineWidth = 5;

    conexionesCuerpo.forEach(([a, b]) => {

        const puntoA = landmarks[a];
        const puntoB = landmarks[b];

        if (!visible(puntoA) || !visible(puntoB)) return;

        dibujarLinea(puntoA, puntoB, 5);
    });

    // Puntos principales (articulaciones)
    ctx.fillStyle = "#00ff66";

    landmarks.forEach(punto => {
        if (!visible(punto)) return;
        dibujarPunto(punto.x, punto.y, 6);
    });

    // Puntos extra en brazos y piernas: más "flexibilidad" visual
    ctx.fillStyle = "#7dffb0";

    segmentosConPuntosExtra.forEach(([a, b]) => {
        const puntoA = landmarks[a];
        const puntoB = landmarks[b];

        if (!visible(puntoA) || !visible(puntoB)) return;

        dibujarPuntosIntermedios(puntoA, puntoB, 2, 3.5);
    });

    // Codos y rodillas resaltados (más grandes, para verse
    // claramente como puntos de articulación con flexibilidad)
    ctx.fillStyle = "#00ff66";
    [13, 14, 25, 26].forEach(indice => {
        const punto = landmarks[indice];
        if (visible(punto)) dibujarPunto(punto.x, punto.y, 8);
    });
}


// =====================================================
// DIBUJAR PALMA (pentágono: muñeca + base de los 4 dedos)
// =====================================================

const indicesPalma = [0, 5, 9, 13, 17];

function dibujarPalma(landmarks, colorRelleno) {

    const puntos = indicesPalma.map(i => landmarks[i]);

    if (puntos.some(p => !p)) return;

    ctx.beginPath();

    ctx.moveTo(puntos[0].x * canvas.width, puntos[0].y * canvas.height);

    for (let i = 1; i < puntos.length; i++) {
        ctx.lineTo(puntos[i].x * canvas.width, puntos[i].y * canvas.height);
    }

    ctx.closePath();

    ctx.fillStyle = colorRelleno;
    ctx.fill();

    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
}


// Puntas de los dedos (últimas falanges): resaltadas distinto
const puntasDedos = [4, 8, 12, 16, 20];
// Nudillos base de cada dedo
const nudillosBase = [1, 5, 9, 13, 17];


// =====================================================
// DIBUJAR MANO
// =====================================================

function dibujarMano(landmarks, numeroMano) {

    if (!landmarks) return;

    let colorPrincipal;
    let colorPalma;

    if (numeroMano === 0) {
        colorPrincipal = "#00aaff";
        colorPalma = "rgba(0, 170, 255, 0.25)";
    } else {
        colorPrincipal = "#ff00ff";
        colorPalma = "rgba(255, 0, 255, 0.25)";
    }

    ctx.strokeStyle = colorPrincipal;
    ctx.fillStyle = colorPrincipal;

    // Pentágono de la palma (debajo de los dedos)
    dibujarPalma(landmarks, colorPalma);

    // Líneas de los dedos
    ctx.strokeStyle = colorPrincipal;

    conexionesMano.forEach(([a, b]) => {

        const puntoA = landmarks[a];
        const puntoB = landmarks[b];

        if (!puntoA || !puntoB) return;

        dibujarLinea(puntoA, puntoB, 4);
    });

    // Puntos generales de los dedos (falanges intermedias)
    ctx.fillStyle = colorPrincipal;

    landmarks.forEach((punto, indice) => {
        if (puntasDedos.includes(indice) || nudillosBase.includes(indice) || indice === 0) {
            return; // se dibujan aparte, con otro tamaño
        }
        dibujarPunto(punto.x, punto.y, 4);
    });

    // Nudillos base (más grandes, marcan la estructura de la mano)
    nudillosBase.forEach(i => {
        const punto = landmarks[i];
        if (punto) dibujarPunto(punto.x, punto.y, 6.5);
    });

    // Muñeca
    if (landmarks[0]) dibujarPunto(landmarks[0].x, landmarks[0].y, 7);

    // Puntas de los dedos: las más grandes, para identificarlas rápido
    ctx.fillStyle = "#ffffff";
    puntasDedos.forEach(i => {
        const punto = landmarks[i];
        if (punto) dibujarPunto(punto.x, punto.y, 6);
    });
}


// =====================================================
// SUAVIZADO ENTRE DETECCIONES
// El modelo no entrega resultados en cada cuadro exacto;
// esto interpola entre la última postura y la nueva para
// que el movimiento se vea fluido en vez de "saltar".
// =====================================================

function lerpPunto(a, b, t) {
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: (a.z || 0) + ((b.z || 0) - (a.z || 0)) * t,
        visibility: b.visibility
    };
}

function suavizarListaPuntos(actual, nuevo, t) {
    if (!actual || actual.length !== nuevo.length) return nuevo;
    return nuevo.map((punto, i) => lerpPunto(actual[i], punto, t));
}

const SUAVIZADO_CUERPO = 0.55;
const SUAVIZADO_MANOS = 0.55;


// =====================================================
// RESULTADOS
// =====================================================

let ultimoCuerpo = null;
let ultimasManos = [];


// =====================================================
// MODELOS (CUERPO Y MANOS)
// Envueltos en try/catch: si MediaPipe no carga (red,
// bloqueo, incompatibilidad), la cámara y la interfaz
// siguen funcionando con normalidad, solo sin esqueleto.
// =====================================================

let modelosDisponibles = false;
let pose = null;
let hands = null;

try {

    pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`
    });

    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    pose.onResults(results => {
        const landmarks = results.poseLandmarks || null;

        if (!esCuerpoValido(landmarks)) {
            ultimoCuerpo = null;
            return;
        }

        ultimoCuerpo = ultimoCuerpo
            ? suavizarListaPuntos(ultimoCuerpo, landmarks, SUAVIZADO_CUERPO)
            : landmarks;
    });

    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.3,
        minTrackingConfidence: 0.3
    });

    hands.onResults(results => {
        const manos = results.multiHandLandmarks || [];

        ultimasManos = manos.map((mano, i) => {
            const previa = ultimasManos[i];
            return previa ? suavizarListaPuntos(previa, mano, SUAVIZADO_MANOS) : mano;
        });
    });

    modelosDisponibles = true;

} catch (error) {
    console.error("No se pudieron cargar los modelos de detección:", error);
    modelosDisponibles = false;
}


// =====================================================
// GESTO DE CAPTURA (marco con ambas manos)
// Pulgar e índice extendidos, resto de dedos doblados,
// en AMBAS manos a la vez, sostenido un instante.
// =====================================================

function distanciaPuntos(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function dedoExtendido(landmarks, puntaIdx, baseIdx) {
    const muneca = landmarks[0];
    return distanciaPuntos(landmarks[puntaIdx], muneca) > distanciaPuntos(landmarks[baseIdx], muneca);
}

function esGestoDeMarco(mano) {
    const pulgarExtendido = dedoExtendido(mano, 4, 2);
    const indiceExtendido = dedoExtendido(mano, 8, 6);
    const medioDoblado = !dedoExtendido(mano, 12, 10);
    const anularDoblado = !dedoExtendido(mano, 16, 14);
    const menDoblado = !dedoExtendido(mano, 20, 18);

    return pulgarExtendido && indiceExtendido && medioDoblado && anularDoblado && menDoblado;
}

let contadorGestoMarco = 0;
let enCooldownCaptura = false;

const CUADROS_PARA_CAPTURAR = 10; // mantener el gesto ~1/3 seg
const COOLDOWN_CAPTURA_MS = 2500;

function revisarGestoDeCaptura() {

    if (enCooldownCaptura || ultimasManos.length !== 2) {
        contadorGestoMarco = 0;
        return;
    }

    const gestoActivo = esGestoDeMarco(ultimasManos[0]) && esGestoDeMarco(ultimasManos[1]);

    if (!gestoActivo) {
        contadorGestoMarco = 0;
        return;
    }

    contadorGestoMarco++;

    if (contadorGestoMarco >= CUADROS_PARA_CAPTURAR) {
        contadorGestoMarco = 0;
        tomarCaptura();
    }
}

function tomarCaptura() {

    enCooldownCaptura = true;

    const salida = document.createElement("canvas");
    salida.width = canvas.width;
    salida.height = canvas.height;
    const salidaCtx = salida.getContext("2d");

    // Igualar el espejo de la vista actual en la foto final
    if (camaraFrontal) {
        salidaCtx.translate(salida.width, 0);
        salidaCtx.scale(-1, 1);
    }

    salidaCtx.drawImage(video, 0, 0, salida.width, salida.height);
    salidaCtx.drawImage(canvas, 0, 0, salida.width, salida.height);

    salida.toBlob(blob => {

        if (!blob) return;

        const url = URL.createObjectURL(blob);

        if (miniatura) {
            miniatura.src = url;
            miniatura.classList.add("visible");
            setTimeout(() => miniatura.classList.remove("visible"), 2500);
        }

        if (descargaCaptura) {
            descargaCaptura.href = url;
            descargaCaptura.download = `captura_${Date.now()}.png`;
            descargaCaptura.click();
        }

        status.textContent = "📸 ¡Captura tomada!";

    }, "image/png");

    if (flash) {
        flash.classList.add("activo");
        setTimeout(() => flash.classList.remove("activo"), 180);
    }

    setTimeout(() => {
        enCooldownCaptura = false;
    }, COOLDOWN_CAPTURA_MS);
}


// =====================================================
// PROCESAMIENTO
// =====================================================

let procesando = false;

async function procesarVideo() {

    if (camaraActiva && video.readyState >= 2) {

        actualizarBrilloAdaptativo();

        if (modelosDisponibles && !procesando) {

            procesando = true;

            try {
                const frame = obtenerFrameMejorado();
                // Cuerpo y manos se procesan en paralelo (no uno
                // esperando al otro) para reducir el retraso total.
                await Promise.all([
                    pose.send({ image: frame }),
                    hands.send({ image: frame })
                ]);
            } catch (error) {
                console.error("Error de detección:", error);
            }

            procesando = false;
        }

        revisarGestoDeCaptura();
    }

    if (canvas.width && canvas.height) {

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (camaraActiva) {

            if (ultimoCuerpo) {
                dibujarCuerpo(ultimoCuerpo);
            }

            ultimasManos.forEach((mano, indice) => {
                dibujarMano(mano, indice);
            });
        }
    }

    requestAnimationFrame(procesarVideo);
}


// =====================================================
// INICIAR BUCLE
// =====================================================

procesarVideo();
