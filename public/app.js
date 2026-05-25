// ===== APP STATE =====
let selectedCandidate = null;
let candidates = [];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  document.getElementById('cedulaInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') verifyCedula();
  });
  initTilt();
});

function initTilt() {
  let cards = [];
  const updateCards = () => {
    cards = Array.from(document.querySelectorAll('.card, .candidate-card, .stat-card, .chart-card, .table-card, .setting-card, .candidate-manage-card'));
  };
  
  const observer = new MutationObserver(updateCards);
  observer.observe(document.body, { childList: true, subtree: true });
  updateCards();

  let ticking = false;
  document.addEventListener('mousemove', e => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        cards.forEach(card => {
          if (!card.offsetParent) return;
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          if (x > 0 && x < rect.width && y > 0 && y < rect.height) {
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 25;
            const rotateY = (centerX - x) / 25;
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
          } else if (card.style.transform !== '') {
            card.style.transform = '';
          }
        });
        ticking = false;
      });
      ticking = true;
    }
  });
}

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

  candidates.forEach((c, index) => {
    const card = document.createElement('div');
    card.className = 'candidate-card';
    card.style.animationDelay = `${index * 0.1}s`; // Staggered entry
    card.onclick = () => selectCandidate(c);
    const avatarContent = c.imagen_url
      ? `<img src="${c.imagen_url}" alt="${c.nombre}" style="width:100%;height:100%;object-fit:cover;border-radius:22px">`
      : c.iniciales;
    card.innerHTML = `
      <div class="candidate-avatar" style="background:${c.color}">${avatarContent}</div>
      <div class="candidate-party" style="font-size:0.9rem; margin-bottom:-5px;">${c.partido} (${c.iniciales})</div>
      <div class="candidate-name" style="font-size:1.3rem;">${c.nombre}</div>
    `;
    grid.appendChild(card);
  });

  const nullCard = document.createElement('div');
  nullCard.className = 'candidate-card null-vote';
  nullCard.onclick = () => selectCandidate({ id: 0, nombre: 'Voto Nulo', partido: 'Sin candidato', color: '#64748b', iniciales: 'VN', imagen_url: '/nulo.png' });
  nullCard.innerHTML = `
    <div class="candidate-avatar" style="background:linear-gradient(135deg,#64748b,#475569)">
      <img src="/nulo.png" alt="Voto Nulo" style="width:100%;height:100%;object-fit:cover;border-radius:22px">
    </div>
    <div class="candidate-party" style="font-size:0.9rem; margin-bottom:-5px;">VOTO NULO (VN)</div>
    <div class="candidate-name" style="font-size:1.3rem;">Voto Nulo</div>
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
