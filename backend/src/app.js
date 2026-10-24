import express from 'express';
import cors from 'cors';
import { applicationsRouter, statuses } from './applications.js';
import { db } from './db.js';

export const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/api/applications', applicationsRouter);
app.get('/api/stats', (_req, res) => {
  const counts = db.prepare('SELECT status, COUNT(*) AS count FROM applications GROUP BY status').all();
  const byStatus = Object.fromEntries(statuses.map((status) => [status, 0]));
  for (const { status, count } of counts) byStatus[status] = count;
  res.json({ total: counts.reduce((sum, { count }) => sum + count, 0), byStatus });
});
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'Invalid JSON body' });
  return res.status(500).json({ error: 'Internal server error' });
});
