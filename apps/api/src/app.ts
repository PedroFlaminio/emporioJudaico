import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { config, corsOrigins } from "./config";
import { apiRoutes } from "./routes";

export const app = new Elysia()
  .use(cors({ origin: corsOrigins, allowedHeaders: ["Content-Type", "Authorization"] }))
  .use(apiRoutes)
  .onError(({ code, error, set }) => {
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { message: "Rota não encontrada." };
    }
    console.error(error);
    set.status = 500;
    return { message: "Erro interno do servidor." };
  });

export type App = typeof app;
