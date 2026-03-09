import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

export function setupWebSockets(app: any, activities: any[]) {
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: any, socket: any, head: any) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    if (url.pathname === '/ws-api') {
      wss.handleUpgrade(request, socket, head, (ws: any) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on("connection", (ws: any) => {
    console.log("New client connected");
    ws.send(JSON.stringify({ type: "INIT_ACTIVITIES", data: activities }));

    ws.on("message", (message: any) => {
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
          if (activities.length > 50) activities.pop();

          const broadcastData = JSON.stringify({ type: "ACTIVITY_UPDATE", data: activity });
          wss.clients.forEach((client: any) => {
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

  return server;
}
