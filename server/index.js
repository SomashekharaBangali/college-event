import { createServer } from 'node:http';
import { loadConfig } from './utils/config.js';

await loadConfig();

const [{ createApp }, { Server }, { initializeWorkbook }, { attachRealtime }] = await Promise.all([
  import('./app.js'),
  import('socket.io'),
  import('./utils/workbookStore.js'),
  import('./utils/realtime.js'),
]);
await initializeWorkbook();
const app = createApp();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
  maxHttpBufferSize: 1e5,
});
app.locals.io = io;
attachRealtime(io);

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';
httpServer.listen(port, host, () => {
  console.log(`Campus Connect realtime server listening on ${host}:${port}`);
  console.log(`Shared workbook: ${process.env.WORKBOOK_PATH || '../Book2.xlsx'}`);
});