// Process entry point. Importing ./lib/config (transitively) validates env and
// fails fast on misconfiguration before the server starts listening.
import { createApp } from "./app.js";
import { config } from "./lib/config.js";

const app = createApp();

app.listen(config.PORT, () => {
  console.log(`TaskFlow API listening on port ${config.PORT}`);
});
