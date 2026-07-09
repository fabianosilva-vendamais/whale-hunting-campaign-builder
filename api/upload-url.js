// Gera uma URL assinada para o navegador enviar o arquivo direto ao Supabase Storage.
// A chave service_role fica só aqui no servidor; o arquivo NÃO passa por esta função (sem limite de tamanho).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    return res.status(500).json({ error: 'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas na Vercel.' });
  }

  const { path } = req.body || {};
  if (!path) return res.status(400).json({ error: 'Caminho do arquivo ausente.' });

  const bucket = 'materiais';
  try {
    const r = await fetch(`${base}/storage/v1/object/upload/sign/${bucket}/${path}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const d = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: (d && d.message) || 'Não foi possível preparar o upload. Confirme que o bucket "materiais" existe no Supabase Storage.' });
    }
    const signed = d.url || d.signedUrl || d.signedURL;
    res.status(200).json({
      uploadUrl: `${base}/storage/v1${signed}`,
      publicUrl: `${base}/storage/v1/object/public/${bucket}/${path}`
    });
  } catch (e) {
    res.status(500).json({ error: 'Falha ao preparar upload: ' + String(e) });
  }
}
