import { Router } from 'express';
import { db } from './db.js';

export const statuses = ['wishlist', 'applied', 'interview', 'offer', 'rejected'];
const optionalStrings = ['url', 'salary', 'notes'];
const dateFields = ['appliedDate', 'interviewDate', 'followUpDate'];
const fields = ['company', 'position', 'url', 'salary', 'status', ...dateFields, 'notes'];

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validateBody(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Body must be a JSON object';
  const allowed = new Set(fields);
  if (Object.keys(body).some((key) => !allowed.has(key))) return 'Body contains unsupported fields';
  if (!partial && (!body.company || typeof body.company !== 'string' || !body.company.trim())) return 'company is required';
  if (!partial && (!body.position || typeof body.position !== 'string' || !body.position.trim())) return 'position is required';
  if (!partial && (!body.status || typeof body.status !== 'string')) return 'status is required';
  if (partial && Object.keys(body).length === 0) return 'At least one field is required';
  for (const key of ['company', 'position', ...optionalStrings]) {
    if (body[key] !== undefined && (typeof body[key] !== 'string' || ((key === 'company' || key === 'position') && !body[key].trim()))) return `${key} must be a non-empty string`;
  }
  if (body.status !== undefined && !statuses.includes(body.status)) return 'status must be wishlist, applied, interview, offer, or rejected';
  for (const key of dateFields) {
    if (body[key] !== undefined && body[key] !== null && !validDate(body[key])) return `${key} must use YYYY-MM-DD format`;
  }
  return null;
}

function toApplication(row) {
  return row;
}

function parseId(value) {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export const applicationsRouter = Router();

applicationsRouter.get('/', (req, res) => {
  const { status, q } = req.query;
  if (status !== undefined && (typeof status !== 'string' || !statuses.includes(status))) return res.status(400).json({ error: 'Invalid status filter' });
  if (q !== undefined && typeof q !== 'string') return res.status(400).json({ error: 'q must be a string' });
  let rows;
  if (status && q) rows = db.prepare("SELECT * FROM applications WHERE status = ? AND (company LIKE ? OR position LIKE ?) ORDER BY id").all(status, `%${q}%`, `%${q}%`);
  else if (status) rows = db.prepare('SELECT * FROM applications WHERE status = ? ORDER BY id').all(status);
  else if (q) rows = db.prepare('SELECT * FROM applications WHERE company LIKE ? OR position LIKE ? ORDER BY id').all(`%${q}%`, `%${q}%`);
  else rows = db.prepare('SELECT * FROM applications ORDER BY id').all();
  res.json(rows.map(toApplication));
});

applicationsRouter.post('/', (req, res) => {
  const error = validateBody(req.body);
  if (error) return res.status(400).json({ error });
  const now = new Date().toISOString();
  const values = Object.fromEntries(fields.map((field) => [field, req.body[field] ?? null]));
  const result = db.prepare(`INSERT INTO applications (${fields.join(', ')}, createdAt, updatedAt) VALUES (${fields.map(() => '?').join(', ')}, ?, ?)`)
    .run(...fields.map((field) => values[field]), now, now);
  const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(toApplication(application));
});

applicationsRouter.get('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(404).json({ error: 'Application not found' });
  const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
  if (!application) return res.status(404).json({ error: 'Application not found' });
  res.json(toApplication(application));
});

applicationsRouter.patch('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(404).json({ error: 'Application not found' });
  const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
  if (!application) return res.status(404).json({ error: 'Application not found' });
  const error = validateBody(req.body, true);
  if (error) return res.status(400).json({ error });

  const updates = Object.entries(req.body);
  const updatedAt = new Date().toISOString();
  db.prepare(`UPDATE applications SET ${updates.map(([field]) => `${field} = ?`).join(', ')}, updatedAt = ? WHERE id = ?`)
    .run(...updates.map(([, value]) => value), updatedAt, id);
  res.json(toApplication(db.prepare('SELECT * FROM applications WHERE id = ?').get(id)));
});

applicationsRouter.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(404).json({ error: 'Application not found' });
  const result = db.prepare('DELETE FROM applications WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Application not found' });
  res.status(204).end();
});
