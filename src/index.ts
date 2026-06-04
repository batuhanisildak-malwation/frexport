import { buildServer } from './server/server.js';

const app = buildServer();
const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: '127.0.0.1' })
  .then(() => console.log(`frexport running at http://127.0.0.1:${port}`))
  .catch((err) => { console.error(err); process.exit(1); });
