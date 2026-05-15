const API_BASE_URL = `${window.location.origin}/api`;

// Authentication Check
if (!localStorage.getItem('token')) {
  window.location.href = 'login.html';
}

function getAuthHeaders() {
  return {
    'Authorization': 'Bearer ' + localStorage.getItem('token'),
    'Content-Type': 'application/json'
  };
}

let currentRole = localStorage.getItem('role') || 'resident';
let globalRoomsData = [];

let residentsData = [];
let reclamationsData = [];
let annoncesData = [];
let notificationsData = [];
let activitiesData = [];

// Navigation handling
function aNav(viewId, el) {
  document.querySelectorAll('.main-area .view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  if (el) {
    document.querySelectorAll('.sidebar .nav-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
  }
  const titles = {
    'a-dash': 'Tableau de bord',
    'a-residents': 'Gestion des Résidents',
    'a-chambres': 'État des Chambres',
    'a-paiements': 'Suivi des Paiements',
    'a-reclamations': 'Réclamations Clients',
    'a-admins': 'Administrateurs',
    'a-stats': 'Statistiques & Rapports',
    'a-communaute': 'Modération Communauté',
    'a-activites': 'Activités & Événements',
    'a-securite': 'Sécurité & Accès'
  };
  document.getElementById('a-page-title').innerText = titles[viewId] || 'Panel Admin';
  if (viewId === 'a-reclamations') fetchReclamations();
  if (viewId === 'a-communaute') fetchAnnonces();
  if (viewId === 'a-activites') fetchActivities();
  if (viewId === 'a-securite') fetchAdmins();
}

function rNav(viewId, el) {
  document.querySelectorAll('.main-area .view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  if (el) {
    document.querySelectorAll('.sidebar .nav-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
  }
  const titles = {
    'r-dash': 'Mon tableau de bord',
    'r-chambre': 'Ma chambre & QR Code',
    'r-paiements': 'Mes paiements',
    'r-reclamations': 'Mes réclamations',
    'r-reservation': 'Renouvellement 2025',
    'r-activites': 'Activités & Événements',
    'r-communaute': 'Communauté',
    'r-securite': 'Sécurité'
  };
  document.getElementById('r-page-title').innerText = titles[viewId] || 'Espace Résident';
  if (viewId === 'r-reclamations') fetchReclamations();
  if (viewId === 'r-communaute') fetchAnnonces();
  if (viewId === 'r-activites') fetchActivities();
}

// Modal handling
function openModal(id) {
  document.getElementById('modal-' + id).classList.add('active');
}

function closeModal(id) {
  document.getElementById('modal-' + id).classList.remove('active');
}

function showSuccess(title, body) {
  document.getElementById('success-title').innerText = title;
  document.getElementById('success-body').innerText = body;
  openModal('success');
}

// Global Toast
function showToast(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fadeOut');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3000);
}

// Sidebar toggle
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('active');
}

// INITIALIZATION
async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE_URL}/user/profile`, { headers: getAuthHeaders() });
    if (!res.ok) {
      localStorage.clear();
      window.location.href = 'login.html';
      return;
    }
    const user = await res.json();
    currentRole = user.role;
    localStorage.setItem('role', user.role);

    if (currentRole === 'admin') {
      document.getElementById('admin-screen').classList.add('active');
      loadAdminDashboard();
    } else {
      document.getElementById('res-screen').classList.add('active');
      loadResidentDashboard(user);
    }
    fetchNotifications();
  } catch (e) {
    console.error("Auth check failed", e);
    window.location.href = 'login.html';
  }
}

function doLogout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

// ADMIN FUNCTIONS
async function loadAdminDashboard() {
  try {
    const res = await fetch(`${API_BASE_URL}/dashboard`, { headers: getAuthHeaders() });
    if (res.ok) {
      const stats = await res.json();
      document.getElementById('kpi-actifs').innerText = stats.activeResidents;
      document.getElementById('kpi-chambres').innerText = `${stats.occupiedRooms}/${stats.totalRooms}`;
      document.getElementById('kpi-revenus').innerText = stats.monthlyRevenue.toLocaleString() + ' DH';
      document.getElementById('kpi-retards').innerText = stats.latePayments;

      renderCharts(stats);
    }
    fetchResidents();
    fetchRooms();
  } catch (e) {
    console.error("Admin dash load failed", e);
  }
}

async function fetchResidents() {
  try {
    const res = await fetch(`${API_BASE_URL}/residents`, { headers: getAuthHeaders() });
    if (res.ok) {
      residentsData = await res.json();
      renderResidentsTable(residentsData);
      renderRecentResidents(residentsData);
    }
  } catch (e) {
    console.error("Residents load failed", e);
  }
}

function renderResidentsTable(data) {
  const tbody = document.querySelector('#a-residents tbody');
  if (!tbody) return;
  tbody.innerHTML = data.map(res => `
    <tr>
      <td>
        <div class="table-user">
          <div class="av">${res.initials}</div>
          <div>
            <div class="fw-bold">${res.name}</div>
            <div class="text-xs text-muted">${res.email}</div>
          </div>
        </div>
      </td>
      <td class="text-muted">${res.school}</td>
      <td>${res.room} ${res.roomType}</td>
      <td><span class="badge bg-success">Payée</span></td>
      <td><span class="badge ${res.status === 'Payé' ? 'bg-success' : 'bg-warm'}">${res.status}</span></td>
      <td class="${res.score > 80 ? 'score-high' : 'score-low'}">${res.score}</td>
      <td><span class="status-indicator"><span class="dot dot-${res.status === 'Payé' ? 'success' : 'warm'}"></span>${res.status === 'Payé' ? 'OK' : 'Retard'}</span></td>
      <td>
        <button class="btn-action" onclick="openEditResident('${res._id}', '${res.name}', '${res.status}')">Modifier</button>
      </td>
    </tr>
  `).join('');
}

function renderRecentResidents(data) {
  const tbody = document.getElementById('recent-residents-body');
  if (!tbody) return;
  const recent = data.slice(-5).reverse();
  tbody.innerHTML = recent.map(res => `
    <tr>
      <td>
        <div class="table-user">
          <div class="av">${res.initials}</div>
          <div class="fw-bold">${res.name}</div>
        </div>
      </td>
      <td class="text-muted">${res.school}</td>
      <td>${res.room}</td>
      <td><span class="badge ${res.status === 'Payé' ? 'bg-success' : 'bg-warm'}">${res.status}</span></td>
      <td class="score-high">${res.score}</td>
    </tr>
  `).join('');
}

async function addResident() {
  const data = {
    prenom: document.getElementById('add-res-prenom').value,
    nom: document.getElementById('add-res-nom').value,
    email: document.getElementById('add-res-email').value,
    ecole: document.getElementById('add-res-ecole').value,
    room: document.getElementById('add-res-room').value,
    type: document.getElementById('add-res-type').value,
    date: document.getElementById('add-res-date').value
  };

  try {
    const res = await fetch(`${API_BASE_URL}/residents`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (res.ok) {
      closeModal('resident');
      showSuccess("Résident Ajouté", `${data.prenom} a été enregistré avec succès.`);
      fetchResidents();
    }
  } catch (e) {
    showToast("Erreur lors de l'ajout");
  }
}

async function fetchRooms() {
  try {
    const res = await fetch(`${API_BASE_URL}/rooms`, { headers: getAuthHeaders() });
    if (res.ok) {
      globalRoomsData = await res.json();
      renderFloorTabs();
      renderRooms('Rez-de-chaussée');
    }
  } catch (e) {
    console.error("Rooms load failed", e);
  }
}

function renderFloorTabs() {
  const floors = [...new Set(globalRoomsData.map(r => r.floor))];
  const container = document.getElementById('floor-tabs');
  if (!container) return;
  container.innerHTML = floors.map(f => `
    <button class="btn-floor ${f === 'Rez-de-chaussée' ? 'active' : ''}" onclick="switchFloor(this, '${f}')">${f}</button>
  `).join('');
}

function switchFloor(btn, floor) {
  document.querySelectorAll('.btn-floor').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderRooms(floor);
}

function renderRooms(floor) {
  const container = document.getElementById('room-grid-a');
  if (!container) return;
  const filtered = globalRoomsData.filter(r => r.floor === floor);
  container.innerHTML = filtered.map(r => `
    <div class="room-card ${r.status === 'occ' ? 'occupied' : ''}" onclick="showRoomDetails('${r.id}')">
      <div class="room-id">${r.id}</div>
      <div class="room-info">${r.type === 'I' ? 'Indiv.' : 'Double'}</div>
      <div class="room-status">${r.status === 'occ' ? 'Occupée' : 'Libre'}</div>
    </div>
  `).join('');
}

function showRoomDetails(roomId) {
  const room = globalRoomsData.find(r => r.id === roomId);
  document.getElementById('rd-id').innerText = `Chambre ${roomId}`;
  document.getElementById('rd-type').innerText = room.type === 'I' ? 'Individuelle' : 'Double';
  document.getElementById('rd-status').innerText = room.status === 'occ' ? 'Occupée' : 'Disponible';
  const resList = document.getElementById('rd-residents');
  resList.innerHTML = room.residents.length > 0 ? room.residents.map(name => `<li>${name}</li>`).join('') : 'Aucun résident';
  
  const qrContainer = document.getElementById('rd-qr-container');
  qrContainer.innerHTML = '';
  new QRCode(qrContainer, { text: `ROOM:${roomId}`, width: 128, height: 128 });
  
  openModal('room-details');
}

// RESIDENT FUNCTIONS
async function loadResidentDashboard(user) {
  document.getElementById('res-dash-name').innerText = `Bonjour, ${user.name || user.email} !`;
  document.getElementById('res-dash-room-num').innerText = user.room || 'N/A';
  document.getElementById('res-dash-room-type').innerText = user.roomType || 'N/A';
  document.getElementById('res-dash-school').innerText = user.school || 'UIB Mohammedia';
  document.getElementById('res-sidebar-name').innerText = user.name || user.email;
  document.getElementById('res-sidebar-room').innerText = user.room ? `Chambre ${user.room}` : 'Non assigné';
  document.getElementById('res-sidebar-initials').innerText = user.initials || '??';

  // QR Code
  const qrBox = document.getElementById('res-qr-container');
  if (qrBox) {
    qrBox.innerHTML = '';
    new QRCode(qrBox, { text: `USER:${user.email}`, width: 160, height: 160 });
  }
}

// COMMON: Reclamations
async function fetchReclamations() {
  try {
    const res = await fetch(`${API_BASE_URL}/reclamations`, { headers: getAuthHeaders() });
    if (res.ok) {
      reclamationsData = await res.json();
      if (currentRole === 'admin') renderAdminReclamations();
      else renderResidentReclamations();
    }
  } catch (e) {
    console.error("Recs load failed", e);
  }
}

function renderResidentReclamations() {
  const container = document.getElementById('res-reclamations-list');
  if (!container) return;
  container.innerHTML = reclamationsData.map(r => `
    <div class="card glass-panel mb-16">
      <div style="display:flex; justify-content:space-between;">
        <div class="fw-bold">${r.type}</div>
        <span class="badge ${r.status === 'Ouvert' ? 'bg-warm' : 'bg-success'}">${r.status}</span>
      </div>
      <div class="text-sm text-muted mt-8">${r.description}</div>
      <div class="text-xs text-muted mt-8">${new Date(r.date).toLocaleDateString()}</div>
    </div>
  `).join('');
}

function renderAdminReclamations() {
  const container = document.getElementById('admin-reclamations-list');
  if (!container) return;
  container.innerHTML = reclamationsData.map(r => `
    <div class="card glass-panel mb-16">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div class="fw-bold">${r.resident_name} (${r.resident_email})</div>
          <div class="text-sm">Type: <span class="fw-bold">${r.type}</span></div>
        </div>
        <div style="display:flex; gap:8px;">
          <select onchange="updateRecStatus('${r._id}', this.value)" class="filter-select" style="padding:4px;">
            <option value="Ouvert" ${r.status === 'Ouvert' ? 'selected' : ''}>Ouvert</option>
            <option value="En cours" ${r.status === 'En cours' ? 'selected' : ''}>En cours</option>
            <option value="Résolu" ${r.status === 'Résolu' ? 'selected' : ''}>Résolu</option>
          </select>
        </div>
      </div>
      <div class="text-sm mt-8">${r.description}</div>
    </div>
  `).join('');
  
  // Update badge
  const openCount = reclamationsData.filter(r => r.status === 'Ouvert').length;
  const badge = document.getElementById('a-reclamations-badge');
  if(badge) {
    badge.innerText = openCount;
    badge.style.display = openCount > 0 ? 'inline-block' : 'none';
  }
}

async function submitReclamation() {
  const type = document.getElementById('reclamation-type').value;
  const desc = document.getElementById('reclamation-desc').value;
  if(!type) { showToast("Choisissez un type"); return; }

  try {
    const res = await fetch(`${API_BASE_URL}/reclamations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ type, description: desc })
    });
    if (res.ok) {
      closeModal('reclamation');
      showSuccess("Envoyé", "Votre réclamation sera traitée sous 24h.");
      fetchReclamations();
    }
  } catch (e) {
    showToast("Erreur d'envoi");
  }
}

async function updateRecStatus(id, status) {
  try {
    const res = await fetch(`${API_BASE_URL}/reclamations/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      showToast("Statut mis à jour");
      fetchReclamations();
    }
  } catch (e) {
    showToast("Erreur");
  }
}

// ANNONCES / COMMUNAUTÉ
async function fetchAnnonces() {
  try {
    const res = await fetch(`${API_BASE_URL}/annonces`, { headers: getAuthHeaders() });
    if (res.ok) {
      annoncesData = await res.json();
      renderAnnonces();
    }
  } catch (e) {
    console.error("Annonces load failed", e);
  }
}

function renderAnnonces() {
  const adminContainer = document.getElementById('admin-community-list');
  const resContainer = document.getElementById('res-community-list');
  const listHtml = annoncesData.map(a => `
    <div class="community-item">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div class="fw-bold">${a.author}</div>
        <div class="badge ${a.category === 'Vente' ? 'bg-success' : 'bg-primary'}">${a.category || 'Général'}</div>
      </div>
      <div class="text-sm mt-8">${a.content}</div>
      <div class="text-xs text-muted mt-8">${a.time}</div>
    </div>
  `).join('');
  if (adminContainer) adminContainer.innerHTML = listHtml;
  if (resContainer) resContainer.innerHTML = listHtml;
}

async function createAnnonce() {
  const content = document.getElementById('annonce-content').value;
  const category = document.getElementById('annonce-cat').value;
  try {
    const res = await fetch(`${API_BASE_URL}/annonces`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content, category })
    });
    if (res.ok) {
      closeModal('annonce');
      showToast("Annonce publiée");
      fetchAnnonces();
    }
  } catch (e) {
    showToast("Erreur");
  }
}

// NOTIFICATIONS
async function fetchNotifications() {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications`, { headers: getAuthHeaders() });
    if (res.ok) {
      notificationsData = await res.json();
      renderNotifications();
    }
  } catch (e) {
    console.error("Notifs load failed", e);
  }
}

function renderNotifications() {
  const adminList = document.getElementById('a-notif-list');
  const resList = document.getElementById('r-notif-list');
  const unreadCount = notificationsData.filter(n => !n.read).length;
  
  const dotA = document.getElementById('a-notif-dot');
  const dotR = document.getElementById('r-notif-dot');
  if(dotA) dotA.style.display = unreadCount > 0 ? 'block' : 'none';
  if(dotR) dotR.style.display = unreadCount > 0 ? 'block' : 'none';

  const html = notificationsData.length > 0 ? notificationsData.map(n => `
    <div class="notif-item ${n.read ? 'read' : ''}" style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
      <div class="text-sm">${n.message}</div>
      <div class="text-xs text-muted">${new Date(n.date).toLocaleTimeString()}</div>
    </div>
  `).join('') : '<div class="text-xs text-muted">Aucune notification</div>';

  if (adminList) adminList.innerHTML = html;
  if (resList) resList.innerHTML = html;
}

function toggleNotifDropdown(type) {
  const id = type === 'admin' ? 'a-notif-dropdown' : 'r-notif-dropdown';
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function deleteAllNotifications() {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/delete-all`, { method: 'DELETE', headers: getAuthHeaders() });
    if (res.ok) {
      fetchNotifications();
    }
  } catch (e) {
    showToast("Erreur");
  }
}

// CHARTING
function renderCharts(stats) {
  const revCtx = document.getElementById('revChart');
  if (revCtx) {
    new Chart(revCtx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
        datasets: [{
          label: 'DH',
          data: [45000, 48000, 51000, 52000, stats.monthlyRevenue],
          borderColor: '#00d2ff',
          tension: 0.4,
          fill: true,
          backgroundColor: 'rgba(0, 210, 255, 0.1)'
        }]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false } } } }
    });
  }

  const occCtx = document.getElementById('occChart');
  if (occCtx) {
    new Chart(occCtx, {
      type: 'doughnut',
      data: {
        labels: ['Occupé', 'Libre'],
        datasets: [{
          data: [stats.occupiedRooms, stats.totalRooms - stats.occupiedRooms],
          backgroundColor: ['#3a7bd5', 'rgba(255,255,255,0.1)'],
          borderWidth: 0
        }]
      },
      options: { cutout: '80%', plugins: { legend: { display: false } } }
    });
  }
}

// Category selection
function selectCategory(btn, cat) {
  document.querySelectorAll('.btn-category').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('reclamation-type').value = cat;
}

// Filter
function filterGlobal(val) {
  const lower = val.toLowerCase();
  const rows = document.querySelectorAll('tbody tr');
  rows.forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(lower) ? '' : 'none';
  });
}

// Excel Export
function exportExcel() {
  const ws = XLSX.utils.json_to_sheet(residentsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Résidents");
  XLSX.writeFile(wb, "Residents_SupTech.xlsx");
}

// PDF Export
function exportPDF(type) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("SupTech Internat - État des Paiements", 14, 20);
  doc.save("Factures.pdf");
}

async function addAdmin() {
  const name = document.getElementById('new-admin-name').value;
  const email = document.getElementById('new-admin-email').value;
  try {
    const res = await fetch(`${API_BASE_URL}/admins`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, email })
    });
    if(res.ok) {
      closeModal('admin');
      showSuccess("Admin Ajouté", `${name} a maintenant accès au panel.`);
      fetchAdmins();
    }
  } catch (e) {
    showToast("Erreur");
  }
}

async function changePassword() {
  const pwdInput = currentRole === 'admin' ? 'admin-new-pwd' : 'res-new-pwd';
  const newPassword = document.getElementById(pwdInput).value;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ new_password: newPassword })
    });
    if(res.ok) {
      showSuccess("Mot de passe mis à jour", "Utilisez votre nouveau mot de passe à la prochaine connexion.");
    }
  } catch (e) {
    showToast("Erreur");
  }
}

async function fetchActivities() {
  try {
    const res = await fetch(`${API_BASE_URL}/activities`, { headers: getAuthHeaders() });
    if(res.ok) {
      activitiesData = await res.json();
      renderActivities();
    }
  } catch (e) {
    console.error("Activities load failed", e);
  }
}

function renderActivities() {
  const adminContainer = document.getElementById('admin-activities-list');
  const resContainer = document.getElementById('res-activities-grid');
  
  const listHtml = activitiesData.map(a => `
    <div class="community-item">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div class="fw-bold">${a.title}</div>
        <span class="badge ${a.status === 'Publié' ? 'bg-success' : 'bg-warm'}">${a.status}</span>
      </div>
      <div class="text-sm mt-4">${a.date} - ${a.location}</div>
      ${currentRole === 'admin' && a.status === 'En attente' ? `
        <div class="mt-8">
          <button class="btn-primary btn-gradient" style="padding:4px 8px; font-size:11px;" onclick="approveActivity('${a._id}')">Approuver</button>
        </div>
      ` : ''}
    </div>
  `).join('');
  
  if(adminContainer) adminContainer.innerHTML = listHtml;
  if(resContainer) resContainer.innerHTML = activitiesData.filter(a => a.status === 'Publié').map(a => `
    <div class="stat-card glass-panel">
      <div class="fw-bold">${a.title}</div>
      <div class="text-sm text-muted">${a.date}</div>
      <div class="text-xs mt-4">${a.location}</div>
    </div>
  `).join('');
}

async function submitActivity() {
  const title = document.getElementById('act-title').value;
  const date = document.getElementById('act-date').value;
  const location = document.getElementById('act-desc').value;
  try {
    const res = await fetch(`${API_BASE_URL}/activities`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, date, location })
    });
    if(res.ok) {
      closeModal('suggest-activity');
      showSuccess("Suggéré", "Votre activité a été soumise à la modération.");
      fetchActivities();
    }
  } catch (e) {
    showToast("Erreur");
  }
}

async function approveActivity(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/activities/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: 'Publié' })
    });
    if(res.ok) {
      showToast("Activité publiée");
      fetchActivities();
    }
  } catch (e) {
    showToast("Erreur");
  }
}

async function fetchAdmins() {
  const listEl = document.getElementById('admin-users-list');
  if(!listEl) return;
  
  try {
    const res = await fetch(`${API_BASE_URL}/admins`, { headers: getAuthHeaders() });
    if(res.ok) {
      const admins = await res.json();
      listEl.innerHTML = '';
      admins.forEach(admin => {
        listEl.innerHTML += `
          <div style="padding: 8px; z-index: 10000; position: relative;">
            <div>
              <div class="fw-bold">${admin.name || 'Admin'}</div>
              <div class="text-xs text-muted">${admin.email}</div>
            </div>
            <span class="badge bg-success">Admin</span>
          </div>
        `;
      });
    }
  } catch (e) {
    console.error("Error fetching admins", e);
  }
}
