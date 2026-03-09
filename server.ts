import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieSession from "cookie-session";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSION_SECRET = process.env.SESSION_SECRET || "videoiq-secret-session-key";

export const app = express();

// Store recent activities in memory
const activities: any[] = [];

export function setupMiddleware() {
  // Prevent duplicate middleware if called multiple times in serverless
  if ((app as any)._middlewareSetup) return;
  
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(
    cookieSession({
      name: "session",
      keys: [SESSION_SECRET],
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: false, // Set to false for now to rule out SSL/Proxy issues
      sameSite: "lax",
    })
  );
  (app as any)._middlewareSetup = true;
}

export function setupRoutes() {
  // Prevent duplicate routes
  if ((app as any)._routesSetup) return;

  // Auth Routes
  app.get("/api/test", (req, res) => {
    res.json({ message: "API is working", env: process.env.NODE_ENV });
  });

  app.post("/api/auth/login", (req, res) => {
    const { name, password } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    // Admin validation
    if (name === "Admin") {
      const adminPass = process.env.ADMIN_PASSWORD || "admin123";
      if (password !== adminPass) {
        return res.status(401).json({ error: "Invalid admin access key" });
      }
    }
    
    if (req.session) {
      req.session.user = {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name: name,
        picture: null,
        role: name === "Admin" ? "admin" : "auditor"
      };
    }
    res.json({ user: req.session?.user });
  });

  app.get("/api/auth/me", (req, res) => {
    res.json({ user: req.session?.user || null });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session = null;
    res.json({ success: true });
  });

  (app as any)._routesSetup = true;
}

export function setupWebSockets() {
  // WebSocket logic is now in websocket.ts and only loaded when needed
}

async function startServer() {
  const PORT = 3000;

  setupMiddleware();
  setupRoutes();

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const { setupWebSockets: realSetupWebSockets } = await import("./websocket.js");
  const server = realSetupWebSockets(app, activities);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// Only start the server if this file is run directly and NOT on Vercel
if (process.env.NODE_ENV !== "production" || (!process.env.VERCEL && !process.env.NOW_REGION)) {
  startServer();
}

export default app;
