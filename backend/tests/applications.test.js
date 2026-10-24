import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db.js';

describe('applications endpoints', () => {
  beforeEach(() => db.exec('DELETE FROM applications'));
  it('allows the frontend origin through CORS', async () => {
    const response = await request(app)
      .get('/api/applications')
      .set('Origin', 'http://localhost:5173');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('creates an application and returns generated fields', async () => {
    const response = await request(app).post('/api/applications').send({
      company: 'Acme', position: 'Engineer', status: 'applied', appliedDate: '2026-10-21'
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ company: 'Acme', position: 'Engineer', status: 'applied', appliedDate: '2026-10-21' });
    expect(response.body.id).toEqual(expect.any(Number));
    expect(response.body.createdAt).toEqual(expect.any(String));
    expect(response.body.updatedAt).toEqual(response.body.createdAt);
  });

  it('rejects missing required fields, unsupported status, and malformed dates', async () => {
    for (const payload of [
      { position: 'Engineer', status: 'applied' },
      { company: 'Acme', status: 'applied' },
      { company: 'Acme', position: 'Engineer', status: 'pending' },
      { company: 'Acme', position: 'Engineer', status: 'applied', appliedDate: '2026-02-30' }
    ]) {
      expect((await request(app).post('/api/applications').send(payload)).status).toBe(400);
    }
  });

  it('lists applications and filters by status and company or position query', async () => {
    await request(app).post('/api/applications').send({ company: 'Acme', position: 'Engineer', status: 'applied' });
    await request(app).post('/api/applications').send({ company: 'Beta', position: 'Designer', status: 'wishlist' });

    expect((await request(app).get('/api/applications')).body).toHaveLength(2);
    expect((await request(app).get('/api/applications?status=applied')).body).toHaveLength(1);
    expect((await request(app).get('/api/applications?q=Design')).body[0].company).toBe('Beta');
    expect((await request(app).get('/api/applications?status=invalid')).status).toBe(400);
  });

  it('gets an application by id or returns 404 when it does not exist', async () => {
    const created = await request(app).post('/api/applications').send({
      company: 'Acme', position: 'Engineer', status: 'applied'
    });

    const response = await request(app).get(`/api/applications/${created.body.id}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: created.body.id, company: 'Acme', position: 'Engineer' });
    expect((await request(app).get('/api/applications/99999')).status).toBe(404);
    expect((await request(app).get('/api/applications/invalid')).status).toBe(404);
  });

  it('partially updates an application, refreshes updatedAt, and validates supplied fields', async () => {
    const created = await request(app).post('/api/applications').send({
      company: 'Acme', position: 'Engineer', status: 'applied', notes: 'Initial note'
    });

    const response = await request(app).patch(`/api/applications/${created.body.id}`).send({
      position: 'Senior Engineer', interviewDate: '2026-11-02'
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      company: 'Acme', position: 'Senior Engineer', status: 'applied',
      notes: 'Initial note', interviewDate: '2026-11-02'
    });
    expect(new Date(response.body.updatedAt).valueOf()).toBeGreaterThanOrEqual(new Date(created.body.updatedAt).valueOf());

    for (const payload of [
      {}, { company: '   ' }, { status: 'pending' }, { followUpDate: '2026-02-30' }, { id: 2 }
    ]) {
      expect((await request(app).patch(`/api/applications/${created.body.id}`).send(payload)).status).toBe(400);
    }
    expect((await request(app).patch('/api/applications/99999').send({ company: 'Beta' })).status).toBe(404);
    expect((await request(app).patch('/api/applications/nope').send({ company: 'Beta' })).status).toBe(404);
  });

  it('deletes an application with 204 and returns 404 when it does not exist', async () => {
    const created = await request(app).post('/api/applications').send({
      company: 'Acme', position: 'Engineer', status: 'applied'
    });

    const response = await request(app).delete(`/api/applications/${created.body.id}`);
    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect((await request(app).get(`/api/applications/${created.body.id}`)).status).toBe(404);
    expect((await request(app).delete('/api/applications/99999')).status).toBe(404);
    expect((await request(app).delete('/api/applications/nope')).status).toBe(404);
  });
});

describe('stats endpoint', () => {
  beforeEach(() => db.exec('DELETE FROM applications'));

  it('returns zero counts for all statuses when there are no applications', async () => {
    const response = await request(app).get('/api/stats');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      total: 0,
      byStatus: { wishlist: 0, applied: 0, interview: 0, offer: 0, rejected: 0 }
    });
  });

  it('returns the total and counts for all five statuses', async () => {
    for (const status of ['wishlist', 'applied', 'applied', 'interview', 'offer', 'rejected']) {
      const created = await request(app).post('/api/applications').send({
        company: `Company ${status}`, position: 'Engineer', status
      });
      expect(created.status).toBe(201);
    }

    const response = await request(app).get('/api/stats');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      total: 6,
      byStatus: { wishlist: 1, applied: 2, interview: 1, offer: 1, rejected: 1 }
    });
  });
});


