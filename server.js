import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/send-email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.all('/api/send-email', async (req, res) => {
  await handler(req, res);
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`rac-org-3011-website listening on port ${PORT}`);
});
