// server.js
const { createServer } = require('https');
const { readFileSync } = require('fs');
const next = require('next');

const port = 3001;
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
