import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Store recent activities in memory
const activities: any[] = [];

export function setupMiddleware() {
  // Prevent duplicate middleware if called multiple times in serverless
  if ((app as any)._middlewareSetup) return;
  
  app.set("trust proxy", 1);
  app.use(express.json());
  (app as any)._middlewareSetup = true;
}

export function setupRoutes() {
  // Prevent duplicate routes
  if ((app as any)._routesSetup) return;

  app.get("/api/test", (req, res) => {
    res.json({ message: "API is working", env: process.env.NODE_ENV });
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
