import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { conectarDB } from "./db.js";
import ticketsRouter from "./routes/tickets.js";
import agentesRouter from "./routes/agentes.js";
import Ticket from "./models/Ticket.js";
import Agente from "./models/Agente.js";
import { HttpError } from "./utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/tickets", ticketsRouter);
app.use("/api/agentes", agentesRouter);

// Cualquier otra ruta /api/... no existe
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// Middleware de errores: respuestas uniformes { error: "mensaje" }
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  // Violación del índice unique (por ejemplo, correo repetido en agentes)
  if (err.code === 11000) {
    const campo = Object.keys(err.keyValue ?? {})[0];
    const mensaje =
      campo === "email"
        ? "Ya existe un agente registrado con ese correo electrónico"
        : `Ya existe un registro con el mismo valor${campo ? ` en "${campo}"` : ""}`;
    return res.status(400).json({ error: mensaje });
  }
  if (err.name === "ValidationError") {
    const mensaje = Object.values(err.errors).map((e) => e.message).join("; ");
    return res.status(400).json({ error: mensaje });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ error: `Valor inválido para "${err.path}"` });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo de la petición no es un JSON válido" });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 3000;

try {
  await conectarDB(); // primero la base de datos, después el servidor
  await Promise.all([Ticket.init(), Agente.init()]); // asegura que los índices existan
  app.listen(PORT, () => console.log(`Servidor listo en http://localhost:${PORT}`));
} catch (err) {
  console.error("No se pudo iniciar la aplicación:", err.message);
  process.exit(1);
}
