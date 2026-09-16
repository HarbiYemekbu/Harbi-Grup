const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

const UI_KEY = "harbi-resume";
const UI_SEARCH_FORMS = {
  flights: "#flightSearch",
  holiday: "#holidaySearch",
  cars: "#carSearch",
  homes: "#homeSearch",
  bikes: "#bikeSearch",
};

function resumeGet() {
  return store.get(UI_KEY, { view: "home", fields: {}, cam: {}, searches: {}, scroll: {}, nfcResult: "" });
}

function resumePatch(mutator) {
  const state = resumeGet();
  mutator(state);
  store.set(UI_KEY, state);
}

let resumeBusy = false;
let resumeFieldTimer = 0;
let resumeScrollTimer = 0;

function resumeActiveView() {
  return document.querySelector(".view.active")?.dataset.view || "home";
}

function resumeSaveFields() {
  if (resumeBusy) return;
  resumePatch((state) => {
    state.fields = {};
    $$("#views input, #views textarea, #views select").forEach((el) => {
      if (!el.id || el.type === "password" || el.type === "file") return;
      if (el.id === "posWithdrawTarget" || el.id === "posSettleIban" || el.id === "posGateApi" || el.id === "posGateSecret" || el.id === "posPayApiKey" || el.id === "posCardApiKey") return;
      state.fields[el.id] = el.type === "checkbox" ? el.checked : el.value;
    });
    if ($("#nfcResult")) state.nfcResult = $("#nfcResult").textContent || "";
  });
}

function resumeSaveView(name) {
  if (resumeBusy || !name) return;
  resumePatch((state) => {
    state.view = name;
  });
}

function resumeSaveScroll(name) {
  if (resumeBusy || !name) return;
  resumePatch((state) => {
    state.scroll = state.scroll || {};
    state.scroll[name] = window.scrollY || document.documentElement.scrollTop || 0;
  });
}

function resumeMarkSearch(name) {
  resumePatch((state) => {
    state.searches = state.searches || {};
    state.searches[name] = true;
  });
  resumeSaveFields();
}

function resumeRestoreFields() {
  const state = resumeGet();
  resumeBusy = true;
  Object.entries(state.fields || {}).forEach(([id, value]) => {
    if (id === "posWithdrawTarget" || id === "posSettleIban" || id === "posGateApi" || id === "posGateSecret" || id === "posPayApiKey" || id === "posCardApiKey") return;
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = Boolean(value);
    else el.value = value ?? "";
  });
  if (state.nfcResult && $("#nfcResult")) $("#nfcResult").textContent = state.nfcResult;
  if ($("#posWithdrawTarget")) $("#posWithdrawTarget").value = POS_SETTLE.ibanMasked;
  if ($("#posSettleIban")) $("#posSettleIban").value = POS_SETTLE.ibanMasked;
  resumeBusy = false;
}

function resumeRestoreSearches() {
  const state = resumeGet();
  Object.entries(UI_SEARCH_FORMS).forEach(([name, sel]) => {
    if (state.searches?.[name]) $(sel)?.requestSubmit();
  });
}

function resumeRestoreScroll(name) {
  const y = resumeGet().scroll?.[name] || 0;
  requestAnimationFrame(() => window.scrollTo(0, y));
}

const db = {
  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("harbi-grup", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("photos", { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async all() {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction("photos", "readonly").objectStore("photos").getAll();
      tx.onsuccess = () => resolve(tx.result.sort((a, b) => b.id - a.id));
      tx.onerror = () => reject(tx.error);
    });
  },
  async put(photo) {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction("photos", "readwrite").objectStore("photos").put(photo);
      tx.onsuccess = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

const views = $$(".view");
const tabs = $$(".tab");

views.forEach((view) => {
  if (view.dataset.view === "home" || view.dataset.view === "camera") return;
  const btn = document.createElement("button");
  btn.className = "secondary home-back";
  btn.type = "button";
  btn.dataset.go = "home";
  btn.textContent = "Ana Sayfaya Dön";
  view.prepend(btn);
});

function showView(name) {
  const prev = resumeActiveView();
  if (prev && prev !== name) resumeSaveScroll(prev);
  views.forEach((view) => {
    const on = view.dataset.view === name;
    view.classList.toggle("active", on);
    view.toggleAttribute("hidden", !on);
  });
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.go === name));
  document.body.classList.toggle("camera-open", name === "camera");
  if (name !== "camera") stopCamera();
  else startCamera();
  if (name === "women") renderGk();
  if (name === "pos") renderPos();
  resumeSaveView(name);
  resumeRestoreScroll(name);
}

$$("[data-go]").forEach((el) => {
  el.addEventListener("click", () => showView(el.dataset.go));
});

const isIOS =
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroid = /android/i.test(navigator.userAgent);
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

document.documentElement.classList.add(isIOS ? "is-ios" : isAndroid ? "is-android" : "is-desktop");

let deferredPrompt = null;
const installBtn = $("#installBtn");
const installHint = $("#installHint");
const modal = $("#installModal");
const modalText = $("#modalInstallText");
const confirmInstall = $("#confirmInstall");

if (isStandalone) {
  installBtn.hidden = true;
  $("#installCard").hidden = true;
} else if (isIOS) {
  installHint.textContent = "iPhone’da Safari ile açın, sonra Paylaş > Ana Ekrana Ekle.";
} else if (isAndroid) {
  installHint.textContent = "Android’de Chrome ile açın, sonra menüden uygulamayı yükleyin.";
} else {
  installHint.textContent =
    "Aynı Wi‑Fi’deki iPhone (Safari) veya Android (Chrome) ile bu adresi açın.";
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installBtn.hidden = false;
});

function openInstall() {
  modal.hidden = false;
  if (isIOS) {
    modalText.textContent = "iPhone: Safari > Paylaş > Ana Ekrana Ekle.";
    confirmInstall.hidden = true;
  } else if (deferredPrompt) {
    modalText.textContent = "Android: yükleme penceresini onaylayın.";
    confirmInstall.hidden = false;
  } else {
    modalText.textContent =
      "Android Chrome: ⋮ menü > Uygulamayı yükle / Ana ekrana ekle. iPhone: Safari > Paylaş > Ana Ekrana Ekle.";
    confirmInstall.hidden = true;
  }
}

installBtn.addEventListener("click", openInstall);
$("#closeInstall").addEventListener("click", () => {
  modal.hidden = true;
});

confirmInstall.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  modal.hidden = true;
});

let stream = null;
let facingMode = "environment";
let zoomLevel = 0.5;
let nativeZoomMax = 1;
let torchOn = false;
let flashMode = "auto";
let captureMp = 88;
let camMode = "photo";
function resumeSaveCam() {
  resumePatch((state) => {
    state.cam = { mode: camMode, facing: facingMode, zoom: zoomLevel, flash: flashMode };
  });
}
function resumeRestoreCam() {
  const cam = resumeGet().cam || {};
  if (cam.mode) camMode = cam.mode;
  if (cam.facing) facingMode = cam.facing;
  if (Number.isFinite(Number(cam.zoom))) zoomLevel = Number(cam.zoom);
  if (cam.flash) flashMode = cam.flash;
  $("#switchCamera")?.classList.toggle("front", facingMode === "user");
  cameraFrame?.classList.toggle("front-cam", facingMode === "user");
}
let recorder = null;
let recording = false;
let recChunks = [];
let recRaf = 0;
let recCanvas = null;
function needsAudio() {
  return camMode === "video" || camMode === "cinema";
}
const video = $("#cameraVideo");
const canvas = $("#cameraCanvas");
const cameraStatus = $("#cameraStatus");
const zoomRange = $("#zoomRange");
const focusBox = $("#focusBox");

const FOCAL = [
  [0.5, 13, "ƒ/2.2", "Ultra Wide"],
  [1, 24, "ƒ/1.78", "Fusion Ana"],
  [1.2, 28, "ƒ/1.78", "Fusion Ana"],
  [1.5, 35, "ƒ/1.78", "Fusion Ana"],
  [2, 48, "ƒ/1.78", "2× Tele"],
  [4, 100, "ƒ/2.8", "Fusion Tele"],
  [8, 200, "ƒ/2.8", "8× Tele"],
];

function lensInfo(zoom) {
  let best = FOCAL[0];
  for (const row of FOCAL) {
    if (Math.abs(row[0] - zoom) < Math.abs(best[0] - zoom)) best = row;
  }
  if (zoom > 8) {
    return { zoom, mm: Math.round(24 * zoom), aperture: "ƒ/2.8", name: "Dijital Tele" };
  }
  return { zoom: best[0], mm: Math.round(best[1] * (zoom / best[0])), aperture: best[2], name: best[3] };
}

function styleFilter() {
  const hdr = `contrast(1.12) saturate(1.08) brightness(${isoBrightness()})`;
  const fusion = "url(#deepFusion)";
  const base = `${fusion} ${hdr}`;
  if (camMode === "night") {
    return `${base} brightness(${(isoBrightness() * 1.12).toFixed(3)}) contrast(1.08) saturate(0.92)`;
  }
  return base;
}

function iphoneAudioConstraints() {
  return {
    echoCancellation: { ideal: true },
    noiseSuppression: { ideal: true },
    autoGainControl: { ideal: true },
    sampleRate: { ideal: 48000 },
    channelCount: { ideal: 2 },
    sampleSize: { ideal: 16 },
  };
}

async function applyIphoneAudio(media) {
  const tracks = media?.getAudioTracks?.() || [];
  for (const track of tracks) {
    await track
      .applyConstraints({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 2,
      })
      .catch(() => {});
  }
}

async function ensureIphoneAudio() {
  if (!stream) await startCamera({ preserve: true });
  if (!stream) return;
  const live = stream.getAudioTracks().some((track) => track.readyState === "live");
  if (!live) {
    try {
      const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: iphoneAudioConstraints() });
      audioOnly.getAudioTracks().forEach((track) => stream.addTrack(track));
    } catch {
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioOnly.getAudioTracks().forEach((track) => stream.addTrack(track));
      } catch {
        /* mikrofon yok */
      }
    }
  }
  await applyIphoneAudio(stream);
}

function videoTrack() {
  return stream?.getVideoTracks()[0] || null;
}

function maxZoom() {
  if (camMode === "photo" || camMode === "video" || camMode === "cinema") return 10;
  return facingMode === "environment" ? 100 : 15;
}

function minZoom() {
  return facingMode === "environment" ? 0.5 : 1;
}

function sensorCrop() {
  return Math.max(1, zoomLevel / minZoom());
}

function formatZoom(z) {
  const n = Number(z);
  return `${String(n.toFixed(n % 1 ? 1 : 0)).replace(".", ",")}×`;
}

let isoLevel = 405;
const ISO_MIN = 50;
const ISO_MAX = 3200;

function isoT() {
  return Math.log(isoLevel / ISO_MIN) / Math.log(ISO_MAX / ISO_MIN);
}

function isoBrightness() {
  return 0.62 + isoT() * 0.9;
}

function previewFlipX() {
  return facingMode === "user" ? 1 : -1;
}

function applyPreviewZoom() {
  const z = sensorCrop();
  if (facingMode === "user") {
    video.style.transform = `scale(${z}) matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0.0036, 0,0,0,1)`;
  } else {
    video.style.transform = `scale(${previewFlipX() * z}, ${z})`;
  }
  video.style.filter = `brightness(${isoBrightness()})`;
}

function drawCameraVideo(ctx, sx, sy, sw, sh, dw, dh) {
  ctx.save();
  if (previewFlipX() < 0) {
    ctx.translate(dw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
  ctx.restore();
}

function renderIso() {
  const t = isoT();
  const pct = `${(t * 100).toFixed(1)}%`;
  $("#isoFill").style.height = pct;
  $("#isoThumb").style.bottom = pct;
  $("#isoValue").textContent = `ISO ${isoLevel}`;
}

async function applyIso() {
  renderIso();
  applyPreviewZoom();
  const track = videoTrack();
  const caps = track?.getCapabilities?.() || {};
  const advanced = {};
  if (caps.iso) {
    advanced.iso = Math.min(caps.iso.max || ISO_MAX, Math.max(caps.iso.min || ISO_MIN, isoLevel));
  }
  if (caps.exposureCompensation) {
    const ev = (isoT() - 0.5) * 4;
    advanced.exposureCompensation = Math.min(
      caps.exposureCompensation.max || 2,
      Math.max(caps.exposureCompensation.min || -2, ev)
    );
  }
  if (Object.keys(advanced).length) {
    await track.applyConstraints({ advanced: [advanced] }).catch(() => {});
  }
}

function isoFromPointer(clientY) {
  const track = $("#isoTrack").getBoundingClientRect();
  const t = Math.min(1, Math.max(0, (track.bottom - clientY) / track.height));
  isoLevel = Math.round(ISO_MIN * Math.pow(ISO_MAX / ISO_MIN, t));
  applyIso();
}

async function applyNativeZoom() {
  const track = videoTrack();
  if (!track) return;
  const caps = track.getCapabilities?.() || {};
  if (!caps.zoom) return;
  nativeZoomMax = caps.zoom.max || 1;
  const native = Math.min(Math.max(caps.zoom.min || 1, zoomLevel), nativeZoomMax);
  try {
    await track.applyConstraints({ advanced: [{ zoom: native }] });
  } catch {
    /* dijital */
  }
}

async function setZoom(value) {
  const n = Number(value);
  zoomLevel = Math.min(maxZoom(), Math.max(minZoom(), Number.isFinite(n) ? n : minZoom()));
  zoomRange.min = String(minZoom());
  zoomRange.max = String(maxZoom());
  zoomRange.value = String(zoomLevel);
  await applyNativeZoom();
  applyPreviewZoom();
  resumeSaveCam();
}

let camStartSeq = 0;

async function startCamera({ preserve = false } = {}) {
  const seq = ++camStartSeq;
  const keepZoom = zoomLevel;
  const keepIso = isoLevel;
  stopCamera();
  syncCaptureMp();
  if (!preserve) cameraStatus.textContent = "İzin bekleniyor...";
  nativeZoomMax = 1;
  try {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: needsAudio() ? iphoneAudioConstraints() : false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 3840 },
          height: { ideal: 2880 },
        },
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: needsAudio(),
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 3840 },
            height: { ideal: 2880 },
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: needsAudio(),
          video: { facingMode: { ideal: facingMode } },
        });
      }
    }
    if (seq !== camStartSeq) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
      return;
    }
    const track = videoTrack();
    const caps = track?.getCapabilities?.() || {};
    nativeZoomMax = caps.zoom?.max || 1;
    await track
      ?.applyConstraints({
        width: { ideal: Math.min(8064, caps.width?.max || 3840) },
        height: { ideal: Math.min(6048, caps.height?.max || 2880) },
      })
      .catch(() => {});
    if (needsAudio()) await applyIphoneAudio(stream);
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.muted = true;
    video.srcObject = stream;
    await video.play().catch(() => {});
    if (seq !== camStartSeq) return;
    if (preserve) {
      zoomLevel = keepZoom;
      isoLevel = keepIso;
    } else {
      zoomLevel = minZoom();
      isoLevel = 405;
    }
    await setZoom(zoomLevel);
    await applyIso();
    if (!needsAudio()) cameraStatus.textContent = "";
  } catch {
    if (seq === camStartSeq) {
      cameraStatus.textContent = "Kamera izni gerekli. Telefonda Safari/Chrome ile açın.";
    }
  }
}

function stopRecLoop() {
  if (recRaf) cancelAnimationFrame(recRaf);
  recRaf = 0;
}

function recFrameSize() {
  const vw = video.videoWidth || 1920;
  const vh = video.videoHeight || 1080;
  const scale = Math.min(1, 1920 / vw);
  return { w: Math.max(2, Math.round(vw * scale)), h: Math.max(2, Math.round(vh * scale)) };
}

function drawRecFrame() {
  if (!recording || !recCanvas) return;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw && vh) {
    const crop = cropSource(vw, vh);
    const ctx = recCanvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.filter = video.style.filter || "none";
    drawCameraVideo(ctx, crop.sx, crop.sy, crop.sw, crop.sh, recCanvas.width, recCanvas.height);
  }
  recRaf = requestAnimationFrame(drawRecFrame);
}

function stopCamera() {
  stopRecLoop();
  if (recorder && recording) {
    try {
      recorder.stop();
    } catch {
      /* */
    }
  }
  recording = false;
  $("#capturePhoto")?.classList.remove("recording");
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  video.style.transform = "none";
  torchOn = false;
  renderFlash();
}

function cropSource(vw, vh) {
  const factor = sensorCrop();
  const ratio = 16 / 9;
  let rw = vw / factor;
  let rh = vh / factor;
  if (rw / rh > ratio) rw = rh * ratio;
  else rh = rw / ratio;
  return { sx: (vw - rw) / 2, sy: (vh - rh) / 2, sw: rw, sh: rh };
}

function syncCaptureMp() {
  captureMp = facingMode === "environment" ? 88 : 68;
}

function outputSize() {
  const maxPixels = 16777216;
  const table = captureMp === 88 ? [12508, 7036] : [10991, 6185];
  let w = table[0];
  let h = table[1];
  if (w * h > maxPixels) {
    const s = Math.sqrt(maxPixels / (w * h));
    w = Math.floor(w * s);
    h = Math.floor(h * s);
  }
  return { w, h };
}

$("#switchCamera").addEventListener("click", (event) => {
  event.stopPropagation();
  facingMode = facingMode === "environment" ? "user" : "environment";
  $("#switchCamera").classList.toggle("front", facingMode === "user");
  cameraFrame.classList.toggle("front-cam", facingMode === "user");
  syncCaptureMp();
  resumeSaveCam();
  startCamera();
});
zoomRange.addEventListener("input", () => setZoom(zoomRange.value));
$("#modeRow").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-mode]");
  if (!btn) return;
  setCamMode(btn.dataset.mode);
});

let ignoreModeScroll = false;
let ignoreModeScrollTimer = 0;

function centerModeBtn(mode) {
  const row = $("#modeRow");
  const btn = row?.querySelector(`[data-mode="${mode}"]`);
  if (!row || !btn) return;
  const left = btn.offsetLeft + btn.offsetWidth / 2 - row.clientWidth / 2;
  row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
}

function stopActiveRecording() {
  stopRecLoop();
  if (recorder && recording) {
    try {
      recorder.stop();
    } catch {
      /* */
    }
  }
  recording = false;
  $("#capturePhoto")?.classList.remove("recording");
}

async function syncModeStream() {
  if (!stream) {
    await startCamera({ preserve: true });
    return true;
  }
  if (needsAudio() && !stream.getAudioTracks().length) {
    await startCamera({ preserve: true });
    return true;
  }
  if (!needsAudio()) {
    stream.getAudioTracks().forEach((track) => {
      track.stop();
      stream.removeTrack(track);
    });
  }
  return false;
}

async function setCamMode(mode, fromScroll = false) {
  if (!fromScroll) {
    ignoreModeScroll = true;
    clearTimeout(ignoreModeScrollTimer);
    ignoreModeScrollTimer = setTimeout(() => {
      ignoreModeScroll = false;
    }, 500);
  }
  if (mode !== camMode && recording) stopActiveRecording();
  camMode = mode;
  resumeSaveCam();
  $$("#modeRow [data-mode]").forEach((el) => {
    el.classList.toggle("active", el.dataset.mode === mode);
  });
  if (!fromScroll) centerModeBtn(mode);
  cameraFrame.classList.toggle("portrait-mode", mode === "portrait" || mode === "cinema");
  $("#cinemaMask").hidden = mode !== "cinema";
  const rec = needsAudio();
  $("#capturePhoto").classList.toggle("video-shutter", rec);
  $("#capturePhoto").classList.toggle("recording", rec && recording);
  $("#capturePhoto").setAttribute("aria-label", rec ? "Video kaydı" : "Fotoğraf çek");
  cameraStatus.textContent = rec
    ? mode === "cinema"
      ? "Sinema Modu · 24 fps · iPhone ses"
      : "Video · kayıt için tuşa bas"
    : "";
  if (mode === "cinema") {
    if (!stream || !stream.getAudioTracks().length) await startCamera({ preserve: true });
    else await applyIphoneAudio(stream);
  } else {
    const restarted = await syncModeStream();
    if (!restarted) await setZoom(zoomLevel);
  }
}

$("#modeRow").addEventListener("scrollend", () => {
  if (ignoreModeScroll) return;
  const row = $("#modeRow");
  const mid = row.scrollLeft + row.clientWidth / 2;
  let best = null;
  let dist = Infinity;
  $$("#modeRow [data-mode]").forEach((btn) => {
    const center = btn.offsetLeft + btn.offsetWidth / 2;
    const d = Math.abs(center - mid);
    if (d < dist) {
      dist = d;
      best = btn;
    }
  });
  if (best && best.dataset.mode !== camMode) setCamMode(best.dataset.mode, true);
});


function renderFlash() {
  const icon = $("#flashIcon");
  icon.className = "flash-icon " + (flashMode === "auto" ? "flash-auto" : flashMode === "on" ? "flash-on" : "flash-off");
  icon.textContent = flashMode === "auto" ? "A" : "⚡";
  $("#flashBtn").classList.toggle("on", flashMode === "on");
  $$("#flashMenu [data-flash]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.flash === flashMode);
  });
}

async function setTorch(on) {
  const track = videoTrack();
  const caps = track?.getCapabilities?.() || {};
  if (!caps.torch) return false;
  torchOn = on;
  await track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {});
  return true;
}

function sceneIsDark() {
  const probe = document.createElement("canvas");
  probe.width = 32;
  probe.height = 18;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, 32, 18);
  const data = ctx.getImageData(0, 0, 32, 18).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
  return sum / (data.length / 4) < 58;
}

async function prepareFlash() {
  if (flashMode === "off") {
    await setTorch(false);
    return;
  }
  if (flashMode === "on") {
    await setTorch(true);
    return;
  }
  await setTorch(sceneIsDark());
}

$("#flashBtn").addEventListener("click", (event) => {
  event.stopPropagation();
  const menu = $("#flashMenu");
  menu.hidden = !menu.hidden;
});

$("#closeCamera").addEventListener("click", (event) => {
  event.stopPropagation();
  showView("home");
});

$("#flashMenu").addEventListener("click", async (event) => {
  event.stopPropagation();
  const btn = event.target.closest("[data-flash]");
  if (!btn) return;
  flashMode = btn.dataset.flash;
  $("#flashMenu").hidden = true;
  renderFlash();
  resumeSaveCam();
  if (flashMode === "on") await setTorch(true);
  else await setTorch(false);
});


$("#styleBtn").addEventListener("click", () => {
  const grid = $("#camGrid");
  grid.hidden = !grid.hidden;
  $("#styleBtn").classList.toggle("on", !grid.hidden);
});

const cameraFrame = $("#cameraFrame");
const isoRail = $("#isoRail");
let pinch0 = 0;
let isoDragging = false;

function onIsoPointer(event) {
  const point = event.touches ? event.touches[0] : event;
  isoFromPointer(point.clientY);
}

isoRail.addEventListener("pointerdown", (event) => {
  event.stopPropagation();
  isoDragging = true;
  isoRail.setPointerCapture(event.pointerId);
  onIsoPointer(event);
});
isoRail.addEventListener("pointermove", (event) => {
  if (!isoDragging) return;
  event.stopPropagation();
  onIsoPointer(event);
});
isoRail.addEventListener("pointerup", (event) => {
  isoDragging = false;
  event.stopPropagation();
});
isoRail.addEventListener("click", (event) => event.stopPropagation());
$("#camTop")?.addEventListener("click", (event) => event.stopPropagation());
$("#zoomBar")?.addEventListener("click", (event) => event.stopPropagation());
$("#zoomBar")?.addEventListener("pointerdown", (event) => event.stopPropagation());
$("#capturePhoto")?.addEventListener("click", (event) => event.stopPropagation());
$("#camOverlayBottom")?.addEventListener("click", (event) => event.stopPropagation());

cameraFrame.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches.length === 2) {
      const [a, b] = event.touches;
      pinch0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }
  },
  { passive: true }
);
cameraFrame.addEventListener(
  "touchmove",
  (event) => {
    if (event.touches.length !== 2 || !pinch0) return;
    const [a, b] = event.touches;
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    setZoom(zoomLevel * (dist / pinch0));
    pinch0 = dist;
  },
  { passive: true }
);
cameraFrame.addEventListener("click", (event) => {
  const rect = cameraFrame.getBoundingClientRect();
  focusBox.hidden = false;
  focusBox.style.left = `${event.clientX - rect.left - 36}px`;
  focusBox.style.top = `${event.clientY - rect.top - 36}px`;
  clearTimeout(focusBox._t);
  focusBox._t = setTimeout(() => {
    focusBox.hidden = true;
  }, 900);
});

function mediaFileName(ext) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `IMG_Harbi_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
}

function photoFileName() {
  return mediaFileName("jpg");
}

function videoFileName(mime) {
  const type = String(mime || "");
  if (/mp4/i.test(type)) return mediaFileName("mp4");
  if (/quicktime|mov/i.test(type)) return mediaFileName("mov");
  if (/webm/i.test(type)) return mediaFileName("webm");
  return mediaFileName("mp4");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function blobFromCanvas() {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
  if (blob) return blob;
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  const res = await fetch(dataUrl);
  return res.blob();
}

async function dataUrlFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function savePhotoToPhoneGallery(blob) {
  downloadBlob(blob, photoFileName());
}

function saveVideoToPhoneGallery(blob) {
  downloadBlob(blob, videoFileName(blob.type));
}

$("#capturePhoto").addEventListener("click", async () => {
  if (!stream) {
    await startCamera();
    if (!stream) return;
  }
  if (needsAudio()) {
    await toggleRecord();
    return;
  }
  await prepareFlash();
  const vw = video.videoWidth || 1920;
  const vh = video.videoHeight || 1440;
  const crop = cropSource(vw, vh);
  const { w: outW, h: outH } = outputSize();
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (camMode === "portrait" || camMode === "cinema") {
    ctx.filter = "blur(18px) saturate(1.05)";
    drawCameraVideo(ctx, crop.sx, crop.sy, crop.sw, crop.sh, outW, outH);
    ctx.filter = styleFilter();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(outW / 2, outH / 2.1, outW * 0.28, outH * 0.38, 0, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    drawCameraVideo(ctx, crop.sx, crop.sy, crop.sw, crop.sh, outW, outH);
    ctx.restore();
  } else {
    ctx.filter = styleFilter();
    drawCameraVideo(ctx, crop.sx, crop.sy, crop.sw, crop.sh, outW, outH);
  }
  ctx.filter = "none";
  const info = lensInfo(zoomLevel);
  cameraStatus.textContent = `${outW}×${outH} · ${captureMp}MP · ${info.name} ${info.mm}mm`;
  try {
    const blob = await blobFromCanvas();
    const dataUrl = await dataUrlFromBlob(blob);
    await db.put({
      id: Date.now(),
      dataUrl,
      w: outW,
      h: outH,
      zoom: zoomLevel,
      mm: info.mm,
    });
    await savePhotoToPhoneGallery(blob);
  } catch {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    await db.put({
      id: Date.now(),
      dataUrl,
      w: outW,
      h: outH,
      zoom: zoomLevel,
      mm: info.mm,
    });
  }
  renderGallery();
  if (flashMode !== "on") await setTorch(false);
});

async function toggleRecord() {
  if (recording && recorder) {
    recorder.stop();
    return;
  }
  if (camMode === "cinema" || camMode === "video") await ensureIphoneAudio();
  const types = [
    "video/mp4;codecs=avc1.640028,mp4a.40.2",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=opus",
    "video/webm",
  ];
  const mime = types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  recChunks = [];
  recCanvas = recCanvas || document.createElement("canvas");
  const size = recFrameSize();
  recCanvas.width = size.w;
  recCanvas.height = size.h;
  const fps = camMode === "cinema" ? 24 : 30;
  const recStream = recCanvas.captureStream(fps);
  stream?.getAudioTracks().forEach((track) => {
    const audio = camMode === "cinema" ? track : track.clone ? track.clone() : track;
    if (!recStream.getAudioTracks().some((existing) => existing.id === audio.id)) {
      recStream.addTrack(audio);
    }
  });
  const recOpts = mime
    ? { mimeType: mime, videoBitsPerSecond: 16_000_000, audioBitsPerSecond: 256_000 }
    : { videoBitsPerSecond: 16_000_000, audioBitsPerSecond: 256_000 };
  try {
    recorder = new MediaRecorder(recStream, recOpts);
  } catch {
    try {
      recorder = mime ? new MediaRecorder(recStream, { mimeType: mime }) : new MediaRecorder(recStream);
    } catch {
      cameraStatus.textContent = "Bu tarayıcı video kaydını desteklemiyor.";
      return;
    }
  }
  recorder.ondataavailable = (event) => {
    if (event.data.size) recChunks.push(event.data);
  };
  recorder.onstop = async () => {
    stopRecLoop();
    recording = false;
    $("#capturePhoto").classList.remove("recording");
    const blob = new Blob(recChunks, { type: recorder.mimeType || "video/mp4" });
    saveVideoToPhoneGallery(blob);
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    await db.put({
      id: Date.now(),
      dataUrl,
      type: "video",
      mode: camMode,
      zoom: zoomLevel,
    });
    cameraStatus.textContent = camMode === "cinema" ? "Sinema klibi galeriye kaydedildi" : "Video galeriye kaydedildi";
    renderGallery();
  };
  recording = true;
  drawRecFrame();
  recorder.start(100);
  $("#capturePhoto").classList.add("recording");
  cameraStatus.textContent = "Kayıt... durdurmak için tuşa bas";
}

async function renderGallery() {
  const photos = await db.all();
  $("#photoGallery").innerHTML = photos
    .map((photo) =>
      photo.type === "video"
        ? `<video src="${photo.dataUrl}" controls playsinline></video>`
        : `<img src="${photo.dataUrl}" alt="Çekim ${new Date(photo.id).toLocaleString("tr-TR")}" />`
    )
    .join("") || "<p class='hint'>Henüz fotoğraf yok.</p>";
}

const noteForm = $("#noteForm");
function renderNotes() {
  const q = $("#noteSearch").value.trim().toLowerCase();
  const notes = store.get("notes", []).filter(
    (note) =>
      !q || note.title.toLowerCase().includes(q) || note.body.toLowerCase().includes(q)
  );
  $("#noteList").innerHTML = notes
    .map(
      (note) => `
      <article class="note">
        <header>
          <strong>${escapeHtml(note.title)}</strong>
          <button class="linkish" data-del="${note.id}" type="button">Sil</button>
        </header>
        <time>${new Date(note.id).toLocaleString("tr-TR")}</time>
        <p>${escapeHtml(note.body)}</p>
      </article>`
    )
    .join("") || "<p class='hint'>Not yok.</p>";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

const HYGIENE_KEY = "hygiene-products";

function hygieneProducts() {
  return store.get(HYGIENE_KEY, []);
}

function parseMoney(value) {
  const n = Number(String(value ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function byPrice(dir, getter) {
  const mul = dir === "desc" ? -1 : 1;
  return (a, b) => (getter(a) - getter(b)) * mul;
}

function renderHygiene() {
  let items = hygieneProducts();
  const list = $("#hygieneList");
  if (!items.length) {
    list.innerHTML = `<p class="hygiene-empty">Henüz ürün yok. Yeni ürün ile boş fiyatlı kart ekleyin.</p>`;
    return;
  }
  const dir = $("#hygieneSort")?.value || "asc";
  items = [...items].sort(byPrice(dir, (item) => parseMoney(item.price)));
  list.innerHTML = items
    .map(
      (item) => `
      <article class="product-card" data-id="${item.id}">
        <input class="product-name" placeholder="Ürün adı" maxlength="80" value="${escapeHtml(item.name)}" />
        <div class="product-card-row">
          <label class="product-price">
            <span>₺</span>
            <input class="product-price-input" inputmode="decimal" placeholder="Fiyat" value="${escapeHtml(item.price)}" />
          </label>
          <button class="linkish" type="button" data-hygiene-del="${item.id}">Sil</button>
        </div>
      </article>`
    )
    .join("");
}

$("#hygieneAdd").addEventListener("click", () => {
  const items = hygieneProducts();
  items.unshift({ id: Date.now(), name: "", price: "" });
  store.set(HYGIENE_KEY, items);
  renderHygiene();
  $("#hygieneList .product-name")?.focus();
});

$("#hygieneSort")?.addEventListener("change", renderHygiene);

$("#hygieneList").addEventListener("input", (event) => {
  const card = event.target.closest(".product-card");
  if (!card) return;
  const items = hygieneProducts();
  const item = items.find((row) => String(row.id) === card.dataset.id);
  if (!item) return;
  if (event.target.classList.contains("product-name")) item.name = event.target.value;
  if (event.target.classList.contains("product-price-input")) item.price = event.target.value;
  store.set(HYGIENE_KEY, items);
});

$("#hygieneList").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-hygiene-del]");
  if (!btn) return;
  store.set(
    HYGIENE_KEY,
    hygieneProducts().filter((item) => String(item.id) !== btn.dataset.hygieneDel)
  );
  renderHygiene();
});


noteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const notes = store.get("notes", []);
  notes.unshift({
    id: Date.now(),
    title: $("#noteTitle").value.trim(),
    body: $("#noteBody").value.trim(),
  });
  store.set("notes", notes);
  noteForm.reset();
  renderNotes();
});

$("#noteList").addEventListener("click", (event) => {
  const id = event.target.dataset.del;
  if (!id) return;
  store.set(
    "notes",
    store.get("notes", []).filter((note) => String(note.id) !== id)
  );
  renderNotes();
});

$("#noteSearch").addEventListener("input", renderNotes);

const nfcHint = $("#nfcHint");
const nfcResult = $("#nfcResult");

function nfcSupported() {
  return "NDEFReader" in window;
}

let nfcAudioCtx = null;

function nfcAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!nfcAudioCtx || nfcAudioCtx.state === "closed") nfcAudioCtx = new Ctx();
  return nfcAudioCtx;
}

function speakTr(text) {
  return speakVoice(text, { rate: 0.95, pitch: 1 });
}

function speakNiceTr(text) {
  return speakVoice(text, { rate: 0.9, pitch: 1.06, nice: true });
}

function pickTrVoice(nice) {
  const voices = "speechSynthesis" in window ? speechSynthesis.getVoices() : [];
  if (!voices.length) return null;
  const score = (voice) => {
    const n = `${voice.name} ${voice.lang}`.toLowerCase();
    let s = 0;
    if (/^tr(-|_|$)/i.test(voice.lang)) s += 12;
    if (/turkish|türk/.test(n)) s += 8;
    if (nice && /neural|natural|premium|enhanced|online|google|microsoft|siri/.test(n)) s += 10;
    if (nice && /female|kadın|woman|yelda|emel|filiz|zehra|selin|yade/.test(n)) s += 7;
    if (nice && /male|erkek|man/.test(n)) s += 2;
    return s;
  };
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}

function speakVoice(text, opts) {
  return new Promise((resolve) => {
    const spoken = String(text || "").trim();
    if (!spoken || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    const utter = new SpeechSynthesisUtterance(spoken);
    utter.lang = "tr-TR";
    utter.rate = opts?.rate ?? 0.95;
    utter.pitch = opts?.pitch ?? 1;
    utter.volume = 1;
    const voice = pickTrVoice(Boolean(opts?.nice));
    if (voice) utter.voice = voice;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  });
}

function playTlink() {
  return new Promise((resolve) => {
    const ctx = nfcAudio();
    if (!ctx) {
      resolve();
      return;
    }
    const play = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(2093, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1568, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.34);
      setTimeout(resolve, 360);
    };
    if (ctx.state === "suspended") ctx.resume().then(play).catch(play);
    else play();
  });
}

async function nfcContactSound() {
  await speakTr("NFC çalışıyor");
  await playTlink();
  await speakTr("NFC'niz başarılı");
}

if ("speechSynthesis" in window) {
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener?.("voiceschanged", () => speechSynthesis.getVoices());
}

if (!nfcSupported()) {
  nfcHint.textContent =
    "Bu tarayıcı Web NFC desteklemiyor. Android’de Chrome ile HTTPS üzerinden açın.";
}

function twoPartName(name) {
  const parts = String(name || "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1]}`;
  return parts[0] || "";
}

function nfcPersonName(raw) {
  const text = String(raw || "")
    .replace(/^(text|url|absolute-url):\s*/gim, "")
    .trim();
  if (!text) return "";
  try {
    const json = JSON.parse(text);
    const ad = String(json.ad || json.isim || json.firstName || "").trim();
    const soy = String(json.soyad || json.soyisim || json.lastName || json.surname || "").trim();
    if (ad && soy) return `${ad} ${soy}`;
    if (json.name) return twoPartName(json.name);
  } catch {
    /* düz metin */
  }
  const fn = text.match(/FN[;:][^\n]+/i);
  if (fn) {
    const named = fn[0].replace(/^FN[;:][^:]*:?/i, "").trim();
    if (named) return twoPartName(named);
  }
  try {
    const url = new URL(text);
    const ad = url.searchParams.get("ad") || url.searchParams.get("isim") || url.searchParams.get("name") || "";
    const soy = url.searchParams.get("soyad") || url.searchParams.get("soyisim") || "";
    if (ad && soy) return `${ad} ${soy}`.trim();
    if (ad) return twoPartName(ad);
  } catch {
    /* url değil */
  }
  const line = text.split(/[\n|;]/)[0];
  return twoPartName(line);
}

let nfcNameTimer = 0;

function showNfcPersonName(raw) {
  const name = nfcPersonName(raw);
  const overlay = $("#nfcIdentity");
  const label = $("#nfcIdentityName");
  if (!overlay || !label || !name) return false;
  label.textContent = name;
  overlay.hidden = false;
  clearTimeout(nfcNameTimer);
  nfcNameTimer = setTimeout(() => {
    overlay.hidden = true;
    label.textContent = "";
  }, 5000);
  return true;
}

function saveNfc(entry) {
  const history = store.get("nfc", []);
  history.unshift({ id: Date.now(), ...entry });
  store.set("nfc", history.slice(0, 40));
  renderNfc();
  resumeSaveFields();
}

function renderNfc() {
  const history = store.get("nfc", []);
  $("#nfcHistory").innerHTML = history
    .map(
      (item) =>
        `<article class="note"><strong>${escapeHtml(item.type)}</strong><time> ${new Date(
          item.id
        ).toLocaleString("tr-TR")}</time><p>${escapeHtml(item.detail)}</p></article>`
    )
    .join("") || "<p class='hint'>Kayıt yok.</p>";
}

$("#nfcScan").addEventListener("click", async () => {
  nfcAudio()?.resume?.();
  if (!nfcSupported()) {
    const sim = "Ali Yılmaz";
    nfcResult.textContent = "";
    showNfcPersonName(sim);
    await nfcContactSound();
    saveNfc({ type: "Okuma (simülasyon)", detail: sim });
    return;
  }
  try {
    const reader = new NDEFReader();
    nfcResult.textContent = "Etiketi telefona yaklaştırın...";
    await reader.scan();
    reader.onreading = (event) => {
      const records = [...event.message.records].map((record) => {
        const decoder = new TextDecoder(record.encoding || "utf-8");
        try {
          return decoder.decode(record.data);
        } catch {
          return record.recordType;
        }
      });
      const detail = records.join("\n") || "Boş etiket";
      nfcResult.textContent = "";
      if (!showNfcPersonName(detail)) nfcResult.textContent = "İsim bulunamadı";
      saveNfc({ type: "Okuma", detail });
      nfcContactSound();
    };
  } catch (error) {
    nfcResult.textContent = "NFC okunamadı: " + error.message;
  }
});

const PBX_ORGS = "pbx-orgs";
const PBX_SESSION = "pbx-session";
const PBX_REMEMBER = "pbx-remember";
const PBX_MAX_ORGS = 100;
const PBX_INBOUND = "";
const PBX_RETIRED_LINES = ["05448583595", "05448583695"];
const PBX_GREET_DEFAULT =
  "Harbi Grup’a hoş geldiniz. Restoran destek, müşteri destek veya kurye destek için dahili numarayı tuşlayınız.";
const PBX_SERVICES = [
  { id: "restoran", label: "Restoran Destek" },
  { id: "musteri", label: "Müşteri Destek" },
  { id: "kurye", label: "Kurye Destek" },
];
let pbxCatFilter = "all";

function defaultPbxExts() {
  return [
    { ext: "100", name: "Santral", service: "musteri", role: "Karşılama", status: "ok" },
    { ext: "101", name: "Operasyon", service: "kurye", role: "Saha koordinasyon", status: "ok" },
    { ext: "102", name: "Muhasebe", service: "musteri", role: "Faturalama", status: "busy" },
    { ext: "103", name: "Yönetim", service: "restoran", role: "Karar hattı", status: "ok" },
    { ext: "104", name: "Teknik", service: "restoran", role: "Destek", status: "ok" },
  ];
}

function pbxServiceOf(item) {
  if (item?.service && PBX_SERVICES.some((svc) => svc.id === item.service)) return item.service;
  const t = String(item?.role || "").toLocaleLowerCase("tr");
  if (t.includes("restoran")) return "restoran";
  if (t.includes("kurye")) return "kurye";
  if (t.includes("müşteri") || t.includes("musteri")) return "musteri";
  return "";
}

function pbxServiceLabel(id) {
  return PBX_SERVICES.find((svc) => svc.id === id)?.label || "";
}

function pbxOrgs() {
  return store.get(PBX_ORGS, []);
}

function pbxMemberOrgs() {
  return pbxOrgs().filter((org) => !org.owner);
}

function pbxEnsureOwner() {
  const orgs = pbxOrgs();
  let changed = false;
  if (!orgs.some((org) => org.owner) && orgs.length) {
    const named = orgs.find((org) => /harbi grup/i.test(org.name || ""));
    (named || orgs[orgs.length - 1]).owner = true;
    changed = true;
  }
  orgs.forEach((org) => {
    if (PBX_RETIRED_LINES.includes(pbxDigits(org.inbound))) {
      org.inbound = "";
      changed = true;
    }
  });
  if (changed) store.set(PBX_ORGS, orgs);
}

function pbxRememberGet() {
  return store.get(PBX_REMEMBER, null);
}

function pbxRememberSave(login, pin, on) {
  if (on) store.set(PBX_REMEMBER, { login, pin });
  else store.set(PBX_REMEMBER, null);
}

function pbxFillRemember() {
  const saved = pbxRememberGet();
  if ($("#pbxRegRemember")) $("#pbxRegRemember").checked = saved ? true : $("#pbxRegRemember").checked !== false;
  if ($("#pbxLoginRemember")) $("#pbxLoginRemember").checked = saved ? true : true;
  if (!saved) return;
  if (saved.login && $("#pbxLoginName")) $("#pbxLoginName").value = saved.login;
  if (saved.pin && $("#pbxLoginPin")) $("#pbxLoginPin").value = saved.pin;
}

function pbxMatchOrg(login) {
  const q = String(login || "").trim().toLowerCase();
  const phone = pbxDigits(login);
  return pbxOrgs().find((org) => {
    if (org.name && org.name.toLowerCase() === q) return true;
    if (org.email && org.email.toLowerCase() === q) return true;
    if (phone && pbxDigits(org.phone) === phone) return true;
    return false;
  });
}

function pbxCurrent() {
  const id = store.get(PBX_SESSION, null);
  return pbxOrgs().find((org) => org.id === id) || null;
}

function pbxPatch(mutator) {
  const id = store.get(PBX_SESSION, null);
  const orgs = pbxOrgs();
  const org = orgs.find((item) => item.id === id);
  if (!org) return null;
  mutator(org);
  store.set(PBX_ORGS, orgs);
  return org;
}

function pbxDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function pbxInboundLine() {
  const org = pbxCurrent();
  if (!org) return "";
  const line = pbxDigits(org.inbound || "");
  if (!line || PBX_RETIRED_LINES.includes(line)) return "";
  return line;
}

function pbxLineLabel() {
  const d = pbxInboundLine();
  if (!d) return "Hat yok";
  if (d.length === 11 && d.startsWith("0")) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
  return d;
}

function pbxIsInbound(number) {
  const d = pbxDigits(number);
  const line = pbxInboundLine();
  return Boolean(d) && (d === line || d === line.slice(-10) || d === "90" + line);
}

function pbxGreetingText() {
  return String(pbxCurrent()?.greeting || $("#pbxGreetText")?.value || PBX_GREET_DEFAULT).trim() || PBX_GREET_DEFAULT;
}

function pbxAuthMsg(text) {
  const el = $("#pbxAuthMsg");
  if (el) el.textContent = text || "";
}

function renderPbx() {
  pbxEnsureOwner();
  pbxFillRemember();
  const org = pbxCurrent();
  $("#pbxGate").hidden = Boolean(org);
  $("#pbxApp").hidden = !org;
  if ($("#pbxOrgCount")) {
    $("#pbxOrgCount").textContent = `Üye işletme: ${pbxMemberOrgs().length} / ${PBX_MAX_ORGS}`;
  }
  if (!org) {
    $("#pbxStatus").textContent = "Santral kapalı";
    pbxRtcWatch(false);
    return;
  }
  $("#pbxStatus").textContent = `${org.name} · çevrimiçi`;
  const kind = org.owner ? "Sizin işletmeniz" : "Üye işletme";
  const phone = PBX_RETIRED_LINES.includes(pbxDigits(org.phone)) ? "" : org.phone;
  $("#pbxCompanyMeta").textContent = [kind, org.city, phone].filter(Boolean).join(" · ");
  if ($("#pbxGreetText")) $("#pbxGreetText").value = org.greeting || PBX_GREET_DEFAULT;
  if ($("#pbxLineNo")) $("#pbxLineNo").value = pbxInboundLine();
  if ($("#pbxLineHint")) {
    $("#pbxLineHint").textContent = pbxInboundLine()
      ? `${pbxLineLabel()} arandığında yapay zeka karşılama metnini okur. Dahili tuşlanınca hat cevap verene kadar müzik çalar.`
      : "Santral hattı kaldırıldı. Yeni numarayı yazıp kaydedin.";
  }
  pbxFillMusicUi();
  renderExt();
  renderCalls();
  pbxRtcWatch(true);
}

function pbxExtCard(item) {
  const service = pbxServiceLabel(pbxServiceOf(item));
  const bits = [item.ext, service, item.mobile].filter(Boolean);
  return `
      <article class="ext">
        <div>
          <strong><span class="dot ${item.status || "ok"}"></span>${escapeHtml(item.name)}</strong>
          <div class="hint">${escapeHtml(bits.join(" · "))}</div>
        </div>
        <div>
          <button class="gold" data-ext="${escapeHtml(item.ext)}" data-name="${escapeHtml(item.name)}" type="button">Ara</button>
          <button class="linkish" data-ext-del="${escapeHtml(item.ext)}" type="button">Sil</button>
        </div>
      </article>`;
}

function renderExt() {
  const org = pbxCurrent();
  const extensions = org?.extensions || [];
  $$("[data-pbx-cat]").forEach((btn) => {
    const on = btn.dataset.pbxCat === pbxCatFilter;
    btn.classList.toggle("gold", on);
    btn.classList.toggle("secondary", !on);
  });
  const groups = PBX_SERVICES.map((svc) => ({
    ...svc,
    items: extensions.filter((item) => pbxServiceOf(item) === svc.id),
  }));
  const other = extensions.filter((item) => !pbxServiceOf(item));
  const shown = pbxCatFilter === "all" ? groups : groups.filter((g) => g.id === pbxCatFilter);
  const parts = shown.map(
    (group) => `
      <section class="ext-cat">
        <h3 class="subhead">${escapeHtml(group.label)} (${group.items.length})</h3>
        ${group.items.map(pbxExtCard).join("") || "<p class='hint'>Bu hizmette henüz kimse yok.</p>"}
      </section>`
  );
  if (pbxCatFilter === "all" && other.length) {
    parts.push(`
      <section class="ext-cat">
        <h3 class="subhead">Diğer (${other.length})</h3>
        ${other.map(pbxExtCard).join("")}
      </section>`);
  }
  $("#extList").innerHTML = parts.join("") || "<p class='hint'>Dahili yok. Yukarıdan ekleyin.</p>";
  const sel = $("#pbxStationExt");
  if (sel && org) {
    const cur = sessionStorage.getItem("pbx-station-" + org.id) || sel.value || "";
    sel.innerHTML =
      `<option value="">Çağrı almak için dahili seçin</option>` +
      extensions
        .map(
          (item) =>
            `<option value="${escapeHtml(item.ext)}">${escapeHtml(item.ext)} · ${escapeHtml(item.name)}</option>`
        )
        .join("");
    sel.value = extensions.some((item) => item.ext === cur) ? cur : "";
  }
}

let callTimer = null;
let seconds = 0;
const overlay = $("#callOverlay");
let pbxCall = { phase: "", digits: "", token: 0, target: null, answerTimer: null };
let pbxHoldTimer = null;
let pbxHoldNodes = [];
let pbxHoldAudio = null;
let pbxRtc = { pc: null, stream: null, timer: null, peers: [], remote: null, offer: null };

function pbxPeerId() {
  let id = sessionStorage.getItem("pbx-peer");
  if (!id) {
    id = "p" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("pbx-peer", id);
  }
  return id;
}

async function pbxRtcPost(body) {
  const res = await fetch("/pbx-rtc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error("sinyal");
  return data;
}

function pbxRtcDesc(desc) {
  if (!desc) return null;
  return { type: desc.type, sdp: desc.sdp };
}

function pbxFillRtcHint() {
  const el = $("#pbxRtcLive");
  if (!el) return;
  const live = (pbxRtc.peers || []).filter((item) => item.ext);
  el.textContent = live.length
    ? "Çevrimiçi dahili: " + live.map((item) => (item.name ? `${item.ext} ${item.name}` : item.ext)).join(", ")
    : "Karşı cihaz yok. İkinci sekmede veya telefonda santrale girip dahilini seçin.";
}

function pbxRtcFindPeer(ext) {
  return (pbxRtc.peers || []).find((item) => item.ext === ext && item.peer !== pbxPeerId());
}

async function pbxRtcHello() {
  const org = pbxCurrent();
  if (!org) return;
  const ext = $("#pbxStationExt")?.value || "";
  const found = (org.extensions || []).find((item) => item.ext === ext);
  const data = await pbxRtcPost({
    action: "hello",
    org: String(org.id),
    peer: pbxPeerId(),
    ext,
    name: found?.name || org.name,
  });
  pbxRtc.peers = data.peers || [];
  pbxFillRtcHint();
  for (const msg of data.messages || []) {
    await pbxRtcOnMessage(msg);
  }
}

function pbxRtcWatch(on) {
  clearInterval(pbxRtc.timer);
  pbxRtc.timer = null;
  if (!on) {
    const org = store.get(PBX_SESSION, null);
    if (org) {
      pbxRtcPost({ action: "bye", org: String(org), peer: pbxPeerId(), to: pbxRtc.remote || "" }).catch(() => {});
    }
    return;
  }
  pbxRtcHello().catch(() => pbxFillRtcHint());
  pbxRtc.timer = setInterval(() => pbxRtcHello().catch(() => {}), 2000);
}

async function pbxRtcMic() {
  if (pbxRtc.stream) return pbxRtc.stream;
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Bu tarayıcı mikrofonu desteklemiyor.");
  pbxRtc.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  return pbxRtc.stream;
}

function pbxRtcRemote(stream) {
  const audio = $("#pbxRemoteAudio");
  if (!audio) return;
  audio.srcObject = stream;
  audio.play().catch(() => {});
}

function pbxStartTalkTimer() {
  seconds = 0;
  $("#callTimer").textContent = "00:00";
  clearInterval(callTimer);
  callTimer = setInterval(() => {
    seconds += 1;
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    $("#callTimer").textContent = `${mm}:${ss}`;
  }, 1000);
}

function pbxRtcHangup(quiet) {
  const remote = pbxRtc.remote;
  if (pbxRtc.pc) {
    try {
      pbxRtc.pc.close();
    } catch (_) {}
    pbxRtc.pc = null;
  }
  if (pbxRtc.stream) {
    pbxRtc.stream.getTracks().forEach((track) => track.stop());
    pbxRtc.stream = null;
  }
  const audio = $("#pbxRemoteAudio");
  if (audio) audio.srcObject = null;
  pbxRtc.offer = null;
  pbxRtc.remote = null;
  const org = pbxCurrent();
  if (!quiet && remote && org) {
    pbxRtcPost({ action: "send", org: String(org.id), peer: pbxPeerId(), to: remote, type: "bye", payload: {} }).catch(
      () => {}
    );
  }
}

async function pbxRtcMakePc(remotePeer) {
  const keepOffer = pbxRtc.offer;
  pbxRtcHangup(true);
  pbxRtc.offer = keepOffer;
  const stream = await pbxRtcMic();
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
  pbxRtc.pc = pc;
  pbxRtc.remote = remotePeer;
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  pc.onicecandidate = (event) => {
    if (!event.candidate || !pbxCurrent()) return;
    pbxRtcPost({
      action: "send",
      org: String(pbxCurrent().id),
      peer: pbxPeerId(),
      to: remotePeer,
      type: "ice",
      payload: { candidate: event.candidate.toJSON() },
    }).catch(() => {});
  };
  pc.ontrack = (event) => {
    pbxRtcRemote(event.streams[0] || new MediaStream(event.track ? [event.track] : []));
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") {
      pbxStopHoldMusic();
      pbxCall.phase = "talk";
      $("#answerCall").hidden = true;
      pbxStartTalkTimer();
      pbxShowOverlay("Aktif çağrı", $("#callTitle").textContent, "Harbi içi hat bağlandı.");
    }
  };
  return pc;
}

async function pbxPlaceRtcCall(found) {
  if (!found || !pbxCurrent()) return;
  pbxCall.mode = "rtc";
  pbxCall.target = found;
  pbxCall.phase = "hold";
  pbxCall.digits = found.ext;
  $("#callPad").hidden = true;
  $("#answerCall").hidden = true;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  pbxShowOverlay("Bağlanıyor", `${found.name} · ${found.ext}`, "Harbi içi çağrı…");
  overlay.hidden = false;
  pbxStartHoldMusic();
  pbxLogCall(`${found.name} · ${found.ext} · Harbi içi arama`);
  await pbxRtcHello().catch(() => {});
  const target = pbxRtcFindPeer(found.ext);
  if (!target) {
    pbxShowOverlay(
      "Bağlanıyor",
      `${found.name} · ${found.ext}`,
      "Bu dahili çevrimiçi değil. Karşı cihazda santrale girip aynı dahilini seçin."
    );
    return;
  }
  try {
    const pc = await pbxRtcMakePc(target.peer);
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    await pbxRtcPost({
      action: "send",
      org: String(pbxCurrent().id),
      peer: pbxPeerId(),
      to: target.peer,
      type: "offer",
      payload: {
        sdp: pbxRtcDesc(pc.localDescription),
        fromName:
          (pbxCurrent().extensions || []).find((item) => item.ext === $("#pbxStationExt")?.value)?.name ||
          pbxCurrent().name,
        ext: $("#pbxStationExt")?.value || "",
      },
    });
    pbxShowOverlay(
      "Bağlanıyor",
      `${found.name} · ${found.ext}`,
      "Cevap verene kadar müzik çalıyor: " + pbxHoldTrack().name
    );
  } catch (err) {
    pbxStopHoldMusic();
    pbxShowOverlay(
      "Bağlanıyor",
      `${found.name} · ${found.ext}`,
      err.message || "Mikrofon açılamadı. Bilgisayarda veya HTTPS ile deneyin."
    );
  }
}

async function pbxRtcOnMessage(msg) {
  if (!msg || !msg.type) return;
  if (msg.type === "offer" && msg.payload?.sdp) {
    pbxRtc.offer = msg;
    pbxCall.mode = "rtc";
    pbxCall.phase = "hold";
    pbxCall.target = { name: msg.payload.fromName || "Santral", ext: msg.payload.ext || "" };
    $("#callPad").hidden = true;
    $("#answerCall").hidden = false;
    overlay.hidden = false;
    pbxShowOverlay(
      "Gelen çağrı",
      `${pbxCall.target.name}${pbxCall.target.ext ? " · " + pbxCall.target.ext : ""}`,
      "Cevapla ile Harbi içi konuşma başlar."
    );
    return;
  }
  if (msg.type === "answer" && pbxRtc.pc && msg.payload?.sdp) {
    await pbxRtc.pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
    return;
  }
  if (msg.type === "ice" && pbxRtc.pc && msg.payload?.candidate) {
    try {
      await pbxRtc.pc.addIceCandidate(msg.payload.candidate);
    } catch (_) {}
    return;
  }
  if (msg.type === "bye") {
    pbxRtcHangup(true);
    pbxStopHoldMusic();
    overlay.hidden = true;
    clearInterval(callTimer);
    pbxCall.phase = "";
  }
}

async function pbxRtcAccept() {
  const msg = pbxRtc.offer;
  if (!msg?.payload?.sdp) return;
  try {
    const pc = await pbxRtcMakePc(msg.from);
    await pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await pbxRtcPost({
      action: "send",
      org: String(pbxCurrent().id),
      peer: pbxPeerId(),
      to: msg.from,
      type: "answer",
      payload: { sdp: pbxRtcDesc(pc.localDescription) },
    });
    pbxRtc.offer = null;
    $("#answerCall").hidden = true;
    pbxShowOverlay("Aktif çağrı", $("#callTitle").textContent, "Bağlanıyor…");
  } catch (err) {
    pbxShowOverlay("Gelen çağrı", $("#callTitle").textContent, err.message || "Mikrofon açılamadı.");
  }
}

function pbxMusicPresets() {
  return [
    { id: "harbi", name: "Harbi bekletme" },
    { id: "soft", name: "Yumuşak bekletme" },
    { id: "classic", name: "Klasik hat müziği" },
  ];
}

function pbxHoldTrack() {
  const saved = pbxCurrent()?.holdMusic;
  if (saved?.id === "file" && saved.data) {
    return { id: "file", name: saved.name || "Yüklenen müzik", data: saved.data };
  }
  const id = saved?.id && saved.id !== "file" ? saved.id : "harbi";
  return pbxMusicPresets().find((item) => item.id === id) || pbxMusicPresets()[0];
}

function pbxFillMusicUi() {
  const track = pbxHoldTrack();
  const pick = $("#pbxMusicPick");
  if (pick) {
    const fileOpt = pick.querySelector('option[value="file"]');
    if (fileOpt) fileOpt.hidden = track.id !== "file" && !pbxCurrent()?.holdMusic?.data;
    pick.value = track.id === "file" || pbxCurrent()?.holdMusic?.id === "file" ? "file" : track.id;
    if (pick.value === "file" && !pbxCurrent()?.holdMusic?.data) pick.value = "harbi";
  }
  if ($("#pbxMusicNow")) $("#pbxMusicNow").textContent = `Şu an çalan: ${track.name}`;
}

function pbxStopHoldMusic() {
  clearInterval(pbxHoldTimer);
  pbxHoldTimer = null;
  if (pbxHoldAudio) {
    try {
      pbxHoldAudio.pause();
      pbxHoldAudio.currentTime = 0;
    } catch (_) {}
    pbxHoldAudio = null;
  }
  pbxHoldNodes.forEach((node) => {
    try {
      node.stop?.();
    } catch (_) {}
    try {
      node.disconnect?.();
    } catch (_) {}
  });
  pbxHoldNodes = [];
}

function pbxHoldChain(ctx) {
  const master = ctx.createGain();
  master.gain.value = 1.603;
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -6;
  limit.knee.value = 10;
  limit.ratio.value = 14;
  limit.attack.value = 0.003;
  limit.release.value = 0.1;
  master.connect(limit);
  limit.connect(ctx.destination);
  return { master, limit };
}

function pbxStartBuiltinHold(style) {
  const ctx = nfcAudio();
  if (!ctx) return;
  const start = () => {
    const { master, limit } = pbxHoldChain(ctx);
    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    drone.type = style === "classic" ? "square" : "triangle";
    drone.frequency.value = style === "soft" ? 130.81 : style === "classic" ? 220 : 174.61;
    droneGain.gain.value = style === "classic" ? 0.05 : 0.12;
    drone.connect(droneGain);
    droneGain.connect(master);
    drone.start();
    pbxHoldNodes = [drone, droneGain, master, limit];
    const notes =
      style === "classic"
        ? [261.63, 329.63, 392.0, 329.63]
        : style === "soft"
          ? [196.0, 246.94, 293.66, 329.63, 293.66, 246.94]
          : [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 246.94];
    const gap = style === "soft" ? 720 : style === "classic" ? 900 : 480;
    let i = 0;
    const tick = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = style === "classic" ? "triangle" : "sine";
      osc.frequency.value = notes[i % notes.length];
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(style === "soft" ? 0.18 : 0.28, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (style === "classic" ? 0.85 : 0.62));
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + (style === "classic" ? 0.88 : 0.64));
      i += 1;
    };
    tick();
    pbxHoldTimer = setInterval(tick, gap);
  };
  if (ctx.state === "suspended") ctx.resume().then(start).catch(start);
  else start();
}

function pbxStartHoldMusic() {
  pbxStopHoldMusic();
  const track = pbxHoldTrack();
  if (track.id === "file" && track.data) {
    pbxHoldAudio = new Audio(track.data);
    pbxHoldAudio.loop = true;
    pbxHoldAudio.volume = 0.85;
    pbxHoldAudio.play().catch(() => pbxStartBuiltinHold("harbi"));
    return;
  }
  pbxStartBuiltinHold(track.id || "harbi");
}

function pbxStopMedia() {
  pbxCall.token += 1;
  clearTimeout(pbxCall.answerTimer);
  pbxCall.answerTimer = null;
  pbxCall.phase = "";
  pbxCall.digits = "";
  pbxCall.target = null;
  pbxCall.mode = "";
  pbxRtcHangup(false);
  pbxStopHoldMusic();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

function pbxShowOverlay(phase, title, hint) {
  overlay.hidden = false;
  $("#callPhase").textContent = phase;
  $("#callTitle").textContent = title;
  $("#callHint").textContent = hint || "";
  $("#callDigits").textContent = pbxCall.digits || "";
}

function pbxUiIdleCall() {
  $("#callPad").hidden = true;
  $("#answerCall").hidden = true;
  $("#callDigits").textContent = "";
  $("#callHint").textContent = "";
  $("#callPhase").textContent = "Aktif çağrı";
}

function pbxLogCall(detail) {
  pbxPatch((org) => {
    org.calls = org.calls || [];
    org.calls.unshift({ id: Date.now(), detail });
    org.calls = org.calls.slice(0, 30);
  });
  renderCalls();
}

async function pbxStartInbound() {
  if (!pbxCurrent()) return;
  pbxStopMedia();
  const token = pbxCall.token;
  pbxCall.phase = "greet";
  pbxUiIdleCall();
  $("#callTimer").textContent = "00:00";
  clearInterval(callTimer);
  seconds = 0;
  pbxShowOverlay("Gelen hat", pbxLineLabel(), "Karşılama seslendiriliyor…");
  pbxLogCall(`Gelen hat · ${pbxLineLabel()} · karşılama`);
  const ctx = nfcAudio();
  if (ctx?.state === "suspended") {
    try {
      await ctx.resume();
    } catch (_) {}
  }
  await speakNiceTr(pbxGreetingText());
  if (pbxCall.token !== token) return;
  pbxCall.phase = "ivr";
  $("#callPad").hidden = false;
  pbxShowOverlay("Santral", pbxLineLabel(), "Dahili numarayı tuşlayın.");
  await speakNiceTr("Dahili numarayı tuşlayınız.");
}

function pbxRingExtension(found) {
  pbxPlaceRtcCall(found);
}

function pbxAnswer() {
  if (pbxCall.mode === "rtc") {
    pbxRtcAccept();
    return;
  }
  if (pbxCall.phase !== "hold") return;
  const found = pbxCall.target;
  pbxCall.phase = "talk";
  clearTimeout(pbxCall.answerTimer);
  pbxStopHoldMusic();
  $("#answerCall").hidden = true;
  $("#callPad").hidden = true;
  pbxStartTalkTimer();
  pbxShowOverlay("Aktif çağrı", `${found?.name || "Dahili"} (${found?.ext || ""})`, "Hat bağlandı.");
  pbxLogCall(`${found?.name || "Dahili"} · ${found?.ext || ""} · bağlandı`);
}

function pbxPressKey(key) {
  if (pbxCall.phase !== "ivr") return;
  if (key === "sil") pbxCall.digits = pbxCall.digits.slice(0, -1);
  else if (key === "#") {
    /* confirm */
  } else pbxCall.digits += key;
  $("#callDigits").textContent = pbxCall.digits;
  const exts = pbxCurrent()?.extensions || [];
  const found = exts.find((item) => item.ext === pbxCall.digits);
  if (found) {
    pbxRingExtension(found);
    return;
  }
  if (key === "#" || pbxCall.digits.length >= 6) {
    pbxShowOverlay("Santral", pbxLineLabel(), "Dahili bulunamadı. Yeniden tuşlayın.");
    pbxCall.digits = "";
    $("#callDigits").textContent = "";
    speakNiceTr("Dahili bulunamadı. Lütfen yeniden tuşlayınız.");
  }
}

function startCall(name, number) {
  if (!pbxCurrent()) return;
  if (pbxIsInbound(number)) {
    pbxStartInbound();
    return;
  }
  pbxStopMedia();
  pbxUiIdleCall();
  seconds = 0;
  $("#callTitle").textContent = `${name} (${number})`;
  $("#callTimer").textContent = "00:00";
  overlay.hidden = false;
  clearInterval(callTimer);
  callTimer = setInterval(() => {
    seconds += 1;
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    $("#callTimer").textContent = `${mm}:${ss}`;
  }, 1000);
  pbxLogCall(`${name} · ${number}`);
  if (/^[0-9+\s]+$/.test(number) && number.length > 3) {
    window.location.href = `tel:${number.replace(/\s/g, "")}`;
  }
}

function renderCalls() {
  const logs = pbxCurrent()?.calls || [];
  $("#callLog").innerHTML = logs
    .map(
      (item) =>
        `<article class="note"><strong>Giden</strong><time> ${new Date(
          item.id
        ).toLocaleString("tr-TR")}</time><p>${escapeHtml(item.detail)}</p></article>`
    )
    .join("") || "<p class='hint'>Çağrı yok.</p>";
}

$("#pbxCats").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-pbx-cat]");
  if (!btn) return;
  pbxCatFilter = btn.dataset.pbxCat || "all";
  renderExt();
});

$("#extList").addEventListener("click", (event) => {
  const del = event.target.closest("[data-ext-del]");
  if (del) {
    pbxPatch((org) => {
      org.extensions = (org.extensions || []).filter((item) => item.ext !== del.dataset.extDel);
    });
    renderExt();
    return;
  }
  const btn = event.target.closest("[data-ext]");
  if (!btn) return;
  const found = (pbxCurrent()?.extensions || []).find((item) => item.ext === btn.dataset.ext);
  if (found) pbxPlaceRtcCall(found);
});

$("#dialBtn").addEventListener("click", () => {
  const number = $("#dialNumber").value.trim();
  if (!number) return;
  if (pbxIsInbound(number)) {
    pbxStartInbound();
    return;
  }
  const found = (pbxCurrent()?.extensions || []).find(
    (item) => item.ext === number || posPhone(item.mobile) === posPhone(number)
  );
  if (found) pbxPlaceRtcCall(found);
  else startCall(found?.name || "Harici hat", number);
});

$("#pbxGreetForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const greeting = $("#pbxGreetText").value.trim();
  if (!greeting) return;
  pbxPatch((org) => {
    org.greeting = greeting;
    const line = pbxDigits($("#pbxLineNo")?.value || "");
    org.inbound = PBX_RETIRED_LINES.includes(line) ? "" : line;
  });
  pbxAuthMsg("");
  renderPbx();
});

$("#pbxGreetListen").addEventListener("click", () => {
  const ctx = nfcAudio();
  if (ctx?.state === "suspended") ctx.resume();
  speakNiceTr(pbxGreetingText());
});

$("#pbxGreetTry").addEventListener("click", () => {
  pbxStartInbound();
});

$("#pbxMusicForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const pick = $("#pbxMusicPick").value;
  const file = $("#pbxMusicFile").files?.[0];
  if (pick === "file" || file) {
    if (!file && !pbxCurrent()?.holdMusic?.data) {
      pbxAuthMsg("Müzik dosyası seçin.");
      return;
    }
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        pbxAuthMsg("Müzik en fazla 4 MB olabilir.");
        return;
      }
      try {
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Müzik okunamadı."));
          reader.readAsDataURL(file);
        });
        pbxPatch((org) => {
          org.holdMusic = { id: "file", name: file.name, data };
        });
      } catch (err) {
        pbxAuthMsg(err.message || "Müzik kaydedilemedi.");
        return;
      }
    } else {
      pbxPatch((org) => {
        org.holdMusic = { ...org.holdMusic, id: "file" };
      });
    }
  } else {
    const preset = pbxMusicPresets().find((item) => item.id === pick) || pbxMusicPresets()[0];
    pbxPatch((org) => {
      org.holdMusic = { id: preset.id, name: preset.name };
    });
  }
  pbxAuthMsg("");
  pbxFillMusicUi();
});

$("#pbxMusicPreview").addEventListener("click", () => {
  const ctx = nfcAudio();
  if (ctx?.state === "suspended") ctx.resume();
  pbxStartHoldMusic();
});

$("#pbxMusicStop").addEventListener("click", () => pbxStopHoldMusic());

$("#callPad").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-pbx-key]");
  if (!btn) return;
  pbxPressKey(btn.dataset.pbxKey);
});

$("#answerCall").addEventListener("click", () => pbxAnswer());

$("#pbxRegisterForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const name = $("#pbxRegName").value.trim();
    const city = $("#pbxRegCity").value.trim();
    const phone = pbxDigits($("#pbxRegPhone").value);
    const email = $("#pbxRegEmail").value.trim().toLowerCase();
    const pin = $("#pbxRegPin").value;
    const pin2 = $("#pbxRegPin2").value;
    if (!name || !city || !phone || !email || !pin || !pin2) {
      pbxAuthMsg("Tüm alanlar zorunludur.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      pbxAuthMsg("Geçerli e-posta girin.");
      return;
    }
    if (phone.length < 10) {
      pbxAuthMsg("Geçerli telefon girin.");
      return;
    }
    if (pin.length < 4) {
      pbxAuthMsg("Şifre en az 4 karakter olmalı.");
      return;
    }
    if (pin !== pin2) {
      pbxAuthMsg("Şifreler aynı olmalı.");
      return;
    }
    if (!$("#pbxRegIkamet").files?.[0] || !$("#pbxRegImza").files?.[0]) {
      pbxAuthMsg("İkametgah ve imza sirküleri zorunludur.");
      return;
    }
    pbxEnsureOwner();
    const orgs = pbxOrgs();
    if (pbxMemberOrgs().length >= PBX_MAX_ORGS) {
      pbxAuthMsg("En fazla 100 işletme üye olabilir.");
      return;
    }
    if (orgs.some((org) => org.name.toLowerCase() === name.toLowerCase())) {
      pbxAuthMsg("Bu işletme adı kayıtlı. Giriş yapın.");
      return;
    }
    if (orgs.some((org) => org.email && org.email.toLowerCase() === email)) {
      pbxAuthMsg("Bu e-posta ile üyelik var. Giriş yapın.");
      return;
    }
    if (orgs.some((org) => pbxDigits(org.phone) === phone)) {
      pbxAuthMsg("Bu telefon ile üyelik var. Giriş yapın.");
      return;
    }
    const [ikamet, imza] = await Promise.all([posReadDoc($("#pbxRegIkamet")), posReadDoc($("#pbxRegImza"))]);
    const org = {
      id: Date.now(),
      owner: false,
      name,
      city,
      phone: $("#pbxRegPhone").value.trim(),
      email,
      inbound: "",
      greeting: `${name} santraline hoş geldiniz. Dahili numarayı tuşlayınız.`,
      pin,
      docs: { ikamet, imza },
      extensions: [],
      calls: [],
    };
    orgs.unshift(org);
    store.set(PBX_ORGS, orgs);
    store.set(PBX_SESSION, org.id);
    pbxRememberSave(email || name, pin, $("#pbxRegRemember").checked);
    pbxAuthMsg("");
    $("#pbxRegisterForm").reset();
    renderPbx();
  } catch (err) {
    pbxAuthMsg(err.message || "Üyelik oluşturulamadı.");
  }
});

$("#pbxLoginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const login = $("#pbxLoginName").value.trim();
  const pin = $("#pbxLoginPin").value;
  const org = pbxMatchOrg(login);
  if (!org || org.pin !== pin) {
    pbxAuthMsg("İşletme bilgisi veya şifre hatalı.");
    return;
  }
  store.set(PBX_SESSION, org.id);
  pbxRememberSave(login, pin, $("#pbxLoginRemember").checked);
  pbxAuthMsg("");
  $("#pbxLoginForm").reset();
  renderPbx();
});

$("#pbxLoginShowPin").addEventListener("click", () => {
  posTogglePins(["#pbxLoginPin"], $("#pbxLoginShowPin"));
  const shown = $("#pbxLoginPin").type === "text";
  $("#pbxLoginShowPin").textContent = shown ? "Şifreyi gizle" : "Şifreyi göster";
});
$("#pbxRegShowPin").addEventListener("click", () => {
  posTogglePins(["#pbxRegPin", "#pbxRegPin2"], $("#pbxRegShowPin"));
});
$("#pbxForgotShowPin").addEventListener("click", () => {
  posTogglePins(["#pbxForgotPin", "#pbxForgotPin2"], $("#pbxForgotShowPin"));
});
$("#pbxForgotOpen").addEventListener("click", () => {
  $("#pbxForgot").hidden = false;
  $("#pbxForgotPhone").value = $("#pbxRegPhone").value || $("#pbxLoginName").value;
  $("#pbxForgotEmail").value = $("#pbxRegEmail").value;
});
$("#pbxForgotCancel").addEventListener("click", () => {
  $("#pbxForgot").hidden = true;
});
$("#pbxForgot").addEventListener("submit", (event) => {
  event.preventDefault();
  const phone = pbxDigits($("#pbxForgotPhone").value);
  const email = $("#pbxForgotEmail").value.trim().toLowerCase();
  const pin = $("#pbxForgotPin").value;
  const pin2 = $("#pbxForgotPin2").value;
  if (!phone || !email || !pin || !pin2) {
    pbxAuthMsg("Tüm alanlar zorunludur.");
    return;
  }
  if (pin !== pin2) {
    pbxAuthMsg("Şifreler aynı olmalı.");
    return;
  }
  const orgs = pbxOrgs();
  const org = orgs.find(
    (item) => pbxDigits(item.phone) === phone && item.email && item.email.toLowerCase() === email
  );
  if (!org) {
    pbxAuthMsg("Telefon ve e-posta eşleşmedi.");
    return;
  }
  org.pin = pin;
  store.set(PBX_ORGS, orgs);
  pbxRememberSave(email, pin, $("#pbxLoginRemember")?.checked !== false);
  $("#pbxForgot").reset();
  $("#pbxForgot").hidden = true;
  pbxAuthMsg("Şifre güncellendi. Giriş yapın.");
});

$("#pbxLogout").addEventListener("click", () => {
  pbxStopMedia();
  pbxRtcWatch(false);
  store.set(PBX_SESSION, null);
  overlay.hidden = true;
  clearInterval(callTimer);
  renderPbx();
});

$("#pbxExtForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const ext = $("#pbxExtNo").value.trim();
  const name = $("#pbxExtName").value.trim();
  const service = $("#pbxExtService").value;
  const mobile = $("#pbxExtMobile").value.trim();
  if (!ext || !name || !service || !mobile) return;
  if (!PBX_SERVICES.some((svc) => svc.id === service)) {
    pbxAuthMsg("Hizmet kategorisi seçin.");
    return;
  }
  if (posPhone(mobile).length < 10) {
    pbxAuthMsg("Geçerli cep numarası girin.");
    return;
  }
  const org = pbxCurrent();
  if (!org) return;
  if ((org.extensions || []).some((item) => item.ext === ext)) {
    pbxAuthMsg("Bu dahili numarası var.");
    return;
  }
  pbxPatch((item) => {
    item.extensions = item.extensions || [];
    item.extensions.push({ ext, name, service, role: pbxServiceLabel(service), mobile, status: "ok" });
  });
  pbxAuthMsg("");
  $("#pbxExtForm").reset();
  renderExt();
});

$("#pbxStationExt").addEventListener("change", () => {
  const org = pbxCurrent();
  if (org) sessionStorage.setItem("pbx-station-" + org.id, $("#pbxStationExt").value);
  pbxRtcHello().catch(() => {});
});

$("#hangupCall").addEventListener("click", () => {
  pbxStopMedia();
  overlay.hidden = true;
  clearInterval(callTimer);
});

$("#holdCall").addEventListener("click", () => {
  $("#pbxStatus").textContent = `${pbxCurrent()?.name || "Santral"} · bekletmede`;
  if (pbxCall.phase === "talk") {
    pbxCall.phase = "hold";
    $("#answerCall").hidden = false;
    pbxShowOverlay("Beklemede", $("#callTitle").textContent, "Hat bekletmede, müzik çalıyor.");
    pbxStartHoldMusic();
  }
});

function renderBookings(key, listId, emptyText) {
  const items = store.get(key, []);
  $(listId).innerHTML = items
    .map(
      (item) => `
      <article class="note">
        <header>
          <strong>${escapeHtml(item.title)}</strong>
          <button class="linkish" data-book-del="${item.id}" data-book-key="${key}" type="button">Sil</button>
        </header>
        <p>${escapeHtml(item.detail)}</p>
      </article>`
    )
    .join("") || `<p class="hint">${emptyText}</p>`;
}

function renderFlights() {
  renderBookings("flights", "#flightList", "Uçuş yok.");
}

const FLIGHT_AIRPORTS = [
  { code: "IST", keys: ["istanbul", "ist", "istanbul havalimanı"] },
  { code: "SAW", keys: ["sabiha", "saw", "pendik"] },
  { code: "ESB", keys: ["ankara", "esb", "esenboğa", "esenboga"] },
  { code: "ADB", keys: ["izmir", "adb", "adnan menderes"] },
  { code: "AYT", keys: ["antalya", "ayt"] },
  { code: "DLM", keys: ["dalaman", "dlm", "fethiye", "marmaris"] },
  { code: "BJV", keys: ["bodrum", "bjv", "milas"] },
  { code: "TZX", keys: ["trabzon", "tzx"] },
  { code: "GZT", keys: ["gaziantep", "gzt", "antep"] },
  { code: "ADA", keys: ["adana", "ada"] },
  { code: "ASR", keys: ["kayseri", "asr", "kapadokya"] },
  { code: "SZF", keys: ["samsun", "szf"] },
  { code: "VAN", keys: ["van"] },
  { code: "DIY", keys: ["diyarbakır", "diyarbakir", "diy"] },
  { code: "ECN", keys: ["lefkoşa", "lefkosa", "ekrcan", "kktc", "kıbrıs", "kibris"] },
  { code: "AYT", keys: ["alanya"] },
];

const FLIGHT_ROUTES = [
  { from: ["IST", "SAW"], to: ["AYT"], direct: 1890, connect: 1240, via: "ESB", airD: "Pegasus", airC: "AJet + THY" },
  { from: ["IST", "SAW"], to: ["ADB"], direct: 1650, connect: 1180, via: "ESB", airD: "THY", airC: "AJet" },
  { from: ["IST", "SAW"], to: ["ESB"], direct: 1420, connect: 980, via: "ADB", airD: "AJet", airC: "Pegasus" },
  { from: ["IST", "SAW"], to: ["BJV"], direct: 2100, connect: 1560, via: "AYT", airD: "Pegasus", airC: "THY" },
  { from: ["IST", "SAW"], to: ["DLM"], direct: 1980, connect: 1490, via: "AYT", airD: "THY", airC: "Pegasus" },
  { from: ["IST", "SAW"], to: ["TZX"], direct: 1750, connect: 1290, via: "ESB", airD: "THY", airC: "AJet" },
  { from: ["IST", "SAW"], to: ["GZT"], direct: 1820, connect: 1310, via: "ADA", airD: "Pegasus", airC: "AJet" },
  { from: ["IST", "SAW"], to: ["ADA"], direct: 1690, connect: 1210, via: "ESB", airD: "THY", airC: "Pegasus" },
  { from: ["IST", "SAW"], to: ["ECN"], direct: 2450, connect: 1890, via: "AYT", airD: "Pegasus", airC: "AJet" },
  { from: ["ESB"], to: ["AYT"], direct: 1550, connect: 1120, via: "IST", airD: "AJet", airC: "THY" },
  { from: ["ESB"], to: ["ADB"], direct: 1480, connect: 1090, via: "IST", airD: "AJet", airC: "Pegasus" },
  { from: ["ADB"], to: ["AYT"], direct: 1360, connect: 990, via: "IST", airD: "SunExpress", airC: "THY" },
  { from: ["AYT"], to: ["ECN"], direct: 1680, connect: 1320, via: "IST", airD: "Pegasus", airC: "THY" },
  { from: ["IST", "SAW"], to: ["ASR"], direct: 1580, connect: 1140, via: "ESB", airD: "AJet", airC: "THY" },
  { from: ["IST", "SAW"], to: ["VAN"], direct: 2050, connect: 1510, via: "ESB", airD: "THY", airC: "AJet" },
  { from: ["IST", "SAW"], to: ["DIY"], direct: 1920, connect: 1390, via: "ADA", airD: "Pegasus", airC: "AJet" },
  { from: ["IST", "SAW"], to: ["SZF"], direct: 1520, connect: 1080, via: "ESB", airD: "AJet", airC: "Pegasus" },
];

function airportQuery(text) {
  const q = text.trim().toLocaleLowerCase("tr-TR");
  const hit = FLIGHT_AIRPORTS.find((item) => item.keys.some((key) => q.includes(key) || key.includes(q)));
  return hit?.code || text.trim().toUpperCase().slice(0, 3);
}

function matchRoute(fromCode, toCode) {
  return FLIGHT_ROUTES.find(
    (route) =>
      (route.from.includes(fromCode) && route.to.includes(toCode)) ||
      (route.from.includes(toCode) && route.to.includes(fromCode))
  );
}

function googleFlightUrl(from, to, date) {
  const q = encodeURIComponent(`Flights from ${from} to ${to} on ${date}`);
  return `https://www.google.com/travel/flights?hl=tr&curr=TRY&q=${q}`;
}

function renderFlightResults(rows, people, from, to, date) {
  const box = $("#flightResults");
  if (!rows.length) {
    box.innerHTML = `<p class="hint">Bu hatta örnek fiyat yok. Google’da arayabilirsiniz.</p>
      <div class="row"><a class="gold" href="${googleFlightUrl(from, to, date)}" rel="noopener noreferrer">Google Uçuşlar</a></div>`;
    return;
  }
  box.innerHTML = rows
    .map((item, index) => {
      const total = item.price * people;
      return `
        <article class="holiday-hit${index === 0 ? " best" : ""}">
          ${index === 0 ? "<span class='holiday-best'>En ucuz</span>" : ""}
          <strong>${escapeHtml(item.label)}</strong>
          <p class="hint">${escapeHtml(item.airline)} · ${escapeHtml(item.kind)} · ${escapeHtml(date)}</p>
          <p class="price">${formatTry(item.price)} / kişi · ${people} yolcu · Toplam ${formatTry(total)}</p>
          <div class="row">
            <a class="primary" href="${googleFlightUrl(from, to, date)}" rel="noopener noreferrer">Bilet ara</a>
            <button class="secondary" type="button" data-flight-pick="${escapeHtml(from)} → ${escapeHtml(to)}" data-flight-detail="${escapeHtml(item.kind)} · ${people} yolcu · ${formatTry(total)} · ${escapeHtml(date)}">Kaydet</button>
          </div>
        </article>`;
    })
    .join("");
}

$("#flightSearch").addEventListener("submit", (event) => {
  event.preventDefault();
  resumeMarkSearch("flights");
  const fromText = $("#flightSearchFrom").value.trim();
  const toText = $("#flightSearchTo").value.trim();
  const date = $("#flightSearchDate").value;
  const people = Math.min(9, Math.max(1, Number($("#flightSearchPeople").value) || 1));
  const kind = $("#flightSearchKind").value;
  $("#flightSearchPeople").value = String(people);
  const from = airportQuery(fromText);
  const to = airportQuery(toText);
  const route = matchRoute(from, to);
  const rows = [];
  if (route) {
    if (kind !== "connect") {
      rows.push({
        label: `${from} → ${to}`,
        kind: "Aktarmasız",
        airline: route.airD,
        price: route.direct,
      });
    }
    if (kind !== "direct") {
      rows.push({
        label: `${from} → ${route.via} → ${to}`,
        kind: "Aktarmalı",
        airline: route.airC,
        price: route.connect,
      });
    }
    rows.sort(byPrice($("#flightSort").value, (item) => item.price));
  }
  renderFlightResults(rows, people, from, to, date);
});

$("#flightResults").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-flight-pick]");
  if (!btn) return;
  const items = store.get("flights", []);
  items.unshift({
    id: Date.now(),
    title: btn.dataset.flightPick,
    detail: btn.dataset.flightDetail,
  });
  store.set("flights", items);
  renderFlights();
});


function renderHolidays() {
  renderBookings("holidays", "#holidayList", "Rezervasyon yok.");
}

const HOLIDAY_PLACES = [
  { name: "Club Med Palmiye", region: "Kemer, Antalya", type: "village", nightly: 4200, board: "Her şey dahil", img: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=900&q=70" },
  { name: "Voyage Belek Golf & Spa", region: "Belek, Antalya", type: "village", nightly: 5100, board: "Her şey dahil", img: "https://images.unsplash.com/photo-1582719478250-c89cae4ceb85?auto=format&fit=crop&w=900&q=70" },
  { name: "Gloria Serenity Resort", region: "Belek, Antalya", type: "village", nightly: 5600, board: "Her şey dahil", img: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=70" },
  { name: "Rixos Premium Tekirova", region: "Tekirova, Antalya", type: "village", nightly: 4800, board: "Her şey dahil", img: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=70" },
  { name: "Titanic Mardan Palace", region: "Lara, Antalya", type: "village", nightly: 6200, board: "Her şey dahil", img: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&q=70" },
  { name: "Bodrum Bitez Club", region: "Bitez, Bodrum", type: "village", nightly: 3900, board: "Alkol hariç her şey dahil", img: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=900&q=70" },
  { name: "Marmaris İçmeler Tatil Köyü", region: "İçmeler, Marmaris", type: "village", nightly: 2800, board: "Her şey dahil", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=70" },
  { name: "Kuşadası Ladies Beach Resort", region: "Kuşadası, Aydın", type: "village", nightly: 2600, board: "Oda kahvaltı", img: "https://images.unsplash.com/photo-1473116120240-2243af765c68?auto=format&fit=crop&w=900&q=70" },
  { name: "Didim Altınkum Sitesi", region: "Didim, Aydın", type: "village", nightly: 2200, board: "Oda kahvaltı", img: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=70" },
  { name: "Ölüdeniz", region: "Fethiye, Muğla", type: "place", nightly: 2400, board: "Pansiyon / otel", img: "https://images.unsplash.com/photo-1533105079780-fdcd39d8d27c?auto=format&fit=crop&w=900&q=70" },
  { name: "Kapadokya / Ürgüp", region: "Nevşehir", type: "place", nightly: 2100, board: "Butik otel", img: "https://images.unsplash.com/photo-1641128358113-7413c7a8c0f3?auto=format&fit=crop&w=900&q=70" },
  { name: "Çeşme Ilıca", region: "İzmir", type: "place", nightly: 3000, board: "Otel", img: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&h=500&q=70" },
  { name: "Alaçatı", region: "Çeşme, İzmir", type: "place", nightly: 3400, board: "Butik otel", img: "https://images.unsplash.com/photo-1499793983690-e87ca411299d?auto=format&fit=crop&w=900&q=70" },
  { name: "Kaş – Kalkan", region: "Antalya", type: "place", nightly: 2700, board: "Otel / villa", img: "https://images.unsplash.com/photo-1439066615861-d1af74d54063?auto=format&fit=crop&w=900&q=70" },
  { name: "Ayvalık Cunda", region: "Balıkesir", type: "place", nightly: 1900, board: "Pansiyon", img: "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=900&q=70" },
  { name: "Uludağ", region: "Bursa", type: "place", nightly: 3200, board: "Yarım pansiyon", img: "https://images.unsplash.com/photo-1483921020237-2ff51e8f4a90?auto=format&fit=crop&w=900&q=70" },
  { name: "Palandöken", region: "Erzurum", type: "place", nightly: 2500, board: "Yarım pansiyon", img: "https://images.unsplash.com/photo-1551524559-8af4e66299ce?auto=format&fit=crop&w=900&q=70" },
  { name: "Amasra", region: "Bartın", type: "place", nightly: 1700, board: "Pansiyon", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&h=500&q=70" },
  { name: "Datça", region: "Muğla", type: "place", nightly: 2300, board: "Butik otel", img: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=900&q=70" },
  { name: "Side – Manavgat", region: "Antalya", type: "place", nightly: 2000, board: "Otel", img: "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=900&q=70" },
];

function holidayTypeLabel(type) {
  return type === "village" ? "Tatil köyü" : "Tatil yeri";
}

function formatTry(n) {
  return `${Math.round(n).toLocaleString("tr-TR")} ₺`;
}

function renderHolidayResults(list, people, nights) {
  const box = $("#holidayResults");
  if (!list.length) {
    box.innerHTML = "<p class='hint'>Bu aramaya uygun tatil bulunamadı. Bölgeyi değiştirin.</p>";
    return;
  }
  box.innerHTML = list
    .map((item, index) => {
      const total = item.nightly * people * nights;
      const q = encodeURIComponent(`${item.name} ${item.region} tatil`);
      return `
        <article class="holiday-hit${index === 0 ? " best" : ""}">
          ${index === 0 ? "<span class='holiday-best'>En uygun</span>" : ""}
          <img class="holiday-photo" src="${item.img}" alt="${escapeHtml(item.name)}" loading="lazy" />
          <strong>${escapeHtml(item.name)}</strong>
          <p class="hint">${escapeHtml(holidayTypeLabel(item.type))} · ${escapeHtml(item.region)} · ${escapeHtml(item.board)}</p>
          <p class="price">${formatTry(item.nightly)} / kişi / gece · ${people} kişi · ${nights} gece</p>
          <p class="price">Toplam yaklaşık ${formatTry(total)}</p>
          <div class="row">
            <a class="primary" href="https://www.google.com/search?q=${q}" rel="noopener noreferrer">Kaynaklarda aç</a>
            <button class="secondary" type="button" data-holiday-pick="${escapeHtml(item.name)}" data-holiday-detail="${people} kişi · ${nights} gece · ${formatTry(total)}">Kaydet</button>
          </div>
        </article>`;
    })
    .join("");
}

$("#holidaySearch").addEventListener("submit", (event) => {
  event.preventDefault();
  resumeMarkSearch("holiday");
  const type = $("#holidayType").value;
  const where = $("#holidayWhere").value.trim().toLocaleLowerCase("tr-TR");
  const people = Math.min(20, Math.max(1, Number($("#holidayPeople").value) || 2));
  const nights = Math.min(30, Math.max(1, Number($("#holidayNights").value) || 7));
  $("#holidayPeople").value = String(people);
  $("#holidayNights").value = String(nights);
  const hits = HOLIDAY_PLACES.filter((item) => {
    const typeOk = type === "all" || item.type === type;
    const whereOk =
      !where ||
      item.region.toLocaleLowerCase("tr-TR").includes(where) ||
      item.name.toLocaleLowerCase("tr-TR").includes(where);
    return typeOk && whereOk;
  }).sort(byPrice($("#holidaySort").value, (item) => item.nightly));
  renderHolidayResults(hits, people, nights);
});

$("#holidayResults").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-holiday-pick]");
  if (!btn) return;
  const items = store.get("holidays", []);
  items.unshift({
    id: Date.now(),
    title: btn.dataset.holidayPick,
    detail: btn.dataset.holidayDetail,
  });
  store.set("holidays", items);
  renderHolidays();
});


$("#flightForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const items = store.get("flights", []);
  items.unshift({
    id: Date.now(),
    title: `${$("#flightFrom").value.trim()} → ${$("#flightTo").value.trim()}`,
    detail: [$("#flightDate").value, $("#flightNote").value.trim()].filter(Boolean).join(" · "),
  });
  store.set("flights", items);
  $("#flightForm").reset();
  renderFlights();
});

$("#holidayForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const items = store.get("holidays", []);
  items.unshift({
    id: Date.now(),
    title: $("#holidayPlace").value.trim(),
    detail: [$("#holidayDates").value.trim(), $("#holidayNote").value.trim()].filter(Boolean).join(" · "),
  });
  store.set("holidays", items);
  $("#holidayForm").reset();
  renderHolidays();
});

document.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-book-del]");
  if (!btn) return;
  const key = btn.dataset.bookKey;
  store.set(
    key,
    store.get(key, []).filter((item) => String(item.id) !== btn.dataset.bookDel)
  );
  if (key === "flights") renderFlights();
  else if (key === "cars") renderCars();
  else if (key === "homes") renderHomes();
  else if (key === "bikes") renderBikes();
  else renderHolidays();
});

const CAR_RENTALS = [
  { company: "Garenta", car: "Fiat Egea", cls: "economy", city: "İstanbul", daily: 890, trans: "Otomatik", img: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=900&q=70" },
  { company: "Rent Go", car: "Renault Clio", cls: "economy", city: "İstanbul", daily: 820, trans: "Manuel", img: "https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=900&q=70" },
  { company: "Budget", car: "Hyundai i20", cls: "economy", city: "Ankara", daily: 780, trans: "Otomatik", img: "https://images.unsplash.com/photo-1494905998402-395d579af36f?auto=format&fit=crop&w=900&q=70" },
  { company: "Avis", car: "Toyota Corolla", cls: "compact", city: "İstanbul", daily: 1450, trans: "Otomatik", img: "https://images.unsplash.com/photo-1621007947382-bb3c9980e2de?auto=format&fit=crop&w=900&q=70" },
  { company: "Enterprise", car: "Ford Focus", cls: "compact", city: "İzmir", daily: 1320, trans: "Otomatik", img: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=70" },
  { company: "Hertz", car: "Volkswagen Golf", cls: "compact", city: "Antalya", daily: 1580, trans: "Otomatik", img: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=900&q=70" },
  { company: "Central", car: "Fiat Doblo", cls: "suv", city: "İstanbul", daily: 1180, trans: "Manuel", img: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=900&q=70" },
  { company: "Garenta", car: "Nissan Qashqai", cls: "suv", city: "Antalya", daily: 1890, trans: "Otomatik", img: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=900&q=70" },
  { company: "Avis", car: "Toyota RAV4", cls: "suv", city: "Bodrum", daily: 2450, trans: "Otomatik", img: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=900&q=70" },
  { company: "Sixt", car: "BMW 3 Serisi", cls: "luxury", city: "İstanbul", daily: 2890, trans: "Otomatik", img: "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=900&q=70" },
  { company: "Europcar", car: "Mercedes A 200", cls: "luxury", city: "İzmir", daily: 2650, trans: "Otomatik", img: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=900&q=70" },
  { company: "Hertz", car: "Audi A4", cls: "luxury", city: "Ankara", daily: 2720, trans: "Otomatik", img: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=900&q=70" },
  { company: "Rent Go", car: "Dacia Sandero", cls: "economy", city: "Antalya", daily: 690, trans: "Manuel", img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=70" },
  { company: "Budget", car: "Peugeot 208", cls: "economy", city: "İzmir", daily: 810, trans: "Otomatik", img: "https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=900&q=70" },
  { company: "Sixt", car: "Volvo XC40", cls: "suv", city: "İstanbul", daily: 3100, trans: "Otomatik", img: "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&w=900&q=70" },
  { company: "Enterprise", car: "Renault Megane", cls: "compact", city: "Adana", daily: 1190, trans: "Otomatik", img: "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=900&q=70" },
];

function carClassLabel(cls) {
  return { economy: "Ekonomi", compact: "Kompakt", suv: "SUV", luxury: "Lüks" }[cls] || cls;
}

function renderCars() {
  renderBookings("cars", "#carList", "Kiralama kaydı yok.");
}

function renderCarResults(list, days) {
  const box = $("#carResults");
  if (!list.length) {
    box.innerHTML = "<p class='hint'>Bu aramaya uygun araç bulunamadı. Şehir veya sınıfı değiştirin.</p>";
    return;
  }
  box.innerHTML = list
    .map((item, index) => {
      const total = item.daily * days;
      const q = encodeURIComponent(`${item.company} ${item.car} kiralama ${item.city}`);
      return `
        <article class="holiday-hit${index === 0 ? " best" : ""}">
          ${index === 0 ? "<span class='holiday-best'>En uygun</span>" : ""}
          <img class="holiday-photo" src="${item.img}" alt="${escapeHtml(item.car)}" loading="lazy" />
          <strong>${escapeHtml(item.company)}</strong>
          <p class="hint">${escapeHtml(item.car)} · ${escapeHtml(carClassLabel(item.cls))} · ${escapeHtml(item.trans)} · ${escapeHtml(item.city)}</p>
          <p class="price">Ort. ${formatTry(item.daily)} / gün · ${days} gün</p>
          <p class="price">Toplam yaklaşık ${formatTry(total)}</p>
          <div class="row">
            <a class="primary" href="https://www.google.com/search?q=${q}" rel="noopener noreferrer">Şirketi aç</a>
            <button class="secondary" type="button" data-car-pick="${escapeHtml(item.company)} · ${escapeHtml(item.car)}" data-car-detail="${escapeHtml(item.city)} · ${days} gün · ${formatTry(total)}">Kaydet</button>
          </div>
        </article>`;
    })
    .join("");
}

$("#carSearch").addEventListener("submit", (event) => {
  event.preventDefault();
  resumeMarkSearch("cars");
  const city = $("#carCity").value.trim().toLocaleLowerCase("tr-TR");
  const cls = $("#carClass").value;
  const days = Math.min(30, Math.max(1, Number($("#carDays").value) || 3));
  $("#carDays").value = String(days);
  const hits = CAR_RENTALS.filter((item) => {
    const classOk = cls === "all" || item.cls === cls;
    const cityOk = !city || item.city.toLocaleLowerCase("tr-TR").includes(city);
    return classOk && cityOk;
  }).sort(byPrice($("#carSort").value, (item) => item.daily));
  renderCarResults(hits, days);
});

$("#carResults").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-car-pick]");
  if (!btn) return;
  const items = store.get("cars", []);
  items.unshift({
    id: Date.now(),
    title: btn.dataset.carPick,
    detail: btn.dataset.carDetail,
  });
  store.set("cars", items);
  renderCars();
});

const HOME_LISTINGS = [
  {
    kind: "rent",
    title: "Deniz manzaralı 2+1",
    address: "Moda Caddesi No:24, Kadıköy / İstanbul",
    rooms: 2,
    m2: 95,
    floor: "5/8",
    age: "8 yaş",
    price: 42000,
    detail: "Eşyalı, balkonlu, site içinde otopark ve güvenlik. Metroya 6 dk.",
    photos: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=70",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=600&q=70",
      "https://images.unsplash.com/photo-1484154218966-a5e0bdc7e1b1?auto=format&fit=crop&w=600&q=70",
    ],
  },
  {
    kind: "sale",
    title: "Sıfır 3+1 daire",
    address: "Bağdat Caddesi No:112, Caddebostan / İstanbul",
    rooms: 3,
    m2: 145,
    floor: "7/12",
    age: "Sıfır",
    price: 18500000,
    detail: "Amerikan mutfak, ebeveyn banyosu, yerden ısıtma. Tapu hazır.",
    photos: [
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=70",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=70",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=600&q=70",
    ],
  },
  {
    kind: "rent",
    title: "1+1 stüdyo",
    address: "Tunalı Hilmi Caddesi No:48, Çankaya / Ankara",
    rooms: 1,
    m2: 55,
    floor: "3/6",
    age: "12 yaş",
    price: 18500,
    detail: "Merkezi konum, asansörlü, doğalgaz kombi. Öğrenci / çalışan uygun.",
    photos: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=70",
      "https://images.unsplash.com/photo-1493809842364-82890fbbf2b0?auto=format&fit=crop&w=600&q=70",
      "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=600&q=70",
    ],
  },
  {
    kind: "sale",
    title: "Bahçeli 4+1 villa",
    address: "Çayyolu 8. Cadde No:7, Çankaya / Ankara",
    rooms: 4,
    m2: 220,
    floor: "Müstakil",
    age: "5 yaş",
    price: 24500000,
    detail: "Müstakil bahçe, kapalı otopark, şömine. Güvenlikli site.",
    photos: [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=70",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=70",
      "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdbc?auto=format&fit=crop&w=600&q=70",
    ],
  },
  {
    kind: "rent",
    title: "3+1 geniş daire",
    address: "Alsancak Kıbrıs Şehitleri Cd. No:61, Konak / İzmir",
    rooms: 3,
    m2: 130,
    floor: "4/7",
    age: "15 yaş",
    price: 35000,
    detail: "Denize yürüme mesafesi, 2 balkon, ankastre mutfak.",
    photos: [
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=70",
      "https://images.unsplash.com/photo-1560185893-a55cbc8c57bb?auto=format&fit=crop&w=600&q=70",
      "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=600&q=70",
    ],
  },
  {
    kind: "sale",
    title: "Site içi 2+1",
    address: "Bornova Kazım Dirik Mah. 180. Sk. No:9, İzmir",
    rooms: 2,
    m2: 88,
    floor: "2/5",
    age: "6 yaş",
    price: 6200000,
    detail: "Havuzlu site, çocuk parkı, kapalı otopark. Krediye uygun.",
    photos: [
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=70",
      "https://images.unsplash.com/photo-1560448204-61dc36dc98c8?auto=format&fit=crop&w=600&q=70",
      "https://images.unsplash.com/photo-1556912173-46c336c7fd55?auto=format&fit=crop&w=600&q=70",
    ],
  },
  {
    kind: "rent",
    title: "Yazlık 3+1",
    address: "Lara Şirinyalı Mah. 655. Sk. No:18, Muratpaşa / Antalya",
    rooms: 3,
    m2: 120,
    floor: "2/4",
    age: "10 yaş",
    price: 28000,
    detail: "Plaja 400 m, klima, eşyalı. Sezonluk veya yıllık kiralık.",
    photos: [
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=900&q=70",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=600&q=70",
      "https://images.unsplash.com/photo-1600607687644-c7171b42498b?auto=format&fit=crop&w=600&q=70",
    ],
  },
  {
    kind: "sale",
    title: "Denize sıfır 4+1",
    address: "Konyaaltı Atatürk Blv. No:210, Antalya",
    rooms: 4,
    m2: 185,
    floor: "9/10",
    age: "3 yaş",
    price: 16800000,
    detail: "Panoramik deniz manzarası, akıllı ev, 2 otopark.",
    photos: [
      "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=900&q=70",
      "https://images.unsplash.com/photo-1600573472592-401b489a3cdc?auto=format&fit=crop&w=600&q=70",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=600&q=70",
    ],
  },
  {
    kind: "rent",
    title: "Merkezi 2+1",
    address: "Beşiktaş Barbaros Bulvarı No:76, İstanbul",
    rooms: 2,
    m2: 85,
    floor: "6/11",
    age: "20 yaş",
    price: 39000,
    detail: "Metrobüse 3 dk, asansör, doğalgaz. İşlek caddeye cephe.",
    photos: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=70",
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=600&q=70",
      "https://images.unsplash.com/photo-1552321554-5fefe8c9ef88?auto=format&fit=crop&w=600&q=70",
    ],
  },
  {
    kind: "sale",
    title: "Tarihi ev restore",
    address: "Cunda Hüseyin Avni Sokak No:5, Ayvalık / Balıkesir",
    rooms: 3,
    m2: 110,
    floor: "Müstakil",
    age: "Restore",
    price: 8900000,
    detail: "Taş ev, avlu, deniz manzarası. Turizm imarlı.",
    photos: [
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=900&q=70",
      "https://images.unsplash.com/photo-1600585154084-4e5fe7c39198?auto=format&fit=crop&w=600&q=70",
      "https://images.unsplash.com/photo-1600047509358-9dc75507daeb?auto=format&fit=crop&w=600&q=70",
    ],
  },
];

function homeKindLabel(kind) {
  return kind === "sale" ? "Satılık" : "Kiralık";
}

function homePrice(item) {
  return item.kind === "rent" ? `${formatTry(item.price)} / ay` : formatTry(item.price);
}

function renderHomes() {
  renderBookings("homes", "#homeList", "Kayıtlı ilan yok.");
}

function renderHomeResults(list) {
  const box = $("#homeResults");
  if (!list.length) {
    box.innerHTML = "<p class='hint'>Bu adreste ilan yok. Semt veya şehir adını değiştirin.</p>";
    return;
  }
  box.innerHTML = list
    .map((item) => {
      const photos = (item.photos || []).map((src, i) => `<img src="${src}" alt="" loading="lazy" />`).join("");
      const q = encodeURIComponent(`${item.address} ${item.title} emlak`);
      return `
        <article class="holiday-hit">
          <span class="holiday-best">${homeKindLabel(item.kind)}</span>
          <div class="home-photos">${photos}</div>
          <strong>${escapeHtml(item.title)}</strong>
          <p class="hint">${escapeHtml(item.address)}</p>
          <p class="hint">${item.rooms}+1 · ${item.m2} m² · ${escapeHtml(item.floor)} · ${escapeHtml(item.age)}</p>
          <p>${escapeHtml(item.detail)}</p>
          <p class="price">${homePrice(item)}</p>
          <div class="row">
            <a class="primary" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}" rel="noopener noreferrer">Harita</a>
            <a class="secondary" href="https://www.google.com/search?q=${q}" rel="noopener noreferrer">İlan ara</a>
            <button class="gold" type="button" data-home-pick="${escapeHtml(item.title)}" data-home-detail="${escapeHtml(item.address)} · ${homePrice(item)}">Kaydet</button>
          </div>
        </article>`;
    })
    .join("");
}

$("#homeSearch").addEventListener("submit", (event) => {
  event.preventDefault();
  resumeMarkSearch("homes");
  const kind = $("#homeKind").value;
  const rooms = $("#homeRooms").value;
  const q = $("#homeAddress").value.trim().toLocaleLowerCase("tr-TR");
  const hits = HOME_LISTINGS.filter((item) => {
    const kindOk = kind === "all" || item.kind === kind;
    const roomOk = rooms === "all" || String(item.rooms) === rooms || (rooms === "4" && item.rooms >= 4);
    const addrOk =
      !q ||
      item.address.toLocaleLowerCase("tr-TR").includes(q) ||
      item.title.toLocaleLowerCase("tr-TR").includes(q);
    return kindOk && roomOk && addrOk;
  }).sort(byPrice($("#homeSort").value, (item) => item.price));
  renderHomeResults(hits);
});

$("#homeResults").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-home-pick]");
  if (!btn) return;
  const items = store.get("homes", []);
  items.unshift({
    id: Date.now(),
    title: btn.dataset.homePick,
    detail: btn.dataset.homeDetail,
  });
  store.set("homes", items);
  renderHomes();
});

const BIKE_RENTALS = [
  { company: "Antalya Bike Rent", bike: "Honda PCX 125", cls: "scooter", city: "Antalya", daily: 650, img: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=70" },
  { company: "Lara Scooter", bike: "Yamaha NMAX 155", cls: "scooter", city: "Lara, Antalya", daily: 720, img: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=900&q=70" },
  { company: "Bodrum Motor", bike: "Vespa Primavera 150", cls: "scooter", city: "Bodrum", daily: 890, img: "https://images.unsplash.com/photo-1519751138087-5bf79dfbc860?auto=format&fit=crop&w=900&q=70" },
  { company: "İstanbul Ride", bike: "Honda Forza 250", cls: "scooter", city: "İstanbul", daily: 980, img: "https://images.unsplash.com/photo-1449426468159-d96dbf6434b1?auto=format&fit=crop&w=900&q=70" },
  { company: "Ege Moto", bike: "Kawasaki Z400", cls: "naked", city: "İzmir", daily: 1450, img: "https://images.unsplash.com/photo-1558981403-ab5ca641f0b4?auto=format&fit=crop&w=900&q=70" },
  { company: "Ankara Motosiklet", bike: "Yamaha MT-07", cls: "naked", city: "Ankara", daily: 1680, img: "https://images.unsplash.com/photo-1558981359-219d6364c9c8?auto=format&fit=crop&w=900&q=70" },
  { company: "Kapadokya Ride", bike: "Honda CB500X", cls: "adventure", city: "Kapadokya, Nevşehir", daily: 1750, img: "https://images.unsplash.com/photo-1558980664-2506fca6bfc2?auto=format&fit=crop&w=900&q=70" },
  { company: "Fethiye Adventure", bike: "BMW G 310 GS", cls: "adventure", city: "Fethiye", daily: 1890, img: "https://images.unsplash.com/photo-1609630875171-b162ee3f9790?auto=format&fit=crop&w=900&q=70" },
  { company: "Alanya Sport", bike: "Yamaha R3", cls: "sport", city: "Alanya", daily: 1950, img: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=900&h=600&q=70" },
  { company: "İstanbul Ride", bike: "Kawasaki Ninja 400", cls: "sport", city: "İstanbul", daily: 2200, img: "https://images.unsplash.com/photo-1558981403-c5f9899a195e?auto=format&fit=crop&w=900&q=70" },
  { company: "Marmaris Moto", bike: "Honda Activa 125", cls: "scooter", city: "Marmaris", daily: 480, img: "https://images.unsplash.com/photo-1591637336763-3c6d143ad2b2?auto=format&fit=crop&w=900&q=70" },
  { company: "Çeşme Motors", bike: "Piaggio Medley 150", cls: "scooter", city: "Çeşme", daily: 760, img: "https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?auto=format&fit=crop&w=900&q=70" },
  { company: "Bodrum Motor", bike: "Ducati Monster", cls: "naked", city: "Bodrum", daily: 2850, img: "https://images.unsplash.com/photo-1568772585417-0aa74b3d6d0c?auto=format&fit=crop&w=900&q=70" },
  { company: "Antalya Bike Rent", bike: "Honda Africa Twin", cls: "adventure", city: "Antalya", daily: 3200, img: "https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?auto=format&fit=crop&w=900&h=500&q=70" },
];

function bikeClassLabel(cls) {
  return { scooter: "Scooter", naked: "Naked", adventure: "Adventure", sport: "Sport" }[cls] || cls;
}

function renderBikes() {
  renderBookings("bikes", "#bikeList", "Kiralama kaydı yok.");
}

function renderBikeResults(list, days) {
  const box = $("#bikeResults");
  if (!list.length) {
    box.innerHTML = "<p class='hint'>Bu yerde uygun motor yok. Başka bir şehir yazın.</p>";
    return;
  }
  box.innerHTML = list
    .map((item, index) => {
      const total = item.daily * days;
      const q = encodeURIComponent(`${item.company} ${item.bike} kiralama ${item.city}`);
      return `
        <article class="holiday-hit${index === 0 ? " best" : ""}">
          ${index === 0 ? "<span class='holiday-best'>En uygun</span>" : ""}
          <img class="holiday-photo" src="${item.img}" alt="${escapeHtml(item.bike)}" loading="lazy" />
          <strong>${escapeHtml(item.bike)}</strong>
          <p class="hint">${escapeHtml(item.company)} · ${escapeHtml(bikeClassLabel(item.cls))} · ${escapeHtml(item.city)}</p>
          <p class="price">Ort. ${formatTry(item.daily)} / gün · ${days} gün</p>
          <p class="price">Toplam yaklaşık ${formatTry(total)}</p>
          <div class="row">
            <a class="primary" href="https://www.google.com/search?q=${q}" rel="noopener noreferrer">Kiralamayı aç</a>
            <button class="secondary" type="button" data-bike-pick="${escapeHtml(item.bike)}" data-bike-detail="${escapeHtml(item.company)} · ${escapeHtml(item.city)} · ${days} gün · ${formatTry(total)}">Kaydet</button>
          </div>
        </article>`;
    })
    .join("");
}

$("#bikeSearch").addEventListener("submit", (event) => {
  event.preventDefault();
  resumeMarkSearch("bikes");
  const city = $("#bikeCity").value.trim().toLocaleLowerCase("tr-TR");
  const cls = $("#bikeClass").value;
  const days = Math.min(30, Math.max(1, Number($("#bikeDays").value) || 2));
  $("#bikeDays").value = String(days);
  const hits = BIKE_RENTALS.filter((item) => {
    const classOk = cls === "all" || item.cls === cls;
    const cityOk =
      !city ||
      item.city.toLocaleLowerCase("tr-TR").includes(city) ||
      item.company.toLocaleLowerCase("tr-TR").includes(city);
    return classOk && cityOk;
  }).sort(byPrice($("#bikeSort").value, (item) => item.daily));
  renderBikeResults(hits, days);
});

$("#bikeResults").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-bike-pick]");
  if (!btn) return;
  const items = store.get("bikes", []);
  items.unshift({
    id: Date.now(),
    title: btn.dataset.bikePick,
    detail: btn.dataset.bikeDetail,
  });
  store.set("bikes", items);
  renderBikes();
});

const GK_MEMBERS = "gk-members";
const GK_PRODUCTS = "gk-products";
const GK_ORDERS = "gk-orders";
const GK_CART = "gk-cart";
const GK_INTEG = "gk-integrations";
const GK_SESSION = "gk-session";
const GK_ADMIN_ON = "gk-admin-on";
const GK_ADMIN_REMEMBER = "gk-admin-remember";
const GK_LAST_TAB = "gk-last-tab";
const GK_ADMIN_USER = "superadmin";
const GK_ADMIN_PIN = "HarbiAdmin2026";
const GK_COMMISSION = 0.05;
const GK_CARGO = {
  yurtici: "Yurtiçi Kargo",
  aras: "Aras Kargo",
  mng: "MNG Kargo",
  ptt: "PTT Kargo",
  surat: "Sürat Kargo",
};
const GK_PHOTO =
  "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=70";

function gkDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function gkIban(value) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function gkValidTc(value) {
  const tc = gkDigits(value);
  if (!/^[1-9]\d{10}$/.test(tc)) return false;
  const d = [...tc].map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  if (((odd * 7 - even) % 10 + 10) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

function gkValidIban(value) {
  return /^TR\d{24}$/.test(gkIban(value));
}

function gkFee(amount) {
  const gross = Number(amount) || 0;
  const commission = Math.round(gross * GK_COMMISSION * 100) / 100;
  const net = Math.round((gross - commission) * 100) / 100;
  return { gross, commission, net };
}

function gkUpdateCommissionHint() {
  const el = $("#gkCommissionHint");
  if (!el) return;
  const price = parseMoney($("#gkProdPrice")?.value);
  if (!Number.isFinite(price) || price <= 0 || price === Number.POSITIVE_INFINITY) {
    el.textContent =
      "Ürününüz satılmadan önce: her satıştan %5 komisyon otomatik kesilir. Kalan %95 ertesi gün IBAN’ınıza yatırılır.";
    return;
  }
  const fee = gkFee(price);
  el.textContent = `Bu fiyattan satışta %5 komisyon ${formatTry(fee.commission)} kesilir. IBAN’ınıza ${formatTry(fee.net)} yatırılır.`;
}

function gkMaskIban(value) {
  const iban = gkIban(value);
  if (iban.length < 8) return iban || "—";
  return `${iban.slice(0, 4)} **** ${iban.slice(-4)}`;
}

function gkNextPayoutAt(from = Date.now()) {
  const day = new Date(from);
  day.setDate(day.getDate() + 1);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

function gkPayoutText(order) {
  const fee = order.commission != null && order.payoutAmount != null
    ? { commission: order.commission, net: order.payoutAmount }
    : gkFee(order.amount);
  if (order.payoutStatus === "yatırıldı") {
    return `IBAN’a yatırıldı ${formatTry(fee.net)} (%5 komisyon ${formatTry(fee.commission)}) · ${gkMaskIban(order.payoutIban)} · ${new Date(order.payoutDoneAt).toLocaleString("tr-TR")}`;
  }
  if (order.payoutStatus === "iban-bekleniyor") {
    return "Ödeme bekliyor: satıcı IBAN kaydı zorunlu.";
  }
  const when = order.payoutAt ? new Date(order.payoutAt).toLocaleDateString("tr-TR") : "ertesi gün";
  return `Ödeme ${when} tarihinde IBAN’a ${formatTry(fee.net)} yatırılacak · %5 komisyon ${formatTry(fee.commission)} kesildi`;
}

function gkProcessPayouts() {
  const now = Date.now();
  const members = store.get(GK_MEMBERS, []);
  let changed = false;
  const orders = store.get(GK_ORDERS, []).map((order) => {
    const sold = order.status === "Ödendi" || String(order.status || "").startsWith("Kargoda");
    if (!sold) return order;
    const next = { ...order };
    const fee = gkFee(next.amount);
    if (next.commission == null || next.payoutAmount == null) {
      next.commission = fee.commission;
      next.payoutAmount = fee.net;
      changed = true;
    }
    if (next.payoutStatus === "yatırıldı") return next;
    if (!next.payoutAt) {
      next.payoutAt = gkNextPayoutAt(next.id || now);
      changed = true;
    }
    const seller = members.find((m) => m.id === next.sellerId);
    const iban = next.sellerIban || seller?.iban;
    if (!gkValidIban(iban)) {
      if (next.payoutStatus !== "iban-bekleniyor") {
        next.payoutStatus = "iban-bekleniyor";
        changed = true;
      }
      return next;
    }
    if (now < next.payoutAt) {
      if (next.payoutStatus !== "bekliyor") {
        next.payoutStatus = "bekliyor";
        next.sellerIban = gkIban(iban);
        changed = true;
      }
      return next;
    }
    changed = true;
    next.payoutStatus = "yatırıldı";
    next.payoutDoneAt = now;
    next.payoutIban = gkIban(iban);
    next.sellerIban = gkIban(iban);
    return next;
  });
  if (changed) store.set(GK_ORDERS, orders);
  return changed;
}

function gkProfileOk(member) {
  return Boolean(member && gkValidTc(member.tc) && String(member.address || "").trim() && gkValidIban(member.iban));
}

function gkSaveMember(next) {
  store.set(
    GK_MEMBERS,
    store.get(GK_MEMBERS, []).map((m) => (m.id === next.id ? next : m))
  );
}

function gkIntegrations() {
  return (
    store.get(GK_INTEG, null) || {
      pos: { provider: "demo", merchant: "", key: "", secret: "", active: false },
      cargo: { yurtici: "", aras: "", mng: "", ptt: "", surat: "" },
    }
  );
}

function gkMember() {
  const id = store.get(GK_SESSION, null);
  return store.get(GK_MEMBERS, []).find((m) => m.id === id) || null;
}

function gkIsAdmin() {
  return store.get(GK_ADMIN_ON, false) === true;
}

function gkRememberedAdmin() {
  return store.get(GK_ADMIN_REMEMBER, null);
}

function gkFillAdminForm() {
  const saved = gkRememberedAdmin();
  const remember = Boolean(saved?.remember);
  $("#gkAdminRemember").checked = saved ? remember : true;
  if (remember && saved?.user) $("#gkAdminUser").value = saved.user;
  if (remember && saved?.pin) $("#gkAdminPin").value = saved.pin;
}

function gkShow(id) {
  ["gkShop", "gkCart", "gkAuth", "gkSeller", "gkBuy", "gkAdminLogin", "gkAdminPanel"].forEach((key) => {
    const el = $("#" + key);
    if (el) el.hidden = key !== id;
  });
}

function gkCartItems() {
  return store.get(GK_CART, []);
}

function gkCartCount() {
  return gkCartItems().reduce((n, item) => n + Math.max(1, Number(item.qty) || 1), 0);
}

function gkRenderCartBadge() {
  const btn = $("#gkCartTabBtn");
  if (!btn) return;
  const n = gkCartCount();
  btn.textContent = n ? `Alışveriş Sepeti (${n})` : "Alışveriş Sepeti";
}

function gkSetCart(items) {
  store.set(GK_CART, items);
  gkRenderCartBadge();
}

function gkAddToCart(productId) {
  const items = gkCartItems();
  const hit = items.find((item) => String(item.productId) === String(productId));
  if (hit) hit.qty = Math.min(99, Math.max(1, Number(hit.qty) || 1) + 1);
  else items.push({ productId, qty: 1 });
  gkSetCart(items);
}

function gkCartLines() {
  const products = store.get(GK_PRODUCTS, []);
  return gkCartItems()
    .map((line) => {
      const product = products.find((item) => String(item.id) === String(line.productId));
      return product ? { product, qty: Math.max(1, Number(line.qty) || 1) } : null;
    })
    .filter(Boolean);
}

function renderGkCart() {
  gkRenderCartBadge();
  const items = gkCartLines();
  const box = $("#gkCartList");
  if (!box) return;
  if (!items.length) {
    box.innerHTML = "<p class='hint'>Sepetiniz boş. Vitrinden sepete ekleyin.</p>";
    $("#gkCartTotal").textContent = "";
    if ($("#gkCartCheckout")) $("#gkCartCheckout").disabled = true;
    return;
  }
  if ($("#gkCartCheckout")) $("#gkCartCheckout").disabled = false;
  const total = items.reduce((sum, line) => sum + parseMoney(line.product.price) * line.qty, 0);
  box.innerHTML = items
    .map(
      (line) => `
      <article class="note">
        <strong>${escapeHtml(line.product.name)}</strong>
        <p class="price">${formatTry(parseMoney(line.product.price))} × ${line.qty} = ${formatTry(parseMoney(line.product.price) * line.qty)}</p>
        <div class="row">
          <button class="secondary" type="button" data-gk-qty="${line.product.id}" data-delta="-1">−</button>
          <button class="secondary" type="button" data-gk-qty="${line.product.id}" data-delta="1">+</button>
          <button class="linkish" type="button" data-gk-cart-del="${line.product.id}">Kaldır</button>
        </div>
      </article>`
    )
    .join("");
  $("#gkCartTotal").textContent = `Toplam ${formatTry(total)}`;
}

function renderGkShop() {
  const dir = $("#gkShopSort")?.value || "asc";
  const products = [...store.get(GK_PRODUCTS, [])].sort(byPrice(dir, (p) => parseMoney(p.price)));
  const members = store.get(GK_MEMBERS, []);
  const box = $("#gkShopList");
  if (!products.length) {
    box.innerHTML = "<p class='hint'>Henüz ürün yok. Üye olup ilk ürünü ekleyin.</p>";
    return;
  }
  box.innerHTML = products
    .map((item) => {
      const seller = members.find((m) => m.id === item.sellerId);
      return `
        <article class="holiday-hit">
          <img class="gk-photo" src="${escapeHtml(item.photo || GK_PHOTO)}" alt="" loading="lazy" />
          <strong>${escapeHtml(item.name)}</strong>
          <p class="hint">${escapeHtml(seller?.name || "Üye")} · ${escapeHtml(GK_CARGO[item.cargo] || "")}</p>
          <p>${escapeHtml(item.desc || "")}</p>
          <p class="price">${formatTry(parseMoney(item.price))}</p>
          <div class="row">
            <button class="secondary" type="button" data-gk-cart="${item.id}">Sepete ekle</button>
            <button class="gold" type="button" data-gk-buy="${item.id}">Satın al</button>
          </div>
        </article>`;
    })
    .join("");
}

function renderGkSeller() {
  const me = gkMember();
  if (!me) return;
  gkProcessPayouts();
  $("#gkSellerHello").textContent = `${me.name} · kargo: ${GK_CARGO[me.cargo] || me.cargo} · satışta %5 komisyon`;
  gkUpdateCommissionHint();
  $("#gkProfTc").value = me.tc || "";
  $("#gkProfAddress").value = me.address || "";
  $("#gkProfIban").value = me.iban || "";
  $("#gkProdCargo").value = me.cargo || "yurtici";
  const mine = store.get(GK_PRODUCTS, []).filter((p) => p.sellerId === me.id);
  $("#gkMyProducts").innerHTML = mine
    .map(
      (item) => `
      <article class="holiday-hit">
        <img class="gk-photo" src="${escapeHtml(item.photo || GK_PHOTO)}" alt="" />
        <strong>${escapeHtml(item.name)}</strong>
        <p class="price">${formatTry(parseMoney(item.price))}</p>
        <button class="linkish" type="button" data-gk-del="${item.id}">Kaldır</button>
      </article>`
    )
    .join("") || "<p class='hint'>Ürününüz yok.</p>";
  const orders = store.get(GK_ORDERS, []).filter((o) => o.sellerId === me.id);
  $("#gkSellerOrders").innerHTML = orders
    .map(
      (o) => `
      <article class="note">
        <strong>${escapeHtml(o.productName)}</strong>
        <p>${escapeHtml(o.buyerName)} · ${escapeHtml(o.address)} · satış ${formatTry(o.amount)} · net ${formatTry(o.payoutAmount != null ? o.payoutAmount : gkFee(o.amount).net)}</p>
        <p class="hint">${escapeHtml(o.status)}${o.tracking ? " · " + escapeHtml(o.tracking) : ""}</p>
        <p class="hint">${escapeHtml(gkPayoutText(o))}</p>
        ${
          o.status === "Ödendi"
            ? `<select data-gk-ship-cargo="${o.id}">
                ${Object.entries(GK_CARGO)
                  .map(([k, n]) => `<option value="${k}" ${k === o.cargo ? "selected" : ""}>${n}</option>`)
                  .join("")}
              </select>
              <button class="gold" type="button" data-gk-ship="${o.id}">Kargoya ver</button>`
            : ""
        }
      </article>`
    )
    .join("") || "<p class='hint'>Sipariş yok.</p>";
}

function renderGkAdmin() {
  gkProcessPayouts();
  posEnsureGateway();
  const integ = gkIntegrations();
  $("#gkPosProvider").value = integ.pos.provider || "demo";
  $("#gkPosMerchant").value = integ.pos.merchant || "";
  $("#gkPosKey").value = integ.pos.key || "";
  $("#gkPosSecret").value = integ.pos.secret || "";
  $("#gkPosOn").checked = Boolean(integ.pos.active);
  $("#gkCargoYurtici").value = integ.cargo.yurtici || "";
  $("#gkCargoAras").value = integ.cargo.aras || "";
  $("#gkCargoMng").value = integ.cargo.mng || "";
  $("#gkCargoPtt").value = integ.cargo.ptt || "";
  $("#gkCargoSurat").value = integ.cargo.surat || "";
  const members = store.get(GK_MEMBERS, []);
  const box = $("#gkAdminPayouts");
  if (box) {
    const rows = store.get(GK_ORDERS, []);
    const commissionSum = rows.reduce((n, o) => n + (o.commission != null ? o.commission : gkFee(o.amount).commission), 0);
    box.innerHTML = (rows.length ? `<p class="hint">Toplam kesilen komisyon: ${formatTry(commissionSum)}</p>` : "") + (rows.length
      ? rows
          .map((o) => {
            const seller = members.find((m) => m.id === o.sellerId);
            const fee = o.commission != null ? o : gkFee(o.amount);
            return `<article class="note">
              <strong>${escapeHtml(o.productName)} · satış ${formatTry(o.amount)}</strong>
              <p>${escapeHtml(seller?.name || "Satıcı")} · ${escapeHtml(gkMaskIban(o.payoutIban || o.sellerIban || seller?.iban))}</p>
              <p class="hint">Komisyon %5 ${formatTry(fee.commission || o.commission)} · satıcıya ${formatTry(o.payoutAmount != null ? o.payoutAmount : gkFee(o.amount).net)}</p>
              <p class="hint">${escapeHtml(gkPayoutText(o))}</p>
            </article>`;
          })
          .join("")
      : "<p class='hint'>Henüz satış ödemesi yok.</p>");
  }
}

function gkHasAccount() {
  return store.get(GK_MEMBERS, []).length > 0;
}

function gkSyncAuthUi() {
  const joined = gkHasAccount();
  const me = gkMember();
  const registerCard = $("#gkRegisterCard");
  const authTab = $("#gkAuthTabBtn");
  if (registerCard) registerCard.hidden = joined;
  if (authTab) {
    authTab.hidden = Boolean(me);
    authTab.textContent = joined ? "Giriş" : "Üye ol / Giriş";
  }
}

function renderGk() {
  gkProcessPayouts();
  const me = gkMember();
  $("#gkSellerTab").hidden = !me;
  gkSyncAuthUi();
  gkFillAdminForm();
  gkRenderCartBadge();
  renderGkShop();
  const last = store.get(GK_LAST_TAB, "shop");
  if (last === "auth" && me) {
    gkOpenTab("seller", { silent: true });
    return;
  }
  if (last) gkOpenTab(last, { silent: true });
}

function gkOpenTab(tab, opts = {}) {
  if (!opts.silent) gkMsg("");
  store.set(GK_LAST_TAB, tab);
  if (tab === "shop") gkShow("gkShop");
  if (tab === "cart") {
    renderGkCart();
    gkShow("gkCart");
  }
  if (tab === "auth") {
    if (gkMember()) {
      renderGkSeller();
      gkShow("gkSeller");
      store.set(GK_LAST_TAB, "seller");
      return;
    }
    gkSyncAuthUi();
    gkShow("gkAuth");
  }
  if (tab === "seller") {
    if (!gkMember()) {
      gkShow("gkAuth");
      if (!opts.silent) gkMsg("Satış için üye girişi yapın.");
      return;
    }
    renderGkSeller();
    gkShow("gkSeller");
  }
  if (tab === "adminLogin") {
    if (gkIsAdmin()) {
      renderGkAdmin();
      gkShow("gkAdminPanel");
    } else {
      gkFillAdminForm();
      gkShow("gkAdminLogin");
    }
  }
}

$("#gkNav").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-gk-tab]");
  if (btn) gkOpenTab(btn.dataset.gkTab);
});

$("#gkShopSort")?.addEventListener("change", renderGkShop);

$("#gkRegister").addEventListener("submit", (event) => {
  event.preventDefault();
  const phone = $("#gkRegPhone").value.trim();
  const tc = gkDigits($("#gkRegTc").value);
  const address = $("#gkRegAddress").value.trim();
  const iban = gkIban($("#gkRegIban").value);
  const members = store.get(GK_MEMBERS, []);
  if (members.some((m) => m.phone === phone)) {
    gkMsg("Bu telefon kayıtlı. Giriş yapın.");
    return;
  }
  if (!gkValidTc(tc)) {
    gkMsg("Geçerli bir TC kimlik no girin.");
    return;
  }
  if (!address) {
    gkMsg("Adres zorunludur.");
    return;
  }
  if (!gkValidIban(iban)) {
    gkMsg("Geçerli bir TR IBAN girin.");
    return;
  }
  if (members.some((m) => gkDigits(m.tc) === tc)) {
    gkMsg("Bu TC kimlik no kayıtlı.");
    return;
  }
  const member = {
    id: Date.now(),
    name: $("#gkRegName").value.trim(),
    phone,
    tc,
    address,
    iban,
    pin: $("#gkRegPin").value,
    cargo: $("#gkRegCargo").value,
  };
  members.unshift(member);
  store.set(GK_MEMBERS, members);
  store.set(GK_SESSION, member.id);
  gkMsg("Üyeliğiniz açıldı.");
  $("#gkRegister").reset();
  renderGk();
  gkOpenTab("seller");
});

$("#gkLogin").addEventListener("submit", (event) => {
  event.preventDefault();
  const phone = $("#gkLoginPhone").value.trim();
  const pin = $("#gkLoginPin").value;
  const member = store.get(GK_MEMBERS, []).find((m) => m.phone === phone && m.pin === pin);
  if (!member) {
    gkMsg("Telefon veya şifre hatalı.");
    return;
  }
  store.set(GK_SESSION, member.id);
  gkMsg("");
  renderGk();
  gkOpenTab("seller");
});

$("#gkLogout").addEventListener("click", () => {
  store.set(GK_SESSION, null);
  renderGk();
  gkOpenTab("shop");
});

$("#gkForgotOpen").addEventListener("click", () => {
  $("#gkForgot").hidden = false;
  $("#gkForgotPhone").value = $("#gkLoginPhone").value;
});

$("#gkForgotCancel").addEventListener("click", () => {
  $("#gkForgot").hidden = true;
});

$("#gkForgot").addEventListener("submit", (event) => {
  event.preventDefault();
  const phone = $("#gkForgotPhone").value.trim();
  const tc = gkDigits($("#gkForgotTc").value);
  const pin = $("#gkForgotPin").value;
  if (pin !== $("#gkForgotPin2").value) {
    gkMsg("Yeni şifreler aynı olmalı.");
    return;
  }
  const members = store.get(GK_MEMBERS, []);
  const member = members.find((m) => m.phone === phone && gkDigits(m.tc) === tc);
  if (!member) {
    gkMsg("Telefon ve TC eşleşmedi.");
    return;
  }
  member.pin = pin;
  store.set(GK_MEMBERS, members);
  $("#gkForgot").reset();
  $("#gkForgot").hidden = true;
  gkMsg("Şifreniz güncellendi. Giriş yapın.");
});

$("#gkProfileForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const me = gkMember();
  if (!me) return;
  const tc = gkDigits($("#gkProfTc").value);
  const address = $("#gkProfAddress").value.trim();
  const iban = gkIban($("#gkProfIban").value);
  if (!gkValidTc(tc)) {
    gkMsg("Geçerli bir TC kimlik no girin.");
    return;
  }
  if (!address) {
    gkMsg("Adres zorunludur.");
    return;
  }
  if (!gkValidIban(iban)) {
    gkMsg("Geçerli bir TR IBAN girin.");
    return;
  }
  const taken = store.get(GK_MEMBERS, []).some((m) => m.id !== me.id && gkDigits(m.tc) === tc);
  if (taken) {
    gkMsg("Bu TC kimlik no kayıtlı.");
    return;
  }
  me.tc = tc;
  me.address = address;
  me.iban = iban;
  gkSaveMember(me);
  store.set(
    GK_ORDERS,
    store.get(GK_ORDERS, []).map((o) =>
      o.sellerId === me.id && o.payoutStatus !== "yatırıldı" ? { ...o, sellerIban: iban } : o
    )
  );
  gkMsg("Üye bilgileri kaydedildi.");
  renderGkSeller();
});

$("#gkPassForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const me = gkMember();
  if (!me) return;
  if ($("#gkPassOld").value !== me.pin) {
    gkMsg("Mevcut şifre hatalı.");
    return;
  }
  const next = $("#gkPassNew").value;
  if (next !== $("#gkPassNew2").value) {
    gkMsg("Yeni şifreler aynı olmalı.");
    return;
  }
  me.pin = next;
  gkSaveMember(me);
  $("#gkPassForm").reset();
  gkMsg("Şifreniz değiştirildi.");
});

$("#gkProductForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const me = gkMember();
  if (!me) return;
  if (!gkProfileOk(me)) {
    gkMsg("Ürün eklemek için TC, adres ve IBAN zorunludur.");
    return;
  }
  if (!$("#gkCommissionOk").checked) {
    gkMsg("Ürünü satışa koymadan önce %5 komisyonu kabul etmeniz gerekir.");
    return;
  }
  const products = store.get(GK_PRODUCTS, []);
  products.unshift({
    id: Date.now(),
    sellerId: me.id,
    name: $("#gkProdName").value.trim(),
    price: $("#gkProdPrice").value.trim(),
    photo: $("#gkProdPhoto").value.trim(),
    desc: $("#gkProdDesc").value.trim(),
    cargo: $("#gkProdCargo").value,
    commissionRate: GK_COMMISSION,
  });
  store.set(GK_PRODUCTS, products);
  me.cargo = $("#gkProdCargo").value;
  const members = store.get(GK_MEMBERS, []).map((m) => (m.id === me.id ? me : m));
  store.set(GK_MEMBERS, members);
  $("#gkProductForm").reset();
  renderGkSeller();
  renderGkShop();
});

$("#gkProdPrice")?.addEventListener("input", gkUpdateCommissionHint);

$("#gkMyProducts").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-gk-del]");
  if (!btn) return;
  store.set(
    GK_PRODUCTS,
    store.get(GK_PRODUCTS, []).filter((p) => String(p.id) !== btn.dataset.gkDel)
  );
  renderGkSeller();
  renderGkShop();
});

let gkBuyId = null;
let gkCheckoutCart = false;

function gkOrderFromProduct(product, qty, buyer) {
  const seller = store.get(GK_MEMBERS, []).find((m) => m.id === product.sellerId);
  const amount = parseMoney(product.price) * Math.max(1, qty);
  const fee = gkFee(amount);
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    productId: product.id,
    productName: product.name,
    sellerId: product.sellerId,
    amount,
    commission: fee.commission,
    payoutAmount: fee.net,
    qty: Math.max(1, qty),
    buyerName: buyer.name,
    buyerPhone: buyer.phone,
    address: buyer.address,
    cargo: product.cargo,
    status: "Ödendi",
    tracking: "",
    pos: buyer.pos,
    sellerIban: gkIban(seller?.iban || ""),
    payoutAt: gkNextPayoutAt(),
    payoutStatus: gkValidIban(seller?.iban) ? "bekliyor" : "iban-bekleniyor",
  };
}

$("#gkShopList").addEventListener("click", (event) => {
  const cartBtn = event.target.closest("[data-gk-cart]");
  if (cartBtn) {
    const product = store.get(GK_PRODUCTS, []).find((p) => String(p.id) === cartBtn.dataset.gkCart);
    if (!product) return;
    gkAddToCart(product.id);
    gkMsg(`${product.name} sepete eklendi.`);
    return;
  }
  const btn = event.target.closest("[data-gk-buy]");
  if (!btn) return;
  const product = store.get(GK_PRODUCTS, []).find((p) => String(p.id) === btn.dataset.gkBuy);
  if (!product) return;
  gkBuyId = product.id;
  gkCheckoutCart = false;
  $("#gkBuySummary").textContent = `${product.name} · ${formatTry(parseMoney(product.price))}`;
  gkShow("gkBuy");
});

$("#gkCartList").addEventListener("click", (event) => {
  const del = event.target.closest("[data-gk-cart-del]");
  if (del) {
    gkSetCart(gkCartItems().filter((item) => String(item.productId) !== del.dataset.gkCartDel));
    renderGkCart();
    return;
  }
  const qtyBtn = event.target.closest("[data-gk-qty]");
  if (!qtyBtn) return;
  const delta = Number(qtyBtn.dataset.delta) || 0;
  const items = gkCartItems()
    .map((item) => {
      if (String(item.productId) !== qtyBtn.dataset.gkQty) return item;
      return { ...item, qty: Math.max(1, Math.min(99, (Number(item.qty) || 1) + delta)) };
    });
  gkSetCart(items);
  renderGkCart();
});

$("#gkCartClear").addEventListener("click", () => {
  gkSetCart([]);
  renderGkCart();
  gkMsg("Sepet boşaltıldı.");
});

$("#gkCartCheckout").addEventListener("click", () => {
  const items = gkCartLines();
  if (!items.length) {
    gkMsg("Sepet boş.");
    return;
  }
  const total = items.reduce((sum, line) => sum + parseMoney(line.product.price) * line.qty, 0);
  gkBuyId = null;
  gkCheckoutCart = true;
  $("#gkBuySummary").textContent = items
    .map((line) => `${line.product.name} × ${line.qty}`)
    .join(" · ") + ` · Toplam ${formatTry(total)}`;
  gkShow("gkBuy");
});

$("#gkBuyCancel").addEventListener("click", () => {
  const back = gkCheckoutCart ? "cart" : "shop";
  gkBuyId = null;
  gkCheckoutCart = false;
  gkOpenTab(back);
});

$("#gkBuyCardNumber").addEventListener("input", () => {
  const num = $("#gkBuyCardNumber").value.replace(/\D/g, "");
  const brand = posCardBrandFromNumber(num);
  if (brand && [...$("#gkBuyBrand").options].some((o) => o.value === brand)) {
    $("#gkBuyBrand").value = brand;
  }
});

$("#gkBuyExp").addEventListener("input", () => {
  let v = $("#gkBuyExp").value.replace(/\D/g, "").slice(0, 4);
  if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
  $("#gkBuyExp").value = v;
});

$("#gkBuyForm").addEventListener("submit", (event) => {
  event.preventDefault();
  posEnsureGateway();
  const pos = gkIntegrations().pos;
  if (!posPayOn("shop") || !pos.active || !pos.key || !pos.secret) {
    gkMsg("Ürün ödemesi süper admin tarafından kapalı veya anahtar yok.");
    return;
  }
  const num = $("#gkBuyCardNumber").value.replace(/\D/g, "");
  const exp = $("#gkBuyExp").value.trim();
  const cvc = $("#gkBuyCvc").value.replace(/\D/g, "");
  const brand = $("#gkBuyBrand").value;
  if (num.length < 13 || num.length > 19) {
    gkMsg("Geçerli kart numarası girin.");
    return;
  }
  if (!/^\d{2}\/\d{2}$/.test(exp)) {
    gkMsg("Son kullanma AA/YY olsun.");
    return;
  }
  if (cvc.length < 3) {
    gkMsg("CVC girin.");
    return;
  }
  const buyer = {
    name: $("#gkBuyName").value.trim(),
    phone: $("#gkBuyPhone").value.trim(),
    address: $("#gkBuyAddress").value.trim(),
    pos: pos.provider,
  };
  const last4 = num.slice(-4);
  const orders = store.get(GK_ORDERS, []);
  let total = 0;
  let products = "";
  if (gkCheckoutCart) {
    const lines = gkCartLines();
    if (!lines.length) {
      gkMsg("Sepet boş.");
      return;
    }
    lines.forEach((line, index) => {
      const order = gkOrderFromProduct(line.product, line.qty, buyer);
      order.id = Date.now() + index;
      order.payIban = POS_SETTLE.iban;
      order.posKey = pos.key;
      orders.unshift(order);
      total += order.amount;
      products += (products ? " · " : "") + line.product.name;
    });
    gkSetCart([]);
  } else {
    const product = store.get(GK_PRODUCTS, []).find((p) => p.id === gkBuyId);
    if (!product) return;
    const order = gkOrderFromProduct(product, 1, buyer);
    order.payIban = POS_SETTLE.iban;
    order.posKey = pos.key;
    orders.unshift(order);
    total = order.amount;
    products = product.name;
  }
  store.set(GK_ORDERS, orders);
  const shopFee = posFee(total);
  store.set(
    POS_PAYS,
    posPays().concat({
      id: "pay_" + Date.now(),
      phone: gkDigits(buyer.phone),
      name: buyer.name,
      amount: shopFee.gross,
      commission: shopFee.commission,
      net: shopFee.net,
      feeRate: POS_FEE_RATE,
      note: products,
      method: "card",
      detail: "Ürün · " + brand + " · **** " + last4 + " · " + products + " · " + (pos.key || ""),
      apiKey: pos.key,
      settleName: POS_SETTLE.name,
      settleBranch: POS_SETTLE.branch,
      settleIban: POS_SETTLE.iban,
      at: Date.now(),
    })
  );
  gkBuyId = null;
  gkCheckoutCart = false;
  $("#gkBuyForm").reset();
  gkMsg(
    "Kart ödemesi alındı. %0,95 komisyon " +
      formatTry(shopFee.commission) +
      " · net " +
      formatTry(shopFee.net) +
      " Tolkan Uğur IBAN’ına kabul edildi."
  );
  gkOpenTab("shop");
});

$("#gkSellerOrders").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-gk-ship]");
  if (!btn) return;
  const id = Number(btn.dataset.gkShip);
  const select = $(`[data-gk-ship-cargo="${id}"]`);
  const cargo = select?.value || "yurtici";
  const integ = gkIntegrations();
  const connected = Boolean(integ.cargo[cargo]);
  const tracking = (connected ? "API-" : "KRG-") + String(id).slice(-6);
  const orders = store.get(GK_ORDERS, []).map((o) =>
    o.id === id
      ? { ...o, cargo, tracking, status: `Kargoda · ${GK_CARGO[cargo]}` }
      : o
  );
  store.set(GK_ORDERS, orders);
  renderGkSeller();
});

$("#gkAdminForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if ($("#gkAdminUser").value.trim() !== GK_ADMIN_USER || $("#gkAdminPin").value !== GK_ADMIN_PIN) {
    gkMsg("Yönetim bilgileri hatalı.");
    return;
  }
  const remember = $("#gkAdminRemember").checked;
  store.set(GK_ADMIN_ON, true);
  store.set(GK_ADMIN_REMEMBER, remember
    ? { remember: true, user: GK_ADMIN_USER, pin: GK_ADMIN_PIN }
    : { remember: false });
  gkMsg("");
  store.set(GK_LAST_TAB, "adminLogin");
  renderGkAdmin();
  gkShow("gkAdminPanel");
});

$("#gkAdminShowPin").addEventListener("click", () => {
  const pin = $("#gkAdminPin");
  const show = pin.type === "password";
  pin.type = show ? "text" : "password";
  $("#gkAdminShowPin").textContent = show ? "Şifre gizle" : "Şifre göster";
  $("#gkAdminShowPin").setAttribute("aria-pressed", String(show));
});

$("#gkAdminLogout").addEventListener("click", () => {
  store.set(GK_ADMIN_ON, false);
  gkFillAdminForm();
  gkOpenTab("adminLogin");
});

$("#gkPosForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!gkIsAdmin()) return;
  const g = posGateway();
  const integ = gkIntegrations();
  integ.pos = {
    provider: $("#gkPosProvider").value,
    merchant: $("#gkPosMerchant").value.trim() || "HarbiGrup",
    key: $("#gkPosKey").value.trim() || g.apiKey,
    secret: $("#gkPosSecret").value.trim() || g.secretKey,
    active: $("#gkPosOn").checked || Boolean(g.apiKey && g.secretKey),
    settleIban: POS_SETTLE.iban,
  };
  store.set(GK_INTEG, integ);
  posFillKeyInputs();
  gkMsg("POS kaydedildi. Anahtarlar ödeme sisteminde.");
});

$("#gkCargoForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!gkIsAdmin()) return;
  const integ = gkIntegrations();
  integ.cargo = {
    yurtici: $("#gkCargoYurtici").value.trim(),
    aras: $("#gkCargoAras").value.trim(),
    mng: $("#gkCargoMng").value.trim(),
    ptt: $("#gkCargoPtt").value.trim(),
    surat: $("#gkCargoSurat").value.trim(),
  };
  store.set(GK_INTEG, integ);
  gkMsg("Kargo kaydedildi.");
});

setInterval(() => {
  if (gkProcessPayouts() && document.querySelector('.view.active')?.dataset.view === "women") {
    const last = store.get(GK_LAST_TAB, "shop");
    if (last === "seller") renderGkSeller();
    if (last === "adminLogin") renderGkAdmin();
  }
}, 30000);






if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const host = location.hostname;
    const local =
      !host ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    if (!local && host !== "www.tolkanugur.com") return;
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

document.addEventListener("input", (event) => {
  if (!event.target.closest("#views")) return;
  clearTimeout(resumeFieldTimer);
  resumeFieldTimer = setTimeout(resumeSaveFields, 200);
});
document.addEventListener("change", (event) => {
  if (!event.target.closest("#views")) return;
  resumeSaveFields();
});
window.addEventListener(
  "scroll",
  () => {
    clearTimeout(resumeScrollTimer);
    resumeScrollTimer = setTimeout(() => resumeSaveScroll(resumeActiveView()), 150);
  },
  { passive: true }
);
window.addEventListener("pagehide", () => {
  resumeSaveFields();
  resumeSaveCam();
  resumeSaveScroll(resumeActiveView());
});

const POS_MEMBERS = "pos-members";
const POS_PAYS = "pos-pays";
const POS_REMEMBER = "pos-remember";
const POS_ADMIN_ON = "pos-admin-on";
const POS_ADMIN_REMEMBER = "pos-admin-remember";
const POS_ADMIN_PIN_STORE = "pos-admin-pin";
const POS_SETTINGS = "pos-settings";
const POS_SESSION = "pos-session";
const POS_ADMIN_USER = "superadmin";
const POS_ADMIN_PIN = "HarbiAdmin2026";
const POS_GATEWAY = "pos-gateway-keys";
const POS_SETTLE = {
  name: "Tolkan Uğur",
  branch: "Lüleburgaz Şubesi",
  country: "Türkiye Cumhuriyeti",
  iban: "TR54 0006 2000 1110 0006 2920 69",
  ibanRaw: "TR540006200011100006292069",
  ibanMasked: "TR54 0006 2000 1110 0006 ** **",
};
const POS_FEE_RATE = 0.0095;

function posFee(amount) {
  const gross = Math.round((Number(amount) || 0) * 100) / 100;
  const commission = Math.round(gross * POS_FEE_RATE * 100) / 100;
  const net = Math.round((gross - commission) * 100) / 100;
  return { gross, commission, net };
}

function posMaskIban(value) {
  const raw = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (raw.length <= 6) return "******";
  return (raw.slice(0, -6) + "******").replace(/(.{4})/g, "$1 ").trim();
}

function posMembers() {
  return store.get(POS_MEMBERS, []);
}

function posSaveMembers(list) {
  store.set(POS_MEMBERS, list);
}

function posPays() {
  return store.get(POS_PAYS, []);
}

function posIbanOk(value) {
  const raw = String(value || "")
    .toUpperCase()
    .replace(/\s/g, "");
  return /^TR\d{24}$/.test(raw);
}

function posFormatIban(value) {
  const raw = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return raw.replace(/(.{4})/g, "$1 ").trim();
}

function posCardBrandFromNumber(num) {
  if (num.startsWith("4")) return "Visa";
  if (/^5[1-5]/.test(num) || /^2[2-7]/.test(num)) return "Mastercard";
  if (num.startsWith("9792")) return "Troy";
  if (/^3[47]/.test(num)) return "American Express";
  if (num.startsWith("62")) return "UnionPay";
  if (num.startsWith("6")) return "Discover";
  return "";
}

function posCanCharge(method) {
  const member = posMember();
  if (!member || member.status !== "active") {
    posMsg("Yalnızca onaylı üyeler POS kullanabilir.");
    return false;
  }
  if (!posPayOn(method || "global")) {
    posMsg(posSettings().on === false ? "Sanal POS sistemi kapalı." : "Bu ödeme sistemi süper admin tarafından kapatıldı.");
    return false;
  }
  return member;
}

function posRecordPay(extra) {
  const member = posCanCharge(extra.method);
  if (!member) return false;
  const amount = extra.amount;
  if (!Number.isFinite(amount) || amount <= 0) {
    posMsg("Geçerli tutar girin.");
    return false;
  }
  const fee = posFee(amount);
  const pay = {
    id: "pay_" + Date.now(),
    phone: member.phone,
    name: member.name,
    amount: fee.gross,
    commission: fee.commission,
    net: fee.net,
    feeRate: POS_FEE_RATE,
    note: extra.note || "",
    method: extra.method,
    detail: extra.detail || "",
    apiKey: posGateway().apiKey || "",
    settleName: POS_SETTLE.name,
    settleBranch: POS_SETTLE.branch,
    settleIban: POS_SETTLE.iban,
    at: Date.now(),
  };
  store.set(POS_PAYS, posPays().concat(pay));
  posMsg(
    formatTry(fee.gross) +
      " alındı. %0,95 komisyon " +
      formatTry(fee.commission) +
      " · net " +
      formatTry(fee.net) +
      " aktarıldı."
  );
  posRenderDesk();
  return true;
}

function posPayLine(p, who) {
  const method =
    p.method === "iban"
      ? "IBAN"
      : p.method === "card"
        ? "Kredi kartı"
        : p.method === "operator"
          ? "Operatör faturası"
          : p.method === "withdraw"
            ? "Para çek"
            : "Tahsilat";
  const whoLine = who ? `<p>${escapeHtml(who)}</p>` : "";
  const detail = String(p.detail || p.note || "Tahsilat")
    .replace(/2920\s*69/g, "** **")
    .replace(/292069/g, "******");
  const fee = p.commission != null && p.net != null ? { commission: p.commission, net: p.net } : posFee(p.amount);
  return `<article class="note"><header><strong>${escapeHtml(formatTry(p.amount))}</strong><time>${escapeHtml(
    new Date(p.at).toLocaleString("tr-TR")
  )}</time></header>${whoLine}<p>${escapeHtml(method)} · ${escapeHtml(detail)}</p><p class="hint">%0,95 komisyon ${escapeHtml(
    formatTry(fee.commission)
  )} · net ${escapeHtml(formatTry(fee.net))}</p><p class="hint">Aktarım: ${escapeHtml(
    p.settleName || POS_SETTLE.name
  )} · ${escapeHtml(p.settleBranch || POS_SETTLE.branch)} · ${escapeHtml(
    posMaskIban(p.settleIban || POS_SETTLE.iban)
  )}</p></article>`;
}

function posSettings() {
  return {
    on: true,
    withdrawShow: false,
    payIban: true,
    payCard: true,
    payOperator: true,
    payShop: true,
    payWithdraw: true,
    payGkPos: true,
    ...store.get(POS_SETTINGS, {}),
  };
}

function posPayOn(kind) {
  const s = posSettings();
  if (kind !== "global" && s.on === false) return false;
  if (kind === "iban") return s.payIban !== false;
  if (kind === "card") return s.payCard !== false;
  if (kind === "operator") return s.payOperator !== false;
  if (kind === "shop") return s.payShop !== false && s.payGkPos !== false;
  if (kind === "withdraw") return s.payWithdraw !== false;
  if (kind === "gkpos") return s.payGkPos !== false;
  return s.on !== false;
}

function posApplySysFromForm(all) {
  if (!posIsAdmin()) return;
  const on = all == null ? $("#posGlobalOn").checked : all;
  posPatchSettings({
    on,
    payIban: all == null ? $("#posSysIban").checked : all,
    payCard: all == null ? $("#posSysCard").checked : all,
    payShop: all == null ? $("#posSysShop").checked : all,
    payWithdraw: all == null ? $("#posSysWithdraw").checked : all,
    payGkPos: all == null ? $("#posSysGkPos").checked : all,
  });
  posWriteKeysToPay();
  posRenderAdmin();
  posMsg(all === false ? "Tüm ödeme sistemleri kapatıldı." : all === true ? "Tüm ödeme sistemleri açıldı." : "Ödeme sistemi komutları kaydedildi.");
}

function posRenderPaySystems() {
  const s = posSettings();
  const setChk = (id, val) => {
    if ($(id)) $(id).checked = val;
  };
  setChk("#posGlobalOn", s.on !== false);
  setChk("#posSysIban", s.payIban !== false);
  setChk("#posSysCard", s.payCard !== false);
  setChk("#posSysShop", s.payShop !== false);
  setChk("#posSysWithdraw", s.payWithdraw !== false);
  setChk("#posSysGkPos", s.payGkPos !== false);
  const pays = posPays();
  const n = (fn) => pays.filter(fn).length;
  const row = (name, on, extra) =>
    `<article class="note"><header><strong>${escapeHtml(name)}</strong><time>${on ? "Açık" : "Kapalı"}</time></header><p>${escapeHtml(extra)}</p></article>`;
  const g = posGateway();
  const integ = gkIntegrations();
  if ($("#posSysStatus")) {
    $("#posSysStatus").innerHTML = [
      row("Sanal POS genel", s.on !== false, pays.length + " toplam işlem · %0,95 komisyon"),
      row("IBAN ile ödeme", posPayOn("iban"), n((p) => p.method === "iban") + " işlem"),
      row("Kredi kartı", posPayOn("card"), n((p) => p.method === "card") + " işlem"),
      row("Siteden ürün ödemesi", posPayOn("shop"), n((p) => String(p.detail || "").startsWith("Ürün")) + " işlem"),
      row("Para çek", posPayOn("withdraw") && s.withdrawShow, n((p) => p.method === "withdraw") + " işlem"),
      row(
        "Ürün POS entegrasyonu",
        posPayOn("gkpos") && Boolean(integ.pos?.active),
        (integ.pos?.provider || "demo") + " · " + (g.apiKey ? g.apiKey.slice(0, 11) + "…" : "anahtar yok")
      ),
    ].join("");
  }
}

function posPatchSettings(patch) {
  store.set(POS_SETTINGS, { on: true, withdrawShow: false, ...posSettings(), ...patch });
}

function posSyncWithdrawUi() {
  const show = posIsAdmin() && posSettings().withdrawShow === true;
  const card = $("#posWithdrawCard");
  const btn = $("#posWithdrawToggle");
  if (card) card.hidden = !show;
  if (btn) {
    btn.hidden = !posIsAdmin();
    btn.textContent = show ? "Para çek alanını gizle" : "Para çek alanını göster";
    btn.setAttribute("aria-pressed", String(show));
  }
  if ($("#posWithdrawTarget")) $("#posWithdrawTarget").value = POS_SETTLE.ibanMasked;
  if ($("#posSettleIban")) $("#posSettleIban").value = POS_SETTLE.ibanMasked;
}

function posMsg(text) {
  const el = $("#posMsg");
  if (el) el.textContent = text || "";
}

function posPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function posTogglePins(ids, btn) {
  const show = $(ids[0]).type === "password";
  ids.forEach((id) => {
    $(id).type = show ? "text" : "password";
  });
  btn.textContent = show ? "Şifreleri gizle" : "Şifreleri göster";
  btn.setAttribute("aria-pressed", String(show));
}

function posRememberGet() {
  return store.get(POS_REMEMBER, null);
}

function posRememberSave(login, pin, on) {
  if (on) store.set(POS_REMEMBER, { login, pin });
  else store.set(POS_REMEMBER, null);
}

function posFillRemember() {
  const saved = posRememberGet();
  if (!saved) return;
  if ($("#posLoginPhone") && saved.login) $("#posLoginPhone").value = saved.login;
  if ($("#posLoginPin") && saved.pin) $("#posLoginPin").value = saved.pin;
  if ($("#posLoginRemember")) $("#posLoginRemember").checked = true;
  if ($("#posRegRemember")) $("#posRegRemember").checked = true;
}

function posAdminPinValue() {
  const saved = store.get(POS_ADMIN_PIN_STORE, "");
  return saved || POS_ADMIN_PIN;
}

function posFillAdminRemember() {
  const saved = store.get(POS_ADMIN_REMEMBER, null);
  const remember = Boolean(saved?.remember);
  if ($("#posAdminRemember")) $("#posAdminRemember").checked = saved ? remember : true;
  if (remember && saved?.user && $("#posAdminUser")) $("#posAdminUser").value = saved.user;
  if (remember && saved?.pin && $("#posAdminPin")) $("#posAdminPin").value = saved.pin;
}

function posSession() {
  return store.get(POS_SESSION, null);
}

function posMember() {
  const session = posSession();
  if (!session?.phone) return null;
  return posMembers().find((m) => m.phone === session.phone) || null;
}

function posIsAdmin() {
  return store.get(POS_ADMIN_ON, false) === true;
}

function posMakeKeys() {
  const raw = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
  return {
    apiKey: "pk_live_" + raw.slice(0, 24),
    secretKey: "sk_live_" + raw.slice(24, 56),
  };
}

function posGateway() {
  return store.get(POS_GATEWAY, { apiKey: "", secretKey: "" }) || { apiKey: "", secretKey: "" };
}

function posSaveGateway(next) {
  store.set(POS_GATEWAY, next);
  posWriteKeysToPay();
  posFillKeyInputs();
  return next;
}

function posWriteKeysToPay() {
  const g = posGateway();
  const integ = gkIntegrations();
  integ.pos = {
    provider: integ.pos?.provider || "demo",
    merchant: integ.pos?.merchant || "HarbiGrup",
    key: g.apiKey || integ.pos?.key || "",
    secret: g.secretKey || integ.pos?.secret || "",
    active: Boolean(g.apiKey && g.secretKey) && posPayOn("gkpos") && posPayOn("shop"),
    settleIban: POS_SETTLE.iban,
  };
  store.set(GK_INTEG, integ);
}

function posFillKeyInputs() {
  const g = posGateway();
  [
    ["#posGateApi", g.apiKey],
    ["#posPayApiKey", g.apiKey],
    ["#posCardApiKey", g.apiKey],
    ["#gkPosKey", g.apiKey],
  ].forEach(([sel, val]) => {
    if ($(sel) && val) $(sel).value = val;
  });
  [
    ["#posGateSecret", g.secretKey],
    ["#posPaySecret", g.secretKey],
    ["#posCardSecret", g.secretKey],
    ["#gkPosSecret", g.secretKey],
  ].forEach(([sel, val]) => {
    if ($(sel) && val) $(sel).value = val;
  });
  if ($("#gkPosOn") && g.apiKey && g.secretKey) $("#gkPosOn").checked = true;
  if ($("#gkPosMerchant") && !($("#gkPosMerchant").value || "").trim()) $("#gkPosMerchant").value = "HarbiGrup";
}

function posCreateApiKey() {
  const g = posGateway();
  if (g.apiKey) {
    posWriteKeysToPay();
    posFillKeyInputs();
    posMsg("API anahtarı aynı kaldı ve ödeme sistemine yazıldı.");
    return g;
  }
  const made = posMakeKeys();
  g.apiKey = made.apiKey;
  posSaveGateway(g);
  posMsg("API anahtarı oluşturuldu ve ödeme sistemine yazıldı.");
  return g;
}

function posCreateSecretKey() {
  const g = posGateway();
  if (g.secretKey) {
    posWriteKeysToPay();
    posFillKeyInputs();
    posMsg("Gizli anahtar aynı kaldı ve ödeme sistemine yazıldı.");
    return g;
  }
  const made = posMakeKeys();
  g.secretKey = made.secretKey;
  posSaveGateway(g);
  posMsg("Gizli anahtar oluşturuldu ve ödeme sistemine yazıldı.");
  return g;
}

function posEnsureGateway() {
  const g = posGateway();
  if (!g.apiKey || !g.secretKey) {
    const made = posMakeKeys();
    if (!g.apiKey) g.apiKey = made.apiKey;
    if (!g.secretKey) g.secretKey = made.secretKey;
    posSaveGateway(g);
  } else {
    posWriteKeysToPay();
    posFillKeyInputs();
  }
}

function posReadDoc(input) {
  const file = input.files?.[0];
  if (!file) return Promise.reject(new Error("Belge seçin."));
  if (file.size > 3 * 1024 * 1024) return Promise.reject(new Error("Her belge en fazla 3 MB olabilir."));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: reader.result });
    reader.onerror = () => reject(new Error("Belge okunamadı."));
    reader.readAsDataURL(file);
  });
}

function posShow(id) {
  ["posApply", "posLogin", "posDesk", "posAdminLogin", "posAdminPanel"].forEach((key) => {
    const el = $("#" + key);
    if (el) el.hidden = key !== id;
  });
}

function posStatusLabel(status) {
  if (status === "active") return "Aktif";
  if (status === "rejected") return "Reddedildi";
  if (status === "held") return "Askıda";
  return "Onay bekliyor";
}

function posRenderDesk() {
  const member = posMember();
  $("#posDeskTab").hidden = !member;
  if (!member) {
    $("#posHello").textContent = "";
    ["posWaitCard", "posRejectCard", "posHoldCard", "posKeysCard", "posChargeWrap"].forEach((id) => {
      $("#" + id).hidden = true;
    });
    return;
  }
  $("#posHello").textContent =
    member.name + (member.email ? " · " + member.email : "") + " · " + posStatusLabel(member.status);
  const pending = member.status === "pending";
  const active = member.status === "active";
  $("#posWaitCard").hidden = !pending;
  $("#posRejectCard").hidden = member.status !== "rejected";
  $("#posRejectReason").textContent = member.rejectReason || "Başvurunuz reddedildi.";
  $("#posHoldCard").hidden = member.status !== "held";
  $("#posKeysCard").hidden = !active || !member.apiKey;
  $("#posChargeWrap").hidden = !active || !posSettings().on;
  if ($("#posIbanCard")) $("#posIbanCard").hidden = !active || !posPayOn("iban");
  if ($("#posCardCard")) $("#posCardCard").hidden = !active || !posPayOn("card");
  if (active && member.apiKey) {
    $("#posApiKey").value = member.apiKey;
    $("#posSecretKey").value = member.secretKey;
    $("#posSecretKey").type = "password";
    $("#posSecretToggle").textContent = "Gizli anahtarı göster";
  } else {
    $("#posApiKey").value = "";
    $("#posSecretKey").value = "";
  }
  posFillKeyInputs();
  const mine = posPays().filter((p) => p.phone === member.phone);
  $("#posPayList").innerHTML = mine.length
    ? mine.slice().reverse().map(posPayLine).join("")
    : "<p class='hint'>Henüz tahsilat yok.</p>";
}

function posRenderAdmin() {
  posFillKeyInputs();
  posRenderPaySystems();
  posSyncWithdrawUi();
  const list = posMembers().slice().reverse();
  $("#posAdminMembers").innerHTML = list.length
    ? list
        .map((m) => {
          const docs = ["ikamet", "imza", "findeks"]
            .map((key) => {
              const doc = m.docs?.[key];
              if (!doc?.dataUrl) return "";
              const label = key === "ikamet" ? "İkametgah" : key === "imza" ? "İmza sirküleri" : "Findeks";
              return `<a class="ghost-btn" href="${doc.dataUrl}" download="${escapeHtml(doc.name || label)}" target="_blank" rel="noopener">${label}</a>`;
            })
            .join(" ");
          const keys =
            m.status === "active" && m.apiKey
              ? `<p class="hint">API: ${escapeHtml(m.apiKey)}<br>Gizli: ${escapeHtml(m.secretKey)}</p>`
              : `<p class="hint">API ve gizli anahtar üyelik onaylanmadan üretildi / gösterilmez.</p>`;
          return `<article class="note" data-pos-id="${escapeHtml(m.id)}">
            <header><strong>${escapeHtml(m.name)}</strong><time>${escapeHtml(posStatusLabel(m.status))}</time></header>
            <p>${escapeHtml(m.email || "—")} · ${escapeHtml(m.phone)} · ${escapeHtml(m.address)}</p>
            <div class="row">${docs}</div>
            ${keys}
            <div class="row">
              <button class="gold" type="button" data-pos-cmd="approve">Onayla / Aktif et</button>
              <button class="secondary" type="button" data-pos-cmd="hold">Askıya al</button>
              <button class="danger" type="button" data-pos-cmd="reject">Reddet</button>
              <button class="secondary" type="button" data-pos-cmd="keys">Anahtar yenile</button>
              <button class="danger" type="button" data-pos-cmd="delete">Sil</button>
            </div>
          </article>`;
        })
        .join("")
    : "<p class='hint'>Başvuru yok.</p>";
  const pays = posPays().slice().reverse();
  $("#posAdminPays").innerHTML = pays.length
    ? pays.map((p) => posPayLine(p, `${p.name || "—"} · ${p.phone || "—"}`)).join("")
    : "<p class='hint'>Tahsilat yok.</p>";
}

function renderPos() {
  const member = posMember();
  const admin = posIsAdmin();
  $("#posDeskTab").hidden = !member;
  posFillRemember();
  posFillAdminRemember();
  if (admin) {
    posRenderAdmin();
    posShow("posAdminPanel");
    return;
  }
  if (member) {
    posRenderDesk();
    posShow("posDesk");
    return;
  }
  posShow("posApply");
}

$$("[data-pos-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.posTab;
    posMsg("");
    if (tab === "apply") posShow("posApply");
    if (tab === "login") posShow("posLogin");
    if (tab === "desk") {
      if (!posMember()) {
        posMsg("Önce giriş yapın.");
        posShow("posLogin");
        return;
      }
      posRenderDesk();
      posShow("posDesk");
    }
    if (tab === "admin") {
      if (posIsAdmin()) {
        posRenderAdmin();
        posShow("posAdminPanel");
      } else {
        posFillAdminRemember();
        posShow("posAdminLogin");
      }
    }
  });
});

$("#posRegister").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const phone = posPhone($("#posRegPhone").value);
    const email = $("#posRegEmail").value.trim().toLowerCase();
    const name = $("#posRegName").value.trim();
    const address = $("#posRegAddress").value.trim();
    const pin = $("#posRegPin").value;
    if (!name || !address || !phone || !email || !pin || !$("#posRegPin2").value) {
      posMsg("Tüm alanlar zorunludur.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      posMsg("Geçerli e-posta girin.");
      return;
    }
    if (phone.length < 10) {
      posMsg("Geçerli telefon girin.");
      return;
    }
    if (pin !== $("#posRegPin2").value) {
      posMsg("Şifreler aynı olmalı.");
      return;
    }
    if (posMembers().some((m) => m.phone === phone || (m.email && m.email.toLowerCase() === email))) {
      posMsg("Bu telefon veya e-posta ile başvuru var. Giriş yapın.");
      posShow("posLogin");
      return;
    }
    const [ikamet, imza, findeks] = await Promise.all([
      posReadDoc($("#posRegIkamet")),
      posReadDoc($("#posRegImza")),
      posReadDoc($("#posRegFindeks")),
    ]);
    const member = {
      id: "pos_" + Date.now(),
      name,
      email,
      phone,
      address,
      pin,
      status: "pending",
      docs: { ikamet, imza, findeks },
      at: Date.now(),
    };
    posSaveMembers(posMembers().concat(member));
    store.set(POS_SESSION, { phone });
    posRememberSave(email, pin, $("#posRegRemember").checked);
    $("#posRegister").reset();
    if ($("#posRegRemember")) $("#posRegRemember").checked = !!posRememberGet();
    posMsg("Başvuru alındı. Onay bekleniyor.");
    posRenderDesk();
    posShow("posDesk");
  } catch (err) {
    posMsg(err.message || "Başvuru gönderilemedi.");
  }
});

$("#posLoginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const login = $("#posLoginPhone").value.trim();
  const pin = $("#posLoginPin").value;
  const phone = posPhone(login);
  const member = posMembers().find(
    (m) => m.pin === pin && (m.phone === phone || (m.email && m.email.toLowerCase() === login.toLowerCase()))
  );
  if (!member) {
    posMsg("Telefon, e-posta veya şifre hatalı.");
    return;
  }
  store.set(POS_SESSION, { phone: member.phone });
  posRememberSave(login, pin, $("#posLoginRemember").checked);
  posMsg("");
  posRenderDesk();
  posShow("posDesk");
});

$("#posRegShowPin").addEventListener("click", () => {
  posTogglePins(["#posRegPin", "#posRegPin2"], $("#posRegShowPin"));
});
$("#posLoginShowPin").addEventListener("click", () => {
  posTogglePins(["#posLoginPin"], $("#posLoginShowPin"));
});
$("#posForgotShowPin").addEventListener("click", () => {
  posTogglePins(["#posForgotPin", "#posForgotPin2"], $("#posForgotShowPin"));
});
$("#posForgotOpen").addEventListener("click", () => {
  $("#posForgot").hidden = false;
  $("#posForgotPhone").value = $("#posRegPhone").value || $("#posLoginPhone").value;
  $("#posForgotEmail").value = $("#posRegEmail").value;
  posShow("posApply");
});
$("#posForgotCancel").addEventListener("click", () => {
  $("#posForgot").hidden = true;
});
$("#posForgot").addEventListener("submit", (event) => {
  event.preventDefault();
  const phone = posPhone($("#posForgotPhone").value);
  const email = $("#posForgotEmail").value.trim().toLowerCase();
  const pin = $("#posForgotPin").value;
  const pin2 = $("#posForgotPin2").value;
  if (!phone || !email || !pin || !pin2) {
    posMsg("Tüm alanlar zorunludur.");
    return;
  }
  if (pin !== pin2) {
    posMsg("Şifreler aynı olmalı.");
    return;
  }
  const list = posMembers();
  const member = list.find((m) => m.phone === phone && m.email && m.email.toLowerCase() === email);
  if (!member) {
    posMsg("Telefon ve e-posta eşleşmedi.");
    return;
  }
  member.pin = pin;
  posSaveMembers(list);
  $("#posForgot").reset();
  $("#posForgot").hidden = true;
  posMsg("Şifre güncellendi. Giriş yapın.");
  posShow("posLogin");
});

$("#posLogout").addEventListener("click", () => {
  store.set(POS_SESSION, null);
  posMsg("Çıkış yapıldı.");
  posShow("posLogin");
  $("#posDeskTab").hidden = true;
});

$("#posSecretToggle").addEventListener("click", () => {
  const member = posMember();
  if (!member || member.status !== "active") return;
  const input = $("#posSecretKey");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  $("#posSecretToggle").textContent = show ? "Gizli anahtarı gizle" : "Gizli anahtarı göster";
});

function posToggleSecret(inputSel, btnSel, adminOnly) {
  if (adminOnly && !posIsAdmin()) return;
  const input = $(inputSel);
  const btn = $(btnSel);
  if (!input || !btn) return;
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  btn.textContent = show ? "Gizli anahtarı gizle" : "Gizli anahtarı göster";
  btn.setAttribute("aria-pressed", String(show));
}

$("#posGateSecretToggle").addEventListener("click", () => posToggleSecret("#posGateSecret", "#posGateSecretToggle", true));
$("#posPaySecretToggle").addEventListener("click", () => posToggleSecret("#posPaySecret", "#posPaySecretToggle", false));
$("#gkPosSecretToggle").addEventListener("click", () => {
  if (!gkIsAdmin()) return;
  posToggleSecret("#gkPosSecret", "#gkPosSecretToggle", false);
});

$("#posCopyIban").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(POS_SETTLE.ibanMasked);
    posMsg("IBAN kopyalandı.");
  } catch {
    posMsg(POS_SETTLE.ibanMasked);
  }
});

$("#posIbanForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const from = posFormatIban($("#posIbanFrom").value);
  if (!posIbanOk(from)) {
    posMsg("Geçerli bir TR IBAN girin.");
    return;
  }
  const payer = $("#posIbanPayer").value.trim();
  const ok = posRecordPay({
    amount: parseMoney($("#posIbanAmount").value),
    method: "iban",
    note: $("#posIbanNote").value.trim(),
    detail: payer + " · " + from + " → " + POS_SETTLE.ibanMasked,
  });
  if (ok) $("#posIbanForm").reset();
});

$("#posCardNumber").addEventListener("input", () => {
  const num = $("#posCardNumber").value.replace(/\D/g, "");
  const brand = posCardBrandFromNumber(num);
  if (brand && [...$("#posCardBrand").options].some((o) => o.value === brand)) {
    $("#posCardBrand").value = brand;
  }
});

$("#posCardExp").addEventListener("input", () => {
  let v = $("#posCardExp").value.replace(/\D/g, "").slice(0, 4);
  if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
  $("#posCardExp").value = v;
});

$("#posCardForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const num = $("#posCardNumber").value.replace(/\D/g, "");
  const exp = $("#posCardExp").value.trim();
  const cvc = $("#posCardCvc").value.replace(/\D/g, "");
  const brand = $("#posCardBrand").value;
  if (num.length < 13 || num.length > 19) {
    posMsg("Geçerli kart numarası girin.");
    return;
  }
  if (!/^\d{2}\/\d{2}$/.test(exp)) {
    posMsg("Son kullanma AA/YY olsun.");
    return;
  }
  if (cvc.length < 3) {
    posMsg("CVC girin.");
    return;
  }
  const last4 = num.slice(-4);
  const ok = posRecordPay({
    amount: parseMoney($("#posCardAmount").value),
    method: "card",
    note: $("#posCardNote").value.trim(),
    detail: brand + " · **** " + last4 + " · " + $("#posCardName").value.trim(),
  });
  if (ok) {
    $("#posCardForm").reset();
    $("#posCardCvc").value = "";
    $("#posCardNumber").value = "";
  }
});

$("#posAdminForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const user = $("#posAdminUser").value.trim();
  const pin = $("#posAdminPin").value;
  if (user !== POS_ADMIN_USER || pin !== posAdminPinValue()) {
    posMsg("Süper admin bilgileri hatalı.");
    return;
  }
  const remember = $("#posAdminRemember").checked;
  store.set(POS_ADMIN_ON, true);
  store.set(POS_ADMIN_REMEMBER, remember ? { remember: true, user, pin } : { remember: false });
  posMsg("");
  posRenderAdmin();
  posShow("posAdminPanel");
});

$("#posAdminShowPin").addEventListener("click", () => {
  posTogglePins(["#posAdminPin"], $("#posAdminShowPin"));
  const shown = $("#posAdminPin").type === "text";
  $("#posAdminShowPin").textContent = shown ? "Şifreyi gizle" : "Şifreyi göster";
});

$("#posAdminForgotOpen").addEventListener("click", () => {
  $("#posAdminForgot").hidden = false;
  $("#posAdminForgotUser").value = $("#posAdminUser").value;
});

$("#posAdminForgotCancel").addEventListener("click", () => {
  $("#posAdminForgot").hidden = true;
});

$("#posAdminForgotShowPin").addEventListener("click", () => {
  posTogglePins(["#posAdminForgotPin", "#posAdminForgotPin2"], $("#posAdminForgotShowPin"));
});

$("#posAdminForgot").addEventListener("submit", (event) => {
  event.preventDefault();
  const user = $("#posAdminForgotUser").value.trim();
  const pin = $("#posAdminForgotPin").value;
  const pin2 = $("#posAdminForgotPin2").value;
  if (!user || !pin || !pin2) {
    posMsg("Tüm alanlar zorunludur.");
    return;
  }
  if (user !== POS_ADMIN_USER) {
    posMsg("Kullanıcı adı eşleşmedi.");
    return;
  }
  if (pin !== pin2) {
    posMsg("Şifreler aynı olmalı.");
    return;
  }
  store.set(POS_ADMIN_PIN_STORE, pin);
  const remember = $("#posAdminRemember")?.checked !== false;
  store.set(POS_ADMIN_REMEMBER, remember ? { remember: true, user, pin } : { remember: false });
  $("#posAdminForgot").reset();
  $("#posAdminForgot").hidden = true;
  $("#posAdminUser").value = user;
  $("#posAdminPin").value = remember ? pin : "";
  posMsg("Süper admin şifresi güncellendi. Giriş yapın.");
});

$("#posAdminLogout").addEventListener("click", () => {
  store.set(POS_ADMIN_ON, false);
  posFillAdminRemember();
  posSyncWithdrawUi();
  posShow("posAdminLogin");
});

$("#posCreateApi").addEventListener("click", () => posCreateApiKey());
$("#posCreateSecret").addEventListener("click", () => posCreateSecretKey());
$("#posCreateApiDesk").addEventListener("click", () => posCreateApiKey());
$("#posCreateSecretDesk").addEventListener("click", () => posCreateSecretKey());

$("#posSysForm").addEventListener("submit", (event) => {
  event.preventDefault();
  posApplySysFromForm();
});
$("#posGlobalSave").addEventListener("click", (event) => {
  event.preventDefault();
  posApplySysFromForm();
});
$("#posSysAllOn").addEventListener("click", () => posApplySysFromForm(true));
$("#posSysAllOff").addEventListener("click", () => posApplySysFromForm(false));

$("#posWithdrawToggle").addEventListener("click", () => {
  if (!posIsAdmin()) {
    posMsg("Bu komut yalnızca süper adminde.");
    posSyncWithdrawUi();
    return;
  }
  const next = posSettings().withdrawShow !== true;
  posPatchSettings({ withdrawShow: next });
  posSyncWithdrawUi();
  posMsg(next ? "Para çek alanı gösterildi." : "Para çek alanı gizlendi.");
});

$("#posWithdrawForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!posIsAdmin()) {
    posMsg("Para çek yalnızca süper adminde.");
    posSyncWithdrawUi();
    return;
  }
  if (posSettings().withdrawShow !== true) {
    posMsg("Para çek alanı gizli. Önce göster komutunu kullanın.");
    return;
  }
  if (!posPayOn("withdraw")) {
    posMsg("Para çek sistemi süper admin tarafından kapatıldı.");
    return;
  }
  const owner = $("#posWithdrawName").value.trim();
  const from = posFormatIban($("#posWithdrawIban").value);
  const amount = parseMoney($("#posWithdrawAmount").value);
  if (!owner) {
    posMsg("Hesap sahibinin adını yazın.");
    return;
  }
  if (!posIbanOk(from)) {
    posMsg("Geçerli bir kaynak TR IBAN girin.");
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    posMsg("Geçerli tutar girin.");
    return;
  }
  const fee = posFee(amount);
  const pay = {
    id: "pay_" + Date.now(),
    phone: "admin",
    name: owner,
    amount: fee.gross,
    commission: fee.commission,
    net: fee.net,
    feeRate: POS_FEE_RATE,
    note: $("#posWithdrawNote").value.trim(),
    method: "withdraw",
    detail: owner + " · " + from + " → " + POS_SETTLE.ibanMasked,
    settleName: POS_SETTLE.name,
    settleBranch: POS_SETTLE.branch,
    settleIban: POS_SETTLE.iban,
    at: Date.now(),
  };
  store.set(POS_PAYS, posPays().concat(pay));
  $("#posWithdrawForm").reset();
  $("#posWithdrawTarget").value = POS_SETTLE.ibanMasked;
  posMsg(formatTry(amount) + " " + from + " hesabından Tolkan Uğur IBAN’ına çekildi.");
  posRenderAdmin();
});

$("#posAdminMembers").addEventListener("click", (event) => {
  if (!posIsAdmin()) return;
  const cmd = event.target.closest("[data-pos-cmd]")?.dataset.posCmd;
  const id = event.target.closest("[data-pos-id]")?.dataset.posId;
  if (!cmd || !id) return;
  let list = posMembers();
  const member = list.find((m) => m.id === id);
  if (!member && cmd !== "delete") return;
  if (cmd === "approve") {
    const keys = member.apiKey ? { apiKey: member.apiKey, secretKey: member.secretKey } : posMakeKeys();
    member.status = "active";
    member.apiKey = keys.apiKey;
    member.secretKey = keys.secretKey;
    member.rejectReason = "";
    posMsg(member.name + " üyeliği aktif edildi.");
  }
  if (cmd === "hold") {
    member.status = "held";
    posMsg(member.name + " askıya alındı.");
  }
  if (cmd === "reject") {
    member.status = "rejected";
    member.rejectReason = "Belgeler yetersiz veya inceleme olumsuz.";
    member.apiKey = "";
    member.secretKey = "";
    posMsg(member.name + " reddedildi. Anahtarlar kapatıldı.");
  }
  if (cmd === "keys") {
    if (member.status !== "active") {
      posMsg("Anahtar yalnızca aktif üyede üretilir.");
      return;
    }
    Object.assign(member, posMakeKeys());
    posMsg("Anahtarlar yenilendi.");
  }
  if (cmd === "delete") {
    list = list.filter((m) => m.id !== id);
    posMsg("Üye silindi.");
  }
  posSaveMembers(list);
  posRenderAdmin();
  if (posMember()) posRenderDesk();
});

resumeRestoreCam();
resumeRestoreFields();
renderGallery();
posEnsureGateway();
renderNotes();
renderHygiene();
renderNfc();
renderPbx();
renderFlights();
renderHolidays();
renderCars();
renderHomes();
renderBikes();
renderGk();
renderPos();
renderIso();
renderFlash();
resumeRestoreSearches();
const resumeView = resumeGet().view || "home";
showView(resumeView);
requestAnimationFrame(() => {
  centerModeBtn(camMode);
  resumeRestoreScroll(resumeView);
});
