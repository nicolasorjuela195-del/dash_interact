/* ═══════════════════════════════════════════════════════
   AI STRATEGY HUB — app.js
   Stack: Netlify (hosting) + Supabase (base de datos + auth)
   ═══════════════════════════════════════════════════════ */

const API_URL   = '/.netlify/functions/api';
const ADMIN_URL = '/.netlify/functions/admin';

// ─── Auth state ──────────────────────────────────────────────────────────────
let _supabase     = null;   // Supabase client
let currentUser   = null;   // Usuario autenticado (Supabase Auth)
let currentProfile = null;  // Perfil del usuario (tabla profiles)

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return ts;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function badgeEstado(estado) {
  const map = {
    'Recibido': 'badge-estado-recibido',
    'En Evaluación': 'badge-estado-evaluacion',
    'Priorizado': 'badge-estado-priorizado',
    'En Desarrollo': 'badge-estado-desarrollo',
    'Completado': 'badge-estado-completado',
  };
  const cls = map[estado] || 'badge-estado-recibido';
  return `<span class="badge ${cls}">${estado || 'Recibido'}</span>`;
}

function badgeImpacto(impacto) {
  if (!impacto) return '';
  const map = { 'Alto': 'badge-impacto-alto', 'Medio': 'badge-impacto-medio', 'Bajo': 'badge-impacto-bajo' };
  return `<span class="badge ${map[impacto] || ''}">${impacto}</span>`;
}

function badgeUrgencia(urgencia) {
  if (!urgencia) return '';
  const map = { 'Alta': 'badge-urgencia-alta', 'Media': 'badge-urgencia-media', 'Baja': 'badge-urgencia-baja' };
  return `<span class="badge ${map[urgencia] || ''}">⚡ ${urgencia}</span>`;
}

function badgePais(pais) {
  return `<span class="badge badge-pais">🌎 ${pais}</span>`;
}

function badgeCompromiso(val) {
  if (val === 'Sí') return `<span class="badge badge-compromiso">🤝 Compromiso cliente</span>`;
  return '';
}

// Obtiene el token de sesión actual
async function getToken() {
  if (!_supabase) return null;
  const { data } = await _supabase.auth.getSession();
  return data?.session?.access_token || null;
}

// ─── Auth & Screens ──────────────────────────────────────────────────────────

function showScreen(name) {
  document.getElementById('screen-loading').hidden     = name !== 'loading';
  document.getElementById('screen-login').hidden       = name !== 'login';
  document.getElementById('screen-unauthorized').hidden = name !== 'unauthorized';
  document.getElementById('screen-app').hidden         = name !== 'app';
}

document.addEventListener('DOMContentLoaded', initAuth);

async function initAuth() {
  showScreen('loading');

  try {
    // 1. Obtener configuración de Supabase desde Netlify function
    const config = await fetch('/.netlify/functions/config').then(r => r.json());
    const { createClient } = window.supabase;
    _supabase = createClient(config.supabaseUrl, config.supabaseKey);

    // 2. Verificar si hay sesión activa
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
      await handleSession(session);
    } else {
      showScreen('login');
      initLoginScreen();
    }

    // 3. Escuchar cambios de autenticación (Google OAuth callback, logout, etc.)
    _supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await handleSession(session);
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        currentProfile = null;
        showScreen('login');
        initLoginScreen();
      }
    });
  } catch (err) {
    console.error('Error al iniciar autenticación:', err);
    showScreen('login');
    initLoginScreen();
  }
}

async function handleSession(session) {
  currentUser = session.user;

  // Buscar perfil en tabla profiles
  const { data: profile, error } = await _supabase
    .from('profiles')
    .select('*')
    .eq('email', currentUser.email)
    .single();

  if (error || !profile || !profile.activo) {
    // No está autorizado — cerrar sesión y mostrar pantalla de error
    await _supabase.auth.signOut();
    showScreen('unauthorized');
    document.getElementById('btn-logout-unauth')?.addEventListener('click', async () => {
      showScreen('login');
      initLoginScreen();
    });
    return;
  }

  currentProfile = profile;
  showScreen('app');
  setupRoleUI();
  initPageTabs();
  initNav();
  initForm();
  initUserMenu();
  loadData();
}

// ─── Login Screen ────────────────────────────────────────────────────────────

function initLoginScreen() {
  // Reset listeners clonando nodos
  ['form-login', 'btn-magic-link'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.replaceWith(el.cloneNode(true));
  });

  // ── Email + Contraseña ───────────────────────────────────
  document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errDiv   = document.getElementById('login-error');
    const successDiv = document.getElementById('magic-success');

    if (!email || !password) {
      errDiv.textContent = 'Ingresa tu correo y contraseña.';
      errDiv.hidden = false;
      return;
    }

    const { error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) {
      errDiv.textContent = 'Correo o contraseña incorrectos. Verifica tus datos.';
      errDiv.hidden = false;
      if (successDiv) successDiv.hidden = true;
    } else {
      errDiv.hidden = true;
    }
  });

  // ── Magic Link ───────────────────────────────────────────
  document.getElementById('btn-magic-link')?.addEventListener('click', async () => {
    const email      = document.getElementById('login-email').value.trim();
    const errDiv     = document.getElementById('login-error');
    const successDiv = document.getElementById('magic-success');

    if (!email) {
      errDiv.textContent = 'Escribe tu correo primero.';
      errDiv.hidden = false;
      if (successDiv) successDiv.hidden = true;
      return;
    }

    const btn = document.getElementById('btn-magic-link');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    const { error } = await _supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true }, // crea cuenta si no existe; acceso controlado por profiles
    });

    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> Enviar link al correo`;

    if (error) {
      errDiv.textContent = 'No se pudo enviar el link. Verifica que tu correo esté autorizado.';
      errDiv.hidden = false;
      if (successDiv) successDiv.hidden = true;
    } else {
      if (successDiv) successDiv.hidden = false;
      errDiv.hidden = true;
    }
  });
}

// ─── User Menu (logout) ───────────────────────────────────────────────────────

function initUserMenu() {
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await _supabase.auth.signOut();
  });
}

// ─── Role-based UI ───────────────────────────────────────────────────────────

const ROLE_LABELS = {
  admin:        'Admin',
  director_meli: 'Director / Meli',
  usuario:      'Usuario',
};

function setupRoleUI() {
  const role = currentProfile.rol;

  // Mostrar nombre y rol en la barra de usuario
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-role-badge');
  if (nameEl) nameEl.textContent = currentProfile.nombre || currentUser.email;
  if (roleEl) roleEl.textContent = ROLE_LABELS[role] || role;

  // Visibilidad de pestañas según rol
  // admin        → Hub + Proyectos + Admin
  // director_meli → Hub + Proyectos
  // usuario      → solo Proyectos
  const tabHub      = document.getElementById('tab-hub');
  const tabProjects = document.getElementById('tab-projects');
  const tabAdmin    = document.getElementById('tab-admin');

  if (tabHub)      tabHub.style.display      = (role === 'admin' || role === 'director_meli') ? '' : 'none';
  if (tabProjects) tabProjects.style.display = '';
  if (tabAdmin)    tabAdmin.style.display    = role === 'admin' ? '' : 'none';

  // El usuario solo ve Proyectos → activar esa pestaña por defecto
  if (role === 'usuario') {
    document.querySelectorAll('.page-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    tabProjects?.classList.add('active');
    document.getElementById('page-projects')?.classList.add('active');
    document.getElementById('navHub').style.display      = 'none';
    document.getElementById('navProjects').style.display = '';
    const logoText = document.querySelector('.logo-text');
    if (logoText) logoText.innerHTML = 'AI Transformation <span class="logo-accent">Team</span>';
  }
}

// ─── Page Tabs (Hub / Projects / Admin) ──────────────────────────────────────

function initPageTabs() {
  const tabs = document.querySelectorAll('.page-tab');
  const pages = document.querySelectorAll('.page-content');
  const navHub      = document.getElementById('navHub');
  const navProjects = document.getElementById('navProjects');
  const navAdmin    = document.getElementById('navAdmin');
  const logoText    = document.querySelector('.logo-text');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.page;

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      pages.forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + target)?.classList.add('active');

      // Cambiar nav y logo según página
      if (navHub)      navHub.style.display      = target === 'hub'      ? '' : 'none';
      if (navProjects) navProjects.style.display  = target === 'projects' ? '' : 'none';
      if (navAdmin)    navAdmin.style.display     = target === 'admin'    ? '' : 'none';

      if (logoText) {
        if (target === 'hub')      logoText.innerHTML = 'AI Strategy <span class="logo-accent">Hub</span>';
        if (target === 'projects') logoText.innerHTML = 'AI Transformation <span class="logo-accent">Team</span>';
        if (target === 'admin')    logoText.innerHTML = 'Admin <span class="logo-accent">Panel</span>';
      }

      // Cargar usuarios al entrar al panel admin
      if (target === 'admin') loadAdminUsers();

      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelectorAll('.nav').forEach(n => n.classList.remove('open'));
    });
  });
}

// ─── Navigation ─────────────────────────────────────────────────────────────

function initNav() {
  const toggle = document.getElementById('navToggle');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const hubNav  = document.getElementById('navHub');
    const projNav = document.getElementById('navProjects');
    const admNav  = document.getElementById('navAdmin');
    const activeNav = [hubNav, projNav, admNav].find(n => n && n.style.display !== 'none');
    if (activeNav) activeNav.classList.toggle('open');
  });

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.nav').forEach(n => n.classList.remove('open'));
    });
  });

  const sections  = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav-link');
  const observer  = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.4 });
  sections.forEach(s => observer.observe(s));
}

// ─── Form ────────────────────────────────────────────────────────────────────

function initForm() {
  const form          = document.getElementById('aiForm');
  const newRequestBtn = document.getElementById('newRequestBtn');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;
    setSubmitting(true);

    const data = {
      nombre:           form.nombre.value.trim(),
      pais:             form.pais.value,
      problema:         form.problema.value.trim(),
      impacto:          form.impacto.value.trim(),
      usuarios:         form.usuarios.value.trim(),
      medicion:         form.medicion.value.trim(),
      equipo:           form.equipo.value.trim(),
      urgencia:         form.urgencia.value,
      impacto_estimado: form.impacto_estimado.value,
      compromiso:       form.compromiso.value,
    };

    try {
      const token = await getToken();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        showSuccess();
        loadData();
      } else {
        alert('Error al enviar. Intenta de nuevo.');
      }
    } catch {
      alert('Error de conexión. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  });

  newRequestBtn?.addEventListener('click', () => {
    document.getElementById('aiForm').hidden = false;
    document.getElementById('formSuccess').hidden = true;
    form.reset();
    form.nombre.focus();
  });
}

function validateForm(form) {
  let valid = true;
  const required = ['nombre', 'pais', 'problema', 'impacto', 'usuarios', 'medicion', 'urgencia', 'impacto_estimado'];

  required.forEach(name => {
    const el  = form[name];
    const err = document.getElementById(`error-${name}`);
    if (!el.value.trim()) {
      el.classList.add('error');
      if (err) err.textContent = 'Este campo es requerido.';
      valid = false;
    } else {
      el.classList.remove('error');
      if (err) err.textContent = '';
    }
  });

  const compromisoErr = document.getElementById('error-compromiso');
  if (!form.compromiso.value) {
    if (compromisoErr) compromisoErr.textContent = 'Selecciona una opción.';
    valid = false;
  } else {
    if (compromisoErr) compromisoErr.textContent = '';
  }

  ['nombre', 'pais', 'problema', 'impacto', 'usuarios', 'medicion', 'urgencia', 'impacto_estimado'].forEach(name => {
    form[name].addEventListener('input', () => {
      form[name].classList.remove('error');
      const err = document.getElementById(`error-${name}`);
      if (err) err.textContent = '';
    }, { once: false });
  });

  return valid;
}

function setSubmitting(loading) {
  const btn = document.getElementById('submitBtn');
  if (!btn) return;
  btn.disabled = loading;
  btn.querySelector('.btn-text').hidden = loading;
  btn.querySelector('.btn-spinner').hidden = !loading;
}

function showSuccess() {
  document.getElementById('aiForm').hidden = true;
  document.getElementById('formSuccess').hidden = false;
}

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadData() {
  try {
    const token = await getToken();
    const res = await fetch(API_URL, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
    const data = await res.json();
    renderAll(Array.isArray(data) ? data : []);
  } catch {
    renderAll([]);
  }
}

function renderAll(data) {
  renderKPIs(data);
  renderKanban(data);
  renderMatrix(data);
  renderRepository(data);
  initRepoFilters(data);
  initKanbanFilter(data);
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

function renderKPIs(data) {
  const total       = data.length;
  const done        = data.filter(d => d.Estado === 'Completado').length;
  const ongoing     = data.filter(d => ['Priorizado', 'En Desarrollo'].includes(d.Estado)).length;
  const compromisos = data.filter(d => d['Compromiso con Cliente'] === 'Sí').length;

  animateCount('kpiTotal',       total);
  animateCount('kpiDone',        done);
  animateCount('kpiOngoing',     ongoing);
  animateCount('kpiCompromisos', compromisos);
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step = Math.ceil(target / 20);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 40);
}

// ─── Kanban ───────────────────────────────────────────────────────────────────

const KANBAN_BACKLOG = ['Recibido', 'En Evaluación'];
const KANBAN_ONGOING = ['Priorizado', 'En Desarrollo'];
const KANBAN_DONE    = ['Completado'];

function renderKanban(data, filterPais = '') {
  const filtered = filterPais ? data.filter(d => d.País === filterPais) : data;

  const backlog = filtered.filter(d => KANBAN_BACKLOG.includes(d.Estado));
  const ongoing = filtered.filter(d => KANBAN_ONGOING.includes(d.Estado));
  const done    = filtered.filter(d => KANBAN_DONE.includes(d.Estado));

  document.getElementById('cnt-backlog').textContent = backlog.length;
  document.getElementById('cnt-ongoing').textContent = ongoing.length;
  document.getElementById('cnt-done').textContent    = done.length;

  document.getElementById('cards-backlog').innerHTML = backlog.length ? backlog.map(kanbanCard).join('') : emptyCol();
  document.getElementById('cards-ongoing').innerHTML = ongoing.length ? ongoing.map(kanbanCard).join('') : emptyCol();
  document.getElementById('cards-done').innerHTML    = done.length    ? done.map(kanbanCard).join('')    : emptyCol();
}

function emptyCol() {
  return `<div class="kanban-empty">Sin solicitudes</div>`;
}

function kanbanCard(d) {
  return `
    <div class="kanban-card">
      <div class="kanban-card-top">
        <span class="kanban-card-name">${d.Nombre || '—'}</span>
        ${badgePais(d.País)}
      </div>
      <p class="kanban-card-problema">${d.Problema || ''}</p>
      <div class="kanban-card-footer">
        ${badgeEstado(d.Estado)}
        ${badgeImpacto(d['Impacto Estimado'])}
        ${badgeUrgencia(d.Urgencia)}
        ${badgeCompromiso(d['Compromiso con Cliente'])}
      </div>
    </div>
  `;
}

function initKanbanFilter(data) {
  document.getElementById('kanbanFilterPais')?.addEventListener('change', (e) => {
    renderKanban(data, e.target.value);
  });
}

// ─── Matrix (Impacto vs Urgencia) ─────────────────────────────────────────────

let matrixChartInstance = null;

const URGENCIA_MAP = { 'Baja': 1, 'Media': 2, 'Alta': 3 };
const IMPACTO_MAP  = { 'Bajo': 1, 'Medio': 2, 'Alto': 3 };

function renderMatrix(data) {
  const eligible = data.filter(d => d['Impacto Estimado'] && d.Urgencia &&
    URGENCIA_MAP[d.Urgencia] && IMPACTO_MAP[d['Impacto Estimado']]);

  if (!eligible.length) return;

  const points = eligible.map(d => ({
    x: URGENCIA_MAP[d.Urgencia] + (Math.random() * 0.3 - 0.15),
    y: IMPACTO_MAP[d['Impacto Estimado']] + (Math.random() * 0.3 - 0.15),
    label:    d.Nombre,
    pais:     d.País,
    problema: truncate(d.Problema, 60),
    estado:   d.Estado,
  }));

  const ctx = document.getElementById('matrixChart');
  if (!ctx) return;

  if (matrixChartInstance) matrixChartInstance.destroy();

  matrixChartInstance = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Solicitudes',
        data:  points,
        backgroundColor: points.map(p => {
          const urgH = p.x >= 2.5;
          const impH = p.y >= 2.5;
          if (urgH && impH)   return 'rgba(255,215,0,0.85)';
          if (!urgH && impH)  return 'rgba(59,130,246,0.85)';
          if (urgH && !impH)  return 'rgba(249,115,22,0.85)';
          return 'rgba(107,114,128,0.85)';
        }),
        borderColor: 'rgba(0,0,0,0.3)',
        borderWidth: 1,
        pointRadius: 9, pointHoverRadius: 12,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: {
          min: 0.5, max: 3.5,
          grid:   { color: 'rgba(255,255,255,0.05)' },
          border: { color: 'rgba(255,255,255,0.1)'  },
          ticks: {
            color: '#cccccc', font: { size: 13, weight: '600' },
            callback: v => ({ 1: 'Baja', 2: 'Media', 3: 'Alta' }[Math.round(v)] || ''),
            stepSize: 1,
          },
          title: { display: true, text: 'Urgencia →', color: '#FFD700', font: { size: 13, weight: '700' }, padding: { top: 10 } }
        },
        y: {
          min: 0.5, max: 3.5,
          grid:   { color: 'rgba(255,255,255,0.05)' },
          border: { color: 'rgba(255,255,255,0.1)'  },
          ticks: {
            color: '#cccccc', font: { size: 13, weight: '600' },
            callback: v => ({ 1: 'Bajo', 2: 'Medio', 3: 'Alto' }[Math.round(v)] || ''),
            stepSize: 1,
          },
          title: { display: true, text: 'Impacto →', color: '#FFD700', font: { size: 13, weight: '700' }, padding: { bottom: 10 } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1,
          titleColor: '#FFD700', bodyColor: '#ccc', padding: 12,
          callbacks: {
            title:      ctx => ctx[0].raw.label + ' — ' + ctx[0].raw.pais,
            label:      ctx => ctx.raw.problema,
            afterLabel: ctx => 'Estado: ' + ctx.raw.estado,
          }
        },
      },
    },
    plugins: [{
      id: 'quadrantLines',
      beforeDraw(chart) {
        const { ctx: c, chartArea: { left, right, top, bottom }, scales: { x, y } } = chart;
        const midX = x.getPixelForValue(2);
        const midY = y.getPixelForValue(2);
        c.save();
        c.strokeStyle = 'rgba(255,255,255,0.08)';
        c.lineWidth = 1; c.setLineDash([6, 4]);
        c.beginPath(); c.moveTo(midX, top);  c.lineTo(midX, bottom); c.stroke();
        c.beginPath(); c.moveTo(left, midY); c.lineTo(right, midY);  c.stroke();
        c.restore();
      }
    }]
  });
}

// ─── Repository ───────────────────────────────────────────────────────────────

let allData = [];

function renderRepository(data) {
  allData = data;
  applyRepoFilters();
}

function applyRepoFilters() {
  const search = (document.getElementById('repoSearch')?.value || '').toLowerCase();
  const pais   = document.getElementById('repoFilterPais')?.value  || '';
  const estado = document.getElementById('repoFilterEstado')?.value || '';

  let filtered = allData.filter(d => {
    const matchSearch = !search || [d.Nombre, d.País, d.Problema, d['Impacto Actual']]
      .some(f => (f || '').toLowerCase().includes(search));
    const matchPais   = !pais   || d.País   === pais;
    const matchEstado = !estado || d.Estado === estado;
    return matchSearch && matchPais && matchEstado;
  });

  const done   = filtered.filter(d => d.Estado === 'Completado');
  const others = filtered.filter(d => d.Estado !== 'Completado');

  const logrosSection = document.getElementById('logrosSection');
  const logrosGrid    = document.getElementById('logrosGrid');
  const logrosBadge   = document.getElementById('logrosBadge');
  if (done.length && logrosSection && logrosGrid) {
    logrosSection.hidden = false;
    logrosBadge.textContent = done.length;
    logrosGrid.innerHTML = done.map(repoCard).join('');
    attachCardToggles(logrosGrid);
  } else if (logrosSection) {
    logrosSection.hidden = true;
  }

  const grid  = document.getElementById('repoGrid');
  const empty = document.getElementById('repoEmpty');
  if (!grid) return;

  if (others.length) {
    grid.innerHTML = others.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp)).map(repoCard).join('');
    attachCardToggles(grid);
    if (empty) empty.hidden = true;
  } else {
    grid.innerHTML = '';
    if (empty) empty.hidden = filtered.length > 0;
  }
}

function repoCard(d) {
  return `
    <div class="repo-card" data-id="${d.Timestamp}">
      <div class="repo-card-header">
        <div>
          <div class="repo-card-name">${d.Nombre || '—'}</div>
          <div class="repo-card-date">${formatDate(d.Timestamp)}</div>
        </div>
        ${badgeEstado(d.Estado)}
      </div>
      <p class="repo-card-problema">${d.Problema || ''}</p>
      <div class="repo-card-badges">
        ${badgePais(d.País)}
        ${badgeUrgencia(d.Urgencia)}
        ${badgeImpacto(d['Impacto Estimado'])}
        ${badgeCompromiso(d['Compromiso con Cliente'])}
      </div>
      <div class="repo-card-details">
        <div class="detail-row">
          <span class="detail-label">Impacto actual</span>
          <span class="detail-value">${d['Impacto Actual'] || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Usuarios de la solución</span>
          <span class="detail-value">${d.Usuarios || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">¿Cómo medimos el éxito?</span>
          <span class="detail-value">${d['Medición'] || '—'}</span>
        </div>
        ${d.Equipo ? `<div class="detail-row">
          <span class="detail-label">Equipo de apoyo</span>
          <span class="detail-value">${d.Equipo}</span>
        </div>` : ''}
      </div>
      <button class="repo-card-toggle">Ver más ↓</button>
    </div>
  `;
}

function attachCardToggles(container) {
  container.querySelectorAll('.repo-card-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card     = btn.closest('.repo-card');
      const expanded = card.classList.toggle('expanded');
      btn.textContent = expanded ? 'Ver menos ↑' : 'Ver más ↓';
    });
  });
}

function initRepoFilters(data) {
  document.getElementById('repoSearch')?.addEventListener('input',  applyRepoFilters);
  document.getElementById('repoFilterPais')?.addEventListener('change', applyRepoFilters);
  document.getElementById('repoFilterEstado')?.addEventListener('change', applyRepoFilters);
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────

async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="admin-empty">Cargando...</td></tr>`;

  try {
    const token = await getToken();
    const res = await fetch(ADMIN_URL, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const users = await res.json();
    if (!Array.isArray(users) || !users.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="admin-empty">No hay usuarios registrados.</td></tr>`;
      return;
    }
    renderAdminUsers(users);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-empty">Error al cargar usuarios.</td></tr>`;
  }
}

function roleBadge(rol) {
  if (rol === 'admin')         return `<span class="badge-rol badge-rol-admin">Admin</span>`;
  if (rol === 'director_meli') return `<span class="badge-rol badge-rol-director">Director / Meli</span>`;
  return `<span class="badge-rol badge-rol-usuario">Usuario</span>`;
}

function renderAdminUsers(users) {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  tbody.innerHTML = users.map(u => `
    <tr data-id="${u.id}">
      <td>${u.nombre || '<span style="color:var(--text-dim)">—</span>'}</td>
      <td style="color:var(--text-muted);font-size:0.85rem">${u.email}</td>
      <td>${roleBadge(u.rol)}</td>
      <td>
        <label class="toggle-switch">
          <input type="checkbox" class="toggle-activo" data-id="${u.id}" ${u.activo ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>
        <button class="btn-table-edit" data-id="${u.id}">Editar</button>
      </td>
    </tr>
  `).join('');

  // Toggle activo
  tbody.querySelectorAll('.toggle-activo').forEach(toggle => {
    toggle.addEventListener('change', async (e) => {
      const id     = e.target.dataset.id;
      const activo = e.target.checked;
      await patchUser(id, { activo });
    });
  });

  // Edit button
  tbody.querySelectorAll('.btn-table-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = btn.dataset.id;
      const user = users.find(u => u.id === id);
      if (user) openUserModal(user);
    });
  });
}

// ─── User Modal ───────────────────────────────────────────────────────────────

function openUserModal(user = null) {
  const modal    = document.getElementById('modal-user');
  const titleEl  = document.getElementById('modal-title');
  const idInput  = document.getElementById('modal-user-id');
  const nombre   = document.getElementById('modal-user-nombre');
  const email    = document.getElementById('modal-user-email');
  const rolSel   = document.getElementById('modal-user-rol');

  const isEdit = !!user;
  titleEl.textContent  = isEdit ? 'Editar Usuario' : 'Agregar Usuario';
  idInput.value        = user?.id    || '';
  nombre.value         = user?.nombre || '';
  email.value          = user?.email  || '';
  rolSel.value         = user?.rol    || 'usuario';
  email.disabled       = isEdit; // no se puede cambiar el email una vez creado

  modal.hidden = false;
}

function closeUserModal() {
  document.getElementById('modal-user').hidden = true;
  document.getElementById('form-modal-user').reset();
  document.getElementById('modal-user-email').disabled = false;
}

// Inicializar eventos del modal
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-add-user')?.addEventListener('click', () => openUserModal());
  document.getElementById('btn-modal-close')?.addEventListener('click', closeUserModal);
  document.getElementById('btn-modal-cancel')?.addEventListener('click', closeUserModal);

  // Cerrar al hacer clic fuera del card
  document.getElementById('modal-user')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-user')) closeUserModal();
  });

  document.getElementById('form-modal-user')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id     = document.getElementById('modal-user-id').value;
    const nombre = document.getElementById('modal-user-nombre').value.trim();
    const email  = document.getElementById('modal-user-email').value.trim();
    const rol    = document.getElementById('modal-user-rol').value;

    if (!email || !rol) return;

    const saveBtn = document.getElementById('btn-modal-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    try {
      const token = await getToken();
      let res;
      if (id) {
        // Editar
        res = await fetch(ADMIN_URL, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ id, nombre, rol }),
        });
      } else {
        // Crear
        res = await fetch(ADMIN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ email, nombre, rol }),
        });
      }

      if (res.ok) {
        closeUserModal();
        loadAdminUsers();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al guardar. Intenta de nuevo.');
      }
    } catch {
      alert('Error de conexión.');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar';
    }
  });
});

async function patchUser(id, updates) {
  try {
    const token = await getToken();
    const res = await fetch(ADMIN_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Error al actualizar.');
      loadAdminUsers(); // recargar para revertir el toggle
    }
  } catch {
    alert('Error de conexión.');
    loadAdminUsers();
  }
}
