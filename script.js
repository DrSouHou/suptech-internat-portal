const API_BASE_URL = window.location.origin + '/suptech-internat-portal-backend/api';

function checkAuth() {
  const token = localStorage.getItem('token');
  // If token is missing or is the string "undefined", send back to login
  if (!token || token === 'undefined' || token === 'null') {
    window.location.href = 'login.html';
  }
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
let paymentsData = [];
let activitesData = [];
// Global mock action handler for interactive buttons
function mockAction(message) {
  showToast(message);
}

// Toast notification system
function showToast(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg> ${message}`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fadeOut');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}

// Logout action
function doLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  window.location.href = 'login.html';
}

// Navigation Admin
function aNav(view, el) {
  document.querySelectorAll('#admin-screen .view').forEach(v => v.classList.remove('active'));
  document.getElementById(view).classList.add('active');

  if (el) {
    document.querySelectorAll('#admin-screen .nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
  }

  // Close sidebar on mobile if open
  const sidebar = document.querySelector('#admin-screen .sidebar');
  if (sidebar && sidebar.classList.contains('open')) toggleSidebar();

  const titles = {
    'a-dash': 'Tableau de bord',
    'a-residents': 'Gestion des résidents',
    'a-chambres': 'Gestion des chambres',
    'a-paiements': 'Paiements',
    'a-reclamations': 'Réclamations',
    'a-admins': 'Administrateurs',
    'a-stats': 'Statistiques',
    'a-communaute': 'Communauté (Modération)',
    'a-activites': 'Gestion des Activités'
  };
  document.getElementById('a-page-title').textContent = titles[view] || '';

  if (view === 'a-dash') { renderAdminDashboard(); }
  if (view === 'a-residents') renderAdminResidents();
  if (view === 'a-reclamations') renderAdminReclamations();
  if (view === 'a-chambres') buildRoomGrid();
  if (view === 'a-stats') buildStatsCharts();
  if (view === 'a-communaute') renderCommunityPosts(true);
  if (view === 'a-activites') renderActivities();
}

// Navigation Resident
function rNav(view, el) {
  document.querySelectorAll('#res-screen .view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(view);
  if (target) target.classList.add('active');

  if (el) {
    document.querySelectorAll('#res-screen .nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
  }

  // Close sidebar on mobile if open
  const sidebar = document.querySelector('#res-screen .sidebar');
  if (sidebar && sidebar.classList.contains('open')) toggleSidebar();

  const titles = {
    'r-dash': 'Mon tableau de bord',
    'r-chambre': 'Ma chambre & QR Code',
    'r-paiements': 'Mes paiements & factures',
    'r-reclamations': 'Mes réclamations',
    'r-reservation': 'Réservation 2025-2026',
    'r-activites': 'Activités',
    'r-communaute': 'Communauté',
    'r-securite': 'Sécurité'
  };
  document.getElementById('r-page-title').textContent = titles[view] || '';

  if (view === 'r-dash') { updateNotificationsBadge(); }
  if (view === 'r-reclamations') renderResidentReclamations();
  if (view === 'r-communaute') renderCommunityPosts(false);
  if (view === 'r-activites') renderActivities();
}

// Modal handling
let _suppressOutsideClose = false;

function openModal(id) {
  const targetId = 'modal-' + id;
  console.log('Opening modal:', targetId);

  // Close all other overlays first (Highlander)
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.style.display = 'none';
    m.classList.remove('open');
  });

  const m = document.getElementById(targetId);
  if (m) {
    _suppressOutsideClose = true;
    m.style.setProperty('display', 'flex', 'important');
    m.style.setProperty('visibility', 'visible', 'important');
    m.style.setProperty('opacity', '1', 'important');
    m.classList.add('open');

    // Nuclear Option: Force body state
    document.body.style.overflow = 'hidden';

    // Force a repaint
    m.offsetHeight;

    console.log('MODAL OPENED:', targetId, 'Display:', m.style.display);

    // Reset the flag after the event has finished bubbling
    setTimeout(() => { _suppressOutsideClose = false; }, 100);
  } else {
    console.error('MODAL NOT FOUND:', targetId);
  }
}

function closeModal(id) {
  const targetId = 'modal-' + id;
  console.log('Closing modal:', targetId);
  const el = document.getElementById(targetId);
  if (el) {
    el.style.display = 'none';
    el.classList.remove('open');
    document.body.style.overflow = 'auto';
  }
}

// Actions on Modals
async function addResident() {
  const prenom = document.getElementById('add-res-prenom').value || 'Resident';
  const nom = document.getElementById('add-res-nom').value || '';
  const fullName = `${prenom} ${nom}`.trim();
  const email = document.getElementById('add-res-email').value || '';
  const phone = document.getElementById('add-res-phone').value || '';
  const school = document.getElementById('add-res-ecole').value || 'Suptech Info';
  const type = document.getElementById('add-res-type').value;
  const room = document.getElementById('add-res-room').value;
  const date = document.getElementById('add-res-date').value;

  if (!room || !type) {
    showToast("Veuillez sélectionner le type et la chambre.");
    return;
  }

  const payload = {
    initials: (prenom.charAt(0) + (nom.charAt(0) || prenom.charAt(1) || '')).toUpperCase(),
    name: fullName,
    email: email,
    phone: phone,
    school: school,
    room: room,
    roomType: type,
    dateEntree: date,
    status: 'Attente',
    score: 80,
    bg: ''
  };

  try {
    const res = await fetch(`${API_BASE_URL}/residents`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      closeModal('resident');
      showSuccess('Résident ajouté !', 'Le compte résident FRDISI a été créé avec le mot de passe Suptech2026!');
      if (document.getElementById('a-dash').classList.contains('active')) renderAdminDashboard();
      if (document.getElementById('a-residents').classList.contains('active')) renderAdminResidents();
    } else {
      showToast('Erreur serveur ou email existant.');
    }
  } catch (e) {
    showToast('Erreur de connexion.');
  }
}

async function editResident(id) {
  showToast('Chargement des données du résident...');
  try {
    const res = await fetch(`${API_BASE_URL}/residents`, { headers: getAuthHeaders() });
    const residents = await res.json();
    const resident = residents.find(r => r._id === id);
    if (resident) {
      document.getElementById('edit-res-id').value = resident._id;
      document.getElementById('edit-res-name').value = resident.name;
      document.getElementById('edit-res-status').value = resident.status || 'En attente';
      openModal('edit-resident');
    }
  } catch (e) {
    showToast("Erreur lors de la récupération du résident");
  }
}

async function updateResident() {
  const id = document.getElementById('edit-res-id').value;
  const payload = {
    name: document.getElementById('edit-res-name').value,
    status: document.getElementById('edit-res-status').value
  };

  try {
    const res = await fetch(`${API_BASE_URL}/residents/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeModal('edit-resident');
      showToast("Résident mis à jour.");
      if (document.getElementById('a-dash').classList.contains('active')) renderAdminDashboard();
      if (document.getElementById('a-residents').classList.contains('active')) renderAdminResidents();
    } else {
      showToast("Erreur lors de la mise à jour");
    }
  } catch (e) {
    showToast("Erreur de connexion");
  }
}

async function addAdmin() {
  const email = document.getElementById('new-admin-email').value || '';
  const prenom = document.getElementById('new-admin-prenom').value || '';
  const nom = document.getElementById('new-admin-nom').value || '';
  const name = `${prenom} ${nom}`.trim();
  try {
    const res = await fetch(`${API_BASE_URL}/admin/register`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email: email, name: name })
    });
    if (res.ok) {
      const data = await res.json();
      closeModal('admin');
      showSuccess('Admin ajouté !', 'Le mot de passe généré est : <strong>' + data.password + '</strong>');
      fetchAdmins();
    } else {
      showToast('Erreur serveur ou email existant.');
    }
  } catch (e) {
    showToast('Erreur de connexion.');
  }
}

async function showResidentInfo(id) {
  try {
    const resident = residentsData.find(r => String(r._id) === String(id));
    if (!resident) {
      console.warn("No resident found for this id:", id);
      return;
    }
    document.getElementById('ri-name').textContent = resident.name || '...';
    document.getElementById('ri-email').textContent = resident.email || '...';
    document.getElementById('ri-phone').textContent = resident.phone || 'Non renseigné';
    document.getElementById('ri-school').textContent = resident.school || '...';
    document.getElementById('ri-date').textContent = resident.dateEntree ? new Date(resident.dateEntree).toLocaleDateString('fr-FR') : '...';
    document.getElementById('ri-room').textContent = resident.room || 'Non assignée';
    openModal('resident-info');
  } catch (error) {
    console.error("Error populating resident modal:", error);
  }
}

async function showRoomInfo(roomData) {
  try {
    console.log('Showing room info for room:', roomData.id);

    // Attempt to find the resident in global data
    let resident = residentsData.find(r => String(r.room) === String(roomData.id));

    if (resident) {
      document.getElementById('roi-name').textContent = resident.name || '...';
      document.getElementById('roi-email').textContent = resident.email || '...';
      document.getElementById('roi-phone').textContent = resident.phone || 'Non renseigné';
      document.getElementById('roi-school').textContent = resident.school || '...';
      document.getElementById('roi-date').textContent = resident.dateEntree ? new Date(resident.dateEntree).toLocaleDateString('fr-FR') : '...';
    } else {
      console.warn("No resident found for this room in global data, using roomData info");
      document.getElementById('roi-name').textContent = (roomData.residents && roomData.residents.length > 0) ? roomData.residents.join(', ') : 'Occupant inconnu';
      document.getElementById('roi-email').textContent = '—';
      document.getElementById('roi-phone').textContent = '—';
      document.getElementById('roi-school').textContent = '—';
      document.getElementById('roi-date').textContent = '—';
    }
    openModal('room-info');
  } catch (e) {
    console.error('Error in showRoomInfo:', e);
  }
}

async function changePassword() {
  const adminInput = document.getElementById('admin-new-pwd');
  const resInput = document.getElementById('res-new-pwd');

  let newPwd = '';
  let inputEl = null;

  if (currentRole === 'admin' && adminInput && adminInput.value) {
    newPwd = adminInput.value;
    inputEl = adminInput;
  } else if (resInput && resInput.value) {
    newPwd = resInput.value;
    inputEl = resInput;
  }

  if (!newPwd) return;

  try {
    const res = await fetch(`${API_BASE_URL}/user/password`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ new_password: newPwd })
    });
    if (res.ok) {
      showToast("Mot de passe mis à jour !");
      if (inputEl) inputEl.value = '';
    } else {
      showToast("Erreur lors de la mise à jour");
    }
  } catch (e) {
    showToast("Erreur de connexion");
  }
}

async function submitReclamation() {
  const cat = document.getElementById('reclamation-type').value || 'Autre';
  const desc = document.querySelector('#modal-reclamation textarea').value || '';
  if (!desc) { showToast('Description requise'); return; }

  const payload = {
    type: cat,
    description: desc,
    title: cat + " - " + (desc.length > 20 ? desc.substring(0, 20) + "..." : desc)
  };

  try {
    const res = await fetch(`${API_BASE_URL}/reclamations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeModal('reclamation');
      showSuccess('Réclamation envoyée', 'Votre demande a été transmise au service technique de Suptech Info.');
      renderResidentReclamations();
    }
  } catch (e) {
    showToast('Erreur lors de la soumission.');
  }
}

function showSuccess(title, body) {
  document.getElementById('success-title').textContent = title;
  document.getElementById('success-body').textContent = body;
  openModal('success');
}

// Dashboard Dynamic Rendering
async function renderAdminDashboard() {
  try {
    const res = await fetch(`${API_BASE_URL}/dashboard`, { headers: getAuthHeaders() });
    const data = await res.json();

    const resResidents = await fetch(`${API_BASE_URL}/residents`, { headers: getAuthHeaders() });
    if (resResidents.ok) {
      residentsData = await resResidents.json();
      const kpiActifs = document.getElementById('kpi-actifs');
      if (kpiActifs) kpiActifs.textContent = residentsData.length;

      const sidebarResCount = document.querySelector(`.nav-item[onclick="aNav('a-residents',this)"] .nb`);
      if (sidebarResCount) sidebarResCount.textContent = residentsData.length;
    }

    const kpiChambres = document.getElementById('kpi-chambres');
    if (kpiChambres && data.stats) kpiChambres.textContent = (data.stats.occupiedRooms || 0) + '/' + (data.stats.totalRooms || 0);

    // Sync reclamations badge immediately
    const resRecs = await fetch(`${API_BASE_URL}/reclamations`, { headers: getAuthHeaders() });
    if (resRecs.ok) {
      const recs = await resRecs.json();
      const badge = document.getElementById('a-reclamations-badge');
      if (badge) {
        const pendingCount = recs.filter(r => r.status === 'Ouvert' || r.status === 'En attente').length;
        badge.textContent = pendingCount;
        badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
      }
    }

    const kpiRevenus = document.getElementById('kpi-revenus');
    if (kpiRevenus && data.stats) kpiRevenus.textContent = (data.stats.monthlyRevenue || 0).toLocaleString('fr-FR');

    const kpiRetards = document.getElementById('kpi-retards');
    if (kpiRetards && data.stats) kpiRetards.textContent = data.stats.latePayments || 0;

    // Update Recent Residents Table
    const tbody = document.getElementById('recent-residents-body');
    if (tbody && data.recentResidents) {
      tbody.innerHTML = '';
      data.recentResidents.forEach(res => {
        let statusBadge = res.status === 'Payé' ? '<span class="badge bg-success">Payé</span>' :
          res.status === 'Retard' ? '<span class="badge bg-danger">Retard</span>' :
            '<span class="badge bg-warning">Attente</span>';

        let scoreClass = res.score >= 80 ? 'score-high' : res.score >= 60 ? 'score-medium' : 'score-low';

        tbody.innerHTML += `
          <tr>
            <td>
              <div class="table-user">
                <div class="av" style="background:${res.bg || ''}">${res.initials || 'XX'}</div><span>${res.name}</span>
              </div>
            </td>
            <td class="text-muted">${res.school}</td>
            <td>${res.room} — ${res.roomType}</td>
            <td>${statusBadge}</td>
            <td class="${scoreClass}">${res.score}</td>
          </tr>
        `;
      });
    }

    buildMainCharts(data.stats);
    updateNotificationsBadge();
  } catch (e) {
    console.error("Dashboard error:", e);
    showToast("Erreur de chargement du dashboard");
  }
}


async function renderAdminResidents() {
  try {
    const res = await fetch(`${API_BASE_URL}/residents`, { headers: getAuthHeaders() });
    residentsData = await res.json();

    const sidebarCount = document.querySelector(`.nav-item[onclick="aNav('a-residents',this)"] .nb`);
    if (sidebarCount) sidebarCount.textContent = residentsData.length;

    const kpiActifs = document.getElementById('kpi-actifs');
    if (kpiActifs) kpiActifs.textContent = residentsData.length;

    filterResidents();
  } catch (e) {
    showToast("Erreur lors du chargement des résidents");
  }
}

function filterResidents() {
  const schoolFilter = document.getElementById('filter-school')?.value || '';
  const statusFilter = document.getElementById('filter-status')?.value || '';

  const tableContainer = document.querySelector('#a-residents table tbody');
  if (!tableContainer) return;
  tableContainer.innerHTML = '';

  const filtered = residentsData.filter(r => {
    let matchSchool = !schoolFilter || r.school === schoolFilter;
    let matchStatus = !statusFilter || r.status === statusFilter;
    if (statusFilter === 'Attente') {
      matchStatus = (r.status === 'Attente' || r.status === 'En attente');
    }
    return matchSchool && matchStatus;
  });

  filtered.forEach(r => {
    let statusBadge = r.status === 'Payé' ? '<span class="badge bg-success">Payé</span>' :
      r.status === 'Retard' ? '<span class="badge bg-danger">Retard</span>' :
        '<span class="badge bg-warning">Attente</span>';

    let scoreClass = (r.score >= 80) ? 'score-high' : (r.score >= 60) ? 'score-medium' : 'score-low';
    let dotClass = r.status === 'Payé' ? 'dot-success' : r.status === 'Retard' ? 'dot-danger' : 'dot-warning';
    let dotText = r.status === 'Payé' ? 'OK' : r.status === 'Retard' ? 'Err' : 'Att';

    tableContainer.innerHTML += `
      <tr class="res-row" data-res-id="${r._id}" style="cursor: pointer;">
        <td>
          <div class="table-user">
            <div class="av" style="background:${r.bg || ''}">${r.initials || 'XX'}</div>
            <div>
              <div class="fw-bold">${r.name}</div>
              <div class="text-xs text-muted">${r._id.substring(0, 10)}</div>
            </div>
          </div>
        </td>
        <td class="text-muted">${r.school}</td>
        <td>${r.room} ${r.roomType}</td>
        <td><span class="badge bg-success">Payée</span></td>
        <td>${statusBadge}</td>
        <td class="${scoreClass}">${r.score}</td>
        <td><span class="status-indicator"><span class="dot ${dotClass}"></span>${dotText}</span></td>
        <td><button class="btn-action" onclick="event.stopPropagation(); editResident('${r._id}')">Modifier</button></td>
      </tr>
    `;
  });
}

async function renderResidentViews() {
  try {
    const res = await fetch(`${API_BASE_URL}/user/profile`, { headers: getAuthHeaders() });
    if (res.ok) {
      const profile = await res.json();
      document.getElementById('res-sidebar-name').textContent = profile.name || 'Nom Inconnu';
      document.getElementById('res-sidebar-initials').textContent = profile.initials || 'XX';
      document.getElementById('res-sidebar-room').textContent = `Chambre ${profile.room || '...'}`;

      const dashName = document.getElementById('res-dash-name');
      if (dashName) dashName.textContent = `Bonjour, ${profile.name.split(' ')[0]} !`;

      const dashRoom = document.getElementById('res-dash-room-num');
      if (dashRoom) dashRoom.textContent = profile.room || '...';

      const dashRoomType = document.getElementById('res-dash-room-type');
      if (dashRoomType) dashRoomType.textContent = profile.roomType || '...';

      const dashSchool = document.getElementById('res-dash-school');
      if (dashSchool) dashSchool.textContent = profile.school || '...';

      // Generate Digital Access Card QR
      const resQrContainer = document.getElementById('res-qr-container');
      const qrData = `ID: ${profile._id}\nNom: ${profile.name}\nChambre: ${profile.room}`;

      if (resQrContainer) {
        resQrContainer.innerHTML = '';
        new QRCode(resQrContainer, {
          text: qrData,
          width: 150,
          height: 150,
          colorDark: "#0f172a",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.L
        });
      }

      // Also update QR Code in Chambre section
      const chambreQrBox = document.getElementById('res-chambre-qr-box');
      if (chambreQrBox) {
        chambreQrBox.innerHTML = '';
        new QRCode(chambreQrBox, {
          text: qrData,
          width: 200,
          height: 200,
          colorDark: "#0f172a",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.L
        });
        const chambreQrId = document.getElementById('res-chambre-qr-id');
        if (chambreQrId) chambreQrId.textContent = profile._id;
      }
    }
  } catch (e) {
    console.error("Error fetching resident profile", e);
  }

  // Render Financials
  const tbody = document.getElementById('res-financials-body');
  if (tbody) {
    tbody.innerHTML = '';
    paymentsData.forEach(fin => {
      tbody.innerHTML += `
        <tr>
          <td>${fin.month}</td>
          <td>${fin.amount}</td>
          <td><span class="badge bg-success">${fin.status}</span></td>
          <td><button class="btn-action" onclick="mockAction('Téléchargement de ${fin.type}')">${fin.type}</button></td>
        </tr>
      `;
    });
  }

  // Render Activities
  const actGrid = document.getElementById('res-activities-grid');
  if (actGrid) {
    actGrid.innerHTML = '';
    activitesData.forEach(act => {
      actGrid.innerHTML += `
        <div class="card glass-panel">
          <div class="fw-bold">${act.title}</div>
          <div class="text-muted text-xs mt-8">${act.date} — ${act.desc}</div>
          <button class="btn-outline mt-16" style="width:100%" onclick="mockAction('Inscrit à ${act.title}')">Participer</button>
        </div>
      `;
    });
  }

  updateNotificationsBadge();
}

// Room Grid generation
async function buildRoomGrid() {
  try {
    const res = await fetch(`${API_BASE_URL}/rooms`, { headers: getAuthHeaders() });
    const rawData = await res.json();
    console.log("RAW ROOM DATA:", rawData);

    // 1. Création des groupes d'étages à partir de la liste plate
    const groupedFloors = {};
    const roomsArray = rawData.rooms || rawData;

    roomsArray.forEach(room => {
      const floorName = room.floor || "Étage Inconnu";
      if (!groupedFloors[floorName]) {
        groupedFloors[floorName] = { name: floorName, rooms: [] };
      }
      groupedFloors[floorName].rooms.push(room);
    });

    globalRoomsData = Object.values(groupedFloors);

    const tabsContainer = document.getElementById('floor-tabs');
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '';

    let totalIndiv = 0, occIndiv = 0;
    let totalDouble = 0, occDouble = 0;

    // 2. Calcul des totaux
    globalRoomsData.forEach((floor, index) => {
      if (floor.rooms) {
        floor.rooms.forEach(r => {
          if (r.type === 'I' || r.type === 'Individuelle' || r.type === 'Indiv') {
            totalIndiv++;
            if (r.status === 'occ') occIndiv++;
          } else {
            totalDouble++;
            if (r.status === 'occ') occDouble++;
          }
        });
      }

      const btn = document.createElement('button');
      btn.className = index === 0 ? 'btn-primary btn-gradient floor-btn' : 'btn-outline floor-btn';
      btn.textContent = floor.name;
      btn.style.minWidth = "max-content";
      btn.onclick = () => showFloor(index, btn);
      tabsContainer.appendChild(btn);
    });

    // 3. Mise à jour de l'affichage
    const kpiIndiv = document.getElementById('count-chambres-indiv');
    const kpiIndivOcc = document.getElementById('count-chambres-indiv-occ');
    if (kpiIndiv) kpiIndiv.textContent = totalIndiv;
    if (kpiIndivOcc) kpiIndivOcc.textContent = `1 500 DH/mois · ${occIndiv} occupées`;

    const kpiDouble = document.getElementById('count-chambres-double');
    const kpiDoubleOcc = document.getElementById('count-chambres-double-occ');
    if (kpiDouble) kpiDouble.textContent = totalDouble;
    if (kpiDoubleOcc) kpiDoubleOcc.textContent = `750 DH/mois · ${occDouble} occupées`;

    if (globalRoomsData.length > 0) {
      showFloor(0, tabsContainer.children[0]);
    }
  } catch (e) {
    console.error("Erreur détaillée:", e);
    showToast("Erreur lors du chargement des chambres");
  }
}
// async function buildRoomGrid() {
//   try {
//     const res = await fetch(`${API_BASE_URL}/rooms`, { headers: getAuthHeaders() });
//     const data = await res.json();
//     console.log("RAW ROOM DATA:", data);

//     // Ensure array format even if backend returns { "rooms": [...] }
//     globalRoomsData = data.rooms || data;

//     const tabsContainer = document.getElementById('floor-tabs');
//     if(!tabsContainer) return;
//     tabsContainer.innerHTML = ''; // reset on load

//     let totalIndiv = 0, occIndiv = 0;
//     let totalDouble = 0, occDouble = 0;

//     globalRoomsData.forEach((floor, index) => {
//       // Calculate totals
//       if(floor.rooms) {
//         floor.rooms.forEach(r => {
//           if(r.type === 'I') {
//             totalIndiv++;
//             if(r.status === 'occ') occIndiv++;
//           } else {
//             totalDouble++;
//             if(r.status === 'occ') occDouble++;
//           }
//         });
//       }

//       const btn = document.createElement('button');
//       btn.className = index === 0 ? 'btn-primary btn-gradient floor-btn' : 'btn-outline floor-btn';
//       btn.textContent = floor.name;
//       // prevent layout jumps by setting a min-width
//       btn.style.minWidth = "max-content";
//       btn.onclick = () => showFloor(index, btn);
//       tabsContainer.appendChild(btn);
//     });

//     // Update headers
//     const kpiIndiv = document.getElementById('count-chambres-indiv');
//     const kpiIndivOcc = document.getElementById('count-chambres-indiv-occ');
//     if(kpiIndiv) kpiIndiv.textContent = totalIndiv;
//     if(kpiIndivOcc) kpiIndivOcc.textContent = `1 500 DH/mois · ${occIndiv} occupées`;

//     const kpiDouble = document.getElementById('count-chambres-double');
//     const kpiDoubleOcc = document.getElementById('count-chambres-double-occ');
//     if(kpiDouble) kpiDouble.textContent = totalDouble;
//     if(kpiDoubleOcc) kpiDoubleOcc.textContent = `750 DH/mois · ${occDouble} occupées`;

//     if (globalRoomsData.length > 0) {
//       showFloor(0, tabsContainer.children[0]);
//     }
//   } catch (e) {
//     showToast("Erreur lors du chargement des chambres");
//   }
// }

function showFloor(floorIndex, btnElement) {
  // Update active tab styling
  if (btnElement) {
    document.querySelectorAll('.floor-btn').forEach(b => {
      b.className = 'btn-outline floor-btn';
      b.style.minWidth = "max-content";
    });
    btnElement.className = 'btn-primary btn-gradient floor-btn';
  }

  const g = document.getElementById('room-grid-a');
  g.innerHTML = '';

  const floor = globalRoomsData[floorIndex];
  if (!floor || !floor.rooms) return;

  floor.rooms.forEach(room => {
    const d = document.createElement('div');
    d.className = 'room-cell';
    d.dataset.roomId = room.id;

    if (room.status === 'occ') { d.style.background = 'rgba(46,204,113,0.1)'; d.style.borderColor = '#2ecc71'; }
    else if (room.status === 'res') { d.style.background = 'rgba(231,76,60,0.1)'; d.style.borderColor = '#e74c3c'; }

    d.innerHTML = `
      <div class="fw-bold" style="color: ${room.status === 'occ' ? '#27ae60' : room.status === 'res' ? '#c0392b' : 'var(--text-muted)'}">${room.id}</div>
      <div class="text-xs text-muted mt-8">${room.type === 'I' ? 'Indiv.' : 'Double'}</div>
    `;

    g.appendChild(d);
  });
}

function showRoomDetails(room) {
  document.getElementById('rd-id').textContent = 'Chambre ' + room.id;
  document.getElementById('rd-type').textContent = room.type === 'I' ? 'Individuelle' : 'Double';
  document.getElementById('rd-status').textContent = room.status === 'occ' ? 'Occupée' : room.status === 'res' ? 'Réservée' : 'Libre';

  const resList = document.getElementById('rd-residents');
  resList.innerHTML = '';

  let qrText = `Chambre: ${room.id}\n`;

  if (!room.residents || room.residents.length === 0) {
    resList.innerHTML = '<li class="text-muted">Aucun résident</li>';
    qrText += 'Statut: ' + (room.status === 'res' ? 'Réservée' : 'Libre');
  } else {
    room.residents.forEach(r => {
      resList.innerHTML += `<li>${r}</li>`;
    });
    qrText += `Résidents: ${room.residents.join(', ')}`;
  }

  const qrContainer = document.getElementById('rd-qr-container');
  if (qrContainer) {
    qrContainer.innerHTML = ''; // clear previous
    new QRCode(qrContainer, {
      text: qrText,
      width: 128,
      height: 128,
      colorDark: "#0f172a",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.L
    });
  }

  openModal('room-details');
}

// Add Resident Dynamic Dropdowns
function updateRoomDropdown() {
  const etageSelect = document.getElementById('add-res-etage').value;
  const typeSelect = document.getElementById('add-res-type').value;
  const roomSelect = document.getElementById('add-res-room');
  if (!roomSelect) return;

  roomSelect.innerHTML = '<option value="">Choisir la chambre...</option>';

  if (!etageSelect || !typeSelect) {
    roomSelect.innerHTML = '<option value="">Choisir étage et type d\'abord</option>';
    return;
  }

  if (!globalRoomsData || globalRoomsData.length === 0) {
    roomSelect.innerHTML = '<option value="">Chargement des chambres...</option>';
    // If not loaded, try to fetch then update
    buildRoomGrid().then(() => updateRoomDropdown());
    return;
  }

  const normalizeStr = (str) => {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  };

  const normEtage = normalizeStr(etageSelect);
  const normType = normalizeStr(typeSelect) === 'individuelle' ? 'i' : 'd';

  let availableRooms = [];

  console.log('Filtering rooms for:', normEtage, normType);

  // Handle grouped by floor format OR flat array format
  globalRoomsData.forEach(item => {
    // If it's a grouped floor object
    if (item.rooms && Array.isArray(item.rooms)) {
      const fName = normalizeStr(item.name);
      if (fName === normEtage || (normEtage === 'rdc' && fName === 'rez-de-chaussee')) {
        item.rooms.forEach(r => {
          const rType = normalizeStr(r.type);
          if (rType === normType && (r.status === 'free' || r.status === 'libre')) {
            availableRooms.push(r);
          }
        });
      }
    }
    // If it's a flat room object format fallback
    else {
      const r = item;
      const roomFloor = normalizeStr(r.floor || r.etage || r.level);
      console.log(`Checking room ${r.number || r.id}:`, roomFloor);

      const rType = normalizeStr(r.type);
      if ((roomFloor === normEtage || (normEtage === 'rdc' && roomFloor === 'rez-de-chaussee')) && rType === normType && (r.status === 'free' || r.status === 'libre')) {
        availableRooms.push(r);
      }
    }
  });

  console.log('Available rooms found:', availableRooms.length);

  if (availableRooms.length === 0) {
    roomSelect.innerHTML = '<option value="">Aucune chambre disponible</option>';
  } else {
    availableRooms.forEach(r => {
      const option = document.createElement('option');
      option.value = r.id;
      option.textContent = `Chambre ${r.id} (${r.type})`;
      roomSelect.appendChild(option);
    });
  }
}

// Resident Reclamations
async function renderResidentReclamations() {
  const container = document.getElementById('res-reclamations-list');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE_URL}/reclamations`, { headers: getAuthHeaders() });
    const reclamations = await res.json();

    container.innerHTML = '';
    const now = new Date().getTime();

    reclamations.forEach(rec => {
      const recDate = new Date(rec.date);
      const isPending = rec.status === 'Ouvert' || rec.status === 'En attente';
      const hoursPending = (now - recDate.getTime()) / (1000 * 60 * 60);
      const canRelance = isPending && hoursPending >= 48;

      let relanceBtn = '';
      if (isPending) {
        if (canRelance) {
          relanceBtn = `<button class="btn-primary btn-gradient action-relance" data-rec-id="${rec._id}">Relance</button>`;
        } else {
          relanceBtn = `<button class="btn-outline" disabled title="Relance disponible après 48h">Relance (Attente...)</button>`;
        }
      }

      const badgeClass = rec.status === 'Résolu' ? 'bg-success' : 'bg-warning';
      const title = rec.title || rec.type;

      let replyHtml = '';
      if (rec.reply) {
        replyHtml = `<div class="mt-8 p-8" style="background: rgba(46,204,113,0.1); border-left: 3px solid #2ecc71; border-radius: 4px;">
          <div class="fw-bold text-xs" style="color: #27ae60;">Réponse Admin:</div>
          <div class="text-xs text-muted mt-4">${rec.reply}</div>
        </div>`;
      }

      container.innerHTML += `
        <div class="rec-item glass-panel" style="display:flex; flex-direction:column; margin-bottom: 12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div class="fw-bold" style="display:flex; align-items:center;">
                ${getRecIcon(rec.type)}
                <span style="margin-left: 8px;">${title}</span>
              </div>
              <div class="text-muted text-xs mt-8">${rec.description}</div>
              <div class="text-muted text-xs mt-4">Posté le ${recDate.toLocaleDateString('fr-FR')}</div>
            </div>
            <div style="text-align:right;">
              <div style="margin-bottom: 8px;"><span class="badge ${badgeClass}">${rec.status}</span></div>
              ${relanceBtn}
            </div>
          </div>
          ${replyHtml}
        </div>
      `;
    });
  } catch (e) {
    showToast("Erreur de chargement des réclamations.");
  }
}

async function renderAdminReclamations() {
  const container = document.getElementById('admin-reclamations-list');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE_URL}/reclamations`, { headers: getAuthHeaders() });
    const reclamations = await res.json();
    container.innerHTML = '';

    const pendingCount = reclamations.filter(r => r.status === 'Ouvert' || r.status === 'En attente').length;
    const badge = document.getElementById('a-reclamations-badge');
    if (badge) {
      badge.textContent = pendingCount;
      badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }

    reclamations.forEach(rec => {
      const recDate = new Date(rec.date);
      const badgeClass = rec.status === 'Résolu' ? 'bg-success' : 'bg-warning';
      const title = rec.title || rec.type;

      let actions = '';
      if (rec.status !== 'Résolu') {
        actions = `
          <div class="rec-actions">
            <button class="btn-action" onclick="openRepondreModal('${rec._id}')">Répondre</button>
            <button class="btn-action success-text" onclick="updateReclamationStatus('${rec._id}', 'Résolu')">Marquer Résolu</button>
          </div>
        `;
      }

      let replyHtml = '';
      if (rec.reply) {
        replyHtml = `<div class="mt-8 text-xs text-muted"><b>Réponse:</b> ${rec.reply}</div>`;
      }

      container.innerHTML += `
        <div class="rec-item glass-panel">
          <div class="rec-head">
            <div class="rec-title">
              ${getRecIcon(rec.type)}
              <span style="margin-left: 8px;">${title}</span>
            </div><span class="badge ${badgeClass}">${rec.status}</span>
          </div>
          <div class="rec-body">${rec.description}</div>
          ${replyHtml}
          <div class="rec-meta"><span>${rec.resident_name || rec.resident_email}</span><span>${recDate.toLocaleDateString('fr-FR')}</span></div>
          ${actions}
        </div>
      `;
    });
  } catch (e) {
    showToast("Erreur de chargement des réclamations.");
  }
}

async function updateReclamationStatus(id, newStatus) {
  try {
    const res = await fetch(`${API_BASE_URL}/reclamations/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      showToast("Statut mis à jour.");
      renderAdminReclamations();
    }
  } catch (e) {
    showToast("Erreur lors de la mise à jour");
  }
}

function openRepondreModal(id) {
  document.getElementById('reply-rec-id').value = id;
  document.getElementById('reply-rec-msg').value = '';
  openModal('repondre-rec');
}

async function submitReclamationReply() {
  const id = document.getElementById('reply-rec-id').value;
  const msg = document.getElementById('reply-rec-msg').value;

  try {
    const res = await fetch(`${API_BASE_URL}/reclamations/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: 'Résolu', reply: msg })
    });
    if (res.ok) {
      closeModal('repondre-rec');
      showToast("Réponse envoyée.");
      renderAdminReclamations();
    }
  } catch (e) {
    showToast("Erreur lors de l'envoi de la réponse");
  }
}

// Community Posts
async function renderCommunityPosts(isAdmin) {
  const container = isAdmin ? document.getElementById('admin-community-list') : document.getElementById('res-community-list');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE_URL}/annonces`, { headers: getAuthHeaders() });
    const posts = await res.json();

    container.innerHTML = '';

    posts.forEach(post => {
      let actionsHtml = '';
      const isAuthor = (localStorage.getItem('email') === post.email);

      if (isAdmin || isAuthor) {
        let closeBtn = post.closed ? '' : `<button class="btn-outline" style="padding: 4px 8px; font-size: 12px; margin-right: 8px;" onclick="closeThread('${post._id}')">Fermer</button>`;
        actionsHtml = `
          <div>
            ${closeBtn}
            <button class="btn-outline" style="color:#e74c3c; border-color:#e74c3c; padding: 4px 8px; font-size: 12px;" onclick="deletePost('${post._id}')">Supprimer</button>
          </div>
        `;
      }

      let commentsHtml = (post.comments || []).map(c => `
        <div class="mt-8 p-8" style="background: rgba(0,0,0,0.03); border-radius: 4px; border-left: 2px solid var(--primary);">
          <div class="fw-bold text-xs">${c.author} <span class="text-muted" style="font-weight: normal; margin-left: 8px;">${new Date(c.time).toLocaleString('fr-FR')}</span></div>
          <div class="text-xs mt-4">${c.text}</div>
        </div>
      `).join('');

      let addCommentHtml = '';
      if (!post.closed) {
        addCommentHtml = `
          <div class="mt-8" style="display: flex; gap: 8px;">
            <input type="text" id="comment-input-${post._id}" placeholder="Ajouter un commentaire..." style="flex-grow: 1; padding: 6px 12px; font-size: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 4px;">
            <button class="btn-primary" style="padding: 6px 12px; font-size: 12px; border-radius: 4px;" onclick="submitComment('${post._id}')">Envoyer</button>
          </div>
        `;
      } else {
        addCommentHtml = `<div class="mt-8 text-xs text-muted" style="font-style: italic;">Thread fermé.</div>`;
      }

      container.innerHTML += `
        <div class="card glass-panel" id="post-${post._id}" style="margin-bottom: 16px;">
          <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
            <div class="fw-bold">${post.author} <span class="text-xs text-muted" style="margin-left: 8px;">${new Date(post.time).toLocaleString('fr-FR')}</span></div>
            ${actionsHtml}
          </div>
          <div class="mb-8" style="white-space: pre-wrap;">${post.content}</div>
          <div class="mt-16" style="border-top: 1px solid rgba(0,0,0,0.05); padding-top: 8px;">
            ${commentsHtml}
            ${addCommentHtml}
          </div>
        </div>
      `;
    });
  } catch (e) {
    showToast("Erreur de chargement de la communauté");
  }
}

async function createAnnonce() {
  const title = document.getElementById('annonce-title').value || "Annonce";
  const cat = document.getElementById('annonce-cat').value;
  const content = document.getElementById('annonce-content').value;

  const payload = {
    content: `[${cat}] ${title}\n\n${content}`
  };

  try {
    const res = await fetch(`${API_BASE_URL}/annonces`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast("Thread publié !");
      closeModal('annonce');
      renderCommunityPosts(currentRole === 'admin');
    }
  } catch (e) {
    showToast("Erreur lors de la publication");
  }
}

async function submitComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input || !input.value.trim()) return;

  try {
    const res = await fetch(`${API_BASE_URL}/annonces/${postId}/comments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ text: input.value.trim() })
    });
    if (res.ok) {
      renderCommunityPosts(currentRole === 'admin');
    } else {
      showToast("Erreur. Le thread est peut-être fermé.");
    }
  } catch (e) {
    showToast("Erreur de connexion");
  }
}

async function closeThread(postId) {
  try {
    const res = await fetch(`${API_BASE_URL}/annonces/${postId}/close`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      showToast("Thread fermé.");
      renderCommunityPosts(currentRole === 'admin');
    }
  } catch (e) {
    showToast("Erreur de connexion");
  }
}

async function updateNotificationsBadge() {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const notifs = await res.json();
    const unreadCount = notifs.filter(n => !n.read).length;

    const adminDot = document.getElementById('a-notif-dot');
    const resDot = document.getElementById('r-notif-dot');

    if (adminDot) adminDot.style.display = unreadCount > 0 ? 'block' : 'none';
    if (resDot) resDot.style.display = unreadCount > 0 ? 'block' : 'none';

    const prefix = currentRole === 'admin' ? 'a' : 'r';
    const listEl = document.getElementById(`${prefix}-notif-list`);
    if (listEl) {
      listEl.innerHTML = '';
      if (notifs.length === 0) {
        listEl.innerHTML = '<div class="text-muted text-xs text-center p-8">Aucune notification</div>';
      } else {
        notifs.forEach(n => {
          const msgLower = (n.message || '').toLowerCase();
          let clickAttrs = '';
          if (msgLower.includes('réclamation') || msgLower.includes('relance')) {
            clickAttrs = `onclick="handleNotifClick('${n.message.replace(/'/g, "\\'")}')" style="cursor: pointer;"`;
          }

          listEl.innerHTML += `<div ${clickAttrs} class="notif-item" style="padding: 8px; border-bottom: 1px solid rgba(0,0,0,0.05); ${n.read ? 'opacity:0.6;' : ''}">
            <div class="text-xs fw-bold">${n.message}</div>
            <div class="text-xs text-muted mt-4">${new Date(n.date).toLocaleString('fr-FR')}</div>
          </div>`;
        });
      }
    }
  } catch (e) {
    // silently fail
  }
}

function handleNotifClick(message) {
  const msgLower = (message || '').toLowerCase();
  if (msgLower.includes('réclamation') || msgLower.includes('relance')) {
    const prefix = currentRole === 'admin' ? 'a' : 'r';
    const dd = document.getElementById(`${prefix}-notif-dropdown`);
    if (dd) dd.style.display = 'none';

    const target = `${prefix}-reclamations`;
    const navItem = document.querySelector(`[onclick*="${target}"]`);

    if (currentRole === 'admin') aNav(target, navItem);
    else rNav(target, navItem);
  }
}

function toggleNotifDropdown(role) {
  const prefix = role === 'admin' ? 'a' : 'r';
  const dd = document.getElementById(`${prefix}-notif-dropdown`);
  if (dd) {
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    if (dd.style.display === 'block') {
      readNotifications();
    }
  }
}

async function deleteAllNotifications() {
  try {
    const res = await fetch(`${API_BASE_URL}/user/notifications`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      showToast("Toutes les notifications ont été supprimées");
      updateNotificationsBadge();
    }
  } catch (e) {
    showToast("Erreur de connexion");
  }
}

function filterGlobal(query) {
  query = query.toLowerCase().trim();
  const activeView = document.querySelector('.view.active');
  if (!activeView) return;
  const activeViewId = activeView.id;

  if (activeViewId === 'a-residents') {
    const rows = document.querySelectorAll('#a-residents table tbody tr');
    rows.forEach(row => {
      row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none';
    });
  } else if (activeViewId === 'a-reclamations') {
    const items = document.querySelectorAll('#admin-reclamations-list .rec-item');
    items.forEach(item => {
      item.style.display = item.innerText.toLowerCase().includes(query) ? '' : 'none';
    });
  } else if (activeViewId === 'a-paiements') {
    const rows = document.querySelectorAll('#a-paiements table tbody tr');
    rows.forEach(row => {
      row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none';
    });
  }
}

async function readNotifications() {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/read`, { method: 'PUT', headers: getAuthHeaders() });
    if (res.ok) {
      updateNotificationsBadge();
      showToast("Notifications marquées comme lues");
    }
  } catch (e) { }
}

function exportExcel() {
  const table = document.querySelector('#a-residents table');
  if (!table) return showToast("Aucune donnée à exporter");
  const wb = XLSX.utils.table_to_book(table, { sheet: "Résidents" });
  XLSX.writeFile(wb, "Residents_SupTech.xlsx");
  showToast("Export Excel réussi !");
}

function exportPDF(type) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("SupTech Internat - Rapport", 14, 22);

  let tableSelector = type === 'admin' ? '#a-paiements table' : '#r-paiements table';

  doc.autoTable({
    html: tableSelector,
    startY: 30,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10 }
  });

  doc.save(`Rapport_${type === 'admin' ? 'Paiements_Admin' : 'Paiements_Resident'}.pdf`);
  showToast("Export PDF réussi !");
}

// Global hook to override the mock action for community if requested
const originalMockAction = window.mockAction;
window.mockAction = function (message) {
  if (message.includes("Création d'annonce")) {
    createAnnonce();
  } else {
    showToast(message);
  }
}

async function deletePost(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/annonces/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      renderCommunityPosts(currentRole === 'admin');
      showToast("Post supprimé.");
    } else {
      showToast("Erreur lors de la suppression");
    }
  } catch (e) {
    showToast("Erreur de connexion");
  }
}

async function renderActivities() {
  const container = currentRole === 'admin' ? document.getElementById('admin-activities-list') : document.getElementById('res-activities-grid');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE_URL}/activites`, { headers: getAuthHeaders() });
    const activities = await res.json();

    container.innerHTML = '';

    activities.forEach(act => {
      if (currentRole === 'admin') {
        let actions = '';
        if (act.status === 'pending') {
          actions = `
            <div class="mt-8" style="display:flex; gap:8px;">
              <button class="btn-primary" style="font-size:12px; padding: 4px 8px;" onclick="updateActivityStatus('${act._id}', 'approved')">Accepter</button>
              <button class="btn-outline" style="font-size:12px; padding: 4px 8px; color: #e74c3c; border-color: #e74c3c;" onclick="const r = prompt('Raison du refus?'); if(r!=null) updateActivityStatus('${act._id}', 'refused', r);">Refuser</button>
            </div>
          `;
        }
        let badgeClass = act.status === 'approved' ? 'bg-success' : act.status === 'pending' ? 'bg-warning' : 'bg-danger';
        container.innerHTML += `
          <div class="card glass-panel" style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between;">
              <div class="fw-bold">${act.title}</div>
              <span class="badge ${badgeClass}">${act.status}</span>
            </div>
            <div class="text-xs text-muted mt-4">${act.date} — ${act.desc}</div>
            ${act.suggester_email ? `<div class="text-xs text-muted mt-4">Suggéré par: ${act.suggester_email}</div>` : ''}
            ${actions}
          </div>
        `;
      } else {
        container.innerHTML += `
          <div class="card glass-panel">
            <div class="fw-bold">${act.title}</div>
            <div class="text-muted text-xs mt-8">${act.date} — ${act.desc}</div>
            <button class="btn-outline mt-16" style="width:100%" onclick="mockAction('Inscrit à ${act.title}')">Participer</button>
          </div>
        `;
      }
    });
  } catch (e) {
    showToast("Erreur de chargement des activités");
  }
}

async function submitActivity() {
  const title = document.getElementById('act-title').value;
  const date = document.getElementById('act-date').value;
  const desc = document.getElementById('act-desc').value;

  try {
    const res = await fetch(`${API_BASE_URL}/activites`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, date, desc })
    });
    if (res.ok) {
      closeModal('suggest-activity');
      showToast(currentRole === 'admin' ? "Activité créée!" : "Suggestion envoyée!");
      renderActivities();
    }
  } catch (e) {
    showToast("Erreur de soumission");
  }
}

async function updateActivityStatus(id, status, comment = "") {
  try {
    const res = await fetch(`${API_BASE_URL}/activites/${id}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, comment })
    });
    if (res.ok) {
      showToast("Statut mis à jour.");
      renderActivities();
    }
  } catch (e) {
    showToast("Erreur");
  }
}

// Chart.js Configuration
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = "#64748b";

let recStatsChartInstance = null;
let ecoleStatsChartInstance = null;
let chartsBuilt = false;

async function buildStatsCharts() {
  if (chartsBuilt) {
    if (recStatsChartInstance) recStatsChartInstance.destroy();
    if (ecoleStatsChartInstance) ecoleStatsChartInstance.destroy();
  }
  chartsBuilt = true;

  // Fetch reclamations dynamically
  let recs = [];
  try {
    const res = await fetch(`${API_BASE_URL}/reclamations`, { headers: getAuthHeaders() });
    if (res.ok) recs = await res.json();
  } catch (e) { }

  let wifiCount = 0, plombCount = 0, elecCount = 0, autreCount = 0;
  recs.forEach(r => {
    if (r.type === 'WiFi') wifiCount++;
    else if (r.type === 'Plomberie') plombCount++;
    else if (r.type === 'Électricité') elecCount++;
    else autreCount++;
  });

  const ctxRec = document.getElementById('recStatsChart');
  if (ctxRec) {
    recStatsChartInstance = new Chart(ctxRec, {
      type: 'doughnut',
      data: {
        labels: ['WiFi', 'Plomberie', 'Électricité', 'Autre'],
        datasets: [{
          data: [wifiCount, plombCount, elecCount, autreCount],
          backgroundColor: ['#00d2ff', '#3a7bd5', '#f39c12', '#95a5a6'],
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });
  }

  // Calculate schools dynamically from residentsData
  let sSante = 0, sEnv = 0, sInfo = 0;
  if (residentsData && residentsData.length > 0) {
    residentsData.forEach(r => {
      if (r.school === 'SupTech Santé') sSante++;
      else if (r.school === 'SupTech Environnement') sEnv++;
      else if (r.school === 'Suptech Info') sInfo++;
    });
  }

  const ctxEcole = document.getElementById('ecoleStatsChart');
  if (ctxEcole) {
    ecoleStatsChartInstance = new Chart(ctxEcole, {
      type: 'bar',
      data: {
        labels: ['Suptech Santé', 'Suptech Env.', 'Suptech Info'],
        datasets: [{
          label: 'Résidents',
          data: [sSante, sEnv, sInfo],
          backgroundColor: ['#00d2ff', '#3a7bd5', '#9b59b6'],
          borderRadius: 6, borderWidth: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.05)' } } }
      }
    });
  }
}

let mainBuilt = false;
let revChartInstance = null;
let occChartInstance = null;

function buildMainCharts(stats) {
  if (mainBuilt) {
    if (revChartInstance) revChartInstance.destroy();
    if (occChartInstance) occChartInstance.destroy();
  }
  mainBuilt = true;

  const revCtx = document.getElementById('revChart');
  if (revCtx && stats) {
    revChartInstance = new Chart(revCtx, {
      type: 'bar',
      data: {
        labels: ['Mois en cours'], // Since we only have current month stats
        datasets: [{
          label: 'Revenus (DH)',
          data: [stats.monthlyRevenue || 0],
          backgroundColor: 'rgba(0, 210, 255, 0.8)',
          borderRadius: 6, borderWidth: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: v => Math.round(v / 1000) + 'k' } }
        }
      }
    });
  }

  const occCtx = document.getElementById('occChart');
  if (occCtx && stats) {
    occChartInstance = new Chart(occCtx, {
      type: 'doughnut',
      data: {
        labels: ['Occupées', 'Libres'],
        datasets: [{
          data: [stats.occupiedRooms || 0, (stats.totalRooms || 50) - (stats.occupiedRooms || 0)],
          backgroundColor: ['#3a7bd5', '#ecf0f1'],
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }
    });
  }
}

// Select Reclamation Category
function getRecIcon(type) {
  const t = (type || '').toLowerCase();
  const base = 'style="width: 18px; height: 18px; vertical-align: middle; flex-shrink: 0;"';

  if (t.includes('wifi')) return `<svg ${base} fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewbox="0 0 24 24"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" x2="12.01" y1="20" y2="20"></line></svg>`;
  if (t.includes('élec') || t.includes('elec')) return `<svg ${base} fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewbox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
  if (t.includes('plomb')) return `<svg ${base} fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewbox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`;
  if (t.includes('nett')) return `<svg ${base} fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewbox="0 0 24 24"><path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"></path></svg>`;
  if (t.includes('sécu') || t.includes('secu')) return `<svg ${base} fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewbox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
  if (t.includes('paiement')) return `<svg ${base} fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewbox="0 0 24 24"><rect height="16" rx="2" ry="2" width="22" x="1" y="4"></rect><line x1="1" x2="23" y1="10" y2="10"></line></svg>`;

  // Default (Autre / Note)
  return `<svg ${base} fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewbox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" x2="8" y1="13" y2="13"></line><line x1="16" x2="8" y1="17" y2="17"></line></svg>`;
}

function selectCategory(btn, category) {
  document.querySelectorAll('.btn-category').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('reclamation-type').value = category;
}

// Mobile Sidebar Toggle
function toggleSidebar() {
  const screen = currentRole === 'admin' ? document.getElementById('admin-screen') : document.getElementById('res-screen');
  const sidebar = screen.querySelector('.sidebar');
  sidebar.classList.toggle('open');

  let overlay = screen.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.onclick = toggleSidebar;
    screen.appendChild(overlay);
  }

  if (sidebar.classList.contains('open')) {
    overlay.classList.add('active');
  } else {
    overlay.classList.remove('active');
  }
}

// App Initialization
window.addEventListener('DOMContentLoaded', () => {
  if (currentRole === 'admin') {
    document.getElementById('admin-screen').classList.add('active');
    renderAdminDashboard();
    fetchAdmins();
    buildRoomGrid(); // Load rooms immediately for admin
  } else {
    document.getElementById('res-screen').classList.add('active');
    renderResidentViews();
  }
  const etageSelect = document.getElementById('add-res-etage');
  const typeSelect = document.getElementById('add-res-type');
  if (etageSelect) etageSelect.addEventListener('change', updateRoomDropdown);
  if (typeSelect) typeSelect.addEventListener('change', updateRoomDropdown);

  // Event Delegation to fix UI blocking on dynamic elements
  _suppressOutsideClose = false;
  document.addEventListener('click', (e) => {
    // 1. Reclamations Action Button
    const relanceBtn = e.target.closest('.action-relance');
    if (relanceBtn) {
      e.preventDefault();
      e.stopImmediatePropagation();
      setTimeout(() => {
        mockAction('Relance envoyée pour la réclamation #' + relanceBtn.dataset.recId);
      }, 10);
      return;
    }

    // 2. Room cell click
    const roomEl = e.target.closest('.room-cell');
    if (roomEl && roomEl.closest('#room-grid-a')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      _suppressOutsideClose = true;
      setTimeout(() => {
        const roomId = roomEl.dataset.roomId;
        let foundRoom = null;
        for (let f of globalRoomsData) {
          let r = f.rooms.find(x => x.id === roomId);
          if (r) { foundRoom = r; break; }
        }
        if (foundRoom) {
          if (foundRoom.status === 'occ') showRoomInfo(foundRoom);
          else showRoomDetails(foundRoom);
        }
        _suppressOutsideClose = false;
      }, 10);
      return;
    }

    // 3. Resident Table Row click
    const trEl = e.target.closest('.res-row');
    if (trEl && trEl.closest('#a-residents table tbody')) {
      const actionBtn = e.target.closest('.btn-action');
      if (actionBtn) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      _suppressOutsideClose = true;
      setTimeout(() => {
        const resId = trEl.dataset.resId;
        if (resId) showResidentInfo(resId);
        _suppressOutsideClose = false;
      }, 10);
    }
  });

  // Click Outside Modal Collision Fix
  window.onclick = function (e) {
    if (_suppressOutsideClose) return;
    if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
      closeModal(e.target.id.replace('modal-', ''));
    }
  };
});

async function fetchAdmins() {
  const listEl = document.getElementById('admin-users-list');
  if (!listEl) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admins`, { headers: getAuthHeaders() });
    if (res.ok) {
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

// Trigger deploy update

// Trigger deploy update via MCP push
