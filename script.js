// Animated Login Form — Coding Stella

const $ = (sel) => document.querySelector(sel);

const card = $("#card");
const stage = $("#stage");
const buddy = $("#buddy");
const mouth = $("#mouth");
const speech = $("#speech");
const form = $("#form");
const email = $("#email");
const emailWrap = $("#emailWrap");
const pw = $("#password");
const pwWrap = $("#pwWrap");
const toggle = $("#toggle");
const genBtn = $("#generate");
const segs = document.querySelectorAll(".seg i");
const label = $("#label");
const crack = $("#crack");
const ruleItems = document.querySelectorAll("#rules li");
const submit = $("#submit");
const toast = $("#toast");
const toastText = $("#toastText");

const LABELS = ["Start typing", "Weak", "Fair", "Good", "Strong"];
const COLORS = [null, "#ff7a7a", "#ffb35c", "#ffd34d", "#5fcf96"];
const MOODS = ["mood-empty", "mood-weak", "mood-fair", "mood-good", "mood-strong"];
const MOUTHS = [
  { curve: 3, open: 1 },    // empty
  { curve: -6, open: 1 },   // weak: frown
  { curve: 0, open: 1 },    // fair
  { curve: 6, open: 1 },    // good
  { curve: 11, open: 0.1 }, // strong: open grin
];

const eyes = [...buddy.querySelectorAll(".eye")].map((eye) => ({
  white: eye.querySelector(".white"),
  pupil: eye.querySelector(".pupil"),
  x: 0, y: 0, tx: 0, ty: 0,
}));

let focused = null;
let current = analyze("");
let lastScore = 0;
let wasValid = false;
let capsOn = false;

/* ---------- Eye tracking ---------- */

function lookAt(px, py) {
  eyes.forEach((eye) => {
    const r = eye.white.getBoundingClientRect();
    const dx = px - (r.left + r.width / 2);
    const dy = py - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy) || 1;
    const reach = 4 * Math.min(1, dist / (r.width * 4));
    eye.tx = (dx / dist) * reach;
    eye.ty = (dy / dist) * reach;
  });
}

// Measure the text before the caret to find where it sits on screen
const measure = document.createElement("canvas").getContext("2d");

function caretPoint(input) {
  const cs = getComputedStyle(input);
  measure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

  let text = input.value.slice(0, input.selectionEnd ?? input.value.length);
  if (input.type === "password") text = "•".repeat(text.length);

  const box = input.getBoundingClientRect();
  const width = measure.measureText(text).width - input.scrollLeft;
  return { x: box.left + Math.max(0, Math.min(width, box.width)), y: box.top + box.height / 2 };
}

function trackCaret() {
  if (!focused) return;
  const p = caretPoint(focused);
  lookAt(p.x, p.y);
}

// Ease pupils and mouth toward their targets every frame
const face = { curve: 3, open: 1 };

function tick() {
  eyes.forEach((eye) => {
    eye.x += (eye.tx - eye.x) * 0.2;
    eye.y += (eye.ty - eye.y) * 0.2;
    eye.pupil.setAttribute("transform", `translate(${eye.x.toFixed(2)} ${eye.y.toFixed(2)})`);
  });

  const goal = MOUTHS[current.score];
  face.curve += (goal.curve - face.curve) * 0.15;
  face.open += (goal.open - face.open) * 0.15;
  const top = (152 + face.curve).toFixed(2);
  const bottom = (152 + face.curve * face.open).toFixed(2);
  mouth.setAttribute("d", `M110 152 Q120 ${top} 130 152 Q120 ${bottom} 110 152Z`);

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Re-trigger a one-shot animation class on Mochi
const pulseTimers = {};
function pulse(cls, ms) {
  buddy.classList.remove(cls);
  void buddy.getBoundingClientRect(); // force reflow so the animation restarts
  buddy.classList.add(cls);
  clearTimeout(pulseTimers[cls]);
  pulseTimers[cls] = setTimeout(() => buddy.classList.remove(cls), ms);
}

function loop(fn, min, spread) {
  setTimeout(() => { fn(); loop(fn, min, spread); }, min + Math.random() * spread);
}

loop(() => pulse("blink", 140), 2200, 3200);
loop(() => pulse(Math.random() < 0.5 ? "twitch" : "twitch-l", 460), 3500, 4500);

/* ---------- Password strength ---------- */

const COMMON = [
  "password", "passw0rd", "123456", "12345678", "123123", "654321", "111111",
  "000000", "qwerty", "qwertyuiop", "asdf", "zxcv", "1q2w3e", "letmein", "admin",
  "welcome", "iloveyou", "monkey", "dragon", "abc123", "football", "baseball",
  "sunshine", "princess", "login", "master", "hello", "freedom", "whatever",
  "trustno1", "shadow", "superman", "batman", "secret",
];

const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s", "!": "i" };

// Catches common words, including leetspeak like "P@ssw0rd"
function isCommon(value) {
  const lower = value.toLowerCase();
  const plain = lower.replace(/[013457@$!]/g, (ch) => LEET[ch]).replace(/[^a-z]/g, "");
  return COMMON.some((word) =>
    word.length >= value.length * 0.5 && (lower.includes(word) || (plain && plain.includes(word)))
  );
}

// abc, 123, cba ...
function hasSequence(value) {
  for (let i = 0; i < value.length - 2; i++) {
    const a = value.charCodeAt(i), b = value.charCodeAt(i + 1), c = value.charCodeAt(i + 2);
    if ((b - a === 1 && c - b === 1) || (a - b === 1 && b - c === 1)) return true;
  }
  return false;
}

// Assumes an attacker making 10 billion guesses per second
function crackTime(entropy) {
  const seconds = Math.pow(2, entropy - 1) / 1e10;
  if (seconds < 1) return "instantly";
  if (seconds >= 3153600000) return "centuries";
  const units = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]];
  for (const [name, size] of units) {
    if (seconds >= size) {
      const n = Math.round(seconds / size);
      return `${n} ${name}${n > 1 ? "s" : ""}`;
    }
  }
}

function analyze(value) {
  const rules = {
    length: value.length >= 8,
    lower: /[a-z]/.test(value),
    upper: /[A-Z]/.test(value),
    number: /\d/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
    common: value.length > 0 && !isCommon(value),
  };

  if (!value) return { rules, score: 0, percent: 0, crack: "" };

  const pool = (rules.lower ? 26 : 0) + (rules.upper ? 26 : 0) + (rules.number ? 10 : 0) + (rules.symbol ? 33 : 0);
  let entropy = value.length * Math.log2(pool);
  if (/(.)\1{2,}/.test(value)) entropy *= 0.6; // repeats like "aaa"
  if (hasSequence(value)) entropy *= 0.65;
  if (!rules.common) entropy = Math.min(entropy, 18);

  let score = entropy < 28 ? 1 : entropy < 45 ? 2 : entropy < 65 ? 3 : 4;
  let percent = Math.max(8, Math.min(100, (entropy / 80) * 100));

  if (!rules.length) {
    score = Math.min(score, 2);
    percent = Math.min(percent, 50);
  }
  if (!rules.common) score = 1;

  return { rules, score, percent, crack: crackTime(entropy) };
}

/* ---------- UI ---------- */

const emailOk = () => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim());

function say(text) {
  if (speech.textContent === text) return;
  speech.textContent = text;
  speech.classList.remove("pop");
  void speech.offsetWidth;
  speech.classList.add("pop");
}

function updateSpeech() {
  if (buddy.classList.contains("covered")) {
    return say(buddy.classList.contains("peek") ? "Okay… just a tiny peek!" : "I'm not looking, promise!");
  }
  if (capsOn && focused === pw) return say("Psst… Caps Lock is on!");
  if (focused === email) {
    if (!email.value) return say("Nice to meet you! What's your email?");
    return say(emailOk() ? "Purr-fect! That email looks good." : "Hmm, I'm reading along…");
  }
  if (focused === pw || pw.value) {
    const lines = [
      "Now the secret part. Make it strong!",
      current.rules.common ? "Way too easy. Even I could guess that!" : "Everyone uses that one. Be original!",
      "Getting there! Mix in more variety.",
      "Nice! A little longer makes it great.",
      "Rock solid! Nobody's cracking that.",
    ];
    return say(lines[current.score]);
  }
  say("Hi, I'm Mochi! Let's make a strong password.");
}

function update() {
  current = analyze(pw.value);
  const hasValue = pw.value.length > 0;
  const valid = emailOk();
  const onEmail = focused === email;

  // Meter, label, checklist
  if (current.score) card.style.setProperty("--meter", COLORS[current.score]);
  else card.style.removeProperty("--meter");

  segs.forEach((seg, i) => {
    const part = Math.max(0, Math.min(1, (current.percent - i * 25) / 25));
    seg.style.width = `${part * 100}%`;
  });

  label.textContent = LABELS[current.score];
  crack.textContent = hasValue ? `Crack time: ${current.crack}` : "";
  ruleItems.forEach((li) => li.classList.toggle("ok", current.rules[li.dataset.rule]));

  // Mochi's mood
  buddy.classList.remove(...MOODS);
  buddy.classList.add(MOODS[current.score]);
  if (current.score === 4 && lastScore < 4) pulse("happy", 1300);
  lastScore = current.score;

  // Paws cover the eyes only while the password is visible, never on the email
  buddy.classList.toggle("covered", pw.type === "text" && !onEmail);
  if (!buddy.classList.contains("covered")) buddy.classList.remove("peek");

  // Email: tilt while typing, wink + thumbs up once valid
  emailWrap.classList.toggle("is-valid", valid);
  buddy.classList.toggle("tilt", onEmail && email.value.length > 0 && !valid);
  buddy.classList.toggle("thumbs-up", onEmail && valid);
  if (valid && !wasValid) {
    pulse("wink", 450);
    pulse("jingle", 600);
  }
  wasValid = valid;

  if (!submit.classList.contains("loading")) submit.disabled = !(valid && current.score >= 3);
  updateSpeech();
}

/* ---------- Events ---------- */

[email, pw].forEach((input) => {
  input.addEventListener("focus", () => {
    focused = input;
    trackCaret();
    update();
  });
  input.addEventListener("input", () => {
    update();
    pulse("nod", 260);
  });
  ["input", "click", "keyup", "select"].forEach((evt) =>
    input.addEventListener(evt, () => requestAnimationFrame(trackCaret))
  );
  input.addEventListener("blur", () => {
    focused = null;
    eyes.forEach((eye) => { eye.tx = 0; eye.ty = 2; });
    update();
  });
});

document.addEventListener("selectionchange", () => requestAnimationFrame(trackCaret));
window.addEventListener("resize", trackCaret);

// Follow the mouse when nobody is typing
document.addEventListener("pointermove", (e) => {
  if (!focused) lookAt(e.clientX, e.clientY);
});

// Caps Lock warning
function checkCaps(e) {
  if (typeof e.getModifierState !== "function") return;
  const on = e.getModifierState("CapsLock");
  if (on === capsOn) return;
  capsOn = on;
  pwWrap.classList.toggle("caps-on", on);
  if (on) {
    pulse("twitch", 460);
    pulse("twitch-l", 460);
  }
  updateSpeech();
}
pw.addEventListener("keydown", checkCaps);
pw.addEventListener("keyup", checkCaps);
pw.addEventListener("blur", () => {
  capsOn = false;
  pwWrap.classList.remove("caps-on");
});

// Show / hide password
toggle.addEventListener("pointerdown", (e) => e.preventDefault()); // keep focus in the input
toggle.addEventListener("click", () => {
  const show = pw.type === "password";
  const pos = pw.selectionEnd;
  pw.type = show ? "text" : "password";
  toggle.setAttribute("aria-pressed", String(show));
  toggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
  pw.focus();
  try { pw.setSelectionRange(pos, pos); } catch (_) {}
  update();
});

// Hovering Mochi while covered → a cheeky peek
stage.addEventListener("pointerenter", () => {
  if (!buddy.classList.contains("covered")) return;
  buddy.classList.add("peek");
  updateSpeech();
});
stage.addEventListener("pointerleave", () => {
  buddy.classList.remove("peek");
  updateSpeech();
});

// Generate a strong password and "type" it in
function randomInt(max) {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}

function generatePassword(length = 16) {
  const sets = ["abcdefghijkmnpqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "!@#$%^&*?-_+="];
  const all = sets.join("");
  const chars = sets.map((set) => set[randomInt(set.length)]); // one from each set
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

let typing = null;
genBtn.addEventListener("click", () => {
  clearInterval(typing);
  const next = generatePassword();
  let i = 0;
  pw.value = "";
  pw.focus();
  genBtn.disabled = true;

  typing = setInterval(() => {
    pw.value += next[i++];
    pw.setSelectionRange(pw.value.length, pw.value.length);
    pulse("nod", 260);
    update();
    trackCaret();
    if (i >= next.length) {
      clearInterval(typing);
      genBtn.disabled = false;
      navigator.clipboard?.writeText(next).then(
        () => showToast("Strong password generated & copied"),
        () => showToast("Strong password generated")
      );
    }
  }, 45);
});

let toastTimer;
function showToast(message) {
  toastText.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

// Demo submit (no real request)
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (submit.disabled) return;

  submit.classList.add("loading");
  submit.disabled = true;

  setTimeout(() => {
    submit.classList.remove("loading");
    pulse("celebrate", 1500);
    pulse("happy", 1500);
    pulse("jingle", 600);
    say("You're all set! Welcome aboard.");
    showToast("Account created successfully");
    submit.disabled = false;
  }, 1400);
});

update();
