// Utilidades compartidas por las rutas: errores HTTP, validación con Joi y formato de respuesta.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Envuelve handlers async para que cualquier error llegue al middleware de errores.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Mensajes de Joi en español.
const mensajes = {
  "any.required": "{{#label}} es obligatorio",
  "any.only": "{{#label}} debe ser uno de: {{#valids}}",
  "string.base": "{{#label}} debe ser texto",
  "string.empty": "{{#label}} no puede estar vacío",
  "string.min": "{{#label}} debe tener al menos {{#limit}} caracteres",
  "string.max": "{{#label}} no puede superar los {{#limit}} caracteres",
  "string.email": "{{#label}} debe ser un correo electrónico válido",
  "boolean.base": "{{#label}} debe ser verdadero o falso",
  "object.min": "Debes enviar al menos un campo para actualizar",
};

// Valida con Joi. Devuelve los datos limpios (campos desconocidos eliminados) o lanza 400.
export function validar(schema, data) {
  const { error, value } = schema.validate(data ?? {}, {
    abortEarly: false,
    stripUnknown: true,
    messages: mensajes,
  });
  if (error) {
    throw new HttpError(400, error.details.map((d) => d.message).join("; "));
  }
  return value;
}

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export function validarId(id, nombre = "id") {
  if (!OBJECT_ID.test(String(id))) {
    throw new HttpError(400, `El ${nombre} "${id}" no tiene formato de ObjectId válido`);
  }
}

// Campos del agente que se devuelven dentro de un ticket.
export const POPULATE_AGENTE = ["agenteId", "nombre especialidad"];

// Convierte el ticket populado: agenteId -> agente (objeto o null).
export function formatearTicket(ticket) {
  const { agenteId, ...resto } = ticket.toObject();
  return { ...resto, agente: agenteId && agenteId.nombre ? agenteId : null };
}
