let currentRole = '';
let allStudents = [];
let pieChart = null, barChart = null;

document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('/api/admin/session');
  const data = await res.json();
  if (data.loggedIn) { initDashboard(data.role); }
  document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
});

async function adminLogin() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  if (!user || !pass) return showLoginMsg('Complete todos los campos.', 'error');

  const btn = document.getElementById('btnLogin');
  btn.classList.add('loading');
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass })
    });
    const data = await res.json();
    if (data.success) { initDashboard(data.role); }
    else showLoginMsg(data.message, 'error');
  } catch (e) { showLoginMsg('Error de conexión.', 'error'); }
  finally { btn.classList.remove('loading'); }
}

function initDashboard(role) {
  currentRole = role;
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  const badge = document.getElementById('roleBadge');
  badge.textContent = role === 'developer' ? 'Desarrollador' : 'Administrador';
  if (role === 'developer') {
    badge.classList.add('developer');
    document.body.classList.add('role-developer');
    document.querySelectorAll('.dev-only').forEach(el => el.classList.remove('hidden'));
  }
  loadStats();
}

async function adminLogout() {
  await fetch('/api/admin/logout', { method: 'POST' });
  location.reload();
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  document.getElementById('content' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.remove('hidden');

  if (tab === 'overview') loadStats();
  else if (tab === 'students') loadStudents();
  else if (tab === 'candidates') loadAdminCandidates();
  else if (tab === 'settings') loadSettings();
}

// ===== STATS =====
async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();

    document.getElementById('statTotal').textContent = data.totalVotes;
    document.getElementById('statStudents').textContent = data.totalStudents;
    const pct = data.totalStudents > 0 ? Math.round((data.totalVotes / data.totalStudents) * 100) : 0;
    document.getElementById('statParticipation').textContent = pct + '%';

    renderPieChart(data.votesByCandidate);
    renderBarChart(data.participationBySection);
    renderVotesTable(data.recentVotes);
  } catch (e) { console.error(e); }
}

function renderPieChart(data) {
  const ctx = document.getElementById('pieChart');
  const colors = ['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.voto_nombre),
      datasets: [{ data: data.map(d => parseInt(d.total)), backgroundColor: colors.slice(0, data.length), borderWidth: 0, borderRadius: 4 }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16, font: { family: 'Inter' } } } }, cutout: '65%' }
  });
}

function renderBarChart(data) {
  const ctx = document.getElementById('barChart');
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.seccion || 'Sin sección'),
      datasets: [
        { label: 'Votaron', data: data.map(d => parseInt(d.voted)), backgroundColor: 'rgba(99,102,241,0.7)', borderRadius: 6 },
        { label: 'No votaron', data: data.map(d => parseInt(d.total_students) - parseInt(d.voted)), backgroundColor: 'rgba(100,116,139,0.3)', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true, scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'Inter' } } },
        y: { stacked: true, grid: { color: 'rgba(148,163,184,0.05)' }, ticks: { color: '#94a3b8' } }
      },
      plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } } }
    }
  });
}

function renderVotesTable(votes) {
  const body = document.getElementById('votesBody');
  body.innerHTML = votes.map(v => `<tr>
    <td>${v.nombre}</td><td>${v.seccion || '-'}</td>
    <td><span class="vote-badge voted">${v.voto_nombre}</span></td>
    <td>${new Date(v.fecha_voto).toLocaleString('es-CR')}</td>
    <td class="dev-only-cell"><button class="btn-icon" onclick="deleteVote(${v.id})" title="Eliminar">🗑️</button></td>
  </tr>`).join('');
}

async function deleteVote(id) {
  if (!confirm('¿Eliminar este voto?')) return;
  await fetch(`/api/admin/votes/${id}`, { method: 'DELETE' });
  loadStats();
}

// ===== STUDENTS =====
async function loadStudents() {
  const res = await fetch('/api/admin/students');
  allStudents = await res.json();
  const sections = [...new Set(allStudents.map(s => s.seccion).filter(Boolean))].sort();
  const sel = document.getElementById('sectionFilter');
  sel.innerHTML = '<option value="">Todas las secciones</option>' + sections.map(s => `<option value="${s}">${s}</option>`).join('');
  filterStudents();
}

function filterStudents() {
  const search = document.getElementById('studentSearch').value.toLowerCase();
  const section = document.getElementById('sectionFilter').value;
  const filtered = allStudents.filter(s =>
    (!search || s.nombre.toLowerCase().includes(search) || s.cedula.includes(search)) &&
    (!section || s.seccion === section)
  );
  document.getElementById('studentsBody').innerHTML = filtered.map(s => `<tr>
    <td>${s.cedula}</td><td>${s.nombre}</td><td>${s.seccion || '-'}</td>
    <td><span class="vote-badge ${s.activa ? 'voted' : 'pending'}">${s.activa ? 'Activo' : 'Inactivo'}</span></td>
    <td><span class="vote-badge ${s.ha_votado ? 'voted' : 'pending'}">${s.ha_votado ? '✅ Sí' : '⏳ No'}</span></td>
  </tr>`).join('');
}

// ===== CANDIDATES =====
async function loadAdminCandidates() {
  const res = await fetch('/api/admin/candidates');
  const candidates = await res.json();
  document.getElementById('candidatesBody').innerHTML = candidates.map(c => `<tr>
    <td><div style="width:40px;height:40px;border-radius:10px;background:${c.color};display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:0.85rem">${c.iniciales}</div></td>
    <td>${c.nombre}</td><td>${c.partido}</td>
    <td><div style="width:24px;height:24px;border-radius:6px;background:${c.color}"></div></td>
    <td><button class="btn-icon" onclick="deleteCandidate(${c.id})" title="Eliminar">🗑️</button></td>
  </tr>`).join('');
}

function showAddCandidate() {
  const nombre = prompt('Nombre del candidato:');
  if (!nombre) return;
  const partido = prompt('Nombre del partido:');
  const iniciales = prompt('Iniciales (ej: JP):');
  const color = prompt('Color hex (ej: #6366f1):', '#6366f1');
  fetch('/api/admin/candidates', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, partido, color, iniciales, orden: 0 })
  }).then(() => loadAdminCandidates());
}

async function deleteCandidate(id) {
  if (!confirm('¿Eliminar este candidato?')) return;
  await fetch(`/api/admin/candidates/${id}`, { method: 'DELETE' });
  loadAdminCandidates();
}

// ===== SETTINGS =====
async function loadSettings() {
  const res = await fetch('/api/config');
  const cfg = await res.json();
  document.getElementById('cfgTitle').value = cfg.titulo_sistema || '';
  document.getElementById('cfgSubtitle').value = cfg.subtitulo || '';
  document.getElementById('cfgLogo').value = cfg.logo_url || '';
  document.getElementById('cfgVotingActive').checked = cfg.votacion_activa === 'true';
}

async function saveConfig() {
  const configs = [
    ['titulo_sistema', document.getElementById('cfgTitle').value],
    ['subtitulo', document.getElementById('cfgSubtitle').value],
    ['logo_url', document.getElementById('cfgLogo').value]
  ];
  for (const [clave, valor] of configs) {
    await fetch('/api/admin/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave, valor })
    });
  }
  alert('✅ Configuración guardada');
}

async function toggleVoting() {
  const active = document.getElementById('cfgVotingActive').checked;
  await fetch('/api/admin/config', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clave: 'votacion_activa', valor: active ? 'true' : 'false' })
  });
}

async function resetAllVotes() {
  if (!confirm('⚠️ ¿Está SEGURO de que desea eliminar TODOS los votos? Esta acción NO se puede deshacer.')) return;
  if (!confirm('ÚLTIMA CONFIRMACIÓN: ¿Realmente desea borrar todos los votos?')) return;
  await fetch('/api/admin/reset-votes', { method: 'POST' });
  alert('Todos los votos han sido eliminados.');
  loadStats();
}

function showLoginMsg(text, type) {
  const box = document.getElementById('loginMessage');
  box.querySelector('.message-text').textContent = text;
  box.querySelector('.message-icon').textContent = type === 'error' ? '⚠️' : '✅';
  box.className = `message-box ${type}`;
  box.style.display = 'flex';
}
