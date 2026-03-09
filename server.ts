import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cookieSession from "cookie-session";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSION_SECRET = process.env.SESSION_SECRET || "videoiq-secret-session-key";

export const app = express();
let server: any = null;
let wss: any = null;

// Store recent activities in memory
const activities: any[] = [];

export function setupMiddleware() {
  // Prevent duplicate middleware if called multiple times in serverless
  if ((app as any)._middlewareSetup) return;
  
  app.use(express.json());
  app.use(
    cookieSession({
      name: "session",
      keys: [SESSION_SECRET],
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: true,
      sameSite: "none",
    })
  );
  (app as any)._middlewareSetup = true;
}

export function setupRoutes() {
  // Prevent duplicate routes
  if ((app as any)._routesSetup) return;

  // Auth Routes
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
  if (!server) server = createServer(app);
  if (!wss) wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: any, socket: any, head: any) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    if (url.pathname === '/ws-api') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on("connection", (ws) => {
    console.log("New client connected");
    
    // Send existing activities to new client
    ws.send(JSON.stringify({ type: "INIT_ACTIVITIES", data: activities }));

    ws.on("message", (message) => {
      try {
        const payload = JSON.parse(message.toString());
        
        if (payload.type === "NEW_ANALYSIS") {
          const activity = {
            id: Date.now(),
            user: payload.user || "Anonymous",
            score: payload.score,
            context: payload.context,
            verdict: payload.verdict,
            timestamp: new Date().toISOString(),
          };
          
          activities.unshift(activity);
          if (activities.length > 50) activities.pop(); // Keep last 50

          // Broadcast to all clients
          const broadcastData = JSON.stringify({ type: "ACTIVITY_UPDATE", data: activity });
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(broadcastData);
            }
          });
        }
      } catch (err) {
        console.error("Error processing message:", err);
      }
    });
  });
}

async function startServer() {
  const PORT = 3000;

  setupMiddleware();
  setupRoutes();
  setupWebSockets();

  if (process.env.NODE_ENV !== "production") {
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

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// Only start the server if this file is run directly and NOT on Vercel
if (process.env.NODE_ENV !== "production" || (!process.env.VERCEL && !process.env.NOW_REGION)) {
  startServer();
}

export default app;
