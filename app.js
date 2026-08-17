/* ========================================================= ELEMENTOS========================================================= */

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { alpha: true });
const startButton = document.getElementById("startButton");
const switchButton = document.getElementById("switchButton");
const fullscreenButton = document.getElementById("fullscreenButton");
const captureButton = document.getElementById("captureButton");
const recordButton = document.getElementById("recordButton");
const status = document.getElementById("status");
const flash = document.getElementById("flash");
const miniatura = document.getElementById("miniaturaCaptura");
const platformBadge = document.getElementById("platformBadge");
const container = document.getElementById("container");
const filterSelect = document.getElementById("filterSelect");
const gestureIndicator = document.getElementById("gestureIndicator");

/* ========================================================= ESTADO========================================================= */

let stream = null;
let camaraFrontal = true;
let camaraActiva = false;
let pose = null;
let hands = null;
let faceMesh = null;
let modelosDisponibles = false;
let procesando = false;
let ultimoProcesamiento =0;

// Estado para captura automaticalet gestoDetectadoFrames =0;
let ultimaCaptura =0;
const FRAMES_PARA_CAPTURA =10;
const COOLDOWN_CAPTURA =2000;

// Estado para grabación de videolet grabando = false;
let mediaRecorder = null;
let chunksGrabacion = [];
let canvasGrabacion = null;
let ctxGrabacion = null;

// Estado para filtroslet filtroActual = "none";

// Estado para gestos detectadoslet gestoActual = null;
let gestoFrames =0;
const GESTO_FRAMES_CONFIRMACION =5;

/* ========================================================= DATOS SUAVIZADOS========================================================= */

let cuerpoActual = null;
let cuerpoSuavizado = null;
let caraActual = null;
let caraSuavizada = null;

/* ========================================================= CONFIGURACIÓN — COLORES========================================================= */

const COLOR_CUERPO = "#00ffc8";
const COLOR_MANO_1 = "#008cff";
const COLOR_MANO_2 = "#ff2bd6";
const COLOR_CARA = "#ffd000";
const COLOR_OJO = "#00eaff";
const COLOR_BOCA = "#ff4fa3";
const COLOR_NARIZ = "#ff9d00";
const COLOR_CEJA = "#b66cff";

/* ========================================================= OPACIDAD DE RELLENOS========================================================= */

const OPACIDAD_RELLENO_MANO =0.42;
const OPACIDAD_RELLENO_CUERPO =0.30;
const OPACIDAD_RELLENO_CARA =0.16;

/* ========================================================= SUAVIZADO (factor de interpolación)
========================================================= */

const SUAVIZADO_CUERPO =0.72;
const SUAVIZADO_MANO =0.80;
const SUAVIZADO_CARA =0.76;

/* ========================================================= TRACKING DE MANOS========================================================= */

const manoTracks = [
 {
 id:0,
 nombre: "MANO1",
 color: COLOR_MANO_1,
 landmarks: null,
 suavizados: null,
 activa: false,
 x: null,
 y: null,
 perdida:0 },
 {
 id:1,
 nombre: "MANO2",
 color: COLOR_MANO_2,
 landmarks: null,
 suavizados: null,
 activa: false,
 x: null,
 y: null,
 perdida:0 }
];

/* ========================================================= CONEXIONES — CUERPO (MediaPipe Pose)
========================================================= */

const conexionesCuerpo = [
 [11,12], [11,13], [13,15],
 [12,14], [14,16],
 [11,23], [12,24], [23,24],
 [23,25], [25,27], [27,29], [29,31],
 [24,26], [26,28], [28,30], [30,32],
 [0,1], [1,2], [2,3],
 [0,4], [4,5], [5,6],
 [9,10]
];

/* ========================================================= CONEXIONES — MANOS========================================================= */

const conexionesMano = [
 [0,1], [1,2], [2,3], [3,4],
 [0,5], [5,6], [6,7], [7,8],
 [5,9], [9,10], [10,11], [11,12],
 [9,13], [13,14], [14,15], [15,16],
 [13,17], [17,18], [18,19], [19,20],
 [0,17]
];

/* ========================================================= CARA — ÍNDICES FACIALES (MediaPipe Face Mesh)
========================================================= */

// Contorno completo de la caraconst contornoCara = [
10,338,297,332,284,251,389,356,454,323,361,288,
397,365,379,378,400,377,152,148,176,149,150,136,
172,58,132,93,234,127,162,21,54,103,67,109];

// Ojo izquierdoconst ojoIzquierdo = [
33,7,163,144,145,153,154,155,133,173,157,158,
159,160,161,246];

// Ojo derechoconst ojoDerecho = [
362,382,381,380,374,373,390,249,263,466,388,387,
386,385,384,398];

// Ceja izquierdaconst cejaIzquierda = [
70,63,105,66,107,55,65,52,53];

// Ceja derechaconst cejaDerecha = [
336,296,334,293,300,285,295,282,283];

// Narizconst nariz = [
168,6,197,195,5,4,45,220,115,48,64,98,97,2,
326,327,294,278,344,440,274,1];

// Boca exteriorconst bocaExterior = [
61,146,91,181,84,17,314,405,321,375,291,308,
324,318,402,317,14,87,178,88,95,78,61];

// Boca interiorconst bocaInterior = [
78,191,80,81,82,13,312,311,310,415,308,324,
318,402,317,14,87,178,88,95];

/* ========================================================= PLATAFORMA========================================================= */

function detectarPlataforma() {
 const ua = navigator.userAgent;
 const ancho = window.innerWidth;

 if (/iPhone|iPod|Android.*Mobile/i.test(ua)) {
 return "movil";
 }

 if (/iPad|Android/i.test(ua) || (ancho >=700 && ancho< 1200)) {
 return "tablet";
 }

 return "pc";
}

function adaptarPlataforma() {
 const plataforma = detectarPlataforma();

 document.body.classList.remove("is-mobile", "is-tablet", "is-desktop");

 if (plataforma === "movil") {
 document.body.classList.add("is-mobile");
 if (platformBadge) platformBadge.textContent = "MÓVIL";
 } else if (plataforma === "tablet") {
 document.body.classList.add("is-tablet");
 if (platformBadge) platformBadge.textContent = "TABLET";
 } else {
 document.body.classList.add("is-desktop");
 if (platformBadge) platformBadge.textContent = "PC";
 }

 ajustarCanvas();
}

/* ========================================================= CANVAS — Calidad de renderizado========================================================= */

function ajustarCanvas() {
 if (!video.videoWidth || !video.videoHeight) {
 return;
 }

 // Usar devicePixelRatio para nitidez en pantallas de alta densidad const dpr = Math.max(1, Math.min(window.devicePixelRatio ||1,3));

 const anchoFisico = Math.round(video.videoWidth * dpr);
 const altoFisico = Math.round(video.videoHeight * dpr);

 if (canvas.width !== anchoFisico || canvas.height !== altoFisico) {
 canvas.width = anchoFisico;
 canvas.height = altoFisico;
 }

 // Suavizado de alta calidad para las imágenes escaladas if ("imageSmoothingEnabled" in ctx) {
 ctx.imageSmoothingEnabled = true;
 ctx.imageSmoothingQuality = "high";
 }
}

/* ========================================================= ESTADO (UI)
========================================================= */

function cambiarEstado(texto) {
 if (status) {
 status.textContent = texto;
 }
}

/* ========================================================= CÁMARA========================================================= */

async function iniciarCamara() {
 try {
 if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
 cambiarEstado("❌ Cámara no disponible");
 return;
 }

 if (stream) {
 stream.getTracks().forEach(track => track.stop());
 }

 cambiarEstado("🔄 Iniciando cámara...");

 stream = await navigator.mediaDevices.getUserMedia({
 video: {
 facingMode: camaraFrontal ? "user" : "environment",
 width: { ideal:1920 },
 height: { ideal:1080 },
 frameRate: { ideal:60, max:60 }
 },
 audio: false });

 video.srcObject = stream;
 await video.play();

 camaraActiva = true;
 actualizarEspejo();
 ajustarCanvas();

 startButton.textContent = "⏹️ Detener cámara";
 cambiarEstado("🟢 Seguimiento activo");
 } catch (error) {
 console.error(error);
 cambiarEstado("❌ No se pudo iniciar la cámara");
 }
}

/* ========================================================= DETENER CÁMARA========================================================= */

function detenerCamara() {
 if (stream) {
 stream.getTracks().forEach(track => track.stop());
 }

 // Detener grabación si está activa if (grabando) {
 detenerGrabacion();
 }

 stream = null;
 video.srcObject = null;
 camaraActiva = false;

 cuerpoActual = null;
 cuerpoSuavizado = null;
 caraActual = null;
 caraSuavizada = null;

 manoTracks.forEach(mano => {
 mano.landmarks = null;
 mano.suavizados = null;
 mano.activa = false;
 mano.x = null;
 mano.y = null;
 mano.perdida =0;
 });

 // Resetear filtros filtroActual = "none";
 if (filterSelect) filterSelect.value = "none";
 video.style.filter = "none";
 canvas.style.filter = "none";

 // Resetear indicador de gesto gestoActual = null;
 gestoFrames =0;
 if (gestureIndicator) {
 gestureIndicator.textContent = "";
 gestureIndicator.classList.remove("visible");
 }

 ctx.clearRect(0,0, canvas.width, canvas.height);

 startButton.textContent = "📷 Iniciar cámara";
 cambiarEstado("Cámara detenida");
}

/* ========================================================= ESPEJO========================================================= */

function actualizarEspejo() {
 video.classList.toggle("mirror", camaraFrontal);
 canvas.classList.toggle("mirror", camaraFrontal);
}

/* ========================================================= SUAVIZADO DE LANDMARKS========================================================= */

function suavizarLandmarks(anteriores, nuevos, factor) {
 if (!nuevos) {
 return null;
 }

 if (!anteriores) {
 return nuevos.map(punto => {
 if (!punto) return null;
 return {
 x: punto.x,
 y: punto.y,
 z: punto.z ||0,
 visibility: punto.visibility };
 });
 }

 return nuevos.map((punto, indice) => {
 if (!punto) return null;

 const anterior = anteriores[indice];

 if (!anterior) {
 return {
 x: punto.x,
 y: punto.y,
 z: punto.z ||0 };
 }

 return {
 x: anterior.x + (punto.x - anterior.x) * factor,
 y: anterior.y + (punto.y - anterior.y) * factor,
 z: (anterior.z ||0) + ((punto.z ||0) - (anterior.z ||0)) * factor,
 visibility: punto.visibility };
 });
}

/* ========================================================= VISIBILIDAD========================================================= */

function visible(p) {
 if (!p) return false;
 if (p.visibility === undefined) return true;
 return p.visibility >0.25;
}

/* ========================================================= DIBUJO — Punto========================================================= */

function punto(p, radio) {
 if (!p) return;

 ctx.beginPath();
 ctx.arc(
 p.x * canvas.width,
 p.y * canvas.height,
 radio,
0,
 Math.PI *2 );
 ctx.fill();
}

/* ========================================================= DIBUJO — Línea========================================================= */

function linea(a, b, grosor) {
 if (!visible(a) || !visible(b)) return;

 ctx.beginPath();
 ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
 ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
 ctx.lineWidth = grosor;
 ctx.stroke();
}

/* ========================================================= DIBUJO — Polígono========================================================= */

function poligono(landmarks, indices, color, alpha, borde = true) {
 const puntos = indices .map(indice => landmarks[indice])
 .filter(visible);

 if (puntos.length< 3) return;

 ctx.save();
 ctx.globalAlpha = alpha;
 ctx.fillStyle = color;
 ctx.beginPath();

 puntos.forEach((p, i) => {
 const x = p.x * canvas.width;
 const y = p.y * canvas.height;
 if (i ===0) {
 ctx.moveTo(x, y);
 } else {
 ctx.lineTo(x, y);
 }
 });

 ctx.closePath();
 ctx.fill();

 if (borde) {
 ctx.globalAlpha = Math.min(1, alpha +0.35);
 ctx.strokeStyle = color;
 ctx.lineWidth =4;
 ctx.stroke();
 }

 ctx.restore();
}

/* ========================================================= DIBUJO — Cuerpo (relleno)
========================================================= */

function dibujarRellenoCuerpo(p) {
 if (!p) return;

 // TÓRAX if (p[11] && p[12] && p[23] && p[24]) {
 poligono(p, [11,12,24,23], COLOR_CUERPO, OPACIDAD_RELLENO_CUERPO);
 }

 // BRAZOS dibujarSegmentoRelleno(p[11], p[13], p[15],0.075);
 dibujarSegmentoRelleno(p[12], p[14], p[16],0.075);

 // PIERNAS dibujarSegmentoRelleno(p[23], p[25], p[27],0.09);
 dibujarSegmentoRelleno(p[24], p[26], p[28],0.09);
}

/* ========================================================= DIBUJO — Relleno de ramas (brazos/piernas)
========================================================= */

function dibujarSegmentoRelleno(a, b, c, ancho) {
 if (!a || !b || !c) return;

 const dx = c.x - a.x;
 const dy = c.y - a.y;
 const largo = Math.hypot(dx, dy);

 if (largo ===0) return;

 const nx = (-dy / largo) * ancho;
 const ny = (dx / largo) * ancho;

 const puntos = [
 { x: a.x + nx, y: a.y + ny },
 { x: c.x + nx, y: c.y + ny },
 { x: c.x - nx, y: c.y - ny },
 { x: a.x - nx, y: a.y - ny }
 ];

 ctx.save();
 ctx.globalAlpha = OPACIDAD_RELLENO_CUERPO;
 ctx.fillStyle = COLOR_CUERPO;
 ctx.strokeStyle = COLOR_CUERPO;
 ctx.lineWidth =4;
 ctx.beginPath();

 puntos.forEach((p, i) => {
 if (i ===0) {
 ctx.moveTo(p.x * canvas.width, p.y * canvas.height);
 } else {
 ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
 }
 });

 ctx.closePath();
 ctx.fill();
 ctx.stroke();
 ctx.restore();
}

/* ========================================================= DIBUJO — Cuerpo completo========================================================= */

function dibujarCuerpo(p) {
 if (!p) return;

 // Primero el relleno dibujarRellenoCuerpo(p);

 // Después el esqueleto ctx.save();
 ctx.strokeStyle = COLOR_CUERPO;
 ctx.fillStyle = COLOR_CUERPO;
 ctx.lineCap = "round";
 ctx.lineJoin = "round";

 conexionesCuerpo.forEach(([a, b]) => {
 linea(p[a], p[b],8);
 });

 // Articulaciones grandes p.forEach(puntoActual => {
 if (!visible(puntoActual)) return;
 punto(puntoActual,7);
 });

 ctx.restore();
}

/* ========================================================= DIBUJO — Mano========================================================= */

function dibujarMano(landmarks, color) {
 if (!landmarks) return;

 // Palma poligono(landmarks, [0,1,5,9,13,17], color, OPACIDAD_RELLENO_MANO);

 // Cada dedo como rama gruesa const dedos = [
 [1,2,3,4],
 [5,6,7,8],
 [9,10,11,12],
 [13,14,15,16],
 [17,18,19,20]
 ];

 ctx.save();
 ctx.strokeStyle = color;
 ctx.fillStyle = color;
 ctx.lineCap = "round";
 ctx.lineJoin = "round";

 dedos.forEach(dedo => {
 for (let i =0; i< dedo.length -1; i++) {
 const a = landmarks[dedo[i]];
 const b = landmarks[dedo[i +1]];
 if (!a || !b) continue;
 linea(a, b,10);
 }
 });

 // Conexiones de palma conexionesMano.forEach(([a, b]) => {
 linea(landmarks[a], landmarks[b],6);
 });

 // Articulaciones landmarks.forEach((p, indice) => {
 if (!p) return;

 let radio =7;
 // Punta de los dedos ligeramente más grande if ([4,8,12,16,20].includes(indice)) {
 radio =11;
 }

 punto(p, radio);
 });

 ctx.restore();
}

/* ========================================================= DIBUJO — Todas las manos========================================================= */

function dibujarManos() {
 manoTracks.forEach(mano => {
 if (mano.activa && mano.suavizados) {
 dibujarMano(mano.suavizados, mano.color);
 }
 });
}

/* ========================================================= DIBUJO — Contorno de la cara========================================================= */

function dibujarContornoCara(p) {
 const puntos = contornoCara.map(i => p[i]);

 if (puntos.some(x => !x)) return;

 ctx.save();
 ctx.strokeStyle = COLOR_CARA;
 ctx.fillStyle = COLOR_CARA;
 ctx.lineWidth =5;
 ctx.lineCap = "round";
 ctx.lineJoin = "round";

 // Relleno ligero ctx.globalAlpha = OPACIDAD_RELLENO_CARA;
 ctx.beginPath();

 puntos.forEach((pt, i) => {
 const x = pt.x * canvas.width;
 const y = pt.y * canvas.height;
 if (i ===0) {
 ctx.moveTo(x, y);
 } else {
 ctx.lineTo(x, y);
 }
 });

 ctx.closePath();
 ctx.fill();

 // Contorno completo ctx.globalAlpha =0.95;
 ctx.stroke();
 ctx.restore();
}

/* ========================================================= DIBUJO — Estructura facial (ojos, cejas, nariz, boca)
========================================================= */

function dibujarEstructuraFacial(p, indices, color, grosor =4, cerrar = false) {
 const puntos = indices.map(i => p[i]).filter(Boolean);

 if (puntos.length< 2) return;

 ctx.save();
 ctx.strokeStyle = color;
 ctx.fillStyle = color;
 ctx.lineWidth = grosor;
 ctx.lineCap = "round";
 ctx.lineJoin = "round";

 ctx.beginPath();

 puntos.forEach((pt, i) => {
 const x = pt.x * canvas.width;
 const y = pt.y * canvas.height;
 if (i ===0) {
 ctx.moveTo(x, y);
 } else {
 ctx.lineTo(x, y);
 }
 });

 if (cerrar) {
 ctx.closePath();
 }

 ctx.stroke();

 // Puntos pequeños para mostrar movimiento puntos.forEach(pt => {
 punto(pt,3.5);
 });

 ctx.restore();
}

/* ========================================================= DIBUJO — Cara completa========================================================= */

function dibujarCara(p) {
 if (!p) return;

 dibujarContornoCara(p);
 dibujarEstructuraFacial(p, ojoIzquierdo, COLOR_OJO,4, true);
 dibujarEstructuraFacial(p, ojoDerecho, COLOR_OJO,4, true);
 dibujarEstructuraFacial(p, cejaIzquierda, COLOR_CEJA,5, false);
 dibujarEstructuraFacial(p, cejaDerecha, COLOR_CEJA,5, false);
 dibujarEstructuraFacial(p, nariz, COLOR_NARIZ,4, false);
 dibujarEstructuraFacial(p, bocaExterior, COLOR_BOCA,5, true);
 dibujarEstructuraFacial(p, bocaInterior, COLOR_BOCA,3, true);
}

/* ========================================================= ACTUALIZAR MANOS — Tracking persistente========================================================= */

function centroMano(landmarks) {
 if (!landmarks || !landmarks[0]) return null;
 return { x: landmarks[0].x, y: landmarks[0].y };
}

function distancia(a, b) {
 if (!a || !b) return Infinity;
 return Math.hypot(a.x - b.x, a.y - b.y);
}

function actualizarManos(detecciones) {
 const centros = detecciones.map(centroMano);
 const utilizados = new Set();

 // Mantener manos existentes manoTracks.forEach(mano => {
 if (!mano.activa || mano.x === null) return;

 let mejor = -1;
 let mejorDistancia = Infinity;

 centros.forEach((centro, i) => {
 if (utilizados.has(i)) return;

 const d = distancia({ x: mano.x, y: mano.y }, centro);

 if (d< mejorDistancia) {
 mejorDistancia = d;
 mejor = i;
 }
 });

 if (mejor >=0 && mejorDistancia< 0.32) {
 const deteccion = detecciones[mejor];
 mano.landmarks = deteccion;
 mano.suavizados = suavizarLandmarks(mano.suavizados, deteccion, SUAVIZADO_MANO);
 mano.x = centros[mejor].x;
 mano.y = centros[mejor].y;
 mano.perdida =0;
 utilizados.add(mejor);
 }
 });

 // Manos nuevas detecciones.forEach((deteccion, i) => {
 if (utilizados.has(i)) return;

 const libre = manoTracks.find(mano => !mano.activa || mano.perdida >6);
 if (!libre) return;

 const centro = centros[i];
 libre.landmarks = deteccion;
 libre.suavizados = deteccion.map(p => {
 if (!p) return null;
 return { x: p.x, y: p.y, z: p.z ||0 };
 });
 libre.x = centro.x;
 libre.y = centro.y;
 libre.activa = true;
 libre.perdida =0;
 utilizados.add(i);
 });

 // Pérdida temporal manoTracks.forEach(mano => {
 if (mano.activa) {
 mano.perdida++;
 }

 // Desaparece después de varios frames sin detección if (mano.perdida >8) {
 mano.landmarks = null;
 mano.suavizados = null;
 mano.activa = false;
 mano.x = null;
 mano.y = null;
 mano.perdida =0;
 }
 });
}

/* ========================================================= MEDIAPIPE — Pose========================================================= */

function inicializarPose() {
 pose = new Pose({
 locateFile: archivo =>
 `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${archivo}`
 });

 pose.setOptions({
 modelComplexity:2,
 smoothLandmarks: true,
 enableSegmentation: false,
 minDetectionConfidence:0.55,
 minTrackingConfidence:0.55 });

 pose.onResults(resultado => {
 if (resultado.poseLandmarks) {
 cuerpoActual = resultado.poseLandmarks;
 cuerpoSuavizado = suavizarLandmarks(cuerpoSuavizado, cuerpoActual, SUAVIZADO_CUERPO);
 }
 });
}

/* ========================================================= MEDIAPIPE — Hands========================================================= */

function inicializarHands() {
 hands = new Hands({
 locateFile: archivo =>
 `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${archivo}`
 });

 hands.setOptions({
 maxNumHands:2,
 modelComplexity:1,
 minDetectionConfidence:0.55,
 minTrackingConfidence:0.55 });

 hands.onResults(resultado => {
 actualizarManos(resultado.multiHandLandmarks || []);
 });
}

/* ========================================================= MEDIAPIPE — Face Mesh========================================================= */

function inicializarFaceMesh() {
 faceMesh = new FaceMesh({
 locateFile: archivo =>
 `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${archivo}`
 });

 faceMesh.setOptions({
 maxNumFaces:1,
 refineLandmarks: true,
 minDetectionConfidence:0.55,
 minTrackingConfidence:0.55 });

 faceMesh.onResults(resultado => {
 const caras = resultado.multiFaceLandmarks;

 if (caras && caras.length >0) {
 caraActual = caras[0];
 caraSuavizada = suavizarLandmarks(caraSuavizada, caraActual, SUAVIZADO_CARA);
 } else {
 caraActual = null;
 }
 });
}

/* ========================================================= INICIALIZAR MODELOS========================================================= */

function inicializarModelos() {
 try {
 inicializarPose();
 inicializarHands();
 inicializarFaceMesh();
 modelosDisponibles = true;
 console.log("Tracking avanzado cargado");
 } catch (error) {
 console.error(error);
 cambiarEstado("❌ Error cargando modelos");
 }
}

/* ========================================================= GESTO — Cuadro con indice y pulgar (ambas manos)
========================================================= */

function obtenerPuntosCuadro() {
 const manos = manoTracks.filter(mano => mano.activa && mano.suavizados);

 if (manos.length !==2) return null;

 // Puntos: pulgar (4) e indice (8) de cada mano const puntos = [
 manos[0].suavizados[4],
 manos[0].suavizados[8],
 manos[1].suavizados[4],
 manos[1].suavizados[8]
 ];

 if (puntos.some(p => !p)) return null;

 // Convertir a coordenadas de canvas const dpr = Math.max(1, Math.min(window.devicePixelRatio ||1,3));

 const xs = puntos.map(p => p.x * canvas.width);
 const ys = puntos.map(p => p.y * canvas.height);

 return {
 izquierda: Math.max(0, Math.min(...xs)),
 derecha: Math.min(canvas.width, Math.max(...xs)),
 arriba: Math.max(0, Math.min(...ys)),
 abajo: Math.min(canvas.height, Math.max(...ys)),
 dpr: dpr };
}

function verificarGestoCuadro() {
 const cuadro = obtenerPuntosCuadro();
 if (!cuadro) {
 gestoDetectadoFrames =0;
 return false;
 }

 const ancho = cuadro.derecha - cuadro.izquierda;
 const alto = cuadro.abajo - cuadro.arriba;

 // El cuadro debe tener un tamano razonable if (ancho< 50 || alto< 50) {
 gestoDetectadoFrames =0;
 return false;
 }

 gestoDetectadoFrames++;
 return gestoDetectadoFrames >= FRAMES_PARA_CAPTURA;
}

/* ========================================================= DIBUJAR CUADRO========================================================= */

function dibujarCuadro() {
 const cuadro = obtenerPuntosCuadro();
 if (!cuadro) return;

 const ancho = cuadro.derecha - cuadro.izquierda;
 const alto = cuadro.abajo - cuadro.arriba;

 ctx.save();

 // Color segun estado if (gestoDetectadoFrames >= FRAMES_PARA_CAPTURA) {
 ctx.strokeStyle = "#00ff00"; // Verde - listo para capturar ctx.lineWidth =6;
 } else if (gestoDetectadoFrames >= FRAMES_PARA_CAPTURA /2) {
 ctx.strokeStyle = "#ffff00"; // Amarillo - casi listo ctx.lineWidth =5;
 } else {
 ctx.strokeStyle = "#ffffff"; // Blanco - detectando ctx.lineWidth =4;
 }

 ctx.setLineDash([12,8]);
 ctx.strokeRect(cuadro.izquierda, cuadro.arriba, ancho, alto);
 ctx.restore();
}

/* ========================================================= CAPTURA COMPLETA (video + canvas superpuesto)
========================================================= */

function capturarPantallaCompleta() {
 if (!video.videoWidth || !video.videoHeight) {
 cambiarEstado("Error: Sin video");
 return;
 }

 const dpr = Math.max(1, Math.min(window.devicePixelRatio ||1,3));

 // Canvas de captura al tamano del video const captura = document.createElement("canvas");
 captura.width = video.videoWidth;
 captura.height = video.videoHeight;

 const capturaCtx = captura.getContext("2d");
 capturaCtx.imageSmoothingEnabled = true;
 capturaCtx.imageSmoothingQuality = "high";

 // Dibujar el video primero capturaCtx.drawImage(video,0,0, captura.width, captura.height);

 // Dibujar el canvas de overlay (landmarks) escalado al tamano del video // El canvas esta escalado por DPR, hay que escalarlo al tamano del video capturaCtx.drawImage(
 canvas,
0,0, canvas.width, canvas.height,
0,0, captura.width, captura.height );

 captura.toBlob(blob => {
 if (!blob) {
 cambiarEstado("Error al capturar");
 return;
 }

 const url = URL.createObjectURL(blob);

 // Mostrar miniatura if (miniatura) {
 miniatura.src = url;
 miniatura.classList.add("visible");
 }

 // Descargar const enlace = document.createElement("a");
 enlace.href = url;
 enlace.download = `bodytracker-${Date.now()}.png`;
 enlace.click();

 // Flash if (flash) {
 flash.classList.add("activo");
 setTimeout(() => flash.classList.remove("activo"),150);
 }

 cambiarEstado("Captura guardada");
 ultimaCaptura = Date.now();

 setTimeout(() => URL.revokeObjectURL(url),5000);
 }, "image/png");
}

function capturarCuadro() {
 const cuadro = obtenerPuntosCuadro();
 if (!cuadro) {
 cambiarEstado("Forma el cuadro con las manos");
 return;
 }

 const ancho = cuadro.derecha - cuadro.izquierda;
 const alto = cuadro.abajo - cuadro.arriba;

 if (ancho< 50 || alto< 50) {
 cambiarEstado("Amplia mas el cuadro");
 return;
 }

 // Captura del area del cuadro const dpr = cuadro.dpr;

 // Escalar coordenadas al tamano real del video const escalaX = video.videoWidth / canvas.width;
 const escalaY = video.videoHeight / canvas.height;

 const x1 = Math.round(cuadro.izquierda * escalaX);
 const y1 = Math.round(cuadro.arriba * escalaY);
 const w = Math.round(ancho * escalaX);
 const h = Math.round(alto * escalaY);

 const captura = document.createElement("canvas");
 captura.width = w;
 captura.height = h;

 const capturaCtx = captura.getContext("2d");
 capturaCtx.imageSmoothingEnabled = true;
 capturaCtx.imageSmoothingQuality = "high";

 // Video capturaCtx.drawImage(video, x1, y1, w, h,0,0, w, h);

 // Canvas overlay (escalado)
 capturaCtx.drawImage(
 canvas,
 cuadro.izquierda, cuadro.arriba, ancho, alto,
0,0, w, h );

 captura.toBlob(blob => {
 if (!blob) {
 cambiarEstado("Error al capturar");
 return;
 }

 const url = URL.createObjectURL(blob);

 if (miniatura) {
 miniatura.src = url;
 miniatura.classList.add("visible");
 }

 const enlace = document.createElement("a");
 enlace.href = url;
 enlace.download = `captura-cuadro-${Date.now()}.png`;
 enlace.click();

 if (flash) {
 flash.classList.add("activo");
 setTimeout(() => flash.classList.remove("activo"),150);
 }

 cambiarEstado("Captura de cuadro guardada");
 ultimaCaptura = Date.now();

 setTimeout(() => URL.revokeObjectURL(url),5000);
 }, "image/png");
}

/* ========================================================= FILTROS========================================================= */

function aplicarFiltro(contexto, filtro) {
 switch (filtro) {
 case "grayscale":
 contexto.filter = "grayscale(1)";
 break;
 case "sepia":
 contexto.filter = "sepia(1)";
 break;
 case "invert":
 contexto.filter = "invert(1)";
 break;
 case "blur":
 contexto.filter = "blur(3px)";
 break;
 case "night":
 contexto.filter = "brightness(0.5) contrast(1.2) hue-rotate(180deg)";
 break;
 case "mirror":
 contexto.filter = "none";
 contexto.translate(contexto.canvas.width,0);
 contexto.scale(-1,1);
 break;
 default:
 contexto.filter = "none";
 }
}

function obtenerFiltroCSS(filtro) {
 switch (filtro) {
 case "grayscale":
 return "grayscale(1)";
 case "sepia":
 return "sepia(1)";
 case "invert":
 return "invert(1)";
 case "blur":
 return "blur(3px)";
 case "night":
 return "brightness(0.5) contrast(1.2) hue-rotate(180deg)";
 case "mirror":
 return "scaleX(-1)";
 default:
 return "none";
 }
}

/* ========================================================= GRABACIÓN DE VIDEO========================================================= */

function iniciarGrabacion() {
 if (!camaraActiva || grabando) return;

 try {
 // Crear canvas offscreen para grabación canvasGrabacion = document.createElement("canvas");
 canvasGrabacion.width = video.videoWidth;
 canvasGrabacion.height = video.videoHeight;
 ctxGrabacion = canvasGrabacion.getContext("2d", { alpha: false });
 ctxGrabacion.imageSmoothingEnabled = true;
 ctxGrabacion.imageSmoothingQuality = "high";

 // Stream del canvas const canvasStream = canvasGrabacion.captureStream(30);

 // Opciones de MediaRecorder const opciones = {
 mimeType: "video/webm;codecs=vp9",
 videoBitsPerSecond:8000000 };

 if (!MediaRecorder.isTypeSupported(opciones.mimeType)) {
 opciones.mimeType = "video/webm;codecs=vp8";
 }
 if (!MediaRecorder.isTypeSupported(opciones.mimeType)) {
 opciones.mimeType = "video/webm";
 }

 mediaRecorder = new MediaRecorder(canvasStream, opciones);
 chunksGrabacion = [];

 mediaRecorder.ondataavailable = (e) => {
 if (e.data.size >0) {
 chunksGrabacion.push(e.data);
 }
 };

 mediaRecorder.onstop = () => {
 const blob = new Blob(chunksGrabacion, { type: opciones.mimeType });
 const url = URL.createObjectURL(blob);

 const enlace = document.createElement("a");
 enlace.href = url;
 enlace.download = `bodytracker-video-${Date.now()}.webm`;
 enlace.click();

 if (flash) {
 flash.classList.add("activo");
 setTimeout(() => flash.classList.remove("activo"),150);
 }

 cambiarEstado("Video guardado");
 setTimeout(() => URL.revokeObjectURL(url),5000);
 };

 mediaRecorder.start(100); // Recopilar datos cada100ms grabando = true;
 recordButton.textContent = "⏹️ Detener";
 recordButton.style.borderColor = "#ff0000";
 recordButton.style.color = "#ff0000";
 recordButton.style.boxShadow = "0014px rgba(255,0,0,0.35)";
 recordButton.classList.add("recording");
 cambiarEstado("🔴 Grabando...");

 // Iniciar loop de frames de grabación frameGrabacion();

 } catch (error) {
 console.error("Error al iniciar grabación:", error);
 cambiarEstado("Error: No se pudo grabar");
 }
}

function detenerGrabacion() {
 if (mediaRecorder && grabando) {
 mediaRecorder.stop();
 grabando = false;
 recordButton.textContent = "🔴 Grabar";
 recordButton.style.borderColor = "";
 recordButton.style.color = "";
 recordButton.style.boxShadow = "";
 recordButton.classList.remove("recording");
 cambiarEstado("Grabación detenida, guardando...");
 }
}

function frameGrabacion() {
 if (!grabando || !ctxGrabacion || !canvasGrabacion) return;

 // Dibujar video ctxGrabacion.drawImage(video,0,0, canvasGrabacion.width, canvasGrabacion.height);

 // Aplicar filtro espejo si está activo if (filtroActual === "mirror") {
 ctxGrabacion.translate(canvasGrabacion.width,0);
 ctxGrabacion.scale(-1,1);
 }

 // Dibujar overlay de tracking (escalado al tamaño del video)
 const escalaX = canvasGrabacion.width / canvas.width;
 const escalaY = canvasGrabacion.height / canvas.height;

 ctxGrabacion.save();
 ctxGrabacion.scale(escalaX, escalaY);

 dibujarCuerpo(cuerpoSuavizado);
 dibujarManos();
 dibujarCara(caraSuavizada);

 ctxGrabacion.restore();

 // Continuar el loop de grabación if (grabando) {
 requestAnimationFrame(frameGrabacion);
 }
}

/* ========================================================= DETECCIÓN DE GESTOS ESPECÍFICOS========================================================= */

function detectarGestosMano(landmarks) {
 if (!landmarks) return null;

 const pulgar = landmarks[4];
 const indice = landmarks[8];
 const medio = landmarks[12];
 const anular = landmarks[16];
 const menique = landmarks[20];
 const muneca = landmarks[0];

 if (!pulgar || !indice || !medio || !anular || !menique || !muneca) return null;

 // Verificar si dedos están extendidos (punta más lejos de la muñeca que la base)
 const extendido = {
 pulgar: Math.hypot(pulgar.x - muneca.x, pulgar.y - muneca.y) > Math.hypot(landmarks[3].x - muneca.x, landmarks[3].y - muneca.y),
 indice: Math.hypot(indice.x - muneca.x, indice.y - muneca.y) > Math.hypot(landmarks[6].x - muneca.x, landmarks[6].y - muneca.y),
 medio: Math.hypot(medio.x - muneca.x, medio.y - muneca.y) > Math.hypot(landmarks[10].x - muneca.x, landmarks[10].y - muneca.y),
 anular: Math.hypot(anular.x - muneca.x, anular.y - muneca.y) > Math.hypot(landmarks[14].x - muneca.x, landmarks[14].y - muneca.y),
 menique: Math.hypot(menique.x - muneca.x, menique.y - muneca.y) > Math.hypot(landmarks[18].x - muneca.x, landmarks[18].y - muneca.y)
 };

 const dedosExtendidos = Object.values(extendido).filter(Boolean).length;

 // Gesto PAZ (V): índice y medio extendidos, otros cerrados if (extendido.indice && extendido.medio && !extendido.anular && !extendido.menique && !extendido.pulgar) {
 return "PAZ ✌️";
 }

 // PULGAR ARRIBA: solo pulgar extendido if (extendido.pulgar && !extendido.indice && !extendido.medio && !extendido.anular && !extendido.menique) {
 return "PULGAR ARRIBA 👍";
 }

 // PUÑO: todos cerrados if (!extendido.pulgar && !extendido.indice && !extendido.medio && !extendido.anular && !extendido.menique) {
 return "PUÑO ✊";
 }

 // OK: pulgar e índice forman círculo (cercanos), otros extendidos const distPulgarIndice = Math.hypot(pulgar.x - indice.x, pulgar.y - indice.y);
 if (distPulgarIndice< 0.05 && extendido.medio && extendido.anular && extendido.menique) {
 return "OK 👌";
 }

 // MANO ABIERTA: todos extendidos if (extendido.pulgar && extendido.indice && extendido.medio && extendido.anular && extendido.menique) {
 return "MANO ABIERTA 🖐️";
 }

 // ROCK (cuernos): índice y menique extendidos if (extendido.indice && !extendido.medio && !extendido.anular && extendido.menique) {
 return "ROCK 🤘";
 }

 return null;
}

function actualizarGestoDetectado() {
 const manosActivas = manoTracks.filter(mano => mano.activa && mano.suavizados);

 if (manosActivas.length ===0) {
 gestoActual = null;
 gestoFrames =0;
 if (gestureIndicator) {
 gestureIndicator.textContent = "";
 gestureIndicator.classList.remove("visible");
 }
 return;
 }

 // Detectar gestos en cada mano activa const gestos = manosActivas.map(mano => detectarGestosMano(mano.suavizados)).filter(Boolean);

 if (gestos.length >0) {
 const nuevoGesto = gestos.join(" + ");

 if (nuevoGesto === gestoActual) {
 gestoFrames++;
 } else {
 gestoActual = nuevoGesto;
 gestoFrames =1;
 }

 if (gestoFrames >= GESTO_FRAMES_CONFIRMACION && gestureIndicator) {
 gestureIndicator.textContent = `Gesto: ${gestoActual}`;
 gestureIndicator.classList.add("visible");
 }
 } else {
 gestoActual = null;
 gestoFrames =0;
 if (gestureIndicator) {
 gestureIndicator.textContent = "";
 gestureIndicator.classList.remove("visible");
 }
 }
}

/* ========================================================= PROCESAMIENTO DE VIDEO — Bucle principal========================================================= */

async function procesarVideo(tiempo) {
 requestAnimationFrame(procesarVideo);

 if (!camaraActiva || video.readyState< 2) return;

 ajustarCanvas();

 const plataforma = detectarPlataforma();

 let intervalo;

 if (plataforma === "movil") {
 intervalo =33; // ~30 fps } else if (plataforma === "tablet") {
 intervalo =20; // ~50 fps } else {
 intervalo =11; // ~90 fps (más responsivo en PC)
 }

 if (tiempo - ultimoProcesamiento< intervalo) return;

 ultimoProcesamiento = tiempo;

 if (modelosDisponibles && !procesando) {
 procesando = true;

 try {
 await Promise.all([
 pose.send({ image: video }),
 hands.send({ image: video }),
 faceMesh.send({ image: video })
 ]);
 } catch (error) {
 console.error(error);
 } finally {
 procesando = false;
 }
 }

 // Limpiar ctx.clearRect(0,0, canvas.width, canvas.height);

 // Dibujar elementos dibujarCuerpo(cuerpoSuavizado);
 dibujarManos();
 dibujarCara(caraSuavizada);
 dibujarCuadro();

 // Actualizar gesto detectado actualizarGestoDetectado();

 // Frame de grabación si está grabando if (grabando) {
 frameGrabacion();
 }

 // Captura automatica cuando el gesto se mantiene if (verificarGestoCuadro()) {
 const ahora = Date.now();
 if (ahora - ultimaCaptura >= COOLDOWN_CAPTURA) {
 capturarPantallaCompleta();
 }
 }
}

/* ========================================================= EVENTOS — Botones========================================================= */

if (startButton) {
 startButton.addEventListener("click", () => {
 if (camaraActiva) {
 detenerCamara();
 } else {
 iniciarCamara();
 }
 });
}

if (switchButton) {
 switchButton.addEventListener("click", async () => {
 camaraFrontal = !camaraFrontal;
 actualizarEspejo();

 if (camaraActiva) {
 await iniciarCamara();
 }
 });
}

if (fullscreenButton) {
 fullscreenButton.addEventListener("click", async () => {
 try {
 if (!document.fullscreenElement) {
 await container.requestFullscreen();
 } else {
 await document.exitFullscreen();
 }
 } catch (error) {
 console.error(error);
 }
 });
}

if (captureButton) {
 captureButton.addEventListener("click", () => {
 // Si hay cuadro formado, captura el cuadro; si no, captura toda la pantalla const cuadro = obtenerPuntosCuadro();
 if (cuadro) {
 capturarCuadro();
 } else {
 capturarPantallaCompleta();
 }
 });
}

if (recordButton) {
 recordButton.addEventListener("click", () => {
 if (grabando) {
 detenerGrabacion();
 } else {
 iniciarGrabacion();
 }
 });
}

if (filterSelect) {
 filterSelect.addEventListener("change", (e) => {
 filtroActual = e.target.value;
 video.style.filter = obtenerFiltroCSS(filtroActual);
 canvas.style.filter = obtenerFiltroCSS(filtroActual);
 });
}

/* ========================================================= EVENTOS — Resize y orientación========================================================= */

window.addEventListener("resize", () => {
 adaptarPlataforma();
});

window.addEventListener("orientationchange", () => {
 setTimeout(() => {
 adaptarPlataforma();
 ajustarCanvas();
 },300);
});

/* ========================================================= INICIO========================================================= */

adaptarPlataforma();
inicializarModelos();
requestAnimationFrame(procesarVideo);
