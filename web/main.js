const app = document.querySelector('#app');

app.innerHTML = `
  <main class="shell">
    <section class="panel">
      <div class="eyebrow">Urbit</div>
      <h1>Comet Miner</h1>
      <p class="lede">Mine suite B or suite C comets in the browser.</p>

      <form id="miner-form" class="form">
        <label>
          <span>Suite</span>
          <select name="suite">
            <option value="b">Suite B</option>
            <option value="c" selected>Suite C</option>
          </select>
        </label>

        <label id="tweak-field">
          <span>Tweak</span>
          <input name="tweak" placeholder='42 or ["42","~zod"]' value="42" />
        </label>

        <label id="stars-field">
          <span>Stars</span>
          <textarea name="stars" rows="3" placeholder="Optional list of stars, separated by spaces, commas, or newlines"></textarea>
        </label>

        <label class="check">
          <input type="checkbox" name="anyStar" id="any-star" />
          <span>Mine under any star</span>
        </label>

        <div class="actions">
          <button type="submit" id="start-button">Start Mining</button>
          <button type="button" id="stop-button" disabled>Stop</button>
        </div>
      </form>
    </section>

    <section class="panel result-panel">
      <div class="result-head">
        <h2>Result</h2>
        <div id="status" class="status idle">Idle</div>
      </div>

      <div class="metric">
        <span>Tries</span>
        <strong id="tries">0</strong>
      </div>

      <label class="result-field">
        <span>Feed</span>
        <div class="copy-field">
          <textarea id="feed" rows="5" readonly></textarea>
          <button type="button" class="copy-button" data-copy-target="feed" aria-label="Copy feed" title="Copy feed">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z"/>
            </svg>
          </button>
        </div>
      </label>

      <label class="result-field">
        <span>Comet</span>
        <div class="copy-field">
          <input id="comet" readonly />
          <button type="button" class="copy-button" data-copy-target="comet" aria-label="Copy comet" title="Copy comet">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z"/>
            </svg>
          </button>
        </div>
      </label>

      <p id="error" class="error" hidden></p>
    </section>
  </main>
`;

const form = document.querySelector('#miner-form');
const suiteEl = form.elements.namedItem('suite');
const tweakFieldEl = document.querySelector('#tweak-field');
const starsFieldEl = document.querySelector('#stars-field');
const starsInputEl = form.elements.namedItem('stars');
const anyStarEl = document.querySelector('#any-star');
const startButton = document.querySelector('#start-button');
const stopButton = document.querySelector('#stop-button');
const triesEl = document.querySelector('#tries');
const feedEl = document.querySelector('#feed');
const cometEl = document.querySelector('#comet');
const statusEl = document.querySelector('#status');
const errorEl = document.querySelector('#error');
const copyButtons = document.querySelectorAll('.copy-button');

const style = document.createElement('style');
style.textContent = `
  :root {
    color-scheme: light;
    --bg: #f3f0e7;
    --panel: rgba(255, 252, 244, 0.92);
    --ink: #1b160e;
    --muted: #6e634d;
    --line: rgba(27, 22, 14, 0.12);
    --accent: #0c7c59;
    --accent-2: #c8553d;
    --shadow: 0 24px 60px rgba(27, 22, 14, 0.12);
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: Georgia, 'Iowan Old Style', 'Palatino Linotype', serif;
    color: var(--ink);
    background:
      radial-gradient(circle at top left, rgba(200, 85, 61, 0.14), transparent 28%),
      radial-gradient(circle at bottom right, rgba(12, 124, 89, 0.18), transparent 35%),
      linear-gradient(135deg, #f8f4eb, var(--bg));
  }

  .shell {
    width: min(1080px, calc(100vw - 32px));
    margin: 32px auto;
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 20px;
  }

  .panel {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 24px;
    padding: 28px;
    box-shadow: var(--shadow);
    backdrop-filter: blur(10px);
  }

  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 12px;
  }

  h1, h2 { margin: 0; font-weight: 600; }
  h1 { font-size: clamp(2.3rem, 5vw, 4rem); line-height: 0.95; margin-bottom: 12px; }
  h2 { font-size: 1.5rem; }
  .lede { color: var(--muted); margin: 0 0 24px; max-width: 48ch; line-height: 1.5; }

  .form {
    display: grid;
    gap: 16px;
  }

  .form label[hidden] {
    display: none;
  }

  label {
    display: grid;
    gap: 8px;
    font-size: 0.95rem;
  }

  label > span {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }

  input, textarea, select, button {
    font: inherit;
  }

  input, textarea, select {
    width: 100%;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.7);
    padding: 14px 16px;
    color: var(--ink);
  }

  textarea {
    resize: vertical;
  }

  .check {
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 12px;
  }

  .check > span {
    font-size: 0.95rem;
    letter-spacing: 0;
    text-transform: none;
    color: var(--ink);
  }

  .field-disabled {
    opacity: 0.55;
  }

  .actions {
    display: flex;
    gap: 12px;
  }

  button {
    border: 0;
    border-radius: 999px;
    padding: 14px 20px;
    cursor: pointer;
    transition: transform 140ms ease, opacity 140ms ease;
  }

  button:hover { transform: translateY(-1px); }
  button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  #start-button {
    background: var(--ink);
    color: white;
  }

  #stop-button {
    background: rgba(200, 85, 61, 0.12);
    color: var(--accent-2);
  }

  .result-panel {
    display: grid;
    gap: 18px;
    align-content: start;
  }

  .result-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status {
    padding: 8px 12px;
    border-radius: 999px;
    font-size: 0.85rem;
    background: rgba(27, 22, 14, 0.06);
    color: var(--muted);
  }

  .status.running {
    background: rgba(12, 124, 89, 0.12);
    color: var(--accent);
  }

  .status.done {
    background: rgba(12, 124, 89, 0.18);
    color: var(--accent);
  }

  .status.error {
    background: rgba(200, 85, 61, 0.14);
    color: var(--accent-2);
  }

  .metric {
    padding: 18px;
    border-radius: 18px;
    background: rgba(27, 22, 14, 0.04);
  }

  .metric span {
    display: block;
    color: var(--muted);
    margin-bottom: 6px;
  }

  .metric strong {
    font-size: clamp(1.6rem, 4vw, 2.6rem);
  }

  .result-field {
    gap: 10px;
  }

  .copy-field {
    position: relative;
  }

  .copy-button {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    background: rgba(255, 252, 244, 0.96);
    color: var(--ink);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 0;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-2px);
    transition: opacity 140ms ease, transform 140ms ease, background-color 140ms ease;
  }

  .copy-field:hover .copy-button,
  .copy-field:focus-within .copy-button {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }

  .copy-button:hover,
  .copy-button:focus-visible {
    background: rgba(255, 252, 244, 1);
  }

  .copy-button[data-copied="true"] {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
    background: rgba(12, 124, 89, 0.14);
    color: var(--accent);
  }

  .copy-button svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }

  .error {
    margin: 0;
    color: var(--accent-2);
    background: rgba(200, 85, 61, 0.08);
    border: 1px solid rgba(200, 85, 61, 0.18);
    padding: 14px 16px;
    border-radius: 14px;
  }

  @media (max-width: 840px) {
    .shell {
      grid-template-columns: 1fr;
      width: min(100vw - 20px, 720px);
      margin: 10px auto 24px;
    }

    .panel {
      padding: 22px;
      border-radius: 20px;
    }
  }
`;
document.head.append(style);

let worker = null;

function formatTries(value) {
  return Number.parseInt(value, 10).toLocaleString('en-US');
}

function setStatus(kind, text) {
  statusEl.className = `status ${kind}`;
  statusEl.textContent = text;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

function showError(message) {
  errorEl.hidden = false;
  errorEl.textContent = message;
  setStatus('error', 'Error');
}

function stopWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  startButton.disabled = false;
  stopButton.disabled = true;
}

function parseStarsField(value) {
  return value
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function updateFormState() {
  const suite = suiteEl.value;
  const anyStar = anyStarEl.checked;

  tweakFieldEl.hidden = suite !== 'c';
  starsFieldEl.classList.toggle('field-disabled', anyStar);
  starsInputEl.disabled = anyStar;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  stopWorker();
  clearError();
  triesEl.textContent = formatTries(0);
  feedEl.value = '';
  cometEl.value = '';

  const formData = new FormData(form);
  const suite = formData.get('suite');
  const tweak = formData.get('tweak') || '0';
  const anyStar = formData.get('anyStar') === 'on';
  const stars = parseStarsField(formData.get('stars') || '');

  worker = new Worker(new URL('./minerWorker.js', import.meta.url), { type: 'module' });
  startButton.disabled = true;
  stopButton.disabled = false;
  setStatus('running', 'Mining');

  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') {
      triesEl.textContent = formatTries(data.tries);
      return;
    }

    if (data.type === 'result') {
      triesEl.textContent = formatTries(data.result.tries);
      feedEl.value = data.result.feed;
      cometEl.value = data.result.comet;
      setStatus('done', 'Complete');
      stopWorker();
      return;
    }

    if (data.type === 'error') {
      showError(data.message);
      stopWorker();
    }
  };

  worker.postMessage({
    type: 'start',
    payload: { suite, tweak, stars, anyStar },
  });
});

stopButton.addEventListener('click', () => {
  stopWorker();
  setStatus('idle', 'Stopped');
});

suiteEl.addEventListener('change', updateFormState);
anyStarEl.addEventListener('change', updateFormState);
updateFormState();

copyButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const target = button.dataset.copyTarget === 'feed' ? feedEl : cometEl;
    if (!target.value) {
      return;
    }

    await navigator.clipboard.writeText(target.value);
    const originalLabel = button.getAttribute('aria-label');
    const originalTitle = button.getAttribute('title');
    button.dataset.copied = 'true';
    button.setAttribute('aria-label', 'Copied');
    button.setAttribute('title', 'Copied');
    window.setTimeout(() => {
      delete button.dataset.copied;
      button.setAttribute('aria-label', originalLabel);
      button.setAttribute('title', originalTitle);
    }, 1200);
  });
});
