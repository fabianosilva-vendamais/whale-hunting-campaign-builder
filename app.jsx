const { useState, useEffect, useRef } = React;

/* ============================================================
   Whale Hunting Campaign Builder — VendaMais (app funcional)
   IA: OpenAI (via /api/generate) · Banco: Supabase (via /api/db)
   ============================================================ */

const C = {
  ink: '#1D2C31', deep: '#142B33', deep2: '#1E3E49', gold: '#9C7B37', gold2: '#C9A45B',
  paper: '#F4F2EC', card: '#FFFFFF', line: '#E4E0D3', line2: '#EEEBE0',
  mut: '#66757B', mut2: '#8B8878', green: '#2F7D5C', greenBg: '#E4F0E8',
  amber: '#8A6A24', amberBg: '#F3ECDA', red: '#A94A38'
};

const SYSTEM = `Você é estrategista sênior de marketing e vendas da VendaMais, especialista na operação Whale Hunting: conquista de contas de alto potencial (chamadas internamente de "super PCI") por meio de inteligência comercial, autoridade e relacionamento com decisores. Não é geração de leads em volume — é qualidade de lead, cargo certo, empresa certa, conversa executiva, oportunidade criada e proposta reativada.
Regras de escrita: português do Brasil; tom sênior, consultivo e sóbrio; frases diretas. NUNCA use clichês de vendas, emojis, hype ou linguagem motivacional genérica. Baseie-se estritamente nos materiais e no contexto fornecidos — não invente dados, números ou nomes de clientes. Quando faltar informação, escreva de forma que funcione sem inventar.`;

// ---------- API helpers ----------
async function ai(system, prompt) {
  const r = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, prompt })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Erro ao gerar');
  return d.text;
}
async function db(method, path, body) {
  const r = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, path, body })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Erro no banco');
  return d.data;
}

// ---------- utils ----------
function parseSections(text) {
  if (!text) return [];
  const parts = text.split(/===\s*(.+?)\s*===/g);
  const out = [];
  for (let i = 1; i < parts.length; i += 2) {
    out.push({ label: parts[i].trim(), body: (parts[i + 1] || '').trim() });
  }
  if (out.length === 0 && text.trim()) out.push({ label: '', body: text.trim() });
  return out;
}
function copy(t) {
  let ok = false;
  try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t); ok = true; } } catch (e) {}
  if (!ok) {
    try {
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      ok = document.execCommand('copy'); document.body.removeChild(ta);
    } catch (e) {}
  }
  showToast(ok ? 'Copiado para a área de transferência' : 'Não foi possível copiar');
  return ok;
}
function showToast(msg) {
  let el = document.getElementById('__wh_toast');
  if (!el) {
    el = document.createElement('div'); el.id = '__wh_toast';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1E3A43;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-family:inherit;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.25);transition:opacity .2s;pointer-events:none';
    document.body.appendChild(el);
  }
  el.textContent = msg; el.style.opacity = '1';
  clearTimeout(el.__t); el.__t = setTimeout(() => { el.style.opacity = '0'; }, 1700);
}
function RichText({ text }) {
  return String(text || '').split('\n').map((ln, i) => {
    const segs = ln.split(/(\*\*[^*]+\*\*)/g).map((s, j) =>
      /^\*\*[^*]+\*\*$/.test(s) ? <strong key={j}>{s.slice(2, -2)}</strong> : s);
    return <div key={i} style={{ minHeight: ln.trim() ? undefined : 7 }}>{segs}</div>;
  });
}
// Renderiza um corpo "Rótulo: valor" (multi-linha) como campos estruturados
function Fields({ body }) {
  const items = [];
  String(body || '').split('\n').forEach(raw => {
    const line = raw.replace(/\s+$/, '');
    const m = line.match(/^\s*([A-Za-zÀ-ÿ][^:\n]{1,40}):\s*(.*)$/);
    const isLabel = m && m[1].trim().split(/\s+/).length <= 6;
    if (isLabel) items.push({ label: m[1].trim(), value: m[2] });
    else if (items.length) items[items.length - 1].value += '\n' + line;
    else if (line.trim()) items.push({ label: '', value: line });
  });
  if (!items.length) return null;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
    {items.map((it, i) => it.label
      ? <div key={i}>
          <div style={{ fontSize: 10.5, letterSpacing: .6, textTransform: 'uppercase', fontWeight: 700, color: '#93763A', marginBottom: 3 }}>{it.label}</div>
          <div style={{ fontSize: 13.5, color: '#2F3E44', lineHeight: 1.6, whiteSpace: 'pre-line' }}><RichText text={it.value.trim()} /></div>
        </div>
      : <div key={i} style={{ fontSize: 13.5, color: '#2F3E44', lineHeight: 1.6, whiteSpace: 'pre-line' }}><RichText text={it.value.trim()} /></div>)}
  </div>;
}
// Escolhe checklist (bullets) ou campos estruturados
function Body({ body }) {
  const lines = String(body || '').split('\n').map(x => x.trim()).filter(Boolean);
  const bl = lines.filter(l => /^[-•*]\s/.test(l));
  if (bl.length >= 2 && bl.length >= lines.length * 0.6) {
    return <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
      {bl.map((l, i) => <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13.5, color: '#2F3E44', lineHeight: 1.55 }}>
        <span style={{ color: '#C9A45B', fontWeight: 800, flexShrink: 0 }}>✓</span><span><RichText text={l.replace(/^[-•*]\s/, '')} /></span>
      </li>)}
    </ul>;
  }
  return <Fields body={body} />;
}

const POWER_TEMAS = 'mudança de mentalidade comercial, gestão ativa de carteira, prospecção, abordagem, levantamento de necessidades, SPIN Selling, recomendação, negociação, fechamento e relacionamento sustentável com cooperados';
const ACIONAVEL = 'REGRAS DE QUALIDADE (obrigatórias): escreva como uma pessoa sênior da VendaMais, nunca como IA. Nada genérico ou institucional. Proibido "estamos à disposição", "somos referência", promessas de resultado, "garantimos" e tom motivacional. Todo conteúdo se conecta ao Special Report e conduz, de forma consultiva, à necessidade de preparar a equipe comercial (venda consultiva, gestão ativa de carteira, principalidade, abordagem, levantamento de necessidades, recomendação, negociação, fechamento, relacionamento sustentável). Cada peça tem função clara na campanha e um próximo passo concreto. Antes de finalizar, releia e reescreva qualquer trecho vago, óbvio, promocional ou sem função.';
function download(name, text, type) {
  const blob = new Blob([text], { type: type || 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function safeName(s) { return String(s || 'arquivo').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80); }
async function extractPdfText(file) {
  if (!window.pdfjsLib) return '';
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let t = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const p = await pdf.getPage(i);
    const tc = await p.getTextContent();
    t += tc.items.map(x => x.str).join(' ') + '\n\n';
  }
  return t.trim();
}
// datas: tela em DD/MM/AAAA, banco em AAAA-MM-DD
function brToIso(s) {
  if (!s) return null;
  s = String(s).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}
function isoToBr(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : s;
}
function normalizeDates(row) {
  return { ...row, periodo_inicio: isoToBr(row.periodo_inicio), periodo_fim: isoToBr(row.periodo_fim) };
}

// ---------- small UI atoms ----------
function Btn({ children, onClick, kind, disabled, style }) {
  const base = { border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? .55 : 1, transition: 'background .15s' };
  const kinds = {
    primary: { background: C.deep, color: '#fff' },
    ghost: { background: '#fff', color: C.ink, border: '1px solid ' + C.line },
    soft: { background: 'transparent', color: C.gold, fontWeight: 700 }
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...(kinds[kind] || kinds.primary), ...style }}>{children}</button>;
}
function Spinner({ label }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.mut, fontSize: 13 }}>
    <span style={{ width: 16, height: 16, border: '2px solid ' + C.line, borderTopColor: C.gold, borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }}></span>
    {label || 'Gerando com IA…'}
  </div>;
}
function Field({ label, value, onChange, ph, area, rows }) {
  const st = { width: '100%', border: '1px solid #CFC9B8', borderRadius: 8, padding: '10px 12px', fontSize: 14, background: '#FBFAF6', resize: 'vertical' };
  return <label style={{ display: 'block' }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: '#4C5B60', marginBottom: 5 }}>{label}</div>
    {area
      ? <textarea rows={rows || 3} value={value || ''} placeholder={ph} onChange={e => onChange(e.target.value)} style={st} />
      : <input value={value || ''} placeholder={ph} onChange={e => onChange(e.target.value)} style={st} />}
  </label>;
}
function Card({ children, style }) {
  return <div style={{ background: C.card, border: '1px solid ' + C.line, borderRadius: 12, padding: '20px 22px', ...style }}>{children}</div>;
}
function Kicker({ children }) {
  return <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: C.gold, fontWeight: 700 }}>{children}</div>;
}
function H1({ children }) {
  return <h1 style={{ fontFamily: "'Source Serif 4',serif", fontSize: 28, fontWeight: 600, margin: '6px 0 4px' }}>{children}</h1>;
}

// ============================================================
function App() {
  const [screen, setScreen] = useState('dash');
  const [campaigns, setCampaigns] = useState([]);
  const [cur, setCur] = useState(null);         // campanha atual (objeto)
  const [materials, setMaterials] = useState([]); // anexos: [{id,tipo,name,url,kind,text}]
  const [pieces, setPieces] = useState({});      // {analise, lp, regua, posts, ...}
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState('');    // chave de operação em curso
  const toastT = useRef();

  function flash(m) { clearTimeout(toastT.current); setToast(m); toastT.current = setTimeout(() => setToast(null), 3200); }

  // -------- data --------
  async function loadCampaigns() {
    try { setCampaigns(await db('GET', 'campanhas?select=*&order=criada_em.desc') || []); }
    catch (e) { flash('Erro ao listar campanhas: ' + e.message); }
  }
  useEffect(() => { loadCampaigns(); }, []);

  async function openCampaign(id) {
    try {
      const rows = await db('GET', `campanhas?id=eq.${id}&select=*`);
      if (!rows || !rows[0]) { flash('Campanha não encontrada.'); return; }
      const c = normalizeDates(rows[0]); setCur(c);
      const mats = await db('GET', `materiais?campanha_id=eq.${id}&select=*`) || [];
      setMaterials(mats.map(r => { let meta = {}; try { meta = JSON.parse(r.observacoes || '{}'); } catch (e) {} return { id: r.id, tipo: r.tipo, name: meta.name || 'arquivo', url: meta.url || '', kind: meta.kind || 'file', text: r.texto_extraido || '' }; }));
      const pcs = await db('GET', `pecas?campanha_id=eq.${id}&select=*`) || [];
      const pp = {}; pcs.forEach(p => { pp[p.tipo] = p.conteudo; }); setPieces(pp);
      setScreen('camp');
    } catch (e) { flash('Erro ao abrir: ' + e.message); }
  }

  function newCampaign() {
    setCur({ nome: '', segmento: '', objetivo: '', publico_alvo: '', cargos: '', solucao_principal: '', solucoes_secundarias: '', cta_principal: '', restricoes: '', periodo_inicio: '', periodo_fim: '', status: 'rascunho' });
    setMaterials([]); setPieces({}); setScreen('camp');
  }

  async function saveCampaign() {
    if (!cur.nome || !cur.segmento) { flash('Preencha ao menos o nome e o segmento.'); return; }
    setLoading('save');
    try {
      const payload = { ...cur }; delete payload.id; delete payload.criada_em;
      ['periodo_inicio', 'periodo_fim'].forEach(k => { payload[k] = brToIso(payload[k]); });
      let row;
      if (cur.id) { row = (await db('PATCH', `campanhas?id=eq.${cur.id}`, payload))[0]; }
      else { row = (await db('POST', 'campanhas', payload))[0]; }
      setCur(normalizeDates(row)); flash('Campanha salva.'); loadCampaigns();
    } catch (e) { flash('Erro ao salvar: ' + e.message); }
    setLoading('');
  }

  async function deleteCampaign(id) {
    if (!confirm('Excluir esta campanha e tudo que foi gerado nela?')) return;
    try {
      await db('DELETE', `pecas?campanha_id=eq.${id}`);
      await db('DELETE', `materiais?campanha_id=eq.${id}`);
      await db('DELETE', `campanhas?id=eq.${id}`);
      flash('Campanha excluída.'); if (cur && cur.id === id) { setCur(null); setScreen('dash'); } loadCampaigns();
    } catch (e) { flash('Erro ao excluir: ' + e.message); }
  }

  async function addAttachment(tipo, file) {
    if (!cur || !cur.id) { flash('Salve a campanha primeiro.'); return; }
    setLoading('mat_' + tipo);
    try {
      const path = cur.id + '/' + tipo + '/' + Date.now() + '-' + safeName(file.name);
      const signR = await fetch('/api/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) });
      const sign = await signR.json();
      if (!signR.ok) throw new Error(sign.error || 'Erro ao preparar upload');
      const put = await fetch(sign.uploadUrl, { method: 'PUT', headers: { 'content-type': file.type || 'application/octet-stream', 'x-upsert': 'true' }, body: file });
      if (!put.ok) throw new Error('Falha no envio (' + put.status + '). Confirme que o bucket "materiais" existe e é público no Supabase.');
      const isPdf = /\.pdf$/i.test(file.name);
      const isImg = /^image\//.test(file.type || '') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
      let text = '';
      if (isPdf) { try { text = await extractPdfText(file); } catch (e) { text = ''; } }
      else if (!isImg) { try { text = await file.text(); } catch (e) { text = ''; } }
      const kind = isImg ? 'image' : (isPdf ? 'pdf' : 'file');
      const obs = JSON.stringify({ name: file.name, url: sign.publicUrl, kind });
      const row = (await db('POST', 'materiais', { campanha_id: cur.id, tipo, texto_extraido: text, observacoes: obs }))[0];
      setMaterials(m => [...m, { id: row.id, tipo, name: file.name, url: sign.publicUrl, kind, text }]);
      flash('Arquivo anexado.');
    } catch (e) { flash('Erro ao anexar: ' + e.message); }
    setLoading('');
  }

  async function removeAttachment(att) {
    try {
      if (att.id) await db('DELETE', `materiais?id=eq.${att.id}`);
      setMaterials(m => m.filter(x => x !== att));
      flash('Anexo removido.');
    } catch (e) { flash('Erro ao remover: ' + e.message); }
  }

  async function savePiece(tipo, conteudo) {
    if (!cur || !cur.id) { flash('Salve a campanha primeiro.'); return; }
    try {
      await db('DELETE', `pecas?campanha_id=eq.${cur.id}&tipo=eq.${tipo}`);
      await db('POST', 'pecas', { campanha_id: cur.id, tipo, conteudo, status: 'rascunho' });
      flash('Salvo com sucesso.');
    } catch (e) { flash('Erro ao salvar: ' + e.message); }
  }

  // -------- contexto para a IA --------
  function ctx(opts) {
    const c = cur || {};
    const txt = t => materials.filter(m => m.tipo === t && m.text).map(m => m.text).join('\n\n');
    const sr = txt('special_report'), rd = txt('radar'), co = txt('contas');
    const igFiles = materials.filter(m => m.tipo === 'infografico');
    const igTxt = igFiles.map(m => m.text).filter(Boolean).join('\n\n');
    const ig = igTxt || (igFiles.length ? '(imagem anexada, sem texto — usar apenas como referência visual)' : '(não fornecido)');
    let base = `CONTEXTO DA CAMPANHA
Segmento/tema do mês: ${c.segmento || '—'}
Objetivo: ${c.objetivo || '—'}
Público-alvo: ${c.publico_alvo || '—'}
Cargos prioritários: ${c.cargos || '—'}
Solução principal VendaMais: ${c.solucao_principal || '—'}
Soluções secundárias: ${c.solucoes_secundarias || '—'}
CTA principal: ${c.cta_principal || '—'}
Restrições de comunicação: ${c.restricoes || '—'}

MATERIAIS FORNECIDOS
Special Report (texto): ${sr ? sr.slice(0, 6000) : '(não fornecido)'}
Resumo do Radar: ${rd || '(não fornecido)'}
Infográfico: ${ig}
Lista de contas-alvo: ${co || '(não fornecida)'}`;
    if (!(opts && opts.forStrategy) && pieces.analise && String(pieces.analise).trim()) {
      base += `\n\n=== ANÁLISE ESTRATÉGICA APROVADA (use como diretriz central; mantenha coerência total com ela) ===\n${String(pieces.analise).slice(0, 4500)}`;
    }
    return base;
  }

  async function gen(tipo, prompt, after) {
    setLoading(tipo);
    try {
      const text = await ai(SYSTEM, prompt);
      await after(text);
      flash('Conteúdo gerado — revise e edite antes de aprovar.');
    } catch (e) { flash('Erro ao gerar: ' + e.message); }
    setLoading('');
  }

  // ============================ RENDER ============================
  const navItems = [
    { id: 'dash', label: 'Campanhas', num: '01', section: 'Visão geral' },
    { id: 'camp', label: cur && cur.id ? 'Campanha' : 'Nova campanha', num: '02', section: 'Criação' },
    { id: 'mat', label: 'Materiais', num: '03' },
    { id: 'est', label: 'Estratégia', num: '04', section: 'Inteligência' },
    { id: 'lp', label: 'Landing page', num: '05', section: 'Produção' },
    { id: 'regua', label: 'Régua de e-mails', num: '06' },
    { id: 'cont', label: 'Conteúdo', num: '07' },
    { id: 'exp', label: 'Exportar', num: '08', section: 'Lançamento' }
  ];
  const needCampaign = ['mat', 'est', 'lp', 'regua', 'cont', 'exp'];

  return <div style={{ display: 'flex', minHeight: '100vh' }}>
    {/* SIDEBAR */}
    <div style={{ width: 240, flexShrink: 0, background: C.deep, display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
      <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ fontFamily: "'Source Serif 4',serif", fontSize: 17, fontWeight: 600, color: '#fff' }}>Whale Hunting</div>
        <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: C.gold2, fontWeight: 600, marginTop: 3 }}>Campaign Builder</div>
      </div>
      <div style={{ flex: 1, padding: '4px 0 8px' }}>
        {navItems.map((it) => {
          const dis = needCampaign.includes(it.id) && !(cur && cur.id);
          const act = screen === it.id;
          return <div key={it.id}>
            {it.section && <div style={{ padding: '14px 20px 5px', fontSize: 9.5, letterSpacing: 1.5, textTransform: 'uppercase', color: '#5E7B84', fontWeight: 700 }}>{it.section}</div>}
            <div onClick={() => { if (dis) { flash('Crie e salve uma campanha primeiro.'); return; } setScreen(it.id); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', cursor: dis ? 'default' : 'pointer', fontSize: 13.5, color: dis ? '#4A6068' : (act ? '#EFDFB9' : '#9FB4BA'), background: act ? 'rgba(201,164,91,.13)' : 'transparent', borderLeft: '3px solid ' + (act ? C.gold2 : 'transparent'), fontWeight: act ? 700 : 400 }}>
              <span style={{ width: 18, fontSize: 10.5, color: dis ? '#3C5158' : (act ? C.gold2 : '#5E7B84'), fontVariantNumeric: 'tabular-nums' }}>{it.num}</span>
              <span>{it.label}</span>
            </div>
          </div>;
        })}
      </div>
      <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
        {cur && cur.nome
          ? <div style={{ fontSize: 11.5, color: '#8AA2A9', lineHeight: 1.4 }}>Campanha ativa: <span style={{ color: '#E9EFF0', fontWeight: 600 }}>{cur.nome}</span></div>
          : <div style={{ fontSize: 11.5, color: '#8AA2A9' }}>VendaMais</div>}
      </div>
    </div>

    {/* MAIN */}
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '30px 40px 80px' }}>
        {screen === 'dash' && <Dash campaigns={campaigns} onNew={newCampaign} onOpen={openCampaign} onDelete={deleteCampaign} />}
        {screen === 'camp' && <CampForm cur={cur} setCur={setCur} onSave={saveCampaign} saving={loading === 'save'} onMat={() => setScreen('mat')} />}
        {screen === 'mat' && <Materials materials={materials} onAdd={addAttachment} onRemove={removeAttachment} busy={loading} onNext={() => setScreen('est')} />}
        {screen === 'est' && <Strategy pieces={pieces} setPieces={setPieces} loading={loading} ctx={ctx} gen={gen} savePiece={savePiece} flash={flash} />}
        {screen === 'lp' && <LandingPage cur={cur} materials={materials} pieces={pieces} setPieces={setPieces} loading={loading} ctx={ctx} gen={gen} savePiece={savePiece} flash={flash} />}        {screen === 'regua' && <Regua pieces={pieces} setPieces={setPieces} loading={loading} ctx={ctx} gen={gen} savePiece={savePiece} flash={flash} />}
        {screen === 'cont' && <Conteudo pieces={pieces} setPieces={setPieces} loading={loading} ctx={ctx} gen={gen} savePiece={savePiece} flash={flash} />}
        {screen === 'exp' && <Exportar cur={cur} materials={materials} pieces={pieces} flash={flash} />}
      </div>
    </div>

    {toast && <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: C.deep, color: C.paper, fontSize: 13, fontWeight: 600, padding: '11px 22px', borderRadius: 999, boxShadow: '0 8px 24px rgba(20,43,51,.35)', zIndex: 50 }}>{toast}</div>}
  </div>;
}

// ---------------- Dashboard ----------------
function Dash({ campaigns, onNew, onOpen, onDelete }) {
  const chip = s => ({ rascunho: [C.line2, C.mut], producao: [C.amberBg, C.amber], publicada: [C.greenBg, C.green], encerrada: [C.line2, C.mut] }[s] || [C.line2, C.mut]);
  return <div>
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div><Kicker>Visão geral</Kicker><H1>Campanhas Whale Hunting</H1>
        <p style={{ margin: 0, color: C.mut, fontSize: 14 }}>Uma campanha por nicho. Conversas executivas, não volume de leads.</p></div>
      <Btn onClick={onNew}>+ Nova campanha</Btn>
    </div>
    <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {campaigns.length === 0 && <Card style={{ borderStyle: 'dashed', textAlign: 'center', padding: '44px 24px' }}>
        <div style={{ fontFamily: "'Source Serif 4',serif", fontSize: 17, fontWeight: 600 }}>Nenhuma campanha ainda</div>
        <p style={{ fontSize: 13, color: C.mut, maxWidth: 460, margin: '8px auto 14px' }}>Comece pelo tema do mês. A IA ajuda a gerar estratégia, landing page, régua de e-mails e conteúdo a partir dos seus materiais.</p>
        <Btn onClick={onNew}>Criar a primeira campanha</Btn>
      </Card>}
      {campaigns.map(c => { const [bg, cl] = chip(c.status); return <Card key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'Source Serif 4',serif", fontSize: 16.5, fontWeight: 600 }}>{c.nome}</span>
            <span style={{ fontSize: 11, fontWeight: 700, background: bg, color: cl, borderRadius: 999, padding: '2px 9px' }}>{c.status}</span>
          </div>
          <div style={{ fontSize: 12.5, color: C.mut, marginTop: 4 }}>{c.segmento}{c.objetivo ? ' · ' + c.objetivo.slice(0, 90) : ''}</div>
        </div>
        <Btn kind="ghost" onClick={() => onOpen(c.id)}>Abrir</Btn>
        <Btn kind="soft" onClick={() => onDelete(c.id)} style={{ color: C.red }}>Excluir</Btn>
      </Card>; })}
    </div>
  </div>;
}

// ---------------- Campaign form ----------------
function CampForm({ cur, setCur, onSave, saving, onMat }) {
  const set = (k, v) => setCur({ ...cur, [k]: v });
  return <div>
    <Kicker>Etapa 1 · Criação</Kicker><H1>{cur.id ? 'Editar campanha' : 'Nova campanha'}</H1>
    <p style={{ margin: '0 0 22px', color: C.mut, fontSize: 14 }}>Quanto mais específico o nicho, mais forte a campanha. Estes campos alimentam toda a geração de conteúdo pela IA.</p>
    <Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ gridColumn: '1 / -1' }}><Field label="Nome da campanha" value={cur.nome} onChange={v => set('nome', v)} ph="Ex.: Cooperativas de Crédito — Agosto 2026" /></div>
        <Field label="Tema / segmento do mês" value={cur.segmento} onChange={v => set('segmento', v)} ph="Ex.: cooperativas de crédito" />
        <Field label="Público-alvo" value={cur.publico_alvo} onChange={v => set('publico_alvo', v)} ph="Tipo e porte de empresa" />
        <div style={{ gridColumn: '1 / -1' }}><Field label="Objetivo da campanha" area rows={2} value={cur.objetivo} onChange={v => set('objetivo', v)} ph="O que precisa gerar — reuniões executivas, propostas reativadas…" /></div>
        <Field label="Cargos prioritários" value={cur.cargos} onChange={v => set('cargos', v)} ph="Ex.: diretor comercial, superintendente" />
        <Field label="Solução principal VendaMais" value={cur.solucao_principal} onChange={v => set('solucao_principal', v)} ph="Ex.: consultoria de estrutura comercial" />
        <Field label="Soluções secundárias" value={cur.solucoes_secundarias} onChange={v => set('solucoes_secundarias', v)} ph="Separadas por vírgula" />
        <Field label="CTA principal" value={cur.cta_principal} onChange={v => set('cta_principal', v)} ph="Ex.: Baixar o Special Report" />
        <Field label="Início" value={cur.periodo_inicio} onChange={v => set('periodo_inicio', v)} ph="DD/MM/AAAA" />
        <Field label="Fim" value={cur.periodo_fim} onChange={v => set('periodo_fim', v)} ph="DD/MM/AAAA" />
        <div style={{ gridColumn: '1 / -1' }}><Field label="Restrições de comunicação" area rows={2} value={cur.restricoes} onChange={v => set('restricoes', v)} ph="O que a comunicação não pode fazer ou dizer" /></div>
        <label style={{ display: 'block' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#4C5B60', marginBottom: 5 }}>Status</div>
          <select value={cur.status} onChange={e => set('status', e.target.value)} style={{ width: '100%', border: '1px solid #CFC9B8', borderRadius: 8, padding: '10px 12px', fontSize: 14, background: '#FBFAF6' }}>
            <option value="rascunho">Rascunho</option><option value="producao">Em produção</option><option value="publicada">Publicada</option><option value="encerrada">Encerrada</option>
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid ' + C.line2, paddingTop: 18 }}>
        <Btn onClick={onSave} disabled={saving}>{saving ? 'Salvando…' : 'Salvar campanha'}</Btn>
        {cur.id && <Btn kind="ghost" onClick={onMat}>Ir para Materiais →</Btn>}
      </div>
    </Card>
  </div>;
}

// ---------------- Materials ----------------
function Materials({ materials, onAdd, onRemove, busy, onNext }) {
  function pick(tipo, accept) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) onAdd(tipo, f); };
    inp.click();
  }
  const cats = [
    { tipo: 'special_report', title: 'Special Report', help: 'O relatório da campanha, em PDF. O texto é lido nos bastidores para alimentar a IA (você não precisa fazer nada).', accept: '.pdf,.txt,.md,text/plain', btn: 'Anexar PDF' },
    { tipo: 'radar', title: 'Informações do Radar', help: 'O documento ou resumo do Radar (PDF ou TXT), quando houver.', accept: '.pdf,.txt,.md,text/plain', btn: 'Anexar arquivo' },
    { tipo: 'infografico', title: 'Infográfico', help: 'A imagem do infográfico (PNG/JPG) ou PDF. Fica guardada para usar na landing page e nos posts.', accept: 'image/*,.pdf', btn: 'Anexar imagem' },
    { tipo: 'contas', title: 'Lista de contas-alvo', help: 'A lista das contas super PCI (CSV, TXT ou PDF), quando houver.', accept: '.csv,.txt,.pdf,text/plain', btn: 'Anexar arquivo' }
  ];
  return <div>
    <Kicker>Etapa 2 · Materiais</Kicker><H1>Materiais da campanha</H1>
    <p style={{ margin: '0 0 22px', color: C.mut, fontSize: 14, maxWidth: 660 }}>Anexe os arquivos da campanha — tudo opcional, anexe só o que tiver. Cada anexo é salvo na hora. Os PDFs alimentam a IA automaticamente; a imagem do infográfico fica guardada para a landing page.</p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {cats.map(cat => {
        const files = materials.filter(a => a.tipo === cat.tipo);
        const loading = busy === 'mat_' + cat.tipo;
        return <Card key={cat.tipo}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{cat.title}</div>
              <div style={{ fontSize: 12, color: C.mut, marginTop: 3, lineHeight: 1.5 }}>{cat.help}</div>
            </div>
            <button onClick={() => pick(cat.tipo, cat.accept)} disabled={loading}
              style={{ background: '#fff', color: C.gold, border: '1px solid ' + C.line, borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {loading ? 'Enviando…' : '+ ' + cat.btn}
            </button>
          </div>
          {files.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
            {files.map((a, i) => <div key={a.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FBFAF6', border: '1px solid ' + C.line, borderRadius: 10, padding: '8px 12px', maxWidth: 320 }}>
              {a.kind === 'image'
                ? <img src={a.url} alt={a.name} style={{ width: 46, height: 46, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                : <div style={{ width: 40, height: 46, borderRadius: 5, background: C.deep, color: C.gold2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{a.kind === 'pdf' ? 'PDF' : 'DOC'}</div>}
              <div style={{ minWidth: 0, flex: 1 }}>
                <a href={a.url} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: C.ink, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</a>
                <div style={{ fontSize: 11, color: C.mut }}>{a.kind === 'image' ? 'imagem' : (a.kind === 'pdf' ? 'PDF · texto lido para a IA' : 'arquivo')}</div>
              </div>
              <span onClick={() => onRemove(a)} style={{ cursor: 'pointer', color: C.red, fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>Remover</span>
            </div>)}
          </div>}
        </Card>;
      })}
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
      <Btn kind="ghost" onClick={onNext}>Ir para Estratégia →</Btn>
    </div>
  </div>;
}

// ---------------- Strategy ----------------
function Strategy({ pieces, setPieces, loading, ctx, gen, savePiece, flash }) {
  const [edit, setEdit] = useState(false);
  const val = pieces.analise || '';
  const set = t => setPieces(p => ({ ...p, analise: t }));
  const prompt = `${ctx({ forStrategy: true })}\n\nGere a ANÁLISE ESTRATÉGICA da campanha para a operação Whale Hunting. Português do Brasil, tom sênior e consultivo, sem clichês. Use EXATAMENTE estes marcadores de seção:\n=== TESE CENTRAL ===\n(2 a 3 frases: a leitura de mercado que justifica mirar este segmento agora, ligada ao objetivo de conquistar contas super PCI)\n=== PERFIL DA CONTA-ALVO (SUPER PCI) ===\n(porte, momento e sinais de fit da empresa ideal + os cargos decisores a mirar)\n=== DORES DO DECISOR ===\n(4 a 5 dores reais do cargo-alvo neste segmento, na linguagem dele — nada genérico de "vender mais")\n=== DADOS UTILIZÁVEIS DO MATERIAL ===\n(3 a 5 dados/estatísticas que APARECEM nos materiais, com o número. Se não houver nenhum, escreva "Nenhum dado numérico disponível nos materiais" — não invente)\n=== ÂNGULO DE AUTORIDADE ===\n(o ponto de vista que posiciona a VendaMais como especialista do segmento, não como fornecedor genérico)\n=== OBJEÇÕES E RESPOSTAS ===\n(3 pares: objeção real do decisor → resposta consultiva curta)\n=== CAMINHO PARA A REUNIÃO EXECUTIVA ===\n(a sequência do download do material até a conversa com o decisor: qual gatilho leva à reunião)\n=== CTAS RECOMENDADOS ===\n(principal e secundário, coerentes com o CTA da campanha)\n=== RISCOS DE COMUNICAÇÃO ===\n(o que evitar para não soar genérico nem queimar a conta)`;
  const secs = parseSections(val);
  return <div>
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div><Kicker>Etapa 3 · Inteligência</Kicker><H1>Análise estratégica</H1>
        <p style={{ margin: 0, color: C.mut, fontSize: 14, maxWidth: 640 }}>É o briefing central da campanha. A partir dela a IA escreve a landing page, a régua de e-mails e o conteúdo — por isso, gere, ajuste e salve antes de seguir para as próximas etapas.</p></div>
      <Btn onClick={() => gen('analise', prompt, async t => set(t))} disabled={loading === 'analise'}>
        {val ? '↻ Regenerar' : 'Gerar análise'}
      </Btn>
    </div>
    <div style={{ marginTop: 18 }}>
      {loading === 'analise' ? <Card><Spinner label="Gerando a análise estratégica…" /></Card>
        : val ? <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, background: '#EDF1F0', border: '1px solid #D3E0DE', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 12.5, color: '#1E4A50' }}>Esta análise alimenta automaticamente a landing page, a régua e o conteúdo. Salve para guardá-la na campanha.</div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Btn kind="ghost" onClick={() => setEdit(!edit)}>{edit ? 'Ver formatado' : 'Editar texto'}</Btn>
              <Btn kind="ghost" onClick={() => copy(val)}>Copiar tudo</Btn>
              <Btn onClick={() => savePiece('analise', val)}>Salvar</Btn>
            </div>
          </div>
          {edit
            ? <textarea value={val} onChange={e => set(e.target.value)} rows={24}
                style={{ width: '100%', border: '1px solid ' + C.line, borderRadius: 12, padding: '18px 20px', fontSize: 13.5, lineHeight: 1.65, background: C.card, resize: 'vertical', fontFamily: 'inherit' }} />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {secs.length ? secs.map((s, i) => <Card key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700, color: C.gold }}>{s.label}</div>
                    <Btn kind="soft" onClick={() => copy(s.body)}>Copiar</Btn>
                  </div>
                  <div style={{ fontSize: 13.5, color: '#37474d', lineHeight: 1.7 }}><RichText text={s.body} /></div>
                </Card>) : <Card><div style={{ fontSize: 13.5, color: '#37474d', lineHeight: 1.7 }}><RichText text={val} /></div></Card>}
              </div>}
        </div>
          : <Card style={{ borderStyle: 'dashed', textAlign: 'center', padding: '44px 24px' }}>
            <div style={{ fontFamily: "'Source Serif 4',serif", fontSize: 17, fontWeight: 600 }}>Nenhuma análise gerada</div>
            <p style={{ fontSize: 13, color: C.mut, maxWidth: 540, margin: '8px auto 0' }}>Preencha a campanha e anexe os materiais, depois clique em “Gerar análise”. A IA devolve tese, perfil da conta-alvo, dores do decisor, dados do material, ângulo de autoridade, objeções, caminho para a reunião e riscos — e usa tudo isso para escrever as próximas etapas.</p>
          </Card>}
    </div>
  </div>;
}

// ---------------- Landing Page ----------------
function LandingPage({ cur, materials, pieces, setPieces, loading, ctx, gen, savePiece, flash }) {
  const val = pieces.lp || '';
  const prompt = `${ctx()}\n\nEscreva o CONTEÚDO COMPLETO da landing page para captura via download do material. Use exatamente estes marcadores de bloco, e escreva o texto final de cada um (sem instruções):\n=== HERO ===\n(título curto e forte, no máximo 8 palavras; depois o subtítulo em 1 frase; depois a frase do CTA)\n=== CONTEXTO ===\n=== DADOS ===\n(3 a 5 dados presentes nos materiais, cada linha começando pelo número)\n=== FRASE DE IMPACTO ===\n(uma única frase forte e memorável que resuma a tese da campanha; sem aspas, sem atribuição)\n=== DESAFIOS ===\n=== PARA QUEM É ===\n(liste apenas os cargos-alvo, um por linha começando com "- ", sem frase de introdução)\n=== O QUE VOCÊ ENCONTRA ===\n=== SOBRE A VENDAMAIS ===\n=== CONVERSA EXECUTIVA ===\n=== FORMULÁRIO ===\n(liste os campos, um por linha com "- ". Para escolha múltipla use "Campo: ( ) Opção A ( ) Opção B". Para o aceite, uma linha começando com "Aceito")`;
  function buildHtml() {
    const secs = parseSections(val);
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const md = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    const clean = s => String(s || '').replace(/^\s*[-•]\s*/, '').replace(/^\s*\*\s+/, '').replace(/^\s*\d+[.)]\s+/, '').trim();
    const rows = b => String(b || '').split('\n').map(x => x.trim()).filter(Boolean);
    const bullets = b => rows(b).filter(l => /^(?:[-•]\s|\*\s|\d+[.)])/.test(l)).map(clean);
    const paras = b => String(b || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => `<p>${md(p.replace(/\n/g, ' '))}</p>`).join('');
    const find = re => secs.find(s => re.test(s.label));
    const checkSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    const ig = (materials || []).find(m => m.tipo === 'infografico' && m.kind === 'image' && m.url);
    const heroSec = find(/hero/i);
    const heroLines = rows(heroSec ? heroSec.body : '');
    const heroTitle = clean(heroLines[0] || cur.nome || 'Special Report');
    const heroSub = heroLines.slice(1).filter(l => !/baixe|baixar|download/i.test(l)).map(clean).join(' ');
    const cta = (cur.cta_principal || 'Baixar o Special Report').replace(/[<>]/g, '');
    const periodo = [cur.segmento].filter(Boolean).join('') || 'Special Report';

    // ---- blocos ----
    const blocks = [];
    const wrap = (eyebrow, inner, tone) => `  <section class="band${tone ? ' ' + tone : ''}"><div class="wrap">${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}${inner}</div></section>`;

    secs.filter(s => !/hero|formul/i.test(s.label)).forEach(s => {
      const L = s.label, b = s.body;
      if (/dados|números|numeros|estat/i.test(L)) {
        const items = bullets(b).filter(t => /\d/.test(t)).map(t => {
          const m = t.match(/\d[\d.,]*\s*(?:%|milhões|milhão|mil|bilhões|bilhão)?/);
          const num = m ? m[0].trim() : '';
          let cap = num ? t.replace(num, '').replace(/^[\s—–-]+/, '').replace(/^(de|dos|das|no|na|nos|nas)\s+/i, '').trim() : t;
          return `<div class="stat"><div class="statn">${esc(num)}</div><div class="statc">${md(cap || t)}</div></div>`;
        }).join('');
        if (items) blocks.push(wrap(L, `<h2>Os números do setor</h2><div class="stats">${items}</div>`, 'soft'));
      } else if (/frase|impacto|destaque/i.test(L)) {
        const q = clean(rows(b).join(' '));
        if (q) blocks.push(`  <section class="pull"><div class="wrap"><span class="qmark">“</span><p>${md(q)}</p></div></section>`);
      } else if (/desafi/i.test(L)) {
        const items = bullets(b).map((t, i) => `<div class="chal"><span class="cnum">${String(i + 1).padStart(2, '0')}</span><p>${md(t)}</p></div>`).join('');
        blocks.push(wrap(L, `<h2>Os desafios que abordamos</h2><div class="chals">${items}</div>`));
      } else if (/para quem/i.test(L)) {
        let chips = bullets(b);
        if (chips.length < 3) chips = String(b).split(/,| e | · /).map(x => clean(x)).filter(x => x.length > 2 && x.length < 34 && x.split(' ').length <= 4 && !/[.:]$/.test(x) && !/\b(que|buscam|buscando|melhorar|para|com|visando|fortalecer|aprimorar)\b/i.test(x));
        const inner = chips.length >= 3
          ? `<h2>Para quem é este material</h2><div class="chips">${chips.map(c => `<span class="chip">${md(c)}</span>`).join('')}</div>`
          : `<h2>Para quem é este material</h2>${paras(b)}`;
        blocks.push(wrap(L, inner, 'soft'));
      } else if (/o que voc|encontra|conteúdo|conteudo/i.test(L)) {
        const bl = bullets(b);
        const intro = rows(b).find(l => !/^(?:[-•]\s|\*\s|\d+[.)])/.test(l));
        const items = (bl.length ? bl : rows(b).map(clean)).map(t => `<li><span class="ck">${checkSvg}</span><span>${md(t)}</span></li>`).join('');
        blocks.push(wrap(L, `<h2>O que você vai encontrar</h2>${intro ? `<p class="lead">${md(clean(intro))}</p>` : ''}<ul class="checks">${items}</ul>`));
      } else if (/sobre/i.test(L)) {
        blocks.push(wrap(L, `<h2>Sobre a VendaMais</h2>${paras(b)}`, 'soft'));
      } else if (/conversa|reuni|execut/i.test(L)) {
        blocks.push(`  <section class="band ctaband"><div class="wrap"><div class="eyebrow gold">${esc(L)}</div><h2>${md(clean(rows(b)[0] || 'Vamos conversar'))}</h2><div class="ctatext">${paras(b)}</div><a class="cta" href="#form">${esc(cta)} →</a></div></section>`);
      } else if (/contexto/i.test(L)) {
        blocks.push(wrap('', `<p class="lead">${md(clean(rows(b).join(' ')))}</p>`));
      } else {
        blocks.push(wrap(L, paras(b)));
      }
    });

    // ---- formulário ----
    const formSec = find(/formul/i);
    let fields = bullets(formSec ? formSec.body : '');
    if (!fields.length) fields = ['Nome completo', 'Cargo', 'Empresa', 'E-mail corporativo', 'Telefone (opcional)'];
    const formTitle = formSec ? (rows(formSec.body).find(l => !/^[-•*]/.test(l) && !/^\d/.test(l) && !/\[/.test(l)) || '') : '';
    const inputs = fields.filter(f => !/\[|bot(ã|a)o|^\s*cta/i.test(f)).map(f => {
      if (/aceito|concordo|autorizo|receber comunica|pol[ií]tica de privac|lgpd|consinto/i.test(f))
        return `<label class="chk"><input type="checkbox" name="consentimento"><span>${md(clean(f))}</span></label>`;
      const label = f.split(':')[0].replace(/\s*\(opcional\)/i, '').trim();
      const req = !/opcional/i.test(f);
      const hasOpts = /\(\s*\)/.test(f);
      const simnao = /\(?\s*sim\s*\/\s*n(ã|a)o\s*\)?/i.test(f) || /gostaria|agendar/i.test(f);
      if (hasOpts) {
        const opts = f.slice(f.indexOf(':') + 1).split(/\(\s*\)/).map(x => x.trim().replace(/[.;,]$/, '')).filter(Boolean);
        return `<label class="fld"><span>${esc(label)}</span><select name="${esc(label)}"><option value="">Selecione</option>${opts.map(o => `<option>${esc(o)}</option>`).join('')}</select></label>`;
      }
      if (simnao)
        return `<label class="fld"><span>${esc(label)}</span><select name="${esc(label)}"><option value="">Selecione</option><option>Sim</option><option>Não</option></select></label>`;
      const type = /mail/i.test(f) ? 'email' : /telefone|fone|whats/i.test(f) ? 'tel' : 'text';
      return `<label class="fld"><span>${esc(label)}${req ? '' : ' <em>(opcional)</em>'}</span><input type="${type}" name="${esc(label)}" ${req ? 'required' : ''} placeholder="${esc(label)}"></label>`;
    }).join('');
    const formHtml = `  <section class="band" id="form"><div class="wrap"><div class="formcard"><div class="formcopy"><div class="eyebrow gold">Download gratuito</div><h2>${md(clean(formTitle) || 'Receba o Special Report')}</h2><p>Preencha os campos para receber o material no seu e-mail.</p></div><form onsubmit="event.preventDefault();this.querySelector('.cta').textContent='Enviado ✓';">${inputs}<button type="submit" class="cta full">${esc(cta)}</button><p class="priv">Ao enviar, você concorda com nossa Política de Privacidade. Seus dados não serão compartilhados.</p></form></div></div></section>`;

    const figHtml = ig ? `  <section class="band figband"><div class="wrap"><div class="eyebrow">Do relatório</div><h2>Uma amostra do material</h2><figure class="figure"><img src="${esc(ig.url)}" alt="Infográfico do Special Report" loading="lazy"><figcaption>Infográfico exclusivo incluído no Special Report.</figcaption></figure></div></section>` : '';

    const css = `*{box-sizing:border-box}body{margin:0;font-family:'Karla',-apple-system,system-ui,sans-serif;color:#1D2C31;background:#F7F5EF;line-height:1.6;-webkit-font-smoothing:antialiased}
h1,h2{font-family:'Playfair Display',Georgia,serif;font-weight:700;letter-spacing:-.01em;margin:0}
.wrap{max-width:1000px;margin:0 auto;padding:0 28px}
.eyebrow{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#9C7B37;font-weight:700;margin-bottom:14px}
.eyebrow.gold{color:#C9A45B}
.hero{background:linear-gradient(155deg,#122831 0%,#1E3E49 100%);color:#F4F2EC;padding:72px 0 84px;position:relative;overflow:hidden}
.hero:before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:44px 44px;opacity:.6}
.hero:after{content:'';position:absolute;right:-160px;top:-120px;width:460px;height:460px;border-radius:50%;background:radial-gradient(circle,rgba(201,164,91,.25),transparent 70%)}
.herogrid{display:grid;grid-template-columns:1.12fr .88fr;gap:52px;align-items:center;position:relative;z-index:1}
.hero .brand{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#fff;margin-bottom:26px}
.hero .eyebrow{color:#C9A45B}
.hero h1{font-size:44px;line-height:1.12;color:#fff}
.hero .sub{font-size:18px;color:#CBD8DC;margin:20px 0 0;line-height:1.55}
.hcover{display:flex;justify-content:center}
.cover{position:relative;width:270px;min-height:356px;background:linear-gradient(180deg,#FBFAF6,#ECE7DA);border-radius:10px;box-shadow:0 34px 70px rgba(0,0,0,.45);padding:32px 28px;border-left:9px solid #C9A45B;transform:rotate(-2.2deg)}
.cover-tag{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9C7B37;font-weight:700}
.cover-title{font-family:'Playfair Display',serif;font-size:24px;line-height:1.22;font-weight:700;margin-top:14px;color:#142B33}
.cover-foot{position:absolute;left:28px;right:28px;bottom:26px;display:flex;justify-content:space-between;font-size:12px;color:#5C6A70;border-top:1px solid #E0DAC9;padding-top:12px}
.cover-foot span:first-child{font-family:'Playfair Display',serif;font-weight:700;color:#142B33}
.cover-badge{position:absolute;top:-13px;right:-13px;background:#C9A45B;color:#142B33;font-weight:800;font-size:12px;padding:7px 11px;border-radius:8px;box-shadow:0 8px 20px rgba(0,0,0,.3)}
.cta{display:inline-block;background:#C9A45B;color:#142B33;font-weight:700;font-family:'Karla',sans-serif;padding:15px 30px;border-radius:9px;margin-top:34px;text-decoration:none;font-size:15px;border:none;cursor:pointer;transition:background .15s,transform .15s}
.cta:hover{background:#d8b775;transform:translateY(-1px)}
.cta.full{width:100%;text-align:center;margin-top:8px;font-size:16px;padding:16px}
.band{padding:64px 0;border-bottom:1px solid #E7E2D5}
.band.soft{background:#EFEBE0}
h2{font-size:31px;line-height:1.2;margin-bottom:22px;max-width:640px}
.band p{font-size:16px;color:#3B4A50;margin:0 0 14px;max-width:720px}
.lead{font-size:19px !important;color:#2A3A40 !important;line-height:1.6;max-width:760px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:18px;margin-top:6px}
.stat{background:#fff;border:1px solid #E7E2D5;border-top:3px solid #C9A45B;border-radius:14px;padding:24px 24px}
.statn{font-family:'Playfair Display',serif;font-size:38px;font-weight:800;color:#1E3E49;line-height:1}
.statc{font-size:14px;color:#5C6A70;margin-top:10px;line-height:1.5}
.chals{display:grid;gap:14px;margin-top:6px}
.chal{display:flex;gap:18px;align-items:flex-start;background:#fff;border:1px solid #E7E2D5;border-radius:12px;padding:20px 22px}
.cnum{font-family:'Playfair Display',serif;font-size:22px;font-weight:800;color:#C9A45B;min-width:34px}
.chal p{margin:0;font-size:16px;color:#2F3E44}
.chips{display:flex;flex-wrap:wrap;gap:10px}
.chip{background:#fff;border:1px solid #D9D2C2;border-radius:999px;padding:9px 18px;font-size:14px;font-weight:600;color:#33474E}
.checks{list-style:none;padding:0;margin:8px 0 0;display:grid;gap:12px}
.checks li{display:flex;gap:13px;align-items:flex-start;font-size:16px;color:#2F3E44}
.ck{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#E7EEEC;color:#1E3E49;font-size:13px;font-weight:800;flex-shrink:0;margin-top:1px}
.band h2::after{content:'';display:block;width:46px;height:3px;background:#C9A45B;border-radius:2px;margin-top:16px}
.ctaband h2::after,.formcopy h2::after,.figband h2::after{margin-left:auto;margin-right:auto}
.pull{background:#122831;color:#fff;text-align:center;padding:60px 0;border:none}
.pull .qmark{font-family:'Playfair Display',serif;font-size:64px;color:#C9A45B;line-height:0;display:block;height:24px}
.pull p{font-family:'Playfair Display',serif;font-size:29px;line-height:1.36;max-width:800px;margin:0 auto;color:#fff;font-weight:600}
.figband{text-align:center}
.figband h2{margin-left:auto;margin-right:auto}
.figure{margin:26px auto 0;max-width:760px;border-radius:16px;overflow:hidden;border:1px solid #E7E2D5;background:#fff;box-shadow:0 24px 60px rgba(20,43,51,.1)}
.figure img{display:block;width:100%;height:auto}
.figure figcaption{padding:13px 20px;font-size:13px;color:#5C6A70;border-top:1px solid #E7E2D5}
.ctaband{background:linear-gradient(155deg,#142B33,#1E3E49);color:#fff;text-align:center;border:none}
.caband .eyebrow,.cataband .eyebrow{color:#C9A45B}
.ctaband h2{color:#fff;margin:0 auto 16px}
.ctatext p{color:#CBD8DC;margin:0 auto 6px;max-width:600px}
.formcard{background:#fff;border:1px solid #E7E2D5;border-radius:18px;padding:44px;max-width:640px;margin:0 auto;box-shadow:0 24px 60px rgba(20,43,51,.08)}
.formcopy{text-align:center;margin-bottom:26px}
.formcopy h2{margin:0 auto 8px}
.formcopy p{margin:0 auto;color:#5C6A70;font-size:15px}
.fld{display:block;margin-bottom:15px}
.fld span{display:block;font-size:13px;font-weight:700;color:#3B4A50;margin-bottom:6px}
.fld em{color:#8B8878;font-weight:400;font-style:normal}
.fld input,.fld select{width:100%;border:1px solid #D2CBBB;border-radius:9px;padding:12px 14px;font-size:15px;font-family:inherit;background:#FBFAF6;color:#1D2C31}
.fld input:focus,.fld select:focus{outline:none;border-color:#C9A45B;box-shadow:0 0 0 3px rgba(201,164,91,.18)}
.chk{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;color:#3B4A50;margin:4px 0 15px;font-weight:500;line-height:1.5}
.chk input{margin-top:2px;width:16px;height:16px;flex-shrink:0;accent-color:#C9A45B}
.priv{font-size:12px;color:#8B8878;text-align:center;margin-top:14px}
footer{background:#142B33;color:#8AA2A9;padding:34px 0;font-size:13px}
footer .wrap{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}
footer .fb{font-family:'Playfair Display',serif;color:#fff;font-size:16px;font-weight:700}
@media(max-width:820px){.herogrid{grid-template-columns:1fr;gap:38px}.cover{transform:none}}
@media(max-width:640px){.hero{padding:56px 0 64px}.hero h1{font-size:33px}h2{font-size:25px}.band{padding:46px 0}.formcard{padding:28px}.pull p{font-size:23px}}`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(cur.nome || 'Landing page')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Karla:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${css}</style></head>
<body>
  <header class="hero"><div class="wrap herogrid"><div class="htext"><div class="brand">VendaMais</div><div class="eyebrow">${esc(periodo)}</div><h1>${md(heroTitle)}</h1>${heroSub ? `<p class="sub">${md(heroSub)}</p>` : ''}<a class="cta" href="#form">${esc(cta)} →</a></div><div class="hcover"><div class="cover"><span class="cover-badge">PDF</span><span class="cover-tag">Special Report</span><div class="cover-title">${md(heroTitle)}</div><div class="cover-foot"><span>VendaMais</span><span>${esc(periodo)}</span></div></div></div></div></header>
  <main>
${figHtml}
${blocks.join('\n')}
${formHtml}
  </main>
  <footer><div class="wrap"><span class="fb">VendaMais</span><span>vendamais.com.br · Política de Privacidade</span></div></footer>
</body></html>`;
    return html;
  }
  function exportHtml() { download((cur.nome || 'landing-page').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.html', buildHtml(), 'text/html'); flash('HTML da landing page baixado.'); }
  function previewHtml() { const w = window.open('', '_blank'); if (!w) { flash('Permita pop-ups para ver a prévia.'); return; } w.document.open(); w.document.write(buildHtml()); w.document.close(); }
  return <div>
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div><Kicker>Etapa 4 · Produção</Kicker><H1>Landing page</H1>
        <p style={{ margin: 0, color: C.mut, fontSize: 14, maxWidth: 620 }}>A IA escreve os blocos a partir da estratégia. Veja a prévia da página desenhada e baixe o HTML pronto para o WordPress.</p></div>
      <Btn onClick={() => gen('lp', prompt, async t => setPieces(p => ({ ...p, lp: t })))} disabled={loading === 'lp'}>{val ? '↻ Regenerar' : 'Gerar landing page'}</Btn>
    </div>
    <div style={{ marginTop: 18 }}>
      {loading === 'lp' ? <Card><Spinner /></Card>
        : val ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea value={val} onChange={e => setPieces(p => ({ ...p, lp: e.target.value }))} rows={22}
            style={{ width: '100%', border: '1px solid ' + C.line, borderRadius: 12, padding: '18px 20px', fontSize: 13.5, lineHeight: 1.65, background: C.card, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn kind="ghost" onClick={() => copy(val)}>Copiar texto</Btn>
            <Btn kind="ghost" onClick={previewHtml}>Ver prévia da página</Btn>
            <Btn kind="ghost" onClick={exportHtml}>Baixar HTML</Btn>
            <Btn onClick={() => savePiece('lp', val)}>Salvar</Btn>
          </div>
        </div>
          : <Card style={{ borderStyle: 'dashed', textAlign: 'center', padding: '44px 24px' }}>
            <div style={{ fontFamily: "'Source Serif 4',serif", fontSize: 17, fontWeight: 600 }}>Nenhuma landing page gerada</div>
            <p style={{ fontSize: 13, color: C.mut, maxWidth: 500, margin: '8px auto 0' }}>Clique em “Gerar landing page”. A IA escreve todos os blocos a partir da estratégia e dos materiais.</p>
          </Card>}
    </div>
  </div>;
}

// ---------------- Régua ----------------
function Regua({ pieces, setPieces, loading, ctx, gen, savePiece, flash }) {
  const [editing, setEditing] = useState({});
  const val = pieces.regua || '';
  const aprov = Array.isArray(pieces.regua_aprov) ? pieces.regua_aprov : [];
  const secs = parseSections(val);
  const serialize = list => list.map(s => `=== ${s.label} ===\n${s.body}`).join('\n\n');
  const CAMPOS = 'Objetivo:\nAssunto:\nPré-header:\nCorpo do e-mail:\nCTA principal:\nCTA secundário:\nCondição de pausa:\nTarefa comercial sugerida:\nObservação interna:';
  const prompt = `${ctx()}\n\n${ACIONAVEL}\n\nEscreva a RÉGUA DE E-MAILS (5 e-mails) para quem baixou o Special Report. A régua conduz o lead a: consumir o material, reconhecer os desafios na própria cooperativa, perceber que exigem método e desenvolvimento comercial, conhecer o Power Cooperativismo e pedir uma conversa executiva. Consultiva, executiva e humana — jamais termine com "estamos à disposição".\nUse EXATAMENTE estes marcadores e, dentro de cada um, EXATAMENTE estes rótulos (um por linha):\n=== E-MAIL 1 — Entrega do Special Report (envio: imediato) ===\n=== E-MAIL 2 — Tensão central (envio: D+2) ===\n=== E-MAIL 3 — Execução comercial (envio: D+5) ===\n=== E-MAIL 4 — Power Cooperativismo (envio: D+8) ===\n=== E-MAIL 5 — Convite para conversa (envio: D+12) ===\nCampos de cada e-mail:\n${CAMPOS}\n\nIntenção — E-MAIL 1: entrega o material, aponta que ele serve para discutir prioridade comercial e termina com uma pergunta concreta (ex.: "dos 10 desafios, qual mais aparece na sua realidade?"); não vende. E-MAIL 2: aprofunda a tensão de principalidade — presença, capilaridade e base grande não garantem principalidade. E-MAIL 3: mostra que muitos desafios são comerciais (gestão ativa de carteira, gerente consultivo, rotina, abordagem, recomendação); começa a conectar com desenvolvimento de equipe, sem vender. E-MAIL 4: apresenta o Power Cooperativismo como caminho prático, citando temas como ${POWER_TEMAS}. E-MAIL 5: convite leve para uma conversa executiva de 30 minutos, sem pressão. Use {nome} e {empresa} como variáveis. Corpo de cada e-mail com no máximo 5 parágrafos curtos.`;

  function regenOne(i) {
    const sec = secs[i];
    const p = `${ctx()}\n\n${ACIONAVEL}\n\nReescreva SOMENTE o conteúdo deste e-mail da régua: "${sec.label}". Mantenha EXATAMENTE os mesmos rótulos, um por linha:\n${CAMPOS}\nNão inclua o marcador ===. Tom consultivo e humano, próximo passo claro, conexão com o Power Cooperativismo quando fizer sentido. Use {nome} e {empresa}.`;
    gen('regua_' + i, p, async t => {
      const body = t.replace(/^\s*===.*$/gm, '').trim();
      setPieces(pp => ({ ...pp, regua: serialize(secs.map((x, j) => j === i ? { ...x, body } : x)) }));
    });
  }
  function editBody(i, text) {
    setPieces(pp => ({ ...pp, regua: serialize(secs.map((x, j) => j === i ? { ...x, body: text } : x)) }));
  }
  function toggleAprov(label) {
    setPieces(pp => ({ ...pp, regua_aprov: aprov.includes(label) ? aprov.filter(l => l !== label) : [...aprov, label] }));
  }
  async function saveAll() { await savePiece('regua', val); if (aprov.length || pieces.regua_aprov) await savePiece('regua_aprov', aprov); }

  return <div>
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div><Kicker>Etapa 5 · Nutrição</Kicker><H1>Régua de e-mails</H1>
        <p style={{ margin: 0, color: C.mut, fontSize: 14, maxWidth: 640 }}>5 e-mails consultivos para configurar no Bitrix. Cada um conduz o lead — do download à conversa executiva — com objetivo, prazo, CTAs, pausa e tarefa comercial. Edite, regenere ou aprove cada e-mail.</p></div>
      <Btn onClick={() => gen('regua', prompt, async t => setPieces(p => ({ ...p, regua: t, regua_aprov: [] })))} disabled={loading === 'regua'}>{val ? '↻ Regenerar tudo' : 'Gerar régua'}</Btn>
    </div>
    <div style={{ marginTop: 18 }}>
      {loading === 'regua' ? <Card><Spinner label="Escrevendo os 5 e-mails…" /></Card>
        : val ? <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {secs.map((s, i) => {
            const ap = aprov.includes(s.label);
            const busy = loading === 'regua_' + i;
            const ed = editing[i];
            return <Card key={i} style={{ borderLeft: '4px solid ' + (ap ? C.green : C.line) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{s.label}</div>
                  {ap && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.green, background: C.greenBg, borderRadius: 999, padding: '3px 9px' }}>✓ Aprovado</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Btn kind="soft" onClick={() => regenOne(i)} disabled={busy}>{busy ? '…' : '↻ Regenerar'}</Btn>
                  <Btn kind="soft" onClick={() => copy(s.body)}>Copiar</Btn>
                  <Btn kind="soft" onClick={() => setEditing(e => ({ ...e, [i]: !e[i] }))}>{ed ? 'Ver' : 'Editar'}</Btn>
                  <Btn kind="soft" onClick={() => toggleAprov(s.label)} style={{ color: ap ? C.mut : C.green }}>{ap ? 'Desfazer' : 'Aprovar'}</Btn>
                </div>
              </div>
              {busy ? <Spinner label="Reescrevendo este e-mail…" />
                : ed ? <textarea value={s.body} onChange={e => editBody(i, e.target.value)} rows={16}
                    style={{ width: '100%', border: '1px solid ' + C.line, borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 1.6, background: '#FBFAF6', resize: 'vertical', fontFamily: 'inherit' }} />
                  : <Fields body={s.body} />}
            </Card>;
          })}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn kind="ghost" onClick={() => copy(val)}>Copiar tudo</Btn>
            <Btn onClick={saveAll}>Salvar régua</Btn>
          </div>
        </div>
          : <Card style={{ borderStyle: 'dashed', textAlign: 'center', padding: '44px 24px' }}>
            <div style={{ fontFamily: "'Source Serif 4',serif", fontSize: 17, fontWeight: 600 }}>Nenhuma régua gerada</div>
            <p style={{ fontSize: 13, color: C.mut, maxWidth: 520, margin: '8px auto 0' }}>Clique em “Gerar régua”. A IA escreve os 5 e-mails consultivos — do download à conversa executiva — cada um com objetivo, assunto, pré-header, corpo, CTAs, condição de pausa e tarefa comercial.</p>
          </Card>}
    </div>
  </div>;
}

// ---------------- Conteúdo ----------------
function Conteudo({ pieces, setPieces, loading, ctx, gen, savePiece, flash }) {
  const [tab, setTab] = useState('posts');
  const defs = {
    posts: {
      title: 'Posts orgânicos',
      prompt: `${ctx()}\n\n${ACIONAVEL}\n\nGere 4 POSTS ORGÂNICOS para LinkedIn. Use EXATAMENTE estes marcadores:\n=== POST 1 — Lançamento do Special Report ===\n=== POST 2 — Dado forte do setor ===\n=== POST 3 — Provocação executiva ===\n=== POST 4 — Conexão com treinamento ===\nEm CADA post use EXATAMENTE estes rótulos, um por linha:\nObjetivo:\nPúblico:\nGancho inicial:\nCopy completa:\nCTA:\nSugestão de imagem:\nFormato recomendado:\nObservação para agência:\nVersão curta:\nVersão alternativa (mais executiva):\nPOST 2 deve usar um dado real do relatório. POST 3 deve provocar diretores/superintendentes (ex.: "sua cooperativa cresce em base ou em principalidade?"). POST 4 conecta os desafios à necessidade de desenvolver a equipe comercial.`
    },
    briefing: {
      title: 'Briefing para agência',
      prompt: `${ctx()}\n\n${ACIONAVEL}\n\nTransforme a campanha em BRIEFINGS PARA A AGÊNCIA (4 peças). Marcadores:\n=== PEÇA 1 — Post de lançamento (estático) ===\n=== PEÇA 2 — Card de dado (estático) ===\n=== PEÇA 3 — Carrossel (LinkedIn) ===\n=== PEÇA 4 — Anúncio para a landing page ===\nEm CADA peça use EXATAMENTE estes rótulos, um por linha:\nFormato:\nCanal:\nObjetivo da peça:\nPúblico:\nMensagem central:\nTexto principal da arte:\nTexto secundário:\nCTA:\nSugestão visual:\nElementos obrigatórios:\nElementos que evitar:\nObservações de tom:\nDimensão sugerida:\nStatus:\nEm "Elementos que evitar" inclua: tom motivacional, excesso de texto, aparência genérica de banco e de e-book promocional. Status inicial: rascunho.`
    },
    carrossel: {
      title: 'Roteiro de carrossel',
      prompt: `${ctx()}\n\n${ACIONAVEL}\n\nGere o ROTEIRO DE CARROSSEL (8 slides) para a agência montar. Marcadores === SLIDE 1 — Capa === até === SLIDE 8 — CTA ===. Em CADA slide use EXATAMENTE estes rótulos, um por linha:\nObjetivo:\nTítulo:\nTexto principal:\nTexto de apoio:\nSugestão visual:\nObservação para o designer:\nEstrutura obrigatória: 1 Capa (título forte e específico), 2 Tensão (o problema principal), 3 Dado (um número do relatório), 4 Desafio comercial (não é só tecnologia/regulação), 5 Execução (equipe, carteira, abordagem, liderança), 6 Risco (o que acontece se ignorar), 7 Caminho (treinamento é processo, não evento), 8 CTA (baixar o Special Report / conhecer o Power Cooperativismo).`
    },
    ads: {
      title: 'Copies de anúncios',
      prompt: `${ctx()}\n\n${ACIONAVEL}\n\nGere COPIES DE ANÚNCIOS (5 variações). Marcadores:\n=== ANÚNCIO 1 — Download do Special Report ===\n=== ANÚNCIO 2 — Dado forte ===\n=== ANÚNCIO 3 — Retargeting ===\n=== ANÚNCIO 4 — Conhecer o Power Cooperativismo ===\n=== ANÚNCIO 5 — Conversa executiva ===\nEm CADA anúncio use EXATAMENTE estes rótulos, um por linha:\nObjetivo:\nPúblico:\nFormato recomendado:\nTítulo:\nTexto principal:\nDescrição:\nCTA:\nObservação de segmentação:\nUTM sugerida:`
    },
    pessoais: {
      title: 'Posts pessoais',
      prompt: `${ctx()}\n\n${ACIONAVEL}\n\nGere 2 POSTS PESSOAIS (autorais, primeira pessoa, para o perfil de um líder da VendaMais). Marcadores:\n=== POST PESSOAL — RAUL (reflexivo e provocativo) ===\n=== POST PESSOAL — FABIANO (execução comercial: treinamento, carteira, relacionamento) ===\nEm CADA um use EXATAMENTE estes rótulos, um por linha:\nObjetivo:\nGancho inicial:\nCopy completa:\nCTA:\nObservação:\nTom pessoal, sem parecer institucional; história ou observação real de mercado que conecte aos desafios do relatório.`
    },
    checklist: {
      title: 'Checklist de publicação',
      prompt: `${ctx()}\n\nGere um CHECKLIST DE PUBLICAÇÃO prático e específico desta campanha. Marcadores por frente:\n=== LINKEDIN (ORGÂNICO) ===\n=== LINKEDIN ADS ===\n=== LANDING PAGE / WORDPRESS ===\n=== RÉGUA / BITRIX ===\n=== MENSURAÇÃO ===\nEm cada frente, itens em lista começando com "- " — ações objetivas e verificáveis (o que publicar, conferir, configurar e medir).`
    }
  };
  const order = ['posts', 'briefing', 'carrossel', 'ads', 'pessoais', 'checklist'];
  const key = 'cont_' + tab;
  const val = pieces[key] || '';
  const d = defs[tab];
  const secs = parseSections(val);
  return <div>
    <Kicker>Etapa 6 · Conteúdo</Kicker><H1>Content Studio</H1>
    <p style={{ margin: '0 0 16px', color: C.mut, fontSize: 14, maxWidth: 660 }}>Copies prontas para publicar e briefings prontos para a agência — cada peça com função clara na campanha. Cada aba gera e salva de forma independente.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', background: '#EAE7DC', borderRadius: 10, padding: 4, gap: 2, marginBottom: 18 }}>
      {order.map(k => <button key={k} onClick={() => setTab(k)}
        style={{ background: tab === k ? C.deep : 'transparent', color: tab === k ? '#fff' : '#4C5B60', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{defs[k].title}</button>)}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
      <div style={{ fontSize: 12.5, color: C.mut }}>{tab === 'briefing' ? 'Formato pronto para enviar à agência como briefing de criação.' : tab === 'checklist' ? 'Passo a passo para colocar a campanha no ar.' : 'Gerado no tom consultivo da campanha, conectado ao Special Report.'}</div>
      <Btn onClick={() => gen(key, d.prompt, async t => setPieces(p => ({ ...p, [key]: t })))} disabled={loading === key}>{val ? '↻ Regenerar' : 'Gerar ' + d.title.toLowerCase()}</Btn>
    </div>
    {loading === key ? <Card><Spinner label={'Gerando ' + d.title.toLowerCase() + '…'} /></Card>
      : val ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {secs.map((s, i) => <Card key={i} style={{ borderLeft: '4px solid ' + C.gold2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{s.label}</div>
            <Btn kind="soft" onClick={() => copy(s.body)}>Copiar</Btn>
          </div>
          <Body body={s.body} />
        </Card>)}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn kind="ghost" onClick={() => copy(val)}>Copiar tudo</Btn>
          <Btn onClick={() => savePiece(key, val)}>Salvar</Btn>
        </div>
      </div>
        : <Card style={{ borderStyle: 'dashed', textAlign: 'center', padding: '44px 24px' }}>
          <div style={{ fontFamily: "'Source Serif 4',serif", fontSize: 17, fontWeight: 600 }}>Nada gerado nesta aba</div>
          <p style={{ fontSize: 13, color: C.mut, maxWidth: 520, margin: '8px auto 0' }}>Clique em “Gerar {d.title.toLowerCase()}”. O conteúdo sai estruturado, com função clara na campanha.</p>
        </Card>}
  </div>;
}

// ---------------- Exportar ----------------
function Exportar({ cur, materials, pieces, flash }) {
  function exportJson() {
    const pkg = { campanha: cur, materiais: materials, pecas: pieces, exportado_em: new Date().toISOString() };
    download((cur.nome || 'campanha').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json', JSON.stringify(pkg, null, 2), 'application/json');
    flash('Pacote JSON da campanha baixado.');
  }
  const items = [['Análise estratégica', pieces.analise], ['Landing page', pieces.lp], ['Régua de e-mails', pieces.regua], ['Posts orgânicos', pieces.cont_posts], ['Briefing p/ agência', pieces.cont_briefing], ['Roteiro de carrossel', pieces.cont_carrossel], ['Copies de anúncios', pieces.cont_ads], ['Posts pessoais', pieces.cont_pessoais], ['Checklist de publicação', pieces.cont_checklist]];
  return <div>
    <Kicker>Etapa 7 · Exportação</Kicker><H1>Exportar campanha</H1>
    <p style={{ margin: '0 0 18px', color: C.mut, fontSize: 14, maxWidth: 600 }}>Baixe tudo o que foi gerado. A landing page tem export próprio em HTML na etapa Landing page.</p>
    <Card>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Status das peças</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map(([label, v], i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid ' + C.line2, paddingBottom: 7 }}>
          <span>{label}</span>
          <span style={{ color: v ? C.green : C.mut2, fontWeight: 600 }}>{v ? 'Gerada' : 'Pendente'}</span>
        </div>)}
      </div>
      <div style={{ marginTop: 16 }}><Btn onClick={exportJson}>Baixar pacote JSON da campanha</Btn></div>
    </Card>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
