# Trionix Tickets – Sistema de soporte con agentes

## Ejecutar localmente

Requisitos: Node.js 18 o superior y MongoDB 
npm install express joi mongoose dotenv
cp .env.example .env      # y edita MONGODB_URI
npm run seed              # opcional: carga datos de prueba (borra los datos existentes)
npm start                 # http://localhost:3000

## URL
https://trionix-agentes.onrender.com

## Variables de entorno
                                       
 PORT        Puerto del servidor (por defecto 3000)                  
 MONGODB_URI  Cadena de conexión de MongoDB (local o Atlas)           

## Endpoints principales

- Tickets: `GET/POST /api/tickets`, `GET/PUT/DELETE /api/tickets/:id`, `POST /api/tickets/:id/comentarios`, `POST /api/tickets/:id/asignar`
- Agentes: `GET/POST /api/agentes`, `GET/PUT/DELETE /api/agentes/:id`, `GET /api/agentes/:id/tickets`

## Bonus implementados

- **21.** `GET /api/agentes/stats`: tickets abiertos y resueltos por agente, con agregación `$lookup`.
- **22.** `GET /api/tickets?q=texto`: búsqueda con `$regex` (sin distinguir mayúsculas) en asunto y cliente.
- **23.** Índice compuesto `{ agenteId: 1, estado: 1 }` en tickets. Sirve para las consultas que filtran por
  agente (listar sus tickets, `GET /api/agentes/:id/tickets`) y para comprobar si un agente tiene tickets
  abiertos antes de eliminarlo (respuesta 409).
