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
  if (!saved?.remember || !saved.user) return;
  if ($("#hkLoginUser") && !$("#hkLoginUser").value) $("#hkLoginUser").value = saved.user;
  if ($("#hkLoginPass") && !$("#hkLoginPass").value) $("#hkLoginPass").value = saved.pass || "";
  if ($("#mobLoginUser") && !$("#mobLoginUser").value) $("#mobLoginUser").value = saved.user;
  if ($("#mobLoginPass") && !$("#mobLoginPass").value) $("#mobLoginPass").value = saved.pass || "";
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

function currentBranch() {
  const id = store.get(HK_SESSION, null);
  if (!id) return null;
  return branches().find((b) => b.id === id) || null;
}

function isDemoUser(user = currentBranch()) {
  return user?.role === "demo";
}

function requireBranchAuth() {
  seedBranches();
  const user = currentBranch();
  if (PAGE === "nfc" && !user) {
    location.replace("kargo.html");
    return null;
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
    if ($("#mobBranchLabel")) $("#mobBranchLabel").textContent = user.branchName;
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

  const staffOnly = $$("[data-go='home'], [data-go='integrate'], [data-go='branches'], a[href='kargo-nfc.html'], a[href='kargo-olustur.html']");
  staffOnly.forEach((el) => {
    if (el.closest(".tabbar")) el.hidden = !user;
    else if (el.matches("[data-go='branches']")) el.hidden = !(user && isDemoUser(user));
    else el.hidden = !user;
  });
  $$(".tabbar a[href='kargo-nfc.html']").forEach((el) => {
    el.hidden = !user;
  });

  if ($("#hkBranchLabel")) {
    $("#hkBranchLabel").textContent = user
      ? user.branchName + (user.city ? " · " + user.city : "")
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
  store.set(HK_SESSION, null);
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
  { id: "bad_address", title: "Adresi Yetersiz Olan Kargolar" },
  { id: "bad_phone", title: "Telefon Yanlış Olan Kargolar" },
  { id: "fee_refused", title: "Kargo ve Ürün Ücreti Kabul Edilmeyen Kargolar" },
  { id: "return", title: "İade Kargolar" },
  { id: "pickup", title: "Adresten Alım Kargolar" },
];
const BUCKET_IDS = new Set(BUCKETS.map((b) => b.id));
const BUCKET_SEED = "hk-buckets-v2";

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
  const known = new Set(["home", "integrate", "partner", "branches"]);
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
    seedBranches();
    const u = normalizeHkUser($("#mobLoginUser").value);
    const p = String($("#mobLoginPass").value || "").trim();
    const msg = $("#mobLoginMsg");
    const hit = branches().find(
      (b) => normalizeHkUser(b.username) === u && String(b.password) === p
    );
    if (!hit) {
      msg.className = "msg err";
      msg.textContent = "Yetkisiz giriş.";
      return;
    }
    hkRememberSave(u, p, $("#mobLoginRemember")?.checked !== false);
    store.set(HK_SESSION, hit.id);
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
    store.set(HK_SESSION, null);
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
    store.set(HK_SESSION, null);
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
    seedBranches();
    const u = normalizeHkUser($("#hkLoginUser").value);
    const p = String($("#hkLoginPass").value || "").trim();
    const msg = $("#hkLoginMsg");
    const hit = branches().find(
      (b) => normalizeHkUser(b.username) === u && String(b.password) === p
    );
    if (!hit) {
      msg.className = "msg err";
      msg.textContent = "Yetkisiz. Yalnızca kayıtlı kargo şubeleri giriş yapabilir.";
      return;
    }
    hkRememberSave(u, p, $("#hkLoginRemember")?.checked !== false);
    store.set(HK_SESSION, hit.id);
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
    store.set(HK_SESSION, null);
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
  if (hash === "branches" && isDemoUser()) showView("branches");

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
