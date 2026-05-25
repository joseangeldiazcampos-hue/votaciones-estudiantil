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
      datasets: [{
        data: data.map(d => parseInt(d.total)),
        backgroundColor: colors.slice(0, data.length),
        borderWidth: 0,
        borderRadius: 8,
        hoverOffset: 15
      }]
    },
    options: {
      responsive: true,
      animation: {
        duration: 2000,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', padding: 20, font: { family: 'Inter', size: 12 } }
        }
      },
      cutout: '70%'
    }
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
        { label: 'Votaron', data: data.map(d => parseInt(d.voted)), backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 8 },
        { label: 'No votaron', data: data.map(d => parseInt(d.total_students) - parseInt(d.voted)), backgroundColor: 'rgba(148, 163, 184, 0.1)', borderRadius: 8 }
      ]
    },
    options: {
      responsive: true,
      animation: {
        duration: 1500,
        easing: 'easeInOutBack',
        delay: (context) => context.dataIndex * 50
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'Inter' } } },
        y: { stacked: true, grid: { color: 'rgba(148, 163, 184, 0.05)' }, ticks: { color: '#94a3b8' } }
      },
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } }
      }
    }
  });
}

function renderVotesTable(votes) {
  const body = document.getElementById('votesBody');
  body.innerHTML = votes.map(v => `<tr>
    <td>${v.nombre}</td><td>${v.seccion || '-'}</td>
    <td>${new Date(v.fecha_voto).toLocaleString('es-CR')}</td>
    <td class="dev-only-cell"><button class="btn-icon" onclick="deleteVote(${v.id})" title="Eliminar">🗑️</button></td>
  </tr>`).join('');
}

function deleteVote(id) {
  showConfirmAction(
    '🗑️ Eliminar Voto',
    '¿Está seguro de que desea eliminar este voto? Esta acción no se puede deshacer.',
    async () => {
      try {
        const res = await fetch(`/api/admin/votes/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) {
          alert('Error: ' + (data.error || 'No autorizado.'));
          return;
        }
        loadStats();
      } catch (e) {
        alert('Error de conexión: ' + e.message);
      }
    }
  );
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
  
  const displayList = filtered.slice(0, 100); // Only show first 100 for performance
  
  document.getElementById('studentsBody').innerHTML = displayList.map(s => `<tr>
    <td>${s.cedula}</td><td>${s.nombre}</td><td>${s.seccion || '-'}</td>
    <td><span class="vote-badge ${s.activa ? 'voted' : 'pending'}">${s.activa ? 'Activo' : 'Inactivo'}</span></td>
    <td><span class="vote-badge ${s.ha_votado ? 'voted' : 'pending'}">${s.ha_votado ? '✅ Sí' : '⏳ No'}</span></td>
  </tr>`).join('') + (filtered.length > 100 ? `<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-dim);">... y ${filtered.length - 100} más (usa el buscador para filtrar)</td></tr>` : '');
}

// ===== CANDIDATES =====
let editingCandidateId = null;

async function loadAdminCandidates() {
  const res = await fetch('/api/admin/candidates');
  const candidates = await res.json();
  const grid = document.getElementById('candidatesManageGrid');
  grid.innerHTML = candidates.map((c, index) => {
    const avatarContent = c.imagen_url
      ? `<img src="${c.imagen_url}" alt="${c.nombre}">`
      : c.iniciales;
    return `<div class="candidate-manage-card">
      <div class="candidate-manage-top">
        <div class="candidate-manage-avatar" style="background:${c.color}">${avatarContent}</div>
        <div class="candidate-manage-info">
          <div class="candidate-manage-name">${c.nombre}</div>
          <div class="candidate-manage-party">${c.partido}</div>
        </div>
      </div>
      <div class="candidate-manage-meta">
        <div class="candidate-manage-color" style="background:${c.color}"></div>
        <span class="meta-tag">${c.iniciales}</span>
        <span class="meta-tag">Orden: ${c.orden}</span>
        ${c.imagen_url ? '<span class="meta-tag">📷 Imagen</span>' : ''}
      </div>
      <div class="candidate-manage-actions">
        <button class="btn-edit" onclick='editCandidate(${JSON.stringify(c).replace(/'/g, "&#39;")})'>✏️ Editar</button>
        <button class="btn-delete-card" onclick="deleteCandidate(${c.id})">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function openCandidateModal(candidate = null) {
  editingCandidateId = candidate ? candidate.id : null;
  document.getElementById('candidateModalTitle').textContent = candidate ? 'Editar Candidato' : 'Agregar Candidato';
  document.getElementById('editNombre').value = candidate ? candidate.nombre : '';
  document.getElementById('editPartido').value = candidate ? candidate.partido : '';
  document.getElementById('editIniciales').value = candidate ? candidate.iniciales : '';
  document.getElementById('editColor').value = candidate ? candidate.color : '#6366f1';
  document.getElementById('editColorText').value = candidate ? candidate.color : '#6366f1';
  document.getElementById('editImagen').value = candidate ? (candidate.imagen_url || '') : '';
  document.getElementById('editOrden').value = candidate ? candidate.orden : 0;
  updatePreview();
  document.getElementById('candidateModal').classList.remove('hidden');
}

function closeCandidateModal() {
  document.getElementById('candidateModal').classList.add('hidden');
  editingCandidateId = null;
}

function editCandidate(candidate) {
  openCandidateModal(candidate);
}

function updatePreview() {
  const nombre = document.getElementById('editNombre').value || 'Nombre';
  const partido = document.getElementById('editPartido').value || 'Partido';
  const iniciales = document.getElementById('editIniciales').value || 'AB';
  const color = document.getElementById('editColor').value;
  const imagen = document.getElementById('editImagen').value;

  document.getElementById('editColorText').value = color;
  document.getElementById('previewName').textContent = nombre;
  document.getElementById('previewParty').textContent = partido;

  const avatar = document.getElementById('previewAvatar');
  avatar.style.background = color;
  if (imagen) {
    avatar.innerHTML = `<img src="${imagen}" alt="${nombre}" style="width:100%;height:100%;object-fit:cover">`;
  } else {
    avatar.textContent = iniciales;
  }
}

function syncColorFromText() {
  const hex = document.getElementById('editColorText').value;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    document.getElementById('editColor').value = hex;
    updatePreview();
  }
}

async function saveCandidate() {
  const data = {
    nombre: document.getElementById('editNombre').value.trim(),
    partido: document.getElementById('editPartido').value.trim(),
    iniciales: document.getElementById('editIniciales').value.trim(),
    color: document.getElementById('editColor').value,
    imagen_url: document.getElementById('editImagen').value.trim(),
    orden: parseInt(document.getElementById('editOrden').value) || 0,
    activo: true
  };

  if (!data.nombre || !data.partido || !data.iniciales) {
    alert('Complete nombre, partido e iniciales.');
    return;
  }

  const url = editingCandidateId
    ? `/api/admin/candidates/${editingCandidateId}`
    : '/api/admin/candidates';
  const method = editingCandidateId ? 'PUT' : 'POST';

  await fetch(url, {
    method, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  closeCandidateModal();
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

function resetAllVotes() {
  showConfirmAction(
    '⚠️ Reiniciar TODOS los Votos',
    'Esta acción eliminará TODOS los votos registrados. No se puede deshacer. ¿Está completamente seguro?',
    async () => {
      try {
        const res = await fetch('/api/admin/reset-votes', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          alert('Error: ' + (data.error || 'No autorizado.'));
          return;
        }
        alert('✅ Todos los votos han sido eliminados.');
        loadStats();
      } catch (e) {
        alert('Error de conexión: ' + e.message);
      }
    }
  );
}

function deleteCandidate(id) {
  showConfirmAction(
    '🗑️ Eliminar Candidato',
    '¿Está seguro de que desea eliminar este candidato?',
    async () => {
      await fetch(`/api/admin/candidates/${id}`, { method: 'DELETE' });
      loadAdminCandidates();
    }
  );
}

// ===== CUSTOM CONFIRM MODAL =====
let confirmCallback = null;

function showConfirmAction(title, message, onConfirm) {
  document.getElementById('confirmActionTitle').textContent = title;
  document.getElementById('confirmActionMsg').textContent = message;
  confirmCallback = onConfirm;
  document.getElementById('confirmActionBtn').onclick = executeConfirmAction;
  document.getElementById('confirmActionModal').classList.remove('hidden');
}

function closeConfirmAction() {
  document.getElementById('confirmActionModal').classList.add('hidden');
  confirmCallback = null;
}

async function executeConfirmAction() {
  if (confirmCallback) {
    await confirmCallback();
  }
  closeConfirmAction();
}

async function startWinnerReveal() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    const results = data.votesByCandidate
      .map(v => ({ name: v.voto_nombre, votes: parseInt(v.total) }))
      .sort((a, b) => a.votes - b.votes); // Sort ascending to show winner last

    if (results.length === 0) return alert('No hay votos registrados todavía.');

    document.getElementById('revealSteps').innerHTML = '';
    document.getElementById('revealFooter').style.display = 'none';
    document.getElementById('winnerRevealModal').classList.remove('hidden');

    for (let i = 0; i < results.length; i++) {
      const isWinner = i === results.length - 1;
      await new Promise(resolve => setTimeout(resolve, 2000)); // Suspense delay

      const step = document.createElement('div');
      step.className = `reveal-step ${isWinner ? 'winner' : ''}`;
      step.innerHTML = `
        <div class="reveal-step-name">${isWinner ? '🏆 ¡EL GANADOR ES!' : 'Siguiente resultado...'}</div>
        <div class="reveal-step-votes">${results[i].votes} VOTOS</div>
        <div class="reveal-step-name">${results[i].name}</div>
      `;
      document.getElementById('revealSteps').appendChild(step);
    }

    document.getElementById('revealFooter').style.display = 'block';
  } catch (e) {
    console.error(e);
    alert('Error al obtener los resultados.');
  }
}

function closeWinnerReveal() {
  document.getElementById('winnerRevealModal').classList.add('hidden');
}

function showLoginMsg(text, type) {
  const box = document.getElementById('loginMessage');
  box.querySelector('.message-text').textContent = text;
  box.querySelector('.message-icon').textContent = type === 'error' ? '⚠️' : '✅';
  box.className = `message-box ${type}`;
  box.style.display = 'flex';
}
