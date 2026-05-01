import crypto from "crypto";
import dotenv from "dotenv";
import express from "express";
import fs from "fs/promises";
import path from "path";
import { createServer as createViteServer } from "vite";

type UserRole = "superadmin" | "admin";

interface AppUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

interface DbData {
  users: AppUser[];
  collections: Record<string, Array<Record<string, any>>>;
  metadata: {
    version: number;
    updatedAt: string;
  };
}

interface AuthRequest extends express.Request {
  user?: AppUser;
}

dotenv.config({ path: path.join(process.cwd(), "backend", ".env") });

const DB_PATH =
  process.env.DB_PATH ?? path.join(process.cwd(), "backend", "db.json");
const PORT = Number(process.env.BACKEND_PORT || process.env.PORT || 3000);

function isAllowedOrigin(origin: string): boolean {
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

const PUBLIC_READ_COLLECTIONS = new Set([
  "settings",
  "site_config",
  "sites",
  "courts",
  "products",
  "news",
  "bookings",
  "site_stats",
]);

const PUBLIC_WRITE_COLLECTIONS = new Set(["bookings", "site_stats"]);

const sessions = new Map<string, string>();

function defaultDb(): DbData {
  return {
    users: [],
    collections: {
      bookings: [],
      categories: [],
      clients: [],
      courts: [],
      fixedExpenses: [],
      inventoryLogs: [],
      news: [],
      openTabs: [],
      paymentMethods: [],
      products: [],
      recurringBookings: [],
      settings: [],
      site_config: [],
      sites: [],
      site_stats: [],
      transactions: [],
    },
    metadata: {
      version: 1,
      updatedAt: new Date().toISOString(),
    },
  };
}

async function ensureDbFile(): Promise<void> {
  try {
    await fs.access(DB_PATH);
  } catch {
    const initial = JSON.stringify(defaultDb(), null, 2);
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, initial, "utf-8");
  }
}

async function readDb(): Promise<DbData> {
  await ensureDbFile();
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    if (!raw.trim()) {
      const reset = defaultDb();
      await writeDb(reset);
      return reset;
    }

    const parsed = JSON.parse(raw) as DbData;
    if (!parsed || typeof parsed !== "object") {
      const reset = defaultDb();
      await writeDb(reset);
      return reset;
    }

    if (!parsed.collections || typeof parsed.collections !== "object") parsed.collections = {};
    if (!Array.isArray(parsed.collections.sites)) parsed.collections.sites = [];
    if (!Array.isArray(parsed.users)) parsed.users = [];
    if (!parsed.metadata) {
      parsed.metadata = { version: 1, updatedAt: new Date().toISOString() };
    }
    return parsed;
  } catch {
    const reset = defaultDb();
    await writeDb(reset);
    return reset;
  }
}

async function writeDb(data: DbData): Promise<void> {
  data.metadata.updatedAt = new Date().toISOString();
  const tempPath = `${DB_PATH}.tmp`;
  const serialized = JSON.stringify(data, null, 2);
  await fs.writeFile(tempPath, serialized, "utf-8");

  // On Windows, antivirus/editor file locks can cause transient EPERM on rename.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await fs.rename(tempPath, DB_PATH);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EPERM" || attempt === 2) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 80 * (attempt + 1)));
    }
  }

  // Fallback for persistent lock issues: overwrite file directly.
  await fs.writeFile(DB_PATH, serialized, "utf-8");
  try {
    await fs.unlink(tempPath);
  } catch {
    // Ignore cleanup failures for temp file.
  }
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function omitPassword(user: AppUser) {
  const { passwordHash, ...rest } = user;
  return rest;
}

function createToken(userId: string): string {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, userId);
  return token;
}

function parseBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const parts = headerValue.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1] || null;
}

async function getUserFromAuthorization(headerValue: string | undefined): Promise<AppUser | null> {
  const token = parseBearerToken(headerValue);
  if (!token) return null;

  const userId = sessions.get(token);
  if (!userId) return null;

  const db = await readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    sessions.delete(token);
    return null;
  }

  return user;
}

async function authMiddleware(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const token = parseBearerToken(req.header("authorization"));
  if (!token) {
    res.status(401).json({ error: "Missing auth token." });
    return;
  }
  const userId = sessions.get(token);
  if (!userId) {
    res.status(401).json({ error: "Invalid or expired session." });
    return;
  }
  const db = await readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    sessions.delete(token);
    res.status(401).json({ error: "User not found for session." });
    return;
  }
  req.user = user;
  next();
}

function superadminOnly(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user || req.user.role !== "superadmin") {
    res.status(403).json({ error: "Superadmin access required." });
    return;
  }
  next();
}

function getCollection(db: DbData, collectionName: string): Array<Record<string, any>> {
  if (!db.collections[collectionName]) db.collections[collectionName] = [];
  return db.collections[collectionName];
}

function parseQueryArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}

function applyFilter(data: Array<Record<string, any>>, field: string, op: string, rawValue: string) {
  const value = rawValue === "true" ? true : rawValue === "false" ? false : (Number.isNaN(Number(rawValue)) ? rawValue : Number(rawValue));
  return data.filter((item) => {
    const current = item[field];
    if (op === "==" || op === "=") return current === value;
    if (op === ">=") return current >= value;
    if (op === "<=") return current <= value;
    if (op === ">") return current > value;
    if (op === "<") return current < value;
    return true;
  });
}

function applyIncrementPayload(base: Record<string, any>, patch: Record<string, any>): Record<string, any> {
  const next = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && (value as any).__op === "increment") {
      const by = Number((value as any).by || 0);
      const prev = Number(next[key] || 0);
      next[key] = prev + by;
      continue;
    }
    next[key] = value;
  }
  return next;
}

function mirrorSiteConfigWrite(db: DbData, doc: Record<string, any>) {
  const sites = getCollection(db, "sites");
  const index = sites.findIndex((d) => d.id === doc.id);
  if (index >= 0) {
    sites[index] = { ...doc };
    return;
  }
  sites.push({ ...doc });
}

function mirrorSiteConfigDelete(db: DbData, id: string) {
  const sites = getCollection(db, "sites");
  db.collections.sites = sites.filter((d) => d.id !== id);
}

async function startServer() {
  const app = express();

  app.use((req, res, next) => {
    const origin = req.header("origin") || "";
    if (origin && isAllowedOrigin(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    }

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  });

  app.use(express.json({ limit: "25mb" }));

  app.get("/api/health", async (_req, res) => {
    const db = await readDb();
    res.json({
      status: "ok",
      message: "ArenaHub API is running",
      users: db.users.length,
      collections: Object.keys(db.collections).length,
    });
  });

  app.get("/api/setup/status", async (_req, res) => {
    const db = await readDb();
    const hasSuperadmin = db.users.some((u) => u.role === "superadmin");
    res.json({ needsSetup: !hasSuperadmin });
  });

  app.post("/api/setup/superadmin", async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      res.status(400).json({ error: "name, email and password are required." });
      return;
    }

    const db = await readDb();
    const hasSuperadmin = db.users.some((u) => u.role === "superadmin");
    if (hasSuperadmin) {
      res.status(409).json({ error: "Setup already completed." });
      return;
    }

    const existsEmail = db.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase());
    if (existsEmail) {
      res.status(409).json({ error: "Email already exists." });
      return;
    }

    const user: AppUser = {
      id: crypto.randomUUID(),
      name: String(name),
      email: String(email).toLowerCase(),
      passwordHash: hashPassword(String(password)),
      role: "superadmin",
      createdAt: new Date().toISOString(),
    };

    db.users.push(user);
    await writeDb(db);

    const token = createToken(user.id);
    res.status(201).json({ user: omitPassword(user), token });
  });

  app.post("/api/setup/restore", async (req, res) => {
    const { backup } = req.body || {};
    if (!backup || typeof backup !== "object") {
      res.status(400).json({ error: "backup payload is required." });
      return;
    }

    const current = await readDb();
    const hasSuperadmin = current.users.some((u) => u.role === "superadmin");
    if (hasSuperadmin) {
      res.status(409).json({ error: "Restore via setup is only available before first superadmin." });
      return;
    }

    const restored = backup as DbData;
    if (!Array.isArray(restored.users) || typeof restored.collections !== "object") {
      res.status(400).json({ error: "Invalid backup format." });
      return;
    }

    await writeDb({
      users: restored.users,
      collections: restored.collections,
      metadata: restored.metadata || { version: 1, updatedAt: new Date().toISOString() },
    });
    sessions.clear();
    res.json({ ok: true });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required." });
      return;
    }
    const db = await readDb();
    const user = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
    if (!user || user.passwordHash !== hashPassword(String(password))) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }
    const token = createToken(user.id);
    res.json({ token, user: omitPassword(user) });
  });

  app.post("/api/auth/register", async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      res.status(400).json({ error: "name, email and password are required." });
      return;
    }
    const db = await readDb();
    const hasSuperadmin = db.users.some((u) => u.role === "superadmin");
    if (!hasSuperadmin) {
      res.status(409).json({ error: "Complete setup first." });
      return;
    }
    const existsEmail = db.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase());
    if (existsEmail) {
      res.status(409).json({ error: "Email already exists." });
      return;
    }
    const newUser: AppUser = {
      id: crypto.randomUUID(),
      name: String(name),
      email: String(email).toLowerCase(),
      passwordHash: hashPassword(String(password)),
      role: "admin",
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    await writeDb(db);
    const token = createToken(newUser.id);
    res.status(201).json({ token, user: omitPassword(newUser) });
  });

  app.get("/api/auth/me", async (req, res) => {
    const user = await getUserFromAuthorization(req.header("authorization"));
    if (!user) {
      res.json({ user: null });
      return;
    }
    res.json({ user: omitPassword(user) });
  });

  app.post("/api/auth/logout", authMiddleware, async (req, res) => {
    const token = parseBearerToken(req.header("authorization"));
    if (token) sessions.delete(token);
    res.json({ ok: true });
  });

  app.get("/api/users", authMiddleware, superadminOnly, async (_req, res) => {
    const db = await readDb();
    res.json({ users: db.users.map(omitPassword) });
  });

  app.post("/api/users", authMiddleware, superadminOnly, async (req, res) => {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) {
      res.status(400).json({ error: "name, email and password are required." });
      return;
    }
    const db = await readDb();
    const existsEmail = db.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase());
    if (existsEmail) {
      res.status(409).json({ error: "Email already exists." });
      return;
    }
    const newUser: AppUser = {
      id: crypto.randomUUID(),
      name: String(name),
      email: String(email).toLowerCase(),
      passwordHash: hashPassword(String(password)),
      role: role === "superadmin" ? "superadmin" : "admin",
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    await writeDb(db);
    res.status(201).json({ user: omitPassword(newUser) });
  });

  app.delete("/api/users/:id", authMiddleware, superadminOnly, async (req: AuthRequest, res) => {
    const db = await readDb();
    const id = req.params.id;
    const target = db.users.find((u) => u.id === id);
    if (!target) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    if (target.id === req.user!.id) {
      res.status(400).json({ error: "Cannot delete your own user." });
      return;
    }
    db.users = db.users.filter((u) => u.id !== id);
    await writeDb(db);
    res.json({ ok: true });
  });

  app.get("/api/backup", authMiddleware, superadminOnly, async (_req, res) => {
    const db = await readDb();
    res.json({ backup: db });
  });

  app.post("/api/backup/restore", authMiddleware, superadminOnly, async (req, res) => {
    const { backup } = req.body || {};
    if (!backup || typeof backup !== "object") {
      res.status(400).json({ error: "backup payload is required." });
      return;
    }
    const restored = backup as DbData;
    if (!Array.isArray(restored.users) || typeof restored.collections !== "object") {
      res.status(400).json({ error: "Invalid backup format." });
      return;
    }
    await writeDb({
      users: restored.users,
      collections: restored.collections,
      metadata: restored.metadata || { version: 1, updatedAt: new Date().toISOString() },
    });
    sessions.clear();
    res.json({ ok: true });
  });

  app.post("/api/system/reset", authMiddleware, superadminOnly, async (_req, res) => {
    await writeDb(defaultDb());
    sessions.clear();
    res.json({ ok: true });
  });

  app.get("/api/collections/:name", async (req: AuthRequest, res) => {
    const collectionName = req.params.name;
    const token = parseBearerToken(req.header("authorization"));
    const hasSession = token ? sessions.has(token) : false;
    if (!hasSession && !PUBLIC_READ_COLLECTIONS.has(collectionName)) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    const db = await readDb();
    let docs = [...getCollection(db, collectionName)];

    const whereFields = parseQueryArray(req.query.whereField);
    const whereOps = parseQueryArray(req.query.whereOp);
    const whereValues = parseQueryArray(req.query.whereValue);
    for (let i = 0; i < whereFields.length; i += 1) {
      const field = whereFields[i];
      const op = whereOps[i] || "==";
      const value = whereValues[i] || "";
      docs = applyFilter(docs, field, op, value);
    }

    const orderByField = typeof req.query.orderBy === "string" ? req.query.orderBy : "";
    const orderDir = req.query.orderDir === "desc" ? "desc" : "asc";
    if (orderByField) {
      docs.sort((a, b) => {
        const aa = a[orderByField];
        const bb = b[orderByField];
        if (aa === bb) return 0;
        if (aa > bb) return orderDir === "asc" ? 1 : -1;
        return orderDir === "asc" ? -1 : 1;
      });
    }

    const limitValue = Number(req.query.limit || 0);
    if (!Number.isNaN(limitValue) && limitValue > 0) {
      docs = docs.slice(0, limitValue);
    }

    res.json({ docs });
  });

  app.get("/api/collections/:name/:id", async (req: AuthRequest, res) => {
    const collectionName = req.params.name;
    const token = parseBearerToken(req.header("authorization"));
    const hasSession = token ? sessions.has(token) : false;
    if (!hasSession && !PUBLIC_READ_COLLECTIONS.has(collectionName)) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    const db = await readDb();
    const docs = getCollection(db, collectionName);
    const found = docs.find((d) => d.id === req.params.id);
    if (!found) {
      res.json({ doc: null });
      return;
    }
    res.json({ doc: found });
  });

  app.post("/api/collections/:name", async (req: AuthRequest, res) => {
    const collectionName = req.params.name;
    const token = parseBearerToken(req.header("authorization"));
    const userId = token ? sessions.get(token) : null;
    if (!userId && !PUBLIC_WRITE_COLLECTIONS.has(collectionName)) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    const db = await readDb();
    const docs = getCollection(db, collectionName);
    const payload = req.body || {};
    const newDoc = { ...payload, id: crypto.randomUUID() };
    docs.push(newDoc);

    if (collectionName === "site_config") {
      mirrorSiteConfigWrite(db, newDoc);
    }

    await writeDb(db);
    res.status(201).json({ doc: newDoc });
  });

  app.put("/api/collections/:name/:id", authMiddleware, async (req: AuthRequest, res) => {
    const db = await readDb();
    const collectionName = req.params.name;
    const docs = getCollection(db, collectionName);
    const index = docs.findIndex((d) => d.id === req.params.id);
    const body = req.body || {};
    if (index < 0) {
      const created = { ...(body.data || body), id: req.params.id };
      docs.push(created);

      if (collectionName === "site_config") {
        mirrorSiteConfigWrite(db, created);
      }

      await writeDb(db);
      res.status(201).json({ doc: created });
      return;
    }

    const merge = Boolean(body.merge);
    const payload = body.data || body;
    docs[index] = merge ? applyIncrementPayload(docs[index], payload) : { ...payload, id: req.params.id };

    if (collectionName === "site_config") {
      mirrorSiteConfigWrite(db, docs[index]);
    }

    await writeDb(db);
    res.json({ doc: docs[index] });
  });

  app.patch("/api/collections/:name/:id", authMiddleware, async (req: AuthRequest, res) => {
    const db = await readDb();
    const collectionName = req.params.name;
    const docs = getCollection(db, collectionName);
    const index = docs.findIndex((d) => d.id === req.params.id);
    if (index < 0) {
      res.status(404).json({ error: "Document not found." });
      return;
    }
    docs[index] = applyIncrementPayload(docs[index], req.body || {});

    if (collectionName === "site_config") {
      mirrorSiteConfigWrite(db, docs[index]);
    }

    await writeDb(db);
    res.json({ doc: docs[index] });
  });

  app.delete("/api/collections/:name/:id", authMiddleware, async (req: AuthRequest, res) => {
    const db = await readDb();
    const collectionName = req.params.name;
    const docs = getCollection(db, collectionName);
    const before = docs.length;
    db.collections[collectionName] = docs.filter((d) => d.id !== req.params.id);
    if (db.collections[collectionName].length === before) {
      res.status(404).json({ error: "Document not found." });
      return;
    }

    if (collectionName === "site_config") {
      mirrorSiteConfigDelete(db, req.params.id);
    }

    await writeDb(db);
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();