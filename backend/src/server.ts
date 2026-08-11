import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { readFarmState, writeFarmState } from "./db.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = process.env.PUBLIC_DIR || join(currentDirectory, "..", "public");
const localDevelopmentOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3002",
  "http://127.0.0.1:3002",
].join(",");
const allowedOrigins = (process.env.CORS_ORIGINS || localDevelopmentOrigins)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origen no permitido."));
  },
  methods: ["GET", "POST", "PUT", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json({ limit: "5mb" }));

function matchesSecret(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/auth/owner", (request, response) => {
  const username = typeof request.body?.username === "string" ? request.body.username : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  const development = process.env.NODE_ENV !== "production";
  const ownerUsername = process.env.OWNER_USERNAME || (development ? "owner" : "");
  const ownerPassword = process.env.OWNER_PASSWORD || (development ? "brianna2026" : "");

  if (!ownerUsername || !ownerPassword) {
    return response.status(503).json({ error: "Las credenciales del propietario no han sido configuradas." });
  }
  if (!matchesSecret(username, ownerUsername) || !matchesSecret(password, ownerPassword)) {
    return response.status(401).json({ error: "Usuario o contraseña incorrectos." });
  }
  return response.json({ ok: true });
});

app.get("/api/farm-state", async (_request, response) => {
  try {
    response.json({ state: await readFarmState() });
  } catch (error) {
    response.status(503).json({ error: error instanceof Error ? error.message : "No fue posible leer los datos de la granja." });
  }
});

app.put("/api/farm-state", async (request, response) => {
  const state = request.body?.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return response.status(400).json({ error: "Falta la información de la granja." });
  }
  try {
    await writeFarmState(state as Record<string, unknown>);
    return response.json({ ok: true });
  } catch (error) {
    return response.status(503).json({ error: error instanceof Error ? error.message : "No fue posible guardar los datos de la granja." });
  }
});

app.use(express.static(publicDirectory, { index: "index.html", maxAge: "1h" }));
app.get("*", (_request, response) => {
  response.sendFile(join(publicDirectory, "index.html"));
});

app.listen(port, () => {
  console.log(`Brianna Eggs activa en http://localhost:${port}`);
});
