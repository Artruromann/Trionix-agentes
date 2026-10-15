import { Router } from "express";
import Joi from "joi";
import Ticket from "../models/Ticket.js";
import Agente from "../models/Agente.js";
import {
  HttpError,
  asyncHandler,
  validar,
  validarId,
  formatearTicket,
  POPULATE_AGENTE,
} from "../utils.js";

const router = Router();

const PRIORIDADES = ["baja", "media", "alta"];
const ESTADOS = ["abierto", "resuelto"];

// "estado" y "agenteId" no se aceptan al crear: stripUnknown los descarta
// y el ticket siempre nace "abierto" y sin agente.
const crearSchema = Joi.object({
  cliente: Joi.string().trim().min(2).max(100).required(),
  asunto: Joi.string().trim().min(5).max(200).required(),
  prioridad: Joi.string().valid(...PRIORIDADES).required(),
});

const actualizarSchema = Joi.object({
  cliente: Joi.string().trim().min(2).max(100),
  asunto: Joi.string().trim().min(5).max(200),
  prioridad: Joi.string().valid(...PRIORIDADES),
  estado: Joi.string().valid(...ESTADOS),
}).min(1);

const comentarioSchema = Joi.object({
  autor: Joi.string().trim().min(2).max(100).required(),
  texto: Joi.string().trim().min(3).max(1000).required(),
});

const asignarSchema = Joi.object({
  agenteId: Joi.string().trim().required(),
});

const filtrosSchema = Joi.object({
  estado: Joi.string().valid(...ESTADOS),
  prioridad: Joi.string().valid(...PRIORIDADES),
  q: Joi.string().trim().max(100),
});

const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// 1. Listar (filtros opcionales ?estado= ?prioridad= y bonus ?q=)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { estado, prioridad, q } = validar(filtrosSchema, { ...req.query });
    const filtro = {};
    if (estado) filtro.estado = estado;
    if (prioridad) filtro.prioridad = prioridad;
    if (q) {
      const rx = { $regex: escaparRegex(q), $options: "i" };
      filtro.$or = [{ asunto: rx }, { cliente: rx }];
    }
    const tickets = await Ticket.find(filtro)
      .sort({ createdAt: -1 })
      .populate(...POPULATE_AGENTE);
    res.json(tickets.map(formatearTicket));
  })
);

// 2. Obtener uno
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    validarId(req.params.id, "id del ticket");
    const ticket = await Ticket.findById(req.params.id).populate(...POPULATE_AGENTE);
    if (!ticket) throw new HttpError(404, "Ticket no encontrado");
    res.json(formatearTicket(ticket));
  })
);

// 3. Crear
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const datos = validar(crearSchema, req.body);
    const ticket = await Ticket.create({ ...datos, estado: "abierto" });
    res.status(201).json(formatearTicket(ticket));
  })
);

// 4. Actualizar
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    validarId(req.params.id, "id del ticket");
    const datos = validar(actualizarSchema, req.body);
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, datos, {
      new: true,
      runValidators: true,
    }).populate(...POPULATE_AGENTE);
    if (!ticket) throw new HttpError(404, "Ticket no encontrado");
    res.json(formatearTicket(ticket));
  })
);

// 5. Eliminar
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    validarId(req.params.id, "id del ticket");
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) throw new HttpError(404, "Ticket no encontrado");
    res.status(204).end();
  })
);

// 6. Agregar comentario embebido
router.post(
  "/:id/comentarios",
  asyncHandler(async (req, res) => {
    validarId(req.params.id, "id del ticket");
    const comentario = validar(comentarioSchema, req.body);
    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { $push: { comentarios: comentario } },
      { new: true, runValidators: true }
    ).populate(...POPULATE_AGENTE);
    if (!ticket) throw new HttpError(404, "Ticket no encontrado");
    res.status(201).json(formatearTicket(ticket));
  })
);

// 12. Asignar un agente a un ticket
router.post(
  "/:id/asignar",
  asyncHandler(async (req, res) => {
    validarId(req.params.id, "id del ticket");
    const { agenteId } = validar(asignarSchema, req.body);
    validarId(agenteId, "agenteId");

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) throw new HttpError(404, "Ticket no encontrado");

    const agente = await Agente.findById(agenteId);
    if (!agente) throw new HttpError(404, "El agente indicado no existe");
    if (!agente.activo) {
      throw new HttpError(400, `El agente "${agente.nombre}" está inactivo y no puede recibir tickets`);
    }

    ticket.agenteId = agente._id;
    await ticket.save();
    await ticket.populate(...POPULATE_AGENTE);
    res.json(formatearTicket(ticket));
  })
);

export default router;
