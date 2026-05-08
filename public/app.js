// ===== APP STATE =====
let selectedCandidate = null;
let candidates = [];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  document.getElementById('cedulaInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') verifyCedula();
  });
});

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    if (config.titulo_sistema) {
      document.getElementById('systemTitle').textContent = config.titulo_sistema;
      document.getElementById('navTitle').textContent = config.titulo_sistema;
    }
    if (config.subtitulo) document.getElementById('systemSubtitle').textContent = config.subtitulo;
    if (config.logo_url) {
      document.getElementById('institutionLogo').src = config.logo_url;
      document.querySelector('.nav-logo').src = config.logo_url;
    }
    if (config.votacion_activa === 'false') {
      document.getElementById('inactiveOverlay').classList.remove('hidden');
    }
  } catch (e) { console.error('Config load error:', e); }
}

// ===== CEDULA VERIFICATION =====
async function verifyCedula() {
  const cedula = document.getElementById('cedulaInput').value.trim();
  if (!cedula) { showMessage('Por favor, ingrese su número de cédula.', 'error'); return; }

  const btn = document.getElementById('btnVerify');
  btn.classList.add('loading');

  try {
    const res = await fetch('/api/verify-cedula', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula })
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('voterName').textContent = data.nombre;
      document.getElementById('voterSection').textContent = `Sección ${data.seccion}`;
      await loadCandidates();
      showStep('stepVoting');
    } else {
      showMessage(data.message, 'error');
    }
  } catch (e) {
    showMessage('Error de conexión. Intente nuevamente.', 'error');
  } finally {
    btn.classList.remove('loading');
  }
}

// ===== CANDIDATES =====
async function loadCandidates() {
  try {
    const res = await fetch('/api/candidates');
    candidates = await res.json();
    renderCandidates();
  } catch (e) { console.error('Error loading candidates:', e); }
}

function renderCandidates() {
  const grid = document.getElementById('candidatesGrid');
  grid.innerHTML = '';

  candidates.forEach(c => {
    const card = document.createElement('div');
    card.className = 'candidate-card';
    card.onclick = () => selectCandidate(c);
    const avatarContent = c.imagen_url
      ? `<img src="${c.imagen_url}" alt="${c.nombre}" style="width:100%;height:100%;object-fit:cover;border-radius:18px">`
      : c.iniciales;
    card.innerHTML = `
      <div class="candidate-avatar" style="background:${c.color}">${avatarContent}</div>
      <div class="candidate-name">${c.nombre}</div>
      <div class="candidate-party">${c.partido}</div>
    `;
    grid.appendChild(card);
  });

  // Add null vote option
  const nullCard = document.createElement('div');
  nullCard.className = 'candidate-card null-vote';
  nullCard.onclick = () => selectCandidate({ id: 0, nombre: 'Voto Nulo', partido: 'Sin candidato', color: '#64748b', iniciales: 'VN' });
  nullCard.innerHTML = `
    <div class="candidate-avatar" style="background:linear-gradient(135deg,#64748b,#475569)">VN</div>
    <div class="candidate-name">Voto Nulo</div>
    <div class="candidate-party">Sin candidato</div>
  `;
  grid.appendChild(nullCard);
}

// ===== VOTING FLOW =====
function selectCandidate(candidate) {
  selectedCandidate = candidate;
  const avatar = document.getElementById('modalAvatar');
  avatar.style.background = candidate.color;
  if (candidate.imagen_url) {
    avatar.innerHTML = `<img src="${candidate.imagen_url}" alt="${candidate.nombre}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">`;
  } else {
    avatar.innerHTML = '';
    avatar.textContent = candidate.iniciales;
  }
  document.getElementById('modalName').textContent = candidate.nombre;
  document.getElementById('modalParty').textContent = candidate.partido;
  document.getElementById('confirmModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('confirmModal').classList.add('hidden');
  selectedCandidate = null;
}

async function confirmVote() {
  if (!selectedCandidate) return;
  const btn = document.getElementById('btnConfirmVote');
  btn.classList.add('loading');

  try {
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidatoId: selectedCandidate.id,
        votoNombre: selectedCandidate.nombre
      })
    });
    const data = await res.json();

    if (data.success) {
      closeModal();
      showStep('stepSuccess');
    } else {
      closeModal();
      showMessage(data.message, 'error');
      showStep('stepCedula');
    }
  } catch (e) {
    showMessage('Error de conexión. Intente nuevamente.', 'error');
  } finally {
    btn.classList.remove('loading');
  }
}

// ===== NAVIGATION =====
function showStep(stepId) {
  ['stepCedula', 'stepVoting', 'stepSuccess'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(stepId).classList.remove('hidden');
}

function goBack() {
  showStep('stepCedula');
  document.getElementById('cedulaInput').value = '';
  hideMessage();
}

function resetVoting() {
  showStep('stepCedula');
  document.getElementById('cedulaInput').value = '';
  hideMessage();
  selectedCandidate = null;
}

// ===== MESSAGES =====
function showMessage(text, type = 'info') {
  const box = document.getElementById('messageBox');
  const icons = { error: '⚠️', success: '✅', info: 'ℹ️' };
  document.getElementById('messageIcon').textContent = icons[type] || '';
  document.getElementById('messageText').textContent = text;
  box.className = `message-box ${type}`;
  box.style.display = 'flex';
}

function hideMessage() {
  document.getElementById('messageBox').style.display = 'none';
}
