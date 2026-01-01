import express from 'express';
import cors from 'cors';
import { initDb } from './db';

const PORT = 8080;

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Initialize database and start server
initDb();

app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`);
});
