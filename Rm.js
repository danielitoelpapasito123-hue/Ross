const STORAGE_KEY = "reservasM";
const THEME_KEY = "rmTheme";
const TOTAL_MESAS = 12;
const TABLE_IMAGE = "images(2).jpg";
const INTERVALO_MINIMO_MS = 2.5 * 60 * 60 * 1000; // 2 horas y media entre reservas de la misma mesa
const CAPACIDADES = [2, 4, 4, 6, 2, 4, 6, 8, 2, 4, 6, 4]; // capacidad por mesa (1..12)
const PAGE_SIZE = 8;

function cargarReservas() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch (error) {
    console.error("No se pudieron leer las reservas guardadas:", error);
    return [];
  }
}

function guardarReserva(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (error) {
    console.error("No se pudo guardar en localStorage:", error);
    showToast("No se pudo guardar. Verifica el almacenamiento del navegador.", "error");
    return false;
  }
}

let reservas = cargarReservas();
let editingId = null;
let reportPage = 1;

function idCorto() {
  return Date.now().toString(36).slice(-6);
}

function escaparHTML(texto) {
  const div = document.createElement("div");
  div.textContent = String(texto ?? "");
  return div.innerHTML;
}

function formatearFechaHora(iso) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "Fecha no válida";
  return fecha.toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatearFechaCorta(diaISO) {
  const fecha = new Date(`${diaISO}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return diaISO;
  return fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function getCapacidad(mesa) {
  return CAPACIDADES[(Number(mesa) - 1) % CAPACIDADES.length];
}

function nowLocalISO() {
  const d = new Date();
  d.setSeconds(0, 0);
  const offsetMs = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

/* ---------------- Validaciones centralizadas ---------------- */

function esContactoValido(contacto) {
  if (!contacto) return true;
  const limpio = contacto.replace(/[\s-]/g, "");
  const esTelefono = /^\+?\d{7,15}$/.test(limpio);
  const esEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacto);
  return esTelefono || esEmail;
}

function esFechaFutura(datetime) {
  return new Date(datetime).getTime() >= Date.now() - 60000;
}

function hayConflictoHorario(mesa, datetime, excludeId = null) {
  const nuevaFechaMs = new Date(datetime).getTime();
  return reservas.some((r) => {
    if (r.id === excludeId) return false;
    if (Number(r.table) !== Number(mesa) || r.status === "cancelada") return false;
    const diff = Math.abs(new Date(r.datetime).getTime() - nuevaFechaMs);
    return diff < INTERVALO_MINIMO_MS;
  });
}

function hayConflictoCliente(contacto, datetime, excludeId = null) {
  if (!contacto) return false;
  const nuevaFechaMs = new Date(datetime).getTime();
  return reservas.some((r) => {
    if (r.id === excludeId) return false;
    if (!r.contact || r.status === "cancelada") return false;
    if (r.contact.toLowerCase() !== contacto.toLowerCase()) return false;
    const diff = Math.abs(new Date(r.datetime).getTime() - nuevaFechaMs);
    return diff < INTERVALO_MINIMO_MS;
  });
}

function validarReserva({ nombre, contacto, datetime, mesa, personas, excludeId = null }) {
  if (!nombre || !datetime || !mesa) {
    return { valid: false, message: "Completa todos los campos obligatorios." };
  }
  if (mesa < 1 || mesa > TOTAL_MESAS) {
    return { valid: false, message: `La mesa debe estar entre 1 y ${TOTAL_MESAS}.` };
  }
  const fechaHora = new Date(datetime);
  if (Number.isNaN(fechaHora.getTime())) {
    return { valid: false, message: "La fecha y hora no son válidas." };
  }
  if (!esFechaFutura(datetime)) {
    return { valid: false, message: "No puedes reservar en una fecha u hora que ya pasó." };
  }
  if (!esContactoValido(contacto)) {
    return {
      valid: false,
      message: "El contacto debe ser un teléfono (7 a 15 dígitos) o un correo válido.",
    };
  }
  const capacidad = getCapacidad(mesa);
  if (personas && personas > capacidad) {
    return {
      valid: false,
      message: `La mesa ${mesa} tiene capacidad para ${capacidad} personas.`,
    };
  }
  if (hayConflictoHorario(mesa, datetime, excludeId)) {
    return {
      valid: false,
      message:
        "Esa mesa ya tiene una reserva demasiado cercana en el tiempo. Debe haber al menos 2 horas y media de diferencia.",
    };
  }
  if (hayConflictoCliente(contacto, datetime, excludeId)) {
    return {
      valid: false,
      message: "Este cliente ya tiene otra reserva cercana en ese horario.",
    };
  }
  return { valid: true };
}

/* ---------------- Toasts y confirmación ---------------- */

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function confirmDialog(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmModal");
    const msgEl = document.getElementById("confirmMessage");
    const yesBtn = document.getElementById("confirmYes");
    const noBtn = document.getElementById("confirmNo");

    if (!modal || !msgEl || !yesBtn || !noBtn) {
      resolve(window.confirm(message));
      return;
    }

    msgEl.textContent = message;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");

    function cleanup(result) {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      yesBtn.removeEventListener("click", onYes);
      noBtn.removeEventListener("click", onNo);
      resolve(result);
    }
    function onYes() {
      cleanup(true);
    }
    function onNo() {
      cleanup(false);
    }
    yesBtn.addEventListener("click", onYes);
    noBtn.addEventListener("click", onNo);
  });
}

/* ---------------- Modo oscuro ---------------- */

function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  try {
    localStorage.setItem(THEME_KEY, tema);
  } catch (error) {
    console.error("No se pudo guardar la preferencia de tema:", error);
  }
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = tema === "dark" ? "☀️ Modo claro" : "🌙 Modo oscuro";
}

function initTema() {
  let guardado = null;
  try {
    guardado = localStorage.getItem(THEME_KEY);
  } catch (error) {
    guardado = null;
  }
  const prefiereOscuro =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  aplicarTema(guardado || (prefiereOscuro ? "dark" : "light"));
}

/* ---------------- Modal de reserva (crear / editar) ---------------- */

function abrirModalReserva(mesa) {
  const modal = document.getElementById("quickReserveModal");
  const tableInput = document.getElementById("modalTable");
  const title = document.getElementById("modalMesaTitle");
  const modalTitle = document.getElementById("modalTitle");
  const nameInput = document.getElementById("modalName");
  const contactInput = document.getElementById("modalContact");
  const datetimeInput = document.getElementById("modalDatetime");
  const peopleInput = document.getElementById("modalPersonas");
  const editIdInput = document.getElementById("modalEditId");

  if (!modal || !tableInput || !title || !nameInput || !contactInput || !datetimeInput) {
    return;
  }

  editingId = null;
  editIdInput.value = "";
  if (modalTitle) modalTitle.childNodes[0].textContent = "Reservar mesa ";
  tableInput.value = mesa;
  tableInput.readOnly = true;
  title.textContent = mesa;
  nameInput.value = "";
  contactInput.value = "";
  datetimeInput.value = "";
  datetimeInput.min = nowLocalISO();
  if (peopleInput) peopleInput.value = 2;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  nameInput.focus();
}

function abrirModalEdicion(reserva) {
  const modal = document.getElementById("quickReserveModal");
  const tableInput = document.getElementById("modalTable");
  const title = document.getElementById("modalMesaTitle");
  const modalTitle = document.getElementById("modalTitle");
  const nameInput = document.getElementById("modalName");
  const contactInput = document.getElementById("modalContact");
  const datetimeInput = document.getElementById("modalDatetime");
  const peopleInput = document.getElementById("modalPersonas");
  const editIdInput = document.getElementById("modalEditId");

  if (!modal || !tableInput || !nameInput || !contactInput || !datetimeInput) return;

  editingId = reserva.id;
  editIdInput.value = reserva.id;
  if (modalTitle) modalTitle.childNodes[0].textContent = "Editar reserva ";
  tableInput.value = reserva.table;
  tableInput.readOnly = false;
  title.textContent = reserva.table;
  nameInput.value = reserva.name || "";
  contactInput.value = reserva.contact || "";
  datetimeInput.value = reserva.datetime;
  datetimeInput.min = nowLocalISO();
  if (peopleInput) peopleInput.value = reserva.guests || 2;

  cerrarHistorial();
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  nameInput.focus();
}

function cerrarModalReserva() {
  const modal = document.getElementById("quickReserveModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  editingId = null;
}

function guardarReservaDesdeModal(event) {
  event.preventDefault();

  const nombre = document.getElementById("modalName").value.trim();
  const contacto = document.getElementById("modalContact").value.trim();
  const datetime = document.getElementById("modalDatetime").value;
  const mesa = Number(document.getElementById("modalTable").value);
  const personas = Number(document.getElementById("modalPersonas").value) || null;

  const validacion = validarReserva({
    nombre,
    contacto,
    datetime,
    mesa,
    personas,
    excludeId: editingId,
  });

  if (!validacion.valid) {
    showToast(validacion.message, "error");
    return;
  }

  if (editingId) {
    const idx = reservas.findIndex((r) => r.id === editingId);
    if (idx === -1) {
      showToast("No se encontró la reserva a editar.", "error");
      return;
    }
    reservas[idx] = {
      ...reservas[idx],
      name: nombre,
      contact: contacto,
      datetime,
      table: mesa,
      guests: personas,
      updatedAt: new Date().toISOString(),
    };
  } else {
    reservas.push({
      id: idCorto(),
      name: nombre,
      contact: contacto,
      datetime,
      table: mesa,
      guests: personas,
      status: "reservada",
      createdAt: new Date().toISOString(),
    });
  }

  const huboEdicion = Boolean(editingId);
  guardarReserva(reservas);
  cerrarModalReserva();
  renderReservas();
  showToast(huboEdicion ? "Reserva actualizada ✅" : "Reserva registrada ✅");
}

/* ---------------- Historial de mesa ---------------- */

function abrirHistorial(mesa) {
  const modal = document.getElementById("historyModal");
  const title = document.getElementById("historyMesaTitle");
  if (!modal || !title) return;

  title.textContent = mesa;
  modal.dataset.mesa = mesa;
  renderHistorial(mesa);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function renderHistorial(mesa) {
  const listEl = document.getElementById("historyList");
  if (!listEl) return;

  const historial = reservas
    .filter((r) => Number(r.table) === Number(mesa))
    .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

  if (!historial.length) {
    listEl.innerHTML = '<p class="empty-msg">Esta mesa no tiene reservas registradas.</p>';
    return;
  }

  listEl.innerHTML = historial.map((r) => filaReservaHTML(r)).join("");
}

function cerrarHistorial() {
  const modal = document.getElementById("historyModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

/* ---------------- Fila reutilizable (reporte + historial) ---------------- */

function filaReservaHTML(r) {
  const personas = r.guests ? ` · ${r.guests} pers.` : "";
  const accion =
    r.status === "cancelada"
      ? `<button class="btn Outline small" data-action="reactivar" data-id="${r.id}">Reactivar</button>`
      : `<button class="btn Outline small" data-action="cancelar" data-id="${r.id}">Cancelar</button>`;

  return `
    <div class="report-row">
      <div class="report-info">
        <strong>Mesa ${r.table}</strong> · ${escaparHTML(r.name)}${personas} · ${formatearFechaHora(r.datetime)}
        <span class="badge badge-${r.status}">${r.status}</span>
      </div>
      <div class="report-actions">
        <button class="btn Outline small" data-action="editar" data-id="${r.id}">Editar</button>
        ${accion}
      </div>
    </div>`;
}

async function manejarAccionReserva(id, action) {
  if (action === "editar") {
    const reserva = reservas.find((r) => r.id === id);
    if (reserva) abrirModalEdicion(reserva);
    return;
  }

  const reserva = reservas.find((r) => r.id === id);
  if (!reserva) return;

  if (action === "cancelar") {
    const ok = await confirmDialog(
      `¿Deseas cancelar la reserva de ${reserva.name} para la Mesa ${reserva.table}?`,
    );
    if (!ok) return;
    reserva.status = "cancelada";
    guardarReserva(reservas);
    renderReservas();
    refrescarHistorialSiAbierto(reserva.table);
    showToast("Reserva cancelada ✅");
  } else if (action === "reactivar") {
    if (hayConflictoHorario(reserva.table, reserva.datetime, reserva.id)) {
      showToast("No se puede reactivar: hay otra reserva muy cercana en esa mesa.", "error");
      return;
    }
    reserva.status = "reservada";
    guardarReserva(reservas);
    renderReservas();
    refrescarHistorialSiAbierto(reserva.table);
    showToast("Reserva reactivada ✅");
  }
}

function refrescarHistorialSiAbierto(mesa) {
  const modal = document.getElementById("historyModal");
  if (modal && modal.classList.contains("open") && Number(modal.dataset.mesa) === Number(mesa)) {
    renderHistorial(mesa);
  }
}

/* ---------------- Mesas ---------------- */

function getProximaReserva(mesa) {
  const ahora = Date.now();
  return reservas
    .filter(
      (r) =>
        Number(r.table) === Number(mesa) &&
        new Date(r.datetime).getTime() >= ahora &&
        r.status !== "cancelada",
    )
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))[0];
}

function renderMesas() {
  const cont = document.getElementById("tables");
  if (!cont) return;

  const searchTerm = (document.getElementById("searchTables")?.value || "").trim().toLowerCase();
  const capFilter = document.getElementById("filterCapacity")?.value || "";

  cont.innerHTML = "";

  for (let i = 1; i <= TOTAL_MESAS; i += 1) {
    const capacidad = getCapacidad(i);
    if (capFilter && Number(capFilter) !== capacidad) continue;

    const proxima = getProximaReserva(i);

    const coincideBusqueda =
      !searchTerm ||
      String(i).includes(searchTerm) ||
      (proxima &&
        ((proxima.name || "").toLowerCase().includes(searchTerm) ||
          (proxima.contact || "").toLowerCase().includes(searchTerm)));

    if (!coincideBusqueda) continue;

    const statusText = proxima
      ? `Reservada: ${formatearFechaHora(proxima.datetime)}${proxima.name ? ` · ${escaparHTML(proxima.name)}` : ""}`
      : "Libre";

    const card = document.createElement("div");
    card.className = "tableCard";
    card.innerHTML = `
      <img src="${TABLE_IMAGE}" alt="Mesa ${i}">
      <div class="tableName">Mesa ${i}</div>
      <div class="tableCap">${capacidad} personas</div>
      <div class="tableDesc">${statusText}</div>
      <div class="table-card-actions">
        <button class="btn table-btn ${proxima ? "reserved" : "free"}" data-table="${i}" data-action="toggle">
          ${proxima ? "Liberar" : "Reservar"}
        </button>
        <button class="btn Outline small" data-table="${i}" data-action="historial">Historial</button>
      </div>
    `;
    cont.appendChild(card);
  }

  if (!cont.children.length) {
    cont.innerHTML = '<p class="empty-msg">No hay mesas que coincidan con la búsqueda o el filtro.</p>';
  }
}

/* ---------------- Reporte ---------------- */

function poblarSelectMesas() {
  const select = document.getElementById("filterMesaReport");
  if (!select || select.dataset.poblado) return;
  for (let i = 1; i <= TOTAL_MESAS; i += 1) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `Mesa ${i}`;
    select.appendChild(opt);
  }
  select.dataset.poblado = "true";
}

function obtenerReservasFiltradas(mostrarError = true) {
  const fromDate = document.getElementById("fromDate")?.value;
  const toDate = document.getElementById("toDate")?.value;
  const mesaFiltro = document.getElementById("filterMesaReport")?.value;
  const searchTerm = (document.getElementById("searchReport")?.value || "").trim().toLowerCase();
  const sortOrder = document.getElementById("sortReport")?.value || "date-asc";

  if (fromDate && toDate && fromDate > toDate) {
    if (mostrarError) {
      showToast("La fecha inicial no puede ser posterior a la fecha final.", "error");
    }
    return null;
  }

  let filas = reservas.filter((r) => {
    if (r.status === "cancelada") return false;

    const fechaReserva = r.datetime.slice(0, 10);
    if (fromDate && fechaReserva < fromDate) return false;
    if (toDate && fechaReserva > toDate) return false;
    if (mesaFiltro && Number(r.table) !== Number(mesaFiltro)) return false;
    if (
      searchTerm &&
      !(
        (r.name || "").toLowerCase().includes(searchTerm) ||
        (r.contact || "").toLowerCase().includes(searchTerm) ||
        String(r.table).includes(searchTerm)
      )
    ) {
      return false;
    }
    return true;
  });

  if (sortOrder === "date-desc") {
    filas.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
  } else if (sortOrder === "table") {
    filas.sort((a, b) => Number(a.table) - Number(b.table) || new Date(a.datetime) - new Date(b.datetime));
  } else {
    filas.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  }

  return filas;
}

function calcularEstadisticas(filas) {
  if (!filas.length) return null;

  const conteoMesas = {};
  const conteoFechas = {};

  filas.forEach((r) => {
    conteoMesas[r.table] = (conteoMesas[r.table] || 0) + 1;
    const dia = r.datetime.slice(0, 10);
    conteoFechas[dia] = (conteoFechas[dia] || 0) + 1;
  });

  const mesaTop = Object.entries(conteoMesas).sort((a, b) => b[1] - a[1])[0];
  const diaTop = Object.entries(conteoFechas).sort((a, b) => b[1] - a[1])[0];

  return { total: filas.length, mesaTop, diaTop };
}

function renderStats(filas) {
  const box = document.getElementById("statsBox");
  if (!box) return;

  const stats = calcularEstadisticas(filas);
  if (!stats) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = `
    <div class="stat-card">
      <span class="stat-value">${stats.total}</span>
      <span class="stat-label">Reservas activas</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">Mesa ${stats.mesaTop[0]}</span>
      <span class="stat-label">Mesa más solicitada (${stats.mesaTop[1]})</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${formatearFechaCorta(stats.diaTop[0])}</span>
      <span class="stat-label">Día más ocupado (${stats.diaTop[1]} reservas)</span>
    </div>
  `;
}

function renderPaginacion(totalPaginas) {
  const cont = document.getElementById("reportPagination");
  if (!cont) return;

  if (totalPaginas <= 1) {
    cont.innerHTML = "";
    return;
  }

  cont.innerHTML = `
    <button class="btn Outline small" data-page="prev" ${reportPage <= 1 ? "disabled" : ""}>‹ Anterior</button>
    <span class="page-info">Página ${reportPage} de ${totalPaginas}</span>
    <button class="btn Outline small" data-page="next" ${reportPage >= totalPaginas ? "disabled" : ""}>Siguiente ›</button>
  `;
}

function mostrarReporte() {
  const listEl = document.getElementById("reportList");
  if (!listEl) return;

  const filas = obtenerReservasFiltradas();
  if (filas === null) return;

  renderStats(filas);

  const totalPaginas = Math.max(1, Math.ceil(filas.length / PAGE_SIZE));
  if (reportPage > totalPaginas) reportPage = totalPaginas;
  if (reportPage < 1) reportPage = 1;

  const inicio = (reportPage - 1) * PAGE_SIZE;
  const paginaActual = filas.slice(inicio, inicio + PAGE_SIZE);

  listEl.innerHTML = filas.length
    ? paginaActual.map((r) => filaReservaHTML(r)).join("")
    : '<p class="empty-msg">No hay reservas en el rango o los filtros seleccionados.</p>';

  renderPaginacion(totalPaginas);
}

/* ---------------- CSV ---------------- */

function escaparCSV(valor) {
  const texto = String(valor ?? "");
  if (/[",\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

function construirCSV(filas) {
  const encabezado = ["Mesa", "Nombre", "Contacto", "Personas", "Fecha y hora", "Estado"];
  const lineas = [encabezado.join(",")];

  filas.forEach((r) => {
    lineas.push(
      [
        r.table,
        escaparCSV(r.name),
        escaparCSV(r.contact),
        r.guests || "",
        escaparCSV(formatearFechaHora(r.datetime)),
        r.status,
      ].join(","),
    );
  });

  return lineas.join("\n");
}

function previsualizarCSV() {
  const box = document.getElementById("csvPreviewBox");
  const pre = document.getElementById("csvPreview");
  if (!box || !pre) return;

  const filas = obtenerReservasFiltradas();
  if (filas === null) return;

  box.hidden = false;
  pre.textContent = filas.length
    ? construirCSV(filas)
    : "No hay reservas para exportar en el rango seleccionado.";
}

function cerrarCsvPreview() {
  const box = document.getElementById("csvPreviewBox");
  if (box) box.hidden = true;
}

function exportarCSV() {
  const filas = obtenerReservasFiltradas();
  if (filas === null) return;

  if (!filas.length) {
    showToast("No hay reservas para exportar en el rango seleccionado.", "error");
    return;
  }

  const csv = construirCSV(filas);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const fromDate = document.getElementById("fromDate")?.value || "inicio";
  const toDate = document.getElementById("toDate")?.value || "fin";

  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `reservas_${fromDate}_a_${toDate}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
  showToast("CSV exportado ✅");
}

function imprimirReporte() {
  mostrarReporte();
  window.print();
}

/* ---------------- Formulario principal ---------------- */

function crearReservaDesdeFormulario(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const nombre = document.getElementById("name").value.trim();
  const contacto = document.getElementById("contact").value.trim();
  const datetime = document.getElementById("datetime").value;
  const mesa = Number(document.getElementById("table").value);
  const personas = Number(document.getElementById("people").value) || null;

  const validacion = validarReserva({ nombre, contacto, datetime, mesa, personas });
  if (!validacion.valid) {
    showToast(validacion.message, "error");
    return;
  }

  reservas.push({
    id: idCorto(),
    name: nombre,
    contact: contacto,
    datetime,
    table: mesa,
    guests: personas,
    status: "reservada",
    createdAt: new Date().toISOString(),
  });

  guardarReserva(reservas);
  form.reset();
  document.getElementById("table").value = "1";
  document.getElementById("people").value = "2";
  renderReservas();
  showToast("Reserva guardada correctamente ✅");
}

function limpiarFormulario() {
  const form = document.getElementById("formReservation");
  if (form) form.reset();
  const tableInput = document.getElementById("table");
  if (tableInput) tableInput.value = "1";
  const peopleInput = document.getElementById("people");
  if (peopleInput) peopleInput.value = "2";
}

/* ---------------- Inicialización ---------------- */

function initApp() {
  initTema();
  poblarSelectMesas();

  const datetimeInput = document.getElementById("datetime");
  if (datetimeInput) datetimeInput.min = nowLocalISO();

  const form = document.getElementById("formReservation");
  if (form) form.addEventListener("submit", crearReservaDesdeFormulario);

  const quickForm = document.getElementById("quickReserveForm");
  if (quickForm) quickForm.addEventListener("submit", guardarReservaDesdeModal);

  const closeBtn = document.getElementById("cancelQuickReserve");
  if (closeBtn) closeBtn.addEventListener("click", cerrarModalReserva);

  const modal = document.getElementById("quickReserveModal");
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) cerrarModalReserva();
    });
  }

  const closeHistoryBtn = document.getElementById("closeHistory");
  if (closeHistoryBtn) closeHistoryBtn.addEventListener("click", cerrarHistorial);

  const historyModal = document.getElementById("historyModal");
  if (historyModal) {
    historyModal.addEventListener("click", (event) => {
      if (event.target === historyModal) cerrarHistorial();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      cerrarModalReserva();
      cerrarHistorial();
    }
  });

  const clearBtn = document.getElementById("clearBtn");
  if (clearBtn) clearBtn.addEventListener("click", limpiarFormulario);

  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const actual = document.documentElement.getAttribute("data-theme");
      aplicarTema(actual === "dark" ? "light" : "dark");
    });
  }

  const tablesCont = document.getElementById("tables");
  if (tablesCont) {
    tablesCont.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-table]");
      if (!btn) return;

      const mesa = Number(btn.dataset.table);
      const action = btn.dataset.action;

      if (action === "historial") {
        abrirHistorial(mesa);
        return;
      }

      const proxima = getProximaReserva(mesa);
      if (!proxima) {
        abrirModalReserva(mesa);
        return;
      }

      confirmDialog(
        `¿Deseas liberar la reserva de ${formatearFechaHora(proxima.datetime)} para la Mesa ${mesa}?`,
      ).then((ok) => {
        if (!ok) return;
        reservas = reservas.map((r) => (r.id === proxima.id ? { ...r, status: "cancelada" } : r));
        guardarReserva(reservas);
        renderReservas();
        showToast("Reserva liberada ✅");
      });
    });
  }

  const searchTables = document.getElementById("searchTables");
  if (searchTables) searchTables.addEventListener("input", renderMesas);

  const filterCapacity = document.getElementById("filterCapacity");
  if (filterCapacity) filterCapacity.addEventListener("change", renderMesas);

  const reportList = document.getElementById("reportList");
  if (reportList) {
    reportList.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-action]");
      if (!btn) return;
      manejarAccionReserva(btn.dataset.id, btn.dataset.action);
    });
  }

  const historyList = document.getElementById("historyList");
  if (historyList) {
    historyList.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-action]");
      if (!btn) return;
      manejarAccionReserva(btn.dataset.id, btn.dataset.action);
    });
  }

  const paginationCont = document.getElementById("reportPagination");
  if (paginationCont) {
    paginationCont.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-page]");
      if (!btn) return;
      if (btn.dataset.page === "prev") reportPage -= 1;
      if (btn.dataset.page === "next") reportPage += 1;
      mostrarReporte();
    });
  }

  const showReportBtn = document.getElementById("btnShowReport");
  if (showReportBtn) {
    showReportBtn.addEventListener("click", () => {
      reportPage = 1;
      mostrarReporte();
    });
  }

  const searchReport = document.getElementById("searchReport");
  if (searchReport) {
    searchReport.addEventListener("input", () => {
      reportPage = 1;
      mostrarReporte();
    });
  }

  const filterMesaReport = document.getElementById("filterMesaReport");
  if (filterMesaReport) {
    filterMesaReport.addEventListener("change", () => {
      reportPage = 1;
      mostrarReporte();
    });
  }

  const sortReport = document.getElementById("sortReport");
  if (sortReport) sortReport.addEventListener("change", mostrarReporte);

  const previewCsvBtn = document.getElementById("btnPreviewCsv");
  if (previewCsvBtn) previewCsvBtn.addEventListener("click", previsualizarCSV);

  const exportCsvBtn = document.getElementById("btnExportCsv");
  if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportarCSV);

  const closeCsvBtn = document.getElementById("closeCsvPreview");
  if (closeCsvBtn) closeCsvBtn.addEventListener("click", cerrarCsvPreview);

  const printBtn = document.getElementById("btnPrintReport");
  if (printBtn) printBtn.addEventListener("click", imprimirReporte);

  renderReservas();
}

function renderReservas() {
  renderMesas();
  mostrarReporte();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}