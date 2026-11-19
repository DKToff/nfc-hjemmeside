/* ==========================================================================
   Nordic Facility Cleaning (NFC) – fælles JavaScript
   1. Mobilmenu
   2. Faner (Privat hjem: "Det gør vi i hvert rum")
   3. Kontaktformular
   4. Årstal i footeren
   ========================================================================== */

/* E-mailadressen, som henvendelser fra formularen sendes til */
const KONTAKT_EMAIL = "nordicfacilitycleaning@gmail.com";

/* 1. Mobilmenu ------------------------------------------------------------- */
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav");

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      nav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.focus();
    }
  });
}

/* 2. Faner ------------------------------------------------------------------ */
document.querySelectorAll(".tabs").forEach((tabs) => {
  const tabButtons = Array.from(tabs.querySelectorAll('[role="tab"]'));

  function selectTab(tab) {
    tabButtons.forEach((button) => {
      const selected = button === tab;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      document.getElementById(button.getAttribute("aria-controls")).hidden = !selected;
    });
  }

  tabButtons.forEach((button, index) => {
    button.addEventListener("click", () => selectTab(button));

    // Piletaster skifter mellem fanerne
    button.addEventListener("keydown", (event) => {
      let next = null;
      if (event.key === "ArrowRight") next = tabButtons[(index + 1) % tabButtons.length];
      if (event.key === "ArrowLeft") next = tabButtons[(index - 1 + tabButtons.length) % tabButtons.length];
      if (next) {
        event.preventDefault();
        selectTab(next);
        next.focus();
      }
    });
  });
});

/* 3. Kontaktformular ---------------------------------------------------------
   Siden har ingen server bag sig. Formularen åbner derfor brugerens mailprogram
   med beskeden skrevet på forhånd. Når siden kommer online, kan du i stedet
   koble formularen til en formular-tjeneste eller din egen server.           */
const form = document.querySelector("#kontaktformular");

if (form) {
  const status = form.querySelector(".form__status");

  function setError(input, message) {
    const error = form.querySelector(`#${input.id}-fejl`);
    input.setAttribute("aria-invalid", message ? "true" : "false");
    if (error) error.textContent = message;
  }

  function validate() {
    let firstInvalid = null;

    const navn = form.elements.navn;
    const email = form.elements.email;
    const besked = form.elements.besked;

    const checks = [
      [navn, navn.value.trim() ? "" : "Skriv dit navn."],
      [email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? "" : "Skriv en gyldig e-mailadresse, fx navn@eksempel.dk."],
      [besked, besked.value.trim() ? "" : "Skriv kort, hvad du har brug for."],
    ];

    checks.forEach(([input, message]) => {
      setError(input, message);
      if (message && !firstInvalid) firstInvalid = input;
    });

    return firstInvalid;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    status.textContent = "";

    const firstInvalid = validate();
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const data = new FormData(form);
    const subject = `Henvendelse fra hjemmesiden – ${data.get("type")}`;
    const body = [
      `Navn: ${data.get("navn")}`,
      `E-mail: ${data.get("email")}`,
      `Telefon: ${data.get("telefon") || "ikke oplyst"}`,
      `Henvendelsen gælder: ${data.get("type")}`,
      "",
      data.get("besked"),
    ].join("\n");

    window.location.href =
      `mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    status.textContent = "Dit mailprogram åbner nu med beskeden klar. Tryk send for at sende den til os.";
  });
}

/* 4. Årstal i footeren -------------------------------------------------------- */
document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});
