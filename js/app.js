/* ═══════════════════════════════════════════════════════
   AI STRATEGY HUB — app.js
   Stack: Netlify (hosting) + Supabase (base de datos)
   El backend vive en netlify/functions/api.js
   ═══════════════════════════════════════════════════════ */

const API_URL = '/.netlify/functions/api';

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

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initPageTabs();
  initNav();
  initForm();
  initProjects();
  loadData();
});

// ─── Page Tabs (Hub vs Projects) ────────────────────────────────────────────
function initPageTabs() {
  const tabs = document.querySelectorAll('.page-tab');
  const pages = document.querySelectorAll('.page-content');
  const navHub = document.getElementById('navHub');
  const navProjects = document.getElementById('navProjects');
  const logoText = document.querySelector('.logo-text');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.page;

      // Update tab active state
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Show/hide pages
      pages.forEach(p => p.classList.remove('active'));
      const activePage = document.getElementById('page-' + target);
      if (activePage) activePage.classList.add('active');

      // Switch nav links
      if (navHub && navProjects) {
        navHub.style.display = target === 'hub' ? '' : 'none';
        navProjects.style.display = target === 'projects' ? '' : 'none';
      }

      // Update logo text
      if (logoText) {
        if (target === 'hub') {
          logoText.innerHTML = 'AI Strategy <span class="logo-accent">Hub</span>';
        } else {
          logoText.innerHTML = 'AI Transformation <span class="logo-accent">Team</span>';
        }
      }

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Close mobile nav if open
      document.querySelectorAll('.nav').forEach(n => n.classList.remove('open'));

      // Reload projects when entering projects tab
      if (target === 'projects' && typeof loadProjects === 'function') {
        loadProjects();
      }
    });
  });
}

// ─── Navigation ─────────────────────────────────────────────────────────────
function initNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('navHub');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    // Toggle the currently visible nav
    const hubNav = document.getElementById('navHub');
    const projNav = document.getElementById('navProjects');
    const activeNav = (hubNav && hubNav.style.display !== 'none') ? hubNav : projNav;
    if (activeNav) activeNav.classList.toggle('open');
  });

  // Close on nav link click
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.nav').forEach(n => n.classList.remove('open'));
    });
  });

  // Active state on scroll
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  const observer = new IntersectionObserver((entries) => {
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
  const form = document.getElementById('aiForm');
  const submitBtn = document.getElementById('submitBtn');
  const newRequestBtn = document.getElementById('newRequestBtn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    setSubmitting(true);

    const data = {
      nombre:            form.nombre.value.trim(),
      pais:              form.pais.value,
      problema:          form.problema.value.trim(),
      impacto:           form.impacto.value.trim(),
      usuarios:          form.usuarios.value.trim(),
      medicion:          form.medicion.value.trim(),
      equipo:            form.equipo.value.trim(),
      urgencia:          form.urgencia.value,
      impacto_estimado:  form.impacto_estimado.value,
      compromiso:        form.compromiso.value,
    };

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        showSuccess();
        loadData();
      } else {
        alert('Error al enviar. Intenta de nuevo.');
      }
    } catch (err) {
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
    const el = form[name];
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

  // Radio: compromiso
  const compromisoErr = document.getElementById('error-compromiso');
  if (!form.compromiso.value) {
    if (compromisoErr) compromisoErr.textContent = 'Selecciona una opción.';
    valid = false;
  } else {
    if (compromisoErr) compromisoErr.textContent = '';
  }

  // Clear error on input
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
    const res = await fetch(API_URL);
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
  const total = data.length;
  const done = data.filter(d => d.Estado === 'Completado').length;
  const ongoing = data.filter(d => ['Priorizado', 'En Desarrollo'].includes(d.Estado)).length;
  const compromisos = data.filter(d => d['Compromiso con Cliente'] === 'Sí').length;

  animateCount('kpiTotal', total);
  animateCount('kpiDone', done);
  animateCount('kpiOngoing', ongoing);
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
const KANBAN_DONE = ['Completado'];

function renderKanban(data, filterPais = '') {
  const filtered = filterPais ? data.filter(d => d.País === filterPais) : data;

  const backlog = filtered.filter(d => KANBAN_BACKLOG.includes(d.Estado));
  const ongoing = filtered.filter(d => KANBAN_ONGOING.includes(d.Estado));
  const done = filtered.filter(d => KANBAN_DONE.includes(d.Estado));

  document.getElementById('cnt-backlog').textContent = backlog.length;
  document.getElementById('cnt-ongoing').textContent = ongoing.length;
  document.getElementById('cnt-done').textContent = done.length;

  document.getElementById('cards-backlog').innerHTML = backlog.length ? backlog.map(kanbanCard).join('') : emptyCol();
  document.getElementById('cards-ongoing').innerHTML = ongoing.length ? ongoing.map(kanbanCard).join('') : emptyCol();
  document.getElementById('cards-done').innerHTML = done.length ? done.map(kanbanCard).join('') : emptyCol();
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
const IMPACTO_MAP = { 'Bajo': 1, 'Medio': 2, 'Alto': 3 };

function renderMatrix(data) {
  const eligible = data.filter(d => d['Impacto Estimado'] && d.Urgencia &&
    URGENCIA_MAP[d.Urgencia] && IMPACTO_MAP[d['Impacto Estimado']]);

  if (!eligible.length) return;

  const points = eligible.map(d => ({
    x: URGENCIA_MAP[d.Urgencia] + (Math.random() * 0.3 - 0.15),
    y: IMPACTO_MAP[d['Impacto Estimado']] + (Math.random() * 0.3 - 0.15),
    label: d.Nombre,
    pais: d.País,
    problema: truncate(d.Problema, 60),
    estado: d.Estado,
  }));

  const ctx = document.getElementById('matrixChart');
  if (!ctx) return;

  if (matrixChartInstance) matrixChartInstance.destroy();

  matrixChartInstance = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Solicitudes',
        data: points,
        backgroundColor: points.map(p => {
          const urgH = p.x >= 2.5;
          const impH = p.y >= 2.5;
          if (urgH && impH) return 'rgba(255,215,0,0.85)';
          if (!urgH && impH) return 'rgba(59,130,246,0.85)';
          if (urgH && !impH) return 'rgba(249,115,22,0.85)';
          return 'rgba(107,114,128,0.85)';
        }),
        borderColor: 'rgba(0,0,0,0.3)',
        borderWidth: 1,
        pointRadius: 9,
        pointHoverRadius: 12,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: {
          min: 0.5, max: 3.5,
          grid: { color: 'rgba(255,255,255,0.05)' },
          border: { color: 'rgba(255,255,255,0.1)' },
          ticks: {
            color: '#cccccc',
            font: { size: 13, weight: '600' },
            callback: v => ({ 1: 'Baja', 2: 'Media', 3: 'Alta' }[Math.round(v)] || ''),
            stepSize: 1,
          },
          title: {
            display: true,
            text: 'Urgencia →',
            color: '#FFD700',
            font: { size: 13, weight: '700' },
            padding: { top: 10 },
          }
        },
        y: {
          min: 0.5, max: 3.5,
          grid: { color: 'rgba(255,255,255,0.05)' },
          border: { color: 'rgba(255,255,255,0.1)' },
          ticks: {
            color: '#cccccc',
            font: { size: 13, weight: '600' },
            callback: v => ({ 1: 'Bajo', 2: 'Medio', 3: 'Alto' }[Math.round(v)] || ''),
            stepSize: 1,
          },
          title: {
            display: true,
            text: 'Impacto →',
            color: '#FFD700',
            font: { size: 13, weight: '700' },
            padding: { bottom: 10 },
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a1a',
          borderColor: '#333',
          borderWidth: 1,
          titleColor: '#FFD700',
          bodyColor: '#ccc',
          padding: 12,
          callbacks: {
            title: ctx => ctx[0].raw.label + ' — ' + ctx[0].raw.pais,
            label: ctx => ctx.raw.problema,
            afterLabel: ctx => 'Estado: ' + ctx.raw.estado,
          }
        },
        // Draw quadrant dividing lines
        annotation: undefined,
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
        c.lineWidth = 1;
        c.setLineDash([6, 4]);
        c.beginPath(); c.moveTo(midX, top); c.lineTo(midX, bottom); c.stroke();
        c.beginPath(); c.moveTo(left, midY); c.lineTo(right, midY); c.stroke();
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
  const pais = document.getElementById('repoFilterPais')?.value || '';
  const estado = document.getElementById('repoFilterEstado')?.value || '';

  let filtered = allData.filter(d => {
    const matchSearch = !search || [d.Nombre, d.País, d.Problema, d['Impacto Actual']]
      .some(f => (f || '').toLowerCase().includes(search));
    const matchPais = !pais || d.País === pais;
    const matchEstado = !estado || d.Estado === estado;
    return matchSearch && matchPais && matchEstado;
  });

  // Split done vs others
  const done = filtered.filter(d => d.Estado === 'Completado');
  const others = filtered.filter(d => d.Estado !== 'Completado');

  // Logros section
  const logrosSection = document.getElementById('logrosSection');
  const logrosGrid = document.getElementById('logrosGrid');
  const logrosBadge = document.getElementById('logrosBadge');
  if (done.length && logrosSection && logrosGrid) {
    logrosSection.hidden = false;
    logrosBadge.textContent = done.length;
    logrosGrid.innerHTML = done.map(repoCard).join('');
    attachCardToggles(logrosGrid);
  } else if (logrosSection) {
    logrosSection.hidden = true;
  }

  // Main grid
  const grid = document.getElementById('repoGrid');
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
          <span class="detail-value">${d.Medición || '—'}</span>
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
      const card = btn.closest('.repo-card');
      const expanded = card.classList.toggle('expanded');
      btn.textContent = expanded ? 'Ver menos ↑' : 'Ver más ↓';
    });
  });
}

function initRepoFilters(data) {
  document.getElementById('repoSearch')?.addEventListener('input', applyRepoFilters);
  document.getElementById('repoFilterPais')?.addEventListener('change', applyRepoFilters);
  document.getElementById('repoFilterEstado')?.addEventListener('change', applyRepoFilters);
}

// ═══════════════════════════════════════════════════════════════════════════
// PROYECTOS — carga dinámica + modal de agregar
// ═══════════════════════════════════════════════════════════════════════════

const PROJECTS_API = '/.netlify/functions/api?resource=proyectos';
const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024; // 1.5 MB

function initProjects() {
  initProjectModal();
  // Cargar proyectos al iniciar si la pestaña de proyectos está activa
  if (document.getElementById('page-projects')?.classList.contains('active')) {
    loadProjects();
  }
}

// ─── Cargar proyectos desde Supabase ───────────────────────────────────────
async function loadProjects() {
  const grid = document.getElementById('projectsGrid');
  const loading = document.getElementById('projectsLoading');
  const empty = document.getElementById('projectsEmpty');

  if (!grid) return;

  loading.hidden = false;
  empty.hidden = true;
  grid.innerHTML = '';

  try {
    const res = await fetch(PROJECTS_API);
    if (!res.ok) throw new Error('Error de servidor');
    const projects = await res.json();

    loading.hidden = true;

    if (!Array.isArray(projects) || projects.length === 0) {
      empty.hidden = false;
      return;
    }

    grid.innerHTML = projects.map(renderProjectCard).join('');
  } catch (err) {
    console.error('Error cargando proyectos:', err);
    loading.hidden = true;
    empty.hidden = false;
    empty.querySelector('h3').textContent = 'No se pudieron cargar los proyectos';
    empty.querySelector('p').textContent = 'Intenta recargar la página.';
  }
}

// ─── Render de una tarjeta de proyecto ─────────────────────────────────────
function renderProjectCard(p) {
  const nombre = escapeHtml(p.nombre || 'Sin nombre');
  const descripcion = escapeHtml(p.descripcion || '');
  const owner = escapeHtml(p.owner || '—');
  const link = p.link || '#';
  const initials = getInitials(p.owner || '?');

  const coverHtml = p.imagen_url
    ? `<img src="${escapeHtml(p.imagen_url)}" alt="${nombre}" class="project-card-img" />`
    : `<div class="project-card-cover-pattern"></div>
       <div class="project-card-cover-icon">
         <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
           <rect x="6" y="10" width="36" height="28" rx="3" stroke="currentColor" stroke-width="2.5"/>
           <path d="M6 18h36" stroke="currentColor" stroke-width="2.5"/>
           <circle cx="12" cy="14" r="1.5" fill="currentColor"/>
           <circle cx="17" cy="14" r="1.5" fill="currentColor"/>
           <circle cx="22" cy="14" r="1.5" fill="currentColor"/>
         </svg>
       </div>`;

  const coverClass = p.imagen_url
    ? 'project-card-cover project-card-cover-img'
    : 'project-card-cover';

  const coverStyle = p.imagen_url ? '' : 'style="--accent-1: #FFD700; --accent-2: #f97316;"';

  return `
    <a href="${escapeHtml(link)}" target="_blank" rel="noopener" class="project-card">
      <div class="${coverClass}" ${coverStyle}>
        ${coverHtml}
      </div>
      <div class="project-card-body">
        <h3 class="project-card-title">${nombre}</h3>
        <p class="project-card-desc">${descripcion}</p>
        <div class="project-card-footer">
          <span class="project-card-arrow">→</span>
        </div>
        <div class="project-card-owner">
          <span class="project-card-owner-icon">${escapeHtml(initials)}</span>
          <span class="project-card-owner-label">Owner</span>
          <span class="project-card-owner-name">${owner}</span>
        </div>
      </div>
    </a>
  `;
}

function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Modal de agregar proyecto ─────────────────────────────────────────────
function initProjectModal() {
  const modal = document.getElementById('projectModal');
  const openBtn = document.getElementById('openProjectModalBtn');
  const closeBtn = document.getElementById('closeProjectModalBtn');
  const cancelBtn = document.getElementById('cancelProjectBtn');
  const form = document.getElementById('projectForm');
  const success = document.getElementById('projectSuccess');
  const closeSuccessBtn = document.getElementById('closeSuccessBtn');

  if (!modal || !openBtn) return;

  const openModal = () => {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    form.hidden = false;
    success.hidden = true;
    form.reset();
    clearImagePreview();
    clearProjectErrors();
  };
  const closeModal = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
  };

  openBtn.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  closeSuccessBtn?.addEventListener('click', () => {
    closeModal();
    loadProjects();
  });

  // Cerrar al hacer click fuera
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  // Image uploader
  const fileInput = document.getElementById('projImagen');
  const uploader = document.getElementById('imageUploader');
  const emptyView = document.getElementById('imageUploaderEmpty');
  const previewView = document.getElementById('imageUploaderPreview');
  const previewImg = document.getElementById('imagePreview');
  const removeBtn = document.getElementById('imageRemoveBtn');

  uploader?.addEventListener('click', (e) => {
    if (e.target === removeBtn) return;
    fileInput.click();
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    handleImageFile(file);
  });

  removeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearImagePreview();
  });

  function handleImageFile(file) {
    const errorEl = document.getElementById('error-projImagen');
    errorEl.textContent = '';

    if (!file.type.startsWith('image/')) {
      errorEl.textContent = 'El archivo debe ser una imagen';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      errorEl.textContent = 'La imagen no puede superar 1.5 MB';
      clearImagePreview();
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      previewImg.src = evt.target.result;
      emptyView.hidden = true;
      previewView.hidden = false;
    };
    reader.readAsDataURL(file);
  }

  function clearImagePreview() {
    if (fileInput) fileInput.value = '';
    if (previewImg) previewImg.src = '';
    if (emptyView) emptyView.hidden = false;
    if (previewView) previewView.hidden = true;
    const errorEl = document.getElementById('error-projImagen');
    if (errorEl) errorEl.textContent = '';
  }

  // Submit del formulario
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateProjectForm(form)) return;

    const submitBtn = document.getElementById('submitProjectBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');
    submitBtn.disabled = true;
    btnText.textContent = 'Publicando...';
    btnSpinner.hidden = false;

    try {
      const payload = {
        nombre:      form.nombre.value.trim(),
        descripcion: form.descripcion.value.trim(),
        link:        form.link.value.trim(),
        owner:       form.owner.value.trim(),
      };

      // Si hay imagen, leerla como base64
      const file = fileInput.files[0];
      if (file) {
        const base64 = await fileToBase64(file);
        payload.imagen_base64 = base64;
        payload.imagen_nombre = file.name;
      }

      const res = await fetch(PROJECTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Error al guardar el proyecto');
      }

      form.hidden = true;
      success.hidden = false;
    } catch (err) {
      alert('No se pudo publicar el proyecto: ' + (err.message || 'error desconocido'));
      console.error(err);
    } finally {
      submitBtn.disabled = false;
      btnText.textContent = 'Publicar proyecto';
      btnSpinner.hidden = true;
    }
  });
}

function validateProjectForm(form) {
  clearProjectErrors();
  let valid = true;

  const fields = [
    { name: 'nombre',      id: 'error-projNombre',      label: 'nombre' },
    { name: 'owner',       id: 'error-projOwner',       label: 'owner' },
    { name: 'descripcion', id: 'error-projDescripcion', label: 'descripción' },
    { name: 'link',        id: 'error-projLink',        label: 'link' },
  ];

  fields.forEach(f => {
    const value = (form[f.name].value || '').trim();
    if (!value) {
      document.getElementById(f.id).textContent = `Completa el ${f.label}`;
      valid = false;
    }
  });

  const link = (form.link.value || '').trim();
  if (link && !/^https?:\/\//i.test(link)) {
    document.getElementById('error-projLink').textContent = 'El link debe empezar con http:// o https://';
    valid = false;
  }

  return valid;
}

function clearProjectErrors() {
  ['error-projNombre','error-projOwner','error-projDescripcion','error-projLink','error-projImagen']
    .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}
