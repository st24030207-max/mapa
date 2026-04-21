// ── CONFIGURACIÓN ────────────────────────────
const SUPABASE_URL = 'https://gbwrlxfwwdtwwgwsujfg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_y4Fw4GcS2krSDXJQmyXvRQ_FA0R85m0';
const TABLA        = 'Lugares';

// ── SUPABASE ─────────────────────────────────
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── MAPA ─────────────────────────────────────
const map = L.map('map').setView([23.6345, -102.5528], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
}).addTo(map);

// ── MARCADOR PREVIEW ──────────────────────────
// Icono gris semitransparente para distinguirlo de los guardados
const iconoPreview = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
    <path fill="rgba(100,100,100,0.55)" stroke="#555" stroke-width="1.5"
      d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"/>
    <circle cx="12.5" cy="12.5" r="4.5" fill="white" opacity="0.8"/>
  </svg>`,
  iconSize:   [25, 41],
  iconAnchor: [12, 41],
});

let marcadorPreview = null;

// Clic en el mapa → muestra marcador preview y llena los inputs
map.on('click', function(e) {
  const lat = e.latlng.lat.toFixed(6);
  const lng = e.latlng.lng.toFixed(6);

  document.getElementById('inp-lat').value = lat;
  document.getElementById('inp-lng').value = lng;

  // Eliminar preview anterior si existe
  if (marcadorPreview) map.removeLayer(marcadorPreview);

  // Colocar nuevo preview
  marcadorPreview = L.marker([lat, lng], { icon: iconoPreview })
    .addTo(map)
    .bindPopup('📍 Sin guardar aún')
    .openPopup();
});

function limpiarPreview() {
  if (marcadorPreview) {
    map.removeLayer(marcadorPreview);
    marcadorPreview = null;
  }
}

// ── ESTADO ───────────────────────────────────
let marcadores = {}; // guarda los marcadores por id
let cardActiva = null;

// ── TOOLTIP HOVER ─────────────────────────────
const tooltip = document.getElementById('tooltip');

function mostrarTooltip(lugar, x, y) {
  document.getElementById('tt-nombre').textContent = lugar.nombre;
  document.getElementById('tt-coords').textContent =
    Number(lugar.latitud).toFixed(5) + ', ' + Number(lugar.longitud).toFixed(5);

  tooltip.classList.add('visible');
  posicionarTooltip(x, y);
}

function posicionarTooltip(x, y) {
  const ancho  = tooltip.offsetWidth  || 160;
  const alto   = tooltip.offsetHeight || 50;
  const margen = 12;

  let left = x + margen;
  let top  = y - alto / 2;

  if (left + ancho > window.innerWidth)  left = x - ancho - margen;
  if (top < 0)                           top  = 0;
  if (top + alto > window.innerHeight)   top  = window.innerHeight - alto;

  tooltip.style.left = left + 'px';
  tooltip.style.top  = top  + 'px';
}

function ocultarTooltip() {
  tooltip.classList.remove('visible');
}

// ── CARGAR LUGARES ────────────────────────────
async function cargarLugares() {
  const { data, error } = await db
    .from(TABLA)
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    alert('Error al cargar: ' + error.message);
    return;
  }

  document.getElementById('total').textContent = data.length + ' lugares';
  renderLista(data);

  // Limpiar marcadores viejos y redibujar
  Object.values(marcadores).forEach(m => map.removeLayer(m));
  marcadores = {};
  data.forEach(agregarMarcador);
}

// ── RENDER LISTA ──────────────────────────────
function renderLista(lugares) {
  const lista = document.getElementById('lista');

  if (lugares.length === 0) {
    lista.innerHTML = '<p class="empty">Sin lugares aún</p>';
    return;
  }

  lista.innerHTML = lugares.map(l => `
    <div class="lugar-card ${cardActiva === l.id ? 'active' : ''}"
         id="card-${l.id}"
         onclick="irA(${l.id}, ${l.latitud}, ${l.longitud})">
      <div class="lugar-info">
        <div class="nombre">${l.nombre}</div>
        <div class="coords">${Number(l.latitud).toFixed(4)}, ${Number(l.longitud).toFixed(4)}</div>
        <div class="coords">${l.fecha ?? '—'}</div>
      </div>
      <button class="btn-delete" onclick="pedirEliminar(event, ${l.id}, '${l.nombre.replace(/'/g, "\\'")}')">✕</button>
    </div>
  `).join('');
}

// ── AGREGAR MARCADOR ──────────────────────────
function agregarMarcador(lugar) {
  const marker = L.marker([lugar.latitud, lugar.longitud]).addTo(map);

  // Popup al hacer clic
  marker.bindPopup('<b>' + lugar.nombre + '</b><br>' +
    Number(lugar.latitud).toFixed(5) + ', ' + Number(lugar.longitud).toFixed(5) + '<br>' +
    '📅 ' + (lugar.fecha ?? '—'));

  // Tooltip al pasar el cursor
  marker.on('mouseover', function(e) {
    mostrarTooltip(lugar, e.originalEvent.clientX, e.originalEvent.clientY);
  });

  marker.on('mousemove', function(e) {
    posicionarTooltip(e.originalEvent.clientX, e.originalEvent.clientY);
  });

  marker.on('mouseout', function() {
    ocultarTooltip();
  });

  marcadores[lugar.id] = marker;
}

// ── IR A UN LUGAR ─────────────────────────────
function irA(id, lat, lng) {
  map.flyTo([lat, lng], 15);
  setTimeout(() => marcadores[id]?.openPopup(), 800);

  // Marcar card activa
  if (cardActiva) {
    document.getElementById('card-' + cardActiva)?.classList.remove('active');
  }
  document.getElementById('card-' + id)?.classList.add('active');
  cardActiva = id;
}

// ── GUARDAR LUGAR ────────────────────────────
document.getElementById('btn-guardar').addEventListener('click', async function() {
  const nombre   = document.getElementById('inp-nombre').value.trim();
  const latitud  = parseFloat(document.getElementById('inp-lat').value);
  const longitud = parseFloat(document.getElementById('inp-lng').value);

  if (!nombre)                           { alert('Escribe un nombre');  return; }
  if (isNaN(latitud) || isNaN(longitud)) { alert('Faltan coordenadas'); return; }

  const fecha = new Date().toISOString().split('T')[0];

  const { data, error } = await db
    .from(TABLA)
    .insert([{ nombre, latitud, longitud, fecha }])
    .select()
    .single();

  if (error) { alert('Error: ' + error.message); return; }

  document.getElementById('inp-nombre').value = '';
  document.getElementById('inp-lat').value    = '';
  document.getElementById('inp-lng').value    = '';
  limpiarPreview();

  await cargarLugares();
  irA(data.id, data.latitud, data.longitud);
});

// ── ELIMINAR CON DIALOG ───────────────────────
const modal        = document.getElementById('modal-eliminar');
const btnConfirmar = document.getElementById('btn-confirmar');
const btnCancelar  = document.getElementById('btn-cancelar');
let idAEliminar    = null;

function pedirEliminar(e, id, nombre) {
  e.stopPropagation(); // que no active el onclick de la card
  idAEliminar = id;
  document.getElementById('modal-nombre-texto').textContent = nombre;
  modal.showModal();
}

btnConfirmar.addEventListener('click', async function() {
  modal.close();

  const { error } = await db.from(TABLA).delete().eq('id', idAEliminar);
  if (error) { alert('Error: ' + error.message); return; }

  map.removeLayer(marcadores[idAEliminar]);
  delete marcadores[idAEliminar];

  if (cardActiva === idAEliminar) cardActiva = null;
  idAEliminar = null;

  await cargarLugares();
});

btnCancelar.addEventListener('click', function() {
  modal.close();
  idAEliminar = null;
});

// ── INICIO ────────────────────────────────────
cargarLugares();
