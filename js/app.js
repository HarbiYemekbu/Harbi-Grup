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
      if (el.id === "posWithdrawTarget" || el.id === "posSettleIban" || el.id === "posGateApi" || el.id === "posGateSecret" || el.id === "posPayApiKey" || el.id === "posCardApiKey" || el.id === "eimzaCardNumber" || el.id === "eimzaCardCvc" || el.id === "eimzaHavaleIban" || el.id === "ownerPin") return;
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

function ownerAppsOn() {
  return store.get("pos-admin-on", false) === true;
}

function syncOwnerApps() {
  document.body.classList.toggle("owner-on", ownerAppsOn());
}

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
  if (name !== "music") stopMusicMaker();
  if (name !== "aiclip") {
    stopAiClip();
    if (typeof clipLiveHalt === "function") clipLiveHalt();
  }
  if (name === "music") musicBeginTrial();
  if (name === "aiclip") clipBeginTrial();
  if (name === "women") renderGk();
  if (name === "pos") renderPos();
  if (name === "eimza") renderEimza();
  if (name === "music") renderMusic();
  if (name === "aiclip") renderAiClip();
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
let facingMode = "user";
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
  facingMode = "user";
  zoomLevel = minZoom();
  if (cam.flash) flashMode = cam.flash;
  camApplyFacingUi();
  camSyncModeChrome(camMode);
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
  return -1;
}

function applyPreviewZoom() {
  const z = sensorCrop();
  video.style.transform = `scale(${z}) perspective(420px) rotateY(180deg)`;
  video.style.filter = camMode === "cinema" ? "none" : `brightness(${isoBrightness()})`;
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

async function camVideoInputs() {
  try {
    return (await navigator.mediaDevices.enumerateDevices()).filter((item) => item.kind === "videoinput");
  } catch (_) {
    return [];
  }
}

function camIsFrontLabel(label) {
  return /front|user|ön|selfie|facetime|isight/i.test(label || "") && !/back|rear|arka/i.test(label || "");
}

function camIsBackLabel(label) {
  return /back|rear|environment|arka/i.test(label || "");
}

async function camPickDeviceId(wantFront) {
  const cams = await camVideoInputs();
  if (!cams.length) return "";
  if (wantFront) {
    return cams.find((item) => camIsFrontLabel(item.label))?.deviceId || cams[0].deviceId || "";
  }
  const backs = cams.filter((item) => camIsBackLabel(item.label));
  const main =
    backs.find((item) => /back camera|arka kamera/i.test(item.label) && !/ultra|tele|wide|ultra-wide/i.test(item.label)) ||
    backs.find((item) => /back camera|arka kamera/i.test(item.label)) ||
    backs[0];
  if (main?.deviceId) return main.deviceId;
  const notFront = cams.find((item) => !camIsFrontLabel(item.label));
  if (notFront?.deviceId && cams.length > 1) return notFront.deviceId;
  if (cams.length > 1) return cams[1].deviceId;
  return "";
}

function camTrackLooksFront(track) {
  if (!track) return false;
  const mode = track.getSettings?.().facingMode;
  if (mode === "user") return true;
  if (mode === "environment") return false;
  const label = String(track.label || "");
  if (camIsBackLabel(label)) return false;
  return camIsFrontLabel(label);
}

function camApplyFacingUi() {
  $("#switchCamera")?.classList.toggle("front", facingMode === "user");
  cameraFrame?.classList.toggle("front-cam", facingMode === "user");
  if ($("#camFacingLabel")) $("#camFacingLabel").textContent = facingMode === "user" ? "ön" : "arka";
  if ($("#switchCamera")) {
    $("#switchCamera").setAttribute("aria-label", facingMode === "user" ? "Ön kamera" : "Arka kamera");
  }
  syncCaptureMp();
  applyPreviewZoom();
}

function camAdoptOpenedTrack(requested) {
  const track = videoTrack();
  const mode = track?.getSettings?.().facingMode;
  if (mode === "environment" || mode === "user") facingMode = mode;
  else if (camTrackLooksFront(track)) facingMode = "user";
  else if (camIsBackLabel(track?.label || "")) facingMode = "environment";
  else if (requested) facingMode = requested;
  camApplyFacingUi();
}

async function camGetStream(wantFront) {
  const audio = needsAudio() ? iphoneAudioConstraints() : false;
  const deviceId = await camPickDeviceId(wantFront);
  const facing = wantFront ? "user" : "environment";
  const tries = [];
  if (deviceId) tries.push({ audio, video: { deviceId: { exact: deviceId } } });
  tries.push({ audio, video: { facingMode: { exact: facing } } });
  tries.push({ audio, video: { facingMode: { ideal: facing } } });
  tries.push({ audio: Boolean(audio), video: { facingMode: facing } });
  let lastErr = null;
  for (const spec of tries) {
    try {
      return await navigator.mediaDevices.getUserMedia(spec);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("kamera");
}

async function startCamera({ preserve = false } = {}) {
  const seq = ++camStartSeq;
  const keepZoom = zoomLevel;
  const keepIso = isoLevel;
  const requested = facingMode === "environment" ? "environment" : "user";
  stopCamera();
  syncCaptureMp();
  if (!preserve) cameraStatus.textContent = "İzin bekleniyor...";
  nativeZoomMax = 1;
  await new Promise((done) => setTimeout(done, 160));
  if (seq !== camStartSeq) return;
  try {
    stream = await camGetStream(requested === "user");
    if (seq !== camStartSeq) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
      return;
    }
    if (requested === "environment" && camTrackLooksFront(videoTrack())) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
      await new Promise((done) => setTimeout(done, 160));
      if (seq !== camStartSeq) return;
      stream = await camGetStream(false);
    }
    if (seq !== camStartSeq) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
      return;
    }
    const track = videoTrack();
    const caps = track?.getCapabilities?.() || {};
    nativeZoomMax = caps.zoom?.max || 1;
    if (requested === "environment") {
      await track
        ?.applyConstraints({
          width: { ideal: Math.min(8064, caps.width?.max || 3840) },
          height: { ideal: Math.min(6048, caps.height?.max || 2880) },
        })
        .catch(() => {});
    }
    if (needsAudio()) await applyIphoneAudio(stream);
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.muted = true;
    video.srcObject = stream;
    await video.play().catch(() => {});
    if (seq !== camStartSeq) return;
    camAdoptOpenedTrack(requested);
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
    ctx.filter = camMode === "cinema" ? "none" : video.style.filter || "none";
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
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch (_) {}
  });
  stream = null;
  try {
    video.pause();
  } catch (_) {}
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
  camApplyFacingUi();
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

function camSyncModeChrome(mode) {
  cameraFrame.classList.toggle("portrait-mode", mode === "portrait");
  if ($("#cinemaMask")) $("#cinemaMask").hidden = true;
  if ($("#isoRail")) $("#isoRail").hidden = mode === "cinema";
  if ($("#zoomBar")) $("#zoomBar").hidden = mode === "cinema";
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
  camSyncModeChrome(mode);
  applyPreviewZoom();
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
  if (camMode === "portrait") {
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

function nfcVibrate() {
  try {
    navigator.vibrate?.([50, 30, 70]);
  } catch {
    /* titreşim yok */
  }
}

function playTlink() {
  return new Promise((resolve) => {
    const ctx = nfcAudio();
    nfcVibrate();
    if (!ctx) {
      resolve();
      return;
    }
    const play = () => {
      const now = ctx.currentTime;
      const ding = (freq, start, dur, peak) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(peak, now + start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.02);
      };
      ding(1760, 0, 0.12, 0.42);
      ding(2349, 0.07, 0.16, 0.32);
      setTimeout(resolve, 280);
    };
    if (ctx.state === "suspended") ctx.resume().then(play).catch(play);
    else play();
  });
}

async function nfcContactSound() {
  await playTlink();
  speakTr("NFC'niz başarılı");
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
      nfcAudio()?.resume?.();
      nfcContactSound();
    };
  } catch (error) {
    nfcResult.textContent = "NFC okunamadı: " + error.message;
  }
});

const MUSIC_KEY = "music-songs";
const MUSIC_KEYS = [
  { n: "Do", f: 261.63 },
  { n: "Re", f: 293.66 },
  { n: "Mi", f: 329.63 },
  { n: "Fa", f: 349.23 },
  { n: "Sol", f: 392.0 },
  { n: "La", f: 440.0 },
  { n: "Si", f: 493.88 },
  { n: "Do2", f: 523.25 },
];

let musicTick = 0;
let musicTimer = 0;
let musicPlaying = false;
let musicPreviewRaf = 0;
let musicExporting = false;
let musicSongCache = null;
let musicLiveSources = [];
const MUSIC_TRIAL = "music-trial";
const MUSIC_SUB = "music-sub";
const MUSIC_MEMBERS = "music-members";
const MUSIC_TRIAL_MS = 14 * 24 * 60 * 60 * 1000;

function musicViewOn() {
  return document.querySelector('.view[data-view="music"]')?.classList.contains("active");
}

function musicTrialState() {
  return store.get(MUSIC_TRIAL, null);
}

function musicBeginTrial() {
  if (!store.get(MUSIC_TRIAL, null)?.at) store.set(MUSIC_TRIAL, { at: Date.now() });
}

function musicTrialLeft() {
  const row = musicTrialState();
  if (!row?.at) return MUSIC_TRIAL_MS;
  return Math.max(0, row.at + MUSIC_TRIAL_MS - Date.now());
}

function musicSubNow() {
  return store.get(MUSIC_SUB, null);
}

function musicMembers() {
  return store.get(MUSIC_MEMBERS, []);
}

function musicIsSuper() {
  return ownerAppsOn();
}

function musicSubActive() {
  const sub = musicSubNow();
  return !!(sub?.ok && sub.until && sub.until > Date.now());
}

function musicCanUse() {
  return musicIsSuper() || musicSubActive() || musicTrialLeft() > 0;
}

function musicJoinMsg(text) {
  if ($("#musicJoinMsg")) $("#musicJoinMsg").textContent = text || "";
}

function musicSubPending() {
  const sub = musicSubNow();
  return !!(sub?.pending && !musicSubActive());
}

function musicActivateMsg(text) {
  if ($("#musicActivateMsg")) $("#musicActivateMsg").textContent = text || "";
}

function musicNeedAccess() {
  if (musicCanUse()) return true;
  musicSyncGate();
  musicMsg("Üye ol hesabını aktifleştir eğlenmeye başla");
  return false;
}

function musicPlanAmount(plan) {
  return plan === "year" ? 750 : 49;
}

function musicPlanDays(plan) {
  return plan === "year" ? 365 : 30;
}

async function musicInspectDekont(file) {
  if (!file) throw new Error("Dekont yükleyin.");
  const name = file.name || "";
  const type = String(file.type || "").toLowerCase();
  const isPdf = type === "application/pdf" || /\.pdf$/i.test(name);
  const isImg = type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(name);
  if (!isPdf && !isImg) throw new Error("Dekont görsel veya PDF olmalı.");
  if (file.size < 28000) throw new Error("Dekont çok küçük. Boş veya sahte dosya görünüyor.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Dekont dosyası çok büyük.");
  if (/fake|sahte|photoshop|sample|ornek|örnek/i.test(name)) throw new Error("Dekont dosya adı güvenilir değil.");
  if (isPdf) return { kind: "pdf", w: 0, h: 0 };
  try {
    const bmp = await createImageBitmap(file);
    const w = bmp.width;
    const h = bmp.height;
    if (w < 380 || h < 380) throw new Error("Dekont çözünürlüğü yetersiz.");
    const canvas = document.createElement("canvas");
    canvas.width = 72;
    canvas.height = 72;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    g.drawImage(bmp, 0, 0, 72, 72);
    const pix = g.getImageData(0, 0, 72, 72).data;
    let sum = 0;
    let sum2 = 0;
    const n = 72 * 72;
    const bins = new Uint32Array(8);
    let edges = 0;
    for (let i = 0; i < pix.length; i += 4) {
      const y = 0.299 * pix[i] + 0.587 * pix[i + 1] + 0.114 * pix[i + 2];
      sum += y;
      sum2 += y * y;
      bins[Math.min(7, y >> 5)] += 1;
    }
    const mean = sum / n;
    const variance = sum2 / n - mean * mean;
    if (variance < 220) throw new Error("Dekont boş veya tek renk. Sahte görünüyor.");
    let used = 0;
    bins.forEach((c) => {
      if (c > n * 0.03) used += 1;
    });
    if (used < 3) throw new Error("Dekont içeriği yetersiz. Ödeme belgesi görünmüyor.");
    const data = g.getImageData(0, 0, 72, 72).data;
    for (let y = 1; y < 71; y++) {
      for (let x = 1; x < 71; x++) {
        const i = (y * 72 + x) * 4;
        const c = data[i];
        const r = data[i + 4];
        const d = data[i + 72 * 4];
        if (Math.abs(c - r) > 28 || Math.abs(c - d) > 28) edges += 1;
      }
    }
    if (edges < 80) throw new Error("Dekont üzerinde yazı veya banka çıktısı yok.");
    return { kind: "image", w, h };
  } catch (err) {
    if (err.message && /Dekont|Sahte|yetersiz|görünmüyor|yok/.test(err.message)) throw err;
    if (isImg && file.size >= 40000) return { kind: "image", w: 0, h: 0 };
    throw new Error("Dekont okunamadı. Net bir banka dekontu yükleyin.");
  }
}

function musicSyncGate() {
  const paid = musicSubActive() || musicIsSuper();
  const trialOn = musicTrialLeft() > 0 && !musicSubActive();
  const pending = musicSubPending();
  const gate = $("#musicBuyBox");
  const studio = $("#musicStudio");
  const admin = $("#musicAdminPanel");
  const hint = $("#musicTrialHint");
  const expired = $("#musicExpiredHead");
  const lede = $("#musicBuyLede");
  const join = $("#musicJoinForm");
  const review = $("#musicReviewBox");
  if (gate) gate.hidden = paid;
  if (join) join.hidden = paid || pending;
  if (review) review.hidden = !pending || paid;
  if (studio) studio.hidden = !musicCanUse();
  if (admin) admin.hidden = !musicIsSuper();
  if (expired) expired.hidden = paid || trialOn || pending;
  if (lede) {
    lede.hidden = pending;
    lede.textContent = trialOn
      ? "Deneme sürümündesiniz. İsterseniz hemen satın alın: Aylık 49 ₺, Yıllık 750 ₺. KDV %20 faturaya işlenir."
      : "14 günlük deneme bitti. Aylık 49 Türk Lirası veya Yıllık 750 Türk Lirası ödeyin. Fatura KDV’si %20.";
  }
  const sub = musicSubNow();
  if ($("#musicReviewLede") && pending) {
    $("#musicReviewLede").textContent = sub?.mailed
      ? "Faturanız e-posta ile gönderildi. Üyelik süreci inceleniyor. Fatura numarasını girip üyeliğinizi aktif edin."
      : "Üyelik süreci inceleniyor. Fatura numaranızı girin; doğrulanınca üyelik açılır.";
  }
  if (hint) {
    if (musicIsSuper()) hint.textContent = "Süper admin · tüm özellikler ücretsiz.";
    else if (musicSubActive()) {
      const left = Math.ceil((musicSubNow().until - Date.now()) / 86400000);
      hint.textContent = `Abonelik aktif · ${left} gün kaldı.`;
    } else if (pending) hint.textContent = "Üyelik süreci inceleniyor. Fatura numaranızı girin.";
    else if (trialOn) {
      const days = Math.max(1, Math.ceil(musicTrialLeft() / 86400000));
      hint.textContent = `14 günlük deneme · ${days} gün kaldı. Doğrudan satın alabilirsiniz.`;
    } else hint.textContent = "";
  }
  const list = $("#musicMemberList");
  if (list && musicIsSuper()) {
    const rows = musicMembers();
    list.innerHTML = rows.length
      ? rows
          .map(
            (row) =>
              `<article class="card"><strong>${escapeHtml(row.first)} ${escapeHtml(row.last)}</strong><p class="hint">${escapeHtml(
                row.phone
              )} · ${row.plan === "year" ? "Yıllık 750 ₺" : "Aylık 49 ₺"} · KDV %20 · ${
                row.ok ? new Date(row.until).toLocaleDateString("tr-TR") : "inceleniyor"
              }${row.invoiceNumber ? " · " + escapeHtml(row.invoiceNumber) : ""}</p></article>`
          )
          .join("")
      : "<p class='hint'>Henüz abone yok.</p>";
  }
}

function musicSelectPlan(plan) {
  const value = plan === "year" ? "year" : "month";
  $$("input[name='musicPlan']").forEach((el) => {
    el.checked = el.value === value;
  });
  $$("[data-music-plan]").forEach((el) => el.classList.toggle("is-on", el.dataset.musicPlan === value));
  if ($("#musicPayAmount")) $("#musicPayAmount").value = String(musicPlanAmount(value));
  const month = value === "month";
  if ($("#musicDekont")) $("#musicDekont").required = month;
  if ($("#musicDekontHint")) {
    $("#musicDekontHint").textContent = month
      ? "Aylık havale: dekont yükleyin. Dekont ve fatura numarası doğrulanınca üyelik açılır."
      : "Yıllık: ödeme sonrası e-fatura mailinize gelir. Fatura numarası ile üyeliği aktif edin.";
  }
}

function musicOnCaptureAttempt() {
  stopMusicMaker();
  document.body.classList.add("music-capture-block");
  const cap = $("#musicNoCap");
  if (cap) cap.hidden = false;
  musicMsg("Ekran videosu almak bu uygulamada kapalı.");
  setTimeout(() => {
    document.body.classList.remove("music-capture-block");
    if (cap) cap.hidden = true;
  }, 2500);
}

function musicHasDisplayCapture() {
  try {
    const devices = [];
    document.querySelectorAll("video, canvas").forEach(() => {});
    if (!navigator.mediaDevices) return false;
  } catch {
    return false;
  }
  return false;
}

function musicWatchCapture() {
  if (!musicViewOn()) return;
  navigator.mediaDevices?.getUserMedia;
  const md = navigator.mediaDevices;
  if (!md) return;
}

function musicInstallCaptureGuard() {
  const md = navigator.mediaDevices;
  if (md?.getDisplayMedia && !md.__musicGuard) {
    md.__musicGuard = true;
    const orig = md.getDisplayMedia.bind(md);
    md.getDisplayMedia = async function () {
      if (musicViewOn()) {
        musicOnCaptureAttempt();
        throw new DOMException("Ekran videosu alınamaz", "NotAllowedError");
      }
      return orig.apply(this, arguments);
    };
  }
  document.addEventListener("visibilitychange", () => {
    if (!musicViewOn() || !document.hidden) return;
    stopMusicMaker();
    const stage = $("#musicStage");
    if (stage) {
      const g = stage.getContext("2d");
      g.fillStyle = "#110318";
      g.fillRect(0, 0, stage.width, stage.height);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (!musicViewOn()) return;
    if (event.key === "PrintScreen" || (event.metaKey && event.shiftKey && (event.key === "3" || event.key === "4" || event.key === "5"))) {
      musicOnCaptureAttempt();
    }
  });
  const studio = $("#musicStudio");
  studio?.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
}

const musicVocals = {
  1: { blob: null, buffer: null, rec: null, stream: null, chunks: [], recording: false },
  2: { blob: null, buffer: null, rec: null, stream: null, chunks: [], recording: false },
};

function musicSongs() {
  return store.get(MUSIC_KEY, []);
}

function musicMsg(text) {
  if ($("#musicMsg")) $("#musicMsg").textContent = text || "";
}

function musicTone(freq, dur, type, vol) {
  const ctx = nfcAudio();
  if (!ctx) return;
  musicScheduleTone(ctx, ctx.destination, ctx.currentTime, freq, dur, type, vol);
}

function musicScheduleTone(ctx, dest, time, freq, dur, type, vol) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || "triangle";
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(vol || 0.18, time + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + dur + 0.02);
}

function musicDrum(kind) {
  const ctx = nfcAudio();
  if (!ctx) return;
  musicScheduleDrum(ctx, ctx.destination, ctx.currentTime, kind);
}

function musicScheduleDrum(ctx, dest, time, kind) {
  if (kind === "kick") {
    musicScheduleTone(ctx, dest, time, 90, 0.14, "sine", 0.28);
    return;
  }
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(kind === "snare" ? 180 : 9000, time);
  gain.gain.setValueAtTime(kind === "hat" ? 0.05 : 0.12, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + (kind === "hat" ? 0.05 : 0.1));
  osc.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + 0.12);
}

function musicScaleFor(style) {
  if (style === "arabesk") return [220, 233.08, 261.63, 311.13, 329.63, 392];
  if (style === "turku") return [196, 220, 246.94, 293.66, 329.63, 392];
  if (style === "rap") return [110, 130.81, 146.83, 164.81, 196, 220];
  if (style === "slow") return [196, 220, 246.94, 261.63, 329.63, 392];
  if (style === "dans") return [261.63, 329.63, 392, 523.25, 659.25, 783.99];
  return [261.63, 293.66, 329.63, 392, 440, 523.25];
}

function musicScale() {
  return musicScaleFor($("#musicStyle")?.value || "pop");
}

function musicMeta() {
  return {
    title: ($("#musicTitle")?.value || "").trim() || "Harbi Şarkı",
    style: $("#musicStyle")?.value || "pop",
    tempo: Number($("#musicTempo")?.value) || 100,
    lyrics: ($("#musicLyrics")?.value || "").trim(),
  };
}

function musicLyricParts(text) {
  const lines = String(text || "")
    .split(/\n+/)
    .map((row) => row.trim())
    .filter(Boolean);
  if (!lines.length) return ["Kendi sesiniz", "İkinci vokal", "Düet"];
  const mid = Math.max(1, Math.ceil(lines.length / 2));
  const a = lines.slice(0, mid).join("\n");
  const b = lines.slice(mid).join("\n") || a;
  return [a, b, lines.join("\n")];
}

function musicInvalidateSong() {
  musicSongCache = null;
}

function stopMusicMaker() {
  const keepStage = musicExporting;
  musicPlaying = false;
  clearInterval(musicTimer);
  musicTimer = 0;
  musicTick = 0;
  cancelAnimationFrame(musicPreviewRaf);
  musicPreviewRaf = 0;
  musicLiveSources.forEach((node) => {
    try {
      node.stop();
    } catch {
      /* already stopped */
    }
  });
  musicLiveSources = [];
  [1, 2].forEach((slot) => {
    if (musicVocals[slot].recording) musicStopRec(slot, true);
  });
  musicExporting = false;
  const stage = $("#musicStage");
  if (stage && !keepStage) stage.classList.remove("is-on");
  if ($("#musicPlay")) $("#musicPlay").textContent = "Önizle";
}

function musicPlayLoop() {
  const ctx = nfcAudio();
  if (!ctx) {
    musicMsg("Bu tarayıcı ses çalamıyor.");
    return;
  }
  ctx.resume?.();
  stopMusicMaker();
  musicPlaying = true;
  if ($("#musicPlay")) $("#musicPlay").textContent = "Çalıyor";
  const bpm = Number($("#musicTempo")?.value) || 100;
  const stepMs = Math.round(60000 / bpm / 2);
  const lyrics = ($("#musicLyrics")?.value || "").replace(/\s+/g, "") || "HARBIGRUP";
  musicMsg("Ritim çalıyor…");
  musicTimer = setInterval(() => {
    if (!musicPlaying) return;
    const s = musicTick % 16;
    const style = $("#musicStyle")?.value || "pop";
    if (s % 4 === 0) musicDrum("kick");
    if (s % 4 === 2) musicDrum(style === "rap" ? "hat" : "snare");
    if (s % 2 === 1 || style === "dans" || style === "rap") musicDrum("hat");
    const scale = musicScale();
    const ch = lyrics.charCodeAt(musicTick % lyrics.length);
    musicTone(scale[ch % scale.length], style === "slow" ? 0.28 : 0.16, style === "rap" ? "square" : "triangle", 0.14);
    if (s % 8 === 0) musicTone(scale[0] / 2, 0.22, "sine", 0.1);
    musicTick += 1;
  }, stepMs);
}

function musicRms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
}

function musicDetectPitch(samples, sr) {
  if (musicRms(samples) < 0.02) return 0;
  const minLag = Math.floor(sr / 700);
  const maxLag = Math.min(Math.floor(sr / 80), samples.length - 2);
  let bestLag = 0;
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < samples.length - lag; i++) corr += samples[i] * samples[i + lag];
    if (corr > best) {
      best = corr;
      bestLag = lag;
    }
  }
  return bestLag ? sr / bestLag : 0;
}

function musicMono(buffer) {
  const ctx = nfcAudio();
  const out = ctx.createBuffer(1, buffer.length, buffer.sampleRate);
  const dst = out.getChannelData(0);
  const ch0 = buffer.getChannelData(0);
  if (buffer.numberOfChannels === 1) {
    dst.set(ch0);
    return out;
  }
  const ch1 = buffer.getChannelData(1);
  for (let i = 0; i < dst.length; i++) dst[i] = (ch0[i] + ch1[i]) * 0.5;
  return out;
}

function musicNormalize(buffer) {
  const data = buffer.getChannelData(0);
  let peak = 0.001;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const g = 0.86 / peak;
  for (let i = 0; i < data.length; i++) data[i] *= g;
  return buffer;
}

function musicTuneBuffer(buffer, style, harmony) {
  const srcBuf = musicNormalize(musicMono(buffer));
  const sr = srcBuf.sampleRate;
  const src = srcBuf.getChannelData(0);
  const scale = musicScaleFor(style);
  const grain = Math.floor(sr * 0.045);
  const hop = Math.floor(grain / 2);
  const out = new Float32Array(src.length);
  const win = new Float32Array(grain);
  for (let i = 0; i < grain; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (grain - 1));
  for (let pos = 0; pos + grain < src.length; pos += hop) {
    const slice = src.subarray(pos, pos + grain);
    const pitch = musicDetectPitch(slice, sr);
    let rate = 1;
    if (pitch > 80 && pitch < 900) {
      let nearest = scale[0] * (harmony || 1);
      let best = 99;
      for (const note of scale) {
        for (let oct = 0.5; oct <= 4; oct *= 2) {
          const freq = note * oct * (harmony || 1);
          const dist = Math.abs(Math.log2(freq / pitch));
          if (dist < best) {
            best = dist;
            nearest = freq;
          }
        }
      }
      rate = Math.min(1.18, Math.max(0.84, nearest / pitch));
    }
    for (let i = 0; i < grain; i++) {
      const x = i * rate;
      const i0 = Math.floor(x);
      const frac = x - i0;
      const s0 = slice[i0] || 0;
      const s1 = slice[i0 + 1] || 0;
      const idx = pos + i;
      if (idx < out.length) out[idx] += (s0 * (1 - frac) + s1 * frac) * win[i];
    }
  }
  const ctx = nfcAudio();
  const tuned = ctx.createBuffer(1, out.length, sr);
  tuned.getChannelData(0).set(out);
  return musicNormalize(tuned);
}

function musicLoopTo(buffer, duration) {
  const ctx = nfcAudio();
  const frames = Math.max(1, Math.floor(duration * buffer.sampleRate));
  const out = ctx.createBuffer(1, frames, buffer.sampleRate);
  const dst = out.getChannelData(0);
  const src = buffer.getChannelData(0);
  if (!src.length) return out;
  for (let i = 0; i < frames; i++) dst[i] = src[i % src.length];
  const fade = Math.min(Math.floor(buffer.sampleRate * 0.04), Math.floor(frames / 8));
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    dst[i] *= k;
    dst[frames - 1 - i] *= k;
  }
  return out;
}

function musicStudio(ctx, style) {
  const input = ctx.createGain();
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 85;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = style === "rap" ? 6500 : 9800;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 5.5;
  comp.attack.value = 0.008;
  comp.release.value = 0.16;
  const delay = ctx.createDelay(0.55);
  delay.delayTime.value = style === "arabesk" ? 0.31 : style === "slow" ? 0.26 : 0.17;
  const fb = ctx.createGain();
  fb.gain.value = style === "rap" ? 0.12 : 0.24;
  const wet = ctx.createGain();
  wet.gain.value = style === "dans" ? 0.16 : 0.26;
  const dry = ctx.createGain();
  dry.gain.value = 0.92;
  const out = ctx.createGain();
  input.connect(hp);
  hp.connect(lp);
  lp.connect(comp);
  comp.connect(dry);
  dry.connect(out);
  comp.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(out);
  return { input, out };
}

async function musicRenderBacking(duration, bpm, style, lyrics) {
  const live = nfcAudio();
  const sr = live?.sampleRate || 44100;
  const frames = Math.max(1, Math.floor(duration * sr));
  const ctx = new OfflineAudioContext(1, frames, sr);
  const dest = ctx.destination;
  const step = 30 / bpm;
  const scale = musicScaleFor(style);
  const seed = (lyrics || "HARBIGRUP").replace(/\s+/g, "") || "H";
  let tick = 0;
  for (let t = 0; t < duration - 0.05; t += step) {
    const s = tick % 16;
    if (s % 4 === 0) musicScheduleDrum(ctx, dest, t, "kick");
    if (s % 4 === 2) musicScheduleDrum(ctx, dest, t, style === "rap" ? "hat" : "snare");
    if (s % 2 === 1 || style === "dans" || style === "rap") musicScheduleDrum(ctx, dest, t, "hat");
    const ch = seed.charCodeAt(tick % seed.length);
    musicScheduleTone(
      ctx,
      dest,
      t,
      scale[ch % scale.length],
      style === "slow" ? 0.3 : 0.15,
      style === "rap" ? "square" : "triangle",
      0.1
    );
    if (s % 8 === 0) musicScheduleTone(ctx, dest, t, scale[0] / 2, 0.24, "sine", 0.09);
    tick += 1;
  }
  return ctx.startRendering();
}

async function musicMixToBuffer(parts, backing, style, duration) {
  const sr = backing.sampleRate;
  const frames = Math.max(1, Math.floor(duration * sr));
  const ctx = new OfflineAudioContext(2, frames, sr);
  const studio = musicStudio(ctx, style);
  studio.out.connect(ctx.destination);
  const bed = ctx.createBufferSource();
  const bedGain = ctx.createGain();
  bedGain.gain.value = 0.38;
  bed.buffer = backing;
  bed.connect(bedGain);
  bedGain.connect(ctx.destination);
  bed.start(0);
  parts.forEach((part) => {
    if (!part.buffer) return;
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = part.gain || 0.95;
    src.buffer = part.buffer;
    src.connect(g);
    g.connect(studio.input);
    src.start(part.start);
  });
  return ctx.startRendering();
}

async function musicPrepareSong() {
  const meta = musicMeta();
  const v1 = musicVocals[1].buffer;
  if (!v1) throw new Error("Önce 1. vokal kaydı yapın veya ses yükleyin.");
  const stamp = `${meta.style}|${meta.tempo}|${meta.lyrics}|${v1.length}|${musicVocals[2].buffer?.length || 0}`;
  if (musicSongCache?.stamp === stamp) return musicSongCache;
  musicMsg("Şarkı hazırlanıyor… ritim ve vokal ayarlanıyor.");
  const bpm = meta.tempo;
  const bar = (60 / bpm) * 4;
  const section = bar * 4;
  const duration = section * 3;
  const lines = musicLyricParts(meta.lyrics);
  const style = meta.style;
  const tuned1 = musicTuneBuffer(v1, style, 1);
  const raw2 = musicVocals[2].buffer;
  const tuned2 = raw2 ? musicTuneBuffer(raw2, style, 1) : musicTuneBuffer(v1, style, 1.26);
  const s1 = musicLoopTo(tuned1, section);
  const s2 = musicLoopTo(tuned2, section);
  const duet1 = musicLoopTo(tuned1, section);
  const duet2 = musicLoopTo(raw2 ? musicTuneBuffer(raw2, style, 1.06) : musicTuneBuffer(v1, style, 1.26), section);
  const backing = await musicRenderBacking(duration, bpm, style, meta.lyrics);
  const mix = await musicMixToBuffer(
    [
      { buffer: s1, start: 0, gain: 1 },
      { buffer: s2, start: section, gain: 1 },
      { buffer: duet1, start: section * 2, gain: 0.86 },
      { buffer: duet2, start: section * 2, gain: 0.86 },
    ],
    backing,
    style,
    duration
  );
  musicSongCache = {
    stamp,
    mix,
    duration,
    bpm,
    title: meta.title,
    style,
    lyrics: meta.lyrics,
    parts: [
      { start: 0, end: section, label: "1. Vokal", lyrics: lines[0] },
      { start: section, end: section * 2, label: "2. Vokal", lyrics: lines[1] },
      { start: section * 2, end: duration, label: "Düet", lyrics: lines[2] },
    ],
  };
  return musicSongCache;
}

function musicWrapText(g, text, x, y, maxW, lineH) {
  const words = String(text || "").split(/\s+/);
  let line = "";
  let yy = y;
  g.textAlign = "center";
  words.forEach((word, i) => {
    const test = line ? line + " " + word : word;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else line = test;
    if (i === words.length - 1) g.fillText(line, x, yy);
  });
}

function musicDrawFrame(canvas, song, t) {
  const w = canvas.width;
  const h = canvas.height;
  const g = canvas.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "#9b32c8");
  grd.addColorStop(1, "#2a083c");
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  const beat = (t * song.bpm) / 60;
  const pulse = 0.5 + 0.5 * Math.sin(beat * Math.PI * 2);
  g.fillStyle = `rgba(212,175,55,${0.12 + pulse * 0.18})`;
  g.beginPath();
  g.arc(w / 2, h * 0.28, 90 + pulse * 50, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.font = "700 36px Instrument Sans, sans-serif";
  g.fillText("HARBI GRUP", w / 2, 72);
  g.font = "800 48px Syne, sans-serif";
  g.fillText(song.title.slice(0, 28), w / 2, 130);
  const part = song.parts.find((row) => t >= row.start && t < row.end) || song.parts[song.parts.length - 1];
  g.fillStyle = "#f6e27a";
  g.font = "700 34px Instrument Sans, sans-serif";
  g.fillText(part.label, w / 2, 190);
  g.fillStyle = "#f6f1e6";
  g.font = "600 32px Instrument Sans, sans-serif";
  musicWrapText(g, part.lyrics, w / 2, 280, w - 80, 44);
  for (let i = 0; i < 12; i++) {
    const bh = 24 + ((Math.sin(beat * 4 + i) + 1) / 2) * 90;
    g.fillStyle = i % 2 ? "#d4af37" : "#e38bff";
    g.fillRect(80 + i * 48, h - 80 - bh, 28, bh);
  }
}

function musicStageOn() {
  const stage = $("#musicStage");
  if (stage) stage.classList.add("is-on");
  return stage;
}

function musicPlayMix(song, destExtra) {
  const ctx = nfcAudio();
  ctx.resume?.();
  const src = ctx.createBufferSource();
  src.buffer = song.mix;
  src.connect(ctx.destination);
  if (destExtra) src.connect(destExtra);
  src.start(0);
  musicLiveSources.push(src);
  musicPlaying = true;
  if ($("#musicPlay")) $("#musicPlay").textContent = "Çalıyor";
  const t0 = ctx.currentTime;
  const stage = musicStageOn();
  const tick = () => {
    if (!musicPlaying) return;
    const t = ctx.currentTime - t0;
    if (stage) musicDrawFrame(stage, song, Math.min(t, song.duration));
    if (t >= song.duration) {
      if (!musicExporting) {
        stopMusicMaker();
        musicMsg("Önizleme bitti.");
      }
      return;
    }
    musicPreviewRaf = requestAnimationFrame(tick);
  };
  tick();
  src.onended = () => {
    if (musicPlaying && !musicExporting) {
      stopMusicMaker();
      musicMsg("Önizleme bitti.");
    }
  };
}

async function musicStartPreview() {
  if (!musicNeedAccess()) return;
  try {
    const song = await musicPrepareSong();
    stopMusicMaker();
    musicPlayMix(song);
    musicMsg("Önizleme: 1. vokal · 2. vokal · düet");
  } catch (err) {
    musicPlayLoop();
    if (err?.message && /vokal/i.test(err.message)) musicMsg(err.message + " Şimdilik ritim çalıyor.");
  }
}

async function musicDecodeFile(file) {
  const ctx = nfcAudio();
  if (!ctx) throw new Error("Ses çözülemiyor.");
  await ctx.resume?.();
  const data = await file.arrayBuffer();
  return ctx.decodeAudioData(data.slice(0));
}

function musicVoxLabel(slot) {
  return $("#musicVox" + slot);
}

async function musicSetVocal(slot, blob, label) {
  const ctx = nfcAudio();
  await ctx?.resume?.();
  const buffer = await musicDecodeFile(blob);
  musicVocals[slot].blob = blob;
  musicVocals[slot].buffer = buffer;
  musicInvalidateSong();
  if (musicVoxLabel(slot)) {
    musicVoxLabel(slot).textContent = `${label} · ${buffer.duration.toFixed(1)} sn`;
  }
  musicMsg(`${slot}. vokal alındı. Tarz ve tempo uygulanıyor…`);
  try {
    await musicPrepareSong();
    musicMsg(`${slot}. vokal ritme oturtuldu. Önizleyin veya ikinci vokali ekleyin.`);
  } catch {
    /* 1. vokal yoksa 2. bekler */
  }
}

function musicRecMime() {
  const types = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function musicStartRec(slot) {
  if (!musicNeedAccess()) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    musicMsg("Bu tarayıcı mikrofon kaydını desteklemiyor. Ses dosyası yükleyin.");
    return;
  }
  if (musicVocals[slot].recording) return;
  stopMusicMaker();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    const mime = musicRecMime();
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    musicVocals[slot].stream = stream;
    musicVocals[slot].rec = rec;
    musicVocals[slot].chunks = [];
    musicVocals[slot].recording = true;
    rec.ondataavailable = (event) => {
      if (event.data.size) musicVocals[slot].chunks.push(event.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      musicVocals[slot].recording = false;
      $("#musicRec" + slot)?.classList.remove("is-rec");
      const blob = new Blob(musicVocals[slot].chunks, { type: rec.mimeType || "audio/webm" });
      if (blob.size < 800) {
        musicMsg("Kayıt çok kısa. Tekrar deneyin.");
        return;
      }
      try {
        await musicSetVocal(slot, blob, "Kayıt");
      } catch (err) {
        musicMsg("Kayıt okunamadı: " + (err.message || err));
      }
    };
    rec.start(80);
    $("#musicRec" + slot)?.classList.add("is-rec");
    if (musicVoxLabel(slot)) musicVoxLabel(slot).textContent = "Kayıt alınıyor… söyleyin.";
    musicMsg(`${slot}. vokal kaydı başladı. Bitir’e basın.`);
  } catch (err) {
    musicMsg("Mikrofon izni gerekli: " + (err.message || err));
  }
}

function musicStopRec(slot, silent) {
  const row = musicVocals[slot];
  if (row.rec && row.recording) {
    try {
      row.rec.stop();
    } catch {
      row.recording = false;
    }
  }
  row.stream?.getTracks?.().forEach((track) => track.stop());
  $("#musicRec" + slot)?.classList.remove("is-rec");
  if (!silent && row.recording) musicMsg("Kayıt bitiyor…");
}

async function saveBlobToPhoneGallery(blob, filename) {
  const name = filename || videoFileName(blob.type);
  const file = new File([blob], name, { type: blob.type || "video/mp4" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "Harbi Grup şarkı" });
      return "share";
    }
  } catch (err) {
    if (err?.name === "AbortError") return "abort";
  }
  downloadBlob(blob, name);
  return "download";
}

function musicRecorderFor(stream) {
  const types = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const mime = types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  try {
    return mime ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 192000, videoBitsPerSecond: 6_000_000 }) : new MediaRecorder(stream);
  } catch {
    return new MediaRecorder(stream);
  }
}

async function musicSaveToGallery() {
  if (!musicNeedAccess()) return;
  const title = ($("#musicTitle")?.value || "").trim();
  if (!title) {
    musicMsg("Şarkı adı yazın.");
    return;
  }
  if (!musicVocals[1].buffer) {
    musicMsg("Galeriye video için önce 1. vokal kaydı veya yükleme gerekir.");
    return;
  }
  const meta = musicMeta();
  store.set(MUSIC_KEY, [{ id: "song_" + Date.now(), ...meta, at: Date.now() }].concat(musicSongs()).slice(0, 40));
  renderMusic();
  try {
    const song = await musicPrepareSong();
    stopMusicMaker();
    const ctx = nfcAudio();
    await ctx.resume?.();
    const stage = musicStageOn();
    if (!stage || !stage.captureStream) {
      musicMsg("Bu tarayıcı video kaydını desteklemiyor.");
      return;
    }
    musicDrawFrame(stage, song, 0);
    const fps = 30;
    const vstream = stage.captureStream(fps);
    const dest = ctx.createMediaStreamDestination();
    try {
      vstream.getAudioTracks().forEach((track) => vstream.removeTrack(track));
    } catch {
      /* canvas sesi yok */
    }
    dest.stream.getAudioTracks().forEach((track) => {
      try {
        vstream.addTrack(track);
      } catch {
        /* ses eklenemedi */
      }
    });
    const rec = musicRecorderFor(vstream);
    const chunks = [];
    rec.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    const done = new Promise((resolve, reject) => {
      rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || "video/mp4" }));
      rec.onerror = () => reject(new Error("Video kaydı başarısız."));
    });
    musicExporting = true;
    musicPlaying = true;
    rec.start(100);
    musicPlayMix(song, dest);
    musicMsg("Video hazırlanıyor… bitince galeriye gidecek.");
    await new Promise((resolve) => setTimeout(resolve, Math.ceil(song.duration * 1000) + 250));
    if (rec.state === "recording") rec.stop();
    const blob = await done;
    musicExporting = false;
    stopMusicMaker();
    if (blob.size < 1000) {
      musicMsg("Video oluşmadı. Önizlemeyi tekrar deneyin.");
      return;
    }
    const how = await saveBlobToPhoneGallery(blob, videoFileName(blob.type));
    if (how === "abort") musicMsg("Paylaşım iptal edildi.");
    else if (how === "share") musicMsg("Paylaş menüsünden Videoyu Kaydet / Resimler’e ekleyin.");
    else musicMsg("Video indirildi. Telefonda dosyayı Resimler galerisine taşıyın veya açıp kaydedin.");
  } catch (err) {
    musicExporting = false;
    stopMusicMaker();
    musicMsg(err.message || "Video kaydedilemedi.");
  }
}

function renderMusic() {
  musicSyncGate();
  const pad = $("#musicPad");
  if (pad && !pad.dataset.ready) {
    pad.dataset.ready = "1";
    pad.innerHTML = MUSIC_KEYS.map(
      (key) => `<button type="button" data-music-note="${key.f}">${escapeHtml(key.n)}</button>`
    ).join("");
  }
  if ($("#musicTempoVal") && $("#musicTempo")) $("#musicTempoVal").textContent = $("#musicTempo").value;
  const plan = $$("input[name='musicPlan']").find((el) => el.checked)?.value || "month";
  musicSelectPlan(plan);
  const list = $("#musicList");
  if (!list) return;
  const songs = musicSongs();
  list.innerHTML =
    songs
      .map(
        (song) => `<article class="card">
        <strong>${escapeHtml(song.title)}</strong>
        <p class="hint">${escapeHtml(song.style)} · ${song.tempo} BPM · ${new Date(song.at).toLocaleString("tr-TR")}</p>
        <p>${escapeHtml((song.lyrics || "").slice(0, 160))}</p>
        <div class="row">
          <button class="gold" type="button" data-music-load="${song.id}">Aç</button>
          <button class="secondary" type="button" data-music-play="${song.id}">Çal</button>
          <button class="danger" type="button" data-music-del="${song.id}">Sil</button>
        </div>
      </article>`
      )
      .join("") || "<p class='hint'>Henüz şarkı yok. Vokal kaydedip galeriye video kaydedin.</p>";
}

$("#musicPad")?.addEventListener("click", (event) => {
  if (!musicNeedAccess()) return;
  const btn = event.target.closest("[data-music-note]");
  if (!btn) return;
  nfcAudio()?.resume?.();
  musicTone(Number(btn.dataset.musicNote), 0.28, "triangle", 0.22);
});

$("#musicTempo")?.addEventListener("input", () => {
  if ($("#musicTempoVal")) $("#musicTempoVal").textContent = $("#musicTempo").value;
  musicInvalidateSong();
});

$("#musicStyle")?.addEventListener("change", async () => {
  musicInvalidateSong();
  if (!musicVocals[1].buffer) return;
  musicMsg("Yeni türe göre vokal ayarlanıyor…");
  try {
    await musicPrepareSong();
    musicMsg("Ritim ve tür uygulandı. Önizleyin.");
  } catch (err) {
    musicMsg(err.message || "Ayarlanamadı.");
  }
});

$("#musicLyrics")?.addEventListener("input", () => musicInvalidateSong());
$("#musicTitle")?.addEventListener("input", () => musicInvalidateSong());

$("#musicPlay")?.addEventListener("click", () => {
  if (musicPlaying) stopMusicMaker();
  else if (!musicNeedAccess()) return;
  else if (musicVocals[1].buffer) musicStartPreview();
  else musicPlayLoop();
});

$("#musicStop")?.addEventListener("click", () => {
  stopMusicMaker();
  musicMsg("Durdu.");
});

$("#musicRec1")?.addEventListener("click", () => musicStartRec(1));
$("#musicRec2")?.addEventListener("click", () => musicStartRec(2));
$("#musicStopRec1")?.addEventListener("click", () => musicStopRec(1));
$("#musicStopRec2")?.addEventListener("click", () => musicStopRec(2));

$("#musicFile1")?.addEventListener("change", async (event) => {
  if (!musicNeedAccess()) return;
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await musicSetVocal(1, file, file.name);
  } catch (err) {
    musicMsg("Dosya okunamadı: " + (err.message || err));
  }
});

$("#musicFile2")?.addEventListener("change", async (event) => {
  if (!musicNeedAccess()) return;
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await musicSetVocal(2, file, file.name);
  } catch (err) {
    musicMsg("Dosya okunamadı: " + (err.message || err));
  }
});

$("#musicForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  musicSaveToGallery();
});

$("#musicBuyBox")?.addEventListener("click", (event) => {
  const planBtn = event.target.closest("[data-music-plan]");
  if (!planBtn) return;
  musicSelectPlan(planBtn.dataset.musicPlan);
});

$$("input[name='musicPlan']").forEach((el) => {
  el.addEventListener("change", () => {
    if (el.checked) musicSelectPlan(el.value);
  });
});

$("#musicCopyIban")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(POS_SETTLE.ibanMasked);
    musicJoinMsg("IBAN kopyalandı.");
  } catch {
    musicJoinMsg(POS_SETTLE.ibanMasked);
  }
});

$("#musicJoinForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const first = $("#musicSubFirst").value.trim();
  const last = $("#musicSubLast").value.trim();
  const phone = $("#musicSubPhone").value.replace(/\D/g, "");
  const email = ($("#musicSubEmail")?.value || "").trim().toLowerCase();
  const taxId = ($("#musicSubTax")?.value || "").replace(/\D/g, "");
  const address = $("#musicSubAddress").value.trim();
  const plan = $$("input[name='musicPlan']").find((el) => el.checked)?.value || "month";
  const amount = Number(String($("#musicPayAmount").value || "").replace(",", "."));
  const file = $("#musicDekont")?.files?.[0];
  const need = musicPlanAmount(plan);
  if (first.length < 2 || last.length < 2) {
    musicJoinMsg("İsim ve soy isim zorunlu.");
    return;
  }
  if (phone.length < 10) {
    musicJoinMsg("Geçerli telefon yazın.");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    musicJoinMsg("Fatura için geçerli e-posta yazın.");
    return;
  }
  if (address.length < 10) {
    musicJoinMsg("Adres zorunlu.");
    return;
  }
  if (Math.abs(amount - need) > 0.05) {
    musicJoinMsg("Havale tutarı " + need + " Türk Lirası olmalı.");
    return;
  }
  if (plan === "month") {
    musicJoinMsg("Dekont kontrol ediliyor…");
    try {
      await musicInspectDekont(file);
    } catch (err) {
      musicJoinMsg(err.message || "Dekont doğrulanamadı.");
      return;
    }
  }
  musicJoinMsg("e-Fatura oluşturuluyor…");
  try {
    const res = await fetch("/music-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first,
        last,
        phone,
        email,
        taxId,
        address,
        plan,
        amount: need,
        dekontName: file?.name || "",
        dekontSize: file?.size || 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      musicJoinMsg(data.error || "Fatura oluşturulamadı.");
      return;
    }
    const member = {
      id: "msub_" + Date.now(),
      first,
      last,
      phone,
      email,
      taxId,
      address,
      plan,
      amount: need,
      vatRate: 20,
      vat: data.vat,
      ok: false,
      pending: true,
      until: 0,
      at: Date.now(),
      dekont: file?.name || "",
      dekontSize: file?.size || 0,
      invoiceNumber: data.invoiceNumber,
      invoiceToken: data.token,
      mailed: !!data.mailed,
      trendyol: !!data.trendyol,
    };
    store.set(MUSIC_SUB, member);
    store.set(MUSIC_MEMBERS, [member].concat(musicMembers()).slice(0, 80));
    musicJoinMsg(data.message || "Üyelik süreci inceleniyor.");
    musicMsg("Üyelik süreci inceleniyor.");
    if ($("#musicInvoiceNo")) $("#musicInvoiceNo").value = "";
    renderMusic();
  } catch {
    musicJoinMsg("Fatura servisine ulaşılamadı.");
  }
});

$("#musicActivateForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const sub = musicSubNow();
  const invoiceNumber = ($("#musicInvoiceNo")?.value || "").toUpperCase().replace(/\s+/g, "");
  if (!sub?.pending || !sub.invoiceNumber) {
    musicActivateMsg("Önce ödemeyi gönderin.");
    return;
  }
  if (sub.plan === "month" && !sub.dekont) {
    musicActivateMsg("Aylık üyelik için dekont kaydı yok.");
    return;
  }
  if (invoiceNumber !== String(sub.invoiceNumber).toUpperCase()) {
    musicActivateMsg("Fatura numarası e-postadaki ile aynı olmalı.");
    return;
  }
  musicActivateMsg("Fatura numarası kontrol ediliyor…");
  try {
    const res = await fetch("/music-invoice-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceNumber,
        email: sub.email,
        plan: sub.plan,
        amount: sub.amount,
        token: sub.invoiceToken,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      musicActivateMsg(data.error || "Fatura doğrulanamadı.");
      return;
    }
    const until = data.until || Date.now() + musicPlanDays(sub.plan) * 86400000;
    const member = { ...sub, ok: true, pending: false, until, activatedAt: Date.now() };
    store.set(MUSIC_SUB, member);
    store.set(
      MUSIC_MEMBERS,
      [member].concat(musicMembers().filter((row) => row.id !== member.id)).slice(0, 80)
    );
    musicActivateMsg("Fatura doğrulandı. Aboneliğiniz aktif.");
    musicMsg("Abonelik aktif.");
    renderMusic();
  } catch {
    musicActivateMsg("Doğrulama servisine ulaşılamadı.");
  }
});

$("#musicAdminForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const user = $("#musicAdminUser").value.trim();
  const pin = $("#musicAdminPin").value;
  if (user !== POS_ADMIN_USER || pin !== posAdminPinValue()) {
    if ($("#musicAdminMsg")) $("#musicAdminMsg").textContent = "Bilgiler hatalı.";
    return;
  }
  const remember = $("#musicAdminRemember")?.checked !== false;
  store.set(POS_ADMIN_ON, true);
  store.set(POS_ADMIN_REMEMBER, remember ? { remember: true, user, pin } : { remember: false });
  $("#musicAdminPin").value = "";
  if ($("#musicAdminMsg")) $("#musicAdminMsg").textContent = "Süper admin · ücretsiz erişim açık.";
  syncOwnerApps();
  renderMusic();
});

$("#musicAdminOut")?.addEventListener("click", () => {
  store.set(POS_ADMIN_ON, false);
  syncOwnerApps();
  renderMusic();
});

musicInstallCaptureGuard();

$("#musicList")?.addEventListener("click", (event) => {
  const load = event.target.closest("[data-music-load]");
  const play = event.target.closest("[data-music-play]");
  const del = event.target.closest("[data-music-del]");
  if (del) {
    store.set(
      MUSIC_KEY,
      musicSongs().filter((row) => row.id !== del.dataset.musicDel)
    );
    renderMusic();
    return;
  }
  const id = load?.dataset.musicLoad || play?.dataset.musicPlay;
  const song = musicSongs().find((row) => row.id === id);
  if (!song) return;
  $("#musicTitle").value = song.title;
  $("#musicStyle").value = song.style;
  $("#musicTempo").value = String(song.tempo);
  $("#musicLyrics").value = song.lyrics || "";
  if ($("#musicTempoVal")) $("#musicTempoVal").textContent = String(song.tempo);
  musicInvalidateSong();
  if (play) {
    if (musicVocals[1].buffer) musicStartPreview();
    else musicPlayLoop();
  } else musicMsg("Şarkı açıldı. Vokal varsa önizleyin.");
});

const CLIP_KEY = "ai-clips";
let clipImages = [];
let clipAudioBuf = null;
let clipPlan = null;
let clipPlaying = false;
let clipRaf = 0;
let clipSources = [];
let clipT0 = 0;
let clipExporting = false;

function clipMsg(text) {
  if ($("#clipMsg")) $("#clipMsg").textContent = text || "";
}

function clipRows() {
  return store.get(CLIP_KEY, []);
}

const CLIP_TRIAL = "clip-trial";
const CLIP_SUB = "clip-sub";
const CLIP_MEMBERS = "clip-members";
const CLIP_TRIAL_MS = 14 * 24 * 60 * 60 * 1000;

function clipBeginTrial() {
  if (!store.get(CLIP_TRIAL, null)?.at) store.set(CLIP_TRIAL, { at: Date.now() });
}

function clipTrialLeft() {
  const row = store.get(CLIP_TRIAL, null);
  if (!row?.at) return CLIP_TRIAL_MS;
  return Math.max(0, row.at + CLIP_TRIAL_MS - Date.now());
}

function clipSubNow() {
  return store.get(CLIP_SUB, null);
}

function clipMembers() {
  return store.get(CLIP_MEMBERS, []);
}

function clipIsSuper() {
  return ownerAppsOn();
}

function clipSubActive() {
  const sub = clipSubNow();
  return !!(sub?.ok && sub.until && sub.until > Date.now());
}

function clipCanUse() {
  return clipIsSuper() || clipSubActive() || clipTrialLeft() > 0;
}

function clipJoinMsg(text) {
  if ($("#clipJoinMsg")) $("#clipJoinMsg").textContent = text || "";
}

function clipSubPending() {
  const sub = clipSubNow();
  return !!(sub?.pending && !clipSubActive());
}

function clipActivateMsg(text) {
  if ($("#clipActivateMsg")) $("#clipActivateMsg").textContent = text || "";
}

function clipNeedAccess() {
  if (clipCanUse()) return true;
  clipSyncGate();
  const text = "Üye ol hesabını aktifleştir klip yapmaya başla";
  clipMsg(text);
  clipLiveMsg(text);
  return false;
}

function clipSyncGate() {
  const paid = clipSubActive() || clipIsSuper();
  const trialOn = clipTrialLeft() > 0 && !clipSubActive();
  const pending = clipSubPending();
  const gate = $("#clipBuyBox");
  const studio = $("#clipStudio");
  const admin = $("#clipAdminPanel");
  const hint = $("#clipTrialHint");
  const expired = $("#clipExpiredHead");
  const lede = $("#clipBuyLede");
  const join = $("#clipJoinForm");
  const review = $("#clipReviewBox");
  if (gate) gate.hidden = paid;
  if (join) join.hidden = paid || pending;
  if (review) review.hidden = !pending || paid;
  if (studio) studio.hidden = !clipCanUse();
  if (admin) admin.hidden = !clipIsSuper();
  if (expired) expired.hidden = paid || trialOn || pending;
  if (lede) {
    lede.hidden = pending;
    lede.textContent = trialOn
      ? "Deneme sürümündesiniz. İsterseniz hemen satın alın: Aylık 49 ₺, Yıllık 750 ₺. KDV %20 faturaya işlenir."
      : "14 günlük deneme bitti. Aylık 49 Türk Lirası veya Yıllık 750 Türk Lirası ödeyin. Fatura KDV’si %20.";
  }
  const sub = clipSubNow();
  if ($("#clipReviewLede") && pending) {
    $("#clipReviewLede").textContent = sub?.mailed
      ? "Faturanız e-posta ile gönderildi. Üyelik süreci inceleniyor. Fatura numarasını girip üyeliğinizi aktif edin."
      : "Üyelik süreci inceleniyor. Fatura numaranızı girin; doğrulanınca üyelik açılır.";
  }
  if (hint) {
    if (clipIsSuper()) hint.textContent = "Süper admin · tüm özellikler ücretsiz.";
    else if (clipSubActive()) {
      const left = Math.ceil((clipSubNow().until - Date.now()) / 86400000);
      hint.textContent = `Abonelik aktif · ${left} gün kaldı.`;
    } else if (pending) hint.textContent = "Üyelik süreci inceleniyor. Fatura numaranızı girin.";
    else if (trialOn) {
      const days = Math.max(1, Math.ceil(clipTrialLeft() / 86400000));
      hint.textContent = `14 günlük deneme · ${days} gün kaldı. Doğrudan satın alabilirsiniz.`;
    } else hint.textContent = "";
  }
  const list = $("#clipMemberList");
  if (list && clipIsSuper()) {
    const rows = clipMembers();
    list.innerHTML = rows.length
      ? rows
          .map(
            (row) =>
              `<article class="card"><strong>${escapeHtml(row.first)} ${escapeHtml(row.last)}</strong><p class="hint">${escapeHtml(
                row.phone
              )} · ${row.plan === "year" ? "Yıllık 750 ₺" : "Aylık 49 ₺"} · KDV %20 · ${
                row.ok ? new Date(row.until).toLocaleDateString("tr-TR") : "inceleniyor"
              }${row.invoiceNumber ? " · " + escapeHtml(row.invoiceNumber) : ""}</p></article>`
          )
          .join("")
      : "<p class='hint'>Henüz abone yok.</p>";
  }
}

function clipSelectPlan(plan) {
  const value = plan === "year" ? "year" : "month";
  $$("input[name='clipPlan']").forEach((el) => {
    el.checked = el.value === value;
  });
  $$("[data-clip-plan]").forEach((el) => el.classList.toggle("is-on", el.dataset.clipPlan === value));
  if ($("#clipPayAmount")) $("#clipPayAmount").value = String(musicPlanAmount(value));
  const month = value === "month";
  if ($("#clipDekont")) $("#clipDekont").required = month;
  if ($("#clipDekontHint")) {
    $("#clipDekontHint").textContent = month
      ? "Aylık havale: dekont yükleyin. Dekont ve fatura numarası doğrulanınca üyelik açılır."
      : "Yıllık: ödeme sonrası e-fatura mailinize gelir. Fatura numarası ile üyeliği aktif edin.";
  }
}

function clipHash(text) {
  let h = 2166136261;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function clipPalette(style, seed) {
  const packs = {
    sarki: ["#5b1d88", "#c45ae0", "#f0d78c"],
    reklam: ["#7a1ea8", "#ffd60a", "#ffffff"],
    hikaye: ["#3a0d52", "#8c2cb8", "#f6e7ff"],
    urun: ["#641e7c", "#e8c36a", "#fff8e7"],
    duyuru: ["#4a1570", "#3ee0c3", "#ffffff"],
  };
  const base = packs[style] || packs.sarki;
  return seed % 2 ? [base[1], base[0], base[2]] : base;
}

function clipLines(prompt) {
  const parts = String(prompt || "")
    .split(/[\n.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length) return parts;
  return ["Yeni bir sahne", "Hareket ve ritim", "Kapanış"];
}

function clipBuildPlan() {
  const title = ($("#clipTitle")?.value || "").trim() || "Yeni klip";
  const style = $("#clipStyle")?.value || "sarki";
  const duration = Math.max(15, Math.min(600, Number($("#clipDur")?.value || 15)));
  const prompt = ($("#clipPrompt")?.value || "").trim();
  if (prompt.length < 8) throw new Error("Klip ne anlatsın, biraz daha yazın.");
  const seed = clipHash(title + "|" + style + "|" + prompt);
  const lines = clipLines(prompt);
  const count = Math.max(3, Math.min(40, Math.round(duration / 15)));
  const hooks = {
    sarki: ["Giriş", "Ritim", "Nakarat", "Final"],
    reklam: ["Dikkat", "Ürün", "Fayda", "Harekete geç"],
    hikaye: ["Başla", "Dönüm", "Duygu", "Son"],
    urun: ["Vitrin", "Detay", "Kullanım", "Çağrı"],
    duyuru: ["Duyuru", "Bilgi", "Çağrı", "Kapanış"],
  }[style] || ["Sahne"];
  const scenes = [];
  for (let i = 0; i < count; i++) {
    scenes.push({
      hook: hooks[i % hooks.length],
      line: lines[i % lines.length],
      color: clipPalette(style, seed + i * 17),
    });
  }
  const bpm = 88 + (seed % 50);
  return { title, style, duration, prompt, scenes, seed, bpm, images: clipImages.slice() };
}

function clipStage() {
  const el = $("#clipStage");
  if (el) el.classList.add("is-on");
  return el;
}

function clipRoundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function clipCover(g, img, w, h, t, i) {
  const iw = img.width || 1;
  const ih = img.height || 1;
  const scale = Math.max(w / iw, h / ih) * (1.08 + Math.sin(t * 0.35 + i) * 0.06);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (w - dw) / 2 + Math.sin(t * 0.2 + i) * 18;
  const dy = (h - dh) / 2 + Math.cos(t * 0.18 + i) * 12;
  g.drawImage(img, dx, dy, dw, dh);
}

function clipDrawFrame(stage, plan, time) {
  const g = stage.getContext("2d");
  const w = stage.width;
  const h = stage.height;
  const dur = plan.duration;
  const t = ((time % dur) + dur) % dur;
  const idx = Math.min(plan.scenes.length - 1, Math.floor((t / dur) * plan.scenes.length));
  const scene = plan.scenes[idx];
  const [c0, c1, c2] = scene.color;
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, c0);
  grd.addColorStop(1, c1);
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  const img = plan.images[idx % Math.max(1, plan.images.length)];
  if (img) {
    g.save();
    g.globalAlpha = 0.92;
    clipCover(g, img, w, h, t, idx);
    g.restore();
    g.fillStyle = "rgba(40, 8, 64, 0.38)";
    g.fillRect(0, 0, w, h);
  }
  for (let k = 0; k < 6; k++) {
    const pulse = 0.5 + 0.5 * Math.sin(t * (plan.bpm / 60) * Math.PI * 2 + k);
    g.fillStyle = "rgba(240, 215, 140," + (0.05 + pulse * 0.08) + ")";
    g.beginPath();
    g.arc((k * 137 + t * 40) % w, (k * 211) % h, 40 + pulse * 50, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.fillRect(0, 0, w, 160);
  g.fillRect(0, h - 280, w, 280);
  g.fillStyle = "#fff";
  g.font = "700 42px Instrument Sans, sans-serif";
  g.textAlign = "center";
  g.fillText(plan.title.slice(0, 22), w / 2, 88, w - 80);
  g.fillStyle = c2;
  g.font = "700 28px Instrument Sans, sans-serif";
  g.fillText(scene.hook, w / 2, h - 180, w - 80);
  g.fillStyle = "#fff";
  g.font = "600 36px Instrument Sans, sans-serif";
  const words = scene.line.split(" ");
  let line = "";
  let y = h - 120;
  words.forEach((word, i) => {
    const next = line ? line + " " + word : word;
    if (g.measureText(next).width > w - 100 && line) {
      g.fillText(line, w / 2, y, w - 80);
      line = word;
      y += 44;
    } else line = next;
    if (i === words.length - 1) g.fillText(line, w / 2, y, w - 80);
  });
  g.fillStyle = "rgba(255,255,255,0.7)";
  g.font = "600 22px Instrument Sans, sans-serif";
  g.fillText("Yapay zeka klibi", w / 2, h - 36);
}

function stopAiClip() {
  clipPlaying = false;
  cancelAnimationFrame(clipRaf);
  clipSources.forEach((src) => {
    try {
      src.stop();
    } catch {
      /* */
    }
  });
  clipSources = [];
}

function clipBed(plan) {
  const ctx = nfcAudio();
  const dest = ctx.createMediaStreamDestination();
  const master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  master.connect(dest);
  if (clipAudioBuf) {
    const src = ctx.createBufferSource();
    src.buffer = clipAudioBuf;
    src.loop = true;
    src.connect(master);
    src.start();
    clipSources.push(src);
    return dest;
  }
  const bpm = plan.bpm;
  const now = ctx.currentTime;
  const end = now + plan.duration + 1;
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const g = ctx.createGain();
  const lfoGain = ctx.createGain();
  osc.type = "triangle";
  osc2.type = "sawtooth";
  osc.frequency.value = 110 + (plan.seed % 18);
  osc2.frequency.value = 164 + (plan.seed % 12);
  lfo.frequency.value = bpm / 60;
  lfoGain.gain.value = 0.08;
  g.gain.value = 0.12;
  lfo.connect(lfoGain);
  lfoGain.connect(g.gain);
  osc.connect(g);
  osc2.connect(g);
  g.connect(master);
  osc.start(now);
  osc2.start(now);
  lfo.start(now);
  osc.stop(end);
  osc2.stop(end);
  lfo.stop(end);
  clipSources.push(osc, osc2, lfo);
  return dest;
}

function clipTick() {
  if (!clipPlaying || !clipPlan) return;
  const stage = clipStage();
  const t = (performance.now() - clipT0) / 1000;
  if (t >= clipPlan.duration) {
    stopAiClip();
    clipMsg("Klip bitti.");
    return;
  }
  clipDrawFrame(stage, clipPlan, t);
  clipRaf = requestAnimationFrame(clipTick);
}

async function clipStartPreview() {
  if (!clipNeedAccess()) return;
  try {
    clipPlan = clipBuildPlan();
  } catch (err) {
    clipMsg(err.message);
    return;
  }
  stopAiClip();
  const ctx = nfcAudio();
  await ctx.resume?.();
  const stage = clipStage();
  clipDrawFrame(stage, clipPlan, 0);
  clipBed(clipPlan);
  clipPlaying = true;
  clipT0 = performance.now();
  clipMsg("Klip üretiliyor… önizleme.");
  clipTick();
}

function renderAiClip() {
  clipSyncGate();
  const list = $("#clipList");
  if (!list) return;
  const rows = clipRows();
  list.innerHTML =
    rows
      .map(
        (row) => `<article class="card"><strong>${escapeHtml(row.title)}</strong><p class="hint">${escapeHtml(
          row.style
        )} · ${row.duration} sn · ${new Date(row.at).toLocaleString("tr-TR")}</p><p>${escapeHtml(
          (row.prompt || "").slice(0, 140)
        )}</p></article>`
      )
      .join("") || "<p class='hint'>Henüz klip yok. Konu yazıp üretin, sonra galeriye kaydedin.</p>";
}

async function clipLoadFiles(files) {
  const list = [...(files || [])].slice(0, 8);
  const loaded = [];
  for (const file of list) {
    if (!file.type.startsWith("image/")) continue;
    const url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Fotoğraf okunamadı."));
      el.src = url;
    });
    loaded.push(img);
  }
  clipImages = loaded;
  if ($("#clipPhotoHint")) {
    $("#clipPhotoHint").textContent = loaded.length
      ? loaded.length + " fotoğraf yüklendi. Sahneler bu görsellerle kurulur."
      : "Fotoğraf yoksa yapay zeka renk ve yazı ile sahne üretir.";
  }
}

async function clipSaveToGallery() {
  if (!clipNeedAccess()) return;
  if (clipExporting) return;
  try {
    clipPlan = clipBuildPlan();
  } catch (err) {
    clipMsg(err.message);
    return;
  }
  clipExporting = true;
  clipMsg("Video kaydediliyor…");
  stopAiClip();
  const stage = clipStage();
  if (!stage?.captureStream) {
    clipMsg("Bu tarayıcı video kaydını desteklemiyor.");
    clipExporting = false;
    return;
  }
  const ctx = nfcAudio();
  await ctx.resume?.();
  clipDrawFrame(stage, clipPlan, 0);
  const vstream = stage.captureStream(30);
  try {
    vstream.getAudioTracks().forEach((track) => vstream.removeTrack(track));
  } catch {
    /* */
  }
  const dest = clipBed(clipPlan);
  dest.stream.getAudioTracks().forEach((track) => vstream.addTrack(track));
  const rec = musicRecorderFor(vstream);
  const chunks = [];
  rec.ondataavailable = (ev) => {
    if (ev.data?.size) chunks.push(ev.data);
  };
  const done = new Promise((resolve) => {
    rec.onstop = () => resolve();
  });
  rec.start(200);
  clipPlaying = true;
  clipT0 = performance.now();
  const fpsWait = (ms) => new Promise((r) => setTimeout(r, ms));
  const start = performance.now();
  while (performance.now() - start < clipPlan.duration * 1000) {
    clipDrawFrame(stage, clipPlan, (performance.now() - start) / 1000);
    await fpsWait(33);
  }
  stopAiClip();
  rec.stop();
  await done;
  vstream.getTracks().forEach((track) => track.stop());
  const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
  store.set(
    CLIP_KEY,
    [{ id: "clip_" + Date.now(), title: clipPlan.title, style: clipPlan.style, duration: clipPlan.duration, prompt: clipPlan.prompt, at: Date.now() }]
      .concat(clipRows())
      .slice(0, 40)
  );
  renderAiClip();
  const how = await saveBlobToPhoneGallery(blob, videoFileName(blob.type).replace("sarki", "klip"));
  clipExporting = false;
  if (how === "abort") clipMsg("Paylaşım iptal.");
  else if (how === "share") clipMsg("Klip galeriye gönderildi.");
  else clipMsg("Klip indirildi. Telefonda Dosyalar veya Galeri’den açın.");
}

$("#clipPhotos")?.addEventListener("change", (event) => {
  clipLoadFiles(event.target.files).catch((err) => clipMsg(err.message));
});

$("#clipAudio")?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  clipAudioBuf = null;
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    clipAudioBuf = await nfcAudio().decodeAudioData(buf.slice(0));
    clipMsg("Müzik yüklendi.");
  } catch {
    clipMsg("Ses dosyası okunamadı.");
  }
});

$("#clipPlay")?.addEventListener("click", () => clipStartPreview());
$("#clipStop")?.addEventListener("click", () => {
  stopAiClip();
  clipMsg("Durdu.");
});
$("#clipSave")?.addEventListener("click", () => clipSaveToGallery());
$("#clipForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  clipStartPreview();
});

const CLIP_SHOTS = [
  { id: "orijinal", name: "Orijinal", filter: "none" },
  { id: "sinema", name: "Sinema", filter: "contrast(1.14) saturate(0.9) brightness(0.97)" },
  { id: "siyahbeyaz", name: "Siyah beyaz", filter: "grayscale(1) contrast(1.2)" },
  { id: "vintage", name: "Vintage", filter: "sepia(0.35) contrast(1.08) saturate(0.85)" },
  { id: "canli", name: "Canlı", filter: "saturate(1.45) contrast(1.12)" },
  { id: "soguk", name: "Soğuk", filter: "hue-rotate(18deg) saturate(0.92) brightness(1.02)" },
  { id: "sicak", name: "Sıcak", filter: "sepia(0.18) saturate(1.2) brightness(1.04)" },
  { id: "altinsaat", name: "Altın saat", filter: "sepia(0.28) saturate(1.25) brightness(1.06)" },
  { id: "gece", name: "Gece", filter: "brightness(0.86) contrast(1.22) saturate(0.8)" },
  { id: "portre", name: "Portre", filter: "contrast(1.08) brightness(1.06) saturate(1.08)" },
  { id: "film", name: "Film", filter: "contrast(1.18) saturate(0.78) brightness(0.98)" },
  { id: "mat", name: "Mat", filter: "contrast(0.88) saturate(0.82) brightness(1.04)" },
  { id: "hdr", name: "HDR", filter: "contrast(1.28) saturate(1.18) brightness(1.04)" },
  { id: "pastel", name: "Pastel", filter: "saturate(0.7) brightness(1.1) contrast(0.92)" },
  { id: "kontrast", name: "Kontrast", filter: "contrast(1.4) saturate(1.05)" },
  { id: "fade", name: "Fade", filter: "contrast(0.84) brightness(1.08) saturate(0.75)" },
  { id: "turkuaz", name: "Turkuaz", filter: "hue-rotate(150deg) saturate(0.85)" },
  { id: "gul", name: "Gül", filter: "hue-rotate(-12deg) saturate(1.2) brightness(1.05)" },
  { id: "sepia", name: "Sepia", filter: "sepia(0.7) contrast(1.05)" },
  { id: "net", name: "Net", filter: "contrast(1.22) saturate(1.08) brightness(1.03)" },
];
const CLIP_MAKEUP = [
  { id: "nude", name: "Nude", blush: "rgba(232,176,150,0.22)", lip: "rgba(196,92,92,0.28)" },
  { id: "dogal", name: "Doğal", blush: "rgba(224,160,140,0.18)", lip: "rgba(180,90,90,0.22)" },
  { id: "pembe", name: "Pembe", blush: "rgba(240,140,170,0.28)", lip: "rgba(220,80,120,0.35)" },
  { id: "kirmizi", name: "Kırmızı", blush: "rgba(220,120,110,0.2)", lip: "rgba(176,24,40,0.42)" },
  { id: "smoky", name: "Smoky", blush: "rgba(120,90,110,0.18)", lip: "rgba(80,40,50,0.32)" },
  { id: "bronz", name: "Bronz", blush: "rgba(196,132,72,0.28)", lip: "rgba(160,72,48,0.3)" },
  { id: "seftali", name: "Şeftali", blush: "rgba(255,170,130,0.28)", lip: "rgba(220,100,80,0.3)" },
  { id: "glow", name: "Glow", blush: "rgba(255,210,180,0.24)", lip: "rgba(210,120,110,0.22)" },
  { id: "kore", name: "Kore", blush: "rgba(255,150,170,0.3)", lip: "rgba(230,90,110,0.28)" },
  { id: "gecemakyaj", name: "Gece", blush: "rgba(150,70,110,0.22)", lip: "rgba(120,20,50,0.4)" },
];
const CLIP_HAIR = [
  { id: "uzun", name: "Uzun saç" },
  { id: "kisa", name: "Kısa saç" },
];
const CLIP_HAIR_COLOR = [
  { id: "sari", name: "Sarı", color: "rgba(240,210,70,0.38)" },
  { id: "mavi", name: "Mavi", color: "rgba(70,120,230,0.38)" },
  { id: "yesil", name: "Yeşil", color: "rgba(70,180,90,0.38)" },
  { id: "bronzsac", name: "Bronz", color: "rgba(176,112,48,0.4)" },
  { id: "altinsac", name: "Altın", color: "rgba(212,175,55,0.42)" },
];

const clipLive = {
  stream: null,
  rec: null,
  chunks: [],
  recording: false,
  looping: false,
  shot: "orijinal",
  beauty: false,
  makeup: "",
  hair: "",
  hairColor: "",
  fx: "shots",
  facing: "user",
  iso: 405,
  zoom: 0.5,
  face: null,
  detectAt: 0,
  detector: null,
  blob: null,
  previewUrl: "",
  lastW: 0,
  lastH: 0,
  opening: false,
};

function clipLiveMsg(text) {
  if ($("#clipLiveMsg")) $("#clipLiveMsg").textContent = text || "";
}

function clipLiveIsoBright() {
  const t = Math.log(clipLive.iso / 50) / Math.log(3200 / 50);
  return 0.7 + t * 0.85;
}

function clipLiveShotFilter() {
  const shot = CLIP_SHOTS.find((row) => row.id === clipLive.shot) || CLIP_SHOTS[0];
  const iso = `brightness(${clipLiveIsoBright().toFixed(3)})`;
  return shot.filter === "none" ? iso : `${shot.filter} ${iso}`;
}

function clipLiveFaceBox(w, h) {
  const f = clipLive.face;
  if (f) return { x: f.x * w, y: f.y * h, w: f.w * w, h: f.h * h };
  return { x: w * 0.28, y: h * 0.16, w: w * 0.44, h: h * 0.46 };
}

async function clipLiveDetect(video) {
  const now = performance.now();
  if (now - clipLive.detectAt < 280) return;
  clipLive.detectAt = now;
  try {
    if (!clipLive.detector && "FaceDetector" in window) {
      clipLive.detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    }
    if (!clipLive.detector) return;
    const faces = await clipLive.detector.detect(video);
    const box = faces[0]?.boundingBox;
    const vw = video.videoWidth || 1;
    const vh = video.videoHeight || 1;
    if (box) {
      clipLive.face = {
        x: box.x / vw,
        y: box.y / vh,
        w: box.width / vw,
        h: box.height / vh,
      };
    }
  } catch {
    /* tarayıcı yüz algılamazsa orta oval kullanılır */
  }
}

function clipLiveDrawFaceFx(g, w, h) {
  const need = clipLive.beauty || clipLive.makeup || clipLive.hair || clipLive.hairColor;
  if (!need) return;
  const box = clipLiveFaceBox(w, h);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  g.save();
  g.beginPath();
  g.ellipse(cx, cy, box.w * 0.52, box.h * 0.58, 0, 0, Math.PI * 2);
  g.clip();
  if (clipLive.beauty) {
    g.fillStyle = "rgba(255, 236, 224, 0.16)";
    g.fill();
  }
  const makeup = CLIP_MAKEUP.find((row) => row.id === clipLive.makeup);
  if (makeup) {
    g.fillStyle = makeup.blush;
    g.beginPath();
    g.ellipse(cx - box.w * 0.22, cy + box.h * 0.06, box.w * 0.16, box.h * 0.1, 0, 0, Math.PI * 2);
    g.ellipse(cx + box.w * 0.22, cy + box.h * 0.06, box.w * 0.16, box.h * 0.1, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = makeup.lip;
    g.beginPath();
    g.ellipse(cx, cy + box.h * 0.28, box.w * 0.16, box.h * 0.06, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  if (clipLive.hair || clipLive.hairColor) {
    const color = CLIP_HAIR_COLOR.find((row) => row.id === clipLive.hairColor)?.color || "rgba(40,20,10,0.18)";
    g.save();
    g.fillStyle = color;
    g.beginPath();
    if (clipLive.hair === "kisa") {
      g.ellipse(cx, box.y + box.h * 0.08, box.w * 0.5, box.h * 0.28, 0, Math.PI, 0);
    } else {
      g.ellipse(cx, box.y + box.h * 0.12, box.w * 0.58, box.h * 0.36, 0, Math.PI, 0);
      g.ellipse(cx - box.w * 0.42, cy + box.h * 0.15, box.w * 0.18, box.h * 0.55, 0.2, 0, Math.PI * 2);
      g.ellipse(cx + box.w * 0.42, cy + box.h * 0.15, box.w * 0.18, box.h * 0.55, -0.2, 0, Math.PI * 2);
    }
    g.fill();
    g.restore();
  }
}

function clipLivePaint() {
  const video = $("#clipLiveVideo");
  const canvas = $("#clipLiveCanvas");
  if (!video || !canvas || !clipLive.stream) return;
  const vw = video.videoWidth || clipLive.stream.getVideoTracks()[0]?.getSettings?.().width || 0;
  const vh = video.videoHeight || clipLive.stream.getVideoTracks()[0]?.getSettings?.().height || 0;
  if (!vw || !vh) return;
  const scale = Math.min(1, 1280 / Math.max(vw, vh));
  const outW = Math.max(2, Math.round(vw * scale));
  const outH = Math.max(2, Math.round(vh * scale));
  if (canvas.width !== outW || canvas.height !== outH) {
    canvas.width = outW;
    canvas.height = outH;
  }
  const z = Math.max(1, clipLive.zoom);
  const cw = vw / z;
  const ch = vh / z;
  const sx = (vw - cw) / 2;
  const sy = (vh - ch) / 2;
  const g =
    canvas.getContext("2d", { alpha: false, desynchronized: true }) || canvas.getContext("2d");
  if (!g) return;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  try {
    g.filter = clipLiveShotFilter();
  } catch {
    g.filter = "none";
  }
  g.drawImage(video, sx, sy, cw, ch, 0, 0, outW, outH);
  g.filter = "none";
  clipLiveDrawFaceFx(g, outW, outH);
  canvas.classList.add("is-on");
  clipLiveDetect(video);
}

function clipLiveTick() {
  if (!clipLive.looping) return;
  try {
    clipLivePaint();
  } catch {
    /* kare atlanır, döngü durmaz */
  }
  requestAnimationFrame(clipLiveTick);
}

function clipLiveLockPage(on) {
  document.documentElement.classList.toggle("clip-live-open", !!on);
  document.body.classList.toggle("clip-live-open", !!on);
  if (on) {
    const stage = $("#clipLiveStage");
    try {
      stage?.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" });
    } catch {
      stage?.scrollIntoView(true);
    }
    window.scrollTo(0, 0);
    const view = document.querySelector('.view[data-view="aiclip"]');
    if (view) view.scrollTop = 0;
  }
}

function clipLiveHalt() {
  clipLive.looping = false;
  if (clipLive.recording) {
    clipLive.recording = false;
    try {
      clipLive.rec?.stop();
    } catch {
      /* */
    }
  }
  clipLive.stream?.getTracks?.().forEach((track) => {
    try {
      track.stop();
    } catch {
      /* */
    }
  });
  clipLive.stream = null;
  const video = $("#clipLiveVideo");
  if (video) video.srcObject = null;
  $("#clipLiveCanvas")?.classList.remove("is-on");
  if ($("#clipLiveStage")) $("#clipLiveStage").hidden = true;
  if ($("#clipLiveOpen")) $("#clipLiveOpen").hidden = false;
  $("#clipLiveShutter")?.classList.remove("recording");
  clipLive.opening = false;
  clipLiveLockPage(false);
}

function clipLiveFillChips() {
  const shots = $("#clipLiveShots");
  const makeup = $("#clipLiveMakeup");
  const hair = $("#clipLiveHair");
  const color = $("#clipLiveHairColor");
  const beauty = $("#clipLiveBeautyRow");
  if (shots && !shots.childElementCount) {
    shots.innerHTML = CLIP_SHOTS.map(
      (row) => `<button type="button" data-clip-shot="${row.id}">${row.name}</button>`
    ).join("");
  }
  if (beauty && !beauty.childElementCount) {
    beauty.innerHTML =
      '<button type="button" data-clip-beauty="1">Güzelleştirme (sivilce ve izleri gizle)</button>';
  }
  if (makeup && !makeup.childElementCount) {
    makeup.innerHTML = CLIP_MAKEUP.map(
      (row) => `<button type="button" data-clip-makeup="${row.id}">${row.name}</button>`
    ).join("");
  }
  if (hair && !hair.childElementCount) {
    hair.innerHTML = CLIP_HAIR.map(
      (row) => `<button type="button" data-clip-hair="${row.id}">${row.name}</button>`
    ).join("");
  }
  if (color && !color.childElementCount) {
    color.innerHTML = CLIP_HAIR_COLOR.map(
      (row) => `<button type="button" data-clip-hair-color="${row.id}">${row.name}</button>`
    ).join("");
  }
  clipLiveSyncChips();
  clipLiveShowFx(clipLive.fx);
}

function clipLiveSyncChips() {
  $$("[data-clip-shot]").forEach((el) => el.classList.toggle("is-on", el.dataset.clipShot === clipLive.shot));
  $$("[data-clip-makeup]").forEach((el) => el.classList.toggle("is-on", el.dataset.clipMakeup === clipLive.makeup));
  $$("[data-clip-hair]").forEach((el) => el.classList.toggle("is-on", el.dataset.clipHair === clipLive.hair));
  $$("[data-clip-hair-color]").forEach((el) =>
    el.classList.toggle("is-on", el.dataset.clipHairColor === clipLive.hairColor)
  );
  $$("[data-clip-beauty]").forEach((el) => el.classList.toggle("is-on", clipLive.beauty));
}

function clipLiveShowFx(name) {
  clipLive.fx = name || "shots";
  $$("[data-clip-fx]").forEach((el) => el.classList.toggle("is-on", el.dataset.clipFx === clipLive.fx));
  $$("[data-clip-pane]").forEach((el) => {
    const on = el.dataset.clipPane === clipLive.fx;
    el.hidden = !on;
    el.classList.toggle("is-on", on);
  });
}

function clipLiveMinZoom() {
  return 0.5;
}

function clipLiveResetZoom() {
  const min = clipLiveMinZoom();
  clipLive.zoom = min;
  const range = $("#clipLiveZoom");
  if (range) {
    range.min = String(min);
    range.max = "10";
    range.value = String(min);
  }
  if ($("#clipLiveZoomVal")) $("#clipLiveZoomVal").textContent = `${String(min).replace(".", ",")}×`;
}

function clipLiveFacingUi() {
  const front = clipLive.facing === "user";
  $("#clipLiveStage")?.classList.toggle("front-cam", front);
  $("#clipLiveFlip")?.classList.toggle("front", front);
  if ($("#clipLiveFacing")) $("#clipLiveFacing").textContent = front ? "ön" : "arka";
}

async function clipLiveGetStream(wantFront = clipLive.facing === "user") {
  const facing = wantFront ? "user" : "environment";
  const specs = [
    { audio: iphoneAudioConstraints(), video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
    { audio: iphoneAudioConstraints(), video: { facingMode: { ideal: facing } } },
    { audio: true, video: { facingMode: facing } },
    { audio: true, video: true },
    { video: { facingMode: { ideal: facing } } },
    { video: true },
  ];
  let lastErr = null;
  for (const spec of specs) {
    try {
      const media = await navigator.mediaDevices.getUserMedia(spec);
      if (!media.getAudioTracks().length) {
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: iphoneAudioConstraints() });
          audioOnly.getAudioTracks().forEach((track) => media.addTrack(track));
        } catch {
          try {
            const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioOnly.getAudioTracks().forEach((track) => media.addTrack(track));
          } catch {
            /* kayıt videosuz ses olmadan da açılır */
          }
        }
      }
      return media;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Kamera açılamadı.");
}

async function clipLiveFlip() {
  if (!clipLive.stream || clipLive.opening) return;
  const nextFront = clipLive.facing !== "user";
  clipLive.opening = true;
  clipLive.stream.getVideoTracks().forEach((track) => {
    try {
      clipLive.stream.removeTrack(track);
      track.stop();
    } catch {
      /* */
    }
  });
  try {
    const videoOnly = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: nextFront ? "user" : "environment" } },
    });
    videoOnly.getVideoTracks().forEach((track) => clipLive.stream.addTrack(track));
    clipLive.facing = nextFront ? "user" : "environment";
    clipLiveResetZoom();
    clipLiveFacingUi();
    const video = $("#clipLiveVideo");
    if (video) {
      video.srcObject = clipLive.stream;
      video.play().catch(() => {});
    }
  } catch {
    clipLiveMsg("Kamera yönü değiştirilemedi.");
  } finally {
    clipLive.opening = false;
  }
}

async function clipLiveOpen() {
  if (!clipNeedAccess()) return;
  if (clipLive.opening || clipLive.stream) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    clipLiveMsg("Bu tarayıcı kamerayı desteklemiyor.");
    return;
  }
  clipLive.opening = true;
  clipLiveMsg("Kamera açılıyor…");
  try {
    clipLive.stream = await clipLiveGetStream(clipLive.facing === "user");
    await applyIphoneAudio(clipLive.stream).catch(() => {});
    const video = $("#clipLiveVideo");
    if (!video) throw new Error("Kamera alanı bulunamadı.");
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = clipLive.stream;
    clipLiveResetZoom();
    clipLiveFacingUi();
    clipLiveFillChips();
    if ($("#clipLiveStage")) $("#clipLiveStage").hidden = false;
    if ($("#clipLiveOpen")) $("#clipLiveOpen").hidden = true;
    if ($("#clipLiveDone")) $("#clipLiveDone").hidden = true;
    clipLive.looping = true;
    clipLiveTick();
    const playNow = () => video.play().catch(() => {});
    video.addEventListener("loadedmetadata", playNow, { once: true });
    playNow();
    clipLiveLockPage(true);
    clipLiveMsg("Görüntü açık. Filtreler yüze uygulanır, kayıt durmaz.");
  } catch (err) {
    clipLiveHalt();
    const name = err?.name || "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      clipLiveMsg("Kamera ve mikrofon izni gerekli. Ayarlardan izin verin.");
    } else if (name === "NotFoundError" || name === "OverconstrainedError") {
      clipLiveMsg("Bu cihazda kullanılabilir kamera bulunamadı.");
    } else if (name === "NotReadableError") {
      clipLiveMsg("Kamera başka uygulamada açık. Kapatıp tekrar deneyin.");
    } else {
      clipLiveMsg("Kamera açılamadı. Sayfayı yenileyip tekrar deneyin.");
    }
  } finally {
    clipLive.opening = false;
  }
}

function clipLiveStartRec() {
  if (clipLive.recording) return;
  const canvas = $("#clipLiveCanvas");
  if (!canvas?.captureStream || !clipLive.stream) {
    clipLiveMsg("Kayıt bu tarayıcıda açılamadı.");
    return;
  }
  clipLive.chunks = [];
  clipLive.blob = null;
  const vstream = canvas.captureStream(30);
  try {
    vstream.getAudioTracks().forEach((track) => vstream.removeTrack(track));
  } catch {
    /* */
  }
  clipLive.stream.getAudioTracks().forEach((track) => {
    if (track.readyState === "live") vstream.addTrack(track);
  });
  const rec = musicRecorderFor(vstream);
  rec.ondataavailable = (ev) => {
    if (ev.data?.size) clipLive.chunks.push(ev.data);
  };
  rec.onstop = () => {
    clipLive.blob = new Blob(clipLive.chunks, { type: rec.mimeType || "video/webm" });
    if (clipLive.previewUrl) URL.revokeObjectURL(clipLive.previewUrl);
    clipLive.previewUrl = URL.createObjectURL(clipLive.blob);
    const preview = $("#clipLivePreview");
    if (preview) {
      preview.src = clipLive.previewUrl;
      preview.play().catch(() => {});
    }
    if ($("#clipLiveDone")) $("#clipLiveDone").hidden = false;
    clipLiveMsg("Kayıt bitti. Önizleyin, kaydet derseniz Resimlerim’e gider.");
  };
  rec.start(250);
  clipLive.rec = rec;
  clipLive.recording = true;
  $("#clipLiveShutter")?.classList.add("recording");
  clipLiveMsg("Kayıt sürüyor. Filtre değiştirebilirsiniz.");
}

function clipLiveStopRec() {
  if (!clipLive.recording) return;
  clipLive.recording = false;
  $("#clipLiveShutter")?.classList.remove("recording");
  try {
    clipLive.rec?.stop();
  } catch {
    /* */
  }
}

async function clipLiveSave() {
  if (!clipLive.blob) {
    clipLiveMsg("Önce kaydı bitirin.");
    return;
  }
  const how = await saveBlobToPhoneGallery(clipLive.blob, videoFileName(clipLive.blob.type).replace("sarki", "klip"));
  const text =
    how === "abort"
      ? "Paylaşım iptal."
      : how === "share"
        ? "Video Resimlerim / Galeri’ye gönderildi."
        : "Video indirildi. Telefonda Resimlerim’den açın.";
  if ($("#clipLiveDoneMsg")) $("#clipLiveDoneMsg").textContent = text;
  clipLiveMsg(text);
}

$("#clipLiveOpen")?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  clipLiveOpen();
});
$("#clipLiveClose")?.addEventListener("click", () => {
  clipLiveHalt();
  clipLiveMsg("Kamera kapandı.");
});
$("#clipLiveShutter")?.addEventListener("click", () => {
  if (!clipNeedAccess()) return;
  if (clipLive.recording) clipLiveStopRec();
  else clipLiveStartRec();
});
$("#clipLiveFlip")?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  clipLiveFlip();
});
$("#clipLiveIsoRange")?.addEventListener("input", (event) => {
  clipLive.iso = Number(event.target.value) || 405;
});
$("#clipLiveZoom")?.addEventListener("input", (event) => {
  clipLive.zoom = Number(event.target.value) || clipLiveMinZoom();
  if ($("#clipLiveZoomVal")) $("#clipLiveZoomVal").textContent = `${String(clipLive.zoom).replace(".", ",")}×`;
});
$("#clipLiveFxTabs")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-clip-fx]");
  if (!btn) return;
  clipLiveShowFx(btn.dataset.clipFx);
});
$("#clipLiveBeautyRow")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-clip-beauty]");
  if (!btn) return;
  clipLive.beauty = !clipLive.beauty;
  clipLiveSyncChips();
});
$("#clipLiveShots")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-clip-shot]");
  if (!btn) return;
  clipLive.shot = btn.dataset.clipShot;
  clipLiveSyncChips();
});
$("#clipLiveMakeup")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-clip-makeup]");
  if (!btn) return;
  clipLive.makeup = clipLive.makeup === btn.dataset.clipMakeup ? "" : btn.dataset.clipMakeup;
  clipLiveSyncChips();
});
$("#clipLiveHair")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-clip-hair]");
  if (!btn) return;
  clipLive.hair = clipLive.hair === btn.dataset.clipHair ? "" : btn.dataset.clipHair;
  clipLiveSyncChips();
});
$("#clipLiveHairColor")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-clip-hair-color]");
  if (!btn) return;
  clipLive.hairColor = clipLive.hairColor === btn.dataset.clipHairColor ? "" : btn.dataset.clipHairColor;
  clipLiveSyncChips();
});
$("#clipLiveSave")?.addEventListener("click", () => clipLiveSave());

$("#clipBuyBox")?.addEventListener("click", (event) => {
  const planBtn = event.target.closest("[data-clip-plan]");
  if (!planBtn) return;
  clipSelectPlan(planBtn.dataset.clipPlan);
});

$$("input[name='clipPlan']").forEach((el) => {
  el.addEventListener("change", () => {
    if (el.checked) clipSelectPlan(el.value);
  });
});

$("#clipCopyIban")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(POS_SETTLE.ibanMasked);
    clipJoinMsg("IBAN kopyalandı.");
  } catch {
    clipJoinMsg(POS_SETTLE.ibanMasked);
  }
});

$("#clipJoinForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const first = $("#clipSubFirst").value.trim();
  const last = $("#clipSubLast").value.trim();
  const phone = $("#clipSubPhone").value.replace(/\D/g, "");
  const email = ($("#clipSubEmail")?.value || "").trim().toLowerCase();
  const taxId = ($("#clipSubTax")?.value || "").replace(/\D/g, "");
  const address = $("#clipSubAddress").value.trim();
  const plan = $$("input[name='clipPlan']").find((el) => el.checked)?.value || "month";
  const amount = Number(String($("#clipPayAmount").value || "").replace(",", "."));
  const file = $("#clipDekont")?.files?.[0];
  const need = musicPlanAmount(plan);
  if (first.length < 2 || last.length < 2) {
    clipJoinMsg("İsim ve soy isim zorunlu.");
    return;
  }
  if (phone.length < 10) {
    clipJoinMsg("Geçerli telefon yazın.");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    clipJoinMsg("Fatura için geçerli e-posta yazın.");
    return;
  }
  if (address.length < 10) {
    clipJoinMsg("Adres zorunlu.");
    return;
  }
  if (Math.abs(amount - need) > 0.05) {
    clipJoinMsg("Havale tutarı " + need + " Türk Lirası olmalı.");
    return;
  }
  if (plan === "month") {
    clipJoinMsg("Dekont kontrol ediliyor…");
    try {
      await musicInspectDekont(file);
    } catch (err) {
      clipJoinMsg(err.message || "Dekont doğrulanamadı.");
      return;
    }
  }
  clipJoinMsg("e-Fatura oluşturuluyor…");
  try {
    const res = await fetch("/music-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "clip",
        first,
        last,
        phone,
        email,
        taxId,
        address,
        plan,
        amount: need,
        dekontName: file?.name || "",
        dekontSize: file?.size || 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      clipJoinMsg(data.error || "Fatura oluşturulamadı.");
      return;
    }
    const member = {
      id: "csub_" + Date.now(),
      first,
      last,
      phone,
      email,
      taxId,
      address,
      plan,
      amount: need,
      vatRate: 20,
      vat: data.vat,
      ok: false,
      pending: true,
      until: 0,
      at: Date.now(),
      dekont: file?.name || "",
      dekontSize: file?.size || 0,
      invoiceNumber: data.invoiceNumber,
      invoiceToken: data.token,
      mailed: !!data.mailed,
      trendyol: !!data.trendyol,
    };
    store.set(CLIP_SUB, member);
    store.set(CLIP_MEMBERS, [member].concat(clipMembers()).slice(0, 80));
    clipJoinMsg(data.message || "Üyelik süreci inceleniyor.");
    clipMsg("Üyelik süreci inceleniyor.");
    if ($("#clipInvoiceNo")) $("#clipInvoiceNo").value = "";
    renderAiClip();
  } catch {
    clipJoinMsg("Fatura servisine ulaşılamadı.");
  }
});

$("#clipActivateForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const sub = clipSubNow();
  const invoiceNumber = ($("#clipInvoiceNo")?.value || "").toUpperCase().replace(/\s+/g, "");
  if (!sub?.pending || !sub.invoiceNumber) {
    clipActivateMsg("Önce ödemeyi gönderin.");
    return;
  }
  if (sub.plan === "month" && !sub.dekont) {
    clipActivateMsg("Aylık üyelik için dekont kaydı yok.");
    return;
  }
  if (invoiceNumber !== String(sub.invoiceNumber).toUpperCase()) {
    clipActivateMsg("Fatura numarası e-postadaki ile aynı olmalı.");
    return;
  }
  clipActivateMsg("Fatura numarası kontrol ediliyor…");
  try {
    const res = await fetch("/music-invoice-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceNumber,
        email: sub.email,
        plan: sub.plan,
        amount: sub.amount,
        token: sub.invoiceToken,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      clipActivateMsg(data.error || "Fatura doğrulanamadı.");
      return;
    }
    const until = data.until || Date.now() + musicPlanDays(sub.plan) * 86400000;
    const member = { ...sub, ok: true, pending: false, until, activatedAt: Date.now() };
    store.set(CLIP_SUB, member);
    store.set(CLIP_MEMBERS, [member].concat(clipMembers().filter((row) => row.id !== member.id)).slice(0, 80));
    clipActivateMsg("Fatura doğrulandı. Aboneliğiniz aktif.");
    clipMsg("Abonelik aktif.");
    renderAiClip();
  } catch {
    clipActivateMsg("Doğrulama servisine ulaşılamadı.");
  }
});

$("#clipAdminForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const user = $("#clipAdminUser").value.trim();
  const pin = $("#clipAdminPin").value;
  if (user !== POS_ADMIN_USER || pin !== posAdminPinValue()) {
    if ($("#clipAdminMsg")) $("#clipAdminMsg").textContent = "Bilgiler hatalı.";
    return;
  }
  const remember = $("#clipAdminRemember")?.checked !== false;
  store.set(POS_ADMIN_ON, true);
  store.set(POS_ADMIN_REMEMBER, remember ? { remember: true, user, pin } : { remember: false });
  $("#clipAdminPin").value = "";
  if ($("#clipAdminMsg")) $("#clipAdminMsg").textContent = "Süper admin · ücretsiz erişim açık.";
  syncOwnerApps();
  renderAiClip();
});

$("#clipAdminOut")?.addEventListener("click", () => {
  store.set(POS_ADMIN_ON, false);
  syncOwnerApps();
  renderAiClip();
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
      " Tolkan Uğur Özel IBAN’ına kabul edildi."
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
  name: "Tolkan Uğur Özel",
  branch: "",
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
          : p.method === "reklam"
            ? "Reklam"
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
    [p.settleName || POS_SETTLE.name, posMaskIban(p.settleIban || POS_SETTLE.iban)]
      .filter((part) => part && !/lüleburgaz/i.test(String(part)))
      .join(" · ")
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
      row("Reklam tahsilatı", true, n((p) => p.method === "reklam") + " işlem · Tolkan Uğur özel IBAN"),
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
    ["#gkPosKey", g.apiKey],
  ].forEach(([sel, val]) => {
    if ($(sel) && val) $(sel).value = val;
  });
  [
    ["#posGateSecret", g.secretKey],
    ["#posPaySecret", g.secretKey],
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
  posRefreshIyzicoHint();
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

function eimzaProductLabel(value) {
  if (value === "eimza-1y") return "1 Yıllık E-İmza";
  if (value === "eimza-3y") return "3 Yıllık E-İmza";
  if (value === "muhur") return "Mali Mühür";
  return "E-İmza";
}

function eimzaPayLabel(method) {
  if (method === "havale") return "Havale";
  if (method === "card") return "Kredi kartı";
  if (method === "iban") return "IBAN";
  return method || "Ödeme";
}

function eimzaPrices() {
  return store.get("eimza-prices", {});
}

function eimzaCartItems() {
  return store.get("eimza-cart", []);
}

function eimzaSetCart(items) {
  store.set("eimza-cart", items);
  eimzaRenderCartBadge();
}

function eimzaCartCount() {
  return eimzaCartItems().reduce((n, item) => n + Math.max(1, Number(item.qty) || 1), 0);
}

function eimzaRenderCartBadge() {
  const btn = $("#eimzaCartTabBtn");
  if (!btn) return;
  const n = eimzaCartCount();
  btn.textContent = n ? `Alışveriş Sepeti (${n})` : "Alışveriş Sepeti";
}

function eimzaMsg(text) {
  if ($("#eimzaMsg")) $("#eimzaMsg").textContent = text || "";
}

function eimzaShow(tab) {
  if ($("#eimzaShop")) $("#eimzaShop").hidden = tab !== "shop";
  if ($("#eimzaCart")) $("#eimzaCart").hidden = tab !== "cart";
  $$("[data-eimza-tab]").forEach((btn) => {
    const on = btn.dataset.eimzaTab === tab;
    btn.classList.toggle("gold", on);
    btn.classList.toggle("secondary", !on);
  });
  if (tab === "cart") renderEimzaCart();
}

function eimzaFillPrices() {
  const prices = eimzaPrices();
  $$("[data-eimza-id]").forEach((card) => {
    const input = card.querySelector(".product-price-input");
    if (!input || document.activeElement === input) return;
    input.value = prices[card.dataset.eimzaId] || "";
  });
}

function eimzaCartLines() {
  const prices = eimzaPrices();
  return eimzaCartItems()
    .map((line) => {
      const price = parseMoney(prices[line.id]);
      if (!Number.isFinite(price) || price === Number.POSITIVE_INFINITY || price <= 0) return null;
      return {
        id: line.id,
        name: eimzaProductLabel(line.id),
        qty: Math.max(1, Number(line.qty) || 1),
        price,
      };
    })
    .filter(Boolean);
}

function eimzaCartTotal() {
  return eimzaCartLines().reduce((sum, line) => sum + line.price * line.qty, 0);
}

function eimzaApps() {
  return store.get("eimza-apps", []);
}

function renderEimzaCart() {
  eimzaRenderCartBadge();
  const box = $("#eimzaCartList");
  if (!box) return;
  const items = eimzaCartLines();
  if (!items.length) {
    box.innerHTML = "<p class='hint'>Sepetiniz boş. Ürünlerden + ile ekleyin.</p>";
    $("#eimzaCartTotal").textContent = "";
    return;
  }
  box.innerHTML = items
    .map(
      (line) => `
      <article class="note">
        <strong>${escapeHtml(line.name)}</strong>
        <p class="price">${formatTry(line.price)} × ${line.qty} = ${formatTry(line.price * line.qty)}</p>
        <div class="row">
          <button class="secondary" type="button" data-eimza-qty="${line.id}" data-delta="-1">−</button>
          <button class="secondary" type="button" data-eimza-qty="${line.id}" data-delta="1">+</button>
          <button class="linkish" type="button" data-eimza-cart-del="${line.id}">Kaldır</button>
        </div>
      </article>`
    )
    .join("");
  $("#eimzaCartTotal").textContent = `Toplam ${formatTry(eimzaCartTotal())}`;
}

function renderEimzaOrders() {
  const list = $("#eimzaList");
  if (!list) return;
  const apps = eimzaApps().slice().reverse();
  list.innerHTML = apps.length
    ? apps
        .map((item) => {
          const products = Array.isArray(item.products)
            ? item.products.map((p) => eimzaProductLabel(p.id) + (p.qty > 1 ? ` ×${p.qty}` : "")).join(" · ")
            : eimzaProductLabel(item.product);
          const price = item.total ? ` · ${formatTry(item.total)}` : item.price ? ` · ₺${item.price}` : "";
          const pay = item.method ? ` · ${eimzaPayLabel(item.method)}` : "";
          return `<article class="card"><p><strong>${escapeHtml(products)}</strong>${escapeHtml(price)}${escapeHtml(pay)}</p><p>${escapeHtml(item.company || "")}</p><p class="hint">${escapeHtml(item.name || "")} · ${escapeHtml(item.phone || "")} · ${escapeHtml(item.city || "")}</p></article>`;
        })
        .join("")
    : "<p class='hint'>Henüz sipariş yok.</p>";
}

function renderEimza() {
  eimzaFillPrices();
  eimzaRenderCartBadge();
  renderEimzaCart();
  renderEimzaOrders();
}

function eimzaShowPay(method) {
  const map = { havale: "eimzaHavaleForm", card: "eimzaCardForm", iban: "eimzaIbanForm" };
  ["eimzaHavaleForm", "eimzaCardForm", "eimzaIbanForm"].forEach((id) => {
    const el = $("#" + id);
    if (el) el.hidden = id !== map[method];
  });
}

function eimzaBuyer() {
  return {
    company: $("#eimzaCompany")?.value.trim() || "",
    tax: $("#eimzaTax")?.value.trim() || "",
    name: $("#eimzaName")?.value.trim() || "",
    phone: $("#eimzaPhone")?.value.trim() || "",
    mail: $("#eimzaMail")?.value.trim() || "",
    city: $("#eimzaCity")?.value.trim() || "",
  };
}

function eimzaNeedBuyer() {
  const buyer = eimzaBuyer();
  if (!buyer.company || !buyer.name || !buyer.phone) {
    eimzaMsg("Ödeme için firma, yetkili ad soyad ve telefon yazın.");
    return null;
  }
  return buyer;
}

function eimzaFinishPay(method, extra) {
  const lines = eimzaCartLines();
  if (!lines.length) {
    eimzaMsg("Sepet boş. Önce ürün ekleyin.");
    return false;
  }
  const buyer = eimzaNeedBuyer();
  if (!buyer) return false;
  const apps = eimzaApps();
  apps.push({
    id: Date.now(),
    method,
    products: lines.map((line) => ({ id: line.id, qty: line.qty, price: line.price })),
    total: eimzaCartTotal(),
    ...buyer,
    ...extra,
  });
  store.set("eimza-apps", apps);
  eimzaSetCart([]);
  $("#eimzaHavaleForm")?.reset();
  $("#eimzaCardForm")?.reset();
  $("#eimzaIbanForm")?.reset();
  if ($("#eimzaHavaleIban")) $("#eimzaHavaleIban").value = POS_SETTLE.ibanMasked;
  eimzaShowPay("");
  renderEimza();
  eimzaMsg("Ödeme alındı. Siparişiniz kaydedildi.");
  return true;
}

$("#eimzaNav")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-eimza-tab]");
  if (!btn) return;
  eimzaShow(btn.dataset.eimzaTab);
});

$("#eimzaProducts")?.addEventListener("input", (event) => {
  const card = event.target.closest("[data-eimza-id]");
  if (!card || !event.target.classList.contains("product-price-input")) return;
  const prices = eimzaPrices();
  prices[card.dataset.eimzaId] = event.target.value;
  store.set("eimza-prices", prices);
});

$("#eimzaProducts")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-eimza-add]");
  if (!btn) return;
  const id = btn.dataset.eimzaAdd;
  const price = parseMoney(eimzaPrices()[id]);
  if (!Number.isFinite(price) || price === Number.POSITIVE_INFINITY || price <= 0) {
    eimzaMsg("Sepete eklemek için önce fiyat yazın.");
    return;
  }
  const items = eimzaCartItems();
  const hit = items.find((item) => item.id === id);
  if (hit) hit.qty = Math.min(99, Math.max(1, Number(hit.qty) || 1) + 1);
  else items.push({ id, qty: 1 });
  eimzaSetCart(items);
  eimzaMsg(`${eimzaProductLabel(id)} sepete eklendi.`);
});

$("#eimzaCartList")?.addEventListener("click", (event) => {
  const del = event.target.closest("[data-eimza-cart-del]");
  if (del) {
    eimzaSetCart(eimzaCartItems().filter((item) => item.id !== del.dataset.eimzaCartDel));
    renderEimzaCart();
    return;
  }
  const qty = event.target.closest("[data-eimza-qty]");
  if (!qty) return;
  const items = eimzaCartItems();
  const hit = items.find((item) => item.id === qty.dataset.eimzaQty);
  if (!hit) return;
  hit.qty = Math.max(0, Math.max(1, Number(hit.qty) || 1) + Number(qty.dataset.delta));
  eimzaSetCart(hit.qty ? items : items.filter((item) => item.id !== hit.id));
  renderEimzaCart();
});

$("#eimzaCartClear")?.addEventListener("click", () => {
  eimzaSetCart([]);
  renderEimzaCart();
  eimzaMsg("Sepet boşaltıldı.");
});

$$("[data-eimza-pay]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!eimzaCartLines().length) {
      eimzaMsg("Sepet boş. Önce ürün ekleyin.");
      return;
    }
    if (!eimzaNeedBuyer()) return;
    eimzaShowPay(btn.dataset.eimzaPay);
    eimzaMsg("");
  });
});

$("#eimzaCopyIban")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(POS_SETTLE.ibanMasked);
    eimzaMsg("IBAN kopyalandı.");
  } catch {
    eimzaMsg(POS_SETTLE.ibanMasked);
  }
});

$("#eimzaHavaleForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  eimzaFinishPay("havale", { iban: POS_SETTLE.ibanMasked });
});

$("#eimzaCardNumber")?.addEventListener("input", () => {
  const num = $("#eimzaCardNumber").value.replace(/\D/g, "");
  const brand = posCardBrandFromNumber(num);
  if (brand && [...$("#eimzaCardBrand").options].some((o) => o.value === brand)) {
    $("#eimzaCardBrand").value = brand;
  }
});

$("#eimzaCardExp")?.addEventListener("input", () => {
  let v = $("#eimzaCardExp").value.replace(/\D/g, "").slice(0, 4);
  if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
  $("#eimzaCardExp").value = v;
});

$("#eimzaCardForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const num = $("#eimzaCardNumber").value.replace(/\D/g, "");
  const exp = $("#eimzaCardExp").value.trim();
  const cvc = $("#eimzaCardCvc").value.replace(/\D/g, "");
  if (num.length < 13 || num.length > 19) {
    eimzaMsg("Geçerli kart numarası girin.");
    return;
  }
  if (!/^\d{2}\/\d{2}$/.test(exp)) {
    eimzaMsg("Son kullanma AA/YY olsun.");
    return;
  }
  if (cvc.length < 3) {
    eimzaMsg("CVC girin.");
    return;
  }
  eimzaFinishPay("card", { brand: $("#eimzaCardBrand").value, last4: num.slice(-4) });
});

$("#eimzaIbanFrom")?.addEventListener("input", () => {
  $("#eimzaIbanFrom").value = posFormatIban($("#eimzaIbanFrom").value);
});

$("#eimzaIbanForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!posIbanOk($("#eimzaIbanFrom").value)) {
    eimzaMsg("Geçerli TR IBAN yazın.");
    return;
  }
  eimzaFinishPay("iban", { from: posFormatIban($("#eimzaIbanFrom").value), iban: POS_SETTLE.ibanMasked });
});

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

async function posRefreshIyzicoHint() {
  const hint = $("#posIyzicoHint");
  if (!hint) return;
  try {
    const res = await fetch("/pos-status", { cache: "no-store" });
    const data = await res.json();
    hint.textContent = data.hint || hint.textContent;
    const btn = $("#posCardForm button[type=submit]");
    if (btn) btn.disabled = data.ready === false;
  } catch {
    hint.textContent =
      "iyzico durumu okunamadı. Canlı sitede Cloudflare anahtarları gerekir; yerel sunucuda kart tahsilatı açılmaz.";
  }
}

async function posFinishIyzicoPay(token) {
  if (!token) return;
  posMsg("iyzico ödeme sonucu kontrol ediliyor…");
  try {
    const res = await fetch("/pos-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!data.ok) {
      posMsg(data.error || "Ödeme alınamadı.");
      return;
    }
    const amount = parseMoney(data.paidPrice);
    const brand = data.cardAssociation || "Kart";
    const last4 = data.lastFourDigits || "";
    const ok = posRecordPay({
      amount,
      method: "card",
      note: "iyzico " + (data.paymentId || ""),
      detail: brand + (last4 ? " · **** " + last4 : "") + " · iyzico",
    });
    if (ok) {
      $("#posCardForm")?.reset();
      posMsg("iyzico tahsilatı alındı. " + (data.paymentId || ""));
    }
  } catch {
    posMsg("Ödeme sonucu alınamadı.");
  }
  const url = new URL(location.href);
  if (url.searchParams.has("posToken")) {
    url.searchParams.delete("posToken");
    history.replaceState({}, "", url.pathname + url.search + url.hash);
  }
}

$("#posCardForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const member = posCanCharge("card");
  if (!member) return;
  const amount = parseMoney($("#posCardAmount").value);
  if (!Number.isFinite(amount) || amount < 0.5) {
    posMsg("Geçerli tutar girin (en az 0,50 ₺).");
    return;
  }
  posMsg("iyzico ödeme sayfası açılıyor…");
  try {
    const res = await fetch("/pos-pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        note: $("#posCardNote").value.trim() || "Sanal POS tahsilat",
        name: member.name,
        email: member.email,
        phone: member.phone,
        address: member.address,
        identityNumber: $("#posCardTc")?.value.trim() || "",
      }),
    });
    const data = await res.json();
    if (!data.ok || !data.paymentPageUrl) {
      posMsg(data.error || "iyzico formu açılamadı.");
      return;
    }
    location.href = data.paymentPageUrl;
  } catch {
    posMsg("iyzico bağlantısı kurulamadı. Canlı sitede deneyin.");
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
  syncOwnerApps();
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
  syncOwnerApps();
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
  posMsg(formatTry(amount) + " " + from + " hesabından Tolkan Uğur Özel IBAN’ına çekildi.");
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

let ownerTaps = 0;
let ownerTapTimer = 0;
$(".brand")?.addEventListener("click", () => {
  if (ownerAppsOn()) return;
  ownerTaps += 1;
  clearTimeout(ownerTapTimer);
  ownerTapTimer = setTimeout(() => {
    ownerTaps = 0;
  }, 1800);
  if (ownerTaps < 5) return;
  ownerTaps = 0;
  const saved = store.get(POS_ADMIN_REMEMBER, null);
  if (saved?.remember && saved.user && $("#ownerUser")) $("#ownerUser").value = saved.user;
  if ($("#ownerMsg")) $("#ownerMsg").textContent = "Sanal Santral yalnızca sizin için.";
  if ($("#ownerModal")) $("#ownerModal").hidden = false;
});

$("#ownerClose")?.addEventListener("click", () => {
  if ($("#ownerModal")) $("#ownerModal").hidden = true;
});

$("#ownerForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const user = $("#ownerUser").value.trim();
  const pin = $("#ownerPin").value;
  if (user !== POS_ADMIN_USER || pin !== posAdminPinValue()) {
    if ($("#ownerMsg")) $("#ownerMsg").textContent = "Bilgiler hatalı.";
    return;
  }
  const remember = $("#ownerRemember")?.checked !== false;
  store.set(POS_ADMIN_ON, true);
  store.set(POS_ADMIN_REMEMBER, remember ? { remember: true, user, pin } : { remember: false });
  $("#ownerPin").value = "";
  if ($("#ownerModal")) $("#ownerModal").hidden = true;
  syncOwnerApps();
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
renderEimza();
renderMusic();
renderAiClip();