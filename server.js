// server.js
import { createServer } from 'https';
import { readFileSync } from 'fs';
import next from 'next';

const port = 3400;
const hostname = '192.168.100.99';
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: readFileSync('./certs/localhost.key'),
  cert: readFileSync('./certs/localhost.crt'),
};

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    handle(req, res);
  }).listen(port, () => {
    console.log(`> HTTPS server ready on https://${hostname}:${port}`);
  });
});
