const form = document.getElementById('form');
const urlInput = document.getElementById('url');
const go = document.getElementById('go');
const rail = document.getElementById('rail');
const railFill = document.getElementById('railFill');
const printout = document.getElementById('printout');
const log = document.getElementById('log');
const ticker = document.getElementById('ticker');
const receipt = document.getElementById('receipt');
const stamp = receipt.querySelector('.receipt__stamp');
const download = document.getElementById('download');

const PHASES = ['detect', 'discover', 'render', 'assets', 'package'];

function line(text, variant = '') {
  const el = document.createElement('span');
  el.className = 'ln' + (variant ? ` ln--${variant}` : '');
  const mark = document.createElement('span');
  mark.className = 'mk';
  mark.textContent = variant === 'err' ? '✕ ' : variant === 'ok' ? '✓ ' : '▸ ';
  el.append(mark, document.createTextNode(text));
  log.appendChild(el);
  log.parentElement.scrollTop = log.parentElement.scrollHeight;
}

function advanceRail(phase) {
  const idx = PHASES.indexOf(phase);
  if (idx < 0) return;
  rail.querySelectorAll('.rail__step').forEach((step, i) => {
    step.classList.toggle('is-done', i < idx);
    step.classList.toggle('is-active', i === idx);
  });
  railFill.style.width = `${((idx + 1) / PHASES.length) * 100}%`;
}

function completeRail() {
  rail.querySelectorAll('.rail__step').forEach((s) => {
    s.classList.remove('is-active');
    s.classList.add('is-done');
  });
  railFill.style.width = '100%';
}

function setNum(id, value) { document.getElementById(id).textContent = value; }

function showReceipt(report, downloadUrl) {
  setNum('r-routes', report.routes.exported);
  setNum('r-localized', report.assets.localized);
  setNum('r-deduped', report.assets.deduped);
  setNum('r-external', report.assets.externalKept.length);
  download.href = downloadUrl;
  const host = (() => { try { return new URL(report.sourceUrl).hostname; } catch { return 'site'; } })();
  document.getElementById('r-stamp').textContent = `${host}.zip — ready to deploy`;
  receipt.hidden = false;
  requestAnimationFrame(() => stamp.classList.add('is-stamped'));
  receipt.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetView() {
  go.disabled = true;
  go.classList.add('is-working');
  stamp.classList.remove('is-stamped');
  receipt.hidden = true;
  log.textContent = '';
  rail.hidden = false; rail.setAttribute('aria-hidden', 'false');
  printout.hidden = false;
  railFill.style.width = '0%';
  rail.querySelectorAll('.rail__step').forEach((s) => s.classList.remove('is-active', 'is-done'));
  ticker.textContent = 'live';
}

function finish() {
  go.disabled = false;
  go.classList.remove('is-working');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  resetView();
  line('Sending source URL to the press…');

  let jobId;
  try {
    const res = await fetch('/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: urlInput.value }),
    });
    if (!res.ok) {
      const detail = await res.text();
      line(`Rejected: ${detail}`, 'err');
      ticker.textContent = 'halted';
      finish();
      return;
    }
    ({ jobId } = await res.json());
  } catch (err) {
    line(`Could not reach the press: ${err.message}`, 'err');
    ticker.textContent = 'halted';
    finish();
    return;
  }

  const events = new EventSource(`/export/${jobId}/events`);

  events.onmessage = (ev) => {
    const e = JSON.parse(ev.data);
    if (PHASES.includes(e.phase)) advanceRail(e.phase);

    switch (e.phase) {
      case 'queued':
        line(`Queued — position ${e.position}. ${e.message}`);
        ticker.textContent = 'queued';
        break;
      case 'detect':
        line(e.message);
        break;
      case 'discover':
        line(`Discovered ${e.found} route${e.found === 1 ? '' : 's'} to press.`);
        break;
      case 'render':
        line(`Rendering ${e.route}  ·  ${e.index}/${e.total}`);
        break;
      case 'assets':
        line(`Localized ${e.count} unique asset${e.count === 1 ? '' : 's'}.`);
        break;
      case 'package':
        line(e.message);
        break;
      case 'done':
        completeRail();
        line('Bundle pressed and sealed.', 'ok');
        ticker.textContent = 'done';
        showReceipt(e.report, e.downloadUrl);
        finish();
        events.close();
        break;
      case 'error':
        line(e.message, 'err');
        ticker.textContent = 'halted';
        finish();
        events.close();
        break;
    }
  };

  events.onerror = () => {
    line('Connection to the press was lost.', 'err');
    ticker.textContent = 'halted';
    finish();
    events.close();
  };
});
