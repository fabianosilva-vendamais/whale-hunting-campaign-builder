// Rota de banco (Supabase) — roda no SERVIDOR. Usa a service_role key, que nunca vai ao navegador.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    return res.status(500).json({ error: 'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas na Vercel.' });
  }

  const { method = 'GET', path = '', body = null } = req.body || {};

  try {
    const r = await fetch(`${base}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await r.text();
    const data = text ? JSON.parse(text) : null;
    if (!r.ok) {
      return res.status(r.status).json({ error: (data && data.message) || 'Erro no banco de dados.' });
    }
    res.status(200).json({ data });
  } catch (e) {
    res.status(500).json({ error: 'Falha ao acessar o banco: ' + String(e) });
  }
}
