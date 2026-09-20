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
      if (el.id === "posWithdrawTarget" || el.id === "posSettleIban" || el.id === "posGateApi" || el.id === "posGateSecret" || el.id === "posPayApiKey" || el.id === "posCardApiKey" || el.id === "eimzaCardNumber" || el.id === "eimzaCardCvc" || el.id === "eimzaHavaleIban" || el.id === "ownerPin" || el.id === "yolLoginPin" || el.id === "yolRegPin") return;
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
  if (view.dataset.view === "home" || view.dataset.view === "camera" || view.dataset.view === "sell") return;
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
  const allowed = new Set(["home", "nfc", "stats", "sell", "desk", "about", "career", "contact", "recall", "sellerSell", "sellerBasics", "sellerAcademy", "helpFaq", "helpLive", "helpReturn", "helpGuide", "countrySelect", "safeShop", "securityCert"]);
  if (!allowed.has(name)) name = "home";
  if (name === "stats" && !ownerAppsOn()) name = "home";
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
  if (name === "eimza") renderEimza();
  if (name === "music") renderMusic();
  if (name === "aiclip") renderAiClip();
  if (name === "nfc") startNfcScan();
  else nfcSleepAudio();
  if (name === "stats") renderSiteStats();
  if (name === "sell") renderYolSeller();
  if (name === "desk") renderYolDesk();
  if (name === "home") renderYolMarket();
  if (name === "countrySelect") renderYolCountries();
  yolSyncSearch();
  yolSyncNav();
  yolSyncCountryUi();
  trackSiteApp(name);
  resumeSaveView(name);
  resumeRestoreScroll(name);
}

$$("[data-go]").forEach((el) => {
  el.addEventListener("click", () => {
    if (el.dataset.go === "home") {
      if ($("#yolAuthPanel")) $("#yolAuthPanel").hidden = true;
      yolShowPartner(false);
      renderYolSeller();
      renderYolMarket();
    }
    showView(el.dataset.go);
  });
});

const SITE_APP_LABELS = {
  home: "Ana sayfa",
  about: "Biz Kimiz",
  career: "Kariyer",
  contact: "İletişim",
  recall: "Geri Çağrılan Ürünler",
  sellerSell: "Harbi'de Satış Yap",
  sellerBasics: "Temel Kavramlar",
  sellerAcademy: "Harbi Akademi",
  helpFaq: "Sıkça Sorulan Sorular",
  helpLive: "Canlı Yardım",
  helpReturn: "Nasıl İade Edebilirim",
  helpGuide: "İşlem Rehberi",
  countrySelect: "Ülke Seç",
  safeShop: "Güvenli Alışveriş",
  securityCert: "Güvenlik Sertifikası",
  sell: "Ürün yükle",
  desk: "Kontrol paneli",
  camera: "Kamera",
  nfc: "NFC Kontrol",
  music: "Müzik Veya Şarkı Yap",
  aiclip: "Yapay Zeka İle Klip Yap",
  eimza: "E-İmza & Mali Mühür",
  notes: "Not Defteri",
  hygiene: "Hijyen Deryası",
  harbiyemek: "Harbi Yemek 7",
  flights: "Uçak Bileti",
  holiday: "Tatil Rezervasyonu",
  cars: "Oto Kiralama",
  homes: "Satılık ve Kiralık Ev",
  bikes: "Motorsiklet Kiralama",
  pbx: "Sanal Santral",
};

const SITE_STATS_KEY = "harbi-site-stats";
let siteTrackAt = {};

function siteMonthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}`;
}

function siteMonthTitle(key) {
  const [year, month] = String(key || "").split("-");
  const names = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  return names[Number(month)] ? `${names[Number(month)]} ${year}` : key;
}

function siteVisitorId() {
  let id = store.get("harbi-vid", "");
  if (!id) {
    id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    store.set("harbi-vid", id);
  }
  return id;
}

function siteEmptyMonth() {
  return { visits: 0, unique: 0, apps: {}, ids: {} };
}

function siteLocalAll() {
  return store.get(SITE_STATS_KEY, {});
}

function siteApplyLocal(app) {
  const month = siteMonthKey();
  const all = siteLocalAll();
  const row = all[month] || siteEmptyMonth();
  const visitor = siteVisitorId();
  const known = row.ids[visitor];
  if (!known) {
    row.unique += 1;
    row.ids[visitor] = app;
  } else if (!String(known).split(",").includes(app)) {
    row.ids[visitor] = `${known},${app}`;
  }
  row.visits += 1;
  const used = row.apps[app] || { visits: 0, unique: 0 };
  used.visits += 1;
  if (!String(known || "").split(",").filter(Boolean).includes(app)) used.unique += 1;
  row.apps[app] = used;
  all[month] = row;
  store.set(SITE_STATS_KEY, all);
}

function sitePublicMonth(row, key) {
  const apps = Object.entries(row?.apps || {})
    .map(([id, item]) => ({
      id,
      name: SITE_APP_LABELS[id] || id,
      visits: Number(item.visits) || 0,
      unique: Number(item.unique) || 0,
    }))
    .sort((a, b) => b.visits - a.visits || b.unique - a.unique);
  return {
    month: key,
    title: siteMonthTitle(key),
    visits: Number(row?.visits) || 0,
    unique: Number(row?.unique) || 0,
    apps,
  };
}

function trackSiteApp(name) {
  const app = SITE_APP_LABELS[name] ? name : "";
  if (!app) return;
  const now = Date.now();
  if (now - (siteTrackAt[app] || 0) < 20000) return;
  siteTrackAt[app] = now;
  siteApplyLocal(app);
  fetch("/site-stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app, vid: siteVisitorId() }),
  }).catch(() => {});
}

function sitePaint(data, live) {
  const month = data?.month || sitePublicMonth(siteEmptyMonth(), siteMonthKey());
  const months = data?.months?.length ? data.months : [month];
  const hint = $("#statsHint");
  const unique = $("#statsUnique");
  const visits = $("#statsVisits");
  const appsEl = $("#statsApps");
  const monthsEl = $("#statsMonths");
  const select = $("#statsMonth");
  if (hint) {
    hint.textContent = live
      ? `${month.title} ayında siteye giren kişi sayısı ve kullandıkları uygulamalar.`
      : "Yerel sayım. Yayın sonrası tüm ziyaretçiler bu ekranda toplanır.";
  }
  if (unique) unique.textContent = String(month.unique || 0);
  if (visits) visits.textContent = String(month.visits || 0);
  const max = Math.max(1, ...month.apps.map((item) => item.visits));
  if (appsEl) {
    appsEl.innerHTML =
      month.apps
        .map(
          (item) =>
            `<article class="stats-app"><header><strong>${escapeHtml(item.name)}</strong><span>${item.unique} kişi · ${item.visits} açılış</span></header><div class="stats-bar"><i style="width:${Math.max(8, Math.round((item.visits / max) * 100))}%"></i></div></article>`
        )
        .join("") || "<p class='hint'>Bu ay henüz uygulama kullanımı yok.</p>";
  }
  if (monthsEl) {
    monthsEl.innerHTML = months
      .map(
        (item) =>
          `<article class="note"><strong>${escapeHtml(item.title)}</strong><p>${item.unique} kişi · ${item.visits} açılış</p></article>`
      )
      .join("");
  }
  if (select && !select.dataset.ready) {
    select.innerHTML = months
      .map((item) => `<option value="${escapeHtml(item.month)}">${escapeHtml(item.title)}</option>`)
      .join("");
    select.dataset.ready = "1";
    select.addEventListener("change", () => renderSiteStats(select.value));
  }
  if (select && month.month) select.value = month.month;
}

async function renderSiteStats(month) {
  if (!ownerAppsOn()) {
    sitePaint({ month: sitePublicMonth(siteEmptyMonth(), siteMonthKey()), months: [] }, false);
    return;
  }
  const local = siteLocalAll();
  const keys = Object.keys(local).sort().reverse();
  const localMonths = (keys.length ? keys : [siteMonthKey()]).map((key) => sitePublicMonth(local[key] || siteEmptyMonth(), key));
  const want = month || $("#statsMonth")?.value || siteMonthKey();
  sitePaint(
    {
      month: localMonths.find((item) => item.month === want) || localMonths[0],
      months: localMonths,
    },
    false
  );
  try {
    const res = await fetch(`/site-stats?month=${encodeURIComponent(want)}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.ready && data.month) sitePaint(data, true);
  } catch {
    /* yerel sayım yeter */
  }
}

const isIOS =
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroid = /android/i.test(navigator.userAgent);
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

document.documentElement.classList.add(isIOS ? "is-ios" : isAndroid ? "is-android" : "is-desktop");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

let deferredPrompt = null;
const installBtn = $("#installBtn");
const installHint = $("#installHint");
const modal = $("#installModal");
const modalText = $("#modalInstallText");
const confirmInstall = $("#confirmInstall");
const installSteps = $("#installSteps");
const ua = navigator.userAgent || "";
const isIOSSafari =
  isIOS && /safari/i.test(ua) && !/crios|fxios|edgios|opios|opt\//i.test(ua);
const INSTALL_DONE_KEY = "yol-home-shortcut-v2";

function shortcutAlreadyAdded() {
  return isStandalone || store.get(INSTALL_DONE_KEY, false) === true;
}

function markShortcutAdded() {
  store.set(INSTALL_DONE_KEY, true);
  if (installBtn) installBtn.hidden = true;
  if ($("#installCard")) $("#installCard").hidden = true;
  if (modal) modal.hidden = true;
}

function syncInstallBtn() {
  if (!installBtn) return;
  installBtn.hidden = shortcutAlreadyAdded();
}

if (isStandalone) {
  if (installBtn) installBtn.hidden = true;
} else {
  syncInstallBtn();
  if (installHint) {
    if (isIOS) {
      installHint.textContent = isIOSSafari
        ? "Safari’de Paylaş > Ana Ekrana Ekle ile telefona kısayol iner."
        : "iPhone ve iPad’de kısayol için bu sayfayı Safari ile açın.";
    } else if (isAndroid) {
      installHint.textContent = "Düğmeye basın. Telefon izin verirse ana ekrana ekleme penceresi açılır.";
    } else {
      installHint.textContent = "Düğmeye basın. Destekleyen tarayıcıda uygulama olarak eklenir.";
    }
  }
}

function installKind() {
  if (isIOS) return isIOSSafari ? "ios-safari" : "ios-other";
  if (/samsungbrowser/i.test(ua)) return "samsung";
  if (/huawei|honor|harmonyos/i.test(ua)) return "huawei";
  if (/xiaomi|miuibrowser|mint browser/i.test(ua)) return "xiaomi";
  if (isAndroid && /edg/i.test(ua)) return "android-edge";
  if (isAndroid && /firefox|fxios/i.test(ua)) return "android-firefox";
  if (isAndroid && /opr\//i.test(ua)) return "android-opera";
  if (isAndroid) return "android-chrome";
  if (/edg/i.test(ua)) return "desktop-edge";
  if (/chrome|chromium/i.test(ua) && !/edg/i.test(ua)) return "desktop-chrome";
  return "generic";
}

function installGuide(kind) {
  const guides = {
    "ios-safari": {
      title: "Safari bu uygulamayı ana ekrana ekler. Aşağıdaki üç adımı uygulayın.",
      steps: [
        "Alttaki Paylaş simgesine basın (kare ve yukarı ok).",
        "Aşağı kaydırıp Ana Ekrana Ekle’ye basın.",
        "Sağ üstte Ekle’ye basın. İkon telefonda Harbi Yol olarak durur.",
      ],
    },
    "ios-other": {
      title: "iPhone ve iPad yalnızca Safari’den ana ekrana ekler. Chrome veya başka tarayıcıda eklenmez.",
      steps: [
        "Bu adresi kopyalayın veya paylaşın.",
        "Safari uygulamasını açıp aynı adresi yapıştırın.",
        "Paylaş > Ana Ekrana Ekle > Ekle.",
      ],
    },
    samsung: {
      title: "Samsung Internet ana ekrana ekler.",
      steps: [
        "Alttaki menüden Sayfa ekle veya Ana ekrana ekle’ye basın.",
        "Harbi Yol adını onaylayın.",
        "Ekle deyince ikon ana ekranda görünür.",
      ],
    },
    huawei: {
      title: "Huawei tarayıcısında ana ekrana ekleyin.",
      steps: [
        "Menüden Ana ekrana ekle veya Kısayol oluştur’u seçin.",
        "Adı Harbi Yol bırakın.",
        "Ekle’ye basın.",
      ],
    },
    xiaomi: {
      title: "Xiaomi tarayıcısında ana ekrana ekleyin.",
      steps: [
        "Menüden Ana ekrana ekle’yi seçin.",
        "Kısayolu onaylayın.",
        "Ekle’ye basın.",
      ],
    },
    "android-edge": {
      title: "Edge menüsünden uygulamayı yükleyin.",
      steps: ["⋯ menüyü açın.", "Uygulamayı yükle veya Ana ekrana ekle.", "Yükle’ye basın."],
    },
    "android-firefox": {
      title: "Firefox menüsünden ana ekrana ekleyin.",
      steps: ["⋮ menüyü açın.", "Ana ekrana ekle veya Yükle.", "Ekle’ye basın."],
    },
    "android-opera": {
      title: "Opera menüsünden ana ekrana ekleyin.",
      steps: ["⋮ menüyü açın.", "Ana ekrana ekle.", "Ekle’ye basın."],
    },
    "android-chrome": {
      title: "Telefona kısayol eklemek için aşağıdaki düğmeye basın. Pencere açılmazsa Chrome menüsünden Uygulamayı yükle’yi seçin.",
      steps: [
        "Tel. Kısayol Ekle veya Ana ekrana ekle’ye basın.",
        "Açılan pencerede Yükle / Ekle’yi onaylayın.",
        "Harbi ikonu ana ekranda görünür.",
      ],
    },
    "desktop-edge": {
      title: "Edge adres çubuğundaki uygulama simgesine basın veya menüden Uygulamayı yükle’yi seçin.",
      steps: ["⋯ menü > Uygulamalar > Bu siteyi uygulama olarak yükle.", "Yükle’ye basın."],
    },
    "desktop-chrome": {
      title: "Chrome adres çubuğundaki yükle simgesine basın veya menüden yükleyin.",
      steps: ["⋮ menü > Uygulamayı yükle / Harbi Yol’u yükle.", "Yükle’ye basın."],
    },
    generic: {
      title: "Tarayıcı menüsünden Ana ekrana ekle veya Uygulamayı yükle’yi seçin.",
      steps: ["Menüyü açın.", "Ana ekrana ekle / Uygulamayı yükle.", "Ekle’yi onaylayın."],
    },
  };
  return guides[kind] || guides.generic;
}

function showInstallGuide() {
  const guide = installGuide(installKind());
  modalText.textContent = guide.title;
  if (installSteps) {
    installSteps.replaceChildren(
      ...guide.steps.map((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        return li;
      })
    );
  }
  confirmInstall.hidden = !deferredPrompt;
  modal.hidden = false;
}

async function promptInstall() {
  if (!deferredPrompt) return false;
  try {
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    modal.hidden = true;
    if (choice?.outcome === "accepted") markShortcutAdded();
    else syncInstallBtn();
    return true;
  } catch {
    deferredPrompt = null;
    return false;
  }
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  if (installBtn && !shortcutAlreadyAdded()) installBtn.hidden = false;
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  markShortcutAdded();
});

async function openInstall() {
  if (shortcutAlreadyAdded()) {
    markShortcutAdded();
    return;
  }
  if (deferredPrompt) {
    await promptInstall();
    return;
  }
  showInstallGuide();
}

installBtn?.addEventListener("click", openInstall);
$("#closeInstall")?.addEventListener("click", () => {
  if (modal) modal.hidden = true;
});

confirmInstall?.addEventListener("click", async () => {
  if (!(await promptInstall())) showInstallGuide();
});


let stream = null;
let facingMode = "user";
let zoomLevel = 0.5;
let nativeZoomMax = 1;
let torchOn = false;
let flashMode = "auto";
let captureMp = 88;
let camFpsPick = 0;
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
  renderCamFps();
}
let recorder = null;
let recording = false;
let recChunks = [];
let recRaf = 0;
let recCanvas = null;
let camFlipping = false;
let eisOn = false;
let eisRaf = 0;
let eisNX = 0;
let eisNY = 0;
let eisTX = 0;
let eisTY = 0;
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

function camTargetFps(front) {
  if (camFpsPick) return camFpsPick;
  return front ? 60 : 120;
}

function camFrameRateSpec(front) {
  return { ideal: camTargetFps(front) };
}

function displayRefreshHz() {
  const hz = Number(window.screen?.refreshRate);
  return hz >= 90 ? Math.round(hz) : 120;
}

function camCanvasFps(front) {
  if (camFpsPick) return camFpsPick;
  return Math.max(displayRefreshHz(), camTargetFps(front));
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
  return facingMode === "user" ? -1 : 1;
}

function applyPreviewZoom() {
  const z = sensorCrop();
  const px = eisNX * 18;
  const py = eisNY * 18;
  const flip = previewFlipX();
  video.style.transform = `translate3d(${px}px, ${py}px, 0) scale(${flip * z}, ${z})`;
  video.style.filter = camMode === "cinema" ? "none" : `brightness(${isoBrightness()})`;
}

async function camAttachAndPlay(media) {
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("muted", "");
  video.srcObject = media;
  const tryPlay = () => video.play().catch(() => {});
  await tryPlay();
  if (video.readyState >= 2 && !video.paused) return;
  await new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("loadeddata", done);
      video.removeEventListener("canplay", done);
      resolve();
    };
    video.addEventListener("loadeddata", done);
    video.addEventListener("canplay", done);
    setTimeout(done, 1200);
  });
  await tryPlay();
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
  if ($("#camMpLabel")) $("#camMpLabel").textContent = `${captureMp} MP`;
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
  const cinema = camMode === "cinema";
  const videoMode = needsAudio();
  const phone = isIOS || isAndroid;
  const quality = phone
    ? {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: Math.min(60, camTargetFps(wantFront)) },
      }
    : {
        width: { ideal: videoMode ? (cinema ? 1920 : 3840) : 4032 },
        height: { ideal: videoMode ? (cinema ? 1080 : 2160) : 3024 },
        frameRate: camFrameRateSpec(wantFront),
      };
  const tries = [];
  if (phone) {
    tries.push({ audio, video: { facingMode: { ideal: facing } } });
    tries.push({ audio, video: { facingMode: facing } });
    tries.push({ audio, video: { facingMode: { ideal: facing }, ...quality } });
    if (deviceId) tries.push({ audio, video: { deviceId: { exact: deviceId } } });
    tries.push({ audio: Boolean(audio), video: true });
  } else {
    if (deviceId) {
      tries.push({ audio, video: { deviceId: { exact: deviceId }, ...quality } });
      tries.push({ audio, video: { deviceId: { exact: deviceId } } });
    }
    tries.push({ audio, video: { facingMode: { exact: facing }, ...quality } });
    tries.push({ audio, video: { facingMode: { ideal: facing }, ...quality } });
    if (!wantFront) {
      tries.push({
        audio,
        video: { facingMode: { ideal: facing }, width: quality.width, height: quality.height, frameRate: { ideal: 60 } },
      });
    }
    tries.push({ audio, video: { facingMode: { exact: facing } } });
    tries.push({ audio, video: { facingMode: { ideal: facing } } });
    tries.push({ audio: Boolean(audio), video: { facingMode: facing } });
    tries.push({ audio: Boolean(audio), video: true });
  }
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
  await new Promise((done) => setTimeout(done, camFlipping ? 40 : 80));
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
    await applyCamTune(track, requested === "user");
    if (needsAudio()) await applyIphoneAudio(stream);
    await camAttachAndPlay(stream);
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
    startEis();
    cameraStatus.textContent = "";
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
  const maxW = camMode === "cinema" ? 1920 : 3840;
  const scale = Math.min(1, maxW / Math.max(vw, 1));
  return { w: Math.max(2, Math.round(vw * scale)), h: Math.max(2, Math.round(vh * scale)) };
}

function drawRecFrame() {
  if (!recording || !recCanvas) return;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw && vh) {
    const crop = cropSource(vw, vh);
    const ctx = recCanvas.getContext("2d", { alpha: false, desynchronized: true }) || recCanvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.filter = camMode === "cinema" ? "none" : video.style.filter || "none";
    drawCameraVideo(ctx, crop.sx, crop.sy, crop.sw, crop.sh, recCanvas.width, recCanvas.height);
  }
  recRaf = requestAnimationFrame(drawRecFrame);
}

function stopCamera() {
  stopEis();
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
  const shiftX = Math.max(-rw * 0.04, Math.min(rw * 0.04, -eisNX * rw * 0.045));
  const shiftY = Math.max(-rh * 0.04, Math.min(rh * 0.04, -eisNY * rh * 0.045));
  let sx = (vw - rw) / 2 + shiftX;
  let sy = (vh - rh) / 2 + shiftY;
  sx = Math.max(0, Math.min(vw - rw, sx));
  sy = Math.max(0, Math.min(vh - rh, sy));
  return { sx, sy, sw: rw, sh: rh };
}

function eisOnMotion(event) {
  const acc = event.acceleration;
  const rot = event.rotationRate;
  let ax = 0;
  let ay = 0;
  if (acc && (acc.x || acc.y)) {
    ax = acc.x || 0;
    ay = acc.y || 0;
  }
  if (rot) {
    ax += (rot.gamma || 0) * 0.035;
    ay += (rot.beta || 0) * 0.035;
  }
  eisTX = Math.max(-1, Math.min(1, eisTX * 0.55 + -ax * 0.14));
  eisTY = Math.max(-1, Math.min(1, eisTY * 0.55 + ay * 0.14));
}

function eisLoop() {
  if (!eisOn) return;
  eisNX += (eisTX - eisNX) * 0.22;
  eisNY += (eisTY - eisNY) * 0.22;
  applyPreviewZoom();
  eisRaf = requestAnimationFrame(eisLoop);
}

function stopEis() {
  eisOn = false;
  if (eisRaf) cancelAnimationFrame(eisRaf);
  eisRaf = 0;
  window.removeEventListener("devicemotion", eisOnMotion);
  eisNX = 0;
  eisNY = 0;
  eisTX = 0;
  eisTY = 0;
}

async function startEis() {
  stopEis();
  eisOn = true;
  eisLoop();
  const listen = () => window.addEventListener("devicemotion", eisOnMotion, { passive: true });
  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
    try {
      const state = await DeviceMotionEvent.requestPermission();
      if (state === "granted") listen();
    } catch {
      /* iOS izin vermezse dijital EIS kapalı kalır */
    }
    return;
  }
  listen();
}

async function applyCamTune(track, front = facingMode === "user", opts = {}) {
  if (!track?.applyConstraints) return;
  const caps = track.getCapabilities?.() || {};
  const advanced = {};
  if (caps.imageStabilization) advanced.imageStabilization = true;
  if (Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) advanced.focusMode = "continuous";
  if (Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes("continuous")) {
    advanced.whiteBalanceMode = "continuous";
  }
  if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes("continuous")) advanced.exposureMode = "continuous";
  const videoMode = needsAudio();
  const cinema = camMode === "cinema";
  const size = {};
  if (!opts.fpsOnly) {
    const maxW = isIOS ? 1920 : videoMode ? (cinema ? 1920 : 3840) : Math.min(4032, caps.width?.max || 4032);
    const maxH = isIOS ? 1080 : videoMode ? (cinema ? 1080 : 2160) : Math.min(3024, caps.height?.max || 3024);
    if (caps.width) size.width = { ideal: Math.min(maxW, caps.width.max || maxW) };
    if (caps.height) size.height = { ideal: Math.min(maxH, caps.height.max || maxH) };
  }
  if (caps.frameRate) {
    const want = isIOS ? Math.min(60, camTargetFps(front)) : camTargetFps(front);
    const capMax = caps.frameRate.max || want;
    const capMin = caps.frameRate.min || 1;
    const fps = Math.max(capMin, Math.min(want, capMax));
    size.frameRate = { ideal: fps };
  }
  if (Object.keys(advanced).length) size.advanced = [advanced];
  try {
    await track.applyConstraints(size);
  } catch {
    try {
      const { advanced: _a, ...rest } = size;
      await track.applyConstraints(rest);
    } catch {
      /* tarayıcı kısıtı */
    }
  }
  if (!isIOS) {
    await track.applyConstraints({ advanced: [{ imageStabilization: true }] }).catch(() => {});
  }
}

function syncCaptureMp() {
  captureMp = facingMode === "environment" ? 128 : 88;
}

function outputSize() {
  const settings = videoTrack()?.getSettings?.() || {};
  const vw = settings.width || video.videoWidth || 1920;
  const vh = settings.height || video.videoHeight || 1080;
  const crop = cropSource(vw, vh);
  const aspect = Math.max(crop.sw, 1) / Math.max(crop.sh, 1);
  const pixels = Math.max(1, captureMp) * 1e6;
  let h = Math.round(Math.sqrt(pixels / aspect));
  let w = Math.round(h * aspect);
  w -= w % 2;
  h -= h % 2;
  return { w: Math.max(2, w), h: Math.max(2, h) };
}

$("#switchCamera").addEventListener("click", async (event) => {
  event.stopPropagation();
  if (camFlipping) return;
  camFlipping = true;
  cameraFrame?.classList.add("cam-flipping");
  await new Promise((done) => setTimeout(done, 420));
  facingMode = facingMode === "environment" ? "user" : "environment";
  camApplyFacingUi();
  resumeSaveCam();
  await startCamera({ preserve: true });
  await new Promise((done) => setTimeout(done, 430));
  cameraFrame?.classList.remove("cam-flipping");
  camFlipping = false;
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
  if ($("#camFps")) $("#camFps").hidden = mode === "cinema";
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
$("#camFps")?.addEventListener("click", (event) => event.stopPropagation());
$("#camFps")?.addEventListener("pointerdown", (event) => event.stopPropagation());

function renderCamFps() {
  const toggle = $("#camFpsToggle");
  const list = $("#camFpsList");
  if (toggle) toggle.textContent = camFpsPick ? String(camFpsPick) : "fps";
  if (toggle) toggle.setAttribute("aria-expanded", list && !list.hidden ? "true" : "false");
  $$("#camFpsList [data-fps]").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.fps) === camFpsPick);
  });
}

$("#camFpsToggle")?.addEventListener("click", (event) => {
  event.stopPropagation();
  const list = $("#camFpsList");
  if (!list) return;
  list.hidden = !list.hidden;
  renderCamFps();
});

$("#camFpsList")?.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-fps]");
  if (!btn) return;
  camFpsPick = Number(btn.dataset.fps) || 0;
  const list = $("#camFpsList");
  if (list) list.hidden = true;
  renderCamFps();
  const track = videoTrack();
  if (track) await applyCamTune(track, facingMode === "user", { fpsOnly: true });
});
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
  const list = $("#camFpsList");
  if (list && !list.hidden) {
    list.hidden = true;
    renderCamFps();
  }
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
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.97));
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
  let { w: outW, h: outH } = outputSize();
  const fitPhotoCanvas = (w, h) => {
    let tw = w;
    let th = h;
    for (let i = 0; i < 8; i += 1) {
      try {
        canvas.width = tw;
        canvas.height = th;
        if (canvas.width === tw && canvas.height === th) return { w: tw, h: th };
      } catch {
        /* bellek sınırı */
      }
      tw = Math.max(2, Math.round(tw * 0.75) & ~1);
      th = Math.max(2, Math.round(th * 0.75) & ~1);
    }
    canvas.width = 4032;
    canvas.height = 3024;
    return { w: canvas.width, h: canvas.height };
  };
  ({ w: outW, h: outH } = fitPhotoCanvas(outW, outH));
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
  const mp = ((outW * outH) / 1e6).toFixed(1);
  cameraStatus.textContent = `${outW}×${outH} · ${mp} MP · ${info.name} ${info.mm}mm`;
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
    const dataUrl = canvas.toDataURL("image/jpeg", 0.97);
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
  const fps = camCanvasFps(facingMode === "user");
  const recStream = recCanvas.captureStream(fps);
  stream?.getAudioTracks().forEach((track) => {
    const audio = camMode === "cinema" ? track : track.clone ? track.clone() : track;
    if (!recStream.getAudioTracks().some((existing) => existing.id === audio.id)) {
      recStream.addTrack(audio);
    }
  });
  const videoBits = recCanvas.width >= 2560 ? 28_000_000 : 16_000_000;
  const recOpts = mime
    ? { mimeType: mime, videoBitsPerSecond: videoBits, audioBitsPerSecond: 256_000 }
    : { videoBitsPerSecond: videoBits, audioBitsPerSecond: 256_000 };
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
  const raw = String(value ?? "").replace(/[^\d,.-]/g, "").replace(",", ".");
  if (!raw || raw === "-" || raw === "." || raw === "-.") return Number.POSITIVE_INFINITY;
  const n = Number(raw);
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

const NFC_SOUND_DB = 50;

function nfcSoundGain() {
  return Math.max(0.05, Math.min(1, NFC_SOUND_DB / 100));
}

function nfcWavDataUri(seconds, freqs, volume) {
  const sampleRate = 22050;
  const n = Math.max(1, Math.floor(sampleRate * seconds));
  const pcm = new Int16Array(n);
  const peak = Math.floor(32767 * Math.max(0, Math.min(1, volume)));
  const parts = freqs && freqs.length ? freqs : [[1000, 1]];
  const ampSum = parts.reduce((s, p) => s + (p[1] || 0), 0) || 1;
  for (let i = 0; i < n; i += 1) {
    const t = i / sampleRate;
    const env = seconds < 0.06 ? 1 : Math.min(1, t / 0.008) * Math.max(0, 1 - t / seconds);
    let s = 0;
    for (let p = 0; p < parts.length; p += 1) s += Math.sin(2 * Math.PI * parts[p][0] * t) * (parts[p][1] / ampSum);
    pcm[i] = Math.max(-32767, Math.min(32767, Math.round(s * env * peak)));
  }
  const bytes = pcm.byteLength;
  const buf = new ArrayBuffer(44 + bytes);
  const view = new DataView(buf);
  const ascii = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, bytes, true);
  new Uint8Array(buf, 44).set(new Uint8Array(pcm.buffer));
  const raw = new Uint8Array(buf);
  let bin = "";
  const step = 0x8000;
  for (let i = 0; i < raw.length; i += step) {
    bin += String.fromCharCode.apply(null, raw.subarray(i, i + step));
  }
  return "data:audio/wav;base64," + btoa(bin);
}

let nfcKeepUri = "";
let nfcBeepUri = "";

function nfcKeepSrc() {
  if (!nfcKeepUri) nfcKeepUri = nfcWavDataUri(0.28, [[48, 1]], 0.02);
  return nfcKeepUri;
}

function nfcBeepSrc() {
  if (!nfcBeepUri) nfcBeepUri = nfcWavDataUri(0.42, [[980, 0.7], [1470, 0.5]], nfcSoundGain());
  return nfcBeepUri;
}

function nfcUnlockAudio() {
  const ctx = nfcAudio();
  if (!ctx) return Promise.resolve(null);
  const kick = () => {
    try {
      const buf = ctx.createBuffer(1, Math.max(1, Math.round(ctx.sampleRate * 0.04)), ctx.sampleRate);
      const src = ctx.createBufferSource();
      const silent = ctx.createGain();
      silent.gain.value = 0.00001;
      src.buffer = buf;
      src.connect(silent);
      silent.connect(ctx.destination);
      src.start();
    } catch {
      /* */
    }
    return ctx;
  };
  if (ctx.state === "suspended") return ctx.resume().then(kick).catch(kick);
  return Promise.resolve(kick());
}

let nfcScanAlive = null;

function nfcHoldAudio(on) {
  const ctx = nfcAudio();
  if (!on) {
    try {
      nfcScanAlive?.osc.stop();
    } catch {
      /* */
    }
    nfcScanAlive = null;
    return;
  }
  if (!ctx || nfcScanAlive) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 18;
    gain.gain.value = 0.00008;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    nfcScanAlive = { osc, gain };
  } catch {
    /* */
  }
}

function nfcSleepAudio() {
  nfcHoldAudio(false);
  try {
    $("#nfcKeepAudio")?.pause();
  } catch {
    /* */
  }
}

function nfcEnsureAudioEls() {
  const keep = $("#nfcKeepAudio");
  const beep = $("#nfcBeepAudio");
  if (keep && !keep.getAttribute("src")) {
    keep.src = nfcKeepSrc();
    keep.loop = true;
    keep.volume = 0.02;
  }
  if (beep && !beep.getAttribute("src")) {
    beep.src = nfcBeepSrc();
    beep.loop = false;
    beep.volume = nfcSoundGain();
    beep.load();
  }
}

function nfcArmSound() {
  nfcEnsureAudioEls();
  nfcUnlockAudio();
  nfcHoldAudio(true);
  const keep = $("#nfcKeepAudio");
  if (keep) {
    keep.volume = 0.02;
    keep.play().catch(() => {});
  }
}

function playNfcHtmlBeep() {
  try {
    nfcEnsureAudioEls();
    const beep = $("#nfcBeepAudio");
    if (!beep) {
      const audio = new Audio(nfcBeepSrc());
      audio.volume = nfcSoundGain();
      return audio.play().catch(() => {});
    }
    beep.muted = false;
    beep.volume = nfcSoundGain();
    try {
      beep.currentTime = 0;
    } catch {
      /* */
    }
    return beep.play().catch(() => {
      const copy = new Audio(nfcBeepSrc());
      copy.volume = nfcSoundGain();
      return copy.play().catch(() => {});
    });
  } catch {
    return Promise.resolve();
  }
}

function speakTr(text) {
  return speakVoice(text, { rate: 0.95, pitch: 1, volume: nfcSoundGain() });
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
    utter.volume = Math.max(0, Math.min(1, opts?.volume ?? nfcSoundGain()));
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
    nfcVibrate();
    playNfcHtmlBeep();
    const ctx = nfcAudio();
    if (!ctx) {
      resolve();
      return;
    }
    const peak = Math.max(0.35, nfcSoundGain());
    const play = () => {
      const now = ctx.currentTime;
      const ding = (freq, start, dur, level, type) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || "square";
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), now + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.04);
      };
      ding(980, 0, 0.22, peak, "square");
      ding(1470, 0.06, 0.26, peak * 0.8, "sine");
      setTimeout(resolve, 480);
    };
    if (ctx.state === "suspended") ctx.resume().then(play).catch(() => resolve());
    else play();
  });
}

let nfcBeepLock = 0;

function nfcContactSound() {
  const now = Date.now();
  if (now - nfcBeepLock < 350) return Promise.resolve();
  nfcBeepLock = now;
  nfcUnlockAudio();
  return playTlink();
}

if ("speechSynthesis" in window) {
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener?.("voiceschanged", () => speechSynthesis.getVoices());
}

if (!nfcSupported()) {
  nfcHint.textContent =
    "Bu tarayıcı Web NFC desteklemiyor. Android’de Chrome ile HTTPS üzerinden açın.";
}

function handleNfcRecords(event) {
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
}

let nfcReaderLive = null;
let nfcScanPromise = null;
let nfcReadingBound = false;

function startNfcScan() {
  nfcArmSound();
  if (!nfcSupported()) {
    nfcResult.textContent = "Etiketi telefona yaklaştırın...";
    return;
  }
  nfcHint.textContent = "Tarama açık. Etiketi telefona yaklaştırın.";
  nfcResult.textContent = "Etiketi telefona yaklaştırın...";
  try {
    if (!nfcReaderLive) nfcReaderLive = new NDEFReader();
    if (!nfcReadingBound) {
      nfcReadingBound = true;
      nfcReaderLive.addEventListener("reading", (event) => {
        nfcContactSound();
        try {
          handleNfcRecords(event);
        } catch {
          /* */
        }
      });
    }
    if (!nfcScanPromise) {
      nfcScanPromise = nfcReaderLive.scan().catch((error) => {
        nfcScanPromise = null;
        nfcResult.textContent = "NFC okunamadı: " + error.message;
      });
    }
  } catch (error) {
    nfcScanPromise = null;
    nfcResult.textContent = "NFC okunamadı: " + error.message;
  }
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

$("#nfcScan").addEventListener("click", () => {
  nfcArmSound();
  if (!nfcSupported()) {
    const sim = "Ali Yılmaz";
    nfcResult.textContent = "";
    showNfcPersonName(sim);
    nfcContactSound();
    saveNfc({ type: "Okuma (simülasyon)", detail: sim });
    return;
  }
  startNfcScan();
});

["pointerdown", "touchstart", "click"].forEach((type) => {
  document.addEventListener(
    type,
    () => {
      if (resumeActiveView() === "nfc") nfcArmSound();
    },
    { passive: true }
  );
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

const clipLive = {
  stream: null,
  rec: null,
  recRaw: null,
  chunks: [],
  chunksRaw: [],
  recording: false,
  looping: false,
  facing: "user",
  iso: 405,
  zoom: 1,
  anima: false,
  modeDragX: 0,
  modeDragging: false,
  modeBaseX: 0,
  blob: null,
  rawBlob: null,
  previewUrl: "",
  previewRawUrl: "",
  lastW: 0,
  lastH: 0,
  opening: false,
  face: null,
  detectAt: 0,
  detector: null,
  toonWork: null,
  toonWork2: null,
  pendingStops: 0,
};

function clipLiveMsg(text) {
  if ($("#clipLiveMsg")) $("#clipLiveMsg").textContent = text || "";
}

function clipLiveIsoBright() {
  const t = Math.log(clipLive.iso / 50) / Math.log(3200 / 50);
  return 0.7 + t * 0.85;
}

function clipLiveModeShift() {
  const wrap = $("#clipLiveModes");
  const track = $("#clipLiveModesTrack");
  const on = track?.querySelector(".is-on");
  if (!wrap || !track || !on) return 0;
  return wrap.clientWidth / 2 - (on.offsetLeft + on.offsetWidth / 2);
}

function clipLiveAnimaUi(dragExtra = 0) {
  $$("[data-clip-mode]").forEach((el) => {
    const anima = el.dataset.clipMode === "anima";
    el.classList.toggle("is-on", anima ? clipLive.anima : !clipLive.anima);
  });
  const track = $("#clipLiveModesTrack");
  if (!track) return;
  const x = clipLiveModeShift() + dragExtra;
  track.style.transform = `translateX(${x}px)`;
}

function clipLiveSetMode(mode, say) {
  clipLive.anima = mode === "anima";
  clipLiveAnimaUi();
  if (say) {
    clipLiveMsg(
      clipLive.anima
        ? "Animasyona çevir. Kayıtta ham video ve çizgi film videosu alınır."
        : "Doğal çekim."
    );
  }
}

function clipLiveWorkCanvas(key, w, h) {
  let canvas = clipLive[key];
  if (!canvas) {
    canvas = document.createElement("canvas");
    clipLive[key] = canvas;
  }
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return canvas.getContext("2d", { willReadFrequently: true }) || canvas.getContext("2d");
}

async function clipLiveDetectFace(video) {
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
      clipLive.face = { x: box.x / vw, y: box.y / vh, w: box.width / vw, h: box.height / vh };
    }
  } catch {
    /* yoksa oval tahmini kullanılır */
  }
}

function clipLiveApplyCartoon(srcCanvas, g, w, h) {
  const maxW = clipLive.recording ? 480 : 320;
  const tw = Math.max(160, Math.min(w, maxW));
  const th = Math.max(160, Math.round((h * tw) / w));
  const ctxA = clipLiveWorkCanvas("toonWork", tw, th);
  const ctxB = clipLiveWorkCanvas("toonWork2", tw, th);
  if (!ctxA || !ctxB) return;
  ctxA.imageSmoothingEnabled = true;
  ctxA.drawImage(srcCanvas, 0, 0, tw, th);
  const src = ctxA.getImageData(0, 0, tw, th);
  const blur = ctxB.createImageData(tw, th);
  const s = src.data;
  const b = blur.data;
  const rad = 1;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      let r = 0;
      let gch = 0;
      let bl = 0;
      let n = 0;
      for (let dy = -rad; dy <= rad; dy++) {
        const yy = Math.min(th - 1, Math.max(0, y + dy));
        for (let dx = -rad; dx <= rad; dx++) {
          const xx = Math.min(tw - 1, Math.max(0, x + dx));
          const i = (yy * tw + xx) * 4;
          r += s[i];
          gch += s[i + 1];
          bl += s[i + 2];
          n++;
        }
      }
      const o = (y * tw + x) * 4;
      b[o] = r / n;
      b[o + 1] = gch / n;
      b[o + 2] = bl / n;
      b[o + 3] = 255;
    }
  }
  const out = ctxA.createImageData(tw, th);
  const d = out.data;
  const lumaAt = (x, y) => {
    const i = (y * tw + x) * 4;
    return b[i] * 0.299 + b[i + 1] * 0.587 + b[i + 2] * 0.114;
  };
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const i = (y * tw + x) * 4;
      let r = b[i];
      let gch = b[i + 1];
      let bl = b[i + 2];
      const skin = r > 90 && gch > 40 && bl > 20 && r > gch && r - gch > 12 && r > bl;
      if (skin) {
        r = r * 0.42 + 255 * 0.58;
        gch = gch * 0.42 + 206 * 0.58;
        bl = bl * 0.42 + 168 * 0.58;
      } else {
        const gray = r * 0.299 + gch * 0.587 + bl * 0.114;
        r = gray + (r - gray) * 1.38;
        gch = gray + (gch - gray) * 1.38;
        bl = gray + (bl - gray) * 1.38;
      }
      const q = 22;
      const qr = Math.round(r / q) * q;
      const qg = Math.round(gch / q) * q;
      const qb = Math.round(bl / q) * q;
      r = r * 0.55 + qr * 0.45;
      gch = gch * 0.55 + qg * 0.45;
      bl = bl * 0.55 + qb * 0.45;
      const gx = lumaAt(Math.min(tw - 1, x + 1), y) - lumaAt(Math.max(0, x - 1), y);
      const gy = lumaAt(x, Math.min(th - 1, y + 1)) - lumaAt(x, Math.max(0, y - 1));
      const edge = Math.sqrt(gx * gx + gy * gy);
      if (edge > 28) {
        const t = Math.min(1, (edge - 28) / 70);
        r = r * (1 - t) + 48 * t;
        gch = gch * (1 - t) + 28 * t;
        bl = bl * (1 - t) + 18 * t;
      }
      d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      d[i + 1] = gch < 0 ? 0 : gch > 255 ? 255 : gch;
      d[i + 2] = bl < 0 ? 0 : bl > 255 ? 255 : bl;
      d[i + 3] = 255;
    }
  }
  ctxA.putImageData(out, 0, 0);
  const f = clipLive.face;
  if (f) {
    const fx = f.x * tw;
    const fy = f.y * th;
    const fw = f.w * tw;
    const fh = f.h * th;
    const ey = fy + fh * 0.3;
    const eh = Math.max(8, fh * 0.2);
    const ew = Math.max(10, fw * 0.34);
    const left = fx + fw * 0.1;
    const right = fx + fw * 0.56;
    ctxB.drawImage(clipLive.toonWork, 0, 0);
    const drawEye = (sx) => {
      ctxA.drawImage(clipLive.toonWork2, sx, ey, ew, eh, sx - ew * 0.14, ey - eh * 0.18, ew * 1.32, eh * 1.36);
    };
    drawEye(left);
    drawEye(right);
  }
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(clipLive.toonWork, 0, 0, w, h);
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
  const z = Number(clipLive.zoom) || 1;
  const iso = `brightness(${clipLiveIsoBright().toFixed(3)})`;
  const g =
    canvas.getContext("2d", { alpha: false, desynchronized: true }) || canvas.getContext("2d");
  if (!g) return;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  const setIso = (extra = "") => {
    try {
      g.filter = extra ? `${iso} ${extra}` : iso;
    } catch {
      g.filter = "none";
    }
  };
  if (z >= 1) {
    const cw = vw / z;
    const ch = vh / z;
    setIso();
    g.drawImage(video, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, outW, outH);
  } else {
    setIso("blur(22px)");
    g.drawImage(video, 0, 0, vw, vh, 0, 0, outW, outH);
    setIso();
    const dw = outW * z;
    const dh = outH * z;
    g.drawImage(video, 0, 0, vw, vh, (outW - dw) / 2, (outH - dh) / 2, dw, dh);
  }
  g.filter = "none";
  const rawCanvas = $("#clipLiveRawCanvas");
  if (clipLive.anima && rawCanvas) {
    if (rawCanvas.width !== outW || rawCanvas.height !== outH) {
      rawCanvas.width = outW;
      rawCanvas.height = outH;
    }
    const rg = rawCanvas.getContext("2d", { alpha: false, desynchronized: true }) || rawCanvas.getContext("2d");
    rg?.drawImage(canvas, 0, 0);
    clipLiveApplyCartoon(rawCanvas, g, outW, outH);
    clipLiveDetectFace(video);
  }
  canvas.classList.add("is-on");
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
    try {
      clipLive.recRaw?.stop();
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

const CLIP_ZOOM_STEPS = [0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function clipLiveZoomLabel(z) {
  const n = Number(z) || 1;
  if (n < 1) return `${String(n).replace(".", ",")}×`;
  return `${n}×`;
}

function clipLiveZoomFromSlider(value) {
  const idx = Math.max(0, Math.min(CLIP_ZOOM_STEPS.length - 1, Math.round(Number(value) || 0)));
  return CLIP_ZOOM_STEPS[idx];
}

function clipLiveZoomIndex(z) {
  const n = Number(z);
  const exact = CLIP_ZOOM_STEPS.indexOf(n);
  if (exact >= 0) return exact;
  let best = 5;
  let diff = Infinity;
  CLIP_ZOOM_STEPS.forEach((step, i) => {
    const d = Math.abs(step - n);
    if (d < diff) {
      diff = d;
      best = i;
    }
  });
  return best;
}

function clipLiveMinZoom() {
  return CLIP_ZOOM_STEPS[0];
}

function clipLiveResetZoom() {
  clipLive.zoom = 1;
  const range = $("#clipLiveZoom");
  if (range) {
    range.min = "0";
    range.max = String(CLIP_ZOOM_STEPS.length - 1);
    range.step = "1";
    range.value = String(clipLiveZoomIndex(1));
  }
  if ($("#clipLiveZoomVal")) $("#clipLiveZoomVal").textContent = clipLiveZoomLabel(1);
}

function clipLiveFacingUi() {
  const front = clipLive.facing === "user";
  $("#clipLiveStage")?.classList.toggle("front-cam", front);
  $("#clipLiveFlip")?.classList.toggle("front", front);
  if ($("#clipLiveFacing")) $("#clipLiveFacing").textContent = front ? "ön" : "arka";
}

async function clipLiveGetStream(wantFront = clipLive.facing === "user") {
  const facing = wantFront ? "user" : "environment";
  const rate = camFrameRateSpec(wantFront);
  const quality = { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: rate };
  const specs = [
    { audio: iphoneAudioConstraints(), video: { facingMode: { ideal: facing } } },
    { audio: iphoneAudioConstraints(), video: quality },
    { audio: iphoneAudioConstraints(), video: { facingMode: { ideal: facing }, frameRate: rate } },
    {
      audio: iphoneAudioConstraints(),
      video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
    },
    { audio: iphoneAudioConstraints(), video: { facingMode: { ideal: facing } } },
    { audio: true, video: { facingMode: facing, frameRate: rate } },
    { audio: true, video: { facingMode: facing } },
    { audio: true, video: true },
    { video: { facingMode: { ideal: facing }, frameRate: rate } },
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
      await applyCamTune(media.getVideoTracks()[0], wantFront, { fpsOnly: true });
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
      video: {
        facingMode: { ideal: nextFront ? "user" : "environment" },
        frameRate: camFrameRateSpec(nextFront),
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
    await applyCamTune(videoOnly.getVideoTracks()[0], nextFront, { fpsOnly: true });
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
    if ($("#clipLiveStage")) $("#clipLiveStage").hidden = false;
    if ($("#clipLiveOpen")) $("#clipLiveOpen").hidden = true;
    if ($("#clipLiveDone")) $("#clipLiveDone").hidden = true;
    clipLive.looping = true;
    clipLiveTick();
    const playNow = () => video.play().catch(() => {});
    video.addEventListener("loadedmetadata", playNow, { once: true });
    playNow();
    clipLiveLockPage(true);
    clipLiveAnimaUi();
    requestAnimationFrame(() => clipLiveAnimaUi());
    clipLiveMsg("Görüntü açık.");
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

function clipLiveAttachAudio(vstream) {
  try {
    vstream.getAudioTracks().forEach((track) => vstream.removeTrack(track));
  } catch {
    /* */
  }
  clipLive.stream.getAudioTracks().forEach((track) => {
    if (track.readyState === "live") vstream.addTrack(track);
  });
  return vstream;
}

function clipLiveMakeRec(stream, onBlob) {
  const rec = musicRecorderFor(stream);
  const chunks = [];
  rec.ondataavailable = (ev) => {
    if (ev.data?.size) chunks.push(ev.data);
  };
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
    onBlob(blob);
  };
  rec.start(250);
  return rec;
}

function clipLiveShowDone() {
  const preview = $("#clipLivePreview");
  const previewRaw = $("#clipLivePreviewRaw");
  if (clipLive.previewUrl) URL.revokeObjectURL(clipLive.previewUrl);
  if (clipLive.previewRawUrl) URL.revokeObjectURL(clipLive.previewRawUrl);
  clipLive.previewUrl = clipLive.blob ? URL.createObjectURL(clipLive.blob) : "";
  clipLive.previewRawUrl = clipLive.rawBlob ? URL.createObjectURL(clipLive.rawBlob) : "";
  const dual = !!(clipLive.anima && clipLive.rawBlob && clipLive.blob);
  if ($("#clipLiveRawLabel")) $("#clipLiveRawLabel").hidden = !dual;
  if ($("#clipLiveAnimaLabel")) $("#clipLiveAnimaLabel").hidden = !dual;
  if (previewRaw) {
    previewRaw.hidden = !dual;
    if (dual && clipLive.previewRawUrl) {
      previewRaw.src = clipLive.previewRawUrl;
      previewRaw.play().catch(() => {});
    }
  }
  if (preview && clipLive.previewUrl) {
    preview.src = clipLive.previewUrl;
    preview.play().catch(() => {});
  }
  if ($("#clipLiveDone")) $("#clipLiveDone").hidden = false;
  clipLiveMsg(
    dual
      ? "Ham kayıt ve animasyon hazır. Kaydet derseniz ikisi de galeriye gider."
      : "Kayıt bitti. Önizleyin, kaydet derseniz Resimlerim’e gider."
  );
}

function clipLiveOnRecStop() {
  clipLive.pendingStops -= 1;
  if (clipLive.pendingStops > 0) return;
  if (clipLive.anima && clipLive.rawBlob && !clipLive.blob) clipLive.blob = clipLive.rawBlob;
  clipLiveShowDone();
}

function clipLiveStartRec() {
  if (clipLive.recording) return;
  const canvas = $("#clipLiveCanvas");
  const rawCanvas = $("#clipLiveRawCanvas");
  if (!canvas?.captureStream || !clipLive.stream) {
    clipLiveMsg("Kayıt bu tarayıcıda açılamadı.");
    return;
  }
  clipLive.chunks = [];
  clipLive.chunksRaw = [];
  clipLive.blob = null;
  clipLive.rawBlob = null;
  clipLive.pendingStops = 0;
  const wantAnima = clipLive.anima && rawCanvas?.captureStream;
  if (wantAnima) clipLivePaint();
  if (wantAnima && (!rawCanvas.width || !rawCanvas.height)) {
    clipLiveMsg("Animasyon için görüntü hazır değil. Bir saniye sonra tekrar deneyin.");
    return;
  }
  const fps = camCanvasFps(clipLive.facing === "user");
  try {
    if (wantAnima) {
      clipLive.pendingStops = 2;
      clipLive.recRaw = clipLiveMakeRec(clipLiveAttachAudio(rawCanvas.captureStream(fps)), (blob) => {
        clipLive.rawBlob = blob;
        clipLiveOnRecStop();
      });
      clipLive.rec = clipLiveMakeRec(clipLiveAttachAudio(canvas.captureStream(fps)), (blob) => {
        clipLive.blob = blob;
        clipLiveOnRecStop();
      });
    } else {
      clipLive.pendingStops = 1;
      clipLive.rec = clipLiveMakeRec(clipLiveAttachAudio(canvas.captureStream(fps)), (blob) => {
        clipLive.blob = blob;
        clipLive.rawBlob = blob;
        clipLiveOnRecStop();
      });
      clipLive.recRaw = null;
    }
  } catch {
    clipLiveMsg("Kayıt bu tarayıcıda açılamadı.");
    return;
  }
  clipLive.recording = true;
  $("#clipLiveShutter")?.classList.add("recording");
  clipLiveMsg(wantAnima ? "Ham kayıt ve animasyon birlikte alınıyor." : "Kayıt sürüyor.");
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
  try {
    clipLive.recRaw?.stop();
  } catch {
    /* */
  }
}

async function clipLiveSave() {
  const animaBlob = clipLive.blob;
  const rawBlob = clipLive.rawBlob;
  if (!animaBlob && !rawBlob) {
    clipLiveMsg("Önce kaydı bitirin.");
    return;
  }
  const dual = !!(clipLive.anima && rawBlob && animaBlob && rawBlob !== animaBlob);
  let last = "";
  if (dual || rawBlob) {
    last = await saveBlobToPhoneGallery(
      rawBlob || animaBlob,
      videoFileName((rawBlob || animaBlob).type).replace("sarki", dual ? "klip-ham" : "klip")
    );
    if (last === "abort") {
      const text = "Paylaşım iptal.";
      if ($("#clipLiveDoneMsg")) $("#clipLiveDoneMsg").textContent = text;
      clipLiveMsg(text);
      return;
    }
  }
  if (dual) {
    last = await saveBlobToPhoneGallery(
      animaBlob,
      videoFileName(animaBlob.type).replace("sarki", "klip-animasyon")
    );
  } else if (animaBlob && !rawBlob) {
    last = await saveBlobToPhoneGallery(animaBlob, videoFileName(animaBlob.type).replace("sarki", "klip"));
  }
  const text =
    last === "abort"
      ? "Paylaşım iptal."
      : last === "share"
        ? dual
          ? "Ham video ve animasyon Resimlerim / Galeri’ye gönderildi."
          : "Video Resimlerim / Galeri’ye gönderildi."
        : dual
          ? "Ham video ve animasyon indirildi."
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
$("#clipLiveModes")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-clip-mode]");
  if (!btn) return;
  event.preventDefault();
  event.stopPropagation();
  clipLiveSetMode(btn.dataset.clipMode, true);
});
$("#clipLiveModes")?.addEventListener(
  "touchstart",
  (event) => {
    const t = event.changedTouches[0];
    if (!t) return;
    clipLive.modeDragging = true;
    clipLive.modeDragX = t.clientX;
    clipLive.modeBaseX = clipLiveModeShift();
  },
  { passive: true }
);
$("#clipLiveModes")?.addEventListener(
  "touchmove",
  (event) => {
    if (!clipLive.modeDragging) return;
    const t = event.changedTouches[0];
    if (!t) return;
    clipLiveAnimaUi(t.clientX - clipLive.modeDragX);
  },
  { passive: true }
);
$("#clipLiveModes")?.addEventListener("touchend", (event) => {
  if (!clipLive.modeDragging) return;
  clipLive.modeDragging = false;
  const t = event.changedTouches[0];
  const dx = t ? t.clientX - clipLive.modeDragX : 0;
  if (dx < -36) clipLiveSetMode("anima", true);
  else if (dx > 36) clipLiveSetMode("natural", true);
  else clipLiveAnimaUi();
});
$("#clipLiveModes")?.addEventListener("touchcancel", () => {
  clipLive.modeDragging = false;
  clipLiveAnimaUi();
});
$("#clipLiveZoom")?.addEventListener("input", (event) => {
  clipLive.zoom = clipLiveZoomFromSlider(event.target.value);
  if ($("#clipLiveZoomVal")) $("#clipLiveZoomVal").textContent = clipLiveZoomLabel(clipLive.zoom);
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

const POS_ADMIN_REMEMBER = "pos-admin-remember";
const POS_ADMIN_PIN_STORE = "pos-admin-pin";
const POS_ADMIN_USER = "superadmin";
const POS_ADMIN_PIN = "HarbiAdmin2026";
const POS_SETTLE = {
  name: "Tolkan Uğur Özel",
  branch: "",
  country: "Türkiye Cumhuriyeti",
  iban: "TR54 0006 2000 1110 0006 2920 69",
  ibanRaw: "TR540006200011100006292069",
  ibanMasked: "TR54 0006 2000 1110 0006 ** **",
};

function posAdminPinValue() {
  const saved = store.get(POS_ADMIN_PIN_STORE, "");
  return saved || POS_ADMIN_PIN;
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

function posEnsureGateway() {}

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
  renderSiteStats();
});

const YOL_MEMBERS = "yol-members";
const YOL_SESSION = "yol-session";
const YOL_PARTNERS = "yol-partners";
const YOL_PRODUCTS = "yol-products";
const YOL_SELLER = "yol-seller";
const YOL_LAST = "yol-last";
const YOL_SITE = "yol-site";
const YOL_CART = "yol-cart";
const YOL_PAY_PENDING = "yol-pay-pending";
const YOL_ORDERS = "yol-orders";
const YOL_COUPONS = "yol-coupons";
const YOL_CAMPAIGNS = "yol-campaigns";
const YOL_INVOICES = "yol-invoices";
const YOL_ADDRESSES = "yol-ship-addresses";
const YOL_SHOP_COUNTRY = "yol-shop-country";
const YOL_SHOP_COUNTRIES = "yol-shop-countries";
const YOL_COUNTRY_PACK =
  "AFAfganistan|ALArnavutluk|DZCezayir|ADAndorra|AOAngola|AGAntigua ve Barbuda|ARArjantin|AMErmenistan|AUAvustralya|ATAvusturya|AZAzerbaycan|BSBahamalar|BHBahreyn|BDBangladeş|BBBarbados|BYBelarus|BEBelçika|BZBelize|BJBenin|BTBhutan|BOBolivya|BABosna-Hersek|BWBotsvana|BRBrezilya|BNBrunei|BGBulgaristan|BFBurkina Faso|BIBurundi|CVCape Verde|KHKamboçya|CMKamerun|CAKanada|CFOrta Afrika Cumhuriyeti|TDÇad|CLŞili|CNÇin|COKolombiya|KMKomorlar|CGKongo|CDKongo Demokratik Cumhuriyeti|CRKosta Rika|CIFildişi Sahili|HRHırvatistan|CUKüba|CYKıbrıs|CZÇekya|DKDanimarka|DJCibuti|DMDominika|DODominik Cumhuriyeti|ECEkvador|EGMısır|SVEl Salvador|GQEkvator Ginesi|EREritre|EEEstonya|SZEsvatini|ETEtiyopya|FJFiji|FIFinlandiya|FRFransa|GAGabon|GMGambiya|GEGürcistan|DEAlmanya|GHGana|GRYunanistan|GDGrenada|GTGuatemala|GNGine|GWGine-Bissau|GYGuyana|HTHaiti|HNHonduras|HUMacaristan|ISİzlanda|INHindistan|IDEndonezya|IRİran|IQIrak|IEİrlanda|ILİsrail|ITİtalya|JMJamaika|JPJaponya|JOÜrdün|KZKazakistan|KEKenya|KIKiribati|KWKuveyt|KGKırgızistan|LALaos|LVLetonya|LBLübnan|LSLesotho|LRLiberya|LYLibya|LILihtenştayn|LTLitvanya|LULüksemburg|MGMadagaskar|MWMalavi|MYMalezya|MVMaldivler|MLMali|MTMalta|MHMarshall Adaları|MRMoritanya|MUMauritius|MXMeksika|FMMikronezya|MDMoldova|MCMonako|MNMoğolistan|MEKaradağ|MAFas|MZMozambik|MMMyanmar|NANamibya|NRNauru|NPNepal|NLHollanda|NZYeni Zelanda|NINikaragua|NENijer|NGNijerya|KPKuzey Kore|MKKuzey Makedonya|NONorveç|OMUmman|PKPakistan|PWPalau|PSFilistin|PAPanama|PGPapua Yeni Gine|PYParaguay|PEPeru|PHFilipinler|PLPolonya|PTPortekiz|PRPorto Riko|QAKatar|RORomanya|RURusya|RWRuanda|KNSaint Kitts ve Nevis|LCSaint Lucia|VCSaint Vincent ve Grenadinler|WSSamoa|SMSan Marino|STSao Tome ve Principe|SASuudi Arabistan|SNSenegal|RSSırbistan|SCSeyşeller|SLSierra Leone|SGSingapur|SKSlovakya|SISlovenya|SBSolomon Adaları|SOSomali|ZAGüney Afrika|KRGüney Kore|SSGüney Sudan|ESİspanya|LKSri Lanka|SDSudan|SRSurinam|SEİsveç|CHİsviçre|SYSuriye|TWTayvan|TJTacikistan|TZTanzanya|THTayland|TLDoğu Timor|TGTogo|TOTonga|TTTrinidad ve Tobago|TNTunus|TRTürkiye|TMTürkmenistan|TVTuvalu|UGUganda|UAUkrayna|AEBirleşik Arap Emirlikleri|GBBirleşik Krallık|USAmerika Birleşik Devletleri|UYUruguay|UZÖzbekistan|VUVanuatu|VAVatikan|VEVenezuela|VNVietnam|YEYemen|ZMZambiya|ZWZimbabve|XKKosova|HKHong Kong|MOMakao";
const YOL_TRACK_STATUS = {
  hazirlaniyor: "Hazırlanıyor",
  kargoda: "Kargoda",
  teslim: "Teslim edildi",
  iade: "İade",
};
const YOL_CARGO = {
  yurtici: "Yurtiçi Kargo",
  aras: "Aras Kargo",
  mng: "MNG Kargo",
  surat: "Sürat Kargo",
  ptt: "PTT Kargo",
};
const YOL_CARGO_FEE = {
  yurtici: 59.9,
  aras: 54.9,
  mng: 49.9,
  surat: 44.9,
  ptt: 39.9,
};

function yolCargoKey(value) {
  const key = String(value || "").toLowerCase();
  return YOL_CARGO[key] ? key : "yurtici";
}

function yolCargoFee(value) {
  return YOL_CARGO_FEE[yolCargoKey(value)] || YOL_CARGO_FEE.yurtici;
}

function yolCargoName(value) {
  return YOL_CARGO[yolCargoKey(value)];
}

function yolTrackStatusLabel(value) {
  return YOL_TRACK_STATUS[value] || YOL_TRACK_STATUS.hazirlaniyor;
}

function yolCargoTrackUrl(cargo, code) {
  const no = encodeURIComponent(String(code || "").trim());
  if (!no) return "";
  const key = yolCargoKey(cargo);
  if (key === "yurtici") return `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${no}`;
  if (key === "aras") return `https://kargotakip.araskargo.com.tr/?code=${no}`;
  if (key === "mng") return `https://kargotakip.mngkargo.com.tr/?takipNo=${no}`;
  if (key === "surat") return `https://www.suratkargo.com.tr/KargoTakip/?kargotakipno=${no}`;
  return `https://gonderitakip.ptt.gov.tr/`;
}

function yolCountries() {
  return YOL_COUNTRY_PACK.split("|").map((row) => ({ c: row.slice(0, 2), n: row.slice(2) }));
}

function yolFlag(code) {
  const cc = String(code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc].map((ch) => 127397 + ch.charCodeAt(0)));
}

function yolCountryByCode(code) {
  const cc = String(code || "TR").toUpperCase();
  return yolCountries().find((row) => row.c === cc) || { c: "TR", n: "Türkiye" };
}

function yolShopCountryCode() {
  const cur = String(store.get(YOL_SHOP_COUNTRY, "TR") || "TR").toUpperCase();
  return yolCountryByCode(cur).c;
}

function yolShopCountryCodes() {
  const raw = store.get(YOL_SHOP_COUNTRIES, null);
  const list = Array.isArray(raw) ? raw.map((c) => String(c || "").toUpperCase()) : [];
  const cur = yolShopCountryCode();
  const uniq = [...new Set(list.filter((c) => yolCountries().some((row) => row.c === c)))];
  if (!uniq.includes(cur)) uniq.unshift(cur);
  return uniq;
}

function yolSetShopCountries(codes, current) {
  const all = yolCountries();
  let uniq = [...new Set((codes || []).map((c) => String(c || "").toUpperCase()))].filter((c) =>
    all.some((row) => row.c === c)
  );
  let active = String(current || uniq[0] || "TR").toUpperCase();
  if (!uniq.includes(active)) uniq.unshift(active);
  if (!uniq.length) {
    uniq = ["TR"];
    active = "TR";
  }
  store.set(YOL_SHOP_COUNTRIES, uniq);
  store.set(YOL_SHOP_COUNTRY, active);
}

function yolSellerShipCodes() {
  const seller = yolSeller();
  if (!seller) return [];
  const partner = yolPartnerKindFor(seller.phone, seller.mail);
  const raw = partner?.shipCountries;
  return Array.isArray(raw) ? raw.map((c) => String(c || "").toUpperCase()).filter(Boolean) : [];
}

function yolSetSellerShipCodes(codes) {
  const seller = yolSeller();
  if (!seller) return;
  const uniq = [...new Set((codes || []).map((c) => String(c || "").toUpperCase()))].filter((c) =>
    yolCountries().some((row) => row.c === c)
  );
  store.set(
    YOL_PARTNERS,
    store.get(YOL_PARTNERS, []).map((p) => {
      if (yolMail(p.mail) !== yolMail(seller.mail) && yolGsm(p.phone) !== yolGsm(seller.phone)) return p;
      return { ...p, shipCountries: uniq };
    })
  );
}

function yolCountryLabel(code) {
  const row = yolCountryByCode(code);
  return `${yolFlag(row.c)} ${row.n}`;
}

function yolCountryRowHtml(row, name, checked, current) {
  const on = current && row.c === current;
  return `<label class="${on ? "is-on" : ""}">
    <input type="checkbox" name="${name}" value="${row.c}"${checked ? " checked" : ""} />
    <span class="yol-country-flag" aria-hidden="true">${yolFlag(row.c)}</span>
    <span>${escapeHtml(row.n)}</span>
  </label>`;
}

function yolSyncCountryUi() {
  const cur = yolCountryByCode(yolShopCountryCode());
  const label = yolCountryLabel(cur.c);
  if ($("#yolCountryNow")) $("#yolCountryNow").innerHTML = label;
  if ($("#yolFooterCountry")) $("#yolFooterCountry").innerHTML = label;
  if ($("#yolPayCountryHint")) {
    $("#yolPayCountryHint").textContent = `${cur.n} ülkesine sipariş verilecek. Satıcıdan kargoyu bu ülkeye göndermesi talep edilir.`;
  }
}

function renderYolCountries() {
  yolSyncCountryUi();
  const q = String($("#yolCountryQuery")?.value || "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  const picked = yolShopCountryCodes();
  const current = yolShopCountryCode();
  const rows = yolCountries()
    .slice()
    .sort((a, b) => {
      if (a.c === "TR") return -1;
      if (b.c === "TR") return 1;
      return a.n.localeCompare(b.n, "tr");
    })
    .filter((row) => !q || row.n.toLocaleLowerCase("tr-TR").includes(q) || row.c.toLowerCase().includes(q));
  if ($("#yolCountryPicked")) {
    $("#yolCountryPicked").innerHTML = picked
      .map((code) => {
        const row = yolCountryByCode(code);
        return `<span class="yol-country-chip${code === current ? " is-on" : ""}">${yolFlag(row.c)} ${escapeHtml(row.n)}</span>`;
      })
      .join("");
  }
  if ($("#yolCountryBox")) {
    $("#yolCountryBox").innerHTML = rows
      .map((row) => yolCountryRowHtml(row, "yolShopCountry", picked.includes(row.c), current))
      .join("");
  }
  const sellerOn = yolHasDesk();
  if ($("#yolSellerCountryCard")) $("#yolSellerCountryCard").hidden = !sellerOn;
  if (!sellerOn) return;
  const sq = String($("#yolSellerCountryQuery")?.value || "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  const ship = yolSellerShipCodes();
  const srows = yolCountries()
    .slice()
    .sort((a, b) => {
      if (a.c === "TR") return -1;
      if (b.c === "TR") return 1;
      return a.n.localeCompare(b.n, "tr");
    })
    .filter((row) => !sq || row.n.toLocaleLowerCase("tr-TR").includes(sq) || row.c.toLowerCase().includes(sq));
  if ($("#yolSellerCountryPicked")) {
    $("#yolSellerCountryPicked").innerHTML = ship.length
      ? ship.map((code) => `<span class="yol-country-chip">${yolCountryLabel(code)}</span>`).join("")
      : "<p class='hint'>Henüz ülke işaretlenmedi. Tüm dünya talebi alınır.</p>";
  }
  if ($("#yolSellerCountryBox")) {
    $("#yolSellerCountryBox").innerHTML = srows
      .map((row) => yolCountryRowHtml(row, "yolShipCountry", ship.includes(row.c), ""))
      .join("");
  }
}

function yolProductCargo(item) {
  if (item?.cargo) return yolCargoKey(item.cargo);
  const partner = yolPartnerKindFor(item?.sellerPhone, item?.sellerMail);
  return yolCargoKey(partner?.cargo);
}

function yolPhone(value) {
  return String(value || "").replace(/\s+/g, "");
}

function yolMail(value) {
  return String(value || "").trim().toLowerCase();
}

async function yolReadDoc(input) {
  const file = input?.files?.[0];
  if (!file) throw new Error("Belge yükleyin.");
  if (file.size > 6 * 1024 * 1024) throw new Error("Dosya en fazla 6 MB olabilir.");
  const dataUrl = await dataUrlFromBlob(file);
  return { name: file.name, type: file.type, dataUrl };
}

function posReadDoc(input) {
  return yolReadDoc(input);
}

function yolMembers() {
  return store.get(YOL_MEMBERS, []);
}

function yolDemoList() {
  return [
    {
      demoId: "demo-ticari",
      kind: "ticari",
      role: "satici",
      first: "Ahmet",
      last: "Ticari",
      phone: "5550000101",
      mail: "demo.ticari@harbiyol.test",
      pin: "1234",
      address: "Organize Sanayi, Kayseri",
      tc: "12345678901",
      vkn: "1234567890",
    },
    {
      demoId: "demo-bireysel",
      kind: "bireysel",
      role: "satici",
      first: "Elif",
      last: "Bireysel",
      phone: "5550000202",
      mail: "demo.bireysel@harbiyol.test",
      pin: "1234",
      address: "Alsancak, İzmir",
    },
    {
      demoId: "demo-musteri",
      kind: "musteri",
      role: "musteri",
      first: "Ayşe",
      last: "Müşteri",
      phone: "5550000303",
      mail: "demo.musteri@harbiyol.test",
      pin: "1234",
      address: "Kadıköy, İstanbul",
    },
  ];
}

function yolSite() {
  const cur = store.get(YOL_SITE, {}) || {};
  return {
    marketTitle: cur.marketTitle || "Pazar yeri",
    marketHint: cur.marketHint || "Çoklu satıcı pazarı. Satıcılar ürün yükler, müşteriler alışveriş yapar.",
  };
}

function yolRole(member) {
  if (!member) return "";
  if (member.role === "satici") return "satici";
  if (member.role === "musteri") return "musteri";
  if (yolPartnerKindFor(member.phone, member.mail)) return "satici";
  return "musteri";
}

function yolEnsureDemos() {
  const demos = yolDemoList();
  const members = yolMembers();
  let membersChanged = false;
  demos.forEach((demo) => {
    const exists = members.some(
      (m) => m.demoId === demo.demoId || yolGsm(m.phone) === demo.phone || yolMail(m.mail) === demo.mail
    );
    if (exists) return;
    members.push({
      id: `demo-member-${demo.kind}`,
      demoId: demo.demoId,
      role: demo.role,
      first: demo.first,
      last: demo.last,
      phone: demo.phone,
      mail: demo.mail,
      address: demo.address,
      pin: demo.pin,
      phoneOk: true,
    });
    membersChanged = true;
  });
  members.forEach((m) => {
    if (m.role) return;
    const demo = demos.find((d) => d.demoId === m.demoId);
    m.role = demo?.role || (yolPartnerKindFor(m.phone, m.mail) ? "satici" : "musteri");
    membersChanged = true;
  });
  if (membersChanged) store.set(YOL_MEMBERS, members);

  const partners = store.get(YOL_PARTNERS, []);
  let partnersChanged = false;
  demos.forEach((demo) => {
    if (demo.role !== "satici") return;
    const exists = partners.some(
      (p) => p.demoId === demo.demoId || yolGsm(p.phone) === demo.phone || yolMail(p.mail) === demo.mail
    );
    if (exists) return;
    const doc = { name: `${demo.kind}-demo.pdf`, type: "application/pdf" };
    partners.push({
      id: `demo-partner-${demo.kind}`,
      demoId: demo.demoId,
      kind: demo.kind,
      first: demo.first,
      last: demo.last,
      tc: demo.tc || null,
      vkn: demo.vkn || null,
      phone: demo.phone,
      mail: demo.mail,
      address: demo.address,
      imza: demo.kind === "ticari" ? doc : null,
      ikamet: demo.kind === "ticari" ? doc : null,
      vergiLevha: demo.kind === "ticari" ? doc : null,
      cargo: demo.kind === "ticari" ? "yurtici" : "aras",
    });
    partnersChanged = true;
  });
  partners.forEach((p) => {
    if (p.status === "pending") {
      p.status = "approved";
      partnersChanged = true;
    }
    if (!p.cargo) {
      p.cargo = p.kind === "ticari" ? "yurtici" : "aras";
      partnersChanged = true;
    }
    if (!Array.isArray(p.badges) || !p.badges.length) {
      p.badges = p.kind === "ticari" ? ["verified", "authorized"] : ["success"];
      partnersChanged = true;
    }
  });
  if (partnersChanged) store.set(YOL_PARTNERS, partners);
  let rolesFixed = false;
  members.forEach((m) => {
    if (m.role === "admin") {
      m.role = "musteri";
      rolesFixed = true;
    }
    if (yolPartnerKindFor(m.phone, m.mail) && m.role !== "satici") {
      m.role = "satici";
      rolesFixed = true;
    }
  });
  if (rolesFixed) store.set(YOL_MEMBERS, members);

  const products = store.get(YOL_PRODUCTS, []);
  const demoSeriesItems = [
    { name: "Mont M", size: "M", color: "Siyah", gender: "Unisex", price: "1299" },
    { name: "Mont L", size: "L", color: "Lacivert", gender: "Unisex", price: "1399" },
  ];
  const demoSeries = products.find((p) => p.demoId === "demo-ticari-series");
  if (demoSeries) {
    demoSeries.items = demoSeriesItems;
    if (demoSeries.sold == null) demoSeries.sold = 18;
    if (demoSeries.favs == null) demoSeries.favs = 11;
    if (demoSeries.reviews == null) demoSeries.reviews = 7;
    if (demoSeries.createdAt == null) demoSeries.createdAt = 1;
    if (!demoSeries.brand) demoSeries.brand = "Harbi";
    if (!demoSeries.season) demoSeries.season = "Kış";
    if (demoSeries.flash == null) demoSeries.flash = true;
    if (!demoSeries.dept) demoSeries.dept = "kadin";
    if (!demoSeries.sellerBadges) demoSeries.sellerBadges = ["verified", "authorized"];
    if (!demoSeries.cargo) demoSeries.cargo = "yurtici";
  } else {
    products.unshift({
      id: "demo-prod-ticari-series",
      demoId: "demo-ticari-series",
      type: "series",
      name: "Harbi Kışlık Serisi",
      desc: "Demo ticari ürün serisi",
      sellerKind: "ticari",
      sellerPhone: "5550000101",
      sellerMail: "demo.ticari@harbiyol.test",
      sellerName: "Ahmet Ticari",
      items: demoSeriesItems,
      sold: 18,
      favs: 11,
      reviews: 7,
      createdAt: 1,
      brand: "Harbi",
      season: "Kış",
      flash: true,
      dept: "kadin",
      sellerBadges: ["verified", "authorized"],
      cargo: "yurtici",
    });
  }
  const demoSoap = products.find((p) => p.demoId === "demo-bireysel-single");
  if (demoSoap) {
    if (demoSoap.sold == null) demoSoap.sold = 42;
    if (demoSoap.favs == null) demoSoap.favs = 25;
    if (demoSoap.reviews == null) demoSoap.reviews = 19;
    if (demoSoap.createdAt == null) demoSoap.createdAt = 2;
    if (!demoSoap.brand) demoSoap.brand = "Harbi";
    if (demoSoap.deal == null) demoSoap.deal = true;
    if (demoSoap.coupon == null) demoSoap.coupon = true;
    if (!demoSoap.dept) demoSoap.dept = "kozmetik";
    if (!demoSoap.sellerBadges) demoSoap.sellerBadges = ["success"];
    if (!demoSoap.cargo) demoSoap.cargo = "aras";
  } else if (!products.some((p) => p.demoId === "demo-bireysel-single")) {
    products.unshift({
      id: "demo-prod-bireysel-single",
      demoId: "demo-bireysel-single",
      type: "single",
      name: "El yapımı sabun",
      price: "85",
      desc: "Demo bireysel tekli ürün",
      sellerKind: "bireysel",
      sellerPhone: "5550000202",
      sellerMail: "demo.bireysel@harbiyol.test",
      sellerName: "Elif Bireysel",
      sold: 42,
      favs: 25,
      reviews: 19,
      createdAt: 2,
      brand: "Harbi",
      deal: true,
      coupon: true,
      dept: "kozmetik",
      sellerBadges: ["success"],
      cargo: "aras",
    });
  }
  store.set(YOL_PRODUCTS, products.slice(0, 200));

  const orders = store.get(YOL_ORDERS, []);
  if (!orders.some((o) => o.demoId === "demo-ticari-order")) {
    orders.unshift({
      id: "demo-order-ticari-1",
      demoId: "demo-ticari-order",
      at: Date.now() - 86400000,
      sellerMail: "demo.ticari@harbiyol.test",
      sellerPhone: "5550000101",
      sellerName: "Ahmet Ticari",
      method: "cod",
      buyer: {
        name: "Ayşe Müşteri",
        email: "demo.musteri@harbiyol.test",
        phone: "5550000303",
        address: "Kadıköy, İstanbul",
      },
      lines: [{ id: "demo-prod-ticari-series", name: "Harbi Kışlık Serisi", qty: 1, unit: 1299, sum: 1299 }],
      goods: 1299,
      ship: 59.9,
      discount: 0,
      total: 1358.9,
    });
    store.set(YOL_ORDERS, orders.slice(0, 400));
  }
  if (!orders.some((o) => o.demoId === "demo-bireysel-order")) {
    orders.unshift({
      id: "demo-order-bireysel-1",
      demoId: "demo-bireysel-order",
      at: Date.now() - 43200000,
      sellerMail: "demo.bireysel@harbiyol.test",
      sellerPhone: "5550000202",
      sellerName: "Elif Bireysel",
      method: "card",
      buyer: {
        name: "Ayşe Müşteri",
        email: "demo.musteri@harbiyol.test",
        phone: "5550000303",
        address: "Kadıköy, İstanbul",
      },
      lines: [{ id: "demo-prod-bireysel-single", name: "El yapımı sabun", qty: 2, unit: 85, sum: 170 }],
      goods: 170,
      ship: 54.9,
      discount: 0,
      total: 224.9,
    });
    store.set(YOL_ORDERS, orders.slice(0, 400));
  }
  let orderTrackFix = false;
  orders.forEach((o) => {
    if (o.demoId === "demo-bireysel-order" && !o.trackNo) {
      o.cargo = "aras";
      o.trackNo = "ARB123456789TR";
      o.trackStatus = "kargoda";
      orderTrackFix = true;
    }
    if (o.demoId === "demo-ticari-order" && !o.trackNo) {
      o.cargo = o.cargo || "yurtici";
      o.trackNo = "YK123456789TR";
      o.trackStatus = o.trackStatus || "kargoda";
      orderTrackFix = true;
    }
  });
  if (orderTrackFix) store.set(YOL_ORDERS, orders.slice(0, 400));
  const addrs = store.get(YOL_ADDRESSES, []);
  if (!addrs.some((a) => a.demoId === "demo-bireysel-addr")) {
    addrs.unshift({
      id: "demo-addr-bireysel",
      demoId: "demo-bireysel-addr",
      sellerMail: "demo.bireysel@harbiyol.test",
      title: "Ev / Atölye",
      city: "İzmir",
      line: "Alsancak, İzmir",
      phone: "5550000202",
      primary: true,
      kind: "ship",
    });
    store.set(YOL_ADDRESSES, addrs.slice(0, 80));
  }
  if (!addrs.some((a) => a.demoId === "demo-bireysel-return")) {
    addrs.unshift({
      id: "demo-addr-bireysel-return",
      demoId: "demo-bireysel-return",
      sellerMail: "demo.bireysel@harbiyol.test",
      kind: "return",
      title: "İade adresi",
      city: "İzmir",
      line: "Alsancak Kıbrıs Şehitleri Cd., İzmir",
      phone: "5550000202",
    });
    store.set(YOL_ADDRESSES, addrs.slice(0, 80));
  }
  if (!addrs.some((a) => a.demoId === "demo-ticari-addr")) {
    addrs.unshift({
      id: "demo-addr-ticari",
      demoId: "demo-ticari-addr",
      sellerMail: "demo.ticari@harbiyol.test",
      title: "Depo / İşyeri",
      city: "Kayseri",
      line: "Organize Sanayi, Kayseri",
      phone: "5550000101",
      primary: true,
      kind: "ship",
    });
    store.set(YOL_ADDRESSES, addrs.slice(0, 80));
  }
  if (!addrs.some((a) => a.demoId === "demo-ticari-return")) {
    addrs.unshift({
      id: "demo-addr-ticari-return",
      demoId: "demo-ticari-return",
      sellerMail: "demo.ticari@harbiyol.test",
      kind: "return",
      title: "İade deposu",
      city: "Kayseri",
      line: "Organize Sanayi 2. Cadde No:14, Kayseri",
      phone: "5550000101",
    });
    store.set(YOL_ADDRESSES, addrs.slice(0, 80));
  }
  const coupons = store.get(YOL_COUPONS, []);
  if (!coupons.some((c) => c.demoId === "demo-ticari-coupon")) {
    coupons.unshift({
      id: "demo-coupon-ticari",
      demoId: "demo-ticari-coupon",
      sellerMail: "demo.ticari@harbiyol.test",
      code: "HARBI10",
      percent: 10,
      uses: 0,
      maxUses: 100,
      createdAt: Date.now(),
    });
    store.set(YOL_COUPONS, coupons);
  }
}

function yolEnterDemo(kind) {
  yolEnsureDemos();
  const demo = yolDemoList().find((item) => item.kind === kind);
  if (!demo) return;
  const member = yolMembers().find((m) => m.demoId === demo.demoId) || yolFindMember(demo.phone, demo.mail);
  const partner = yolPartnerKindFor(demo.phone, demo.mail);
  if (!member) return;
  yolRememberLast(member);
  store.set(YOL_SESSION, member.id);
  if (partner) store.set(YOL_SELLER, { id: partner.id, kind: partner.kind, phone: partner.phone, mail: partner.mail });
  renderYol();
  showView(yolHasDesk() ? "desk" : "sell");
  renderYolSeller();
  if (yolHasDesk()) renderYolDesk();
}

function yolMe() {
  const id = store.get(YOL_SESSION, null);
  return yolMembers().find((m) => m.id === id) || null;
}

function yolPartnerKindFor(phone, mail) {
  const gsm = yolGsm(phone);
  const email = yolMail(mail);
  const mine = store.get(YOL_PARTNERS, []).filter(
    (p) => p.status !== "rejected" && ((gsm && yolGsm(p.phone) === gsm) || (email && yolMail(p.mail) === email))
  );
  if (!mine.length) return null;
  return mine.find((p) => p.kind === "ticari") || mine[0];
}

function yolSeller() {
  const me = yolMe();
  if (!me) return null;
  const partner = yolPartnerKindFor(me.phone, me.mail);
  if (!partner && yolRole(me) !== "satici") return null;
  const kind = partner?.kind === "ticari" ? "ticari" : partner?.kind === "bireysel" ? "bireysel" : "uye";
  return {
    kind,
    first: me.first,
    last: me.last,
    phone: me.phone,
    mail: me.mail,
    memberId: me.id,
    role: "satici",
    cargo: yolCargoKey(partner?.cargo),
  };
}

function yolSellerListingType() {
  const seller = yolSeller();
  if (!seller || seller.kind !== "ticari") return "single";
  const picked = document.querySelector('input[name="yolListType"]:checked')?.value;
  return picked === "series" ? "series" : "single";
}

function yolSeriesRowHtml() {
  return `<div class="yol-series-row">
    <input class="yol-var-name" placeholder="Varyant adı" maxlength="80" />
    <input class="yol-var-size" placeholder="Beden" maxlength="20" />
    <input class="yol-var-color" placeholder="Renk" maxlength="30" />
    <select class="yol-var-gender">
      <option value="">Cinsiyet</option>
      <option value="Kadın">Kadın</option>
      <option value="Erkek">Erkek</option>
      <option value="Unisex">Unisex</option>
      <option value="Çocuk">Çocuk</option>
    </select>
    <input class="yol-var-price" inputmode="decimal" placeholder="Fiyat ₺" />
  </div>`;
}

function yolEnsureSeriesRows() {
  const box = $("#yolSeriesRows");
  if (!box) return;
  if (!box.children.length) {
    box.insertAdjacentHTML("beforeend", yolSeriesRowHtml() + yolSeriesRowHtml());
  }
}

function yolSyncSellerTypeUi() {
  const seller = yolSeller();
  const noSeries = !seller || seller.kind !== "ticari";
  const type = yolSellerListingType();
  if ($("#yolSellerTypeRow")) $("#yolSellerTypeRow").hidden = noSeries;
  if (noSeries) {
    const single = document.querySelector('input[name="yolListType"][value="single"]');
    if (single) single.checked = true;
  }
  const series = !noSeries && type === "series";
  if ($("#yolSingleBox")) $("#yolSingleBox").hidden = series;
  if ($("#yolSeriesBox")) $("#yolSeriesBox").hidden = !series;
  if (series) yolEnsureSeriesRows();
}

function yolVariantLine(v) {
  const bits = [v.name, v.gender, v.color && `Renk ${v.color}`, v.size && `Beden ${v.size}`].filter(Boolean);
  const label = bits.join(" · ") || "Varyant";
  return `<p class="hint">${escapeHtml(label)} · ${formatTry(parseMoney(v.price))}</p>`;
}

function yolPhotoSrc(item) {
  const u = item?.photo?.dataUrl || "";
  return String(u).startsWith("data:image") ? u : "";
}

function yolProductCardHtml(item, canDelete) {
  const src = yolPhotoSrc(item);
  const camp = yolCampaignForProduct(item);
  const unit = yolProductUnitPrice(item);
  const base = yolProductBasePrice(item);
  const priceHtml =
    camp && unit < base
      ? `<p class="price"><s class="yol-old-price">${formatTry(base)}</s> ${formatTry(unit)} · ${escapeHtml(camp.name)} %${escapeHtml(String(camp.percent))}</p>`
      : `<p class="price">${formatTry(unit)}</p>`;
  const extra =
    item.type === "series" && Array.isArray(item.items)
      ? item.items.map(yolVariantLine).join("") + (camp ? priceHtml : "")
      : priceHtml;
  return `<article class="holiday-hit">
    <div class="yol-photo-box">${src ? `<img class="gk-photo" src="${src}" alt="" />` : ""}</div>
    <div class="yol-product-body">
      <strong>${escapeHtml(item.name || "Ürün")}</strong>
      <p class="hint">${escapeHtml(item.sellerName || "Satıcı")} · ${item.type === "series" ? "Ürün serisi" : "Tekli ürün"} · ${escapeHtml(yolCargoName(yolProductCargo(item)))}${camp ? " · Kampanya" : ""}</p>
      ${extra}
      <button class="primary yol-cart-add" type="button" data-yol-cart="${item.id}">Sepete ekle</button>
      ${canDelete ? `<button class="danger" type="button" data-yol-del="${item.id}">Ürünü sil</button>` : ""}
    </div>
  </article>`;
}

function yolCartItems() {
  return store.get(YOL_CART, []);
}

function yolProductCreated(item) {
  const n = Number(item?.createdAt || item?.id);
  return Number.isFinite(n) ? n : 0;
}

function yolProductStat(item, key) {
  const n = Number(item?.[key]);
  return Number.isFinite(n) ? n : 0;
}

function yolSortProducts(list) {
  const mode = $('input[name="yolSortPick"]:checked')?.value || $("#yolProductSort")?.value || "recommended";
  const items = [...(list || [])];
  if (mode === "price-asc") items.sort((a, b) => yolProductUnitPrice(a) - yolProductUnitPrice(b));
  else if (mode === "price-desc") items.sort((a, b) => yolProductUnitPrice(b) - yolProductUnitPrice(a));
  else if (mode === "sold") items.sort((a, b) => yolProductStat(b, "sold") - yolProductStat(a, "sold") || yolProductCreated(b) - yolProductCreated(a));
  else if (mode === "fav") items.sort((a, b) => yolProductStat(b, "favs") - yolProductStat(a, "favs") || yolProductCreated(b) - yolProductCreated(a));
  else if (mode === "new") items.sort((a, b) => yolProductCreated(b) - yolProductCreated(a));
  else if (mode === "rated") items.sort((a, b) => yolProductStat(b, "reviews") - yolProductStat(a, "reviews") || yolProductCreated(b) - yolProductCreated(a));
  return items;
}

const YOL_CAT_BOOL = { deal: true, flash: true, coupon: true };

const YOL_BRANDS = [
  "Penti",
  "Mango",
  "Vivense",
  "Watsons",
  "English Home",
  "Bershka",
  "Stradivarius",
  "The North Face",
  "Beymen",
  "Columbia",
  "Samsung",
  "Lumberjack",
  "Puma",
  "Mudo",
  "Derimod",
  "Apple",
  "New Balance",
  "Huawei",
  "Xiaomi",
  "Oppo",
  "Monster Notebook",
  "Birkenstock",
  "Arçelik",
  "DYSON",
  "Adidas",
  "Nike",
  "Skechers",
  "Lacoste",
  "Avva",
  "Under Armour",
  "Madame Coco",
  "Pull & Bear",
  "Koton",
  "Defacto",
  "Mavi",
  "Pierre Cardin",
  "Tchibo",
  "Farmasi",
  "Helly Hansen",
  "Network",
  "Bosch",
  "Karaca",
  "Kiğılı",
  "CAT",
  "Orijinallik Takip Sistemi",
];

function yolFillBrandUi() {
  const box = $("#yolBrandBox");
  if (box && !box.children.length) {
    box.innerHTML = YOL_BRANDS.map(
      (name) =>
        `<label><input type="checkbox" name="yolBrand" value="${escapeHtml(name)}" /> ${escapeHtml(name)}</label>`
    ).join("");
  }
  const sel = $("#yolProdBrand");
  if (sel && sel.options.length <= 1) {
    const names = ["Harbi", ...YOL_BRANDS.filter((name) => name !== "Harbi")];
    sel.innerHTML =
      `<option value="">Marka seçin</option>` +
      names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  }
}

const YOL_CAT_VALUES = {
  gender: ["Kadın", "Erkek", "Unisex", "Çocuk"],
  brand: ["Harbi", ...YOL_BRANDS],
  color: ["Siyah", "Beyaz", "Lacivert", "Mavi", "Kırmızı", "Yeşil", "Bej", "Gri", "Kahverengi"],
  size: ["XS", "S", "M", "L", "XL", "XXL"],
  price: [
    { v: "0-100", t: "0 - 100 TL" },
    { v: "100-250", t: "100 - 250 TL" },
    { v: "250-500", t: "250 - 500 TL" },
    { v: "500-1000", t: "500 - 1000 TL" },
    { v: "1000+", t: "1000 TL ve üzeri" },
  ],
  height: ["Kısa", "Normal", "Uzun"],
  material: ["Pamuk", "Polyester", "Deri", "Yün", "Keten", "Viskon"],
  season: ["İlkbahar", "Yaz", "Sonbahar", "Kış"],
  fit: ["Slim", "Regular", "Oversize", "Relaxed"],
  collar: ["Bisiklet yaka", "V yaka", "Polo yaka", "Gömlek yaka", "Dik yaka"],
  seller: ["Ticari", "Bireysel"],
  fill: ["Elyaf", "Kuş tüyü", "Yün"],
  pattern: ["Düz", "Çizgili", "Ekose", "Baskılı", "Desenli"],
  lining: ["Astarlı", "Astarsız"],
  fabric: ["Dokuma", "Örme", "Denim", "Kadife"],
};

function yolCategoryKey() {
  return $('input[name="yolCatPick"]:checked')?.value || $("#yolProductCategory")?.value || "";
}

function yolSyncCategoryValue() {
  const key = yolCategoryKey();
  const sel = $("#yolProductCategoryValue");
  if (!sel) return;
  if (!key || YOL_CAT_BOOL[key]) {
    sel.hidden = true;
    sel.innerHTML = "";
    return;
  }
  const prev = sel.value;
  const raw = YOL_CAT_VALUES[key] || [];
  const opts = raw.map((row) => (typeof row === "string" ? { v: row, t: row } : row));
  sel.hidden = false;
  sel.innerHTML =
    `<option value="">Tümü</option>` +
    opts.map((row) => `<option value="${escapeHtml(row.v)}">${escapeHtml(row.t)}</option>`).join("");
  if ([...sel.options].some((opt) => opt.value === prev)) sel.value = prev;
}

function yolItemFieldTexts(item, fields) {
  const out = [];
  const push = (value) => {
    const s = String(value || "").trim();
    if (s) out.push(s.toLocaleLowerCase("tr-TR"));
  };
  fields.forEach((field) => push(item?.[field]));
  (item?.items || []).forEach((row) => fields.forEach((field) => push(row?.[field])));
  return out;
}

function yolMatchCategory(item) {
  const key = yolCategoryKey();
  if (!key) return true;
  if (key === "deal") return Boolean(item.deal) || Boolean(yolCampaignForProduct(item));
  if (key === "flash") return Boolean(item.flash) || Boolean(yolCampaignForProduct(item)?.flash);
  if (key === "coupon") return Boolean(item.coupon) || Boolean(yolCampaignForProduct(item));
  const val = String($("#yolProductCategoryValue")?.value || "").trim();
  if (!val) return true;
  const needle = val.toLocaleLowerCase("tr-TR");
  if (key === "price") {
    const price = yolProductUnitPrice(item);
    if (!Number.isFinite(price) || price === Number.POSITIVE_INFINITY) return false;
    if (val.endsWith("+")) return price >= Number(val.slice(0, -1));
    const [min, max] = val.split("-").map(Number);
    return price >= min && price <= max;
  }
  if (key === "seller") {
    return val === "Ticari" ? item.sellerKind === "ticari" : item.sellerKind === "bireysel";
  }
  const fields = {
    gender: ["gender"],
    brand: ["brand", "sellerName"],
    color: ["color"],
    size: ["size"],
    height: ["height", "boy"],
    material: ["material", "materyal"],
    season: ["season", "sezon"],
    fit: ["fit", "kalip"],
    collar: ["collar", "yaka"],
    fill: ["fill", "dolgu"],
    pattern: ["pattern", "desen"],
    lining: ["lining", "astar"],
    fabric: ["fabric", "kumas"],
  }[key] || [key];
  return yolItemFieldTexts(item, fields).some((text) => text === needle || text.includes(needle));
}

function yolFilterProducts(list) {
  return (list || [])
    .filter(yolMatchCategory)
    .filter(yolMatchDept)
    .filter(yolMatchColors)
    .filter(yolMatchPrice)
    .filter(yolMatchLength)
    .filter(yolMatchMaterial)
    .filter(yolMatchBrand)
    .filter(yolMatchSellerBadge);
}

function yolSelectedColors() {
  return $$('#yolColorGrid input[name="yolColor"]:checked').map((el) =>
    String(el.value || "").toLocaleLowerCase("tr-TR")
  );
}

function yolMatchColors(item) {
  const selected = yolSelectedColors();
  if (!selected.length) return true;
  const texts = yolItemFieldTexts(item, ["color", "renk"]);
  return selected.some((color) => texts.some((text) => text === color || text.includes(color)));
}

function yolPriceNum(value) {
  if (!String(value || "").trim()) return null;
  const n = parseMoney(value);
  return Number.isFinite(n) && n !== Number.POSITIVE_INFINITY ? n : null;
}

function yolMatchPrice(item) {
  const price = yolProductUnitPrice(item);
  if (!Number.isFinite(price) || price === Number.POSITIVE_INFINITY) return false;
  const min = yolPriceNum($("#yolPriceMin")?.value);
  const max = yolPriceNum($("#yolPriceMax")?.value);
  const ranges = $$('#yolPriceBox input[name="yolPriceRange"]:checked').map((el) => [
    Number(el.dataset.min),
    Number(el.dataset.max),
  ]);
  if (min == null && max == null && !ranges.length) return true;
  if (min != null && price < min) return false;
  if (max != null && price > max) return false;
  if (ranges.length && !ranges.some(([lo, hi]) => price >= lo && price <= hi)) return false;
  return true;
}

function yolMatchLength(item) {
  const selected = $$('#yolLengthBox input[name="yolLength"]:checked').map((el) =>
    String(el.value || "").toLocaleLowerCase("tr-TR")
  );
  if (!selected.length) return true;
  const texts = yolItemFieldTexts(item, ["height", "boy", "length"]);
  return selected.some((len) => texts.some((text) => text === len || text.includes(len)));
}

function yolMatchMaterial(item) {
  const selected = $$('#yolMaterialBox input[name="yolMaterial"]:checked').map((el) =>
    String(el.value || "").toLocaleLowerCase("tr-TR")
  );
  if (!selected.length) return true;
  const texts = yolItemFieldTexts(item, ["material", "materyal", "fabric", "kumas"]);
  return selected.some((mat) => texts.some((text) => text === mat || text.includes(mat) || mat.includes(text)));
}

function yolMatchBrand(item) {
  const selected = $$('#yolBrandBox input[name="yolBrand"]:checked').map((el) =>
    String(el.value || "").toLocaleLowerCase("tr-TR")
  );
  if (!selected.length) return true;
  const texts = yolItemFieldTexts(item, ["brand", "marka"]);
  return selected.some((brand) => texts.some((text) => text === brand || text.includes(brand)));
}

function yolDefaultSellerBadges(kind) {
  if (kind === "ticari") return ["verified", "authorized"];
  if (kind === "bireysel") return ["success"];
  return [];
}

function yolSellerBadgesOf(item) {
  if (Array.isArray(item?.sellerBadges) && item.sellerBadges.length) return item.sellerBadges;
  const gsm = yolGsm(item?.sellerPhone);
  const mail = yolMail(item?.sellerMail);
  const partner = store.get(YOL_PARTNERS, []).find(
    (p) => (gsm && yolGsm(p.phone) === gsm) || (mail && yolMail(p.mail) === mail)
  );
  if (Array.isArray(partner?.badges) && partner.badges.length) return partner.badges;
  return yolDefaultSellerBadges(item?.sellerKind || partner?.kind);
}

function yolMatchSellerBadge(item) {
  const picked = $$('#yolSellerBadgeBox input[name="yolSellerBadge"]:checked').map((el) => el.value);
  if (!picked.length) return true;
  const badges = yolSellerBadgesOf(item);
  return picked.some((badge) => badges.includes(badge));
}

let yolDeptActive = "";

function yolMatchDept(item) {
  if (!yolDeptActive) return true;
  if (yolDeptActive === "flash") return Boolean(item.flash) || Boolean(yolCampaignForProduct(item)?.flash);
  if (yolDeptActive === "sold") return yolProductStat(item, "sold") > 0;
  return String(item.dept || "") === yolDeptActive;
}

function yolSyncDeptChips() {
  $$("#yolDeptScroller [data-yol-dept]").forEach((btn) => {
    btn.classList.toggle("is-on", (btn.dataset.yolDept || "") === yolDeptActive);
  });
}

function yolListProducts(list) {
  let items = yolSortProducts(yolFilterProducts(list));
  if (yolDeptActive === "sold") {
    items.sort((a, b) => yolProductStat(b, "sold") - yolProductStat(a, "sold") || yolProductCreated(b) - yolProductCreated(a));
  }
  return items;
}

function yolRefreshProductLists() {
  const q = $("#yolProductQuery")?.value || "";
  if (String(q).trim()) renderYolProductSearch(q);
  else {
    renderYolMarket();
    renderYolSeller();
  }
}

function yolProductBasePrice(item) {
  if (item?.type === "series" && Array.isArray(item.items) && item.items[0]) {
    return parseMoney(item.items[0].price);
  }
  return parseMoney(item?.price);
}

function yolProductUnitPrice(item) {
  const base = yolProductBasePrice(item);
  const camp = yolCampaignForProduct(item);
  if (!camp) return base;
  const pct = Math.min(90, Math.max(1, Number(camp.percent) || 0));
  return Math.round(base * (1 - pct / 100) * 100) / 100;
}

function yolCartCount() {
  return yolCartItems().reduce((n, line) => n + Math.max(1, Number(line.qty) || 1), 0);
}

function yolSyncCartBtn() {
  const btn = $("#yolNavCart");
  const badge = $("#yolNavCartCount");
  if (!btn) return;
  const n = yolCartCount();
  btn.setAttribute("aria-label", n ? `Sepet (${n})` : "Sepet");
  if (badge) {
    badge.hidden = n < 1;
    badge.textContent = n > 99 ? "99+" : String(n);
  }
}

function yolCartAdd(id) {
  const product = store.get(YOL_PRODUCTS, []).find((p) => String(p.id) === String(id));
  if (!product) return;
  const items = yolCartItems();
  const found = items.find((line) => String(line.id) === String(id));
  if (found) found.qty = Math.max(1, Number(found.qty) || 1) + 1;
  else items.push({ id: product.id, qty: 1 });
  store.set(YOL_CART, items);
  const catalog = store.get(YOL_PRODUCTS, []);
  const listed = catalog.find((p) => String(p.id) === String(id));
  if (listed) {
    listed.sold = yolProductStat(listed, "sold") + 1;
    store.set(YOL_PRODUCTS, catalog);
  }
  const panel = $("#yolCartPanel");
  if (panel) panel.hidden = false;
  yolRenderCart();
}

function yolCartRemove(id) {
  store.set(
    YOL_CART,
    yolCartItems().filter((line) => String(line.id) !== String(id))
  );
  yolRenderCart();
}

function yolRenderCart() {
  yolSyncCartBtn();
  const box = $("#yolCartList");
  if (!box) return;
  const lines = yolCartLines();
  if (!lines.length) {
    box.innerHTML = "<p class='hint'>Sepetiniz boş.</p>";
    if ($("#yolCheckout")) $("#yolCheckout").hidden = true;
    return;
  }
  const goods = lines.reduce((n, line) => n + line.sum, 0);
  const ship = yolShippingFee();
  box.innerHTML =
    lines
      .map(
        (line) => {
          const src = yolPhotoSrc(line.product);
          const cargo = yolProductCargo(line.product);
          return `<article class="holiday-hit yol-cart-line">
      <div class="yol-photo-box">${src ? `<img class="gk-photo" src="${src}" alt="" />` : ""}</div>
      <div class="yol-product-body">
        <strong>${escapeHtml(line.product.name || "Ürün")}</strong>
        <p class="price">${formatTry(line.unit)} × ${line.qty} = ${formatTry(line.sum)}</p>
        <p class="hint">${escapeHtml(yolCargoName(cargo))} · kargo ${formatTry(yolCargoFee(cargo))}</p>
        <button class="linkish" type="button" data-yol-cart-del="${line.product.id}">Kaldır</button>
      </div>
    </article>`;
        }
      )
      .join("") +
    `<p class="hint">Ürün tutarı (kapıda): ${formatTry(goods)}</p>` +
    `<p class="price">Şimdi ödenecek kargo: ${formatTry(ship)}</p>`;
  const form = $("#yolCheckout");
  if (form) {
    form.hidden = false;
    const me = yolMe();
    if (me) {
      if ($("#yolPayName") && !$("#yolPayName").value) {
        $("#yolPayName").value = `${me.first || ""} ${me.last || ""}`.trim();
      }
      if ($("#yolPayMail") && !$("#yolPayMail").value) $("#yolPayMail").value = me.mail || "";
      if ($("#yolPayPhone") && !$("#yolPayPhone").value) $("#yolPayPhone").value = me.phone || "";
      if ($("#yolPayAddress") && !$("#yolPayAddress").value) $("#yolPayAddress").value = me.address || "";
    }
    yolSyncCountryUi();
    yolSyncPayButton();
  }
}

function yolCartLines() {
  const products = store.get(YOL_PRODUCTS, []);
  return yolCartItems()
    .map((line) => {
      const product = products.find((p) => String(p.id) === String(line.id));
      if (!product) return null;
      const qty = Math.max(1, Number(line.qty) || 1);
      const unit = yolProductUnitPrice(product);
      return { product, qty, unit, sum: unit * qty };
    })
    .filter(Boolean);
}

function yolShippingFee() {
  const groups = new Map();
  yolCartLines().forEach((line) => {
    const key = `${yolMail(line.product.sellerMail)}|${yolProductCargo(line.product)}`;
    if (!groups.has(key)) groups.set(key, yolCargoFee(yolProductCargo(line.product)));
  });
  return [...groups.values()].reduce((n, fee) => n + fee, 0);
}

function yolCartTotal() {
  return yolCartLines().reduce((n, line) => n + line.sum, 0);
}

function yolCoupons() {
  return store.get(YOL_COUPONS, []);
}

function yolCouponFind(code) {
  const needle = String(code || "").trim().toLocaleUpperCase("tr-TR");
  if (!needle) return null;
  return yolCoupons().find((c) => String(c.code || "").toLocaleUpperCase("tr-TR") === needle) || null;
}

function yolCampaigns() {
  return store.get(YOL_CAMPAIGNS, []);
}

function yolCampaignLive(c) {
  if (!c || c.active === false) return false;
  const now = Date.now();
  const start = c.start ? new Date(`${c.start}T00:00:00`).getTime() : 0;
  const end = c.end ? new Date(`${c.end}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
  return now >= start && now <= end;
}

function yolCampaignForProduct(item) {
  if (!item) return null;
  const mail = yolMail(item.sellerMail);
  const id = String(item.id);
  return (
    yolCampaigns().find((c) => {
      if (yolMail(c.sellerMail) !== mail || !yolCampaignLive(c)) return false;
      if (!Array.isArray(c.productIds) || !c.productIds.length) return true;
      return c.productIds.map(String).includes(id);
    }) || null
  );
}

function yolSellerCampaigns() {
  const seller = yolSeller();
  if (!seller) return [];
  const mail = yolMail(seller.mail);
  return yolCampaigns().filter((c) => yolMail(c.sellerMail) === mail);
}

function yolCartDiscount(code) {
  const coupon = yolCouponFind(code || $("#yolPayCoupon")?.value);
  if (!coupon) return { amount: 0, coupon: null };
  if (coupon.maxUses && Number(coupon.uses || 0) >= Number(coupon.maxUses)) return { amount: 0, coupon: null };
  const pct = Math.min(90, Math.max(1, Number(coupon.percent) || 0));
  const matching = yolCartLines().filter((line) => yolMail(line.product.sellerMail) === yolMail(coupon.sellerMail));
  const base = matching.reduce((n, line) => n + line.sum, 0);
  const amount = Math.round(base * (pct / 100) * 100) / 100;
  return { amount, coupon, percent: pct };
}

function yolPayMethod() {
  return document.querySelector('input[name="yolPayMethod"]:checked')?.value === "card" ? "card" : "cod";
}

function yolSyncPayButton() {
  const btn = $("#yolPaySubmit");
  if (!btn) return;
  const ship = yolShippingFee();
  const goods = yolCartTotal();
  const off = yolCartDiscount().amount;
  const payGoods = Math.max(0, goods - off);
  if (yolPayMethod() === "card") {
    btn.textContent = `Kredi kartı ile öde (${formatTry(payGoods + ship)})`;
  } else {
    btn.textContent = `Kargo ücretini öde (${formatTry(ship)})`;
  }
}

function yolPayMsg(text) {
  if ($("#yolPayMsg")) $("#yolPayMsg").textContent = text || "";
}

async function yolFinishCartPay(token) {
  const pending = store.get(YOL_PAY_PENDING, null);
  if (!pending || !token) return false;
  yolPayMsg("Kart ödemesi kontrol ediliyor…");
  try {
    const res = await fetch("/pos-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!data.ok) {
      yolPayMsg(data.error || "Ödeme alınamadı. Kartınızı kontrol edip yeniden deneyin.");
      store.set(YOL_PAY_PENDING, null);
      return true;
    }
    const pending = store.get(YOL_PAY_PENDING, null);
    if (pending?.lines?.length) yolRecordOrder(pending);
    store.set(YOL_CART, []);
    store.set(YOL_PAY_PENDING, null);
    const panel = $("#yolCartPanel");
    if (panel) panel.hidden = false;
    yolRenderCart();
    yolPayMsg(
      pending?.method === "card"
        ? "Ödeme alındı. Siparişiniz kargoya verilecek."
        : "Kargo ücreti alındı. Ürün tutarını kapıda ödeyeceksiniz."
    );
    if ($("#yolCheckout")) $("#yolCheckout").hidden = true;
  } catch {
    yolPayMsg("Ödeme sonucu alınamadı. Canlı sitede tekrar deneyin.");
  }
  const url = new URL(location.href);
  if (url.searchParams.has("posToken")) {
    url.searchParams.delete("posToken");
    history.replaceState({}, "", url.pathname + url.search + url.hash);
  }
  return true;
}

function renderYolMarket() {
  const board = $("#yolMarketBoard");
  const box = $("#yolMarketList");
  if (!board || !box) return;
  const view = document.querySelector(".view.active")?.dataset.view || "home";
  const authOpen = Boolean($("#yolAuthPanel") && !$("#yolAuthPanel").hidden);
  const partnerOpen = Boolean($("#yolPartnerPanel") && !$("#yolPartnerPanel").hidden);
  const searching = Boolean($("#yolSearchResults") && !$("#yolSearchResults").hidden);
  board.hidden = view !== "home" || authOpen || partnerOpen || searching;
  if (board.hidden) return;
  const site = yolSite();
  if ($("#yolMarketTitle")) $("#yolMarketTitle").textContent = site.marketTitle;
  if ($("#yolMarketHint")) $("#yolMarketHint").textContent = site.marketHint;
  const products = yolListProducts(store.get(YOL_PRODUCTS, []));
  box.innerHTML = products.length
    ? products.map((item) => yolProductCardHtml(item, false)).join("")
    : "<p class='hint'>Henüz ürün yok.</p>";
}

function renderYolSeller() {
  const onSell = document.querySelector(".view.active")?.dataset.view === "sell";
  const seller = yolSeller();
  if ($("#yolSellNeedAuth")) $("#yolSellNeedAuth").hidden = !onSell || Boolean(seller);
  const card = $("#yolSellerCard");
  if (card) card.hidden = !onSell || !seller;
  if (!onSell || !seller) return;
  yolSyncSearch();
  if ($("#yolSellerHint")) {
    $("#yolSellerHint").textContent =
      seller.kind === "ticari"
        ? "Bu sizin ürün yükleme sayfanız. Ticari faaliyet tekli ürün veya ürün serisi yükler. Yukarıdaki arama ile kendi ürünlerinizi kontrol edin."
        : seller.kind === "bireysel"
          ? "Bu sizin ürün yükleme sayfanız. Bireysel satış yalnızca tekli ürün yükler; ürün serisi eklenemez."
          : "Bu sizin ürün yükleme sayfanız. Tekli ürün ve fotoğraf yükleyebilirsiniz.";
  }
  yolSyncSellerTypeUi();
  if ($("#yolSellGoDesk")) $("#yolSellGoDesk").hidden = !yolHasDesk();
  if ($("#yolSellerCargo")) $("#yolSellerCargo").value = yolCargoKey(seller.cargo);
  const mine = yolListProducts(store.get(YOL_PRODUCTS, []).filter((p) => yolOwnProduct(seller, p)));
  const box = $("#yolMyProducts");
  if (!box) return;
  box.innerHTML = mine.length
    ? mine.map((item) => yolProductCardHtml(item, true)).join("")
    : "<p class='hint'>Henüz ürün yok. İlk ürününüzü yükleyin.</p>";
}

function yolOwnProduct(seller, item) {
  if (!seller || !item) return false;
  const gsm = yolGsm(seller.phone);
  const email = yolMail(seller.mail);
  return (
    (seller.memberId && item.sellerId === seller.memberId) ||
    (gsm && yolGsm(item.sellerPhone) === gsm) ||
    (email && yolMail(item.sellerMail) === email)
  );
}

function yolIsBireysel() {
  return yolSeller()?.kind === "bireysel";
}

function yolIsTicari() {
  return yolSeller()?.kind === "ticari";
}

function yolHasDesk() {
  return yolIsTicari() || yolIsBireysel();
}

function yolOrdersForProduct(productId) {
  const id = String(productId || "");
  return yolSellerOrders().filter((o) => (o.lines || []).some((l) => String(l.id) === id));
}

function yolInvoiceForOrder(orderId) {
  return yolSellerInvoices().find((inv) => String(inv.orderId) === String(orderId)) || null;
}

function yolOnSellerDesk() {
  const view = document.querySelector(".view.active")?.dataset.view;
  return (view === "sell" || view === "desk") && Boolean(yolSeller());
}

function yolDeskMsg(text) {
  if ($("#yolDeskMsg")) $("#yolDeskMsg").textContent = text || "";
}

function yolSellerOrders() {
  const seller = yolSeller();
  if (!seller) return [];
  const mail = yolMail(seller.mail);
  const gsm = yolGsm(seller.phone);
  return store.get(YOL_ORDERS, []).filter(
    (o) => yolMail(o.sellerMail) === mail || (gsm && yolGsm(o.sellerPhone) === gsm)
  );
}

function yolSellerInvoices() {
  const seller = yolSeller();
  if (!seller) return [];
  const mail = yolMail(seller.mail);
  return store.get(YOL_INVOICES, []).filter((inv) => yolMail(inv.sellerMail) === mail);
}

function yolSellerCoupons() {
  const seller = yolSeller();
  if (!seller) return [];
  const mail = yolMail(seller.mail);
  return yolCoupons().filter((c) => yolMail(c.sellerMail) === mail);
}

function yolSellerProfile() {
  const seller = yolSeller();
  const me = yolMe();
  const partner = seller ? yolPartnerKindFor(seller.phone, seller.mail) : null;
  return {
    title: `${seller?.first || ""} ${seller?.last || ""}`.trim() || "Satıcı",
    mail: seller?.mail || "",
    phone: seller?.phone || "",
    vkn: partner?.vkn || "",
    address: partner?.address || me?.address || "",
  };
}

function yolSellerAddresses() {
  const seller = yolSeller();
  if (!seller) return [];
  const mail = yolMail(seller.mail);
  return store.get(YOL_ADDRESSES, []).filter((a) => yolMail(a.sellerMail) === mail && a.kind !== "return");
}

function yolSellerReturnAddress() {
  const seller = yolSeller();
  if (!seller) return null;
  const mail = yolMail(seller.mail);
  return store.get(YOL_ADDRESSES, []).find((a) => yolMail(a.sellerMail) === mail && a.kind === "return") || null;
}

function yolSaveAccount() {
  const seller = yolSeller();
  const me = yolMe();
  if (!yolHasDesk() || !seller || !me) {
    yolDeskMsg("Hesabı satıcı panelinden güncelleyin.");
    return;
  }
  const first = $("#yolAccFirst")?.value.trim() || "";
  const last = $("#yolAccLast")?.value.trim() || "";
  const phone = yolPhone($("#yolAccPhone")?.value || "");
  const address = $("#yolAccAddress")?.value.trim() || "";
  const cargo = yolCargoKey($("#yolAccCargo")?.value);
  const vkn = String($("#yolAccVkn")?.value || "").replace(/\D/g, "").slice(0, 10);
  const pin = $("#yolAccPin")?.value || "";
  if (!first || !last || yolGsm(phone).length < 10 || address.length < 6) {
    yolDeskMsg("Ad, soyad, telefon ve adres zorunludur.");
    return;
  }
  if (yolIsTicari() && vkn && vkn.length !== 10) {
    yolDeskMsg("VKN 10 haneli olmalı.");
    return;
  }
  if (pin && (pin.length < 4 || pin.length > 12)) {
    yolDeskMsg("Şifre 4-12 karakter olmalı.");
    return;
  }
  store.set(
    YOL_MEMBERS,
    yolMembers().map((m) => (m.id !== me.id ? m : { ...m, first, last, phone, address, pin: pin || m.pin }))
  );
  store.set(
    YOL_PARTNERS,
    store.get(YOL_PARTNERS, []).map((p) => {
      if (yolMail(p.mail) !== yolMail(seller.mail) && yolGsm(p.phone) !== yolGsm(seller.phone)) return p;
      return { ...p, first, last, phone, address, cargo, vkn: yolIsTicari() ? vkn || p.vkn : p.vkn };
    })
  );
  const cur = store.get(YOL_SELLER, null);
  if (cur) store.set(YOL_SELLER, { ...cur, phone, mail: seller.mail, kind: seller.kind });
  if ($("#yolAccPin")) $("#yolAccPin").value = "";
  yolDeskMsg("Hesap kaydedildi.");
  renderYol();
  renderYolDesk();
}

function yolSaveTrack(orderId, wrap) {
  const id = String(orderId || "");
  const orders = store.get(YOL_ORDERS, []);
  const order = orders.find((o) => String(o.id) === id);
  if (!order || !yolSellerOrders().some((o) => String(o.id) === id)) return;
  const no = String(wrap?.querySelector("[data-yol-track-no]")?.value || "").trim().toUpperCase();
  const status = wrap?.querySelector("[data-yol-track-status]")?.value || "hazirlaniyor";
  order.trackNo = no.slice(0, 32);
  order.trackStatus = YOL_TRACK_STATUS[status] ? status : "hazirlaniyor";
  if (!order.cargo) order.cargo = yolCargoKey(yolSeller()?.cargo);
  store.set(YOL_ORDERS, orders);
  yolDeskMsg(order.trackNo ? "Kargo takibi kaydedildi." : "Durum kaydedildi.");
  renderYolDesk();
}

function yolSaveAddress() {
  const seller = yolSeller();
  if (!yolHasDesk() || !seller) {
    yolDeskMsg("Adres satıcı panelinden eklenir.");
    return;
  }
  const title = $("#yolAddrTitle")?.value.trim() || "";
  const city = $("#yolAddrCity")?.value.trim() || "";
  const line = $("#yolAddrLine")?.value.trim() || "";
  const phone = yolPhone($("#yolAddrPhone")?.value || "");
  if (!title || !city || line.length < 6 || yolGsm(phone).length < 10) {
    yolDeskMsg("Adres adı, il, açık adres ve telefon zorunludur.");
    return;
  }
  const list = store.get(YOL_ADDRESSES, []);
  const mine = list.filter((a) => yolMail(a.sellerMail) === yolMail(seller.mail));
  list.unshift({
    id: `addr-${Date.now()}`,
    sellerMail: seller.mail,
    title,
    city,
    line,
    phone,
    kind: "ship",
    primary: mine.filter((a) => a.kind !== "return").length === 0,
  });
  store.set(YOL_ADDRESSES, list.slice(0, 80));
  $("#yolAddrForm")?.reset();
  yolDeskMsg("Kargo adresi kaydedildi.");
  renderYolDesk();
}

function yolSaveReturnAddress() {
  const seller = yolSeller();
  if (!yolHasDesk() || !seller) {
    yolDeskMsg("İade adresi satıcı panelinden kaydedilir.");
    return;
  }
  const title = $("#yolReturnTitle")?.value.trim() || "";
  const city = $("#yolReturnCity")?.value.trim() || "";
  const line = $("#yolReturnLine")?.value.trim() || "";
  const phone = yolPhone($("#yolReturnPhone")?.value || "");
  if (!title || !city || line.length < 6 || yolGsm(phone).length < 10) {
    yolDeskMsg("İade adresi adı, il, açık adres ve telefon zorunludur.");
    return;
  }
  const list = store.get(YOL_ADDRESSES, []);
  const mail = yolMail(seller.mail);
  const existing = list.find((a) => yolMail(a.sellerMail) === mail && a.kind === "return");
  if (existing) {
    existing.title = title;
    existing.city = city;
    existing.line = line;
    existing.phone = phone;
    existing.kind = "return";
  } else {
    list.unshift({
      id: `addr-return-${Date.now()}`,
      sellerMail: seller.mail,
      kind: "return",
      title,
      city,
      line,
      phone,
    });
  }
  store.set(YOL_ADDRESSES, list.slice(0, 80));
  yolDeskMsg("Kargo iade adresi kaydedildi.");
  renderYolDesk();
}

function yolOwnProductsRaw() {
  const seller = yolSeller();
  return store.get(YOL_PRODUCTS, []).filter((p) => yolOwnProduct(seller, p));
}

function yolKdvSplit(gross) {
  const g = Math.round((Number(gross) || 0) * 100) / 100;
  const net = Math.round((g / 1.2) * 100) / 100;
  const vat = Math.round((g - net) * 100) / 100;
  return { gross: g, net, vat };
}

async function yolSha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text || "")));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function yolInvoiceNumber(sellerMail) {
  const year = new Date().getFullYear();
  const n = store.get(YOL_INVOICES, []).filter((inv) => yolMail(inv.sellerMail) === yolMail(sellerMail)).length + 1;
  return `HBT${year}${String(n).padStart(6, "0")}`;
}

let yolDeskTab = "products";

function yolShowDeskTab(tab) {
  yolDeskTab = tab || "products";
  ["products", "reports", "stats", "invoices", "coupons", "campaigns", "account", "track", "addresses"].forEach((id) => {
    const box = $(`#yolDesk${id[0].toUpperCase()}${id.slice(1)}`);
    if (box) box.hidden = id !== yolDeskTab;
  });
  $$("#yolDeskNav [data-yol-desk]").forEach((btn) => {
    const on = btn.dataset.yolDesk === yolDeskTab;
    btn.classList.toggle("gold", on);
    btn.classList.toggle("secondary", !on);
  });
}

function renderYolDesk() {
  const on = document.querySelector(".view.active")?.dataset.view === "desk";
  if (!on) return;
  if (!yolHasDesk()) {
    showView(yolSeller() ? "sell" : "home");
    return;
  }
  const profile = yolSellerProfile();
  const kindLabel = yolIsTicari() ? "Ticari kontrol paneli" : "Bireysel kontrol paneli";
  if ($("#yolDeskTitle")) $("#yolDeskTitle").textContent = kindLabel;
  if ($("#yolDeskHello")) {
    $("#yolDeskHello").textContent = `${profile.title} · ${profile.mail}${profile.vkn ? ` · VKN ${profile.vkn}` : ""}`;
  }
  $$("#yolDeskNav [data-yol-desk='stats']").forEach((btn) => {
    btn.hidden = !yolIsTicari();
  });
  ["account", "track", "addresses"].forEach((id) => {
    $$("#yolDeskNav [data-yol-desk='" + id + "']").forEach((btn) => {
      btn.hidden = !yolHasDesk();
    });
  });
  if (!yolIsTicari() && yolDeskTab === "stats") yolDeskTab = "reports";
  if (!yolHasDesk() && ["account", "track", "addresses"].includes(yolDeskTab)) yolDeskTab = "products";
  yolShowDeskTab(yolDeskTab);
  const mine = yolOwnProductsRaw();
  const invoices = yolSellerInvoices();
  const box = $("#yolDeskProductList");
  if (box) {
    box.innerHTML = mine.length
      ? mine
          .map((item) => {
            const src = yolPhotoSrc(item);
            const soldN = yolOrdersForProduct(item.id).length || yolProductStat(item, "sold");
            return `<article class="holiday-hit">
              <div class="yol-photo-box">${src ? `<img class="gk-photo" src="${src}" alt="" />` : ""}</div>
              <div class="yol-product-body">
                <strong>${escapeHtml(item.name || "Ürün")}</strong>
                <p class="hint">${item.deal ? "Avantajlı · " : ""}${item.type === "series" ? "Seri" : "Tekli"} · ${escapeHtml(yolCargoName(yolProductCargo(item)))} · Satış ${soldN}</p>
                <p class="price">${formatTry(yolProductUnitPrice(item))}</p>
                <div class="row">
                  <button class="secondary" type="button" data-yol-deal="${item.id}">${item.deal ? "Avantajlıyı kaldır" : "Avantajlı ürün yap"}</button>
                  <button class="gold" type="button" data-yol-inv-make="${item.id}">Fatura yükle</button>
                  <button class="secondary" type="button" data-yol-inv-see="${item.id}">Faturalar</button>
                  <button class="danger" type="button" data-yol-del="${item.id}">Ürünü sil</button>
                </div>
              </div>
            </article>`;
          })
          .join("")
      : "<p class='hint'>Henüz ürün yok. Yeni ürün yükleyin.</p>";
  }
  const orders = yolSellerOrders();
  const revenue = orders.reduce((n, o) => n + (Number(o.goods) || 0) - (Number(o.discount) || 0), 0);
  const units = orders.reduce((n, o) => n + (o.lines || []).reduce((s, l) => s + (Number(l.qty) || 1), 0), 0);
  const shipSum = orders.reduce((n, o) => n + (Number(o.ship) || 0), 0);
  const discSum = orders.reduce((n, o) => n + (Number(o.discount) || 0), 0);
  const avg = orders.length ? revenue / orders.length : 0;
  const card = orders.filter((o) => o.method === "card").length;
  const cod = orders.filter((o) => o.method !== "card").length;
  const weekStart = Date.now() - 7 * 86400000;
  const weekOrders = orders.filter((o) => Number(o.at) >= weekStart);
  const weekRev = weekOrders.reduce((n, o) => n + (Number(o.goods) || 0) - (Number(o.discount) || 0), 0);
  if ($("#yolDeskStatCards")) {
    $("#yolDeskStatCards").innerHTML = `
      <article class="card"><h3>Ürün</h3><p class="price">${mine.length}</p></article>
      <article class="card"><h3>Sipariş</h3><p class="price">${orders.length}</p></article>
      <article class="card"><h3>Satılan adet</h3><p class="price">${units}</p></article>
      <article class="card"><h3>Ciro</h3><p class="price">${formatTry(revenue)}</p></article>
      <article class="card"><h3>Ort. sepet</h3><p class="price">${formatTry(avg)}</p></article>
      <article class="card"><h3>Kargo</h3><p class="price">${formatTry(shipSum)}</p></article>
      <article class="card"><h3>İndirim</h3><p class="price">${formatTry(discSum)}</p></article>
      <article class="card"><h3>Fatura</h3><p class="price">${invoices.length}</p></article>`;
  }
  if ($("#yolDeskPayMix")) {
    $("#yolDeskPayMix").innerHTML = orders.length
      ? `<article class="note"><strong>Kapıda ödeme</strong><p class="price">${cod} sipariş</p></article>
         <article class="note"><strong>Kredi kartı</strong><p class="price">${card} sipariş</p></article>`
      : "<p class='hint'>Henüz ödeme verisi yok.</p>";
  }
  if ($("#yolDeskTopProducts")) {
    const soldMap = new Map();
    orders.forEach((o) => {
      (o.lines || []).forEach((l) => {
        const key = l.name || "Ürün";
        const row = soldMap.get(key) || { name: key, qty: 0, sum: 0 };
        row.qty += Number(l.qty) || 1;
        row.sum += Number(l.sum) || 0;
        soldMap.set(key, row);
      });
    });
    mine.forEach((p) => {
      const key = p.name || "Ürün";
      if (soldMap.has(key)) return;
      const qty = yolProductStat(p, "sold");
      if (qty) soldMap.set(key, { name: key, qty, sum: qty * yolProductUnitPrice(p) });
    });
    const top = [...soldMap.values()].sort((a, b) => b.qty - a.qty || b.sum - a.sum).slice(0, 8);
    $("#yolDeskTopProducts").innerHTML = top.length
      ? top
          .map(
            (row) => `<article class="note">
              <header><strong>${escapeHtml(row.name)}</strong><time>${row.qty} adet</time></header>
              <p class="price">${formatTry(row.sum)}</p>
            </article>`
          )
          .join("")
      : "<p class='hint'>Henüz ürün satışı yok.</p>";
  }
  if ($("#yolDeskWeek")) {
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayOrders = orders.filter((o) => o.at >= d.getTime() && o.at < next.getTime());
      const dayRev = dayOrders.reduce((n, o) => n + (Number(o.goods) || 0) - (Number(o.discount) || 0), 0);
      days.push({
        label: d.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "numeric" }),
        n: dayOrders.length,
        rev: dayRev,
      });
    }
    $("#yolDeskWeek").innerHTML = `${days
      .map(
        (day) => `<article class="note">
          <header><strong>${escapeHtml(day.label)}</strong><time>${day.n} sipariş</time></header>
          <p class="price">${formatTry(day.rev)}</p>
        </article>`
      )
      .join("")}
      <article class="note"><strong>7 gün toplam</strong><p class="price">${weekOrders.length} sipariş · ${formatTry(weekRev)}</p></article>`;
  }
  if ($("#yolDeskSales")) {
    $("#yolDeskSales").innerHTML = orders.length
      ? orders
          .map(
            (o) => `<article class="note">
              <header><strong>${escapeHtml(o.buyer?.name || "Alıcı")}</strong><time>${new Date(o.at).toLocaleString("tr-TR")}</time></header>
              <p>${escapeHtml((o.lines || []).map((l) => `${l.name} ×${l.qty}`).join(" · ") || "Sipariş")}</p>
              <p class="hint">${o.buyer?.countryName ? `Kargo talebi: ${yolCountryLabel(o.buyer.country || "TR")}` : ""}</p>
              <p class="price">${o.method === "cod" ? "Kapıda" : "Kart"} · ${formatTry((o.goods || 0) - (o.discount || 0))} + kargo ${formatTry(o.ship || 0)}</p>
              <div class="row">
                <button class="gold" type="button" data-yol-inv-order="${escapeHtml(String(o.id))}">Fatura yükle</button>
                <button class="secondary" type="button" data-yol-inv-order-see="${escapeHtml(String(o.id))}">Faturalar</button>
              </div>
            </article>`
          )
          .join("")
      : "<p class='hint'>Henüz satış yok.</p>";
  }
  const sel = $("#yolInvOrder");
  if (sel) {
    const invoiced = new Set(invoices.map((inv) => String(inv.orderId)));
    const open = orders.filter((o) => !invoiced.has(String(o.id)));
    sel.innerHTML =
      `<option value="">Satış seçin</option>` +
      open
        .map(
          (o) =>
            `<option value="${escapeHtml(String(o.id))}">${escapeHtml(o.buyer?.name || "Alıcı")} · ${formatTry((o.goods || 0) - (o.discount || 0))} · ${new Date(o.at).toLocaleDateString("tr-TR")}</option>`
        )
        .join("");
  }
  if ($("#yolDeskInvoiceList")) {
    $("#yolDeskInvoiceList").innerHTML = invoices.length
      ? invoices
          .map(
            (inv) => `<article class="note">
              <header><strong>${escapeHtml(inv.number)}</strong><time>${inv.mailed ? "Mail gitti" : inv.uploaded ? "Yüklendi" : inv.signed ? "E-imzalı" : "Kayıt"}</time></header>
              <p>${escapeHtml(inv.buyerName || "")} · ${escapeHtml(inv.fileName || "Fatura")} · ${formatTry(inv.gross)}</p>
              <button class="secondary" type="button" data-yol-inv-print="${escapeHtml(inv.id)}">Faturayı aç / yazdır</button>
            </article>`
          )
          .join("")
      : "<p class='hint'>Henüz fatura yok.</p>";
  }
  if ($("#yolDeskCouponList")) {
    const list = yolSellerCoupons();
    $("#yolDeskCouponList").innerHTML = list.length
      ? list
          .map(
            (c) => `<article class="note">
              <header><strong>${escapeHtml(c.code)}</strong><time>%${escapeHtml(String(c.percent))}</time></header>
              <p>Kullanım ${Number(c.uses || 0)}${c.maxUses ? ` / ${c.maxUses}` : ""}</p>
              <button class="danger" type="button" data-yol-coupon-del="${escapeHtml(String(c.id))}">Kodu sil</button>
            </article>`
          )
          .join("")
      : "<p class='hint'>Tanımlı indirim kodu yok.</p>";
  }
  const campBox = $("#yolCampProductBox");
  if (campBox) {
    campBox.innerHTML = mine.length
      ? mine
          .map(
            (p) =>
              `<label class="field"><input type="checkbox" name="yolCampProd" value="${escapeHtml(String(p.id))}" /> ${escapeHtml(p.name || "Ürün")}</label>`
          )
          .join("")
      : "<p class='hint'>Önce ürün yükleyin.</p>";
  }
  if ($("#yolDeskCampaignList")) {
    const camps = yolSellerCampaigns();
    $("#yolDeskCampaignList").innerHTML = camps.length
      ? camps
          .map((c) => {
            const live = yolCampaignLive(c);
            const count = Array.isArray(c.productIds) && c.productIds.length ? c.productIds.length : mine.length;
            return `<article class="note">
              <header><strong>${escapeHtml(c.name)}</strong><time>${live ? "Yayında" : "Pasif"} · %${escapeHtml(String(c.percent))}</time></header>
              <p>${escapeHtml(c.start || "")} – ${escapeHtml(c.end || "")} · ${count} ürün${c.flash ? " · Flaş" : ""}</p>
              <div class="row">
                <button class="secondary" type="button" data-yol-camp-toggle="${escapeHtml(String(c.id))}">${c.active === false ? "Yayınla" : "Durdur"}</button>
                <button class="danger" type="button" data-yol-camp-del="${escapeHtml(String(c.id))}">Kampanyayı sil</button>
              </div>
            </article>`;
          })
          .join("")
      : "<p class='hint'>Henüz kampanya yok.</p>";
  }
  const me = yolMe();
  const seller = yolSeller();
  const partner = seller ? yolPartnerKindFor(seller.phone, seller.mail) : null;
  if ($("#yolAccFirst") && document.activeElement !== $("#yolAccFirst")) $("#yolAccFirst").value = me?.first || seller?.first || "";
  if ($("#yolAccLast") && document.activeElement !== $("#yolAccLast")) $("#yolAccLast").value = me?.last || seller?.last || "";
  if ($("#yolAccMail")) $("#yolAccMail").value = me?.mail || seller?.mail || "";
  if ($("#yolAccPhone") && document.activeElement !== $("#yolAccPhone")) $("#yolAccPhone").value = me?.phone || seller?.phone || "";
  if ($("#yolAccVkn")) {
    $("#yolAccVkn").hidden = !yolIsTicari();
    if (yolIsTicari()) $("#yolAccVkn").value = partner?.vkn || "";
  }
  if ($("#yolAccAddress") && document.activeElement !== $("#yolAccAddress")) $("#yolAccAddress").value = partner?.address || me?.address || "";
  if ($("#yolAccCargo")) $("#yolAccCargo").value = yolCargoKey(partner?.cargo || seller?.cargo);
  if ($("#yolDeskTrackList")) {
    $("#yolDeskTrackList").innerHTML = orders.length
      ? orders
          .map((o) => {
            const cargo = yolCargoKey(o.cargo || partner?.cargo);
            const status = YOL_TRACK_STATUS[o.trackStatus] ? o.trackStatus : "hazirlaniyor";
            const code = String(o.trackNo || "");
            const url = yolCargoTrackUrl(cargo, code);
            return `<article class="note">
              <header><strong>${escapeHtml(o.buyer?.name || "Alıcı")}</strong><time>${yolTrackStatusLabel(status)}</time></header>
              <p>${escapeHtml((o.lines || []).map((l) => `${l.name} ×${l.qty}`).join(" · ") || "Sipariş")} · ${escapeHtml(yolCargoName(cargo))}</p>
              <p class="hint">${escapeHtml(o.buyer?.address || "")}</p>
              <input data-yol-track-no="${escapeHtml(String(o.id))}" placeholder="Takip numarası" value="${escapeHtml(code)}" maxlength="32" />
              <select data-yol-track-status="${escapeHtml(String(o.id))}">
                ${Object.entries(YOL_TRACK_STATUS)
                  .map(([k, lab]) => `<option value="${k}"${k === status ? " selected" : ""}>${lab}</option>`)
                  .join("")}
              </select>
              <div class="row">
                <button class="gold" type="button" data-yol-track-save="${escapeHtml(String(o.id))}">Takibi kaydet</button>
                ${url ? `<a class="secondary" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Kargoyu sorgula</a>` : ""}
              </div>
            </article>`;
          })
          .join("")
      : "<p class='hint'>Henüz kargolanacak satış yok.</p>";
  }
  if ($("#yolDeskAddrList")) {
    const list = yolSellerAddresses();
    $("#yolDeskAddrList").innerHTML = list.length
      ? list
          .map(
            (a) => `<article class="note">
              <header><strong>${escapeHtml(a.title)}</strong><time>${a.primary ? "Varsayılan" : ""}</time></header>
              <p>${escapeHtml(a.city)} · ${escapeHtml(a.line)}</p>
              <p class="hint">${escapeHtml(a.phone || "")}</p>
              <div class="row">
                ${a.primary ? "" : `<button class="secondary" type="button" data-yol-addr-primary="${escapeHtml(String(a.id))}">Varsayılan yap</button>`}
                <button class="danger" type="button" data-yol-addr-del="${escapeHtml(String(a.id))}">Adresi sil</button>
              </div>
            </article>`
          )
          .join("")
      : "<p class='hint'>Kayıtlı kargo adresi yok.</p>";
  }
  if ($("#yolReturnAddrCard")) $("#yolReturnAddrCard").hidden = !yolHasDesk();
  if (yolHasDesk()) {
    const ret = yolSellerReturnAddress();
    if ($("#yolReturnTitle") && document.activeElement !== $("#yolReturnTitle")) $("#yolReturnTitle").value = ret?.title || "";
    if ($("#yolReturnCity") && document.activeElement !== $("#yolReturnCity")) $("#yolReturnCity").value = ret?.city || "";
    if ($("#yolReturnLine") && document.activeElement !== $("#yolReturnLine")) $("#yolReturnLine").value = ret?.line || "";
    if ($("#yolReturnPhone") && document.activeElement !== $("#yolReturnPhone")) $("#yolReturnPhone").value = ret?.phone || "";
  }
}

function yolRecordOrder(pending) {
  if (!pending?.lines?.length) return;
  const groups = new Map();
  pending.lines.forEach((line) => {
    const key = yolMail(line.sellerMail);
    if (!groups.has(key)) {
      groups.set(key, {
        sellerMail: line.sellerMail,
        sellerPhone: line.sellerPhone,
        sellerName: line.sellerName,
        lines: [],
        goods: 0,
      });
    }
    const g = groups.get(key);
    g.lines.push(line);
    g.goods += Number(line.sum) || 0;
  });
  const orders = store.get(YOL_ORDERS, []);
  const discount = Number(pending.discount) || 0;
  const couponMail = yolMail(pending.couponMail);
  groups.forEach((g) => {
    const share = couponMail && yolMail(g.sellerMail) === couponMail ? discount : 0;
    orders.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      at: Date.now(),
      sellerMail: g.sellerMail,
      sellerPhone: g.sellerPhone,
      sellerName: g.sellerName,
      method: pending.method,
      buyer: pending.buyer,
      lines: g.lines,
      goods: g.goods,
      ship: groups.size === 1 ? Number(pending.ship) || 0 : 0,
      discount: share,
      coupon: share ? pending.couponCode : "",
      cargo: yolProductCargo(store.get(YOL_PRODUCTS, []).find((p) => String(p.id) === String(g.lines[0]?.id))),
      trackNo: "",
      trackStatus: "hazirlaniyor",
      total: g.goods - share + (groups.size === 1 ? Number(pending.ship) || 0 : 0),
    });
  });
  store.set(YOL_ORDERS, orders.slice(0, 400));
  if (pending.couponId) {
    const coupons = yolCoupons().map((c) =>
      String(c.id) === String(pending.couponId) ? { ...c, uses: Number(c.uses || 0) + 1 } : c
    );
    store.set(YOL_COUPONS, coupons);
  }
}

function yolInvoiceHtml(inv) {
  const rows = (inv.lines || [])
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.name)}</td><td>${l.qty}</td><td>${formatTry(l.unit)}</td><td>${formatTry(l.sum)}</td></tr>`
    )
    .join("");
  const split = yolKdvSplit(inv.gross);
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${escapeHtml(inv.number)}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#111;margin:24px;max-width:800px}
      h1{font-size:20px;margin:0 0 8px}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:13px}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}
      .sign{margin-top:28px;font-size:12px;word-break:break-all}
      @media print {.noprint{display:none}}
    </style></head><body>
    <p>T.C. · e-Arşiv Fatura</p>
    <h1>FATURA ${escapeHtml(inv.number)}</h1>
    <p>ETT No: ${escapeHtml(inv.ettn)} · Tarih: ${escapeHtml(inv.date)}</p>
    <div class="meta">
      <div><strong>Satıcı</strong><br>${escapeHtml(inv.sellerTitle)}<br>VKN: ${escapeHtml(inv.sellerVkn || "—")}<br>${escapeHtml(inv.sellerAddress || "")}<br>${escapeHtml(inv.sellerMail || "")}</div>
      <div><strong>Alıcı</strong><br>${escapeHtml(inv.buyerName)}<br>VKN/TCKN: ${escapeHtml(inv.buyerTax || "—")}<br>${escapeHtml(inv.buyerAddress || "")}<br>${escapeHtml(inv.buyerMail || "")}</div>
    </div>
    <table><thead><tr><th>Ürün / Hizmet</th><th>Adet</th><th>Birim</th><th>Tutar</th></tr></thead><tbody>${rows}</tbody></table>
    <p>Ara toplam (KDV hariç): ${formatTry(split.net)}<br>KDV %20: ${formatTry(split.vat)}<br><strong>Genel toplam: ${formatTry(split.gross)}</strong></p>
    <p>Düzenleme: ${inv.signed ? "e-İmza ile otomatik resmi fatura" : "Manuel fatura"}</p>
    <div class="sign">${inv.signed ? `e-İmza özeti (SHA-256): ${escapeHtml(inv.signHash)}` : "Manuel düzenleme — satıcı kaşesi / imzası"}</div>
    <p class="noprint"><button onclick="window.print()">Yazdır</button></p>
    </body></html>`;
}

function yolOpenInvoice(inv) {
  if (inv?.fileDataUrl) {
    window.open(inv.fileDataUrl, "_blank");
    return;
  }
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(yolInvoiceHtml(inv));
  win.document.close();
}

let yolInvPickOrder = "";

function yolAskInvoiceFile(orderId) {
  yolInvPickOrder = orderId || $("#yolInvOrder")?.value || "";
  if (!yolInvPickOrder) {
    yolDeskMsg("Önce bir satış seçin, sonra faturayı yükleyin.");
    return;
  }
  if ($("#yolInvOrder")) $("#yolInvOrder").value = yolInvPickOrder;
  const input = $("#yolInvFile");
  if (!input) return;
  input.value = "";
  input.click();
}

async function yolUploadInvoice(orderId, file) {
  const seller = yolSeller();
  if (!yolHasDesk() || !seller) {
    yolDeskMsg("Fatura yüklemek için satıcı paneline girin.");
    return;
  }
  const pick = orderId || yolInvPickOrder || $("#yolInvOrder")?.value || "";
  const order = yolSellerOrders().find((o) => String(o.id) === String(pick));
  if (!order) {
    yolDeskMsg("Fatura yüklemek için bir satış seçin.");
    return;
  }
  const mail = String(order.buyer?.email || "").trim();
  if (!mail || !mail.includes("@")) {
    yolDeskMsg("Bu satışta müşteri e-postası yok. Fatura gönderilemez.");
    return;
  }
  if (!file) {
    yolDeskMsg("PDF veya görsel fatura seçin.");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    yolDeskMsg("Fatura en fazla 5 MB olabilir.");
    return;
  }
  yolDeskMsg("Fatura yükleniyor ve müşteriye gönderiliyor…");
  let doc;
  try {
    const dataUrl = await dataUrlFromBlob(file);
    doc = { name: file.name, type: file.type || "application/pdf", dataUrl };
  } catch {
    yolDeskMsg("Fatura okunamadı.");
    return;
  }
  const profile = yolSellerProfile();
  const gross = Math.max(0, (Number(order.goods) || 0) - (Number(order.discount) || 0));
  const number = yolInvoiceNumber(seller.mail);
  let mailed = false;
  try {
    const res = await fetch("/yol-invoice-mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: mail,
        buyer: order.buyer?.name || "Müşteri",
        seller: profile.title,
        number,
        orderNo: number,
        filename: doc.name,
        content: doc.dataUrl,
      }),
    });
    const data = await res.json().catch(() => ({}));
    mailed = Boolean(data.ok);
    if (data.skipped || res.status === 404 || res.status === 501) {
      yolDeskMsg("Fatura kaydedildi. Canlı sitede müşteriye mail gider.");
    } else if (!data.ok) {
      yolDeskMsg(data.error || "Mail gönderilemedi. Fatura yine de kaydedildi.");
    }
  } catch {
    yolDeskMsg("Fatura kaydedildi. Canlı sitede müşteriye mail gider.");
  }
  const inv = {
    id: `inv-${Date.now()}`,
    orderId: order.id,
    number,
    date: new Date().toLocaleString("tr-TR"),
    sellerMail: seller.mail,
    sellerTitle: profile.title,
    buyerName: order.buyer?.name || "",
    buyerMail: mail,
    buyerAddress: order.buyer?.address || "",
    buyerTax: $("#yolInvTax")?.value.trim() || "",
    lines: order.lines || [],
    gross,
    uploaded: true,
    mailed,
    fileName: doc.name,
    fileType: doc.type,
    fileDataUrl: doc.dataUrl,
  };
  if ((doc.dataUrl || "").length > 1400000) delete inv.fileDataUrl;
  const list = store.get(YOL_INVOICES, []);
  list.unshift(inv);
  try {
    store.set(YOL_INVOICES, list.slice(0, 40));
  } catch {
    delete inv.fileDataUrl;
    store.set(YOL_INVOICES, list.slice(0, 20));
  }
  yolInvPickOrder = "";
  if ($("#yolInvFile")) $("#yolInvFile").value = "";
  if (mailed) yolDeskMsg(`Fatura yüklendi ve ${mail} adresine gönderildi.`);
  renderYolDesk();
}

function yolInvoiceFromProduct(productId) {
  const sales = yolOrdersForProduct(productId);
  if (!sales.length) {
    yolDeskMsg("Bu ürün için henüz satış yok.");
    return;
  }
  yolShowDeskTab("invoices");
  const open = sales.find((o) => !yolInvoiceForOrder(o.id)) || sales[0];
  if ($("#yolInvOrder")) $("#yolInvOrder").value = String(open.id);
  yolAskInvoiceFile(open.id);
}

function yolShowInvoicesForProduct(productId) {
  yolShowDeskTab("invoices");
  const sales = yolOrdersForProduct(productId);
  const ids = new Set(sales.map((o) => String(o.id)));
  const mine = yolSellerInvoices().filter((inv) => ids.has(String(inv.orderId)));
  yolDeskMsg(mine.length ? `${mine.length} fatura bulundu.` : "Bu ürün için fatura yok. Fatura yükle ile ekleyin.");
  renderYolDesk();
}

function yolToggleDeal(id) {
  const seller = yolSeller();
  const catalog = store.get(YOL_PRODUCTS, []);
  const item = catalog.find((p) => String(p.id) === String(id));
  if (!item || !yolOwnProduct(seller, item)) return;
  item.deal = !item.deal;
  store.set(YOL_PRODUCTS, catalog);
  renderYolDesk();
  renderYolSeller();
  renderYolMarket();
  yolDeskMsg(item.deal ? "Ürün avantajlı olarak işaretlendi." : "Avantajlı işareti kaldırıldı.");
}

function yolSyncSearch() {
  const search = document.querySelector(".yol-search");
  if (!search) return;
  const view = document.querySelector(".view.active")?.dataset.view || "home";
  const authOpen = Boolean($("#yolAuthPanel") && !$("#yolAuthPanel").hidden);
  const partnerOpen = Boolean($("#yolPartnerPanel") && !$("#yolPartnerPanel").hidden);
  const onHome = view === "home" && !authOpen && !partnerOpen;
  const onSellerSell = view === "sell" && (yolIsBireysel() || yolIsTicari());
  const show = onHome || onSellerSell;
  search.hidden = !show;
  if (!show) {
    const box = $("#yolSearchResults");
    if (box) {
      box.hidden = true;
      box.innerHTML = "";
    }
  }
}

function yolShowPartner(open) {
  if ($("#yolPartnerPanel")) $("#yolPartnerPanel").hidden = !open;
  if (open && $("#yolAuthPanel")) $("#yolAuthPanel").hidden = true;
  const tiles = document.querySelector(".owner-app-row");
  if (tiles) tiles.hidden = Boolean(open);
  yolSyncSearch();
  renderYolMarket();
}

function yolOpenPartner() {
  showView("home");
  yolShowPartner(true);
  $("#yolPartnerPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function yolGsm(value) {
  let d = String(value || "").replace(/\D/g, "");
  if (d.startsWith("90") && d.length >= 12) d = d.slice(2);
  if (d.startsWith("0") && d.length >= 11) d = d.slice(1);
  return d;
}

function yolFindMember(phone, mail) {
  const gsm = yolGsm(phone);
  const email = yolMail(mail);
  return yolMembers().find((m) => (gsm && yolGsm(m.phone) === gsm) || (email && yolMail(m.mail) === email)) || null;
}

function yolRememberLast(memberOrLast) {
  if (!memberOrLast) return;
  store.set(YOL_LAST, {
    phone: yolGsm(memberOrLast.phone),
    mail: yolMail(memberOrLast.mail),
  });
}

function yolLastMember() {
  const last = store.get(YOL_LAST, null);
  if (!last) return null;
  return yolFindMember(last.phone, last.mail);
}

function yolFillLogin(user, message) {
  if ($("#yolLoginUser") && user) $("#yolLoginUser").value = user;
  if ($("#yolLoginPin")) $("#yolLoginPin").value = "";
  if ($("#yolLoginMsg") && message) $("#yolLoginMsg").textContent = message;
}

function yolShowAuth(mode) {
  const me = yolMe();
  if (me) {
    if ($("#yolAuthPanel")) $("#yolAuthPanel").hidden = true;
    yolShowPartner(false);
    yolSyncSearch();
    renderYolMarket();
    return;
  }
  const loginOnly = mode === "login" || (mode !== "register" && Boolean(yolLastMember()));
  if ($("#yolAuthPanel")) $("#yolAuthPanel").hidden = false;
  if ($("#yolLoginCard")) $("#yolLoginCard").hidden = !loginOnly;
  if ($("#yolRegisterCard")) $("#yolRegisterCard").hidden = loginOnly;
  if ($("#yolRegister")) $("#yolRegister").hidden = false;
  if ($("#yolOtp")) $("#yolOtp").hidden = true;
  if ($("#yolShowRegister")) $("#yolShowRegister").hidden = Boolean(yolLastMember());
  if (loginOnly) {
    const last = store.get(YOL_LAST, null);
    const known = yolLastMember();
    yolFillLogin(last?.mail || known?.mail || "", "");
  }
  yolShowPartner(false);
  yolSyncSearch();
  renderYolMarket();
}

function yolOpenAuth(mode) {
  showView("home");
  yolShowAuth(mode || "login");
  const target = $("#yolLoginCard")?.hidden === false ? $("#yolLoginCard") : $("#yolRegisterCard");
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function yolSyncNav() {
  const me = yolMe();
  const role = yolRole(me);
  const logged = Boolean(me);
  const seller = Boolean(yolSeller());
  if ($("#yolLogoutTop")) $("#yolLogoutTop").hidden = !logged;
  if ($("#yolNavRegister")) $("#yolNavRegister").hidden = logged;
  if ($("#yolNavPartner")) $("#yolNavPartner").hidden = seller;
  if ($("#yolNavSell")) $("#yolNavSell").hidden = role !== "satici";
  if ($("#yolNavDesk")) $("#yolNavDesk").hidden = true;
  if (seller) yolShowPartner(false);
  document.body.classList.toggle("yol-seller-account", seller);
  const view = document.querySelector(".view.active")?.dataset.view || "";
  const deskPanel = yolHasDesk() && (view === "desk" || view === "sell");
  document.body.classList.toggle("yol-bireysel-panel", deskPanel);
  document.body.classList.toggle("yol-desk-panel", deskPanel);
  if (deskPanel) {
    const cart = $("#yolCartPanel");
    if (cart) cart.hidden = true;
  }
  $$(".home-back").forEach((btn) => {
    btn.hidden = seller;
  });
}

function renderYol() {
  yolEnsureDemos();
  yolFillBrandUi();
  const me = yolMe();
  if (me) yolRememberLast(me);
  yolSyncNav();
  yolSyncCountryUi();
  yolRenderCart();
  if (me) {
    yolShowAuth();
    renderYolSeller();
    renderYolMarket();
    return;
  }
  if ($("#yolAuthPanel")) $("#yolAuthPanel").hidden = true;
  yolShowPartner(false);
  renderYolSeller();
  renderYolMarket();
  yolSyncSearch();
}
$("#yolNavRegister")?.addEventListener("click", () => yolOpenAuth());
$("#yolNavPartner")?.addEventListener("click", () => yolOpenPartner());
$("#yolNavCart")?.addEventListener("click", () => {
  const panel = $("#yolCartPanel");
  if (!panel) return;
  panel.hidden = !panel.hidden;
  if (!panel.hidden) {
    yolRenderCart();
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
$("#yolCheckout")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const method = yolPayMethod();
  const goods = yolCartTotal();
  const ship = yolShippingFee();
  const disc = yolCartDiscount($("#yolPayCoupon")?.value);
  const payGoods = Math.max(0, goods - disc.amount);
  const amount = method === "card" ? payGoods + ship : ship;
  if (!(amount >= 0.5)) {
    yolPayMsg("Ödenecek kargo ücreti yok (en az 0,50 ₺).");
    return;
  }
  const name = $("#yolPayName")?.value.trim() || "";
  const email = $("#yolPayMail")?.value.trim() || "";
  const phone = $("#yolPayPhone")?.value.trim() || "";
  const address = $("#yolPayAddress")?.value.trim() || "";
  if (!name || !email || !phone || !address) {
    yolPayMsg("Ad soyad, e-posta, telefon ve adres zorunludur.");
    return;
  }
  const dest = yolCountryByCode(yolShopCountryCode());
  yolPayMsg(method === "cod" ? "Kargo ücreti için kart sayfası açılıyor…" : "Güvenli kart sayfası açılıyor…");
  const btn = $("#yolPaySubmit");
  if (btn) btn.disabled = true;
  try {
    const res = await fetch("/pos-pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        note: method === "cod" ? "Harbi kargo ücreti" : "Harbi sepet",
        name,
        email,
        phone,
        address,
      }),
    });
    const data = await res.json();
    if (!data.ok || !data.paymentPageUrl) {
      yolPayMsg(data.error || "Kart ödeme sayfası açılamadı. Canlı sitede iyzico anahtarları gerekir.");
      if (btn) btn.disabled = false;
      return;
    }
    store.set(YOL_PAY_PENDING, {
      amount,
      method,
      ship,
      goods,
      discount: disc.amount,
      couponId: disc.coupon?.id || "",
      couponCode: disc.coupon?.code || "",
      couponMail: disc.coupon?.sellerMail || "",
      buyer: { name, email, phone, address, country: dest.c, countryName: dest.n },
      lines: yolCartLines().map((line) => ({
        id: line.product.id,
        name: line.product.name,
        qty: line.qty,
        unit: line.unit,
        sum: line.sum,
        sellerMail: line.product.sellerMail,
        sellerPhone: line.product.sellerPhone,
        sellerName: line.product.sellerName,
      })),
      at: Date.now(),
    });
    location.href = data.paymentPageUrl;
  } catch {
    yolPayMsg("Ödeme bağlantısı kurulamadı. Canlı sitede deneyin.");
    if (btn) btn.disabled = false;
  }
});
document.querySelectorAll('input[name="yolPayMethod"]').forEach((el) => {
  el.addEventListener("change", yolSyncPayButton);
});
document.addEventListener("click", (event) => {
  const add = event.target.closest("[data-yol-cart]");
  if (add) {
    event.preventDefault();
    yolCartAdd(add.dataset.yolCart);
    return;
  }
  const del = event.target.closest("[data-yol-cart-del]");
  if (del) {
    event.preventDefault();
    yolCartRemove(del.dataset.yolCartDel);
  }
});
let yolAfterLogin = "";
function yolOpenSell() {
  yolShowPartner(false);
  if ($("#yolAuthPanel")) $("#yolAuthPanel").hidden = true;
  const seller = yolSeller();
  if (!seller) {
    yolAfterLogin = "sell";
    if (yolMe()) yolOpenPartner();
    else yolOpenAuth("login");
    return;
  }
  yolAfterLogin = "";
  showView("sell");
}
$("#yolNavSell")?.addEventListener("click", () => yolOpenSell());
$("#yolSellGoDesk")?.addEventListener("click", () => {
  if (yolHasDesk()) showView("desk");
});
$("#yolDeskGoSell")?.addEventListener("click", () => yolOpenSell());
$("#yolDeskNav")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-yol-desk]");
  if (!btn) return;
  yolShowDeskTab(btn.dataset.yolDesk);
});
$("#yolAccForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  yolSaveAccount();
});
$("#yolAddrForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  yolSaveAddress();
});
$("#yolReturnForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  yolSaveReturnAddress();
});
$("#yolDeskTrackList")?.addEventListener("click", (event) => {
  const save = event.target.closest("[data-yol-track-save]");
  if (save) yolSaveTrack(save.dataset.yolTrackSave, save.closest("article"));
});
$("#yolDeskAddrList")?.addEventListener("click", (event) => {
  const seller = yolSeller();
  if (!seller) return;
  const primary = event.target.closest("[data-yol-addr-primary]");
  const del = event.target.closest("[data-yol-addr-del]");
  if (!primary && !del) return;
  let list = store.get(YOL_ADDRESSES, []);
  if (primary) {
    list = list.map((a) => {
      if (yolMail(a.sellerMail) !== yolMail(seller.mail) || a.kind === "return") return a;
      return { ...a, primary: String(a.id) === String(primary.dataset.yolAddrPrimary) };
    });
    yolDeskMsg("Varsayılan kargo adresi güncellendi.");
  }
  if (del) {
    list = list.filter((a) => String(a.id) !== String(del.dataset.yolAddrDel));
    yolDeskMsg("Adres silindi.");
  }
  store.set(YOL_ADDRESSES, list);
  renderYolDesk();
});
$("#yolDeskProductList")?.addEventListener("click", (event) => {
  const deal = event.target.closest("[data-yol-deal]");
  if (deal) yolToggleDeal(deal.dataset.yolDeal);
  const make = event.target.closest("[data-yol-inv-make]");
  if (make) yolInvoiceFromProduct(make.dataset.yolInvMake);
  const see = event.target.closest("[data-yol-inv-see]");
  if (see) yolShowInvoicesForProduct(see.dataset.yolInvSee);
});
$("#yolDeskSales")?.addEventListener("click", (event) => {
  const make = event.target.closest("[data-yol-inv-order]");
  if (make) yolAskInvoiceFile(make.dataset.yolInvOrder);
  const see = event.target.closest("[data-yol-inv-order-see]");
  if (see) {
    const inv = yolInvoiceForOrder(see.dataset.yolInvOrderSee);
    if (inv) {
      yolShowDeskTab("invoices");
      renderYolDesk();
      yolOpenInvoice(inv);
    } else {
      yolDeskMsg("Bu satış için henüz fatura yok. Fatura yükle ile ekleyin.");
    }
  }
});
$("#yolInvUpload")?.addEventListener("click", () => yolAskInvoiceFile($("#yolInvOrder")?.value));
$("#yolInvFile")?.addEventListener("change", () => {
  const file = $("#yolInvFile")?.files?.[0];
  if (file) yolUploadInvoice(yolInvPickOrder || $("#yolInvOrder")?.value, file);
});
$("#yolDeskInvoiceList")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-yol-inv-print]");
  if (!btn) return;
  const inv = store.get(YOL_INVOICES, []).find((row) => String(row.id) === String(btn.dataset.yolInvPrint));
  if (inv) yolOpenInvoice(inv);
});
$("#yolCouponForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const seller = yolSeller();
  if (!yolHasDesk() || !seller) {
    yolDeskMsg("İndirim kodu satıcı panelinde tanımlanır.");
    return;
  }
  const code = String($("#yolCouponCode")?.value || "").trim().toLocaleUpperCase("tr-TR");
  const percent = Math.min(90, Math.max(1, Number($("#yolCouponPercent")?.value) || 0));
  const maxRaw = $("#yolCouponMax")?.value.trim() || "";
  const maxUses = maxRaw ? Math.max(1, Number(maxRaw) || 0) : 0;
  if (!/^[A-Z0-9]{3,16}$/.test(code) || !percent) {
    yolDeskMsg("Kod 3-16 harf/rakam, indirim 1-90 olmalı.");
    return;
  }
  if (yolCoupons().some((c) => String(c.code).toLocaleUpperCase("tr-TR") === code)) {
    yolDeskMsg("Bu kod zaten var.");
    return;
  }
  const list = yolCoupons();
  list.unshift({
    id: `c-${Date.now()}`,
    sellerMail: seller.mail,
    code,
    percent,
    uses: 0,
    maxUses,
    createdAt: Date.now(),
  });
  store.set(YOL_COUPONS, list.slice(0, 200));
  $("#yolCouponForm")?.reset();
  yolDeskMsg("İndirim kodu kaydedildi.");
  renderYolDesk();
});
$("#yolCampaignForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const seller = yolSeller();
  if (!yolHasDesk() || !seller) {
    yolDeskMsg("Kampanya satıcı panelinde oluşturulur.");
    return;
  }
  const name = $("#yolCampName")?.value.trim() || "";
  const percent = Math.min(90, Math.max(1, Number($("#yolCampPercent")?.value) || 0));
  const start = $("#yolCampStart")?.value || "";
  const end = $("#yolCampEnd")?.value || "";
  if (!name || !percent || !start || !end) {
    yolDeskMsg("Kampanya adı, indirim ve tarih aralığı zorunludur.");
    return;
  }
  if (new Date(end) < new Date(start)) {
    yolDeskMsg("Bitiş tarihi başlangıçtan önce olamaz.");
    return;
  }
  const productIds = $$('#yolCampProductBox input[name="yolCampProd"]:checked').map((el) => el.value);
  const list = yolCampaigns();
  list.unshift({
    id: `camp-${Date.now()}`,
    sellerMail: seller.mail,
    name,
    percent,
    start,
    end,
    flash: Boolean($("#yolCampFlash")?.checked),
    productIds,
    active: true,
    createdAt: Date.now(),
  });
  store.set(YOL_CAMPAIGNS, list.slice(0, 200));
  $("#yolCampaignForm")?.reset();
  yolDeskMsg("Kampanya yayınlandı. İndirim seçilen ürünlere uygulanır.");
  renderYolDesk();
  renderYolMarket();
});
$("#yolDeskCampaignList")?.addEventListener("click", (event) => {
  const del = event.target.closest("[data-yol-camp-del]");
  const tog = event.target.closest("[data-yol-camp-toggle]");
  const seller = yolSeller();
  const mail = yolMail(seller?.mail);
  if (del) {
    store.set(
      YOL_CAMPAIGNS,
      yolCampaigns().filter((c) => !(String(c.id) === String(del.dataset.yolCampDel) && yolMail(c.sellerMail) === mail))
    );
    yolDeskMsg("Kampanya silindi.");
    renderYolDesk();
    renderYolMarket();
    return;
  }
  if (!tog) return;
  const next = yolCampaigns().map((c) => {
    if (String(c.id) !== String(tog.dataset.yolCampToggle) || yolMail(c.sellerMail) !== mail) return c;
    return { ...c, active: c.active === false };
  });
  store.set(YOL_CAMPAIGNS, next);
  renderYolDesk();
  renderYolMarket();
});
$("#yolDeskCouponList")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-yol-coupon-del]");
  if (!btn) return;
  const seller = yolSeller();
  store.set(
    YOL_COUPONS,
    yolCoupons().filter((c) => String(c.id) !== String(btn.dataset.yolCouponDel) || yolMail(c.sellerMail) !== yolMail(seller?.mail))
  );
  renderYolDesk();
});
$("#yolPayCoupon")?.addEventListener("input", yolSyncPayButton);
$("#yolSellGoAuth")?.addEventListener("click", () => {
  yolAfterLogin = "sell";
  yolOpenAuth("login");
  yolFillLogin("", "Ürün yüklemek için mail adresi ve şifre ile giriş yapın.");
});
$("#yolDemoTicari")?.addEventListener("click", () => yolEnterDemo("ticari"));
$("#yolDemoBireysel")?.addEventListener("click", () => yolEnterDemo("bireysel"));

function yolDoLogout() {
  store.set(YOL_SESSION, null);
  yolAfterLogin = "";
  renderYol();
  showView("home");
}

$("#yolLogoutTop")?.addEventListener("click", yolDoLogout);

let yolPending = null;

async function yolOtpRequest(phone) {
  const res = await fetch("/phone-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "send", phone }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok || !data.ok) throw new Error(data.error || "Kod gönderilemedi.");
  return data;
}

async function yolOtpCheck(phone, code) {
  const res = await fetch("/phone-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "check", phone, code }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok || !data.ok) throw new Error(data.error || "Kod doğrulanamadı.");
  return data;
}

function yolFinishRegister(pending) {
  const members = yolMembers();
  const existing = yolFindMember(pending.phone, pending.mail);
  if (existing) {
    yolRememberLast(existing);
    yolPending = null;
    $("#yolRegister")?.reset();
    if ($("#yolOtp")) $("#yolOtp").reset();
    yolShowAuth("login");
    yolFillLogin(existing.mail || existing.phone, "Bu telefon veya mail ile üyelik var. Giriş yapın.");
    $("#yolLoginCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const member = {
    id: Date.now(),
    role: "musteri",
    first: pending.first,
    last: pending.last,
    phone: pending.phone,
    mail: pending.mail,
    address: pending.address,
    pin: pending.pin,
    phoneOk: true,
  };
  members.unshift(member);
  store.set(YOL_MEMBERS, members);
  yolRememberLast(member);
  yolPending = null;
  $("#yolRegister")?.reset();
  if ($("#yolOtp")) $("#yolOtp").reset();
  yolShowAuth("login");
  yolFillLogin(member.mail || member.phone, "Kayıt tamam. Numara onaylandı. Giriş yapın.");
  $("#yolLoginCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#yolLoginPin")?.focus();
}

function yolShowOtp(data) {
  if ($("#yolRegister")) $("#yolRegister").hidden = true;
  if ($("#yolOtp")) $("#yolOtp").hidden = false;
  const hint = $("#yolOtpHint");
  const gsm = yolPending?.phone || "";
  const masked = gsm.length >= 7 ? gsm.slice(0, 3) + "****" + gsm.slice(-3) : gsm;
  if (hint) {
    hint.textContent = data?.devCode
      ? `Yerel deneme kodu: ${data.devCode}. Numara ${masked}.`
      : `${masked} numarasına kod gönderildi. Kodu yazın, doğruysa numara onaylanır.`;
  }
  if ($("#yolOtpCode")) $("#yolOtpCode").value = "";
  if ($("#yolOtpMsg")) $("#yolOtpMsg").textContent = "";
  $("#yolOtpCode")?.focus();
}

$("#yolRegister")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const first = $("#yolRegFirst").value.trim();
  const last = $("#yolRegLast").value.trim();
  const phone = yolGsm($("#yolRegPhone").value);
  const mail = yolMail($("#yolRegMail").value);
  const address = $("#yolRegAddress").value.trim();
  const pin = $("#yolRegPin").value;
  const msg = $("#yolRegMsg");
  if (!first || !last || !phone || !mail || !address || !pin) {
    if (msg) msg.textContent = "İsim, soy isim, telefon, mail ve adres zorunludur.";
    return;
  }
  if (!/^5\d{9}$/.test(phone)) {
    if (msg) msg.textContent = "Geçerli bir cep telefonu yazın.";
    return;
  }
  const byPhone = yolMembers().find((m) => yolGsm(m.phone) === phone);
  const byMail = yolMembers().find((m) => yolMail(m.mail) === mail);
  if (byPhone || byMail) {
    const known = byPhone || byMail;
    yolRememberLast(known);
    yolShowAuth("login");
    yolFillLogin(
      byMail ? mail : phone,
      byPhone && byMail && byPhone.id !== byMail.id
        ? "Bu telefon ve mail ayrı üyeliklerde kayıtlı. Giriş yapın."
        : "Bu telefon veya mail ile üyelik var. Giriş yapın."
    );
    $("#yolLoginCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  yolPending = { first, last, phone, mail, address, pin };
  if (msg) msg.textContent = "Kod gönderiliyor…";
  try {
    const data = await yolOtpRequest(phone);
    if (msg) msg.textContent = "";
    yolShowOtp(data);
  } catch (error) {
    yolPending = null;
    if (msg) msg.textContent = error.message || "Kod gönderilemedi.";
  }
});

$("#yolOtp")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const msg = $("#yolOtpMsg");
  if (!yolPending) {
    if (msg) msg.textContent = "Önce kayıt bilgilerini girin.";
    return;
  }
  const code = String($("#yolOtpCode")?.value || "").replace(/\D/g, "");
  if (msg) msg.textContent = "Kod kontrol ediliyor…";
  try {
    await yolOtpCheck(yolPending.phone, code);
    if (msg) msg.textContent = "Numara onaylandı.";
    yolFinishRegister(yolPending);
  } catch (error) {
    if (msg) msg.textContent = error.message || "Kod hatalı.";
  }
});

$("#yolOtpResend")?.addEventListener("click", async () => {
  const msg = $("#yolOtpMsg");
  if (!yolPending) return;
  if (msg) msg.textContent = "Kod gönderiliyor…";
  try {
    const data = await yolOtpRequest(yolPending.phone);
    yolShowOtp(data);
    if (msg) msg.textContent = "Yeni kod gönderildi.";
  } catch (error) {
    if (msg) msg.textContent = error.message || "Kod gönderilemedi.";
  }
});

$("#yolOtpBack")?.addEventListener("click", () => {
  yolPending = null;
  if ($("#yolOtp")) $("#yolOtp").hidden = true;
  if ($("#yolRegister")) $("#yolRegister").hidden = false;
  if ($("#yolRegMsg")) $("#yolRegMsg").textContent = "";
});

$("#yolShowLogin")?.addEventListener("click", () => {
  yolShowAuth("login");
  $("#yolLoginCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
$("#yolShowRegister")?.addEventListener("click", () => {
  yolShowAuth("register");
  $("#yolRegisterCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#yolLoginShowPin")?.addEventListener("click", () => {
  const pin = $("#yolLoginPin");
  const btn = $("#yolLoginShowPin");
  if (!pin || !btn) return;
  const show = pin.type === "password";
  pin.type = show ? "text" : "password";
  btn.textContent = show ? "Şifreyi gizle" : "Şifreyi göster";
  btn.setAttribute("aria-pressed", String(show));
});

$("#yolLogin")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const mail = yolMail($("#yolLoginUser").value);
  const pin = $("#yolLoginPin").value;
  const msg = $("#yolLoginMsg");
  if (!mail || !mail.includes("@")) {
    if (msg) msg.textContent = "Mail adresi yazın.";
    return;
  }
  const member = yolMembers().find((m) => yolMail(m.mail) === mail && m.pin === pin);
  if (!member) {
    if (msg) msg.textContent = "Mail veya şifre hatalı.";
    return;
  }
  const role = yolRole(member);
  yolRememberLast(member);
  store.set(YOL_SESSION, member.id);
  if (msg) msg.textContent = "";
  $("#yolLogin").reset();
  const next = yolAfterLogin;
  yolAfterLogin = "";
  renderYol();
  if (yolHasDesk()) showView("desk");
  else if (role === "satici" || next === "sell") showView("sell");
  else showView("home");
});

async function yolPartnerSubmit(kind, ids) {
  const first = $(ids.first).value.trim();
  const last = $(ids.last).value.trim();
  const phone = yolPhone($(ids.phone).value);
  const mail = yolMail($(ids.mail).value);
  const address = $(ids.address).value.trim();
  const tc = ids.tc ? String($(ids.tc).value || "").replace(/\D/g, "") : "";
  const vkn = ids.vkn ? String($(ids.vkn).value || "").replace(/\D/g, "") : "";
  const pin = ids.pin ? $(ids.pin).value : "";
  const cargoPick = $(ids.cargo)?.value || "";
  const msg = $(ids.msg);
  if (!first || !last || !phone || !mail || !address) {
    if (msg) msg.textContent = "İsim, soy isim, telefon, mail ve adres zorunludur.";
    return;
  }
  if (!YOL_CARGO[cargoPick]) {
    if (msg) msg.textContent = "Kargo seçin.";
    return;
  }
  if (!pin || pin.length < 4) {
    if (msg) msg.textContent = "En az 4 haneli şifre yazın.";
    return;
  }
  let imza = null;
  let ikamet = null;
  let vergiLevha = null;
  if (kind === "ticari") {
    if (!/^\d{10}$/.test(vkn)) {
      if (msg) msg.textContent = "Vergi kimlik no 10 haneli olmalıdır.";
      return;
    }
    try {
      [imza, ikamet, vergiLevha] = await Promise.all([
        posReadDoc($(ids.imza)),
        posReadDoc($(ids.ikamet)),
        posReadDoc($(ids.vergiLevha)),
      ]);
    } catch (error) {
      if (msg) msg.textContent = error.message || "İmza sirküsü, ikametgah belgesi ve vergi levhası yükleyin.";
      return;
    }
  }
  const partners = store.get(YOL_PARTNERS, []);
  partners.unshift({
    id: Date.now(),
    kind,
    first,
    last,
    tc: tc || null,
    vkn: vkn || null,
    phone,
    mail,
    address,
    imza: imza ? { name: imza.name, type: imza.type } : null,
    ikamet: ikamet ? { name: ikamet.name, type: ikamet.type } : null,
    vergiLevha: vergiLevha ? { name: vergiLevha.name, type: vergiLevha.type } : null,
    cargo: yolCargoKey(cargoPick),
  });
  store.set(YOL_PARTNERS, partners.slice(0, 80));
  let members = yolMembers();
  let member = yolFindMember(phone, mail);
  if (!member) {
    member = {
      id: Date.now() + 1,
      role: "satici",
      first,
      last,
      phone: yolGsm(phone),
      mail,
      address,
      pin,
      phoneOk: true,
    };
    members.unshift(member);
  } else {
    member.role = "satici";
    member.pin = pin;
  }
  store.set(YOL_MEMBERS, members);
  store.set(YOL_SELLER, { id: partners[0].id, kind, phone, mail });
  yolRememberLast(member);
  if (msg) {
    msg.textContent = "Üyelik alındı. Mail ve şifre ile giriş yapın.";
  }
  $(ids.form).reset();
  yolShowAuth("login");
  yolFillLogin(mail, "Üyelik tamam. Mail ve şifre ile giriş yapın.");
  $("#yolLoginCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  renderYolSeller();
  renderYolMarket();
}

$("#yolTicari")?.addEventListener("submit", (event) => {
  event.preventDefault();
  yolPartnerSubmit("ticari", {
    form: "#yolTicari",
    first: "#yolTicariFirst",
    last: "#yolTicariLast",
    phone: "#yolTicariPhone",
    mail: "#yolTicariMail",
    address: "#yolTicariAddress",
    vkn: "#yolTicariVkn",
    imza: "#yolTicariImza",
    ikamet: "#yolTicariIkamet",
    vergiLevha: "#yolTicariVergiLevha",
    cargo: "#yolTicariCargo",
    pin: "#yolTicariPin",
    msg: "#yolTicariMsg",
  });
});

$("#yolBireysel")?.addEventListener("submit", (event) => {
  event.preventDefault();
  yolPartnerSubmit("bireysel", {
    form: "#yolBireysel",
    first: "#yolBireyselFirst",
    last: "#yolBireyselLast",
    phone: "#yolBireyselPhone",
    mail: "#yolBireyselMail",
    address: "#yolBireyselAddress",
    cargo: "#yolBireyselCargo",
    pin: "#yolBireyselPin",
    msg: "#yolBireyselMsg",
  });
});

document.querySelectorAll('input[name="yolListType"]').forEach((input) => {
  input.addEventListener("change", yolSyncSellerTypeUi);
});

$("#yolSellerCargo")?.addEventListener("change", () => {
  const seller = yolSeller();
  const cargo = $("#yolSellerCargo")?.value || "";
  if (!seller || !YOL_CARGO[cargo]) return;
  const partners = store.get(YOL_PARTNERS, []);
  const gsm = yolGsm(seller.phone);
  const email = yolMail(seller.mail);
  partners.forEach((p) => {
    if ((gsm && yolGsm(p.phone) === gsm) || (email && yolMail(p.mail) === email)) p.cargo = cargo;
  });
  store.set(YOL_PARTNERS, partners);
  const catalog = store.get(YOL_PRODUCTS, []);
  catalog.forEach((p) => {
    if (yolOwnProduct(seller, p)) p.cargo = cargo;
  });
  store.set(YOL_PRODUCTS, catalog);
  renderYolMarket();
});

$("#yolSeriesAddRow")?.addEventListener("click", () => {
  $("#yolSeriesRows")?.insertAdjacentHTML("beforeend", yolSeriesRowHtml());
});

$("#yolSellerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const seller = yolSeller();
  const msg = $("#yolSellerMsg");
  if (!seller) {
    if (msg) msg.textContent = "Ürün yüklemek için giriş yapın.";
    return;
  }
  const type = yolSellerListingType();
  if (seller.kind !== "ticari" && type === "series") {
    if (msg) msg.textContent = "Ürün serisi yalnızca ticari faaliyet üyelerine açıktır. Tekli ürün yükleyin.";
    yolSyncSellerTypeUi();
    return;
  }
  const desc = $("#yolProdDesc")?.value.trim() || "";
  let photo = null;
  try {
    const input = $("#yolProdPhoto");
    if (input?.files?.[0]) photo = await posReadDoc(input);
  } catch (error) {
    if (msg) msg.textContent = error.message || "Fotoğraf yüklenemedi.";
    return;
  }
  let product = null;
  if (type === "series") {
    const name = $("#yolSeriesName")?.value.trim() || "";
    const items = $$("#yolSeriesRows .yol-series-row")
      .map((row) => {
        const size = row.querySelector(".yol-var-size")?.value.trim() || "";
        const color = row.querySelector(".yol-var-color")?.value.trim() || "";
        const gender = row.querySelector(".yol-var-gender")?.value || "";
        const price = row.querySelector(".yol-var-price")?.value.trim() || "";
        let name = row.querySelector(".yol-var-name")?.value.trim() || "";
        if (!name) name = [gender, color, size].filter(Boolean).join(" · ");
        return { name, size, color, gender, price };
      })
      .filter((row) => row.size && row.color && row.gender && parseMoney(row.price) > 0);
    if (!name || items.length < 2) {
      if (msg) msg.textContent = "Seri adı ve en az iki varyant yazın. Her varyantta beden, renk, cinsiyet ve fiyat zorunludur.";
      return;
    }
    product = { type: "series", name, items, desc };
  } else {
    const name = $("#yolProdName")?.value.trim() || "";
    const price = $("#yolProdPrice")?.value.trim() || "";
    if (!name || !(parseMoney(price) > 0)) {
      if (msg) msg.textContent = "Ürün adı ve fiyat yazın.";
      return;
    }
    product = { type: "single", name, price, desc };
  }
  const dept = $("#yolProdDept")?.value || "";
  if (!dept) {
    if (msg) msg.textContent = "Kategori seçin.";
    return;
  }
  const cargoPick = $("#yolSellerCargo")?.value || "";
  if (!YOL_CARGO[cargoPick]) {
    if (msg) msg.textContent = "Kargo seçin.";
    return;
  }
  const cargo = yolCargoKey(cargoPick);
  const partners = store.get(YOL_PARTNERS, []);
  const gsm = yolGsm(seller.phone);
  const email = yolMail(seller.mail);
  partners.forEach((p) => {
    if ((gsm && yolGsm(p.phone) === gsm) || (email && yolMail(p.mail) === email)) p.cargo = cargo;
  });
  store.set(YOL_PARTNERS, partners);
  const flashOn = Boolean($("#yolProdFlash")?.checked);
  const products = store.get(YOL_PRODUCTS, []);
  products.unshift({
    id: Date.now(),
    sellerId: seller.memberId || null,
    sellerKind: seller.kind,
    sellerPhone: seller.phone,
    sellerMail: seller.mail,
    sellerName: `${seller.first || ""} ${seller.last || ""}`.trim(),
    photo: photo ? { name: photo.name, type: photo.type, dataUrl: photo.dataUrl } : null,
    sold: 0,
    favs: 0,
    reviews: 0,
    createdAt: Date.now(),
    dept,
    flash: flashOn,
    deal: Boolean($("#yolProdDeal")?.checked),
    cargo,
    brand: $("#yolProdBrand")?.value || "",
    sellerBadges: yolSellerBadgesOf({ sellerPhone: seller.phone, sellerMail: seller.mail, sellerKind: seller.kind }),
    ...product,
  });
  store.set(YOL_PRODUCTS, products.slice(0, 200));
  $("#yolSellerForm")?.reset();
  const single = document.querySelector('input[name="yolListType"][value="single"]');
  if (single) single.checked = true;
  if ($("#yolSeriesRows")) $("#yolSeriesRows").innerHTML = "";
  if (msg) msg.textContent = product.type === "series" ? "Ürün serisi satışa kondu." : "Ürün satışa kondu.";
  renderYolSeller();
  renderYolMarket();
});

function yolDeleteProduct(id) {
  store.set(
    YOL_PRODUCTS,
    store.get(YOL_PRODUCTS, []).filter((p) => String(p.id) !== String(id))
  );
  renderYolSeller();
  renderYolMarket();
  renderYolDesk();
  const q = $("#yolProductQuery")?.value || "";
  if (String(q).trim()) renderYolProductSearch(q);
}

function yolBindProductDeletes(root) {
  root?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-yol-del]");
    if (!btn) return;
    const seller = yolSeller();
    if (!seller) return;
    const mine = store.get(YOL_PRODUCTS, []).find((p) => String(p.id) === btn.dataset.yolDel);
    if (!mine || !yolOwnProduct(seller, mine)) return;
    if (!confirm("Bu ürünü silmek istiyor musunuz?")) return;
    yolDeleteProduct(btn.dataset.yolDel);
  });
}

yolBindProductDeletes($("#yolMyProducts"));
yolBindProductDeletes($("#yolSearchResults"));
yolBindProductDeletes($("#yolDeskProductList"));

function renderYolProductSearch(query) {
  const box = $("#yolSearchResults");
  if (!box) return;
  const q = String(query || "").trim().toLowerCase();
  if (!q) {
    box.hidden = true;
    box.innerHTML = "";
    renderYolMarket();
    renderYolSeller();
    return;
  }
  const qn = q.toLocaleLowerCase("tr-TR");
  const seller = yolSeller();
  const ownOnly = yolHasDesk() && yolOnSellerDesk();
  let list = store.get(YOL_PRODUCTS, []);
  if (ownOnly && seller) list = list.filter((item) => yolOwnProduct(seller, item));
  const yolHits = yolListProducts(list.filter((item) => {
    const title = String(item.name || "").toLocaleLowerCase("tr-TR");
    const variants = (item.items || [])
      .map((v) => [v.name, v.size, v.color, v.gender].filter(Boolean).join(" "))
      .join(" ")
      .toLocaleLowerCase("tr-TR");
    const who = String(item.sellerName || "").toLocaleLowerCase("tr-TR");
    return title.includes(qn) || variants.includes(qn) || who.includes(qn);
  }));
  box.hidden = false;
  box.innerHTML = yolHits.length
    ? yolHits.map((item) => yolProductCardHtml(item, ownOnly)).join("")
    : "<p class='hint'>Bu aramaya uygun ürün yok.</p>";
  renderYolMarket();
}

$("#yolDeptScroller")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-yol-dept]");
  if (!btn) return;
  yolDeptActive = btn.dataset.yolDept || "";
  yolSyncDeptChips();
  yolRefreshProductLists();
});
$$(".yol-filter-bar details.yol-color-panel").forEach((panel) => {
  panel.addEventListener("toggle", () => {
    if (!panel.open) return;
    $$(".yol-filter-bar details.yol-color-panel").forEach((other) => {
      if (other !== panel) other.open = false;
    });
    yolPlaceFilterMenu(panel);
  });
});

function yolFilterMenus(panel) {
  return [...panel.children].filter((el) => el.tagName !== "SUMMARY" && !el.hidden);
}

function yolPlaceFilterMenu(panel) {
  const rect = panel.getBoundingClientRect();
  const width = Math.min(280, Math.max(220, window.innerWidth - 16));
  let left = rect.left;
  if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
  if (left < 8) left = 8;
  const top = Math.min(rect.bottom + 6, window.innerHeight - 96);
  yolFilterMenus(panel).forEach((box) => {
    box.style.top = `${top}px`;
    box.style.left = `${left}px`;
    box.style.width = `${width}px`;
  });
}

function yolCloseFilterMenus() {
  $$(".yol-filter-bar details.yol-color-panel").forEach((panel) => {
    panel.open = false;
  });
}

window.addEventListener("resize", yolCloseFilterMenus);
document.addEventListener(
  "scroll",
  () => {
    if (document.querySelector(".yol-filter-bar details[open]")) yolCloseFilterMenus();
  },
  true
);
document.addEventListener("click", (event) => {
  const open = document.querySelector(".yol-filter-bar details[open]");
  if (!open) return;
  if (open.contains(event.target)) return;
  open.open = false;
});
$("#yolColorGrid")?.addEventListener("change", () => yolRefreshProductLists());
$("#yolPriceBox")?.addEventListener("change", () => yolRefreshProductLists());
$("#yolPriceMin")?.addEventListener("input", () => yolRefreshProductLists());
$("#yolPriceMax")?.addEventListener("input", () => yolRefreshProductLists());
$("#yolLengthBox")?.addEventListener("change", () => yolRefreshProductLists());
$("#yolMaterialBox")?.addEventListener("change", () => yolRefreshProductLists());
$("#yolBrandBox")?.addEventListener("change", () => yolRefreshProductLists());
$("#yolCountryBox")?.addEventListener("change", (event) => {
  const box = event.target;
  if (box?.name !== "yolShopCountry") return;
  const codes = $$('#yolCountryBox input[name="yolShopCountry"]:checked').map((el) => el.value);
  yolSetShopCountries(codes, box.checked ? box.value : codes[0]);
  renderYolCountries();
  yolSyncCountryUi();
  if ($("#yolCountryMsg")) {
    const cur = yolCountryByCode(yolShopCountryCode());
    $("#yolCountryMsg").textContent = `${cur.n} seçildi. Siparişte satıcıdan kargoyu bu ülkeye göndermesi istenir.`;
  }
});
$("#yolCountryQuery")?.addEventListener("input", () => renderYolCountries());
$("#yolSellerCountryBox")?.addEventListener("change", (event) => {
  if (event.target?.name !== "yolShipCountry") return;
  const codes = $$('#yolSellerCountryBox input[name="yolShipCountry"]:checked').map((el) => el.value);
  yolSetSellerShipCodes(codes);
  renderYolCountries();
});
$("#yolSellerCountryQuery")?.addEventListener("input", () => renderYolCountries());
$("#yolSortList")?.addEventListener("change", () => {
  const pick = $('input[name="yolSortPick"]:checked')?.value || "recommended";
  if ($("#yolProductSort")) $("#yolProductSort").value = pick;
  yolRefreshProductLists();
});
$("#yolProductSort")?.addEventListener("change", () => yolRefreshProductLists());
$("#yolCatList")?.addEventListener("change", (event) => {
  if (event.target?.name === "yolSellerBadge") {
    yolRefreshProductLists();
    return;
  }
  const pick = $('input[name="yolCatPick"]:checked')?.value || "";
  if ($("#yolProductCategory")) $("#yolProductCategory").value = pick;
  yolSyncCategoryValue();
  yolRefreshProductLists();
});
$("#yolProductCategory")?.addEventListener("change", () => {
  yolSyncCategoryValue();
  yolRefreshProductLists();
});
$("#yolProductCategoryValue")?.addEventListener("change", () => yolRefreshProductLists());
$("#yolProductSearch")?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!yolOnSellerDesk() || !(yolIsBireysel() || yolIsTicari())) {
    showView("home");
  }
  renderYolProductSearch($("#yolProductQuery")?.value || "");
});

$("#yolProductQuery")?.addEventListener("input", () => {
  const q = $("#yolProductQuery")?.value || "";
  if (!String(q).trim()) renderYolProductSearch("");
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
renderEimza();
renderMusic();
renderAiClip();
trackSiteApp("home");
renderYol();
if (ownerAppsOn()) renderSiteStats();
(async () => {
  const token = new URL(location.href).searchParams.get("posToken");
  if (!token) return;
  await yolFinishCartPay(token);
})();