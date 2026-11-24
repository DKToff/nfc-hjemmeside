/* ==========================================================================
   Nordic Facility Cleaning – prisberegner (privat og erhverv)

   Siden skal have:  <div id="quote" data-type="private"></div>
                eller <div id="quote" data-type="business"></div>

   ALLE PRISER STÅR I "PRISER" HERUNDER. Ret tallene der, så ændrer
   beregneren sig over alt. Estimatet vises som et interval på ±10 %,
   afrundet til nærmeste 25 kr.
   ========================================================================== */

const QUOTE_EMAIL = "nordicfacilitycleaning@gmail.com";

/* ---------------------------------------------------------------- PRISER */
const PRISER = {
  private: {
    base: 425,              // startpris pr. besøg
    perSqm: 1.6,            // pr. kvadratmeter
    perRoom: 25,            // pr. rum
    perBathroom: 95,        // pr. badeværelse
    // ganges på til sidst
    typeMultiplier: { home: 1, deep: 1.25, move: 1.18, urgent: 1.2 },
    frequency: { one_off: 1, weekly: 0.88, every_2_weeks: 0.92, monthly: 0.96 },
    urgency: { asap: 1.35, tomorrow: 1.18, planned: 1, flexible: 0.96 },
    // det højeste af køkken og badeværelse bruges
    condition: { light: 0.92, normal: 1, heavy: 1.24, deep: 1.45 },
    // tilvalg i kr. (lægges til før multiplikatorerne)
    extras: { oven: 300, fridge: 225, freezer: 225, windows: 450, cabinets: 350, deep_cleaning: 650 },
    windowScope: { few: -100, standard: 0, many: 300 },
    cabinetScope: { some: 0, all: 180 },
    applianceHeavy: 150,    // hvis ovn/køl/frys kræver ekstra tid
    pets: { cat: 120, dog: 180, several: 260, other: 120 },
  },
  business: {
    base: 995,
    perSqm: 4.5,
    perToilet: 140,
    perKitchen: 180,
    frequency: { one_off: 1, daily: 0.82, multiple_weekly: 0.84, weekly: 0.88, monthly: 0.95 },
    time: { morning: 1, daytime: 1, evening: 1.15, night: 1.28, flexible: 0.96 },
    hygiene: 1.18,          // særlige hygiejnekrav
    customerAreas: 1.08,    // kundevendte områder
    extras: { windows: 450, deep_cleaning: 650, fridge_freezer: 325, oven: 300, staircase: 525, linen: 375, event: 700, urgent: 650 },
  },
};

const round25 = (n) => Math.max(0, 25 * Math.round(n / 25));
const has = (s, key) => Array.isArray(s.extras) && s.extras.includes(key);
const num = (v, fallback) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : fallback);

function estimatePrivate(s) {
  const p = PRISER.private;
  const extras = Object.entries(p.extras).reduce((sum, [k, v]) => sum + (has(s, k) ? v : 0), 0);
  const windowAdj = has(s, "windows") ? p.windowScope[s.windowScope || "standard"] ?? 0 : 0;
  const cabinetAdj = has(s, "cabinets") ? p.cabinetScope[s.cabinetScope || "some"] ?? 0 : 0;
  const applianceAdj = ["oven", "fridge", "freezer"].some((k) => has(s, k)) && s.applianceCondition === "heavy" ? p.applianceHeavy : 0;
  const petAdj = s.pets === "yes" ? p.pets[s.petType || "cat"] ?? 120 : 0;
  const condition = Math.max(p.condition[s.kitchenCondition] ?? 1, p.condition[s.bathroomCondition] ?? 1);

  const sum = p.base + num(s.sqm, 90) * p.perSqm + num(s.rooms, 3) * p.perRoom + num(s.bathrooms, 1) * p.perBathroom
    + extras + windowAdj + cabinetAdj + applianceAdj + petAdj;

  return round25(sum * condition * (p.typeMultiplier[s.cleaningType] ?? 1)
    * (p.urgency[s.urgency] ?? 1) * (p.frequency[s.frequency] ?? 1));
}

function estimateBusiness(s) {
  const p = PRISER.business;
  const extras = Object.entries(p.extras).reduce((sum, [k, v]) => sum + (has(s, k) ? v : 0), 0);
  const sum = p.base + num(s.sqm, 180) * p.perSqm + num(s.toilets, 2) * p.perToilet + num(s.kitchens, 1) * p.perKitchen + extras;
  return round25(sum * (s.hygiene === "yes" ? p.hygiene : 1) * (s.customerAreas === "yes" ? p.customerAreas : 1)
    * (p.time[s.cleaningTime] ?? 1) * (p.frequency[s.frequency] ?? 1));
}

/* ---------------------------------------------------------------- TRIN */
const opt = (value, label) => ({ value, label });

function privateSteps(s) {
  const recurring = s.frequency && s.frequency !== "one_off";
  const urgent = s.cleaningType === "urgent";
  const appliance = ["oven", "fridge", "freezer"].some((k) => has(s, k));
  const deep = s.cleaningType === "deep" || has(s, "deep_cleaning");

  const details = [
    ...(s.pets === "yes" ? [{ name: "petType", label: "Hvilket kæledyr har du?", help: "Så vi kan sætte tid af til hår og lugt.", type: "options", required: true,
      options: [opt("cat", "Kat"), opt("dog", "Hund"), opt("several", "Flere kæledyr"), opt("other", "Andet")] }] : []),
    ...(has(s, "windows") ? [{ name: "windowScope", label: "Hvor mange vinduer cirka?", type: "options", required: true,
      options: [opt("few", "Få, op til 6"), opt("standard", "Normalt, 7–14"), opt("many", "Mange, 15 eller flere")] }] : []),
    ...(has(s, "cabinets") ? [{ name: "cabinetScope", label: "Skal vi tage nogle eller alle skabe indvendigt?", type: "options", required: true,
      options: [opt("some", "Nogle skabe"), opt("all", "Alle skabe")] }] : []),
    ...(appliance ? [{ name: "applianceCondition", label: "Hvordan ser ovn, køleskab og fryser ud?", type: "options", required: true,
      options: [opt("normal", "Normalt"), opt("heavy", "Kræver ekstra tid")] }] : []),
    ...(deep ? [{ name: "deepFocus", label: "Er der steder, der især skal have en grundig omgang?", help: "Valgfrit, men det hjælper os med at sætte den rigtige tid af.", type: "textarea" }] : []),
    ...(s.cleaningType === "move" ? [{ name: "moveState", label: "Er boligen tom eller møbleret?", type: "options", required: true,
      options: [opt("empty", "Tom"), opt("furnished", "Møbleret")] }] : []),
  ];

  return [
    { id: "cleaning", title: "Hvad har du brug for?", help: "Vælg det, der passer bedst. Prisen opdateres, mens du svarer.", fields: [
      { name: "cleaningType", label: "Type rengøring", type: "options", required: true,
        options: [opt("home", "Almindelig rengøring"), opt("deep", "Hovedrengøring"), opt("move", "Flytterengøring"), opt("urgent", "Akut rengøring")] },
      { name: "frequency", label: "Hvor tit?", type: "options", required: true,
        options: [opt("one_off", "Én gang"), opt("weekly", "Hver uge"), opt("every_2_weeks", "Hver 2. uge"), opt("monthly", "Hver måned")] },
    ] },
    { id: "timing", title: urgent ? "Hvor hurtigt skal vi komme?" : "Hvornår skal vi komme?",
      help: recurring ? "Ved fast rengøring er det din ønskede første dag og dit foretrukne tidsrum." : undefined, fields: [
      { name: "urgency", label: "Tidspunkt", type: "options", required: true,
        options: [opt("asap", "Hurtigst muligt"), opt("tomorrow", "I morgen"), ...(urgent ? [] : [opt("planned", "En bestemt dato")]), opt("flexible", "Fleksibelt")] },
      ...(s.urgency === "planned" && !urgent ? [{ name: "preferredDate", label: "Ønsket dato", type: "date", required: true }] : []),
      { name: "timeWindow", label: "Tidsrum", type: "select",
        options: [opt("", "Vælg tidsrum"), opt("08-12", "Formiddag, 08–12"), opt("12-16", "Eftermiddag, 12–16"), opt("16-20", "Aften, 16–20"), opt("20-24", "Sen aften, 20–24"), opt("flex", "Fleksibelt")] },
    ] },
    { id: "home", title: "Fortæl om din bolig", fields: [
      { name: "sqm", label: "Kvadratmeter", type: "range", min: 30, max: 300, step: 5, unit: "m²", required: true },
      { name: "rooms", label: "Antal rum", type: "number", min: 1, max: 12, required: true },
      { name: "bathrooms", label: "Antal badeværelser", type: "number", min: 1, max: 6, required: true },
    ] },
    { id: "condition", title: deep ? "Hvor grundigt skal vi gå til værks?" : "Hvor meget skal der gøres?", help: "Et cirka svar er nok.", fields: [
      { name: "kitchenCondition", label: "Køkkenet", type: "options",
        options: [opt("light", "Let"), opt("normal", "Normalt"), opt("heavy", "Kræver ekstra tid"), opt("deep", "Skal have en hovedrengøring")] },
      { name: "bathroomCondition", label: "Badeværelset", type: "options",
        options: [opt("light", "Let"), opt("normal", "Normalt"), opt("heavy", "Kræver ekstra tid"), opt("deep", "Skal have en hovedrengøring")] },
    ] },
    { id: "extras", title: "Tilvalg", help: "Vælg kun det, der skal med denne gang.", fields: [
      { name: "pets", label: "Har du kæledyr?", type: "options", options: [opt("no", "Nej"), opt("yes", "Ja")] },
      { name: "extras", label: "Ekstra opgaver", type: "checkboxes",
        options: [opt("oven", "Ovn"), opt("fridge", "Køleskab"), opt("freezer", "Fryser"), opt("windows", "Vinduespudsning"), opt("cabinets", "Skabe indvendigt"), opt("deep_cleaning", "Ekstra grundig rengøring")] },
    ] },
    ...(details.length ? [{ id: "extra-details", title: "Lidt mere om dine tilvalg", help: "Kun det, der påvirker tid og pris.", fields: details }] : []),
    ...(recurring ? [{ id: "routine", title: "Din faste rengøring", fields: [
      { name: "routineNotes", label: "Hvad skal vi altid prioritere, og er der noget, vi skal undgå?", type: "textarea" },
    ] }] : []),
    addressStep("Hvor skal vi gøre rent?"),
    { id: "contact", title: "Dine kontaktoplysninger", fields: [
      { name: "name", label: "Navn", type: "text", required: true, placeholder: "Fx Anna Jensen", autocomplete: "name" },
      { name: "email", label: "E-mail", type: "email", required: true, placeholder: "anna@eksempel.dk", autocomplete: "email" },
      { name: "phone", label: "Telefon", type: "tel", required: true, placeholder: "12 34 56 78", autocomplete: "tel" },
    ] },
    notesStep(),
  ];
}

function businessSteps() {
  return [
    { id: "business", title: "Hvilken slags virksomhed?", help: "Vælg det, der passer bedst. Prisen opdateres, mens du svarer.", fields: [
      { name: "businessType", label: "Type virksomhed", type: "options", required: true,
        options: [opt("office", "Kontor"), opt("warehouse", "Lager"), opt("gym", "Fitnesscenter"), opt("bar", "Natklub eller bar"), opt("restaurant", "Restaurant eller café"), opt("clinic", "Klinik eller butik"), opt("other", "Andet")] },
      { name: "cleaningNeed", label: "Hvad skal vi gøre rent?", type: "text", required: true, placeholder: "Fx kontor på 2 etager med kantine" },
    ] },
    { id: "routine", title: "Hvor tit og hvornår?", fields: [
      { name: "frequency", label: "Hvor tit?", type: "options", required: true,
        options: [opt("one_off", "Én gang"), opt("daily", "Hver dag"), opt("multiple_weekly", "Flere gange om ugen"), opt("weekly", "Hver uge"), opt("monthly", "Hver måned")] },
      { name: "cleaningTime", label: "Hvornår på dagen?", type: "options", required: true,
        options: [opt("morning", "Morgen"), opt("daytime", "Dagtimer"), opt("evening", "Aften"), opt("night", "Nat"), opt("flexible", "Fleksibelt")] },
    ] },
    { id: "space", title: "Hvor store er lokalerne?", fields: [
      { name: "sqm", label: "Kvadratmeter", type: "range", min: 40, max: 1200, step: 10, unit: "m²", required: true },
      { name: "toilets", label: "Toiletter og badeværelser", type: "number", min: 0, max: 30, required: true },
      { name: "kitchens", label: "Køkkener og fællesrum", type: "number", min: 0, max: 20, required: true },
    ] },
    { id: "requirements", title: "Krav og adgang", fields: [
      { name: "customerAreas", label: "Er der områder, kunderne kommer i?", type: "options", options: [opt("no", "Nej"), opt("yes", "Ja")] },
      { name: "hygiene", label: "Er der særlige hygiejnekrav?", type: "options", options: [opt("no", "Nej"), opt("yes", "Ja")] },
      { name: "access", label: "Hvordan kommer vi ind?", type: "textarea", placeholder: "Fx nøgleboks, alarmkode udleveres ved opstart" },
    ] },
    { id: "extras", title: "Tilvalg", help: "Vælg kun det, der skal med.", fields: [
      { name: "extras", label: "Ekstra opgaver", type: "checkboxes",
        options: [opt("windows", "Vinduespudsning"), opt("deep_cleaning", "Hovedrengøring"), opt("fridge_freezer", "Køl og frys"), opt("oven", "Ovn"),
          opt("staircase", "Trappevask"), opt("linen", "Håndklæder og linned"), opt("event", "Rengøring efter et arrangement"), opt("urgent", "Akut udrykning")] },
    ] },
    addressStep("Hvor ligger lokalerne?"),
    { id: "contact", title: "Kontaktperson", fields: [
      { name: "company", label: "Virksomhedens navn", type: "text", required: true, placeholder: "Fx Firma ApS", autocomplete: "organization" },
      { name: "name", label: "Dit navn", type: "text", required: true, autocomplete: "name" },
      { name: "email", label: "E-mail", type: "email", required: true, autocomplete: "email" },
      { name: "phone", label: "Telefon", type: "tel", required: true, autocomplete: "tel" },
    ] },
    notesStep(),
  ];
}

function addressStep(title) {
  return { id: "address", title, fields: [
    { name: "street", label: "Vej og husnummer", type: "text", required: true, autocomplete: "street-address" },
    { name: "postal", label: "Postnummer", type: "text", required: true, autocomplete: "postal-code", short: true },
    { name: "city", label: "By", type: "text", required: true, autocomplete: "address-level2", short: true },
  ] };
}

function notesStep() {
  return { id: "notes", title: "Sidste detaljer", help: "Prisen er et uforpligtende estimat. Vi bekræfter den endelige pris og tid, før noget bliver booket.", fields: [
    { name: "discountCode", label: "Rabatkode", type: "text", help: "Prisen ændrer sig ikke med det samme. Vi trækker rabatten fra, når vi sender den endelige pris." },
    { name: "notes", label: "Er der andet, vi skal vide?", type: "textarea" },
  ] };
}

/* ---------------------------------------------------------------- BEREGNER */
const kr = (n) => n.toLocaleString("da-DK") + " kr.";
const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function initQuote(root) {
  const type = root.dataset.type === "business" ? "business" : "private";
  const estimate = type === "private" ? estimatePrivate : estimateBusiness;
  const stepsFor = type === "private" ? privateSteps : businessSteps;
  const state = type === "private"
    ? { sqm: 90, rooms: 3, bathrooms: 1, cleaningType: "home", frequency: "one_off", urgency: "planned", kitchenCondition: "normal", bathroomCondition: "normal", pets: "no", extras: [] }
    : { sqm: 180, toilets: 2, kitchens: 1, frequency: "weekly", cleaningTime: "daytime", customerAreas: "no", hygiene: "no", extras: [] };
  let index = 0;

  root.innerHTML = `
    <div class="quote">
      <aside class="quote__side" aria-label="Dit estimat">
        <div class="quote__estimate">
          <p class="quote__progress"></p>
          <p class="quote__label">Dit estimat</p>
          <p class="quote__price" aria-live="polite"></p>
          <p class="quote__note">${type === "private"
            ? "Inkl. moms. Uforpligtende estimat. Vi bekræfter den endelige pris, før noget bliver booket."
            : "Ekskl. moms. Uforpligtende estimat. Vi bekræfter den endelige pris, før noget bliver booket."}</p>
        </div>
        <div class="quote__left">
          <p class="quote__left-title">Det mangler</p>
          <ol class="quote__left-list"></ol>
        </div>
      </aside>
      <form class="quote__form" novalidate>
        <div class="quote__step"></div>
        <p class="quote__error" role="alert"></p>
        <div class="quote__nav">
          <button type="button" class="btn btn--ghost-dark quote__back">Tilbage</button>
          <button type="submit" class="btn quote__next">Næste</button>
        </div>
      </form>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const form = $(".quote__form");

  function range(value) {
    return `${kr(round25(value * 0.9))} – ${kr(round25(value * 1.1))}`;
  }

  function delta(field, value) {
    const now = estimate(state);
    const trial = { ...state };
    if (field.type === "checkboxes") {
      const list = new Set(state.extras);
      list.has(value) ? list.delete(value) : list.add(value);
      trial.extras = [...list];
      if (list.has(value)) {
        const d = estimate(trial) - now;
        return d === 0 ? "Samme pris" : `+${kr(d)}`;
      }
      return "Valgt";
    }
    trial[field.name] = value;
    const d = estimate(trial) - now;
    if (state[field.name] === value) return "Valgt";
    return d === 0 ? "Samme pris" : `${d > 0 ? "+" : "−"}${kr(Math.abs(d))}`;
  }

  function fieldHTML(f) {
    const id = `q-${f.name}`;
    const req = f.required ? ' <span class="quote__req">Skal udfyldes</span>' : "";
    const help = f.help ? `<p class="quote__help">${f.help}</p>` : "";
    const v = esc(state[f.name] ?? "");

    if (f.type === "options" || f.type === "checkboxes") {
      const multi = f.type === "checkboxes";
      const buttons = f.options.map((o) => {
        const on = multi ? state.extras.includes(o.value) : v === o.value;
        return `<button type="button" class="quote__opt" data-field="${f.name}" data-value="${o.value}" aria-pressed="${on}">
          <span class="quote__opt-label">${o.label}</span><span class="quote__opt-delta">${delta(f, o.value)}</span></button>`;
      }).join("");
      return `<fieldset class="quote__field"><legend>${f.label}${req}</legend>${help}<div class="quote__opts${multi ? " quote__opts--multi" : ""}">${buttons}</div></fieldset>`;
    }
    if (f.type === "range") {
      return `<div class="quote__field"><label for="${id}">${f.label}${req}</label>${help}
        <div class="quote__range"><input id="${id}" name="${f.name}" type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}">
        <output for="${id}">${v} ${f.unit}</output></div></div>`;
    }
    if (f.type === "number") {
      return `<div class="quote__field quote__field--short"><label for="${id}">${f.label}${req}</label>${help}
        <div class="quote__stepper"><button type="button" data-step="-1" data-for="${f.name}" aria-label="Færre">−</button>
        <input id="${id}" name="${f.name}" type="number" inputmode="numeric" min="${f.min}" max="${f.max}" value="${v}">
        <button type="button" data-step="1" data-for="${f.name}" aria-label="Flere">+</button></div></div>`;
    }
    if (f.type === "select") {
      const opts = f.options.map((o) => `<option value="${o.value}"${o.value === v ? " selected" : ""}>${o.label}</option>`).join("");
      return `<div class="quote__field"><label for="${id}">${f.label}${req}</label>${help}<select id="${id}" name="${f.name}">${opts}</select></div>`;
    }
    if (f.type === "textarea") {
      return `<div class="quote__field"><label for="${id}">${f.label}${req}</label>${help}<textarea id="${id}" name="${f.name}" placeholder="${f.placeholder || ""}">${v}</textarea></div>`;
    }
    const min = f.type === "date" ? ` min="${new Date().toISOString().slice(0, 10)}"` : "";
    return `<div class="quote__field${f.short ? " quote__field--short" : ""}"><label for="${id}">${f.label}${req}</label>${help}
      <input id="${id}" name="${f.name}" type="${f.type}" value="${v}" placeholder="${f.placeholder || ""}"${f.autocomplete ? ` autocomplete="${f.autocomplete}"` : ""}${min}></div>`;
  }

  function render(focus) {
    const steps = stepsFor(state);
    index = Math.min(index, steps.length - 1);
    const step = steps[index];
    $(".quote__progress").textContent = `Trin ${index + 1} af ${steps.length}`;
    $(".quote__price").textContent = range(estimate(state));
    $(".quote__left-list").innerHTML = steps.slice(index + 1).map((s) => `<li>${s.title}</li>`).join("") || "<li>Intet. Send din forespørgsel.</li>";
    $(".quote__step").innerHTML = `<h2 class="quote__title" tabindex="-1">${step.title}</h2>${step.help ? `<p class="quote__intro">${step.help}</p>` : ""}${step.fields.map(fieldHTML).join("")}`;
    $(".quote__back").hidden = index === 0;
    $(".quote__next").textContent = index === steps.length - 1 ? "Send forespørgsel" : "Næste";
    $(".quote__error").textContent = "";
    if (focus) $(".quote__title").focus();
  }

  function refreshPrices() {
    // opdater kun priser og valgte knapper – så fokus bliver, hvor brugeren er
    const steps = stepsFor(state);
    const currentIds = steps[index].fields.map((f) => f.name).join();
    const shownIds = [...root.querySelectorAll(".quote__step [name], .quote__step [data-field]")].map((e) => e.name || e.dataset.field);
    if (currentIds.split(",").some((n) => !shownIds.includes(n)) || shownIds.some((n) => !currentIds.split(",").includes(n))) {
      render(false);
      return;
    }
    $(".quote__progress").textContent = `Trin ${index + 1} af ${steps.length}`;
    $(".quote__price").textContent = range(estimate(state));
    $(".quote__left-list").innerHTML = steps.slice(index + 1).map((s) => `<li>${s.title}</li>`).join("");
    steps[index].fields.forEach((f) => {
      if (f.type !== "options" && f.type !== "checkboxes") return;
      root.querySelectorAll(`.quote__opt[data-field="${f.name}"]`).forEach((b) => {
        const on = f.type === "checkboxes" ? state.extras.includes(b.dataset.value) : state[f.name] === b.dataset.value;
        b.setAttribute("aria-pressed", String(on));
        b.querySelector(".quote__opt-delta").textContent = delta(f, b.dataset.value);
      });
    });
  }

  root.addEventListener("click", (e) => {
    const optBtn = e.target.closest(".quote__opt");
    if (optBtn) {
      const name = optBtn.dataset.field;
      const value = optBtn.dataset.value;
      if (name === "extras") {
        const list = new Set(state.extras);
        list.has(value) ? list.delete(value) : list.add(value);
        state.extras = [...list];
      } else {
        state[name] = value;
      }
      refreshPrices();
      return;
    }
    const stepBtn = e.target.closest("[data-step]");
    if (stepBtn) {
      const input = root.querySelector(`[name="${stepBtn.dataset.for}"]`);
      const next = Math.min(Number(input.max), Math.max(Number(input.min), num(input.value, 0) + Number(stepBtn.dataset.step)));
      input.value = next;
      state[input.name] = next;
      refreshPrices();
      return;
    }
    if (e.target.closest(".quote__back")) {
      index = Math.max(0, index - 1);
      render(true);
    }
  });

  root.addEventListener("input", (e) => {
    const el = e.target;
    if (!el.name) return;
    state[el.name] = el.type === "range" || el.type === "number" ? Number(el.value) : el.value;
    if (el.type === "range") el.nextElementSibling.textContent = `${el.value} m²`;
    if (el.type === "range" || el.type === "number") refreshPrices();
  });

  function missing(step) {
    for (const f of step.fields) {
      if (!f.required) continue;
      const v = f.type === "checkboxes" ? state.extras : state[f.name];
      if (v === undefined || v === null || String(v).trim() === "" || (Array.isArray(v) && !v.length)) return f;
      if (f.type === "options" && !f.options.some((o) => o.value === v)) return f;
      if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())) return { ...f, label: `${f.label} (skriv en gyldig e-mail)` };
    }
    return null;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const steps = stepsFor(state);
    const miss = missing(steps[index]);
    if (miss) {
      $(".quote__error").textContent = `Udfyld venligst: ${miss.label}.`;
      const el = root.querySelector(`[name="${miss.name}"], [data-field="${miss.name}"]`);
      if (el) el.focus();
      return;
    }
    if (index < steps.length - 1) {
      index += 1;
      render(true);
      return;
    }
    send(steps);
  });

  function send(steps) {
    const lines = [];
    steps.forEach((step) => step.fields.forEach((f) => {
      let v = f.type === "checkboxes" ? state.extras : state[f.name];
      if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) return;
      if (f.options) {
        const labels = (Array.isArray(v) ? v : [v]).map((x) => (f.options.find((o) => o.value === x) || {}).label || x);
        v = labels.join(", ");
      }
      if (f.unit) v = `${v} ${f.unit}`;
      lines.push(`${f.label}: ${v}`);
    }));
    const price = range(estimate(state));
    const who = state.company ? `${state.company} (${state.name})` : state.name;
    const subject = `${type === "private" ? "Prisforespørgsel, privat" : "Prisforespørgsel, erhverv"} – ${who}`;
    const body = [`Estimat på hjemmesiden: ${price} (${type === "private" ? "inkl." : "ekskl."} moms)`, "", ...lines].join("\n");

    window.location.href = `mailto:${QUOTE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    $(".quote__step").innerHTML = `<h2 class="quote__title" tabindex="-1">Tak for din forespørgsel</h2>
      <p class="quote__intro">Dit mailprogram åbner nu med alle dine svar udfyldt. Tryk send, så vender vi tilbage med en endelig pris og et forslag til tid.</p>
      <p class="quote__intro">Åbnede mailen ikke? Ring på <a href="tel:+4522484767">22 48 47 67</a>, eller skriv til <a href="mailto:${QUOTE_EMAIL}">${QUOTE_EMAIL}</a>.</p>`;
    $(".quote__nav").hidden = true;
    $(".quote__title").focus();
  }

  render(false);
}

const quoteRoot = document.getElementById("quote");
if (quoteRoot) initQuote(quoteRoot);

// Gør beregningerne tilgængelige for test i browserens konsol
window.NFCQuote = { estimatePrivate, estimateBusiness, PRISER };
