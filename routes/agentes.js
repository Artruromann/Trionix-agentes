import { Router } from "express";
import Joi from "joi";
import Agente from "../models/Agente.js";
import Ticket from "../models/Ticket.js";
import {
  HttpError,
  asyncHandler,
  validar,
  validarId,
  formatearTicket,
  POPULATE_AGENTE,
} from "../utils.js";

const router = Router();

const ESPECIALIDADES = ["redes", "software", "hardware", "general"];

const crearSchema = Joi.object({
  nombre: Joi.string().trim().min(3).max(100).required(),
  email: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  especialidad: Joi.string().valid(...ESPECIALIDADES).required(),
  activo: Joi.boolean(),
});

const actualizarSchema = Joi.object({
  nombre: Joi.string().trim().min(3).max(100),
  email: Joi.string().trim().email({ tlds: { allow: false } }),
  especialidad: Joi.string().valid(...ESPECIALIDADES),
  activo: Joi.boolean(),
}).min(1);

const filtrosSchema = Joi.object({
  especialidad: Joi.string().valid(...ESPECIALIDADES),
  activo: Joi.boolean(),
});

// 7. Listar (filtros opcionales ?especialidad= ?activo=)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filtro = validar(filtrosSchema, { ...req.query });
    const agentes = await Agente.find(filtro).sort({ nombre: 1 });
    res.json(agentes);
  })
);

// Bonus 21: estadísticas por agente. Va ANTES de "/:id" para que "stats" no se tome como id.
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const stats = await Agente.aggregate([
      { $lookup: { from: "tickets", localField: "_id", foreignField: "agenteId", as: "tickets" } },
      {
        $project: {
          nombre: 1,
          especialidad: 1,
          activo: 1,
          abiertos: {
            $size: { $filter: { input: "$tickets", cond: { $eq: ["$$this.estado", "abierto"] } } },
          },
          resueltos: {
            $size: { $filter: { input: "$tickets", cond: { $eq: ["$$this.estado", "resuelto"] } } },
          },
        },
      },
      { $sort: { nombre: 1 } },
    ]);
    res.json(stats);
  })
);

// 8. Obtener uno
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    validarId(req.params.id, "id del agente");
    const agente = await Agente.findById(req.params.id);
    if (!agente) throw new HttpError(404, "Agente no encontrado");
    res.json(agente);
  })
);

// 9. Crear (el correo duplicado lo traduce el middleware de errores: code 11000 -> 400)
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const datos = validar(crearSchema, req.body);
    const agente = await Agente.create(datos);
    res.status(201).json(agente);
  })
);

// 10. Actualizar
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    validarId(req.params.id, "id del agente");
    const datos = validar(actualizarSchema, req.body);
    const agente = await Agente.findByIdAndUpdate(req.params.id, datos, {
      new: true,
      runValidators: true,
    });
    if (!agente) throw new HttpError(404, "Agente no encontrado");
    res.json(agente);
  })
);

// 11. Eliminar solo si no tiene tickets abiertos asignados
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    validarId(req.params.id, "id del agente");
    const agente = await Agente.findById(req.params.id);
    if (!agente) throw new HttpError(404, "Agente no encontrado");

    const abiertos = await Ticket.countDocuments({ agenteId: agente._id, estado: "abierto" });
    if (abiertos > 0) {
      throw new HttpError(
        409,
        `No se puede eliminar a "${agente.nombre}": tiene ${abiertos} ticket(s) abierto(s) asignado(s). Reasígnalos o resuélvelos primero.`
      );
    }

    await agente.deleteOne();
    // Los tickets resueltos que tenía quedan sin agente, para no dejar referencias huérfanas.
    await Ticket.updateMany({ agenteId: agente._id }, { agenteId: null });
    res.status(204).end();
  })
);

// 14. Tickets asignados a un agente
router.get(
  "/:id/tickets",
  asyncHandler(async (req, res) => {
    validarId(req.params.id, "id del agente");
    const agente = await Agente.findById(req.params.id);
    if (!agente) throw new HttpError(404, "Agente no encontrado");
    const tickets = await Ticket.find({ agenteId: agente._id })
      .sort({ createdAt: -1 })
      .populate(...POPULATE_AGENTE);
    res.json(tickets.map(formatearTicket));
  })
);

export default router;
