// Frontend: consume la API con fetch, sin recargar la página.
const $ = (selector) => document.querySelector(selector);

// Escapa texto antes de insertarlo como HTML.
const esc = (texto) =>
  String(texto ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const iniciales = (nombre) =>
  String(nombre ?? "").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

let agentes = [];
let temporizador;

function aviso(texto, tipo = "error") {
  const caja = $("#mensaje");
  caja.textContent = texto;
  caja.className = tipo;
  caja.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => (caja.hidden = true), 6000);
}

// Llama a la API y lanza un Error con el mensaje legible si algo falla (400, 404, 409...).
async function api(ruta, opciones = {}) {
  let res;
  try {
    res = await fetch("/api" + ruta, {
      headers: { "Content-Type": "application/json" },
      ...opciones,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Verifica que esté en ejecución.");
  }
  if (res.status === 204) return null;
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error || `Error ${res.status}`);
  return datos;
}

// Ejecuta una acción mostrando cualquier error en el aviso de la página.
async function intentar(accion) {
  try {
    await accion();
  } catch (err) {
    aviso(err.message);
  }
}

async function cargarAgentes() {
  agentes = await api("/agentes");
  renderAgentes();
}

async function cargarTickets() {
  const params = new URLSearchParams();
  if ($("#filtro-estado").value) params.set("estado", $("#filtro-estado").value);
  if ($("#filtro-prioridad").value) params.set("prioridad", $("#filtro-prioridad").value);
  const hayFiltros = params.toString() !== "";

  const todos = await api("/tickets");
  const tickets = hayFiltros ? await api(`/tickets?${params}`) : todos;

  // Contadores de la cabecera (siempre sobre el total, aunque haya filtros)
  $("#n-abiertos").textContent = todos.filter((t) => t.estado === "abierto").length;
  $("#n-resueltos").textContent = todos.filter((t) => t.estado === "resuelto").length;
  $("#n-alta").textContent = todos.filter((t) => t.estado === "abierto" && t.prioridad === "alta").length;

  renderTickets(tickets);
}

async function cargarTodo() {
  await cargarAgentes();
  await cargarTickets();
}

function renderAgentes() {
  $("#agentes").innerHTML = agentes.length
    ? agentes
        .map(
          (a) => `<li data-id="${a._id}">
            <span class="avatar ${a.activo ? "" : "inactivo"}">${esc(iniciales(a.nombre))}</span>
            <div class="datos">
              <strong>${esc(a.nombre)}</strong>
              <small>${esc(a.especialidad)} · ${esc(a.email)}${a.activo ? "" : " · inactivo"}</small>
            </div>
            <button class="peligro" data-accion="eliminar-agente">Eliminar</button>
          </li>`
        )
        .join("")
    : `<li class="vacio">Aún no hay agentes. Crea el primero.</li>`;
}

function tarjetaTicket(t) {
  const opciones = agentes
    .filter((a) => a.activo)
    .map(
      (a) =>
        `<option value="${a._id}" ${t.agente && t.agente._id === a._id ? "selected" : ""}>${esc(a.nombre)} (${esc(a.especialidad)})</option>`
    )
    .join("");

  return `<article class="ticket p-${t.prioridad} ${t.estado}" data-id="${t._id}">
    <div class="ticket-top">
      <strong>${esc(t.cliente)}</strong>
      <span class="etiqueta ${t.prioridad}">${esc(t.prioridad)}</span>
      <span class="etiqueta ${t.estado}">${esc(t.estado)}</span>
    </div>
    <p class="asunto">${esc(t.asunto)}</p>
    <div class="asignado">${
      t.agente
        ? `<span class="avatar">${esc(iniciales(t.agente.nombre))}</span><span>Atiende <strong>${esc(t.agente.nombre)}</strong> (${esc(t.agente.especialidad)})</span>`
        : `<span class="avatar vacio">?</span><span>Sin asignar</span>`
    }</div>
    <div class="acciones">
      <select class="sel-agente" aria-label="Agente a asignar">
        <option value="">Elegir agente</option>${opciones}
      </select>
      <button data-accion="asignar">Asignar</button>
      ${t.estado === "abierto" ? `<button data-accion="resolver">Marcar resuelto</button>` : ""}
      <button class="peligro" data-accion="eliminar-ticket">Eliminar</button>
    </div>
  </article>`;
}

function renderTickets(tickets) {
  $("#tickets").innerHTML = tickets.length
    ? tickets.map(tarjetaTicket).join("")
    : `<p class="vacio">No hay tickets que coincidan.</p>`;
}

// Acciones sobre tickets (delegación de eventos)
$("#tickets").addEventListener("click", (e) => {
  const boton = e.target.closest("button[data-accion]");
  if (!boton) return;
  const tarjeta = boton.closest(".ticket");
  const id = tarjeta.dataset.id;

  intentar(async () => {
    switch (boton.dataset.accion) {
      case "asignar": {
        const agenteId = tarjeta.querySelector(".sel-agente").value;
        if (!agenteId) return aviso("Elige un agente antes de asignar.");
        const t = await api(`/tickets/${id}/asignar`, { method: "POST", body: JSON.stringify({ agenteId }) });
        aviso(`Ticket asignado a ${t.agente.nombre}.`, "ok");
        break;
      }
      case "resolver":
        await api(`/tickets/${id}`, { method: "PUT", body: JSON.stringify({ estado: "resuelto" }) });
        aviso("Ticket marcado como resuelto.", "ok");
        break;
      case "eliminar-ticket":
        if (!confirm("¿Eliminar este ticket? Esta acción no se puede deshacer.")) return;
        await api(`/tickets/${id}`, { method: "DELETE" });
        aviso("Ticket eliminado.", "ok");
        break;
    }
    await cargarTickets();
  });
});

// Eliminar agente (puede responder 409 si tiene tickets abiertos)
$("#agentes").addEventListener("click", (e) => {
  const boton = e.target.closest("button[data-accion='eliminar-agente']");
  if (!boton) return;
  const id = boton.closest("li").dataset.id;
  if (!confirm("¿Eliminar este agente?")) return;
  intentar(async () => {
    await api(`/agentes/${id}`, { method: "DELETE" });
    aviso("Agente eliminado.", "ok");
    await cargarTodo();
  });
});

// Crear ticket
$("#form-ticket").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  intentar(async () => {
    await api("/tickets", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset();
    aviso("Ticket creado.", "ok");
    await cargarTickets();
  });
});

// Crear agente (si el correo ya existe, la API responde 400 con un mensaje legible)
$("#form-agente").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  intentar(async () => {
    await api("/agentes", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset();
    aviso("Agente creado.", "ok");
    await cargarTodo();
  });
});

$("#filtro-estado").addEventListener("change", () => intentar(cargarTickets));
$("#filtro-prioridad").addEventListener("change", () => intentar(cargarTickets));

intentar(cargarTodo);
