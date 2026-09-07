import { app } from "./app";
import { config } from "./config";

app.listen(config.port);

console.log(`API do Empório disponível em http://localhost:${app.server?.port}`);
