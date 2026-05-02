/* SMART IRRIGATION SYSTEM - JAVASCRIPT WITH BACKEND LOGIN */

const API_BASE = 'http://localhost:5000';

let authToken = localStorage.getItem('smart_irrigation_token');
let currentUser = JSON.parse(localStorage.getItem('smart_irrigation_user') || 'null');

async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

async function login(username, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });

  authToken = data.token;
  currentUser = data.user;

  localStorage.setItem('smart_irrigation_token', authToken);
  localStorage.setItem('smart_irrigation_user', JSON.stringify(currentUser));

  showToast(`Logged in as ${currentUser.username}`);
  return currentUser;
}

function logout() {
  localStorage.removeItem('smart_irrigation_token');
  localStorage.removeItem('smart_irrigation_user');
  authToken = null;
  currentUser = null;
  location.reload();
}

async function ensureLogin() {
  if (authToken && currentUser) return;

  const username = prompt('Enter your username');
  const password = prompt('Enter your password');

  if (!username || !password) {
    alert('Login is required.');
    throw new Error('Login cancelled');
  }

  await login(username, password);
}

function addLogoutButton() {
  const navActions = document.querySelector('.nav-actions');
  if (!navActions || document.getElementById('logout-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'logout-btn';
  btn.className = 'live-badge';
  btn.textContent = currentUser ? `${currentUser.username} Logout` : 'Logout';
  btn.onclick = logout;

  navActions.prepend(btn);
}

function addAdminFarmerButton() {
  if (!currentUser || currentUser.role !== 'admin') return;

  const navActions = document.querySelector('.nav-actions');
  if (!navActions || document.getElementById('create-farmer-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'create-farmer-btn';
  btn.className = 'live-badge';
  btn.textContent = 'Add Farmer';
  btn.onclick = openCreateFarmerPrompt;

  navActions.prepend(btn);
}

async function openCreateFarmerPrompt() {
  const name = prompt('Enter farmer full name');
  const username = prompt('Create farmer username');
  const password = prompt('Create farmer password, minimum 6 characters');

  if (!name || !username || !password) {
    showToast('Farmer creation cancelled');
    return;
  }

  await createFarmerAccount(name, username, password);
}

async function createFarmerAccount(name, username, password) {
  try {
    const data = await apiFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        name,
        username,
        password,
        role: 'farmer'
      })
    });

    showToast(`Farmer created: ${data.user.username}`);
    return data.user;
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Could not create farmer');
  }
}

/* Navbar */
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  const scrollTop = document.getElementById('scroll-top');

  if (window.scrollY > 60) {
    if (navbar) navbar.classList.add('scrolled');
    if (scrollTop) scrollTop.classList.add('visible');
  } else {
    if (navbar) navbar.classList.remove('scrolled');
    if (scrollTop) scrollTop.classList.remove('visible');
  }

  updateActiveNav();
});

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });

  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navLinks.classList.remove('open');
    });
  });
}

function updateActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const scrollPos = window.scrollY + 90;

  sections.forEach(sec => {
    const id = sec.getAttribute('id');
    const top = sec.offsetTop;
    const bottom = top + sec.offsetHeight;
    const link = document.querySelector(`.nav-link[href="#${id}"]`);

    if (link) {
      if (scrollPos >= top && scrollPos < bottom) link.classList.add('active');
      else link.classList.remove('active');
    }
  });
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* Scroll animations */
const animObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');

      const fills = entry.target.querySelectorAll('.bb-fill');
      fills.forEach(f => {
        f.style.width = f.style.getPropertyValue('--w') || getComputedStyle(f).getPropertyValue('--w');
      });
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('[data-animate]').forEach(el => animObserver.observe(el));

const benefitsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('.bb-fill').forEach(f => {
        const target = f.style.getPropertyValue('--w');
        if (target) f.style.width = target;
      });

      entry.target.querySelectorAll('.meter-fill').forEach(f => {
        const target = f.style.getPropertyValue('--fill');
        if (target) f.style.width = target;
      });
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.benefits-grid, .features-grid').forEach(el => benefitsObserver.observe(el));

/* App state */
const state = {
  moisture: 68,
  temp: 34,
  humidity: 72,
  tank: 74,
  rain: false,
  pumpOn: true,
  autoMode: true,
  threshold: 50,
  rodentDetected: false,
};

async function updateAllSensors() {
  try {
    if (!authToken) return;

    const data = await apiFetch('/api/dashboard');
    if (!data.latest) return;

    state.moisture = Number(data.latest.moisture);
    state.temp = Number(data.latest.temperature || 0);
    state.humidity = Number(data.latest.humidity || 0);
    state.tank = Number(data.latest.tankLevel);
    state.pumpOn = data.pump.status === 'on';
    state.autoMode = data.settings.autoMode;
    state.threshold = Number(data.settings.threshold);
    state.rodentDetected = data.latest.rodentDetected === true;

    if (typeof data.latest.rain === 'boolean') {
      state.rain = data.latest.rain;
    } else if (typeof data.latest.rainPercent === 'number') {
      state.rain = data.latest.rainPercent > 40;
    } else {
      state.rain = false;
    }

    const autoModeInput = document.getElementById('auto-mode');
    if (autoModeInput) autoModeInput.checked = state.autoMode;

    const thresholdInput = document.getElementById('moisture-threshold');
    if (thresholdInput) thresholdInput.value = state.threshold;

    updateThresholdUI(state.threshold);
    renderKPI();
    renderRodentStatus();
    updateHeroCards();
    updateLastUpdate();
    
    renderLogs(data.logs || []);
    updateChartsFromBackend(data.history || []);
    runPredictiveAnalysis(data.history || []);
  } catch (error) {
    console.error(error);
    showToast('Could not load backend data');
  }
}

function renderKPI() {
  setKPI(
    'kpi-moisture',
    state.moisture,
    '%',
    'kpi-moisture-bar',
    state.moisture,
    state.moisture < 40 ? 'status-danger' : state.moisture > 80 ? 'status-warning' : 'status-normal',
    state.moisture < 40 ? 'Too Dry - Irrigate!' : state.moisture > 80 ? 'Too Wet' : 'Optimal Range',
    'kpi-moisture-status'
  );

  setKPI(
    'kpi-tank',
    state.tank,
    '%',
    'kpi-tank-bar',
    state.tank,
    state.tank < 30 ? 'status-danger' : state.tank < 50 ? 'status-warning' : 'status-normal',
    state.tank < 30 ? 'Refill Needed!' : state.tank < 50 ? 'Low Water' : 'Adequate Level',
    'kpi-tank-status'
  );

  renderRainStatus();
  renderPumpStatus();
  renderRodentStatus();
}

function setKPI(valId, val, unit, barId, barPct, statusClass, statusText, statusId) {
  const el = document.getElementById(valId);
  if (el) el.innerHTML = `${val}<span>${unit}</span>`;

  const bar = document.getElementById(barId);
  if (bar) bar.style.width = Math.min(100, Math.max(0, barPct)) + '%';

  const st = document.getElementById(statusId);
  if (st) {
    st.className = `simple-status ${statusClass}`;
    st.textContent = statusText;
  }
}

function renderRainStatus() {
  const rainEl = document.getElementById('kpi-rain');
  const rainStatus = document.getElementById('kpi-rain-status');

  if (rainEl) {
    rainEl.textContent = state.rain ? 'Rain' : 'No Rain';
  }

  if (rainStatus) {
    rainStatus.className = state.rain ? 'simple-status status-warning' : 'simple-status status-normal';
    rainStatus.textContent = state.rain ? 'Irrigation paused' : 'Safe for irrigation';
  }
}

function renderPumpStatus() {
  const pumpLed = document.getElementById('pump-led');
  const pumpLabel = document.getElementById('pump-label');
  const pumpIconBg = document.getElementById('pump-icon-bg');
  const heroPump = document.getElementById('hero-pump');
  const heroPumpDot = document.getElementById('hero-pump-dot');

  if (pumpLed) pumpLed.className = state.pumpOn ? 'pump-led' : 'pump-led off';
  if (pumpLabel) pumpLabel.textContent = state.pumpOn ? 'ON' : 'OFF';
  if (pumpIconBg) pumpIconBg.className = state.pumpOn ? 'simple-card-icon icon-pump' : 'simple-card-icon icon-pump off';
  if (heroPump) heroPump.textContent = state.pumpOn ? 'ON' : 'OFF';
  if (heroPumpDot) heroPumpDot.style.color = state.pumpOn ? 'var(--green-400)' : 'var(--gray-400)';
}

function renderRodentStatus() {
  const status = document.getElementById('rodent-status');
  const msg = document.getElementById('rodent-msg');
  const banner = document.getElementById('rodent-alert-banner');
  const toast = document.getElementById('rodent-toast');

  if (!status || !msg) return;

  if (state.rodentDetected) {
    status.textContent = "DETECTED";
    status.style.color = "#ef4444";

    msg.textContent = "Rodent activity detected in field!";
    msg.className = "simple-status status-danger";

    if (banner) banner.style.display = "block";

    if (toast) {
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 3000);
    }

    addLog("Rodent detected - Farmer alert sent");
  } else {
    status.textContent = "SAFE";
    status.style.color = "#22c55e";

    msg.textContent = "No rodent activity detected";
    msg.className = "simple-status status-normal";

    if (banner) banner.style.display = "none";
  }
}

function updateHeroCards() {
  const hm = document.getElementById('hero-moisture');
  const ht = document.getElementById('hero-temp');

  if (hm) hm.textContent = state.moisture + '%';
  if (ht) ht.textContent = state.temp + '°C';
}

function updateLastUpdate() {
  const el = document.getElementById('last-update');
  if (el) el.textContent = 'Last update: just now';
}

/* Chart */
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, '0');
  return `${h}:00`;
});

let moistureData = Array.from({ length: 24 }, () => 68);

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(17,24,39,.9)',
      titleColor: '#f9fafb',
      bodyColor: '#d1d5db',
      borderColor: 'rgba(255,255,255,.12)',
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,.06)' },
      ticks: { color: 'rgba(255,255,255,.45)', font: { size: 10 }, maxTicksLimit: 8 }
    },
    y: {
      grid: { color: 'rgba(255,255,255,.06)' },
      ticks: { color: 'rgba(255,255,255,.45)', font: { size: 10 } }
    }
  }
};

let moistureChart;

function initCharts() {
  const ctxM = document.getElementById('moistureChart');
  if (!ctxM) return;

  moistureChart = new Chart(ctxM, {
    type: 'line',
    data: {
      labels: HOURS,
      datasets: [{
        data: moistureData,
        borderColor: '#4ade80',
        backgroundColor: 'rgba(74,222,128,.12)',
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.45
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        ...CHART_DEFAULTS.scales,
        y: {
          ...CHART_DEFAULTS.scales.y,
          min: 0,
          max: 100,
          ticks: {
            ...CHART_DEFAULTS.scales.y.ticks,
            callback: v => v + '%'
          }
        }
      },
      plugins: {
        ...CHART_DEFAULTS.plugins,
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.raw}% soil moisture`
          }
        }
      }
    }
  });
}

function updateChartsFromBackend(history) {
  if (!moistureChart || !history.length) return;

  const last24 = history.slice(-24);

  moistureChart.data.labels = last24.map(item =>
    new Date(item.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  );

  moistureChart.data.datasets[0].data = last24.map(item => Number(item.moisture));
  moistureChart.update();
}
/* ================================
   PREDICTIVE AI ANALYSIS
================================ */

// Store prediction
let aiPrediction = {
  nextMoisture: null,
  irrigationNeeded: false,
  trend: "stable"
};

function runPredictiveAnalysis(history) {
  if (!history || history.length < 5) return;

  const last = history.slice(-5).map(h => Number(h.moisture));

  // Simple trend calculation (difference average)
  let diffSum = 0;
  for (let i = 1; i < last.length; i++) {
    diffSum += (last[i] - last[i - 1]);
  }

  const avgChange = diffSum / (last.length - 1);

  // Predict next moisture
  const predicted = last[last.length - 1] + avgChange;

  aiPrediction.nextMoisture = Math.max(0, Math.min(100, predicted));

  // Detect trend
  if (avgChange > 1) aiPrediction.trend = "increasing";
  else if (avgChange < -1) aiPrediction.trend = "decreasing";
  else aiPrediction.trend = "stable";

  // Irrigation decision
  aiPrediction.irrigationNeeded = aiPrediction.nextMoisture < state.threshold;

  renderAIInsights();
}

function renderAIInsights() {
  const el = document.getElementById('ai-insight');
  if (!el) return;

  let msg = "";
  let color = "#22c55e"; // green

  if (aiPrediction.irrigationNeeded) {
    msg = `⚠️ Soil moisture will drop to ~${aiPrediction.nextMoisture.toFixed(1)}%. Irrigation recommended.`;
    color = "#ef4444"; // red
  } else {
    msg = `✅ Predicted moisture: ${aiPrediction.nextMoisture.toFixed(1)}%. No irrigation needed.`;
  }

  if (aiPrediction.trend === "decreasing") {
    msg += " Moisture is falling.";
  } else if (aiPrediction.trend === "increasing") {
    msg += " Moisture is improving.";
  }

  el.textContent = msg;
  el.style.color = color;
}

/* Controls */
async function controlPump(action) {
  try {
    const status = action === 'off' ? 'off' : 'on';

    const data = await apiFetch('/api/pump', {
      method: 'POST',
      body: JSON.stringify({ status })
    });

    state.pumpOn = data.pump.status === 'on';

    showToast(state.pumpOn ? 'Pump started' : 'Pump stopped');
    addLog(state.pumpOn ? 'Pump started - Manual override' : 'Pump stopped - Manual override');
    renderPumpStatus();
  } catch (error) {
    console.error(error);
    showToast('Pump control failed');
  }
}

async function toggleAutoMode(checkbox) {
  try {
    state.autoMode = checkbox.checked;

    const data = await apiFetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        autoMode: state.autoMode,
        threshold: state.threshold
      })
    });

    state.autoMode = data.settings.autoMode;

    const el = document.getElementById('mode-status');
    if (el) {
      el.innerHTML = state.autoMode
        ? '<i class="fas fa-robot"></i> Auto Mode <strong>Active</strong> - pump managed by sensors'
        : '<i class="fas fa-hand-paper"></i> Manual Mode <strong>Active</strong> - control pump manually';
    }

    showToast(state.autoMode ? 'Auto Mode enabled' : 'Manual Mode enabled');
    addLog(`${state.autoMode ? 'Auto' : 'Manual'} Mode activated`);
  } catch (error) {
    console.error(error);
    checkbox.checked = !checkbox.checked;
    showToast('Mode update failed');
  }
}

let thresholdSaveTimer;

function updateThresholdUI(val) {
  const label = document.getElementById('threshold-val');
  if (label) label.textContent = val + '%';

  const slider = document.getElementById('moisture-threshold');
  if (slider) {
    const pct = ((val - 20) / 60 * 100).toFixed(1);
    slider.style.background = `linear-gradient(90deg, var(--green-400) 0%, var(--green-400) ${pct}%, var(--gray-200) ${pct}%)`;
  }
}

function updateThreshold(val) {
  state.threshold = Number(val);
  updateThresholdUI(val);

  clearTimeout(thresholdSaveTimer);
  thresholdSaveTimer = setTimeout(async () => {
    if (!authToken) return;

    try {
      await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify({
          autoMode: state.autoMode,
          threshold: state.threshold
        })
      });
      showToast('Threshold updated');
    } catch (error) {
      console.error(error);
      showToast('Threshold update failed');
    }
  }, 600);
}

/* Activity log */
function addLog(msg) {
  const log = document.getElementById('activity-log');
  if (!log) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const item = document.createElement('div');
  item.className = 'log-item';
  item.innerHTML = `<span class="log-time">${timeStr}</span><span class="log-msg">${msg}</span>`;

  log.insertBefore(item, log.firstChild);

  while (log.children.length > 6) {
    log.removeChild(log.lastChild);
  }
}

function renderLogs(logs) {
  const log = document.getElementById('activity-log');
  if (!log) return;

  log.innerHTML = '';

  logs.forEach(item => {
    const timeStr = new Date(item.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    const div = document.createElement('div');
    div.className = 'log-item';
    div.innerHTML = `<span class="log-time">${timeStr}</span><span class="log-msg">${item.message}</span>`;
    log.appendChild(div);
  });
}

/* Toast */
let toastTimer;

function showToast(msg) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');

  if (!toast || !msgEl) return;

  msgEl.textContent = msg;
  toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* Contact form */
async function handleSubmit(e) {
  e.preventDefault();

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

  try {
    await apiFetch('/api/contact', {
      method: 'POST',
      body: JSON.stringify({
        firstName: document.getElementById('fname').value,
        lastName: document.getElementById('lname').value,
        email: document.getElementById('email').value,
        subject: document.getElementById('subject').value,
        message: document.getElementById('message').value
      })
    });

    btn.innerHTML = '<i class="fas fa-check"></i> Sent!';

    const success = document.getElementById('form-success');
    if (success) success.style.display = 'flex';

    setTimeout(() => {
      e.target.reset();
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
      if (success) success.style.display = 'none';
    }, 3000);
  } catch (error) {
    console.error(error);
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
    showToast('Message sending failed');
  }
}

/* Slider init */
function initSlider() {
  const slider = document.getElementById('moisture-threshold');
  if (slider) updateThresholdUI(slider.value);
}

/* Counters */
function animateCounters() {
  const statVals = document.querySelectorAll('.stat-value');
  const targets = [40, 30];
  const suffixes = ['%', '%'];
  const specials = [null, null, '24/7'];

  statVals.forEach((el, i) => {
    if (specials[i]) {
      el.textContent = specials[i];
      return;
    }

    let start = 0;
    const end = targets[i];
    const step = end / 40;

    const timer = setInterval(() => {
      start += step;
      el.textContent = Math.min(Math.round(start), end) + (suffixes[i] || '');
      if (start >= end) clearInterval(timer);
    }, 30);
  });
}

const heroObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      animateCounters();
      heroObserver.disconnect();
    }
  });
}, { threshold: 0.4 });

const heroSection = document.getElementById('home');
if (heroSection) heroObserver.observe(heroSection);

/* Slider event */
document.addEventListener('input', e => {
  if (e.target.id === 'moisture-threshold') {
    updateThreshold(e.target.value);
  }
});

/* Init */
document.addEventListener('DOMContentLoaded', async () => {
  
  initSlider();

  try {
    await ensureLogin();

    addLogoutButton();
    addAdminFarmerButton();

    await updateAllSensors();

    setInterval(updateAllSensors, 5000);
  } catch (error) {
    console.error(error);
    showToast('Login failed');
  }
});
