const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const PAGE = document.body.dataset.page || "panel";

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

const CITIES = [
  "Adana", "Ankara", "Antalya", "Bursa", "Diyarbakır", "Erzurum", "Eskişehir", "Gaziantep",
  "İstanbul", "İzmir", "Kayseri", "Kocaeli", "Konya", "Mersin", "Samsun", "Trabzon", "Van",
];

const ILLER = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan",
  "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis",
  "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce",
  "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane",
  "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir", "Kahramanmaraş", "Karabük",
  "Karaman", "Kars", "Kastamonu", "Kayseri", "Kırıkkale", "Kırklareli", "Kırşehir", "Kilis",
  "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş",
  "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop",
  "Sivas", "Şanlıurfa", "Şırnak", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van",
  "Yalova", "Yozgat", "Zonguldak",
];

const ZONES = {
  İstanbul: 1, Kocaeli: 1, Bursa: 1, İzmir: 2, Eskişehir: 2, Ankara: 2, Antalya: 3,
  Adana: 3, Mersin: 3, Konya: 3, Kayseri: 3, Samsun: 4, Trabzon: 4, Gaziantep: 4,
  Diyarbakır: 5, Erzurum: 5, Van: 5,
};

const MARKETS = [
  { id: "harbi", name: "Harbi Pazar", hint: "Harbi sipariş / iade" },
  { id: "trendyol", name: "Trendyol", hint: "Satıcı API Key + Secret" },
  { id: "hepsiburada", name: "Hepsiburada", hint: "Merchant ID, servis anahtarı" },
  { id: "amazon", name: "Amazon", hint: "LWA Client ID + Secret" },
  { id: "n11", name: "n11", hint: "API Key + Secret Key" },
  { id: "pazarama", name: "Pazarama", hint: "Satıcı anahtar çifti" },
  { id: "ciceksepeti", name: "Çiçeksepeti", hint: "API Key + Secret" },
  { id: "shopify", name: "Shopify", hint: "Admin API + secret" },
  { id: "woocommerce", name: "WooCommerce", hint: "Consumer key + secret" },
  { id: "ikas", name: "İkas", hint: "Mağaza API + gizli" },
  { id: "tsoft", name: "T-Soft", hint: "Entegratör anahtarları" },
  { id: "ideasoft", name: "IdeaSoft", hint: "API kullanıcı + şifre" },
  { id: "opencart", name: "OpenCart", hint: "REST key + secret" },
  { id: "etsy", name: "Etsy", hint: "Keystring + shared secret" },
  { id: "ebay", name: "eBay", hint: "App ID + Cert ID" },
  { id: "aliexpress", name: "AliExpress", hint: "App Key + Secret" },
  { id: "teknosa", name: "Teknosa Marketplace", hint: "Satıcı API" },
  { id: "boyner", name: "Boyner", hint: "Vendor key + secret" },
  { id: "lcw", name: "LC Waikiki Tedarik", hint: "EDI / API çifti" },
  { id: "flo", name: "Flo", hint: "Satıcı anahtarları" },
  { id: "morhipo", name: "Morhipo", hint: "API Key + Secret" },
  { id: "pttavm", name: "PTT AVM", hint: "Mağaza kodu + gizli" },
  { id: "pazarama2", name: "GetirÇarşı / GetirYemek Mağaza", hint: "Restoran/mağaza token" },
];

const KEYS = "hk-api-keys";
const SHIPS = "hk-shipments";
const MARK = "hk-markets";
const POS = "hk-pos";
const ORDERS = "hk-orders";
const RETURNS = "hk-returns";
const PAYOUTS = "hk-pos-payouts";
const POS_HANDOFF = "hk-pos-handoff";

function ibanRaw(v) {
  return String(v || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function ibanOk(v) {
  return /^TR\d{24}$/.test(ibanRaw(v));
}

function ibanFormat(v) {
  return ibanRaw(v).replace(/(.{4})/g, "$1 ").trim();
}

function payouts() {
  return store.get(PAYOUTS, []);
}

function savePayout(row) {
  const list = payouts();
  list.unshift(row);
  store.set(PAYOUTS, list.slice(0, 80));
}
const PARTNERS = "hk-partners";
const PARTNER_APPS = "hk-partner-apps";
const BRANCHES = "hk-branches";
const HK_SESSION = "hk-session";
const HK_REMEMBER = "hk-login-remember";
const COURIERS = "hk-couriers";
const COURIER_ACTIVE = "hk-courier-active";

const DEMO_COURIER = {
  id: "ky_demo",
  name: "Demo Kurye",
  phone: "05321112233",
  plate: "34 HK 001",
  username: "demo.kurye",
  password: "Kurye1234",
  branchId: "br_demo",
  role: "courier",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function couriers() {
  return store.get(COURIERS, []);
}

function saveCouriers(list) {
  store.set(COURIERS, list);
}

function seedDemoCourier() {
  const list = couriers();
  const demoUser = String(DEMO_COURIER.username).toLowerCase();
  const idx = list.findIndex(
    (c) => c.id === DEMO_COURIER.id || String(c.username || "").toLowerCase() === demoUser
  );
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...DEMO_COURIER, username: DEMO_COURIER.username, password: DEMO_COURIER.password };
  } else {
    list.unshift({ ...DEMO_COURIER });
  }
  store.set(COURIERS, list);
}

function hkRememberGet() {
  return store.get(HK_REMEMBER, null);
}

function hkRememberSave(user, pass, remember) {
  if (remember && user) {
    store.set(HK_REMEMBER, { remember: true, user, pass: String(pass || "") });
  } else {
    store.set(HK_REMEMBER, { remember: false });
  }
}

function hkTogglePass(inputSel, btnSel) {
  const pin = $(inputSel);
  const btn = $(btnSel);
  if (!pin || !btn) return;
  const show = pin.type === "password";
  pin.type = show ? "text" : "password";
  btn.textContent = show ? "Şifreyi gizle" : "Şifreyi göster";
  btn.setAttribute("aria-pressed", String(show));
}

function fillHkLoginRemember() {
  const saved = hkRememberGet();
  const remember = saved?.remember !== false;
  if ($("#hkLoginRemember")) $("#hkLoginRemember").checked = remember;
  if ($("#mobLoginRemember")) $("#mobLoginRemember").checked = remember;
  if ($("#kyLoginRemember")) $("#kyLoginRemember").checked = remember;
  if (!saved?.remember || !saved.user) return;
  if ($("#hkLoginUser") && !$("#hkLoginUser").value) $("#hkLoginUser").value = saved.user;
  if ($("#hkLoginPass") && !$("#hkLoginPass").value) $("#hkLoginPass").value = saved.pass || "";
  if ($("#mobLoginUser") && !$("#mobLoginUser").value) $("#mobLoginUser").value = saved.user;
  if ($("#mobLoginPass") && !$("#mobLoginPass").value) $("#mobLoginPass").value = saved.pass || "";
  if ($("#kyLoginUser") && !$("#kyLoginUser").value) $("#kyLoginUser").value = saved.user;
  if ($("#kyLoginPass") && !$("#kyLoginPass").value) $("#kyLoginPass").value = saved.pass || "";
}

const DEMO_BRANCH = {
  id: "br_demo",
  branchName: "Harbi Merkez Şube",
  city: "İstanbul",
  phone: "08501234567",
  username: "demo.kargo",
  password: "Demo1234",
  role: "demo",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function branches() {
  return store.get(BRANCHES, []);
}

function seedBranches() {
  const list = branches();
  const idx = list.findIndex(
    (b) => b.id === DEMO_BRANCH.id || String(b.username || "").toLowerCase() === DEMO_BRANCH.username
  );
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...DEMO_BRANCH };
  } else {
    list.unshift({ ...DEMO_BRANCH });
  }
  store.set(BRANCHES, list);
}

function normalizeHkUser(v) {
  return String(v || "")
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/\s+/g, "");
}

function getSession() {
  const raw = store.get(HK_SESSION, null);
  if (!raw) return null;
  if (typeof raw === "string") return { role: "branch", id: raw };
  if (raw.role && raw.id) return raw;
  return null;
}

function setSession(role, id) {
  store.set(HK_SESSION, { role, id });
}

function clearSession() {
  store.set(HK_SESSION, null);
  store.set(COURIER_ACTIVE, null);
}

function currentBranch() {
  const s = getSession();
  if (!s || s.role !== "branch") return null;
  return branches().find((b) => b.id === s.id) || null;
}

function currentCourier() {
  const s = getSession();
  if (!s || s.role !== "courier") return null;
  return couriers().find((c) => c.id === s.id) || null;
}

function isDemoUser(user = currentBranch()) {
  return user?.role === "demo";
}

function findHkLogin(username, password) {
  seedBranches();
  seedDemoCourier();
  const u = normalizeHkUser(username);
  const p = String(password || "").trim();
  const branch = branches().find(
    (b) => normalizeHkUser(b.username) === u && String(b.password) === p
  );
  if (branch) return { role: "branch", account: branch };
  const courier = couriers().find(
    (c) => normalizeHkUser(c.username) === u && String(c.password) === p
  );
  if (courier) return { role: "courier", account: courier };
  return null;
}

function goCourierApp() {
  location.replace("kargo-kurye.html");
}

function goTeslimScreen() {
  location.replace("kargo-teslim.html");
}

function goBranchApp() {
  location.replace("kargo.html");
}

function requireBranchAuth() {
  seedBranches();
  seedDemoCourier();
  const branch = currentBranch();
  const courier = currentCourier();

  if (PAGE === "courier" || PAGE === "teslim") {
    if (branch) {
      goBranchApp();
      return null;
    }
    const gateId = PAGE === "teslim" ? "#tlAuthGate" : "#kyAuthGate";
    const shellId = PAGE === "teslim" ? "#tlShell" : "#kyShell";
    if (!courier) {
      document.body.classList.add("hk-locked");
      if ($(gateId)) $(gateId).hidden = false;
      if ($(shellId)) $(shellId).hidden = true;
      return null;
    }
    document.body.classList.remove("hk-locked");
    if ($(gateId)) $(gateId).hidden = true;
    if ($(shellId)) $(shellId).hidden = false;
    store.set(COURIER_ACTIVE, courier.id);
    const br = branches().find((b) => b.id === courier.branchId);
    const label = courier.name + (br ? " · " + br.branchName : "");
    if ($("#kyBranchLabel")) $("#kyBranchLabel").textContent = label;
    if ($("#tlCourierLabel")) $("#tlCourierLabel").textContent = label;
    return courier;
  }

  if (courier && PAGE !== "nfc" && PAGE !== "courier" && PAGE !== "teslim") {
    goCourierApp();
    return null;
  }

  const user = branch;

  if (PAGE === "nfc") {
    if (!user && !courier) {
      location.replace("kargo.html");
      return null;
    }
    return user || courier;
  }
  if ((PAGE === "create" || PAGE === "mobile") && !user) {
    if (PAGE === "mobile") {
      document.body.classList.add("hk-locked");
      if ($("#mobAuthGate")) $("#mobAuthGate").hidden = false;
      if ($("#mobShell")) $("#mobShell").hidden = true;
      return null;
    }
    location.replace("kargo.html");
    return null;
  }
  if (PAGE === "create" && user) {
    if ($("#hkCreateBranchLabel")) {
      $("#hkCreateBranchLabel").textContent = user.branchName + " · Yeni kargo";
    }
    return user;
  }
  if (PAGE === "mobile" && user) {
    document.body.classList.remove("hk-locked");
    if ($("#mobAuthGate")) $("#mobAuthGate").hidden = true;
    if ($("#mobShell")) $("#mobShell").hidden = false;
    if ($("#mobBranchLabel")) $("#mobBranchLabel").textContent = user.branchName + " · Şube";
    return user;
  }
  if (PAGE !== "panel") return user;
  const gate = $("#hkAuthGate");
  const shell = $("#hkAppShell");
  const tab = $("#hkTabbar");
  const guest = document.body.classList.contains("hk-guest");

  if (!user && !guest) {
    document.body.classList.add("hk-locked");
    document.body.classList.remove("hk-guest");
    if (gate) gate.hidden = false;
    if (shell) shell.hidden = true;
    if (tab) tab.hidden = true;
    return null;
  }

  document.body.classList.remove("hk-locked");
  if (gate) gate.hidden = true;
  if (shell) shell.hidden = false;
  if (tab) tab.hidden = !user;

  const staffOnly = $$("[data-go='home'], [data-go='integrate'], [data-go='branches'], [data-go='couriers'], a[href='kargo-nfc.html'], a[href='kargo-olustur.html'], a[href='kargo-mobil.html'], a[href='kargo-kurye.html']");
  staffOnly.forEach((el) => {
    if (el.closest(".tabbar")) el.hidden = !user;
    else if (el.matches("[data-go='branches']")) el.hidden = !(user && isDemoUser(user));
    else el.hidden = !user;
  });
  $$(".tabbar a[href='kargo-nfc.html'], .tabbar a[href='kargo-mobil.html']").forEach((el) => {
    el.hidden = !user;
  });

  if ($("#hkBranchLabel")) {
    $("#hkBranchLabel").textContent = user
      ? user.branchName + (user.city ? " · " + user.city : "") + " · Şube"
      : "İş Ortaklığı Başvurusu";
  }
  if ($("#hkBranchesNav")) $("#hkBranchesNav").hidden = !(user && isDemoUser(user));
  if ($("#hkBranchesTab")) $("#hkBranchesTab").hidden = !(user && isDemoUser(user));
  if ($("#hkLogoutBtn")) $("#hkLogoutBtn").hidden = !user;
  if ($("#hkStaffLoginBtn")) $("#hkStaffLoginBtn").hidden = !!user;
  if ($("#partnerApproveBox")) $("#partnerApproveBox").hidden = !user;
  if ($("#partnerGuestNote")) $("#partnerGuestNote").hidden = !!user;
  return user;
}

function openGuestPartner() {
  document.body.classList.add("hk-guest");
  document.body.classList.remove("hk-locked");
  requireBranchAuth();
  showView("partner");
}

function closeGuestToLogin() {
  document.body.classList.remove("hk-guest");
  clearSession();
  requireBranchAuth();
  if ($("#hkLoginMsg")) $("#hkLoginMsg").textContent = "";
}

function slugBranchUser(name) {
  const base = String(name || "sube")
    .toLocaleLowerCase("tr")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12) || "sube";
  const n = String(100 + Math.floor(Math.random() * 900));
  return "sube." + base + n;
}

function upsertBranchAccount(row) {
  const list = branches();
  const idx = list.findIndex((b) => b.id === row.id || b.username === row.username);
  if (idx >= 0) list[idx] = { ...list[idx], ...row };
  else list.unshift(row);
  store.set(BRANCHES, list);
  return row;
}

function renderBranchList() {
  const box = $("#branchList");
  if (!box) return;
  const list = branches();
  if (!list.length) {
    box.innerHTML = '<p class="hint">Henüz şube yok.</p>';
    return;
  }
  box.innerHTML = list
    .map((b) => {
      const role = b.role === "demo" ? "Demo merkez" : "Şube";
      const del =
        b.role === "demo"
          ? ""
          : `<button type="button" class="btn-no" data-del-branch="${b.id}">Kaldır</button>`;
      return `<div class="partner-app">
        <strong>${b.branchName}</strong>
        <div class="meta">${role}${b.city ? " · " + b.city : ""}${b.phone ? " · " + b.phone : ""}</div>
        <div class="cred">Kullanıcı: ${b.username}<br>Şifre: ${b.password}</div>
        <div class="row-btns" style="margin-top:6px">${del}</div>
      </div>`;
    })
    .join("");
}

function fillCities(sel, preferred) {
  if (!sel) return;
  sel.innerHTML = CITIES.map((c) => `<option value="${c}">${c}</option>`).join("");
  if (preferred) sel.value = preferred;
}

function fillIller(sel) {
  if (!sel) return;
  sel.innerHTML =
    '<option value="" disabled selected>İl seçin</option>' +
    ILLER.map((c) => `<option value="${c}">${c}</option>`).join("");
}

function zoneOf(a, b) {
  if (a === b) return 1;
  return Math.max(1, Math.abs((ZONES[a] || 3) - (ZONES[b] || 3)) + 1);
}

function desiOf(w, l, h) {
  return Math.max(0.1, (Number(w) * Number(l) * Number(h)) / 3000);
}

function billableWeight(kg, desi) {
  return Math.max(Number(kg) || 0, Number(desi) || 0, 0.1);
}

function quotePrice(fromCity, toCity, kg, desi) {
  const zone = zoneOf(fromCity, toCity);
  const w = billableWeight(kg, desi);
  const base = 49;
  const perUnit = 14;
  const total = Math.round((base + w * perUnit * zone) * 100) / 100;
  return { zone, weight: w, total };
}

function formatTry(n) {
  return (
    Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺"
  );
}

function ships() {
  return store.get(SHIPS, []);
}

function sendCodeOf(s) {
  const d = String(s.sendCode || s.tracking || "").replace(/\D/g, "");
  return d.length === 4 ? d : String(s.tracking || "");
}

function uniqueSendCode() {
  const used = new Set(ships().map(sendCodeOf));
  let code = "";
  for (let i = 0; i < 80; i++) {
    code = String(1000 + Math.floor(Math.random() * 9000));
    if (!used.has(code)) return code;
  }
  return String(1000 + (Date.now() % 9000));
}

const BUCKETS = [
  { id: "in", title: "Gelen Kargolar" },
  { id: "custody", title: "Zimmetteki Kargolar" },
  { id: "dist", title: "Dağıtımdaki Kargolar" },
  { id: "delivered", title: "Teslim Edilen Kargolar" },
  { id: "delivered_unpaid", title: "Teslim Edilen Ücret Tahsil Edilmeyen Kargolar" },
  { id: "delivered_paid", title: "Teslim Edilen Ücret Tahsil Edilen Kargolar" },
  { id: "not_home", title: "Adreste Yok" },
  { id: "bad_address", title: "Yanlış Adres / Adresi Yetersiz" },
  { id: "bad_phone", title: "Telefon No Güncel Değil" },
  { id: "fee_refused", title: "Alıcı Ücret ve Kargoyu Kabul Etmiyor" },
  { id: "abuse", title: "Hakaret Etti" },
  { id: "return", title: "İade Kargolar" },
  { id: "pickup", title: "Adresten Alım Kargolar" },
];
const BUCKET_IDS = new Set(BUCKETS.map((b) => b.id));
const BUCKET_SEED = "hk-buckets-v3";

const KY_FAIL_REASONS = [
  { id: "addr_outdated", label: "Adres bilgisi güncel değil" },
  { id: "bad_address", label: "Yanlış / eksik adres" },
  { id: "bad_phone", label: "Telefon numarası güncel değil" },
  { id: "fee_refused", label: "Alıcı kargo ücretini ve kargoyu kabul etmiyor" },
];
const KY_FAIL_IDS = new Set(KY_FAIL_REASONS.map((r) => r.id));

function failReasonLabel(id) {
  return KY_FAIL_REASONS.find((r) => r.id === id)?.label || kindLabel(id);
}

function kyFailReasonOptions(selected) {
  return (
    '<option value="">Neden seçin</option>' +
    KY_FAIL_REASONS.map(
      (r) =>
        `<option value="${r.id}"${selected === r.id ? " selected" : ""}>${r.label}</option>`
    ).join("")
  );
}

function kindOf(s) {
  if (BUCKET_IDS.has(s.kind)) return s.kind;
  if (s.kind === "out") return "custody";
  if (s.tracking === "4821" || s.sendCode === "4821") return "in";
  return "in";
}

function kindLabel(k) {
  return BUCKETS.find((b) => b.id === k)?.title || "Gelen Kargolar";
}

function showView(name) {
  const known = new Set(["home", "integrate", "partner", "branches", "couriers"]);
  if (!known.has(name)) name = "home";
  const user = currentBranch();
  const guest = document.body.classList.contains("hk-guest");
  if (!user && guest && name !== "partner") {
    openGuestPartner();
    return;
  }
  if (name === "branches" && !isDemoUser()) name = "home";
  if (!user && !guest) {
    requireBranchAuth();
    return;
  }
  $$(".view").forEach((v) => {
    const on = v.dataset.view === name;
    v.classList.toggle("active", on);
    v.toggleAttribute("hidden", !on);
  });
  $$("[data-go]").forEach((b) => b.classList.toggle("active", b.dataset.go === name));
  if (name === "integrate") {
    renderKeys();
    renderMarkets();
  }
  if (name === "home") renderDesk();
  if (name === "partner") {
    if (user) renderPartnerQueue();
    $("#pName")?.focus({ preventScroll: true });
  }
  if (name === "branches") renderBranchList();
  if (name === "couriers") renderPanelCouriers();
  window.scrollTo(0, 0);
}

$$("[data-go]").forEach((el) => {
  el.addEventListener("click", () => showView(el.dataset.go));
});

function seedDemo() {
  if (store.get(BUCKET_SEED, false)) return;
  const samples = [
    { kind: "in", phone: "05320001111", address: "Kadıköy, Caferağa Mah. No:12", receiver: "Harbi Şube" },
    { kind: "custody", phone: "05320002222", address: "Başakşehir depo zimmet rafı A-4", receiver: "Kurye Mehmet" },
    { kind: "dist", phone: "05321112233", address: "Konak örnek cad. 8 daire 3", receiver: "Ayşe Demir" },
    { kind: "delivered", phone: "05324445566", address: "Çankaya Atatürk Bul. 88", receiver: "Can Yılmaz" },
    { kind: "delivered_unpaid", phone: "05325556677", address: "Alsancak Kıbrıs Şehitleri 41", receiver: "Ece Kaya" },
    { kind: "delivered_paid", phone: "05326667788", address: "Nilüfer Odunluk Mah.", receiver: "Burak Şen" },
    { kind: "bad_address", phone: "05327778899", address: "Adres eksik: mahalle/no yok", receiver: "Bilinmiyor" },
    { kind: "bad_phone", phone: "0000000000", address: "Muratpaşa Şirinyalı Mah. 7", receiver: "Selin Ak" },
    { kind: "fee_refused", phone: "05329990011", address: "Seyhan Reşatbey Mah. 19", receiver: "Hakan Öz" },
    { kind: "return", phone: "05321110022", address: "Satıcı deposu, İkitelli OSB", receiver: "Trendyol İade" },
    { kind: "pickup", phone: "05323334455", address: "Müşteri adresi: Moda Cad. 21", receiver: "Harbi Alım" },
  ];
  const list = ships().filter((s) => BUCKET_IDS.has(s.kind));
  samples.forEach((row, i) => {
    const code = String(4800 + i);
    if (list.some((s) => sendCodeOf(s) === code)) return;
    list.push({
      tracking: code,
      sendCode: code,
      teslimCode: null,
      kind: row.kind,
      sender: "Harbi Kargo",
      receiver: row.receiver,
      fromCity: "İstanbul",
      toCity: "İstanbul",
      phone: row.phone,
      address: row.address,
      kg: 1,
      desi: 1,
      status: row.kind,
      createdAt: new Date().toISOString(),
    });
  });
  store.set(SHIPS, list);
  store.set(BUCKET_SEED, true);
}
seedDemo();

function eventsFor(ship) {
  const t0 = new Date(ship.createdAt).getTime();
  const steps = [
    { at: t0, title: "Gönderim kodu üretildi", detail: "Kod " + sendCodeOf(ship) + " · teslim kodu yok" },
    { at: t0 + 3 * 3600000, title: "Transfer merkezinde", detail: ship.fromCity + " → " + ship.toCity },
    { at: t0 + 18 * 3600000, title: "Dağıtımda", detail: "Kurye yola çıktı" },
    { at: t0 + 26 * 3600000, title: "Teslim edildi", detail: ship.receiver },
  ];
  const now = Date.now();
  if (ship.status === "created") return steps.slice(0, 1);
  if (ship.status === "transit") return steps.filter((s) => s.at <= now + 1000).slice(0, 3);
  return steps;
}

function findShip(code) {
  const n = String(code || "").replace(/\D/g, "").slice(0, 4);
  return ships().find((s) => sendCodeOf(s) === n);
}

async function createShip(fields) {
  const sendCode = fields.sendCode && String(fields.sendCode).replace(/\D/g, "").slice(0, 4).length === 4
    ? String(fields.sendCode).replace(/\D/g, "").slice(0, 4)
    : uniqueSendCode();
  const payload = { action: "create-shipment", ...fields, sendCode };
  try {
    const res = await fetch("/kargo-api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Hata");
    const row = {
      id: "sh_" + Date.now().toString(36),
      ...data.shipment,
      ...fields,
      sendCode,
      tracking: sendCode,
      teslimCode: null,
      kind: fields.kind,
    };
    const list = ships();
    list.unshift(row);
    store.set(SHIPS, list);
    return row;
  } catch {
    const row = {
      id: "sh_" + Date.now().toString(36),
      ...payload,
      tracking: sendCode,
      sendCode,
      teslimCode: null,
      status: fields.kind || "created",
      kind: fields.kind,
      createdAt: new Date().toISOString(),
    };
    const list = ships();
    list.unshift(row);
    store.set(SHIPS, list);
    return row;
  }
}

function listOf(kind) {
  return ships().filter((s) => kindOf(s) === kind);
}

function chipsHtml(rows, key) {
  if (!rows.length) return "";
  return rows
    .map((s) => {
      const code = sendCodeOf(s);
      const text = key === "phone" ? `${code} · ${s.phone || "—"}` : `${code} · ${s.address || "—"}`;
      const hay = `${code} ${s.phone || ""} ${s.address || ""}`.toLocaleLowerCase("tr");
      return `<span class="chip-item" data-hay="${hay.replace(/"/g, "")}">${text}</span>`;
    })
    .join("");
}

function filterBucket(card, q) {
  const needle = String(q || "").trim().toLocaleLowerCase("tr");
  card.querySelectorAll(".chip-item").forEach((el) => {
    el.hidden = Boolean(needle) && !(el.dataset.hay || "").includes(needle);
  });
  const shown = [...card.querySelectorAll('[data-list="phone"] .chip-item')].filter((el) => !el.hidden).length;
  const total = listOf(card.dataset.bucket).length;
  card.querySelectorAll("[data-count]").forEach((el) => {
    el.textContent = needle ? String(shown) : String(total);
  });
}

function renderDesk() {
  if (PAGE !== "panel" || !$("#bucketStack")) return;
  $("#bucketStack").innerHTML = BUCKETS.map((b) => {
    const rows = listOf(b.id);
    return `<article class="bucket-strip" data-bucket="${b.id}">
      <form class="strip-form">
        <input class="bucket-search" type="search" data-search placeholder="Ara…" maxlength="40" aria-label="${b.title} ara" />
        <h3 class="strip-title">${b.title}</h3>
        <div class="strip-count" title="Sayı"><b data-count>${rows.length}</b></div>
        <label class="strip-cell">
          <span>Telefon</span>
          <input name="phone" inputmode="tel" required maxlength="20" placeholder="05xx" />
        </label>
        <label class="strip-cell">
          <span>Adres</span>
          <input name="address" required maxlength="240" placeholder="Adres" />
        </label>
        <button class="primary slim" type="submit">Ekle</button>
        <p class="msg strip-msg" data-msg></p>
      </form>
      <div class="strip-rail" data-list="phone">${chipsHtml(rows, "phone")}</div>
      <div class="strip-rail strip-rail-addr" data-list="address">${chipsHtml(rows, "address")}</div>
    </article>`;
  }).join("");
}

if (PAGE === "panel") {
  renderDesk();
  $("#bucketStack")?.addEventListener("input", (e) => {
    const search = e.target.closest("[data-search]");
    if (!search) return;
    filterBucket(search.closest("[data-bucket]"), search.value);
  });
  $("#bucketStack")?.addEventListener("submit", async (e) => {
    const form = e.target.closest(".strip-form");
    if (!form) return;
    e.preventDefault();
    const card = form.closest("[data-bucket]");
    const kind = card.dataset.bucket;
    const phone = form.querySelector('[name="phone"]').value.trim();
    const address = form.querySelector('[name="address"]').value.trim();
    const msg = form.querySelector("[data-msg]");
    if (!phone || !address) {
      msg.className = "msg err strip-msg";
      msg.textContent = "Telefon ve adres zorunlu.";
      return;
    }
    const row = await createShip({
      kind,
      sender: "Harbi Kargo",
      receiver: kindLabel(kind),
      fromCity: "İstanbul",
      toCity: "İstanbul",
      phone,
      address,
      kg: 1,
      desi: 1,
      service: "standart",
      payment: "gonderici",
    });
    const q = card.querySelector("[data-search]")?.value || "";
    renderDesk();
    const next = document.querySelector(`[data-bucket="${kind}"]`);
    if (!next) return;
    const search = next.querySelector("[data-search]");
    if (search && q) {
      search.value = q;
      filterBucket(next, q);
    }
    const m = next.querySelector("[data-msg]");
    if (m) {
      m.className = "msg ok strip-msg";
      m.textContent = "Kod: " + sendCodeOf(row);
    }
  });
}

function fileMeta(input) {
  const f = input?.files?.[0];
  if (!f) return null;
  return { name: f.name, size: f.size, type: f.type };
}

function slugUser(name) {
  const base = String(name || "ortak")
    .toLocaleLowerCase("tr")
    .replace(/[^a-z0-9çğıöşü]+/gi, "")
    .slice(0, 10) || "ortak";
  const n = String(100 + Math.floor(Math.random() * 900));
  return "hk_" + base + n;
}

function makePass() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  buf.forEach((b) => {
    out += chars[b % chars.length];
  });
  return out;
}

function partnerApps() {
  return store.get(PARTNER_APPS, []);
}

function renderPartnerQueue() {
  const box = $("#partnerQueue");
  if (!box) return;
  const apps = partnerApps();
  if (!apps.length) {
    box.innerHTML = '<p class="hint">Henüz başvuru yok.</p>';
    return;
  }
  box.innerHTML = apps
    .map((a) => {
      const docs = [a.vergi?.name, a.sicil?.name, a.imza?.name, a.saglik?.name].filter(Boolean).join(" · ");
      if (a.status === "approved") {
        return `<div class="partner-app">
          <strong>${a.name}</strong>
          <div class="meta">Onaylandı · ${a.mail}${a.il ? " · " + a.il + (a.ilce ? " / " + a.ilce : "") : ""}</div>
          <div class="cred">Kullanıcı: ${a.username}<br>Şifre: ${a.password}</div>
        </div>`;
      }
      if (a.status === "rejected") {
        return `<div class="partner-app">
          <strong>${a.name}</strong>
          <div class="meta">Reddedildi · ${a.mail}</div>
        </div>`;
      }
      return `<div class="partner-app" data-id="${a.id}">
        <strong>${a.name}</strong>
        <div class="meta">${a.phone} · ${a.mail}<br>${[a.il, a.ilce].filter(Boolean).join(" / ")}${a.il || a.ilce ? "<br>" : ""}${a.address}</div>
        <div class="docs">${docs || "Belgeler yüklendi"}</div>
        <div class="row-btns">
          <button type="button" class="btn-ok" data-approve>Onayla</button>
          <button type="button" class="btn-no" data-reject>Reddet</button>
        </div>
      </div>`;
    })
    .join("");
}

function showPartnerCreds(app) {
  const box = $("#partnerCredBox");
  if (!box) return;
  box.hidden = false;
  $("#partnerCredHint").textContent = app.name + " için hesap tanımlandı.";
  $("#partnerUserBox").textContent = "Kullanıcı adı: " + app.username;
  $("#partnerPassBox").textContent = "Şifre: " + app.password;
}

if (PAGE === "panel") {
  renderPartnerQueue();
  fillIller($("#pIl"));

  $("#partnerForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = $("#partnerMsg");
    const name = $("#pName").value.trim();
    const phone = $("#pPhone").value.trim();
    const mail = $("#pMail").value.trim().toLowerCase();
    const il = $("#pIl").value.trim();
    const ilce = $("#pIlce").value.trim();
    const address = $("#pAddress").value.trim();
    const vergi = fileMeta($("#pVergi"));
    const sicil = fileMeta($("#pSicil"));
    const imza = fileMeta($("#pImza"));
    const saglik = fileMeta($("#pSaglik"));
    if (!name || !phone || !mail || !il || !ilce || !address || !vergi || !sicil || !imza || !saglik) {
      msg.className = "msg err";
      msg.textContent = "Tüm alanlar ve belgeler zorunlu.";
      return;
    }
    const apps = partnerApps();
    if (apps.some((a) => a.mail === mail && a.status !== "rejected")) {
      msg.className = "msg err";
      msg.textContent = "Bu mail ile bekleyen veya onaylı başvuru var.";
      return;
    }
    apps.unshift({
      id: "pa_" + Date.now().toString(36),
      name,
      phone,
      mail,
      il,
      ilce,
      address,
      vergi,
      sicil,
      imza,
      saglik,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    store.set(PARTNER_APPS, apps);
    $("#partnerForm").reset();
    fillIller($("#pIl"));
    msg.className = "msg ok";
    msg.textContent = "Başvuru gönderildi. Onay sonrası kullanıcı adı ve şifre tanımlanır.";
    $("#partnerCredBox").hidden = true;
    renderPartnerQueue();
  });

  $("#partnerQueue")?.addEventListener("click", (e) => {
    const card = e.target.closest(".partner-app[data-id]");
    if (!card) return;
    const id = card.dataset.id;
    const apps = partnerApps();
    const idx = apps.findIndex((a) => a.id === id);
    if (idx < 0) return;
    if (e.target.matches("[data-approve]")) {
      const username = slugUser(apps[idx].name);
      const password = makePass();
      apps[idx] = {
        ...apps[idx],
        status: "approved",
        username,
        password,
        approvedAt: new Date().toISOString(),
      };
      const users = store.get(PARTNERS, []);
      users.unshift({
        id: apps[idx].id,
        name: apps[idx].name,
        mail: apps[idx].mail,
        phone: apps[idx].phone,
        username,
        password,
        at: apps[idx].approvedAt,
      });
      store.set(PARTNERS, users);
      upsertBranchAccount({
        id: apps[idx].id,
        branchName: apps[idx].name,
        city: apps[idx].il || "",
        district: apps[idx].ilce || "",
        phone: apps[idx].phone,
        mail: apps[idx].mail,
        username,
        password,
        role: "branch",
        createdAt: apps[idx].approvedAt,
      });
      store.set(PARTNER_APPS, apps);
      renderPartnerQueue();
      showPartnerCreds(apps[idx]);
      if (isDemoUser()) renderBranchList();
      return;
    }
    if (e.target.matches("[data-reject]")) {
      apps[idx] = { ...apps[idx], status: "rejected", rejectedAt: new Date().toISOString() };
      store.set(PARTNER_APPS, apps);
      renderPartnerQueue();
    }
  });
}

function randomPart(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function makeKeys() {
  return {
    apiKey: "hk_live_" + randomPart(16),
    secretKey: "hk_sk_" + randomPart(24),
    createdAt: new Date().toISOString(),
  };
}

function renderKeys() {
  if (!$("#apiKeyBox")) return;
  const k = store.get(KEYS, null);
  $("#apiKeyBox").textContent = k?.apiKey || "Henüz üretilmedi";
  $("#secretKeyBox").textContent = k?.secretKey || "Henüz üretilmedi";
}

$("#genKeys")?.addEventListener("click", () => {
  if (store.get(KEYS, null) && !confirm("Mevcut gizli anahtar görünmez hale gelir. Üretmek istiyor musunuz?")) return;
  store.set(KEYS, makeKeys());
  renderKeys();
  $("#keyMsg").className = "msg ok";
  $("#keyMsg").textContent = "Anahtar çifti tarayıcıda saklandı.";
});
$("#rotateKeys")?.addEventListener("click", () => {
  store.set(KEYS, makeKeys());
  renderKeys();
  $("#keyMsg").className = "msg ok";
  $("#keyMsg").textContent = "Anahtarlar yenilendi.";
});
$("#copyKeys")?.addEventListener("click", async () => {
  const k = store.get(KEYS, null);
  if (!k) return;
  await navigator.clipboard.writeText("API_KEY=" + k.apiKey + "\nSECRET_KEY=" + k.secretKey);
  $("#keyMsg").className = "msg ok";
  $("#keyMsg").textContent = "Panoya kopyalandı.";
});

function renderMarkets() {
  if (!$("#marketGrid")) return;
  const saved = store.get(MARK, {});
  $("#marketGrid").innerHTML = MARKETS.map((m) => {
    const row = saved[m.id] || {};
    const on = row.apiKey && row.secretKey;
    return `<article class="card" data-market="${m.id}">
      <h3>${m.name} ${on ? '<span class="badge ok">bağlı</span>' : '<span class="badge off">kapalı</span>'}</h3>
      <p class="hint">${m.hint}</p>
      <label class="field">API anahtarı<input data-k="apiKey" value="${row.apiKey || ""}" autocomplete="off" /></label>
      <label class="field">Gizli anahtar<input data-k="secretKey" type="password" value="${row.secretKey || ""}" autocomplete="off" /></label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="primary" type="button" data-save>Kaydet ve bağla</button>
        <button class="secondary" type="button" data-sync>Sipariş çek</button>
      </div>
      <p class="msg" data-mmsg></p>
    </article>`;
  }).join("");
}

$("#marketGrid")?.addEventListener("click", async (e) => {
  const card = e.target.closest("[data-market]");
  if (!card) return;
  const id = card.dataset.market;
  const saved = store.get(MARK, {});
  const apiKey = card.querySelector('[data-k="apiKey"]').value.trim();
  const secretKey = card.querySelector('[data-k="secretKey"]').value.trim();
  const msg = card.querySelector("[data-mmsg]");
  if (e.target.matches("[data-save]")) {
    if (!apiKey || !secretKey) {
      msg.className = "msg err";
      msg.textContent = "API anahtarı ve gizli anahtar zorunlu.";
      return;
    }
    saved[id] = { apiKey, secretKey, at: new Date().toISOString() };
    store.set(MARK, saved);
    msg.className = "msg ok";
    msg.textContent = "Bağlandı.";
    renderMarkets();
  }
  if (e.target.matches("[data-sync]")) {
    if (!saved[id]) {
      msg.className = "msg err";
      msg.textContent = "Önce anahtarları kaydedin.";
      return;
    }
    const row = await createShip({
      kind: "out",
      sender: MARKETS.find((m) => m.id === id).name,
      receiver: "Pazaryeri alıcısı",
      fromCity: "İstanbul",
      toCity: CITIES[Math.floor(Math.random() * CITIES.length)],
      phone: "05000000000",
      address: "Pazaryeri teslimat adresi",
      kg: 1,
      desi: 1,
      service: "standart",
      payment: "gonderici",
      market: id,
    });
    const orders = store.get(ORDERS, []);
    orders.unshift({ market: id, orderNo: sendCodeOf(row), toCity: row.toCity, at: row.createdAt });
    store.set(ORDERS, orders);
    msg.className = "msg ok";
    msg.textContent = "Sipariş gönderim kodu: " + sendCodeOf(row);
  }
});

let nfcAbort = null;

function nfcOk() {
  return "NDEFReader" in window;
}

function stopNfc() {
  try {
    nfcAbort?.abort();
  } catch {
    /* ignore */
  }
  nfcAbort = null;
  $("#posStage")?.classList.remove("listening");
  if ($("#posStageTitle")) $("#posStageTitle").textContent = "Tarama kapalı";
}

$("#posStop")?.addEventListener("click", stopNfc);

function savePos(row) {
  const list = store.get(POS, []);
  list.unshift(row);
  store.set(POS, list.slice(0, 50));
  renderPosLog();
}

function renderPosLog() {
  if (!$("#posLog")) return;
  const list = store.get(POS, []);
  const pays = payouts();
  const rows = list.length
    ? `<table><thead><tr><th>Fiş</th><th>Tutar</th><th>IBAN</th></tr></thead><tbody>${list
        .map((p) => {
          const ib = p.settleIban ? ibanFormat(p.settleIban) : "-";
          return `<tr><td>${p.receiptNo}</td><td>${Number(p.amount).toLocaleString("tr-TR", {
            style: "currency",
            currency: "TRY",
          })}</td><td style="font-size:0.65rem">${ib}</td></tr>`;
        })
        .join("")}</tbody></table>`
    : '<p class="hint">Henüz tahsilat yok.</p>';
  const payRows = pays.length
    ? `<p class="hint" style="margin-top:10px">Aktarım kayıtları</p><div class="mob-list">${pays
        .slice(0, 8)
        .map(
          (p) =>
            `<div class="mob-item"><div><strong>${Number(p.amount).toLocaleString("tr-TR", {
              style: "currency",
              currency: "TRY",
            })} · ${p.receiptNo || ""}</strong><div class="meta">${ibanFormat(p.iban)}<br>${p.status || "aktarım kaydı"}</div></div><span></span></div>`
        )
        .join("")}</div>`
    : "";
  $("#posLog").innerHTML = rows + payRows;
}

function showReceipt(p) {
  const el = $("#posReceipt");
  if (!el) return;
  el.classList.remove("hidden");
  el.innerHTML = `<h3>Harbi Kargo POS</h3>
    <p>Fiş ${p.receiptNo}<br>${new Date(p.at).toLocaleString("tr-TR")}<br>
    Tutar ${Number(p.amount).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}<br>
    Gönderim kodu ${p.tracking || "-"}<br>NFC ${p.nfcId}<br>Durum ${p.status}<br>
    IBAN ${p.settleIban ? ibanFormat(p.settleIban) : "—"}</p>`;
}

async function capturePos(nfcId) {
  const amount = Number($("#posAmount").value);
  const settleIban = ibanRaw($("#posSettleIban")?.value || "");
  if ($("#posSettleIban") && !ibanOk(settleIban)) {
    throw new Error("Geçerli TR IBAN yazın (26 hane).");
  }
  const body = {
    action: "nfc-pos",
    amount,
    tracking: String($("#posTrack").value || "").replace(/\D/g, "").slice(0, 4),
    note: $("#posNote").value,
    name: $("#posCourier").value || "Harbi Kurye",
    nfcId,
    checkout: $("#posCheckout")?.checked,
    settleIban,
    email: "pos@harbikargo.test",
    phone: "5550000000",
  };
  let data;
  try {
    const res = await fetch("/kargo-api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    data = await res.json();
  } catch {
    data = {
      ok: true,
      method: "nfc",
      amount,
      nfcId,
      tracking: body.tracking,
      receiptNo: "POS" + Date.now().toString(36).toUpperCase(),
      at: new Date().toISOString(),
      status: "captured-local",
      settleIban,
    };
  }
  if (!data.ok) throw new Error(data.error || "POS reddedildi");
  data.settleIban = data.settleIban || settleIban;
  savePos(data);
  if (data.settleIban) {
    savePayout({
      id: "po_" + Date.now().toString(36),
      amount: data.amount,
      iban: data.settleIban,
      receiptNo: data.receiptNo,
      tracking: data.tracking || "",
      note: body.note || "Kapıda kart ödemesi",
      status: data.paymentPageUrl ? "pos-odeme-bekliyor-iban-aktarim" : "pos-tahsil-iban-aktarim-kaydi",
      at: new Date().toISOString(),
    });
  }
  showReceipt(data);
  store.set(POS_HANDOFF, null);
  if (data.paymentPageUrl) location.href = data.paymentPageUrl;
  $("#posMsg").className = "msg ok";
  $("#posMsg").textContent = data.settleIban
    ? "Tahsilat alındı. IBAN aktarım kaydı: " + ibanFormat(data.settleIban)
    : "Tahsilat alındı. Fiş " + data.receiptNo;
  if (navigator.vibrate) navigator.vibrate([40, 40, 80]);
}

$("#posForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const amount = Number($("#posAmount").value);
  if (!amount || amount < 0.5) {
    $("#posMsg").className = "msg err";
    $("#posMsg").textContent = "En az 0,50 ₺ girin.";
    return;
  }
  if ($("#posSettleIban") && !ibanOk($("#posSettleIban").value)) {
    $("#posMsg").className = "msg err";
    $("#posMsg").textContent = "Aktarılacak IBAN zorunlu (TR + 24 rakam).";
    return;
  }
  $("#posMsg").textContent = "";
  $("#posStage").classList.add("listening");
  $("#posStageTitle").textContent = amount.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
  if (!nfcOk()) {
    $("#posStageHint").textContent =
      "Bu tarayıcıda Web NFC yok. Android Chrome ile kartı yaklaştırın; masaüstünde simülasyon çalışır.";
    const fake = "sim-" + randomPart(4);
    setTimeout(() => {
      capturePos(fake).catch((err) => {
        $("#posMsg").className = "msg err";
        $("#posMsg").textContent = err.message;
      });
      stopNfc();
    }, 1600);
    return;
  }
  $("#posStageHint").textContent = "Kartı veya telefonu arka kapağa değdirin.";
  stopNfc();
  nfcAbort = new AbortController();
  try {
    const reader = new NDEFReader();
    await reader.scan({ signal: nfcAbort.signal });
    reader.onreading = (ev) => {
      const id = ev.serialNumber || (ev.message?.records?.[0] ? "ndef" : "tap") + "-" + Date.now().toString(36);
      capturePos(id)
        .then(stopNfc)
        .catch((err) => {
          $("#posMsg").className = "msg err";
          $("#posMsg").textContent = err.message;
        });
    };
    reader.onreadingerror = () => {
      $("#posMsg").className = "msg err";
      $("#posMsg").textContent = "NFC okunamadı. Etiketi yeniden yaklaştırın.";
    };
  } catch (err) {
    $("#posMsg").className = "msg err";
    $("#posMsg").textContent = "NFC izni veya donanım hatası: " + (err.message || err);
    stopNfc();
  }
});

$("#posSettleIban")?.addEventListener("input", (e) => {
  const el = e.target;
  const caret = el.selectionStart;
  const before = el.value.length;
  el.value = ibanFormat(el.value);
  const delta = el.value.length - before;
  if (typeof caret === "number") el.setSelectionRange(caret + delta, caret + delta);
});

if (PAGE === "nfc") {
  requireBranchAuth();
  const handoff = store.get(POS_HANDOFF, null);
  const q = new URLSearchParams(location.search);
  if ($("#posAmount") && (q.get("amount") || handoff?.amount)) {
    $("#posAmount").value = q.get("amount") || handoff.amount;
  }
  if ($("#posTrack") && (q.get("track") || handoff?.track)) {
    $("#posTrack").value = q.get("track") || handoff.track;
  }
  if ($("#posNote") && (q.get("note") || handoff?.note)) {
    $("#posNote").value = q.get("note") || handoff.note;
  }
  if ($("#posSettleIban") && (q.get("iban") || handoff?.iban)) {
    $("#posSettleIban").value = ibanFormat(q.get("iban") || handoff.iban);
  }
  if ($("#posCheckout") && (q.get("checkout") === "1" || handoff?.checkout)) {
    $("#posCheckout").checked = true;
  }
  if (currentBranch()) renderPosLog();
  if (q.get("auto") === "1" && Number($("#posAmount")?.value) >= 0.5 && ibanOk($("#posSettleIban")?.value)) {
    setTimeout(() => $("#posForm")?.requestSubmit(), 400);
  }
}

function removeShipById(id) {
  store.set(
    SHIPS,
    ships().filter((s) => s.id !== id && String(s.sendCode || s.tracking) !== String(id))
  );
}

function shipKey(s) {
  return s.id || sendCodeOf(s) + "_" + (s.createdAt || "");
}

function setShipKind(key, kind) {
  const list = ships();
  const idx = list.findIndex((s) => shipKey(s) === key || sendCodeOf(s) === key);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], kind, status: kind };
  store.set(SHIPS, list);
  return list[idx];
}

function deleteShipByKey(key) {
  store.set(
    SHIPS,
    ships().filter((s) => shipKey(s) !== key && sendCodeOf(s) !== key)
  );
}

function renderMobList(box, kind, withRemove) {
  if (!box) return;
  const rows = listOf(kind);
  if (!rows.length) {
    box.innerHTML = '<p class="hint">Kayıt yok.</p>';
    return;
  }
  box.innerHTML = rows
    .map((s) => {
      const key = shipKey(s);
      const code = sendCodeOf(s);
      const x = withRemove
        ? `<button type="button" class="mob-x" data-out="${key}" aria-label="Zimmetten çıkar">×</button>`
        : `<span></span>`;
      return `<div class="mob-item">
        <div>
          <strong>${code} · ${s.phone || "—"}</strong>
          <div class="meta">${s.address || "Adres yok"}</div>
        </div>
        ${x}
      </div>`;
    })
    .join("");
}

function renderMobGroups() {
  const box = $("#mobGroups");
  if (!box) return;
  box.innerHTML = BUCKETS.map((b) => {
    const n = listOf(b.id).length;
    return `<div class="mob-group"><span>${b.title}</span><b>${n}</b></div>`;
  }).join("");
}

function renderMobPayouts() {
  const box = $("#mobPayoutLog");
  if (!box) return;
  const pays = payouts();
  if (!pays.length) {
    box.innerHTML = '<p class="hint">Henüz aktarım yok.</p>';
    return;
  }
  box.innerHTML = pays
    .slice(0, 12)
    .map(
      (p) =>
        `<div class="mob-item"><div><strong>${Number(p.amount).toLocaleString("tr-TR", {
          style: "currency",
          currency: "TRY",
        })}</strong><div class="meta">${ibanFormat(p.iban)} · ${p.receiptNo || ""}<br>${p.status || ""}</div></div><span></span></div>`
    )
    .join("");
}

function refreshMobileLists() {
  renderMobList($("#mobCustodyList"), "custody", true);
  renderMobList($("#mobBadAddr"), "bad_address", false);
  renderMobList($("#mobBadPhone"), "bad_phone", false);
  renderMobGroups();
  renderMobPayouts();
}

function updateMobPrices() {
  if ($("#msPrice") && $("#msFrom") && $("#msKg")) {
    const q = quotePrice($("#msFrom").value, $("#msTo").value, $("#msKg").value, $("#msDesi").value);
    $("#msPrice").textContent = formatTry(q.total);
  }
  if ($("#pqPrice") && $("#pqFrom")) {
    const q = quotePrice($("#pqFrom").value, $("#pqTo").value, $("#pqKg").value, $("#pqDesi").value);
    $("#pqPrice").textContent = formatTry(q.total);
    if ($("#pqHint")) {
      $("#pqHint").textContent =
        "Ücretlendirilen ağırlık: " + q.weight + " · Bölge: " + q.zone + " (max kilo/desi)";
    }
  }
}

let mobCamStream = null;
let mobScanTimer = null;

async function stopMobCam() {
  if (mobScanTimer) {
    clearInterval(mobScanTimer);
    mobScanTimer = null;
  }
  mobCamStream?.getTracks()?.forEach((t) => t.stop());
  mobCamStream = null;
  const v = $("#mobCamVideo");
  if (v) v.srcObject = null;
  if ($("#mobCamCapture")) $("#mobCamCapture").disabled = true;
  if ($("#mobCamStop")) $("#mobCamStop").disabled = true;
}

async function startMobCam() {
  const msg = $("#mobCamMsg");
  try {
    await stopMobCam();
    mobCamStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    const v = $("#mobCamVideo");
    v.srcObject = mobCamStream;
    await v.play();
    $("#mobCamCapture").disabled = false;
    $("#mobCamStop").disabled = false;
    msg.className = "msg ok";
    msg.textContent = "Kamera açık. Barkod varsa otomatik okunur; yoksa kodu yazın.";
    if ("BarcodeDetector" in window) {
      const detector = new BarcodeDetector({ formats: ["qr_code", "ean_13", "code_128", "code_39"] });
      mobScanTimer = setInterval(async () => {
        try {
          const codes = await detector.detect(v);
          if (!codes?.length) return;
          const raw = String(codes[0].rawValue || "").replace(/\D/g, "");
          const four = raw.slice(-4);
          if (four.length === 4 && $("#mobCode")) {
            $("#mobCode").value = four;
            msg.className = "msg ok";
            msg.textContent = "Kod okundu: " + four;
          }
        } catch {
          /* ignore frame errors */
        }
      }, 700);
    }
  } catch (err) {
    msg.className = "msg err";
    msg.textContent = "Kamera açılamadı: " + (err.message || err);
  }
}

async function captureMobFrame() {
  const v = $("#mobCamVideo");
  const c = $("#mobCamCanvas");
  const msg = $("#mobCamMsg");
  if (!v?.videoWidth) {
    msg.className = "msg err";
    msg.textContent = "Önce kamerayı açın.";
    return;
  }
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext("2d").drawImage(v, 0, 0);
  if ("BarcodeDetector" in window) {
    try {
      const detector = new BarcodeDetector({ formats: ["qr_code", "ean_13", "code_128", "code_39"] });
      const codes = await detector.detect(c);
      if (codes?.length) {
        const raw = String(codes[0].rawValue || "").replace(/\D/g, "");
        const four = raw.slice(-4) || raw.slice(0, 4);
        if (four) $("#mobCode").value = four.slice(0, 4);
        msg.className = "msg ok";
        msg.textContent = "Okundu. Telefon ve adresi tamamlayıp ekleyin.";
        return;
      }
    } catch {
      /* fallthrough */
    }
  }
  msg.className = "msg ok";
  msg.textContent = "Kare alındı. Gönderim kodunu yazıp zimmete ekleyin.";
}

(function initMobilePage() {
  if (PAGE !== "mobile") return;
  const user = requireBranchAuth();

  $("#mobLoginShowPass")?.addEventListener("click", () => hkTogglePass("#mobLoginPass", "#mobLoginShowPass"));
  fillHkLoginRemember();

  $("#mobLoginForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const u = $("#mobLoginUser").value;
    const p = String($("#mobLoginPass").value || "").trim();
    const msg = $("#mobLoginMsg");
    const hit = findHkLogin(u, p);
    if (!hit) {
      msg.className = "msg err";
      msg.textContent = "Yetkisiz giriş.";
      return;
    }
    if (hit.role === "courier") {
      hkRememberSave(normalizeHkUser(u), p, $("#mobLoginRemember")?.checked !== false);
      setSession("courier", hit.account.id);
      msg.className = "msg ok";
      msg.textContent = "Kurye hesabı · Harbi Kurye açılıyor…";
      goCourierApp();
      return;
    }
    hkRememberSave(normalizeHkUser(u), p, $("#mobLoginRemember")?.checked !== false);
    setSession("branch", hit.account.id);
    requireBranchAuth();
    refreshMobileLists();
    updateMobPrices();
  });

  if (!user) return;

  fillCities($("#msFrom"), user.city || "İstanbul");
  fillCities($("#msTo"), "İstanbul");
  fillCities($("#pqFrom"), user.city || "İstanbul");
  fillCities($("#pqTo"), "Ankara");
  if ($("#mrMarket")) {
    $("#mrMarket").innerHTML = MARKETS.map((m) => `<option value="${m.id}">${m.name}</option>`).join("");
  }
  refreshMobileLists();
  updateMobPrices();

  $("#mobLogout")?.addEventListener("click", async () => {
    await stopMobCam();
    clearSession();
    location.reload();
  });

  $("#mobCamStart")?.addEventListener("click", () => startMobCam());
  $("#mobCamStop")?.addEventListener("click", () => stopMobCam());
  $("#mobCamCapture")?.addEventListener("click", () => captureMobFrame());
  window.addEventListener("pagehide", () => stopMobCam());

  $("#mobCustodyForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#mobCustodyMsg");
    let code = $("#mobCode").value.replace(/\D/g, "").slice(0, 4);
    const phone = $("#mobPhone").value.trim();
    const address = $("#mobAddress").value.trim();
    const kind = $("#mobKind").value;
    if (!phone || !address) {
      msg.className = "msg err";
      msg.textContent = "Telefon ve adres zorunlu.";
      return;
    }
    if (code.length !== 4) code = uniqueSendCode();
    const existing = ships().find((s) => sendCodeOf(s) === code);
    if (existing) {
      setShipKind(shipKey(existing), kind);
      existing.phone = phone;
      existing.address = address;
      const list = ships();
      const i = list.findIndex((s) => sendCodeOf(s) === code);
      if (i >= 0) {
        list[i] = { ...list[i], phone, address, kind, status: kind };
        store.set(SHIPS, list);
      }
      msg.className = "msg ok";
      msg.textContent = "Güncellendi · " + code;
    } else {
      const row = await createShip({
        kind,
        sender: "Mobil zimmet",
        receiver: user.branchName || "Şube",
        fromCity: user.city || "İstanbul",
        toCity: user.city || "İstanbul",
        phone,
        address,
        kg: 1,
        desi: 1,
        service: "standart",
        payment: "gonderici",
        sendCode: code,
        tracking: code,
        branchId: user.id,
      });
      // ensure code
      const list = ships();
      const i = list.findIndex((s) => s === row || sendCodeOf(s) === sendCodeOf(row));
      if (i >= 0) {
        list[i] = { ...list[i], sendCode: code, tracking: code, kind };
        store.set(SHIPS, list);
      }
      msg.className = "msg ok";
      msg.textContent = "Eklendi · " + code;
    }
    $("#mobCustodyForm").reset();
    $("#mobKind").value = "custody";
    refreshMobileLists();
  });

  $("#mobCustodyList")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-out]");
    if (!btn) return;
    deleteShipByKey(btn.getAttribute("data-out"));
    refreshMobileLists();
  });

  ["msKg", "msDesi", "msFrom", "msTo", "pqKg", "pqDesi", "pqFrom", "pqTo"].forEach((id) => {
    $("#" + id)?.addEventListener("input", updateMobPrices);
    $("#" + id)?.addEventListener("change", updateMobPrices);
  });

  $("#mobSendForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#msMsg");
    const q = quotePrice($("#msFrom").value, $("#msTo").value, $("#msKg").value, $("#msDesi").value);
    const row = await createShip({
      kind: "custody",
      sender: $("#msSender").value.trim(),
      receiver: $("#msReceiver").value.trim(),
      phone: $("#msPhone").value.trim(),
      address: $("#msAddress").value.trim(),
      fromCity: $("#msFrom").value,
      toCity: $("#msTo").value,
      kg: Number($("#msKg").value) || 1,
      desi: Number($("#msDesi").value) || 1,
      service: "standart",
      payment: "gonderici",
      price: q.total,
      branchId: user.id,
      branchName: user.branchName,
    });
    msg.className = "msg ok";
    msg.textContent = "Gönderi oluşturuldu · " + formatTry(q.total);
    $("#msCode").hidden = false;
    $("#msCode").textContent = "Kod: " + sendCodeOf(row);
    $("#mobSendForm").reset();
    fillCities($("#msFrom"), user.city || "İstanbul");
    fillCities($("#msTo"), "İstanbul");
    $("#msKg").value = "1";
    $("#msDesi").value = "1";
    updateMobPrices();
    refreshMobileLists();
  });

  $("#mobReturnForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#mrMsg");
    const market = $("#mrMarket").value;
    const orderNo = $("#mrOrder").value.trim();
    const phone = $("#mrPhone").value.trim();
    const address = $("#mrAddress").value.trim();
    const row = await createShip({
      kind: "return",
      sender: marketName(market) + " iade",
      receiver: user.branchName || "Harbi Kargo",
      fromCity: user.city || "İstanbul",
      toCity: user.city || "İstanbul",
      phone,
      address,
      kg: 1,
      desi: 1,
      service: "standart",
      payment: "gonderici",
      market,
      orderNo,
      branchId: user.id,
    });
    const list = returnsList();
    list.unshift({
      id: "rt_" + Date.now().toString(36),
      market,
      orderNo,
      phone,
      address,
      sendCode: sendCodeOf(row),
      at: new Date().toISOString(),
    });
    store.set(RETURNS, list.slice(0, 100));
    msg.className = "msg ok";
    msg.textContent = "İade kabul · " + sendCodeOf(row);
    $("#mobReturnForm").reset();
    $("#mrMarket").innerHTML = MARKETS.map((m) => `<option value="${m.id}">${m.name}</option>`).join("");
    refreshMobileLists();
  });

  $("#mpIban")?.addEventListener("input", (e) => {
    const el = e.target;
    el.value = ibanFormat(el.value);
  });

  $("#mobPayForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = $("#mpMsg");
    const amount = Number($("#mpAmount").value);
    const track = String($("#mpTrack").value || "").replace(/\D/g, "").slice(0, 4);
    const iban = ibanRaw($("#mpIban").value);
    const note = ($("#mpNote").value || "Kapıda kart ödemesi").trim();
    if (!amount || amount < 0.5) {
      msg.className = "msg err";
      msg.textContent = "En az 0,50 ₺ girin.";
      return;
    }
    if (!ibanOk(iban)) {
      msg.className = "msg err";
      msg.textContent = "Geçerli TR IBAN yazın (TR + 24 rakam).";
      return;
    }
    store.set(POS_HANDOFF, {
      amount,
      track,
      iban,
      note,
      checkout: true,
      at: new Date().toISOString(),
    });
    msg.className = "msg ok";
    msg.textContent = "POS açılıyor…";
    const qs = new URLSearchParams({
      amount: String(amount),
      track,
      iban,
      note,
      checkout: "1",
      auto: "1",
    });
    location.href = "kargo-nfc.html?" + qs.toString();
  });
})();

function activeCourier() {
  return currentCourier() || (() => {
    const id = store.get(COURIER_ACTIVE, null);
    if (!id) return null;
    return couriers().find((c) => c.id === id) || null;
  })();
}

function usernameTaken(u, exceptId) {
  const n = normalizeHkUser(u);
  if (branches().some((b) => normalizeHkUser(b.username) === n)) return true;
  if (couriers().some((c) => c.id !== exceptId && normalizeHkUser(c.username) === n)) return true;
  return false;
}

function createCourierAccount(fields, branch) {
  const username = normalizeHkUser(fields.username);
  const password = String(fields.password || "").trim();
  if (!fields.name || !fields.phone) throw new Error("Ad ve telefon zorunlu.");
  if (!username || username.length < 3) throw new Error("Kullanıcı adı en az 3 karakter.");
  if (password.length < 6) throw new Error("Şifre en az 6 karakter.");
  if (usernameTaken(username)) throw new Error("Bu kullanıcı adı kullanılıyor.");
  const row = {
    id: "ky_" + Date.now().toString(36),
    name: fields.name.trim(),
    phone: fields.phone.trim(),
    plate: (fields.plate || "").trim(),
    username,
    password,
    branchId: branch.id,
    role: "courier",
    at: new Date().toISOString(),
  };
  const list = couriers();
  list.unshift(row);
  saveCouriers(list.slice(0, 80));
  return row;
}

function renderPanelCouriers() {
  const box = $("#panelCourierList");
  if (!box) return;
  const user = currentBranch();
  if (!user) return;
  seedDemoCourier();
  const mine = couriers().filter((c) => c.branchId === user.id || (user.role === "demo" && c.branchId === "br_demo"));
  if (!mine.length) {
    box.innerHTML = '<p class="hint">Henüz kurye yok.</p>';
    return;
  }
  box.innerHTML = mine
    .map(
      (c) =>
        `<div class="partner-app"><strong>${c.name}</strong><div class="meta">${c.phone}${c.plate ? " · " + c.plate : ""}</div><div class="cred">Kullanıcı: ${c.username}<br>Şifre: ${c.password}</div><button type="button" class="btn-no" data-del-courier="${c.id}">Sil</button></div>`
    )
    .join("");
}

function patchShip(key, patch) {
  const list = ships();
  const idx = list.findIndex((s) => shipKey(s) === key || sendCodeOf(s) === key);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch };
  store.set(SHIPS, list);
  return list[idx];
}

function renderCourierBadge() {
  const el = $("#kyActiveBadge");
  if (!el) return;
  const c = activeCourier();
  el.className = "ky-badge" + (c ? " on" : "");
  if (!c) {
    el.textContent = "Oturum yok";
    return;
  }
  const br = branches().find((b) => b.id === c.branchId);
  el.textContent =
    c.name +
    (c.plate ? " · " + c.plate : "") +
    " · " +
    c.phone +
    (br ? " · " + br.branchName : "") +
    " · @" +
    c.username;
}

const KY_ROUTE = "hk-courier-route";
const KY_CUSTODY = "hk-courier-custody";
const KY_DELIVERED = "hk-courier-delivered";
const KY_FAILED = "hk-courier-failed";
const KY_DELIVERY_LOG = "hk-courier-delivery-log";
const KY_DEPOT = { lat: 41.0602, lng: 28.9497, name: "Harbi Merkez" };
const KY_PAY_NORMAL = 25;
const KY_PAY_CODE_EXTRA = 5;

const KY_SYMBOLIC_ZIMMET = [
  { code: "4801", receiver: "Ayşe Demir", address: "Kadıköy Caferağa Mah. No:12", phone: "0532 111 22 01", lat: 40.9901, lng: 29.0292, teslimCode: "1804" },
  { code: "4802", receiver: "Mehmet Kara", address: "Üsküdar Altunizade Cad. 45", phone: "0532 111 22 02", lat: 41.0214, lng: 29.0394, teslimCode: "2084" },
  { code: "4803", receiver: "Elif Yılmaz", address: "Beşiktaş Levent Mah. 8", phone: "0532 111 22 03", lat: 41.0815, lng: 29.0116, teslimCode: "3084" },
  { code: "4804", receiver: "Can Öztürk", address: "Şişli Nişantaşı Sok. 3", phone: "0532 111 22 04", lat: 41.0485, lng: 28.9942, teslimCode: "4084" },
  { code: "4805", receiver: "Zeynep Aydın", address: "Bakırköy Ataköy 7-8. Kısım", phone: "0532 111 22 05", lat: 40.9794, lng: 28.8558, teslimCode: "5084" },
  { code: "4806", receiver: "Burak Şen", address: "Maltepe Bağlarbaşı Cad. 19", phone: "0532 111 22 06", lat: 40.9352, lng: 29.1312, teslimCode: "6084" },
  { code: "4807", receiver: "Selin Ak", address: "Kartal Soğanlık Mah. 22", phone: "0532 111 22 07", lat: 40.9112, lng: 29.1894, teslimCode: "7084" },
  { code: "4808", receiver: "Hakan Öz", address: "Pendik Kaynarca Mah. 14", phone: "0532 111 22 08", lat: 40.8776, lng: 29.2331, teslimCode: "8084" },
  { code: "4809", receiver: "Ece Kaya", address: "Ataşehir Barbaros Mah. 6", phone: "0532 111 22 09", lat: 40.9833, lng: 29.1167, teslimCode: "9084" },
  { code: "4810", receiver: "Emre Çelik", address: "Beylikdüzü Cumhuriyet Cad. 31", phone: "0532 111 22 10", lat: 41.0022, lng: 28.6414, teslimCode: "0184" },
  { code: "4811", receiver: "Deniz Arslan", address: "Sarıyer İstinye Mah. 9", phone: "0532 111 22 11", lat: 41.1136, lng: 29.0503, teslimCode: "1184" },
  { code: "4812", receiver: "Gülşen Tekin", address: "Fatih Aksaray Cad. 17", phone: "0532 111 22 12", lat: 41.0106, lng: 28.9525, teslimCode: "2184" },
];

let kyRouteMode = "auto";
let kyRouteOrder = [];
let kyDeliverOpen = "";

function kyCustodyList() {
  return store.get(KY_CUSTODY, null);
}

function kyCustodySet() {
  const saved = kyCustodyList();
  if (Array.isArray(saved)) return new Set(saved);
  return new Set();
}

function kySaveCustody(codes) {
  store.set(KY_CUSTODY, codes.slice());
}

function kyZimmetAl(code) {
  const done = kyDeliveredSet();
  if (done.has(code)) return false;
  const set = kyCustodySet();
  set.add(code);
  const codes = [...set];
  kySaveCustody(codes);
  if (!kyRouteOrder.includes(code)) kyRouteOrder.push(code);
  kySaveRoute();
  return true;
}

function kyZimmetBirak(code) {
  const set = kyCustodySet();
  set.delete(code);
  kySaveCustody([...set]);
  kyRouteOrder = kyRouteOrder.filter((c) => c !== code);
  if (kyDeliverOpen === code) kyDeliverOpen = "";
  kySaveRoute();
  return true;
}

function kyPoolRows() {
  const done = kyDeliveredSet();
  const failed = kyFailedCodes();
  const custody = kyCustodySet();
  return KY_SYMBOLIC_ZIMMET.filter(
    (r) => !done.has(r.code) && !failed.has(r.code) && !custody.has(r.code)
  );
}

function kyDeliveredSet() {
  return new Set(store.get(KY_DELIVERED, []));
}

function kyDeliveryLog() {
  return store.get(KY_DELIVERY_LOG, []);
}

function kyPayFor(method) {
  return method === "code" ? KY_PAY_NORMAL + KY_PAY_CODE_EXTRA : KY_PAY_NORMAL;
}

function kyMarkDeliveredSymbolic(code, opts) {
  const method = opts.method === "code" ? "code" : "normal";
  const pay = kyPayFor(method);
  const list = store.get(KY_DELIVERED, []);
  if (!list.includes(code)) list.unshift(code);
  store.set(KY_DELIVERED, list.slice(0, 80));
  const custody = kyCustodySet();
  custody.delete(code);
  kySaveCustody([...custody]);
  kyRouteOrder = kyRouteOrder.filter((c) => c !== code);
  const log = kyDeliveryLog();
  log.unshift({
    code,
    method,
    entered: opts.entered || "",
    pay,
    payLabel: method === "code" ? "Kod ile · +" + KY_PAY_CODE_EXTRA + " ₺ fark" : "Normal ödeme",
    at: new Date().toISOString(),
  });
  store.set(KY_DELIVERY_LOG, log.slice(0, 80));
  return { method, pay };
}

function kyFailedLog() {
  return store.get(KY_FAILED, []);
}

function kyFailedCodes() {
  return new Set(kyFailedLog().map((r) => r.code));
}

function kyMarkFailedSymbolic(code, reasonId) {
  if (!KY_FAIL_IDS.has(reasonId)) return null;
  const custody = kyCustodySet();
  custody.delete(code);
  kySaveCustody([...custody]);
  kyRouteOrder = kyRouteOrder.filter((c) => c !== code);
  if (kyDeliverOpen === code) kyDeliverOpen = "";
  const log = kyFailedLog().filter((r) => r.code !== code);
  log.unshift({
    code,
    reason: reasonId,
    reasonLabel: failReasonLabel(reasonId),
    at: new Date().toISOString(),
  });
  store.set(KY_FAILED, log.slice(0, 80));
  return { reason: reasonId, reasonLabel: failReasonLabel(reasonId) };
}

function renderKyFailedList() {
  const box = $("#kyFailedList");
  if (!box) return;
  const rows = kyFailedLog();
  if (!rows.length) {
    box.innerHTML = '<p class="hint">Henüz teslim edilemeyen kargo yok.</p>';
    return;
  }
  box.innerHTML = rows
    .slice(0, 30)
    .map((r) => {
      return `<div class="ky-fail-row">
        <strong>${r.code}</strong>
        <span>${r.reasonLabel || failReasonLabel(r.reason)}</span>
      </div>`;
    })
    .join("");
}

function kyCodeDeliverCount() {
  return kyDeliveryLog().filter((r) => r.method === "code").length;
}

function kyNormalDeliverCount() {
  return kyDeliveryLog().filter((r) => r.method === "normal").length;
}

function kyPayTotals() {
  return kyDeliveryLog().reduce(
    (acc, r) => {
      const pay = Number(r.pay) || kyPayFor(r.method);
      acc.total += pay;
      if (r.method === "code") acc.codePay += pay;
      else acc.normalPay += pay;
      return acc;
    },
    { total: 0, codePay: 0, normalPay: 0 }
  );
}

function renderKyPaySummary() {
  const stats = $("#kyPayStats");
  const list = $("#kyCodeDeliveredList");
  if (!stats) return;
  const codeN = kyCodeDeliverCount();
  const normalN = kyNormalDeliverCount();
  const pays = kyPayTotals();
  stats.innerHTML = `
    <div class="ky-stat on"><b>${codeN}</b><span>Kod ile teslim</span><small>${KY_PAY_NORMAL + KY_PAY_CODE_EXTRA} ₺ / kargo (+${KY_PAY_CODE_EXTRA} ₺ fark)</small></div>
    <div class="ky-stat"><b>${normalN}</b><span>Normal teslim</span><small>${KY_PAY_NORMAL} ₺ / kargo</small></div>
    <div class="ky-stat"><b>${pays.total.toLocaleString("tr-TR")} ₺</b><span>Toplam kurye ödemesi</span><small>Kod: ${pays.codePay.toLocaleString("tr-TR")} ₺ · Normal: ${pays.normalPay.toLocaleString("tr-TR")} ₺</small></div>`;
  if (!list) return;
  const codeRows = kyDeliveryLog().filter((r) => r.method === "code");
  list.innerHTML = codeRows.length
    ? codeRows
        .slice(0, 20)
        .map((r) => {
          return `<div class="ky-code-row"><strong>${r.code}</strong><span>+${KY_PAY_CODE_EXTRA} ₺ fark · ${r.pay} ₺</span></div>`;
        })
        .join("")
    : '<p class="hint">Henüz kod ile teslim yok.</p>';
}

function kyRouteState() {
  return store.get(KY_ROUTE, { mode: "auto", order: KY_SYMBOLIC_ZIMMET.map((r) => r.code) });
}

function kySaveRoute() {
  store.set(KY_ROUTE, { mode: kyRouteMode, order: kyRouteOrder.slice() });
}

function kyDistKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function kyAutoRouteOrder(items) {
  const left = items.slice();
  const ordered = [];
  let cur = KY_DEPOT;
  while (left.length) {
    let best = 0;
    let bestD = Infinity;
    left.forEach((row, i) => {
      const d = kyDistKm(cur, row);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    const next = left.splice(best, 1)[0];
    ordered.push(next.code);
    cur = next;
  }
  return ordered;
}

function kyRouteKm(order) {
  const byCode = Object.fromEntries(KY_SYMBOLIC_ZIMMET.map((r) => [r.code, r]));
  let cur = KY_DEPOT;
  let total = 0;
  order.forEach((code) => {
    const row = byCode[code];
    if (!row) return;
    total += kyDistKm(cur, row);
    cur = row;
  });
  return total;
}

function kyOrderedRows() {
  const done = kyDeliveredSet();
  const failed = kyFailedCodes();
  const custody = kyCustodySet();
  const byCode = Object.fromEntries(KY_SYMBOLIC_ZIMMET.map((r) => [r.code, r]));
  const seen = new Set();
  const rows = [];
  kyRouteOrder.forEach((code) => {
    if (byCode[code] && custody.has(code) && !seen.has(code) && !done.has(code) && !failed.has(code)) {
      rows.push(byCode[code]);
      seen.add(code);
    }
  });
  KY_SYMBOLIC_ZIMMET.forEach((r) => {
    if (custody.has(r.code) && !seen.has(r.code) && !done.has(r.code) && !failed.has(r.code)) rows.push(r);
  });
  return rows;
}

function setKyRouteMsg(text, ok) {
  const msg = $("#kyRouteMsg");
  if (!msg) return;
  msg.className = "msg " + (ok ? "ok" : "err");
  msg.textContent = text || "";
}

function kyTelHref(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  const n = d.startsWith("90") ? d : d.startsWith("0") ? "90" + d.slice(1) : "90" + d;
  return "tel:+" + n;
}

function kyMatchCodeFromScan(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const known = KY_SYMBOLIC_ZIMMET.map((r) => r.code);
  for (const c of known) {
    if (digits === c || digits.endsWith(c) || digits.includes(c)) return c;
  }
  if (digits.length >= 4) {
    const four = digits.slice(-4);
    if (known.includes(four)) return four;
  }
  return digits.slice(0, 8);
}

function kyFindSymbolic(code) {
  return KY_SYMBOLIC_ZIMMET.find((r) => r.code === code) || null;
}

function setKyTab(name) {
  $$(".ky-tab").forEach((b) => b.classList.toggle("on", b.dataset.kyTab === name));
  $$("[data-ky-panel]").forEach((p) => {
    const on = p.dataset.kyPanel === name;
    p.classList.toggle("on", on);
    p.hidden = !on;
  });
  if (name !== "scan") stopKyCam();
}

function setKyScanMode(mode) {
  kyScanMode = mode === "teslim" ? "teslim" : "zimmet";
  $$(".ky-scan-mode").forEach((b) => b.classList.toggle("on", b.dataset.scanMode === kyScanMode));
  const msg = $("#kyCamMsg");
  if (msg && !msg.textContent) {
    msg.className = "msg";
    msg.textContent =
      kyScanMode === "teslim"
        ? "Teslim için barkodu okutun · ardından müşteriyi arayıp kodu alın."
        : "Zimmete almak için barkodu okutun.";
  }
}

function setKyCamMsg(text, ok) {
  const msg = $("#kyCamMsg");
  if (!msg) return;
  msg.className = "msg " + (ok ? "ok" : "err");
  msg.textContent = text || "";
}

let kyCamStream = null;
let kyScanTimer = null;
let kyScanMode = "zimmet";
let kyLastScanAt = 0;
let kyLastScanCode = "";

async function stopKyCam() {
  if (kyScanTimer) {
    clearInterval(kyScanTimer);
    kyScanTimer = null;
  }
  kyCamStream?.getTracks()?.forEach((t) => t.stop());
  kyCamStream = null;
  const v = $("#kyCamVideo");
  if (v) v.srcObject = null;
  if ($("#kyCamStop")) $("#kyCamStop").disabled = true;
}

async function startKyCam() {
  try {
    await stopKyCam();
    if (!navigator.mediaDevices?.getUserMedia) {
      setKyCamMsg("Bu tarayıcı kamerayı desteklemiyor.", false);
      return;
    }
    kyCamStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    const v = $("#kyCamVideo");
    v.srcObject = kyCamStream;
    await v.play();
    if ($("#kyCamStop")) $("#kyCamStop").disabled = false;
    setKyCamMsg("Kamera açık · barkodu çerçeveye tutun.", true);
    if ("BarcodeDetector" in window) {
      const detector = new BarcodeDetector({ formats: ["qr_code", "ean_13", "code_128", "code_39"] });
      kyScanTimer = setInterval(async () => {
        try {
          if (!v.videoWidth) return;
          const codes = await detector.detect(v);
          if (!codes?.length) return;
          const code = kyMatchCodeFromScan(codes[0].rawValue);
          if (code) kyHandleScannedCode(code);
        } catch {
          /* frame ignore */
        }
      }, 650);
    } else {
      setKyCamMsg("Otomatik barkod yok · kodu elle yazın.", true);
    }
  } catch (err) {
    setKyCamMsg("Kamera açılamadı: " + (err.message || err), false);
  }
}

function kyRefreshAutoRoute() {
  kyRouteMode = "auto";
  kyRouteOrder = kyAutoRouteOrder(kyOrderedRows());
  kySaveRoute();
}

function kyHandleScannedCode(code) {
  const now = Date.now();
  if (kyLastScanCode === code && now - kyLastScanAt < 1800) return;
  kyLastScanCode = code;
  kyLastScanAt = now;
  if ($("#kyManualCode")) $("#kyManualCode").value = code;

  const row = kyFindSymbolic(code);
  if (!row) {
    setKyCamMsg("Bilinmeyen barkod: " + code, false);
    setKyRouteMsg("Bilinmeyen barkod: " + code, false);
    return;
  }

  if (kyScanMode === "zimmet") {
    if (kyDeliveredSet().has(code)) {
      setKyCamMsg(code + " zaten teslim edilmiş.", false);
      return;
    }
    if (kyFailedCodes().has(code)) {
      setKyCamMsg(code + " teslim edilemedi listesinde.", false);
      return;
    }
    if (kyCustodySet().has(code)) {
      setKyCamMsg(code + " zaten zimmette.", true);
      return;
    }
    kyZimmetAl(code);
    kyRefreshAutoRoute();
    renderSymbolicZimmet();
    setKyCamMsg(code + " zimmete alındı · rota güncellendi.", true);
    setKyRouteMsg(code + " zimmete alındı · " + kyOrderedRows().length + " durak", true);
    return;
  }

  if (!kyCustodySet().has(code)) {
    setKyCamMsg(code + " zimmetinizde değil · önce zimmete alın.", false);
    return;
  }
  kyDeliverOpen = code;
  setKyTab("route");
  renderSymbolicZimmet();
  setKyCamMsg(code + " teslim için açıldı · müşteriyi arayıp kodu alın.", true);
  setKyRouteMsg(code + " · müşteriyi arayın, teslim kodunu girin", true);
}

function renderSymbolicZimmet() {
  const box = $("#kyZimmetList");
  if (!box) return;
  const rows = kyOrderedRows();
  const meta = $("#kyRouteMeta");
  if (meta) {
    const km = kyRouteKm(kyRouteOrder);
    meta.textContent = rows.length + " durak · ~" + km.toFixed(1) + " km";
  }
  if (!rows.length) {
    box.innerHTML =
      '<p class="hint">Zimmet boş. Barkod sekmesinden kargo okutarak zimmete alın.</p>';
  } else {
    box.innerHTML = rows
      .map((row, i) => {
        const open = kyDeliverOpen === row.code;
        const tel = kyTelHref(row.phone);
        const deliverPanel = open
          ? `<div class="ky-inline-deliver">
              <label class="field">Teslim kodu (müşteriden)
                <input data-ky-code-input="${row.code}" inputmode="numeric" maxlength="8" placeholder="Alıcı kodu" autocomplete="off" />
              </label>
              <button type="button" class="orange" data-ky-confirm-code="${row.code}">Kod ile teslim et (+${KY_PAY_CODE_EXTRA} ₺)</button>
              <div class="ky-fail-inline">
                <label class="field">Teslim edilemedi
                  <select data-ky-fail-reason="${row.code}">${kyFailReasonOptions()}</select>
                </label>
                <button type="button" class="secondary" data-ky-fail="${row.code}">Teslim edilemedi kaydet</button>
              </div>
              <button type="button" class="ghost" data-ky-cancel="${row.code}">Vazgeç</button>
            </div>`
          : "";
        return `<article class="ky-zimmet-item${open ? " open" : ""}" data-ky-code="${row.code}">
      <div class="ky-zimmet-num">${i + 1}</div>
      <div class="ky-zimmet-body">
        <strong>${row.code}</strong>
        ${deliverPanel}
      </div>
      <div class="ky-zimmet-side">
        ${tel ? `<a class="ky-side-call" href="${tel}">Müşteri ara</a>` : ""}
        <button type="button" class="ky-side-deliver" data-ky-deliver="${row.code}">${open ? "Kapat" : "Teslim et"}</button>
        <button type="button" class="ky-side-birak" data-ky-birak="${row.code}">Zimmet Bırak</button>
      </div>
    </article>`;
      })
      .join("");
  }
  if (kyDeliverOpen) {
    document.querySelector(`[data-ky-code-input="${kyDeliverOpen}"]`)?.focus();
  }
  renderKyPaySummary();
  renderKyFailedList();
}

(function initCourierPage() {
  if (PAGE !== "courier") return;
  const user = requireBranchAuth();
  if (!user) return;

  kyRouteMode = "auto";
  if (kyCustodyList() === null) {
    kySaveCustody([]);
    kyRouteOrder = [];
  } else {
    const custody = [...kyCustodySet()];
    const saved = kyRouteState();
    if (Array.isArray(saved.order) && saved.order.length) {
      kyRouteOrder = saved.order.filter((c) => custody.includes(c));
      custody.forEach((c) => {
        if (!kyRouteOrder.includes(c)) kyRouteOrder.push(c);
      });
    }
    kyRefreshAutoRoute();
  }

  setKyTab("route");
  setKyScanMode("zimmet");
  renderSymbolicZimmet();
  setKyRouteMsg(
    "Barkod ile zimmet alın · rota otomatik · müşteriyi arayıp kod ile teslim edin",
    true
  );

  $("#kyLogout")?.addEventListener("click", () => {
    stopKyCam();
    clearSession();
    location.href = "kargo.html";
  });

  $$(".ky-tab").forEach((btn) => {
    btn.addEventListener("click", () => setKyTab(btn.dataset.kyTab));
  });

  $$(".ky-scan-mode").forEach((btn) => {
    btn.addEventListener("click", () => {
      setKyScanMode(btn.dataset.scanMode);
      setKyCamMsg(
        kyScanMode === "teslim"
          ? "Teslim için barkodu okutun."
          : "Zimmete almak için barkodu okutun.",
        true
      );
    });
  });

  $("#kyCamStart")?.addEventListener("click", () => startKyCam());
  $("#kyCamStop")?.addEventListener("click", () => {
    stopKyCam();
    setKyCamMsg("Kamera durduruldu.", true);
  });

  $("#kyManualApply")?.addEventListener("click", () => {
    const code = kyMatchCodeFromScan($("#kyManualCode")?.value || "");
    if (!code) {
      setKyCamMsg("Kod yazın.", false);
      return;
    }
    kyHandleScannedCode(code);
  });

  $("#kyManualCode")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    $("#kyManualApply")?.click();
  });

  $("#kyZimmetList")?.addEventListener("click", (e) => {
    const birak = e.target.closest("[data-ky-birak]");
    if (birak) {
      const code = birak.getAttribute("data-ky-birak");
      kyZimmetBirak(code);
      kyRefreshAutoRoute();
      renderSymbolicZimmet();
      setKyRouteMsg(code + " zimmet bırakıldı", true);
      return;
    }

    const deliverBtn = e.target.closest("[data-ky-deliver]");
    if (deliverBtn) {
      const code = deliverBtn.getAttribute("data-ky-deliver");
      kyDeliverOpen = kyDeliverOpen === code ? "" : code;
      renderSymbolicZimmet();
      return;
    }

    const cancelBtn = e.target.closest("[data-ky-cancel]");
    if (cancelBtn) {
      kyDeliverOpen = "";
      renderSymbolicZimmet();
      return;
    }

    const confirmCode = e.target.closest("[data-ky-confirm-code]");
    if (confirmCode) {
      const code = confirmCode.getAttribute("data-ky-confirm-code");
      const row = kyFindSymbolic(code);
      const input = document.querySelector(`[data-ky-code-input="${code}"]`);
      const entered = String(input?.value || "").replace(/\s/g, "");
      if (!entered) {
        setKyRouteMsg("Müşteriyi arayıp teslim kodunu alın.", false);
        return;
      }
      const expected = String(row?.teslimCode || "");
      if (expected && entered !== expected) {
        setKyRouteMsg("Teslim kodu hatalı · doğru kişiye ait değil.", false);
        return;
      }
      const res = kyMarkDeliveredSymbolic(code, { method: "code", entered });
      kyDeliverOpen = "";
      kyRefreshAutoRoute();
      renderSymbolicZimmet();
      setKyRouteMsg(code + " kod ile teslim · " + res.pay + " ₺", true);
      return;
    }

    const failBtn = e.target.closest("[data-ky-fail]");
    if (failBtn) {
      const code = failBtn.getAttribute("data-ky-fail");
      const reason = document.querySelector(`[data-ky-fail-reason="${code}"]`)?.value || "";
      if (!KY_FAIL_IDS.has(reason)) {
        setKyRouteMsg("Teslim edilemedi nedeni seçin.", false);
        return;
      }
      const res = kyMarkFailedSymbolic(code, reason);
      kyRefreshAutoRoute();
      renderSymbolicZimmet();
      setKyRouteMsg(code + " teslim edilemedi · " + res.reasonLabel, true);
    }
  });

  window.addEventListener("pagehide", () => stopKyCam());
})();

function teslimCodeOf(s) {
  return String(s?.teslimCode || s?.deliveryCode || "").replace(/\s/g, "");
}

/** Teslim kodu doğrulama — gerçek üretim/SMS ayarı sonra bağlanacak. */
function verifyTeslimCode(ship, entered) {
  const code = String(entered || "").replace(/\s/g, "");
  if (!code) return { ok: false, error: "Teslim kodunu yazın." };
  const expected = teslimCodeOf(ship);
  if (!expected) {
    return { ok: true, mode: "pending-setup", code };
  }
  if (expected !== code) {
    return { ok: false, error: "Teslim kodu hatalı." };
  }
  return { ok: true, mode: "matched", code };
}

function courierDeliverableShips(c) {
  if (!c) return [];
  return ships().filter((s) => {
    const k = kindOf(s);
    return s.courierId === c.id && (k === "custody" || k === "dist" || k === "pickup");
  });
}

function courierFailedShips(c) {
  if (!c) return [];
  return ships().filter((s) => s.courierId === c.id && KY_FAIL_IDS.has(kindOf(s)));
}

let tlSelectedKey = "";

function renderTeslimScreen() {
  const c = activeCourier();
  const list = courierDeliverableShips(c);
  const failed = courierFailedShips(c);
  const grid = $("#tlDeliverGrid");
  const stats = $("#tlStats");
  if (stats) {
    stats.innerHTML =
      `<span><b>${list.length}</b> teslim edilecek</span>` +
      `<span><b>${failed.length}</b> teslim edilemedi</span>`;
  }
  if (grid) {
    if (!list.length) {
      grid.innerHTML = '<p class="hint">Zimmette teslim edilecek kargo yok. <a href="kargo-kurye.html">Kurye paneli</a>nden zimmete alın.</p>';
    } else {
      grid.innerHTML = list
        .map((s) => {
          const key = shipKey(s);
          const on = key === tlSelectedKey ? " on" : "";
          const phone = s.phone || "";
          const addr = s.address || "";
          return `<button type="button" class="tl-card${on}" data-tl-pick="${key}">
            <strong>${sendCodeOf(s)} · ${s.receiver || "Alıcı"}</strong>
            <span class="meta">${kindLabel(kindOf(s))}<br>${addr}<br>${phone}</span>
          </button>`;
        })
        .join("");
    }
  }
  const failBox = $("#tlFailedList");
  if (failBox) {
    failBox.innerHTML = failed.length
      ? failed
          .map(
            (s) =>
              `<div class="tl-mini"><strong>${sendCodeOf(s)} · ${s.receiver || ""}</strong><span>${failReasonLabel(s.failReason || kindOf(s))}</span></div>`
          )
          .join("")
      : '<p class="hint">Kayıt yok.</p>';
  }
  renderTeslimDetail();
}

function renderTeslimDetail() {
  const empty = $("#tlDetailEmpty");
  const panel = $("#tlDetail");
  if (!tlSelectedKey) {
    if (empty) empty.hidden = false;
    if (panel) panel.hidden = true;
    return;
  }
  const s = ships().find((x) => shipKey(x) === tlSelectedKey);
  if (!s) {
    tlSelectedKey = "";
    if (empty) empty.hidden = false;
    if (panel) panel.hidden = true;
    return;
  }
  if (empty) empty.hidden = true;
  if (panel) panel.hidden = false;
  const phone = s.phone || "";
  const addr = s.address || "";
  const expected = teslimCodeOf(s);
  $("#tlDetailBody").innerHTML = `
    <div class="tl-detail-row"><span>Gönderim kodu</span><b>${sendCodeOf(s)}</b></div>
    <div class="tl-detail-row"><span>Alıcı</span><b>${s.receiver || "-"}</b></div>
    <div class="tl-detail-row"><span>Telefon</span><b>${phone || "-"}</b></div>
    <div class="tl-detail-row"><span>Adres</span><b>${addr || "-"}</b></div>
    <div class="tl-detail-row"><span>Durum</span><b>${kindLabel(kindOf(s))}</b></div>
    <div class="ky-quick" style="margin-top:8px">
      ${phone ? `<a href="tel:${phone.replace(/\s/g, "")}">Ara</a>` : ""}
      ${addr ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}" target="_blank" rel="noopener">Harita</a>` : ""}
      <a href="kargo-nfc.html?track=${sendCodeOf(s)}&checkout=1">POS</a>
    </div>`;
  if ($("#tlCodeHint")) {
    $("#tlCodeHint").textContent = expected
      ? "Alıcının teslim kodunu girin ve onaylayın."
      : "Teslim kodu üretimi sonra ayarlanacak. Şimdilik girilen kodla teslim kaydı oluşur.";
  }
  if ($("#tlCodeMsg")) $("#tlCodeMsg").textContent = "";
  if ($("#tlCode")) $("#tlCode").value = "";
}

(function initTeslimPage() {
  if (PAGE !== "teslim") return;
  const user = requireBranchAuth();
  if (!user) return;
  seedDemo();
  const saved = store.get("hk-teslim-pick", "");
  if (saved && ships().some((s) => shipKey(s) === saved)) tlSelectedKey = saved;
  store.set("hk-teslim-pick", null);
  renderTeslimScreen();

  $("#tlLogout")?.addEventListener("click", () => {
    clearSession();
    location.href = "kargo.html";
  });

  $("#tlDeliverGrid")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tl-pick]");
    if (!btn) return;
    tlSelectedKey = btn.getAttribute("data-tl-pick");
    renderTeslimScreen();
    $("#tlCode")?.focus();
  });

  $("#tlCodeForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = $("#tlCodeMsg");
    if (!tlSelectedKey) {
      msg.className = "msg err";
      msg.textContent = "Önce bir kargo seçin.";
      return;
    }
    const ship = ships().find((s) => shipKey(s) === tlSelectedKey);
    if (!ship) return;
    const check = verifyTeslimCode(ship, $("#tlCode").value);
    if (!check.ok) {
      msg.className = "msg err";
      msg.textContent = check.error;
      return;
    }
    const c = activeCourier();
    patchShip(tlSelectedKey, {
      kind: "delivered",
      status: "delivered",
      deliveredAt: new Date().toISOString(),
      deliveredByCode: check.code,
      deliveryVerifyMode: check.mode,
      courierId: c?.id,
      courierName: c?.name,
    });
    tlSelectedKey = "";
    msg.className = "msg ok";
    msg.textContent =
      check.mode === "pending-setup"
        ? "Kod ile teslim edildi (kod ayarı sonra bağlanacak)."
        : "Kod doğrulandı · kargo teslim edildi.";
    renderTeslimScreen();
  });

  $("#tlFailBtn")?.addEventListener("click", () => {
    const msg = $("#tlCodeMsg");
    if (!tlSelectedKey) {
      msg.className = "msg err";
      msg.textContent = "Önce bir kargo seçin.";
      return;
    }
    const reason = $("#tlFailReason")?.value || "";
    if (!KY_FAIL_IDS.has(reason)) {
      msg.className = "msg err";
      msg.textContent = "Teslim edilemedi nedeni seçin.";
      return;
    }
    const c = activeCourier();
    patchShip(tlSelectedKey, {
      kind: reason,
      status: reason,
      failReason: reason,
      failLabel: failReasonLabel(reason),
      failAt: new Date().toISOString(),
      courierId: c?.id,
      courierName: c?.name,
    });
    tlSelectedKey = "";
    if ($("#tlFailReason")) $("#tlFailReason").value = "";
    msg.className = "msg ok";
    msg.textContent = "Teslim edilemedi: " + failReasonLabel(reason);
    renderTeslimScreen();
  });

  $("#tlUncustodyBtn")?.addEventListener("click", () => {
    const msg = $("#tlCodeMsg");
    if (!tlSelectedKey) {
      msg.className = "msg err";
      msg.textContent = "Önce bir kargo seçin.";
      return;
    }
    patchShip(tlSelectedKey, {
      courierId: null,
      courierName: null,
      kind: "custody",
      status: "custody",
      zimmetOutAt: new Date().toISOString(),
    });
    tlSelectedKey = "";
    msg.className = "msg ok";
    msg.textContent = "Kargo zimmetten çıkarıldı.";
    renderTeslimScreen();
  });
})();

function marketName(id) {
  return MARKETS.find((m) => m.id === id)?.name || id;
}

function returnsList() {
  return store.get(RETURNS, []);
}

function renderReturnMarkets() {
  const box = $("#returnMarketList");
  if (!box) return;
  box.innerHTML = MARKETS.map(
    (m) => `<span class="return-chip" title="${m.hint}">${m.name}</span>`
  ).join("");
}

function renderReturnLog() {
  const box = $("#returnLog");
  if (!box) return;
  const rows = returnsList();
  if (!rows.length) {
    box.innerHTML = '<p class="hint">Henüz kabul edilen iade yok.</p>';
    return;
  }
  box.innerHTML = rows
    .slice(0, 20)
    .map(
      (r) => `<div class="partner-app">
        <strong>${marketName(r.market)}</strong>
        <div class="meta">${r.orderNo} · ${r.phone}<br>${r.address}</div>
        <div class="cred">Kod: ${r.sendCode}${r.reason ? "<br>" + r.reason : ""}</div>
      </div>`
    )
    .join("");
}

function fillReturnMarkets() {
  const sel = $("#retMarket");
  if (!sel) return;
  sel.innerHTML = MARKETS.map((m) => `<option value="${m.id}">${m.name}</option>`).join("");
}

(function initCreatePage() {
  if (PAGE !== "create") return;
  const user = requireBranchAuth();
  if (!user) return;

  fillCities($("#nsFrom"), user.city || "İstanbul");
  fillCities($("#nsTo"), "İstanbul");
  fillReturnMarkets();
  renderReturnMarkets();
  renderReturnLog();

  $("#hkCreateLogout")?.addEventListener("click", () => {
    clearSession();
    location.href = "kargo.html";
  });

  $("#newShipForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#nsMsg");
    const sender = $("#nsSender").value.trim();
    const receiver = $("#nsReceiver").value.trim();
    const phone = $("#nsPhone").value.trim();
    const address = $("#nsAddress").value.trim();
    const fromCity = $("#nsFrom").value;
    const toCity = $("#nsTo").value;
    const kg = Number($("#nsKg").value) || 1;
    const desi = Number($("#nsDesi").value) || 1;
    const service = $("#nsService").value;
    const payment = $("#nsPayment").value;
    const kind = $("#nsKind").value;
    if (!sender || !receiver || !phone || !address) {
      msg.className = "msg err";
      msg.textContent = "Zorunlu alanları doldurun.";
      return;
    }
    const row = await createShip({
      kind,
      sender,
      receiver,
      fromCity,
      toCity,
      phone,
      address,
      kg,
      desi,
      service,
      payment,
      branchId: user.id,
      branchName: user.branchName,
    });
    msg.className = "msg ok";
    msg.textContent = "Kargo oluşturuldu.";
    $("#nsResult").hidden = false;
    $("#nsCodeBox").textContent = "Gönderim kodu: " + sendCodeOf(row);
    $("#newShipForm").reset();
    fillCities($("#nsFrom"), user.city || "İstanbul");
    fillCities($("#nsTo"), "İstanbul");
    $("#nsKg").value = "1";
    $("#nsDesi").value = "1";
  });

  $("#returnAcceptForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#retMsg");
    const market = $("#retMarket").value;
    const orderNo = $("#retOrder").value.trim();
    const phone = $("#retPhone").value.trim();
    const address = $("#retAddress").value.trim();
    const reason = $("#retReason").value.trim();
    if (!market || !orderNo || !phone || !address) {
      msg.className = "msg err";
      msg.textContent = "Pazaryeri, sipariş no, telefon ve adres zorunlu.";
      return;
    }
    const mName = marketName(market);
    const row = await createShip({
      kind: "return",
      sender: mName + " iade",
      receiver: user.branchName || "Harbi Kargo",
      fromCity: user.city || "İstanbul",
      toCity: user.city || "İstanbul",
      phone,
      address,
      kg: 1,
      desi: 1,
      service: "standart",
      payment: "gonderici",
      market,
      orderNo,
      reason,
      branchId: user.id,
      branchName: user.branchName,
    });
    const list = returnsList();
    list.unshift({
      id: "rt_" + Date.now().toString(36),
      market,
      orderNo,
      phone,
      address,
      reason,
      sendCode: sendCodeOf(row),
      at: new Date().toISOString(),
      branchId: user.id,
    });
    store.set(RETURNS, list.slice(0, 100));
    msg.className = "msg ok";
    msg.textContent = mName + " iadesi kabul edildi. Kod: " + sendCodeOf(row);
    $("#returnAcceptForm").reset();
    fillReturnMarkets();
    renderReturnLog();
  });
})();

(function initHkAuth() {
  if (PAGE !== "panel") return;
  const hash = location.hash.replace("#", "");
  if (hash === "partner" && !currentBranch()) {
    openGuestPartner();
  } else {
    requireBranchAuth();
  }

  $("#hkOpenPartner")?.addEventListener("click", () => openGuestPartner());
  $("#hkStaffLoginBtn")?.addEventListener("click", () => closeGuestToLogin());

  $("#hkLoginShowPass")?.addEventListener("click", () => hkTogglePass("#hkLoginPass", "#hkLoginShowPass"));
  fillHkLoginRemember();

  $("#hkLoginForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const u = $("#hkLoginUser").value;
    const p = String($("#hkLoginPass").value || "").trim();
    const msg = $("#hkLoginMsg");
    const hit = findHkLogin(u, p);
    if (!hit) {
      msg.className = "msg err";
      msg.textContent = "Yetkisiz. Şube veya kurye hesabı bulunamadı.";
      return;
    }
    hkRememberSave(normalizeHkUser(u), p, $("#hkLoginRemember")?.checked !== false);
    setSession(hit.role, hit.account.id);
    if (hit.role === "courier") {
      msg.className = "msg ok";
      msg.textContent = "Kurye girişi · Harbi Kurye açılıyor…";
      goCourierApp();
      return;
    }
    document.body.classList.remove("hk-guest", "hk-locked");
    history.replaceState(null, "", "kargo.html");
    requireBranchAuth();
    showView("home");
    if ($("#hkLoginMsg")) {
      $("#hkLoginMsg").className = "msg ok";
      $("#hkLoginMsg").textContent = "";
    }
  });

  $("#hkLogoutBtn")?.addEventListener("click", () => {
    clearSession();
    document.body.classList.remove("hk-guest");
    requireBranchAuth();
    if ($("#hkLoginUser")) $("#hkLoginUser").value = "";
    if ($("#hkLoginPass")) $("#hkLoginPass").value = "";
    if ($("#hkLoginMsg")) $("#hkLoginMsg").textContent = "";
    fillHkLoginRemember();
  });

  const user = currentBranch();
  if (user && hash === "partner") showView("partner");
  if (!user) return;

  if (hash === "integrate") showView("integrate");
  if (hash === "couriers") showView("couriers");
  if (hash === "branches" && isDemoUser()) showView("branches");

  $("#panelCourierForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = $("#pcMsg");
    try {
      const row = createCourierAccount(
        {
          name: $("#pcName").value,
          phone: $("#pcPhone").value,
          plate: $("#pcPlate").value,
          username: $("#pcUser").value,
          password: $("#pcPass").value,
        },
        currentBranch()
      );
      $("#panelCourierForm").reset();
      msg.className = "msg ok";
      msg.textContent = "Kurye hesabı oluşturuldu.";
      $("#pcCredBox").hidden = false;
      $("#pcUserBox").textContent = "Kullanıcı adı: " + row.username;
      $("#pcPassBox").textContent = "Şifre: " + row.password;
      renderPanelCouriers();
    } catch (err) {
      msg.className = "msg err";
      msg.textContent = err.message || "Kayıt başarısız.";
    }
  });

  $("#panelCourierList")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-del-courier]");
    if (!btn) return;
    const id = btn.getAttribute("data-del-courier");
    if (id === DEMO_COURIER.id) return;
    saveCouriers(couriers().filter((c) => c.id !== id));
    renderPanelCouriers();
  });

  $("#branchForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isDemoUser()) return;
    const msg = $("#branchMsg");
    const branchName = $("#bName").value.trim();
    const city = $("#bCity").value.trim();
    const phone = $("#bPhone").value.trim();
    if (!branchName) {
      msg.className = "msg err";
      msg.textContent = "Şube adı zorunlu.";
      return;
    }
    if (branches().some((b) => b.branchName.toLocaleLowerCase("tr") === branchName.toLocaleLowerCase("tr"))) {
      msg.className = "msg err";
      msg.textContent = "Bu şube adı zaten kayıtlı.";
      return;
    }
    const username = slugBranchUser(branchName);
    const password = makePass();
    const row = upsertBranchAccount({
      id: "br_" + Date.now().toString(36),
      branchName,
      city,
      phone,
      username,
      password,
      role: "branch",
      createdAt: new Date().toISOString(),
      createdBy: currentBranch()?.id || "demo",
    });
    $("#branchForm").reset();
    msg.className = "msg ok";
    msg.textContent = "Şube eklendi.";
    $("#branchCredBox").hidden = false;
    $("#branchCredHint").textContent = row.branchName + " için giriş bilgileri:";
    $("#branchUserBox").textContent = "Kullanıcı adı: " + row.username;
    $("#branchPassBox").textContent = "Şifre: " + row.password;
    renderBranchList();
  });

  $("#branchList")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-del-branch]");
    if (!btn || !isDemoUser()) return;
    const id = btn.getAttribute("data-del-branch");
    store.set(
      BRANCHES,
      branches().filter((b) => b.id !== id || b.role === "demo")
    );
    renderBranchList();
  });
})();
