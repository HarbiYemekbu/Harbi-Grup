export const APP_LABELS = {
  home: "Ana sayfa",
  sell: "Ürün yükle",
  camera: "Kamera",
  women: "Ürünler",
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
  pos: "Sanal POS",
};

export function monthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

export function monthTitle(key) {
  const [year, month] = String(key || "").split("-");
  const names = [
    "",
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ];
  const idx = Number(month);
  return names[idx] ? `${names[idx]} ${year}` : key;
}

export function emptyMonth() {
  return { visits: 0, unique: 0, apps: {}, ids: {} };
}

export function publicMonth(row, key) {
  const apps = Object.entries(row.apps || {})
    .map(([id, item]) => ({
      id,
      name: APP_LABELS[id] || id,
      visits: Number(item.visits) || 0,
      unique: Number(item.unique) || 0,
    }))
    .sort((a, b) => b.visits - a.visits || b.unique - a.unique);
  return {
    month: key,
    title: monthTitle(key),
    visits: Number(row.visits) || 0,
    unique: Number(row.unique) || 0,
    apps,
  };
}

export function applyHit(row, visitor, app) {
  const next = {
    visits: Number(row.visits) || 0,
    unique: Number(row.unique) || 0,
    apps: { ...(row.apps || {}) },
    ids: { ...(row.ids || {}) },
  };
  const known = next.ids[visitor];
  if (!known) {
    next.unique += 1;
    next.ids[visitor] = app;
  } else if (typeof known === "string" && !known.split(",").includes(app)) {
    next.ids[visitor] = `${known},${app}`;
  }
  next.visits += 1;
  const used = next.apps[app] || { visits: 0, unique: 0 };
  used.visits += 1;
  const sawApp = String(known || "")
    .split(",")
    .filter(Boolean)
    .includes(app);
  if (!sawApp) used.unique += 1;
  next.apps[app] = used;
  const keys = Object.keys(next.ids);
  if (keys.length > 20000) {
    delete next.ids[keys[0]];
  }
  return next;
}
