// Quick add: photograph cards on a phone, look up details from TCGdex (+ PokeAPI for English names),
// collect them in a batch saved on the device, then submit in chunks (one GitHub commit per chunk).
(() => {
  const TCGDEX = "https://api.tcgdex.net/v2";
  const POKEAPI = "https://pokeapi.co/api/v2";
  const SETTINGS_KEY = "kz-quick-add-settings";
  const CHUNK_SIZE = 8;
  const RARITY_CODES = {
    "double rare": "RR", "illustration rare": "IR", "special illustration rare": "SIR", "ultra rare": "UR",
    "hyper rare": "HR", "art rare": "AR", "special art rare": "SAR", "super rare": "SR", "secret rare": "SEC",
    "shiny rare": "S", "shiny ultra rare": "SSR", "character rare": "CHR", "character super rare": "CSR",
    "ace spec rare": "ACE", "rare holo": "Holo", "holo rare": "Holo", "mega hyper rare": "MUR", "black white rare": "BWR"
  };
  const PLAIN_RARITIES = new Set(["c", "u", "r", "common", "uncommon", "rare", "none", "promo"]);

  const $ = (id) => document.getElementById(id);
  const dialog = $("quickDialog"), form = $("qaForm");
  const els = {
    language: $("qaLanguage"), condition: $("qaCondition"), setSearch: $("qaSetSearch"), setResults: $("qaSetResults"),
    setName: $("qaSetName"), setStatus: $("qaSetStatus"), front: $("qaFront"), back: $("qaBack"),
    frontPreview: $("qaFrontPreview"), backPreview: $("qaBackPreview"), number: $("qaNumber"), quantity: $("qaQuantity"),
    lookupStatus: $("qaLookupStatus"), lookupImage: $("qaLookupImage"), name: $("qaName"), price: $("qaPrice"),
    formMessage: $("qaFormMessage"), addButton: $("qaAddButton"), batchCount: $("qaBatchCount"), batchList: $("qaBatchList"),
    submitStatus: $("qaSubmitStatus"), submit: $("qaSubmit"), submitMessage: $("qaSubmitMessage")
  };

  let setTimer = null;
  const state = {
    batch: [], editingId: null, frontBlob: null, backBlob: null, set: null, setNames: [],
    nameTouched: false, lookupToken: 0, setsCache: new Map(), setCache: new Map(), cardCache: new Map(), speciesCache: new Map()
  };

  // ---------- small helpers ----------
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const formatPrice = (value) => `BND $${Number(value).toFixed(Number(value) % 1 ? 2 : 0)}`;
  const languageParts = () => { const [label, code] = els.language.value.split("|"); return { label, code: code || "" }; };
  const normaliseNumber = (value) => { const text = String(value ?? "").trim().toLowerCase(); return /^\d+$/.test(text) ? String(Number(text)) : text; };
  async function getJson(url, cache) {
    if (cache?.has(url)) return cache.get(url);
    const promise = fetch(url).then((response) => { if (!response.ok) throw new Error(`Lookup failed (${response.status})`); return response.json(); });
    cache?.set(url, promise);
    try { return await promise; } catch (error) { cache?.delete(url); throw error; }
  }

  // ---------- batch storage (IndexedDB, so a reload or closed tab does not lose photos) ----------
  const store = (() => {
    let dbPromise = null;
    const open = () => dbPromise ||= new Promise((resolve, reject) => {
      const request = indexedDB.open("kz-quick-add", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("items", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const run = async (mode, action) => {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("items", mode), result = action(tx.objectStore("items"));
        tx.oncomplete = () => resolve(result?.result);
        tx.onerror = () => reject(tx.error);
      });
    };
    let memory = new Map();
    const safe = async (fn, fallback) => { try { return await fn(); } catch (error) { console.warn("Batch storage unavailable; keeping it in memory", error); return fallback(); } };
    return {
      all: () => safe(() => run("readonly", (s) => s.getAll()), () => [...memory.values()]),
      put: (item) => safe(() => run("readwrite", (s) => s.put(item)), () => memory.set(item.id, item)),
      remove: (id) => safe(() => run("readwrite", (s) => s.delete(id)), () => memory.delete(id))
    };
  })();

  // ---------- settings that stay between cards ----------
  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ language: els.language.value, condition: els.condition.value, set: state.set, setName: els.setName.value }));
  }
  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (saved.language && [...els.language.options].some((o) => o.value === saved.language)) els.language.value = saved.language;
      if (saved.condition) els.condition.value = saved.condition;
      state.set = saved.set || null;
      els.setName.value = saved.setName || "";
      els.setSearch.value = state.set ? state.set.label : "";
    } catch { /* ignore corrupt settings */ }
  }

  // ---------- sets ----------
  async function loadSets() {
    const { code } = languageParts();
    if (!code) return [];
    const sets = await getJson(`${TCGDEX}/${code}/sets`, state.setsCache);
    return Array.isArray(sets) ? sets : [];
  }
  function rememberedName(lang, setId) { return state.setNames.find((s) => s.lang === lang && s.setId === setId)?.displayName || ""; }
  async function showSetResults() {
    const query = els.setSearch.value.trim().toLowerCase(), { code } = languageParts();
    els.setResults.innerHTML = "";
    if (!code) { els.setResults.hidden = true; els.setStatus.textContent = "Card lookup isn't available for this language — type the set and card name yourself."; return; }
    let sets = [];
    try { sets = await loadSets(); els.setStatus.textContent = ""; }
    catch { els.setStatus.textContent = "Card lookup is unavailable right now — you can still type the details yourself."; }
    const remembered = new Set(state.setNames.filter((s) => s.lang === code).map((s) => s.setId));
    const matches = sets.slice().reverse()
      .map((s) => ({ ...s, display: rememberedName(code, s.id) }))
      .filter((s) => !query || [s.name, s.id, s.display].join(" ").toLowerCase().includes(query))
      .sort((a, b) => Number(remembered.has(b.id)) - Number(remembered.has(a.id)))
      .slice(0, 40);
    if (!matches.length || document.activeElement !== els.setSearch) { els.setResults.hidden = true; return; }
    els.setResults.innerHTML = matches.map((s) => `<li><button type="button" data-set-id="${escapeHtml(s.id)}"><strong>${escapeHtml(s.display || s.name)}</strong><span>${escapeHtml([s.display ? s.name : "", s.id, s.cardCount?.official ? `${s.cardCount.official} cards` : ""].filter(Boolean).join(" · "))}</span></button></li>`).join("");
    els.setResults.hidden = false;
  }
  async function chooseSet(setId) {
    clearTimeout(setTimer);
    const { code } = languageParts(), sets = await loadSets().catch(() => []), set = sets.find((s) => s.id === setId);
    if (!set) return;
    const display = rememberedName(code, set.id);
    state.set = { lang: code, id: set.id, name: set.name, label: display || set.name };
    els.setSearch.value = state.set.label;
    els.setName.value = display || set.name;
    els.setResults.hidden = true;
    els.setStatus.textContent = display ? "" : "First time using this set — edit the name buyers will see if needed. It's remembered after you submit.";
    saveSettings();
    getJson(`${TCGDEX}/${code}/sets/${encodeURIComponent(set.id)}`, state.setCache).catch(() => {}); // warm the cache
    if (els.number.value.trim()) lookupCard();
  }

  // ---------- card lookup ----------
  function rarityCode(rarity) {
    const text = String(rarity || "").trim(), key = text.toLowerCase();
    if (!text || PLAIN_RARITIES.has(key)) return "";
    if (RARITY_CODES[key]) return RARITY_CODES[key];
    return /^[A-Z]{1,4}$/.test(text) ? text : "";
  }
  async function englishName(card, lang) {
    if (lang === "en") return card.name;
    const dexId = Array.isArray(card.dexId) ? card.dexId[0] : null;
    if (!dexId) return "";
    const species = await getJson(`${POKEAPI}/pokemon-species/${dexId}`, state.speciesCache);
    const base = species.names?.find((n) => n.language?.name === "en")?.name;
    if (!base) return "";
    const local = String(card.name || "");
    const mega = /^(メガ|超级|超級|메가|M\s)/.test(local) || /^mega\s/i.test(local) ? "Mega " : "";
    const suffix = (local.match(/(VMAX|VSTAR|V-UNION|BREAK|GX|EX|ex|V)$/) || [])[1] || "";
    return `${mega}${base}${suffix ? ` ${suffix}` : ""}`;
  }
  async function lookupCard() {
    const token = ++state.lookupToken, typed = els.number.value.trim(), key = typed.split("/")[0].trim();
    els.lookupImage.hidden = true;
    if (!key) { els.lookupStatus.textContent = ""; return; }
    if (!state.set || state.set.lang !== languageParts().code) { els.lookupStatus.textContent = "Pick a set above to fill in the name automatically."; return; }
    els.lookupStatus.textContent = "Looking up…";
    try {
      const set = await getJson(`${TCGDEX}/${state.set.lang}/sets/${encodeURIComponent(state.set.id)}`, state.setCache);
      if (token !== state.lookupToken) return;
      const brief = (set.cards || []).find((c) => normaliseNumber(c.localId) === normaliseNumber(key));
      if (!brief) { els.lookupStatus.textContent = `No card ${key} in ${state.set.label} — type the name yourself.`; return; }
      const card = await getJson(`${TCGDEX}/${state.set.lang}/cards/${encodeURIComponent(brief.id)}`, state.cardCache).catch(() => brief);
      if (token !== state.lookupToken) return;
      const english = await englishName(card, state.set.lang).catch(() => "");
      if (token !== state.lookupToken) return;
      const code = rarityCode(card.rarity);
      const name = [english || card.name, code].filter(Boolean).join(" ");
      if (!state.nameTouched || !els.name.value.trim()) { els.name.value = name; state.nameTouched = false; }
      if (!typed.includes("/") && set.cardCount?.official) {
        const local = String(brief.localId);
        els.number.value = `${local}/${String(set.cardCount.official).padStart(/^0\d/.test(local) ? local.length : 0, "0")}`;
      }
      els.lookupStatus.textContent = `Found: ${[english && english !== card.name ? `${english} (${card.name})` : card.name, card.rarity].filter(Boolean).join(" · ")}`;
      if (card.image || brief.image) { els.lookupImage.src = `${card.image || brief.image}/low.webp`; els.lookupImage.hidden = false; }
      if (!els.price.value) els.price.focus();
    } catch (error) {
      if (token === state.lookupToken) els.lookupStatus.textContent = "Lookup failed — type the name yourself.";
      console.warn(error);
    }
  }

  // ---------- photos ----------
  async function takePhoto(input, side) {
    const file = input.files[0];
    if (!file) return;
    const blob = await (window.kzCompressImage ? window.kzCompressImage(file) : file);
    state[`${side}Blob`] = blob;
    const preview = side === "front" ? els.frontPreview : els.backPreview;
    preview.src = URL.createObjectURL(blob);
    preview.hidden = false;
    preview.closest(".photo-slot").classList.add("has-photo");
    input.value = "";
    if (side === "front" && !els.number.value) els.number.focus();
  }
  function clearPhotos() {
    state.frontBlob = state.backBlob = null;
    [els.frontPreview, els.backPreview].forEach((img) => { img.hidden = true; img.removeAttribute("src"); img.closest(".photo-slot").classList.remove("has-photo"); });
  }

  // ---------- batch ----------
  function renderBatch() {
    const count = state.batch.length;
    els.batchCount.textContent = count;
    els.submit.disabled = !count;
    els.submit.textContent = count ? `Submit ${count} ${count === 1 ? "card" : "cards"}` : "Submit";
    $("quickAdd").dataset.count = count || "";
    if (!count) { els.batchList.innerHTML = '<li class="quick-empty">Cards you add appear here. They are kept on this phone until you submit.</li>'; return; }
    els.batchList.innerHTML = state.batch.map((item) => `<li class="${item.id === state.editingId ? "editing" : ""}">
      <button type="button" class="batch-item" data-edit-item="${item.id}">
        <img alt="" src="${item.frontUrl}">
        <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml([item.setName, item.cardNumber, item.quantity > 1 ? `×${item.quantity}` : ""].filter(Boolean).join(" · "))}</small></span>
        <em>${formatPrice(item.price)}</em>
      </button>
      <button type="button" class="batch-remove" data-remove-item="${item.id}" aria-label="Remove ${escapeHtml(item.name)}">×</button></li>`).join("");
  }
  function withUrls(item) { return { ...item, frontUrl: item.front ? URL.createObjectURL(item.front) : "" }; }
  async function refreshBatch() {
    state.batch = (await store.all()).sort((a, b) => a.createdAt - b.createdAt).map(withUrls);
    renderBatch();
  }
  function resetCardFields() {
    form.reset();
    clearPhotos();
    els.quantity.value = 1;
    els.lookupStatus.textContent = "";
    els.lookupImage.hidden = true;
    els.formMessage.textContent = "";
    els.addButton.textContent = "Add to batch";
    state.editingId = null;
    state.nameTouched = false;
  }
  async function addToBatch(event) {
    event.preventDefault();
    const { label } = languageParts(), price = Number(els.price.value), quantity = Number(els.quantity.value) || 1;
    const existing = state.batch.find((item) => item.id === state.editingId);
    const front = state.frontBlob || existing?.front, back = state.backBlob || existing?.back || null;
    const problems = [!front && "take a front photo", !els.name.value.trim() && "enter the card name", !els.setName.value.trim() && "choose or type the set", !(els.price.value !== "" && price >= 0) && "enter a price"].filter(Boolean);
    if (problems.length) { els.formMessage.textContent = `Please ${problems.join(", ")}.`; return; }
    const item = {
      id: existing?.id || crypto.randomUUID(), createdAt: existing?.createdAt || Date.now(),
      name: els.name.value.trim(), setName: els.setName.value.trim(), cardNumber: els.number.value.trim(),
      language: label, condition: els.condition.value, price, quantity: Math.min(99, Math.max(1, Math.round(quantity))),
      lang: state.set?.lang || "", setId: state.set?.id || "", front, back
    };
    await store.put(item);
    saveSettings();
    resetCardFields();
    await refreshBatch();
    window.kzAdmin?.notify(existing ? "Card updated" : `Added · ${state.batch.length} in batch`);
    form.scrollIntoView({ behavior: "smooth", block: "start" }); // ready for the next card
  }
  function editItem(id) {
    const item = state.batch.find((entry) => entry.id === id);
    if (!item) return;
    resetCardFields();
    state.editingId = id;
    els.name.value = item.name; state.nameTouched = true;
    els.number.value = item.cardNumber; els.price.value = item.price; els.quantity.value = item.quantity;
    els.setName.value = item.setName; els.condition.value = item.condition;
    [["front", els.frontPreview], ["back", els.backPreview]].forEach(([side, img]) => { if (item[side]) { img.src = URL.createObjectURL(item[side]); img.hidden = false; img.closest(".photo-slot").classList.add("has-photo"); } });
    els.addButton.textContent = "Save changes";
    renderBatch();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const toBase64 = (blob) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
  async function submitBatch() {
    const items = state.batch.slice(), status = els.submitStatus.value;
    if (!items.length) return;
    els.submit.disabled = true;
    let done = 0;
    try {
      for (let start = 0; start < items.length; start += CHUNK_SIZE) {
        const chunk = items.slice(start, start + CHUNK_SIZE);
        els.submitMessage.textContent = `Uploading ${start + 1}–${start + chunk.length} of ${items.length}…`;
        const payload = await Promise.all(chunk.map(async (item) => ({
          name: item.name, setName: item.setName, cardNumber: item.cardNumber, language: item.language, condition: item.condition,
          price: item.price, quantity: item.quantity, category: "Singles", lang: item.lang, setId: item.setId,
          front: item.front ? { type: item.front.type || "image/jpeg", data: await toBase64(item.front) } : null,
          back: item.back ? { type: item.back.type || "image/jpeg", data: await toBase64(item.back) } : null
        })));
        await window.kzAdmin.request("/admin/batch", { method: "POST", body: JSON.stringify({ status, items: payload }) });
        for (const item of chunk) await store.remove(item.id);
        done += chunk.length;
      }
      els.submitMessage.textContent = "";
      window.kzAdmin.notify(`${done} ${done === 1 ? "card" : "cards"} ${status === "available" ? "published" : "saved as drafts"}`);
      state.setNames = await fetchSetNames();
    } catch (error) {
      els.submitMessage.textContent = `${done ? `${done} uploaded. ` : ""}${error.message} The remaining cards are still in your batch — try again.`;
    } finally {
      await refreshBatch();
      window.kzAdmin?.reload();
    }
  }
  async function fetchSetNames() {
    try { return (await window.kzAdmin.request("/admin/set-names")).setNames || []; } catch { return state.setNames; }
  }

  // ---------- wiring ----------
  async function open() {
    loadSettings();
    dialog.showModal();
    state.setNames = await fetchSetNames();
    await refreshBatch();
    if (!state.batch.length && !state.set) els.setSearch.focus();
  }
  $("quickAdd").addEventListener("click", open);
  $("qaClose").addEventListener("click", () => dialog.close());
  els.language.addEventListener("change", () => { state.set = null; els.setSearch.value = ""; els.setName.value = ""; els.setStatus.textContent = ""; saveSettings(); showSetResults(); });
  els.condition.addEventListener("change", saveSettings);
  els.setName.addEventListener("change", saveSettings);
  els.setSearch.addEventListener("focus", showSetResults);
  els.setSearch.addEventListener("input", () => {
    clearTimeout(setTimer); setTimer = setTimeout(showSetResults, 200);
    if (!state.set || els.setSearch.value !== state.set.label) { state.set = null; els.setName.value = els.setSearch.value; saveSettings(); }
  });
  els.setResults.addEventListener("click", (event) => { const button = event.target.closest("[data-set-id]"); if (button) chooseSet(button.dataset.setId); });
  document.addEventListener("click", (event) => { if (!event.target.closest(".set-picker")) els.setResults.hidden = true; });
  els.front.addEventListener("change", () => takePhoto(els.front, "front"));
  els.back.addEventListener("change", () => takePhoto(els.back, "back"));
  let lookupTimer = null;
  els.number.addEventListener("input", () => { clearTimeout(lookupTimer); lookupTimer = setTimeout(lookupCard, 450); });
  els.number.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); clearTimeout(lookupTimer); lookupCard(); } });
  els.name.addEventListener("input", () => { state.nameTouched = true; });
  form.addEventListener("submit", addToBatch);
  els.batchList.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit-item]"), remove = event.target.closest("[data-remove-item]");
    if (edit) editItem(edit.dataset.editItem);
    if (remove && confirm("Remove this card from the batch?")) { await store.remove(remove.dataset.removeItem); if (state.editingId === remove.dataset.removeItem) resetCardFields(); await refreshBatch(); }
  });
  els.submit.addEventListener("click", submitBatch);
  // Show the number of unsent cards on the button even before the dialog is opened.
  store.all().then((items) => { $("quickAdd").dataset.count = items.length || ""; }).catch(() => {});
})();
