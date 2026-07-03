/* =====================================================================
   MARROW & TYPE — script.js
   =====================================================================
   This is the "behaviour" layer: it listens for things the user does
   (clicks, form submits) and reacts to them by reading/writing the DOM
   (the live in-memory version of the HTML the browser renders).

   This file is an ES MODULE (note type="module" on the <script> tag in
   index.html). Modules let us use `import` to pull in outside code —
   here, the Zod validation library — without a build tool/bundler.
   ===================================================================== */

// -----------------------------------------------------------------------
// IMPORT: Zod, loaded straight from a CDN as an ES Module.
// jsDelivr's "+esm" flag auto-converts the npm package into a browser-
// ready ES module, so no npm install / bundler is required for this
// plain HTML+CSS+JS project. Swap the version number here if you ever
// want to upgrade.
// -----------------------------------------------------------------------
import { z } from "https://cdn.jsdelivr.net/npm/zod@3.23.8/+esm";

// -----------------------------------------------------------------------
// SECTION 1: MOBILE NAV TOGGLE
// A small, self-contained example of vanilla JS DOM interaction:
// grab elements, listen for a click, flip some state.
// -----------------------------------------------------------------------
const navToggle = document.getElementById("nav-toggle");
const primaryNav = document.getElementById("primary-nav");

navToggle.addEventListener("click", () => {
  // .toggle() adds the class if it's missing, removes it if present,
  // and conveniently RETURNS whether the class ended up present —
  // handy for immediately syncing the aria-expanded attribute below.
  const isOpen = primaryNav.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

// If someone opens the mobile menu, clicks a link, we should close the
// menu again rather than leaving it awkwardly open behind the new page/
// scroll position.
primaryNav.addEventListener("click", (event) => {
  if (event.target.tagName === "A") {
    primaryNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

// -----------------------------------------------------------------------
// SECTION 2: FOOTER YEAR
// A one-line demo of reading the current date and writing text into
// the DOM, so the copyright year never has to be hand-updated.
// -----------------------------------------------------------------------
document.getElementById("current-year").textContent = new Date().getFullYear();

// -----------------------------------------------------------------------
// SECTION 3: CONTACT FORM — Zod schema, honeypot check, Web3Forms submit
// -----------------------------------------------------------------------

const form = document.getElementById("contact-form");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("form-status");

/*
  ZOD SCHEMA
  Zod lets us describe "what a valid submission looks like" as data,
  instead of writing a pile of manual if/else checks. `z.object({...})`
  describes an object shape; each field describes its own rules and
  custom error messages. `.trim()` runs before the checks after it,
  stripping stray leading/trailing whitespace (e.g. someone pastes
  "  Jane Doe  ").
*/
const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter at least 2 characters.")
    .max(80, "That name looks too long — 80 characters max."),

  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Please enter a valid email address."),

  subject: z
    .string()
    .trim()
    .min(3, "Please enter at least 3 characters.")
    .max(120, "That subject looks too long — 120 characters max."),

  message: z
    .string()
    .trim()
    .min(10, "Please tell us a bit more — at least 10 characters.")
    .max(1000, "That's a lot! Please keep it under 1000 characters."),
});

/**
 * Reads the current values out of the form fields and returns them as
 * a plain JS object shaped to match `contactSchema`.
 */
function getFormValues() {
  return {
    name: form.elements.name.value,
    email: form.elements.email.value,
    subject: form.elements.subject.value,
    message: form.elements.message.value,
  };
}

/**
 * Clears every previously-shown field error and removes the
 * ".invalid" styling hook from each form-row.
 */
function clearFieldErrors() {
  form.querySelectorAll(".field-error").forEach((el) => {
    el.textContent = "";
  });
  form.querySelectorAll(".form-row").forEach((el) => {
    el.classList.remove("invalid");
  });
}

/**
 * Takes the `error` object Zod returns from a failed `safeParse()` and
 * writes each issue's message into the matching <span class="field-error">,
 * using the issue's `path` (e.g. ["email"]) to find the right field.
 */
function showFieldErrors(zodError) {
  for (const issue of zodError.issues) {
    const fieldName = issue.path[0];
    const errorEl = document.getElementById(`${fieldName}-error`);
    const rowEl = errorEl?.closest(".form-row");
    if (errorEl) errorEl.textContent = issue.message;
    if (rowEl) rowEl.classList.add("invalid");
  }
}

/**
 * Updates the general status line below the submit button.
 * `state` controls the color via the [data-state] CSS hook.
 */
function setStatus(message, state) {
  statusEl.textContent = message;
  statusEl.dataset.state = state ?? "";
}

form.addEventListener("submit", async (event) => {
  // Forms submit (and reload the page) by default — preventDefault()
  // stops that so we can handle everything with JS + fetch instead.
  event.preventDefault();

  clearFieldErrors();
  setStatus("", "");

  // ---- HONEYPOT CHECK -------------------------------------------------
  // Real visitors never see or fill in #botcheck (see the CSS that
  // hides it). If it's checked/filled, we assume a bot filled the form
  // programmatically and quietly stop here — we don't even tell the
  // "user" anything went wrong, since a bot doesn't care either way,
  // and no real network request needs to be sent.
  if (form.elements.botcheck.checked) {
    console.warn("Honeypot triggered — submission treated as spam and blocked.");
    return;
  }

  // ---- ZOD VALIDATION ---------------------------------------------------
  const values = getFormValues();
  const result = contactSchema.safeParse(values);

  if (!result.success) {
    // result.error is a ZodError containing every failed rule, so we
    // can show ALL problems at once instead of one-at-a-time.
    showFieldErrors(result.error);
    setStatus("Please fix the highlighted fields.", "error");
    return;
  }

  // ---- SUBMIT TO WEB3FORMS ----------------------------------------------
  const accessKey = form.elements.access_key.value;
  if (!accessKey || accessKey === "YOUR_WEB3FORMS_ACCESS_KEY_HERE") {
    // Friendly reminder while you're still setting the project up —
    // remove this check once your real key is pasted in index.html.
    setStatus("Add your Web3Forms access key in index.html before going live.", "error");
    return;
  }

  submitBtn.disabled = true;
  setStatus("Sending…", "");

  try {
    // FormData automatically gathers every named field in the form
    // (including the hidden access_key and honeypot), which is exactly
    // the shape Web3Forms' API expects.
    const formData = new FormData(form);

    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      setStatus("Thanks — your message has been sent!", "success");
      form.reset();
    } else {
      // Web3Forms reached us but reported a problem (e.g. bad access key).
      setStatus(data.message || "Something went wrong. Please try again.", "error");
    }
  } catch (networkError) {
    // fetch() only throws for network-level failures (offline, DNS,
    // CORS, etc.) — a normal 4xx/5xx response still resolves the
    // promise, which is why that case is handled above instead.
    console.error(networkError);
    setStatus("Network error — please check your connection and try again.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});


/* =====================================================================
   MARROW & TYPE — script.js
   =====================================================================
   This is the "behaviour" layer: it listens for things the user does
   (clicks, form submits) and reacts to them by reading/writing the DOM
   (the live in-memory version of the HTML the browser renders).

   This file is an ES MODULE (note type="module" on the <script> tag in
   index.html). Modules let us use `import` to pull in outside code —
   here, the Zod validation library — without a build tool/bundler.
   ===================================================================== */

// -----------------------------------------------------------------------
// IMPORT: Zod, loaded straight from a CDN as an ES Module.
// jsDelivr's "+esm" flag auto-converts the npm package into a browser-
// ready ES module, so no npm install / bundler is required for this
// plain HTML+CSS+JS project. Swap the version number here if you ever
// want to upgrade.
// -----------------------------------------------------------------------
import { z } from "https://cdn.jsdelivr.net/npm/zod@3.23.8/+esm";

// -----------------------------------------------------------------------
// SECTION 1: MOBILE NAV TOGGLE
// A small, self-contained example of vanilla JS DOM interaction:
// grab elements, listen for a click, flip some state.
// -----------------------------------------------------------------------
const navToggle = document.getElementById("nav-toggle");
const primaryNav = document.getElementById("primary-nav");

navToggle.addEventListener("click", () => {
  // .toggle() adds the class if it's missing, removes it if present,
  // and conveniently RETURNS whether the class ended up present —
  // handy for immediately syncing the aria-expanded attribute below.
  const isOpen = primaryNav.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

// If someone opens the mobile menu, clicks a link, we should close the
// menu again rather than leaving it awkwardly open behind the new page/
// scroll position.
primaryNav.addEventListener("click", (event) => {
  if (event.target.tagName === "A") {
    primaryNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

// -----------------------------------------------------------------------
// SECTION 2: FOOTER YEAR
// A one-line demo of reading the current date and writing text into
// the DOM, so the copyright year never has to be hand-updated.
// -----------------------------------------------------------------------
document.getElementById("current-year").textContent = new Date().getFullYear();

// -----------------------------------------------------------------------
// SECTION 3: CONTACT FORM — Zod schema, honeypot check, Web3Forms submit
// -----------------------------------------------------------------------

const form = document.getElementById("contact-form");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("form-status");

/*
  ZOD SCHEMA
  Zod lets us describe "what a valid submission looks like" as data,
  instead of writing a pile of manual if/else checks. `z.object({...})`
  describes an object shape; each field describes its own rules and
  custom error messages. `.trim()` runs before the checks after it,
  stripping stray leading/trailing whitespace (e.g. someone pastes
  "  Jane Doe  ").
*/
const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter at least 2 characters.")
    .max(80, "That name looks too long — 80 characters max."),

  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Please enter a valid email address."),

  subject: z
    .string()
    .trim()
    .min(3, "Please enter at least 3 characters.")
    .max(120, "That subject looks too long — 120 characters max."),

  message: z
    .string()
    .trim()
    .min(10, "Please tell us a bit more — at least 10 characters.")
    .max(1000, "That's a lot! Please keep it under 1000 characters."),
});

/**
 * Reads the current values out of the form fields and returns them as
 * a plain JS object shaped to match `contactSchema`.
 */
function getFormValues() {
  return {
    name: form.elements.name.value,
    email: form.elements.email.value,
    subject: form.elements.subject.value,
    message: form.elements.message.value,
  };
}

/**
 * Clears every previously-shown field error and removes the
 * ".invalid" styling hook from each form-row.
 */
function clearFieldErrors() {
  form.querySelectorAll(".field-error").forEach((el) => {
    el.textContent = "";
  });
  form.querySelectorAll(".form-row").forEach((el) => {
    el.classList.remove("invalid");
  });
}

/**
 * Takes the `error` object Zod returns from a failed `safeParse()` and
 * writes each issue's message into the matching <span class="field-error">,
 * using the issue's `path` (e.g. ["email"]) to find the right field.
 */
function showFieldErrors(zodError) {
  for (const issue of zodError.issues) {
    const fieldName = issue.path[0];
    const errorEl = document.getElementById(`${fieldName}-error`);
    const rowEl = errorEl?.closest(".form-row");
    if (errorEl) errorEl.textContent = issue.message;
    if (rowEl) rowEl.classList.add("invalid");
  }
}

/**
 * Updates the general status line below the submit button.
 * `state` controls the color via the [data-state] CSS hook.
 */
function setStatus(message, state) {
  statusEl.textContent = message;
  statusEl.dataset.state = state ?? "";
}

// -----------------------------------------------------------------------
// SECTION 4: PRODUCT FILTERING (products.html only)
// This script.js file is shared by every page, but only products.html
// has a .filter-bar in its markup. Rather than maintaining a separate
// JS file per page, we just check whether the elements exist before
// wiring up behaviour for them — a common, simple pattern for small
// multi-page sites that share one script file.
// -----------------------------------------------------------------------
const filterBar = document.querySelector(".filter-bar");

if (filterBar) {
  const filterButtons = filterBar.querySelectorAll(".filter-btn");
  const productCards = document.querySelectorAll(".product-card");
  const emptyState = document.getElementById("empty-state");

  filterBar.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-btn");
    if (!button) return; // click landed on the bar but not a button

    const selectedCategory = button.dataset.filter; // e.g. "wedding" or "all"

    // Move the .is-active styling hook to whichever button was clicked.
    filterButtons.forEach((btn) => btn.classList.remove("is-active"));
    button.classList.add("is-active");

    // Show a card if it matches the selected category, or if "all" is
    // selected. We use the native `hidden` HTML attribute rather than a
    // custom CSS class here — `hidden` is built into the platform and
    // is understood by assistive tech automatically (a hidden card is
    // skipped by screen readers too, which a CSS-only trick wouldn't
    // guarantee).
    let visibleCount = 0;
    productCards.forEach((card) => {
      const matches = selectedCategory === "all" || card.dataset.category === selectedCategory;
      card.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    // Toggle the "nothing here" message based on whether anything matched.
    emptyState.hidden = visibleCount !== 0;
  });
}

// Only index.html (so far) has a #contact-form in its markup, so `form`
// will be `null` on every other page. Guarding the whole block with
// `if (form)` means script.js can be shared by all five pages without
// throwing "cannot read properties of null" errors on the ones that
// don't have a contact form yet.
if (form) {
  form.addEventListener("submit", async (event) => {
    // Forms submit (and reload the page) by default — preventDefault()
    // stops that so we can handle everything with JS + fetch instead.
    event.preventDefault();

    clearFieldErrors();
    setStatus("", "");

    // ---- HONEYPOT CHECK -------------------------------------------------
    // Real visitors never see or fill in #botcheck (see the CSS that
    // hides it). If it's checked/filled, we assume a bot filled the form
    // programmatically and quietly stop here — we don't even tell the
    // "user" anything went wrong, since a bot doesn't care either way,
    // and no real network request needs to be sent.
    if (form.elements.botcheck.checked) {
      console.warn("Honeypot triggered — submission treated as spam and blocked.");
      return;
    }

    // ---- ZOD VALIDATION ---------------------------------------------------
    const values = getFormValues();
    const result = contactSchema.safeParse(values);

    if (!result.success) {
      // result.error is a ZodError containing every failed rule, so we
      // can show ALL problems at once instead of one-at-a-time.
      showFieldErrors(result.error);
      setStatus("Please fix the highlighted fields.", "error");
      return;
    }

    // ---- SUBMIT TO WEB3FORMS ----------------------------------------------
    const accessKey = form.elements.access_key.value;
    if (!accessKey || accessKey === "YOUR_WEB3FORMS_ACCESS_KEY_HERE") {
      // Friendly reminder while you're still setting the project up —
      // remove this check once your real key is pasted in index.html.
      setStatus("Add your Web3Forms access key in index.html before going live.", "error");
      return;
    }

    submitBtn.disabled = true;
    setStatus("Sending…", "");

    try {
      // FormData automatically gathers every named field in the form
      // (including the hidden access_key and honeypot), which is exactly
      // the shape Web3Forms' API expects.
      const formData = new FormData(form);

      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setStatus("Thanks — your message has been sent!", "success");
        form.reset();
      } else {
        // Web3Forms reached us but reported a problem (e.g. bad access key).
        setStatus(data.message || "Something went wrong. Please try again.", "error");
      }
    } catch (networkError) {
      // fetch() only throws for network-level failures (offline, DNS,
      // CORS, etc.) — a normal 4xx/5xx response still resolves the
      // promise, which is why that case is handled above instead.
      console.error(networkError);
      setStatus("Network error — please check your connection and try again.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });
}