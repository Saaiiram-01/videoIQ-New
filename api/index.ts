import { app, setupMiddleware, setupRoutes } from "../server";

setupMiddleware();
setupRoutes();

export default app;
