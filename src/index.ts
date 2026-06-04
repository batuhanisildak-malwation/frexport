import { buildServer } from './server/server.js';
import { loadConfig, describeConfig } from './config.js';

const config = loadConfig();
const app = buildServer({ config });

app.log?.info?.(`frexport config: ${describeConfig(config)}`);

app.listen({ port: config.port, host: config.host })
  .then(() => console.log(`frexport running at http://${config.host}:${config.port}`))
  .catch((err) => { console.error(err); process.exit(1); });
