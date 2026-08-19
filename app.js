"use strict";

/* =========================================================
   ELEMENTOS
========================================================= */

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const ctx = canvas.getContext("2d", {
  alpha: true,
  desynchronized: true
});

function crearBufferInferencia() {
  const lienzo = document.createElement("canvas");

  const contexto = lienzo.getContext("2d", {
    alpha: false,
    desynchronized: true
  });

  return {
    lienzo,
    contexto
  };
}

const buffersInferencia = {
  hands: crearBufferInferencia(),
  pose: crearBufferInferencia(),
  face: crearBufferInferencia()
};

const startButton = document.getElementById("startButton");
const switchButton = document.getElementById("switchButton");
const fullscreenButton = document.getElementById("fullscreenButton");
const statusText = document.getElementById("status");
const flash = document.getElementById("flash");
const miniatura = document.getElementById("miniaturaCaptura");
const platformBadge = document.getElementById("platformBadge");
const container = document.getElementById("container");
const filterSelect = document.getElementById("filterSelect");
const gestureIndicator = document.getElementById("gestureIndicator");

/* =========================================================
   ESTADO GENERAL
========================================================= */

let stream = null;
let camaraFrontal = true;
let camaraActiva = false;
let iniciandoCamara = false;

let pose = null;
let hands = null;
let faceMesh = null;

let modelosDisponibles = false;
let detectorOcupado = false;
let indiceDetector = 0;
let siguienteDeteccion = 0;
let erroresDetector = 0;

let plataformaActual = "pc";
let secuenciaDeteccion = ["hands", "pose", "face"];
let pausaEntreModelos = 0;

let intervalosModelo = {
  hands: 22,
  pose: 28,
  face: 30
};

const ultimaEjecucionModelo = {
  hands: -Infinity,
  pose: -Infinity,
  face: -Infinity
};

let dprActual = 1;
let factorCalidadInferencia = 1;
let promedioInferencia = 0;
let muestrasInferencia = 0;
let ultimoAjusteInferencia = 0;
let ultimoFrameRender = 0;
let ultimaRevisionCanvas = 0;
let calidadCamaraTexto = "";

let filtroActual = "none";
let vistaEspejada = true;
let animacionId = 0;
let ultimaActualizacionEstado = 0;
let mantenerEstadoHasta = 0;

let ultimaUrlCaptura = null;
let capturaEnCurso = false;

/* =========================================================
   DATOS DE SEGUIMIENTO
========================================================= */

let cuerpoSuavizado = null;
let caraSuavizada = null;
let cuerpoObjetivo = null;
let caraObjetivo = null;

let fallosCuerpo = 0;
let fallosCara = 0;
let ultimoCuerpoVisto = 0;
let ultimaCaraVista = 0;

const manoTracks = [
  {
    id: 0,
    nombre: "MANO 1",
    color: "#008cff",
    objetivo: null,
    suavizados: null,
    activa: false,
    centro: null,
    perdida: 0,
    ultimaVista: 0
  },
  {
    id: 1,
    nombre: "MANO 2",
    color: "#ff2bd6",
    objetivo: null,
    suavizados: null,
    activa: false,
    centro: null,
    perdida: 0,
    ultimaVista: 0
  }
];

/* =========================================================
   CAPTURA AUTOMÁTICA POR GESTO
========================================================= */

let gestoDetectadoFrames = 0;
let gestoCapturaBloqueado = false;
let ultimaCaptura = 0;

const FRAMES_PARA_CAPTURA = 12;
const COOLDOWN_CAPTURA = 3500;

let gestoActual = null;
let gestoFrames = 0;

const GESTO_FRAMES_CONFIRMACION = 6;

/* =========================================================
   COLORES Y SUAVIZADO
========================================================= */

const COLOR_CUERPO = "#00ffc8";
const COLOR_CARA = "#ffd000";
const COLOR_OJO = "#00eaff";
const COLOR_BOCA = "#ff4fa3";
const COLOR_NARIZ = "#ff9d00";
const COLOR_CEJA = "#b66cff";

const OPACIDAD_RELLENO_MANO = 0.38;
const OPACIDAD_RELLENO_CUERPO = 0.25;
const OPACIDAD_RELLENO_CARA = 0.13;

// Respuesta alta para reducir el retraso,
// conservando estabilidad cuando no hay movimiento.
const RAPIDEZ_CUERPO = 30;
const RAPIDEZ_MANO = 42;
const RAPIDEZ_CARA = 28;

/* =========================================================
   CONEXIONES DEL CUERPO, MANOS Y CARA
========================================================= */

const conexionesCuerpo = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],

  [11, 23],
  [12, 24],
  [23, 24],

  [23, 25],
  [25, 27],
  [27, 29],
  [29, 31],

  [24, 26],
  [26, 28],
  [28, 30],
  [30, 32],

  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],

  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],

  [27, 31],
  [28, 32],

  [0, 1],
  [1, 2],
  [2, 3],

  [0, 4],
  [4, 5],
  [5, 6],

  [9, 10]
];

const conexionesMano = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],

  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],

  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],

  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],

  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],

  [0, 17]
];

const cadenasDedos = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [0, 9, 10, 11, 12],
  [0, 13, 14, 15, 16],
  [0, 17, 18, 19, 20]
];

const conexionesPalmaMano = [
  [0, 1],
  [1, 5],
  [0, 5],
  [5, 9],
  [9, 13],
  [13, 17],
  [17, 0]
];

/* El diseño facial se conserva */
const contornoCara = [
  10, 338, 297, 332, 284, 251, 389, 356,
  454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109
];

const ojoIzquierdo = [
  33, 7, 163, 144, 145, 153, 154, 155,
  133, 173, 157, 158, 159, 160, 161, 246
];

const ojoDerecho = [
  362, 382, 381, 380, 374, 373, 390, 249,
  263, 466, 388, 387, 386, 385, 384, 398
];

const cejaIzquierda = [
  70, 63, 105, 66, 107, 55, 65, 52, 53
];

const cejaDerecha = [
  336, 296, 334, 293, 300, 285, 295, 282, 283
];

const nariz = [
  168, 6, 197, 195, 5, 4, 45, 220,
  115, 48, 64, 98, 97, 2, 326, 327,
  294, 278, 344, 440, 274, 1
];

const bocaExterior = [
  61, 146, 91, 181, 84, 17, 314, 405,
  321, 375, 291, 308, 324, 318, 402,
  317, 14, 87, 178, 88, 95, 78, 61
];

const bocaInterior = [
  78, 191, 80, 81, 82, 13, 312, 311,
  310, 415, 308, 324, 318, 402, 317,
  14, 87, 178, 88, 95
];

/* =========================================================
   UTILIDADES GENERALES
========================================================= */

function cambiarEstado(texto, duracion = 0) {
  if (statusText) {
    statusText.textContent = texto;
  }

  mantenerEstadoHasta =
    duracion > 0
      ? performance.now() + duracion
      : 0;
}

function limitar(valor, minimo, maximo) {
  return Math.max(
    minimo,
    Math.min(maximo, valor)
  );
}

function distancia(a, b) {
  if (!a || !b) {
    return Infinity;
  }

  return Math.hypot(
    a.x - b.x,
    a.y - b.y
  );
}

function escalaDibujo(valor) {
  if (!canvas.width || !canvas.height) {
    return valor;
  }

  const anchoVisible = Math.max(
    canvas.clientWidth,
    1
  );

  const altoVisible = Math.max(
    canvas.clientHeight,
    1
  );

  const pixelesInternosPorPixelCSS = Math.min(
    canvas.width / anchoVisible,
    canvas.height / altoVisible
  );

  return valor * pixelesInternosPorPixelCSS;
}

function esperar(milisegundos) {
  return new Promise(resolve => {
    setTimeout(resolve, milisegundos);
  });
}

/* =========================================================
   PLATAFORMA Y RENDIMIENTO
========================================================= */

function detectarPlataforma() {
  const ua = navigator.userAgent || "";

  const ancho = Math.min(
    window.innerWidth,
    window.innerHeight
  );

  const esIPadOS =
    /Macintosh/i.test(ua) &&
    navigator.maxTouchPoints > 1;

  if (
    navigator.userAgentData?.mobile ||
    /iPhone|iPod|Android.*Mobile/i.test(ua) ||
    (
      navigator.maxTouchPoints > 1 &&
      ancho < 700
    )
  ) {
    return "movil";
  }

  if (
    /iPad|Android/i.test(ua) ||
    esIPadOS ||
    window.innerWidth < 1200
  ) {
    return "tablet";
  }

  return "pc";
}

function adaptarPlataforma() {
  plataformaActual = detectarPlataforma();

  document.body.classList.remove(
    "is-mobile",
    "is-tablet",
    "is-desktop"
  );

  if (plataformaActual === "movil") {
    document.body.classList.add("is-mobile");
    platformBadge.textContent = "MÓVIL";

    intervalosModelo = {
      hands: 34,
      pose: 42,
      face: 46
    };

    pausaEntreModelos = 0;

    if (!camaraActiva) {
      factorCalidadInferencia = 0.82;
    }
  } else if (plataformaActual === "tablet") {
    document.body.classList.add("is-tablet");
    platformBadge.textContent = "TABLET";

    intervalosModelo = {
      hands: 28,
      pose: 34,
      face: 38
    };

    pausaEntreModelos = 0;

    if (!camaraActiva) {
      factorCalidadInferencia = 0.9;
    }
  } else {
    document.body.classList.add("is-desktop");
    platformBadge.textContent = "PC";

    intervalosModelo = {
      hands: 22,
      pose: 28,
      face: 30
    };

    pausaEntreModelos = 0;

    if (!camaraActiva) {
      factorCalidadInferencia = 1;
    }
  }

  secuenciaDeteccion = [
    "hands",
    "pose",
    "face"
  ];

  ajustarCanvas();
}

/* =========================================================
   CANVAS
========================================================= */

function ajustarCanvas() {
  if (!video.videoWidth || !video.videoHeight) {
    return;
  }

  /*
   * La cámara conserva su resolución completa.
   * El overlay se limita para poder redibujarse fluidamente.
   */
  const dimensionVideo = Math.max(
    video.videoWidth,
    video.videoHeight
  );

  const limiteDimension =
    plataformaActual === "pc"
      ? 2560
      : 1920;

  const escalaMaxima =
    limiteDimension / dimensionVideo;

  dprActual = limitar(
    Math.min(
      window.devicePixelRatio || 1,
      escalaMaxima
    ),
    0.5,
    2
  );

  const anchoFisico = Math.round(
    video.videoWidth * dprActual
  );

  const altoFisico = Math.round(
    video.videoHeight * dprActual
  );

  if (
    canvas.width !== anchoFisico ||
    canvas.height !== altoFisico
  ) {
    canvas.width = anchoFisico;
    canvas.height = altoFisico;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}

/* =========================================================
   CÁMARA
========================================================= */

function actualizarEspejo() {
  const invertirFiltro =
    filtroActual === "mirror";

  vistaEspejada = camaraFrontal
    ? !invertirFiltro
    : invertirFiltro;

  video.classList.toggle(
    "mirror",
    vistaEspejada
  );

  canvas.classList.toggle(
    "mirror",
    vistaEspejada
  );
}

function liberarStream() {
  if (stream) {
    stream
      .getTracks()
      .forEach(track => track.stop());
  }

  stream = null;
  video.pause();
  video.srcObject = null;
}

function esperarVideoListo() {
  if (
    video.videoWidth > 0 &&
    video.videoHeight > 0
  ) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      limpiar();

      reject(
        new Error(
          "La cámara tardó demasiado en responder"
        )
      );
    }, 8000);

    const listo = () => {
      if (
        !video.videoWidth ||
        !video.videoHeight
      ) {
        return;
      }

      limpiar();
      resolve();
    };

    const limpiar = () => {
      clearTimeout(timeout);

      video.removeEventListener(
        "loadedmetadata",
        listo
      );

      video.removeEventListener(
        "canplay",
        listo
      );
    };

    video.addEventListener(
      "loadedmetadata",
      listo
    );

    video.addEventListener(
      "canplay",
      listo
    );
  });
}

async function solicitarStreamCamara() {
  const esMovil =
    plataformaActual === "movil";

  const esPc =
    plataformaActual === "pc";

  const anchoIdeal =
    esPc ? 2560 : 1920;

  const altoIdeal =
    esPc ? 1440 : 1080;

  const fpsIdeal =
    esMovil ? 30 : 60;

  const restricciones = {
    audio: false,

    video: {
      facingMode: {
        ideal: camaraFrontal
          ? "user"
          : "environment"
      },

      width: {
        ideal: anchoIdeal
      },

      height: {
        ideal: altoIdeal
      },

      frameRate: {
        ideal: fpsIdeal,
        max: 60
      }
    }
  };

  try {
    return await navigator.mediaDevices.getUserMedia(
      restricciones
    );
  } catch (error) {
    if (error.name !== "OverconstrainedError") {
      throw error;
    }

    return navigator.mediaDevices.getUserMedia({
      audio: false,

      video: {
        facingMode: camaraFrontal
          ? "user"
          : "environment"
      }
    });
  }
}

function mensajeErrorCamara(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "❌ Permite el acceso a la cámara en el navegador";

    case "NotFoundError":
    case "DevicesNotFoundError":
      return "❌ No se encontró una cámara";

    case "NotReadableError":
    case "TrackStartError":
      return "❌ Otra aplicación está usando la cámara";

    default:
      return "❌ No se pudo iniciar la cámara";
  }
}

async function iniciarCamara() {
  if (iniciandoCamara) {
    return false;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    cambiarEstado(
      "❌ Este navegador no permite usar la cámara"
    );

    return false;
  }

  if (!window.isSecureContext) {
    cambiarEstado(
      "❌ Abre la página con HTTPS para usar la cámara"
    );

    return false;
  }

  iniciandoCamara = true;
  startButton.disabled = true;
  switchButton.disabled = true;

  cambiarEstado(
    "🔄 Iniciando cámara..."
  );

  try {
    const habiaStream = Boolean(stream);

    camaraActiva = false;
    liberarStream();

    if (habiaStream) {
      await esperar(100);
    }

    stream = await solicitarStreamCamara();
    video.srcObject = stream;

    const pistaVideo =
      stream.getVideoTracks()[0];

    if (pistaVideo) {
      if ("contentHint" in pistaVideo) {
        pistaVideo.contentHint = "motion";
      }

      pistaVideo.addEventListener(
        "ended",
        () => {
          const pistaActual =
            stream?.getVideoTracks?.()[0];

          if (
            camaraActiva &&
            pistaActual === pistaVideo
          ) {
            detenerCamara();
          }
        },
        { once: true }
      );
    }

    await esperarVideoListo();
    await video.play();

    const ajustesCamara =
      pistaVideo?.getSettings?.() || {};

    const anchoReal =
      ajustesCamara.width ||
      video.videoWidth;

    const altoReal =
      ajustesCamara.height ||
      video.videoHeight;

    const fpsReal =
      ajustesCamara.frameRate
        ? ` · ${Math.round(ajustesCamara.frameRate)} fps`
        : "";

    calidadCamaraTexto =
      `${anchoReal}×${altoReal}${fpsReal}`;

    camaraActiva = true;
    indiceDetector = 0;
    promedioInferencia = 0;
    muestrasInferencia = 0;
    ultimoAjusteInferencia = 0;
    siguienteDeteccion = performance.now();
    ultimoFrameRender = performance.now();

    reiniciarSeguimiento();
    reiniciarPlanificadorModelos();
    actualizarEspejo();
    ajustarCanvas();

    ultimaRevisionCanvas =
      performance.now();

    startButton.textContent =
      "⏹️ Detener cámara";

    switchButton.disabled = false;

    if (modelosDisponibles) {
      cambiarEstado(
        "🟢 Cámara activa · buscando manos, cara y cuerpo",
        1000
      );
    } else {
      cambiarEstado(
        "⚠️ Cámara activa · los modelos no cargaron",
        1800
      );
    }

    return true;
  } catch (error) {
    console.error(
      "Error de cámara:",
      error
    );

    liberarStream();
    camaraActiva = false;

    startButton.textContent =
      "📷 Iniciar cámara";

    cambiarEstado(
      mensajeErrorCamara(error)
    );

    return false;
  } finally {
    iniciandoCamara = false;
    startButton.disabled = false;
    switchButton.disabled = !camaraActiva;
  }
}

function detenerCamara() {
  liberarStream();

  camaraActiva = false;
  ultimoFrameRender = 0;

  reiniciarSeguimiento();

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  startButton.textContent =
    "📷 Iniciar cámara";

  switchButton.disabled = true;

  cambiarEstado(
    "Cámara detenida"
  );
}

/* =========================================================
   SUAVIZADO Y REINICIO
========================================================= */

function clonarLandmarks(landmarks) {
  if (!landmarks) {
    return null;
  }

  return landmarks.map(puntoActual => {
    if (!puntoActual) {
      return null;
    }

    return {
      x: puntoActual.x,
      y: puntoActual.y,
      z: puntoActual.z || 0,
      visibility: puntoActual.visibility
    };
  });
}

function interpolarLandmarks(
  actuales,
  objetivo,
  rapidez,
  delta,
  respuestaMovimiento = 5.5,
  factorMaximo = 0.95
) {
  if (!objetivo) {
    return null;
  }

  if (
    !actuales ||
    actuales.length !== objetivo.length
  ) {
    return clonarLandmarks(objetivo);
  }

  /*
   * Interpolación independiente de los FPS.
   * La zona estable elimina vibraciones pequeñas.
   * Los movimientos grandes obtienen una respuesta más rápida.
   */
  const deltaSeguro = limitar(
    delta || 16.67,
    8,
    50
  );

  const factorBase =
    1 -
    Math.exp(
      -(rapidez * deltaSeguro) / 1000
    );

  return objetivo.map(
    (puntoObjetivo, indice) => {
      if (!puntoObjetivo) {
        return null;
      }

      const puntoActual =
        actuales[indice];

      if (!puntoActual) {
        return {
          x: puntoObjetivo.x,
          y: puntoObjetivo.y,
          z: puntoObjetivo.z || 0,
          visibility: puntoObjetivo.visibility
        };
      }

      let diferenciaX =
        puntoObjetivo.x -
        puntoActual.x;

      let diferenciaY =
        puntoObjetivo.y -
        puntoActual.y;

      if (Math.abs(diferenciaX) < 0.0003) {
        diferenciaX = 0;
      }

      if (Math.abs(diferenciaY) < 0.0003) {
        diferenciaY = 0;
      }

      const movimiento = Math.hypot(
        diferenciaX,
        diferenciaY
      );

      const factorAdaptativo = limitar(
        factorBase +
          Math.min(movimiento, 0.18) *
            respuestaMovimiento,
        factorBase,
        factorMaximo
      );

      const visibilidadActual =
        puntoActual.visibility;

      const visibilidadObjetivo =
        puntoObjetivo.visibility;

      let visibility =
        visibilidadObjetivo;

      if (
        visibilidadActual !== undefined &&
        visibilidadObjetivo !== undefined
      ) {
        visibility =
          visibilidadActual +
          (
            visibilidadObjetivo -
            visibilidadActual
          ) *
            factorAdaptativo;
      }

      return {
        x:
          puntoActual.x +
          diferenciaX *
            factorAdaptativo,

        y:
          puntoActual.y +
          diferenciaY *
            factorAdaptativo,

        z:
          (puntoActual.z || 0) +
          (
            (puntoObjetivo.z || 0) -
            (puntoActual.z || 0)
          ) *
            factorAdaptativo,

        visibility
      };
    }
  );
}

function actualizarSuavizadoVisual(delta) {
  if (cuerpoObjetivo) {
    cuerpoSuavizado =
      interpolarLandmarks(
        cuerpoSuavizado,
        cuerpoObjetivo,
        RAPIDEZ_CUERPO,
        delta,
        5.4,
        0.95
      );
  }

  if (caraObjetivo) {
    caraSuavizada =
      interpolarLandmarks(
        caraSuavizada,
        caraObjetivo,
        RAPIDEZ_CARA,
        delta,
        4.4,
        0.93
      );
  }

  manoTracks.forEach(mano => {
    if (
      !mano.activa ||
      !mano.objetivo
    ) {
      return;
    }

    mano.suavizados =
      interpolarLandmarks(
        mano.suavizados,
        mano.objetivo,
        RAPIDEZ_MANO,
        delta,
        7,
        0.98
      );
  });
}

function desactivarMano(mano) {
  mano.objetivo = null;
  mano.suavizados = null;
  mano.activa = false;
  mano.centro = null;
  mano.perdida = 0;
  mano.ultimaVista = 0;
}

function reiniciarSeguimiento() {
  cuerpoObjetivo = null;
  caraObjetivo = null;
  cuerpoSuavizado = null;
  caraSuavizada = null;

  fallosCuerpo = 0;
  fallosCara = 0;

  ultimoCuerpoVisto = 0;
  ultimaCaraVista = 0;

  manoTracks.forEach(
    desactivarMano
  );

  gestoDetectadoFrames = 0;
  gestoCapturaBloqueado = false;
  gestoActual = null;
  gestoFrames = 0;

  if (gestureIndicator) {
    gestureIndicator.textContent = "";

    gestureIndicator.classList.remove(
      "visible"
    );
  }
}

/* =========================================================
   TRACKING PERSISTENTE DE MANOS
========================================================= */

function centroMano(landmarks) {
  if (!landmarks?.length) {
    return null;
  }

  const indicesPalma = [
    0,
    5,
    9,
    13,
    17
  ];

  const puntos = indicesPalma
    .map(indice => landmarks[indice])
    .filter(Boolean);

  if (!puntos.length) {
    return null;
  }

  return {
    x:
      puntos.reduce(
        (suma, puntoActual) =>
          suma + puntoActual.x,
        0
      ) / puntos.length,

    y:
      puntos.reduce(
        (suma, puntoActual) =>
          suma + puntoActual.y,
        0
      ) / puntos.length
  };
}

function actualizarTrackMano(
  mano,
  deteccion,
  centro,
  ahora
) {
  mano.objetivo =
    clonarLandmarks(deteccion);

  if (!mano.suavizados) {
    mano.suavizados =
      clonarLandmarks(deteccion);
  }

  mano.activa = true;
  mano.centro = centro;
  mano.perdida = 0;
  mano.ultimaVista = ahora;
}

function actualizarManos(detecciones) {
  const ahora = performance.now();

  const centros =
    detecciones.map(centroMano);

  const pares = [];

  manoTracks.forEach(
    (mano, indiceTrack) => {
      if (
        !mano.activa ||
        !mano.centro
      ) {
        return;
      }

      centros.forEach(
        (centro, indiceDeteccion) => {
          if (!centro) {
            return;
          }

          pares.push({
            indiceTrack,
            indiceDeteccion,

            distancia: distancia(
              mano.centro,
              centro
            )
          });
        }
      );
    }
  );

  pares.sort(
    (a, b) => a.distancia - b.distancia
  );

  const tracksUsados = new Set();
  const deteccionesUsadas = new Set();

  pares.forEach(par => {
    if (par.distancia > 0.34) {
      return;
    }

    if (
      tracksUsados.has(par.indiceTrack) ||
      deteccionesUsadas.has(
        par.indiceDeteccion
      )
    ) {
      return;
    }

    actualizarTrackMano(
      manoTracks[par.indiceTrack],
      detecciones[par.indiceDeteccion],
      centros[par.indiceDeteccion],
      ahora
    );

    tracksUsados.add(
      par.indiceTrack
    );

    deteccionesUsadas.add(
      par.indiceDeteccion
    );
  });

  manoTracks.forEach(
    (mano, indiceTrack) => {
      if (
        !mano.activa ||
        tracksUsados.has(indiceTrack)
      ) {
        return;
      }

      mano.perdida += 1;

      if (mano.perdida > 6) {
        desactivarMano(mano);
      }
    }
  );

  detecciones.forEach(
    (deteccion, indiceDeteccion) => {
      if (
        deteccionesUsadas.has(
          indiceDeteccion
        )
      ) {
        return;
      }

      const manoLibre =
        manoTracks.find(
          mano => !mano.activa
        );

      const centro =
        centros[indiceDeteccion];

      if (!manoLibre || !centro) {
        return;
      }

      actualizarTrackMano(
        manoLibre,
        deteccion,
        centro,
        ahora
      );

      deteccionesUsadas.add(
        indiceDeteccion
      );
    }
  );
}

/* =========================================================
   MEDIAPIPE
========================================================= */

function inicializarPose() {
  pose = new window.Pose({
    locateFile: archivo =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${archivo}`
  });

  pose.setOptions({
    modelComplexity:
      plataformaActual === "movil"
        ? 0
        : 1,

    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.55,
    minTrackingConfidence: 0.5
  });

  pose.onResults(resultado => {
    if (!camaraActiva) {
      return;
    }

    if (
      resultado.poseLandmarks?.length
    ) {
      cuerpoObjetivo =
        clonarLandmarks(
          resultado.poseLandmarks
        );

      if (!cuerpoSuavizado) {
        cuerpoSuavizado =
          clonarLandmarks(
            resultado.poseLandmarks
          );
      }

      fallosCuerpo = 0;

      ultimoCuerpoVisto =
        performance.now();
    } else {
      fallosCuerpo += 1;

      if (fallosCuerpo > 3) {
        cuerpoObjetivo = null;
        cuerpoSuavizado = null;
      }
    }
  });
}

function inicializarHands() {
  hands = new window.Hands({
    locateFile: archivo =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${archivo}`
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.55,
    minTrackingConfidence: 0.5
  });

  hands.onResults(resultado => {
    if (!camaraActiva) {
      return;
    }

    actualizarManos(
      resultado.multiHandLandmarks || []
    );
  });
}

function inicializarFaceMesh() {
  faceMesh = new window.FaceMesh({
    locateFile: archivo =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${archivo}`
  });

  faceMesh.setOptions({
    maxNumFaces: 1,

    /*
     * El dibujo de la cara no cambia.
     * En móvil se evita el modelo adicional para ganar fluidez.
     */
    refineLandmarks:
      plataformaActual !== "movil",

    minDetectionConfidence: 0.55,
    minTrackingConfidence: 0.5
  });

  faceMesh.onResults(resultado => {
    if (!camaraActiva) {
      return;
    }

    const caras =
      resultado.multiFaceLandmarks;

    if (caras?.length) {
      caraObjetivo =
        clonarLandmarks(caras[0]);

      if (!caraSuavizada) {
        caraSuavizada =
          clonarLandmarks(caras[0]);
      }

      fallosCara = 0;

      ultimaCaraVista =
        performance.now();
    } else {
      fallosCara += 1;

      if (fallosCara > 3) {
        caraObjetivo = null;
        caraSuavizada = null;
      }
    }
  });
}

function inicializarModelos() {
  try {
    if (
      !window.Pose ||
      !window.Hands ||
      !window.FaceMesh
    ) {
      throw new Error(
        "No se cargaron las librerías de MediaPipe"
      );
    }

    inicializarPose();
    inicializarHands();
    inicializarFaceMesh();

    modelosDisponibles = true;

    console.info(
      "Modelos de manos, cuerpo y cara preparados"
    );
  } catch (error) {
    modelosDisponibles = false;

    console.error(
      "Error al cargar los modelos:",
      error
    );

    cambiarEstado(
      "❌ No se pudieron cargar los modelos de seguimiento"
    );
  }
}

function obtenerModelo(nombre) {
  if (nombre === "hands") {
    return hands;
  }

  if (nombre === "pose") {
    return pose;
  }

  if (nombre === "face") {
    return faceMesh;
  }

  return null;
}

/* =========================================================
   PREPARACIÓN DE INFERENCIA
========================================================= */

function prepararFrameInferencia(nombreModelo) {
  const buffer =
    buffersInferencia[nombreModelo] ||
    buffersInferencia.hands;

  const canvasInferencia =
    buffer.lienzo;

  const ctxInferencia =
    buffer.contexto;

  const dimensionBase =
    plataformaActual === "movil"
      ? 640
      : plataformaActual === "tablet"
        ? 768
        : 896;

  const factorModelo =
    nombreModelo === "face"
      ? 0.9
      : 1;

  const dimensionObjetivo = Math.round(
    dimensionBase *
      factorCalidadInferencia *
      factorModelo
  );

  const dimensionVideo = Math.max(
    video.videoWidth,
    video.videoHeight
  );

  const escala = Math.min(
    1,
    dimensionObjetivo / dimensionVideo
  );

  const ancho = Math.max(
    240,
    Math.round(video.videoWidth * escala)
  );

  const alto = Math.max(
    135,
    Math.round(video.videoHeight * escala)
  );

  if (
    canvasInferencia.width !== ancho ||
    canvasInferencia.height !== alto
  ) {
    canvasInferencia.width = ancho;
    canvasInferencia.height = alto;

    ctxInferencia.imageSmoothingEnabled =
      true;

    ctxInferencia.imageSmoothingQuality =
      "medium";
  }

  ctxInferencia.setTransform(
    1,
    0,
    0,
    1,
    0,
    0
  );

  ctxInferencia.filter = "none";

  ctxInferencia.drawImage(
    video,
    0,
    0,
    ancho,
    alto
  );

  return canvasInferencia;
}

function registrarRendimientoInferencia(
  duracion
) {
  muestrasInferencia += 1;

  promedioInferencia =
    promedioInferencia
      ? promedioInferencia * 0.88 +
        duracion * 0.12
      : duracion;

  const ahora =
    performance.now();

  if (
    muestrasInferencia < 5 ||
    ahora - ultimoAjusteInferencia < 1500
  ) {
    return;
  }

  const objetivo =
    plataformaActual === "movil"
      ? 58
      : plataformaActual === "tablet"
        ? 48
        : 42;

  if (
    promedioInferencia >
      objetivo * 1.25 &&
    factorCalidadInferencia > 0.62
  ) {
    factorCalidadInferencia = limitar(
      factorCalidadInferencia - 0.08,
      0.62,
      1
    );

    ultimoAjusteInferencia = ahora;
  } else if (
    promedioInferencia <
      objetivo * 0.72 &&
    factorCalidadInferencia < 1
  ) {
    factorCalidadInferencia = limitar(
      factorCalidadInferencia + 0.04,
      0.62,
      1
    );

    ultimoAjusteInferencia = ahora;
  }
}

/* =========================================================
   PLANIFICADOR DE MODELOS
========================================================= */

function reiniciarPlanificadorModelos(
  ahora = performance.now()
) {
  secuenciaDeteccion.forEach(nombre => {
    ultimaEjecucionModelo[nombre] =
      ahora - intervalosModelo[nombre];
  });

  indiceDetector = 0;
}

function elegirSiguienteModelo(ahora) {
  let mejorNombre =
    secuenciaDeteccion[indiceDetector];

  let mejorUrgencia = -Infinity;

  for (
    let desplazamiento = 0;
    desplazamiento <
      secuenciaDeteccion.length;
    desplazamiento++
  ) {
    const indice =
      (
        indiceDetector +
        desplazamiento
      ) %
      secuenciaDeteccion.length;

    const nombre =
      secuenciaDeteccion[indice];

    const intervalo =
      intervalosModelo[nombre] || 50;

    const urgencia =
      (
        ahora -
        ultimaEjecucionModelo[nombre]
      ) /
      intervalo;

    if (urgencia > mejorUrgencia) {
      mejorUrgencia = urgencia;
      mejorNombre = nombre;
    }
  }

  indiceDetector =
    (
      secuenciaDeteccion.indexOf(
        mejorNombre
      ) +
      1
    ) %
    secuenciaDeteccion.length;

  return mejorNombre;
}

function procesarSiguienteModelo(ahora) {
  if (
    !modelosDisponibles ||
    detectorOcupado
  ) {
    return;
  }

  if (
    !camaraActiva ||
    video.readyState <
      HTMLMediaElement.HAVE_CURRENT_DATA
  ) {
    return;
  }

  if (
    document.visibilityState !==
    "visible"
  ) {
    return;
  }

  if (ahora < siguienteDeteccion) {
    return;
  }

  const nombre =
    elegirSiguienteModelo(ahora);

  const modelo =
    obtenerModelo(nombre);

  if (!modelo) {
    return;
  }

  detectorOcupado = true;

  const inicioInferencia =
    performance.now();

  ultimaEjecucionModelo[nombre] =
    inicioInferencia;

  Promise.resolve()
    .then(() => {
      return modelo.send({
        image:
          prepararFrameInferencia(nombre)
      });
    })
    .then(() => {
      erroresDetector = 0;
    })
    .catch(error => {
      erroresDetector += 1;

      console.error(
        `Error procesando ${nombre}:`,
        error
      );

      if (
        erroresDetector >= 6 &&
        camaraActiva
      ) {
        cambiarEstado(
          "⚠️ El seguimiento tuvo un problema; recarga la página",
          2500
        );
      }
    })
    .finally(() => {
      registrarRendimientoInferencia(
        performance.now() -
          inicioInferencia
      );

      detectorOcupado = false;

      siguienteDeteccion =
        performance.now() +
        pausaEntreModelos;
    });
}

/* =========================================================
   DIBUJO BÁSICO
========================================================= */

function visible(
  puntoActual,
  minimo = 0.28
) {
  if (!puntoActual) {
    return false;
  }

  if (
    !Number.isFinite(puntoActual.x) ||
    !Number.isFinite(puntoActual.y)
  ) {
    return false;
  }

  if (
    puntoActual.visibility === undefined
  ) {
    return true;
  }

  return puntoActual.visibility > minimo;
}

function coordenadaCanvas(puntoActual) {
  return {
    x: puntoActual.x * canvas.width,
    y: puntoActual.y * canvas.height
  };
}

function dibujarPunto(
  puntoActual,
  radio
) {
  if (!visible(puntoActual)) {
    return;
  }

  const posicion =
    coordenadaCanvas(puntoActual);

  ctx.beginPath();

  ctx.arc(
    posicion.x,
    posicion.y,
    radio,
    0,
    Math.PI * 2
  );

  ctx.fill();
}

function dibujarLinea(
  a,
  b,
  grosor
) {
  if (!visible(a) || !visible(b)) {
    return;
  }

  const inicio =
    coordenadaCanvas(a);

  const final =
    coordenadaCanvas(b);

  ctx.beginPath();

  ctx.moveTo(
    inicio.x,
    inicio.y
  );

  ctx.lineTo(
    final.x,
    final.y
  );

  ctx.lineWidth = grosor;
  ctx.stroke();
}

function dibujarPoligono(
  landmarks,
  indices,
  color,
  alpha,
  borde = true
) {
  if (
    !indices.every(indice =>
      visible(landmarks[indice])
    )
  ) {
    return;
  }

  const puntos = indices.map(indice =>
    coordenadaCanvas(
      landmarks[indice]
    )
  );

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.beginPath();

  puntos.forEach(
    (puntoActual, indice) => {
      if (indice === 0) {
        ctx.moveTo(
          puntoActual.x,
          puntoActual.y
        );
      } else {
        ctx.lineTo(
          puntoActual.x,
          puntoActual.y
        );
      }
    }
  );

  ctx.closePath();
  ctx.fill();

  if (borde) {
    ctx.globalAlpha = Math.min(
      1,
      alpha + 0.42
    );

    ctx.lineWidth =
      escalaDibujo(3);

    ctx.stroke();
  }

  ctx.restore();
}

function distanciaCanvas(a, b) {
  if (!a || !b) {
    return 0;
  }

  const puntoA =
    coordenadaCanvas(a);

  const puntoB =
    coordenadaCanvas(b);

  return Math.hypot(
    puntoA.x - puntoB.x,
    puntoA.y - puntoB.y
  );
}

/* =========================================================
   DIBUJO DEL CUERPO
========================================================= */

function dibujarSegmentoCorporal(
  a,
  b,
  anchoInicio,
  anchoFinal,
  color
) {
  if (!visible(a) || !visible(b)) {
    return;
  }

  const inicio =
    coordenadaCanvas(a);

  const final =
    coordenadaCanvas(b);

  const dx =
    final.x - inicio.x;

  const dy =
    final.y - inicio.y;

  const largo =
    Math.hypot(dx, dy);

  if (largo < 0.001) {
    return;
  }

  const normalX =
    -dy / largo;

  const normalY =
    dx / largo;

  const mitadInicio =
    anchoInicio * 0.5;

  const mitadFinal =
    anchoFinal * 0.5;

  ctx.save();

  ctx.globalAlpha =
    OPACIDAD_RELLENO_CUERPO;

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.beginPath();

  ctx.moveTo(
    inicio.x +
      normalX * mitadInicio,
    inicio.y +
      normalY * mitadInicio
  );

  ctx.lineTo(
    final.x +
      normalX * mitadFinal,
    final.y +
      normalY * mitadFinal
  );

  ctx.lineTo(
    final.x -
      normalX * mitadFinal,
    final.y -
      normalY * mitadFinal
  );

  ctx.lineTo(
    inicio.x -
      normalX * mitadInicio,
    inicio.y -
      normalY * mitadInicio
  );

  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = Math.min(
    0.72,
    OPACIDAD_RELLENO_CUERPO + 0.32
  );

  ctx.lineWidth =
    escalaDibujo(2);

  ctx.stroke();
  ctx.restore();
}

function dibujarRellenoCuerpo(puntos) {
  if (!puntos) {
    return;
  }

  dibujarPoligono(
    puntos,
    [11, 12, 24, 23],
    COLOR_CUERPO,
    OPACIDAD_RELLENO_CUERPO
  );

  const hombros =
    distanciaCanvas(
      puntos[11],
      puntos[12]
    );

  const caderas =
    distanciaCanvas(
      puntos[23],
      puntos[24]
    );

  const anchoBrazo = limitar(
    hombros * 0.18,
    escalaDibujo(12),
    escalaDibujo(50)
  );

  const anchoPierna = limitar(
    caderas * 0.25,
    escalaDibujo(15),
    escalaDibujo(62)
  );

  dibujarSegmentoCorporal(
    puntos[11],
    puntos[13],
    anchoBrazo,
    anchoBrazo * 0.78,
    COLOR_CUERPO
  );

  dibujarSegmentoCorporal(
    puntos[13],
    puntos[15],
    anchoBrazo * 0.78,
    anchoBrazo * 0.5,
    COLOR_CUERPO
  );

  dibujarSegmentoCorporal(
    puntos[12],
    puntos[14],
    anchoBrazo,
    anchoBrazo * 0.78,
    COLOR_CUERPO
  );

  dibujarSegmentoCorporal(
    puntos[14],
    puntos[16],
    anchoBrazo * 0.78,
    anchoBrazo * 0.5,
    COLOR_CUERPO
  );

  dibujarSegmentoCorporal(
    puntos[23],
    puntos[25],
    anchoPierna,
    anchoPierna * 0.74,
    COLOR_CUERPO
  );

  dibujarSegmentoCorporal(
    puntos[25],
    puntos[27],
    anchoPierna * 0.74,
    anchoPierna * 0.48,
    COLOR_CUERPO
  );

  dibujarSegmentoCorporal(
    puntos[24],
    puntos[26],
    anchoPierna,
    anchoPierna * 0.74,
    COLOR_CUERPO
  );

  dibujarSegmentoCorporal(
    puntos[26],
    puntos[28],
    anchoPierna * 0.74,
    anchoPierna * 0.48,
    COLOR_CUERPO
  );
}

function dibujarCuerpo(puntos) {
  if (!puntos) {
    return;
  }

  dibujarRellenoCuerpo(puntos);

  ctx.save();

  ctx.strokeStyle = COLOR_CUERPO;
  ctx.fillStyle = COLOR_CUERPO;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const anchoHombros =
    distanciaCanvas(
      puntos[11],
      puntos[12]
    );

  const grosorEsqueleto = limitar(
    anchoHombros * 0.035,
    escalaDibujo(5),
    escalaDibujo(10)
  );

  const radioArticulacion = limitar(
    anchoHombros * 0.04,
    escalaDibujo(6.5),
    escalaDibujo(12)
  );

  conexionesCuerpo.forEach(
    ([inicio, final]) => {
      dibujarLinea(
        puntos[inicio],
        puntos[final],
        grosorEsqueleto
      );
    }
  );

  puntos.forEach(
    (puntoActual, indice) => {
      if (!visible(puntoActual)) {
        return;
      }

      const articulacionPrincipal = [
        11,
        12,
        13,
        14,
        15,
        16,
        23,
        24,
        25,
        26,
        27,
        28
      ].includes(indice);

      dibujarPunto(
        puntoActual,

        articulacionPrincipal
          ? radioArticulacion
          : Math.max(
              escalaDibujo(4),
              radioArticulacion * 0.62
            )
      );
    }
  );

  ctx.restore();
}

/* =========================================================
   DIBUJO DE MANOS FLEXIBLES
========================================================= */

function trazarCadenaSuave(
  landmarks,
  indices
) {
  if (
    !indices.every(indice =>
      visible(landmarks[indice])
    )
  ) {
    return false;
  }

  const puntos = indices.map(indice =>
    coordenadaCanvas(
      landmarks[indice]
    )
  );

  const primero = puntos[0];
  const ultimo =
    puntos[puntos.length - 1];

  ctx.moveTo(
    primero.x,
    primero.y
  );

  for (
    let indice = 1;
    indice < puntos.length - 1;
    indice++
  ) {
    const actual =
      puntos[indice];

    const siguiente =
      puntos[indice + 1];

    const medioX =
      (actual.x + siguiente.x) *
      0.5;

    const medioY =
      (actual.y + siguiente.y) *
      0.5;

    ctx.quadraticCurveTo(
      actual.x,
      actual.y,
      medioX,
      medioY
    );
  }

  ctx.lineTo(
    ultimo.x,
    ultimo.y
  );

  return true;
}

function dibujarCadenaFlexible(
  landmarks,
  indices,
  color,
  grosor
) {
  ctx.save();

  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();

  if (
    !trazarCadenaSuave(
      landmarks,
      indices
    )
  ) {
    ctx.restore();
    return;
  }

  ctx.globalAlpha = 0.28;
  ctx.lineWidth = grosor * 1.85;
  ctx.stroke();

  ctx.globalAlpha = 0.96;
  ctx.lineWidth = grosor;
  ctx.stroke();

  ctx.restore();
}

function dibujarMano(
  landmarks,
  color
) {
  if (!landmarks) {
    return;
  }

  dibujarPoligono(
    landmarks,
    [0, 1, 5, 9, 13, 17],
    color,
    OPACIDAD_RELLENO_MANO
  );

  const tamanoPalma =
    distanciaCanvas(
      landmarks[0],
      landmarks[9]
    );

  const grosorHueso = limitar(
    tamanoPalma * 0.14,
    escalaDibujo(5.5),
    escalaDibujo(13)
  );

  const radioPunto = limitar(
    tamanoPalma * 0.085,
    escalaDibujo(5),
    escalaDibujo(10.5)
  );

  ctx.save();

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  /*
   * La palma mantiene su forma mientras
   * cada dedo usa una curva independiente.
   */
  ctx.beginPath();

  conexionesPalmaMano.forEach(
    ([inicio, final]) => {
      if (
        !visible(landmarks[inicio]) ||
        !visible(landmarks[final])
      ) {
        return;
      }

      const a =
        coordenadaCanvas(
          landmarks[inicio]
        );

      const b =
        coordenadaCanvas(
          landmarks[final]
        );

      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
  );

  ctx.globalAlpha = 0.25;
  ctx.lineWidth =
    grosorHueso * 1.65;
  ctx.stroke();

  ctx.globalAlpha = 0.92;
  ctx.lineWidth =
    grosorHueso * 0.78;
  ctx.stroke();

  ctx.restore();

  cadenasDedos.forEach(
    (cadena, indice) => {
      const factorGrosor =
        indice === 0
          ? 1.06
          : limitar(
              1.04 -
                indice * 0.035,
              0.88,
              1.04
            );

      dibujarCadenaFlexible(
        landmarks,
        cadena,
        color,
        grosorHueso *
          factorGrosor
      );
    }
  );

  ctx.save();
  ctx.fillStyle = color;

  landmarks.forEach(
    (puntoActual, indice) => {
      const esPunta = [
        4,
        8,
        12,
        16,
        20
      ].includes(indice);

      const esBase = [
        0,
        1,
        5,
        9,
        13,
        17
      ].includes(indice);

      const factorRadio =
        esPunta
          ? 1.32
          : esBase
            ? 1.12
            : 0.9;

      dibujarPunto(
        puntoActual,
        radioPunto * factorRadio
      );
    }
  );

  ctx.restore();
}

function dibujarManos() {
  manoTracks.forEach(mano => {
    if (
      mano.activa &&
      mano.suavizados
    ) {
      dibujarMano(
        mano.suavizados,
        mano.color
      );
    }
  });
}

/* =========================================================
   DIBUJO DE LA CARA
   Se mantiene el diseño original
========================================================= */

function dibujarContornoCara(puntos) {
  if (
    !contornoCara.every(
      indice => puntos[indice]
    )
  ) {
    return;
  }

  const contorno =
    contornoCara.map(indice =>
      coordenadaCanvas(
        puntos[indice]
      )
    );

  ctx.save();

  ctx.strokeStyle = COLOR_CARA;
  ctx.fillStyle = COLOR_CARA;
  ctx.lineWidth = escalaDibujo(4);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  contorno.forEach(
    (puntoActual, indice) => {
      if (indice === 0) {
        ctx.moveTo(
          puntoActual.x,
          puntoActual.y
        );
      } else {
        ctx.lineTo(
          puntoActual.x,
          puntoActual.y
        );
      }
    }
  );

  ctx.closePath();

  ctx.globalAlpha =
    OPACIDAD_RELLENO_CARA;

  ctx.fill();

  ctx.globalAlpha = 0.95;
  ctx.stroke();

  ctx.restore();
}

function dibujarEstructuraFacial(
  puntos,
  indices,
  color,
  grosor = 4,
  cerrar = false
) {
  const estructura = indices
    .map(indice => puntos[indice])
    .filter(Boolean);

  if (estructura.length < 2) {
    return;
  }

  ctx.save();

  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  ctx.lineWidth =
    escalaDibujo(grosor);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  estructura.forEach(
    (puntoActual, indice) => {
      const posicion =
        coordenadaCanvas(
          puntoActual
        );

      if (indice === 0) {
        ctx.moveTo(
          posicion.x,
          posicion.y
        );
      } else {
        ctx.lineTo(
          posicion.x,
          posicion.y
        );
      }
    }
  );

  if (cerrar) {
    ctx.closePath();
  }

  ctx.stroke();

  estructura.forEach(
    puntoActual => {
      dibujarPunto(
        puntoActual,
        escalaDibujo(2.7)
      );
    }
  );

  ctx.restore();
}

function dibujarCara(puntos) {
  if (!puntos) {
    return;
  }

  dibujarContornoCara(puntos);

  dibujarEstructuraFacial(
    puntos,
    ojoIzquierdo,
    COLOR_OJO,
    3.5,
    true
  );

  dibujarEstructuraFacial(
    puntos,
    ojoDerecho,
    COLOR_OJO,
    3.5,
    true
  );

  dibujarEstructuraFacial(
    puntos,
    cejaIzquierda,
    COLOR_CEJA,
    4.5,
    false
  );

  dibujarEstructuraFacial(
    puntos,
    cejaDerecha,
    COLOR_CEJA,
    4.5,
    false
  );

  dibujarEstructuraFacial(
    puntos,
    nariz,
    COLOR_NARIZ,
    3.5,
    false
  );

  dibujarEstructuraFacial(
    puntos,
    bocaExterior,
    COLOR_BOCA,
    4.5,
    true
  );

  dibujarEstructuraFacial(
    puntos,
    bocaInterior,
    COLOR_BOCA,
    3,
    true
  );
}

/* =========================================================
   DETECCIÓN DE GESTOS
========================================================= */

function dedoExtendido(
  landmarks,
  punta,
  articulacion
) {
  const muneca =
    landmarks[0];

  const puntoPunta =
    landmarks[punta];

  const puntoArticulacion =
    landmarks[articulacion];

  if (
    !muneca ||
    !puntoPunta ||
    !puntoArticulacion
  ) {
    return false;
  }

  return (
    distancia(
      puntoPunta,
      muneca
    ) >
    distancia(
      puntoArticulacion,
      muneca
    ) *
      1.12
  );
}

function obtenerDedosExtendidos(
  landmarks
) {
  return {
    pulgar: dedoExtendido(
      landmarks,
      4,
      3
    ),

    indice: dedoExtendido(
      landmarks,
      8,
      6
    ),

    medio: dedoExtendido(
      landmarks,
      12,
      10
    ),

    anular: dedoExtendido(
      landmarks,
      16,
      14
    ),

    menique: dedoExtendido(
      landmarks,
      20,
      18
    )
  };
}

function detectarGestoMano(
  landmarks
) {
  if (!landmarks?.[20]) {
    return null;
  }

  const dedos =
    obtenerDedosExtendidos(
      landmarks
    );

  const cantidad =
    Object.values(dedos)
      .filter(Boolean)
      .length;

  if (
    dedos.indice &&
    dedos.medio &&
    !dedos.anular &&
    !dedos.menique
  ) {
    return "PAZ ✌️";
  }

  if (
    dedos.pulgar &&
    !dedos.indice &&
    !dedos.medio &&
    !dedos.anular &&
    !dedos.menique
  ) {
    return "PULGAR ARRIBA 👍";
  }

  if (cantidad === 0) {
    return "PUÑO ✊";
  }

  if (
    distancia(
      landmarks[4],
      landmarks[8]
    ) < 0.055 &&
    dedos.medio &&
    dedos.anular &&
    dedos.menique
  ) {
    return "OK 👌";
  }

  if (cantidad === 5) {
    return "MANO ABIERTA 🖐️";
  }

  if (
    dedos.indice &&
    !dedos.medio &&
    !dedos.anular &&
    dedos.menique
  ) {
    return "ROCK 🤘";
  }

  return null;
}

function actualizarIndicadorGesto(
  cuadroValido
) {
  if (cuadroValido) {
    const porcentaje = Math.round(
      limitar(
        gestoDetectadoFrames /
          FRAMES_PARA_CAPTURA,
        0,
        1
      ) *
        100
    );

    gestureIndicator.textContent =
      `Marco detectado: mantén las manos ${porcentaje}%`;

    gestureIndicator.classList.add(
      "visible"
    );

    return;
  }

  const gestos = manoTracks
    .filter(mano =>
      mano.activa &&
      mano.suavizados
    )
    .map(mano =>
      detectarGestoMano(
        mano.suavizados
      )
    )
    .filter(Boolean);

  const nuevoGesto =
    gestos.join(" + ");

  if (!nuevoGesto) {
    gestoActual = null;
    gestoFrames = 0;

    gestureIndicator.textContent = "";

    gestureIndicator.classList.remove(
      "visible"
    );

    return;
  }

  if (nuevoGesto === gestoActual) {
    gestoFrames += 1;
  } else {
    gestoActual = nuevoGesto;
    gestoFrames = 1;
  }

  if (
    gestoFrames >=
    GESTO_FRAMES_CONFIRMACION
  ) {
    gestureIndicator.textContent =
      `Gesto: ${gestoActual}`;

    gestureIndicator.classList.add(
      "visible"
    );
  }
}

/* =========================================================
   MARCO DE DOS MANOS Y CAPTURA AUTOMÁTICA
========================================================= */

function manoFormaMarco(landmarks) {
  if (!landmarks?.[20]) {
    return false;
  }

  const dedos =
    obtenerDedosExtendidos(
      landmarks
    );

  const tamanoPalma =
    distancia(
      landmarks[0],
      landmarks[9]
    );

  const apertura =
    distancia(
      landmarks[4],
      landmarks[8]
    );

  const otrosDoblados = [
    dedos.medio,
    dedos.anular,
    dedos.menique
  ].filter(
    valor => !valor
  ).length;

  return Boolean(
    dedos.indice &&
    apertura >
      tamanoPalma * 0.42 &&
    otrosDoblados >= 1
  );
}

function obtenerPuntosCuadro(
  exigirForma = true
) {
  const manos = manoTracks.filter(
    mano =>
      mano.activa &&
      mano.suavizados
  );

  if (manos.length !== 2) {
    return null;
  }

  if (
    exigirForma &&
    !manos.every(mano =>
      manoFormaMarco(
        mano.suavizados
      )
    )
  ) {
    return null;
  }

  const puntos = [
    manos[0].suavizados[4],
    manos[0].suavizados[8],
    manos[1].suavizados[4],
    manos[1].suavizados[8]
  ];

  if (
    puntos.some(
      puntoActual => !puntoActual
    )
  ) {
    return null;
  }

  const xs = puntos.map(
    puntoActual =>
      puntoActual.x * canvas.width
  );

  const ys = puntos.map(
    puntoActual =>
      puntoActual.y * canvas.height
  );

  const cuadro = {
    izquierda: limitar(
      Math.min(...xs),
      0,
      canvas.width
    ),

    derecha: limitar(
      Math.max(...xs),
      0,
      canvas.width
    ),

    arriba: limitar(
      Math.min(...ys),
      0,
      canvas.height
    ),

    abajo: limitar(
      Math.max(...ys),
      0,
      canvas.height
    )
  };

  const ancho =
    cuadro.derecha -
    cuadro.izquierda;

  const alto =
    cuadro.abajo -
    cuadro.arriba;

  if (
    ancho < escalaDibujo(70) ||
    alto < escalaDibujo(70)
  ) {
    return null;
  }

  return cuadro;
}

function dibujarCuadro(
  cuadro,
  valido
) {
  if (!cuadro) {
    return;
  }

  const ancho =
    cuadro.derecha -
    cuadro.izquierda;

  const alto =
    cuadro.abajo -
    cuadro.arriba;

  ctx.save();
  ctx.lineCap = "round";

  ctx.setLineDash([
    escalaDibujo(12),
    escalaDibujo(8)
  ]);

  if (!valido) {
    ctx.strokeStyle =
      "rgba(255,255,255,0.65)";

    ctx.lineWidth =
      escalaDibujo(3);
  } else if (
    gestoDetectadoFrames >=
    FRAMES_PARA_CAPTURA * 0.6
  ) {
    ctx.strokeStyle = "#ffff00";

    ctx.lineWidth =
      escalaDibujo(5);
  } else {
    ctx.strokeStyle = "#ffffff";

    ctx.lineWidth =
      escalaDibujo(4);
  }

  ctx.strokeRect(
    cuadro.izquierda,
    cuadro.arriba,
    ancho,
    alto
  );

  ctx.restore();
}

/* =========================================================
   FILTROS Y CAPTURA AUTOMÁTICA
========================================================= */

function filtroCSSParaCaptura() {
  switch (filtroActual) {
    case "grayscale":
      return "grayscale(1)";

    case "sepia":
      return "sepia(1)";

    case "invert":
      return "invert(1)";

    case "blur":
      return "blur(3px)";

    case "night":
      return (
        "brightness(0.55) " +
        "contrast(1.45) " +
        "saturate(0.75) " +
        "hue-rotate(165deg)"
      );

    case "thermal":
      return (
        "grayscale(1) " +
        "contrast(1.8) " +
        "sepia(1) " +
        "saturate(7) " +
        "hue-rotate(-45deg)"
      );

    default:
      return "none";
  }
}

function dibujarCapaEnCaptura(
  contexto,
  fuente,
  origen,
  anchoDestino,
  altoDestino,
  filtro = "none"
) {
  contexto.save();

  if (vistaEspejada) {
    contexto.translate(
      anchoDestino,
      0
    );

    contexto.scale(
      -1,
      1
    );
  }

  contexto.filter = filtro;

  contexto.drawImage(
    fuente,
    origen.x,
    origen.y,
    origen.ancho,
    origen.alto,
    0,
    0,
    anchoDestino,
    altoDestino
  );

  contexto.restore();
}

function crearCanvasCapturaCompleta() {
  const captura =
    document.createElement("canvas");

  captura.width =
    video.videoWidth;

  captura.height =
    video.videoHeight;

  const capturaCtx =
    captura.getContext(
      "2d",
      { alpha: false }
    );

  capturaCtx.imageSmoothingEnabled =
    true;

  capturaCtx.imageSmoothingQuality =
    "high";

  capturaCtx.fillStyle = "#000";

  capturaCtx.fillRect(
    0,
    0,
    captura.width,
    captura.height
  );

  dibujarCapaEnCaptura(
    capturaCtx,
    video,
    {
      x: 0,
      y: 0,
      ancho: video.videoWidth,
      alto: video.videoHeight
    },
    captura.width,
    captura.height,
    filtroCSSParaCaptura()
  );

  dibujarCapaEnCaptura(
    capturaCtx,
    canvas,
    {
      x: 0,
      y: 0,
      ancho: canvas.width,
      alto: canvas.height
    },
    captura.width,
    captura.height
  );

  return captura;
}

function mostrarFlash() {
  flash.classList.add(
    "activo"
  );

  setTimeout(() => {
    flash.classList.remove(
      "activo"
    );
  }, 150);
}

function descargarBlob(
  blob,
  nombre
) {
  if (ultimaUrlCaptura) {
    URL.revokeObjectURL(
      ultimaUrlCaptura
    );
  }

  ultimaUrlCaptura =
    URL.createObjectURL(blob);

  miniatura.src =
    ultimaUrlCaptura;

  miniatura.classList.add(
    "visible"
  );

  const enlace =
    document.createElement("a");

  enlace.href =
    ultimaUrlCaptura;

  enlace.download =
    nombre;

  enlace.rel =
    "noopener";

  document.body.appendChild(
    enlace
  );

  enlace.click();
  enlace.remove();
}

async function capturarAutomaticamente() {
  if (
    capturaEnCurso ||
    !camaraActiva ||
    !video.videoWidth
  ) {
    return;
  }

  capturaEnCurso = true;

  try {
    const captura =
      crearCanvasCapturaCompleta();

    const blob = await new Promise(
      resolve => {
        captura.toBlob(
          resolve,
          "image/png"
        );
      }
    );

    if (!blob) {
      throw new Error(
        "No se pudo crear la imagen"
      );
    }

    descargarBlob(
      blob,
      `bodytracker-${Date.now()}.png`
    );

    mostrarFlash();

    ultimaCaptura =
      Date.now();

    cambiarEstado(
      "📸 Captura automática lista · toca la miniatura si no se descargó",
      2500
    );
  } catch (error) {
    console.error(
      "Error de captura:",
      error
    );

    cambiarEstado(
      "❌ No se pudo guardar la captura automática",
      1800
    );
  } finally {
    capturaEnCurso = false;
  }
}

function actualizarCapturaAutomatica(
  cuadroValido
) {
  if (!cuadroValido) {
    gestoDetectadoFrames = 0;
    gestoCapturaBloqueado = false;
    return;
  }

  gestoDetectadoFrames = Math.min(
    gestoDetectadoFrames + 1,
    FRAMES_PARA_CAPTURA
  );

  if (
    gestoDetectadoFrames >=
      FRAMES_PARA_CAPTURA &&
    !gestoCapturaBloqueado &&
    Date.now() - ultimaCaptura >=
      COOLDOWN_CAPTURA
  ) {
    gestoCapturaBloqueado = true;

    capturarAutomaticamente();
  }
}

/* =========================================================
   FILTROS DE VISTA
========================================================= */

function aplicarFiltroSeleccionado() {
  video.style.filter =
    filtroCSSParaCaptura();

  actualizarEspejo();

  if (filtroActual === "thermal") {
    cambiarEstado(
      "🌡️ Efecto térmico simulado: una webcam normal no mide temperatura",
      2800
    );
  }
}

/* =========================================================
   ESTADO DEL SEGUIMIENTO
========================================================= */

function actualizarEstadoTracking(ahora) {
  if (
    !camaraActiva ||
    ahora < mantenerEstadoHasta
  ) {
    return;
  }

  if (
    ahora -
      ultimaActualizacionEstado <
    350
  ) {
    return;
  }

  ultimaActualizacionEstado = ahora;

  if (!modelosDisponibles) {
    statusText.textContent =
      "⚠️ Cámara activa · seguimiento no disponible";

    return;
  }

  const manosActivas =
    manoTracks.filter(
      mano => mano.activa
    ).length;

  const cuerpoActivo = Boolean(
    cuerpoSuavizado &&
    ahora - ultimoCuerpoVisto <
      1200
  );

  const caraActiva = Boolean(
    caraSuavizada &&
    ahora - ultimaCaraVista <
      1200
  );

  statusText.textContent =
    `🟢 Manos: ${manosActivas} · ` +
    `Cara: ${caraActiva ? "sí" : "—"} · ` +
    `Cuerpo: ${cuerpoActivo ? "sí" : "—"}` +
    (
      calidadCamaraTexto
        ? ` · ${calidadCamaraTexto}`
        : ""
    );
}

/* =========================================================
   BUCLE PRINCIPAL
========================================================= */

function procesarVideo(ahora) {
  animacionId =
    requestAnimationFrame(
      procesarVideo
    );

  if (
    !camaraActiva ||
    video.readyState <
      HTMLMediaElement.HAVE_CURRENT_DATA
  ) {
    return;
  }

  if (
    ahora - ultimaRevisionCanvas >
    1000
  ) {
    ajustarCanvas();

    ultimaRevisionCanvas =
      ahora;
  }

  procesarSiguienteModelo(
    ahora
  );

  const delta =
    ultimoFrameRender
      ? limitar(
          ahora - ultimoFrameRender,
          8,
          50
        )
      : 16.67;

  ultimoFrameRender = ahora;

  actualizarSuavizadoVisual(
    delta
  );

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  dibujarCuerpo(
    cuerpoSuavizado
  );

  dibujarManos();

  dibujarCara(
    caraSuavizada
  );

  const cuadroVisual =
    obtenerPuntosCuadro(false);

  const cuadroValido =
    obtenerPuntosCuadro(true);

  dibujarCuadro(
    cuadroVisual,
    Boolean(cuadroValido)
  );

  actualizarCapturaAutomatica(
    cuadroValido
  );

  actualizarIndicadorGesto(
    cuadroValido
  );

  actualizarEstadoTracking(
    ahora
  );
}

/* =========================================================
   EVENTOS
========================================================= */

startButton.addEventListener(
  "click",
  () => {
    if (camaraActiva) {
      detenerCamara();
    } else {
      iniciarCamara();
    }
  }
);

switchButton.addEventListener(
  "click",
  async () => {
    if (
      !camaraActiva ||
      iniciandoCamara
    ) {
      return;
    }

    const modoAnterior =
      camaraFrontal;

    camaraFrontal =
      !camaraFrontal;

    actualizarEspejo();

    const inicioCorrecto =
      await iniciarCamara();

    if (!inicioCorrecto) {
      camaraFrontal =
        modoAnterior;

      actualizarEspejo();
    }
  }
);

fullscreenButton.addEventListener(
  "click",
  async () => {
    try {
      if (
        document.fullscreenElement
      ) {
        await document.exitFullscreen();
      } else if (
        container.requestFullscreen
      ) {
        await container.requestFullscreen();
      } else if (
        video.webkitEnterFullscreen
      ) {
        video.webkitEnterFullscreen();
      }
    } catch (error) {
      console.error(
        "No se pudo activar pantalla completa:",
        error
      );
    }
  }
);

filterSelect.addEventListener(
  "change",
  evento => {
    filtroActual =
      evento.target.value;

    aplicarFiltroSeleccionado();
  }
);

miniatura.addEventListener(
  "click",
  () => {
    if (ultimaUrlCaptura) {
      window.open(
        ultimaUrlCaptura,
        "_blank",
        "noopener"
      );
    }
  }
);

window.addEventListener(
  "resize",
  adaptarPlataforma
);

window.addEventListener(
  "orientationchange",
  () => {
    setTimeout(() => {
      adaptarPlataforma();
      ajustarCanvas();
    }, 300);
  }
);

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState ===
      "visible"
    ) {
      siguienteDeteccion =
        performance.now();
    }
  }
);

window.addEventListener(
  "beforeunload",
  () => {
    liberarStream();

    cancelAnimationFrame(
      animacionId
    );

    if (ultimaUrlCaptura) {
      URL.revokeObjectURL(
        ultimaUrlCaptura
      );
    }

    [
      pose,
      hands,
      faceMesh
    ].forEach(modelo => {
      try {
        modelo?.close?.();
      } catch (error) {
        console.debug(
          "No se pudo cerrar un modelo:",
          error
        );
      }
    });
  }
);

/* =========================================================
   INICIO
========================================================= */

adaptarPlataforma();
aplicarFiltroSeleccionado();
inicializarModelos();

animacionId =
  requestAnimationFrame(
    procesarVideo
  );