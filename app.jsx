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
  const prompt = `${ctx()}\n\nEscreva o CONTEÚDO COMPLETO da landing page para captura via download do material. Use exatamente estes marcadores de bloco, e escreva o texto final de cada um (sem instruções):\n=== HERO ===\n(título forte + subtítulo + frase do CTA)\n=== CONTEXTO ===\n=== DADOS ===\n(apenas dados presentes nos materiais)\n=== DESAFIOS ===\n=== PARA QUEM É ===\n=== O QUE VOCÊ ENCONTRA ===\n=== SOBRE A VENDAMAIS ===\n=== CONVERSA EXECUTIVA ===\n=== FORMULÁRIO ===\n(campos recomendados)`;
  function exportHtml() {
    const secs = parseSections(val);
    const hero = secs.find(s => /hero/i.test(s.label));
    const body = secs.filter(s => !/hero/i.test(s.label)).map(s =>
      `  <section style="padding:34px 40px;border-bottom:1px solid #EFECE4;max-width:820px;margin:0 auto">
    <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#9C7B37;font-weight:700">${s.label}</div>
    <div style="font-size:15px;line-height:1.65;color:#37474d;margin-top:8px;white-space:pre-line">${(s.body || '').replace(/</g, '&lt;')}</div>
  </section>`).join('\n');
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${(cur.nome || 'Landing page').replace(/</g, '')}</title>
<style>body{margin:0;font-family:Georgia,'Times New Roman',serif;color:#1D2C31;background:#fff}.vm-hero{background:#1E3A43;color:#F4F2EC;padding:72px 40px}.vm-hero h1{font-size:34px;line-height:1.25;max-width:720px;margin:0 auto}.vm-wrap{max-width:820px;margin:0 auto}.vm-cta{display:inline-block;background:#E8593B;color:#fff;font-weight:700;padding:14px 26px;border-radius:8px;margin-top:22px;text-decoration:none}</style></head>
<body>
  <div class="vm-hero"><div class="vm-wrap" style="white-space:pre-line">${((hero && hero.body) || 'Título da campanha').replace(/</g, '&lt;')}
  <a class="vm-cta" href="#form">${(cur.cta_principal || 'Baixar o material').replace(/</g, '')}</a></div></div>
${body}
  <footer style="padding:26px 40px;background:#1D2C31;color:#8AA2A9;font-size:12px;text-align:center">VendaMais · vendamais.com.br · Política de privacidade</footer>
</body></html>`;
    download((cur.nome || 'landing-page').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.html', html, 'text/html');
    flash('HTML da landing page baixado.');
  }
  return <div>
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div><Kicker>Etapa 4 · Produção</Kicker><H1>Landing page</H1>
        <p style={{ margin: 0, color: C.mut, fontSize: 14, maxWidth: 600 }}>A IA escreve os blocos; você edita e exporta o HTML pronto para colar no WordPress.</p></div>
      <Btn onClick={() => gen('lp', prompt, async t => setPieces(p => ({ ...p, lp: t })))} disabled={loading === 'lp'}>{val ? '↻ Regenerar' : 'Gerar landing page'}</Btn>
    </div>
    <div style={{ marginTop: 18 }}>
      {loading === 'lp' ? <Card><Spinner /></Card>
        : val ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea value={val} onChange={e => setPieces(p => ({ ...p, lp: e.target.value }))} rows={22}
            style={{ width: '100%', border: '1px solid ' + C.line, borderRadius: 12, padding: '18px 20px', fontSize: 13.5, lineHeight: 1.65, background: C.card, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn kind="ghost" onClick={() => copy(val)}>Copiar texto</Btn>
            <Btn kind="ghost" onClick={exportHtml}>Baixar HTML da página</Btn>
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
  const val = pieces.regua || '';
  const prompt = `${ctx()}\n\nEscreva uma RÉGUA DE RELACIONAMENTO de 5 e-mails, consultiva e não agressiva, para nutrir quem baixou o material. Pausa mental: cada e-mail deve fazer sentido isolado. Use exatamente estes marcadores:\n=== E-MAIL 1 (imediato) ===\n=== E-MAIL 2 (D+2) ===\n=== E-MAIL 3 (D+5) ===\n=== E-MAIL 4 (D+8) ===\n=== E-MAIL 5 (D+12) ===\nEm cada um escreva o ASSUNTO na primeira linha (prefixo "Assunto: ") e o corpo em seguida. Use {nome} e {empresa} como variáveis.`;
  const secs = parseSections(val);
  return <div>
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div><Kicker>Etapa 5 · Nutrição</Kicker><H1>Régua de e-mails</H1>
        <p style={{ margin: 0, color: C.mut, fontSize: 14, maxWidth: 600 }}>5 e-mails para configurar manualmente no Bitrix. Consultivos, com pausa se o lead responder.</p></div>
      <Btn onClick={() => gen('regua', prompt, async t => setPieces(p => ({ ...p, regua: t })))} disabled={loading === 'regua'}>{val ? '↻ Regenerar' : 'Gerar régua'}</Btn>
    </div>
    <div style={{ marginTop: 18 }}>
      {loading === 'regua' ? <Card><Spinner /></Card>
        : val ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {secs.map((s, i) => <Card key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.gold }}>{s.label}</div>
              <Btn kind="soft" onClick={() => copy(s.body)}>Copiar</Btn>
            </div>
            <div style={{ fontSize: 13, color: '#37474d', lineHeight: 1.65, whiteSpace: 'pre-line' }}>{s.body}</div>
          </Card>)}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn kind="ghost" onClick={() => copy(val)}>Copiar tudo</Btn>
            <Btn onClick={() => savePiece('regua', val)}>Salvar</Btn>
          </div>
        </div>
          : <Card style={{ borderStyle: 'dashed', textAlign: 'center', padding: '44px 24px' }}>
            <div style={{ fontFamily: "'Source Serif 4',serif", fontSize: 17, fontWeight: 600 }}>Nenhuma régua gerada</div>
            <p style={{ fontSize: 13, color: C.mut, maxWidth: 500, margin: '8px auto 0' }}>Clique em “Gerar régua”. A IA escreve os 5 e-mails no tom consultivo da VendaMais.</p>
          </Card>}
    </div>
  </div>;
}

// ---------------- Conteúdo ----------------
function Conteudo({ pieces, setPieces, loading, ctx, gen, savePiece, flash }) {
  const [tab, setTab] = useState('posts');
  const defs = {
    posts: { title: 'Posts orgânicos', prompt: `${ctx()}\n\nEscreva 4 POSTS para LinkedIn no tom sênior da VendaMais. Use marcadores:\n=== POST — INSTITUCIONAL ===\n=== POST — AUTOR SÊNIOR (pessoal) ===\n=== POST — DADO/PROVOCAÇÃO ===\n=== POST — REATIVAÇÃO (D+10) ===\nCada post com 3 a 5 parágrafos curtos, sem hashtags excessivas, sem emojis.` },
    ads: { title: 'Copies de anúncios', prompt: `${ctx()}\n\nEscreva copies de anúncio para LinkedIn Ads. Use marcadores:\n=== IMAGEM ÚNICA (tráfego p/ LP) ===\n=== DOCUMENT AD ===\n=== LEAD GEN FORM ===\n=== RETARGETING ===\nCada um com "Headline:", "Texto:" e "CTA:". Inclua uma variação B curta quando fizer sentido.` },
    carrossel: { title: 'Roteiro do carrossel', prompt: `${ctx()}\n\nEscreva o ROTEIRO de um carrossel de 8 slides para LinkedIn (a agência fará o layout). Use marcadores === SLIDE 1 === ... === SLIDE 8 ===. Em cada slide: no máximo 2 linhas de texto + uma linha "Visual:" com sugestão. Slide 1 = gancho, slide 8 = CTA.` }
  };
  const key = 'cont_' + tab;
  const val = pieces[key] || '';
  const d = defs[tab];
  const secs = parseSections(val);
  return <div>
    <Kicker>Etapa 6 · Conteúdo</Kicker><H1>Content Studio</H1>
    <p style={{ margin: '0 0 16px', color: C.mut, fontSize: 14, maxWidth: 600 }}>Posts, anúncios e roteiro do carrossel — gerados pela IA no tom da campanha.</p>
    <div style={{ display: 'inline-flex', background: '#EAE7DC', borderRadius: 10, padding: 4, gap: 2, marginBottom: 18 }}>
      {Object.entries(defs).map(([k, v]) => <button key={k} onClick={() => setTab(k)}
        style={{ background: tab === k ? C.deep : 'transparent', color: tab === k ? '#fff' : '#4C5B60', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{v.title}</button>)}
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
      <Btn onClick={() => gen(key, d.prompt, async t => setPieces(p => ({ ...p, [key]: t })))} disabled={loading === key}>{val ? '↻ Regenerar' : 'Gerar ' + d.title.toLowerCase()}</Btn>
    </div>
    {loading === key ? <Card><Spinner /></Card>
      : val ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {secs.map((s, i) => <Card key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.gold }}>{s.label}</div>
            <Btn kind="soft" onClick={() => copy(s.body)}>Copiar</Btn>
          </div>
          <div style={{ fontSize: 13, color: '#37474d', lineHeight: 1.65, whiteSpace: 'pre-line' }}>{s.body}</div>
        </Card>)}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn onClick={() => savePiece(key, val)}>Salvar</Btn>
        </div>
      </div>
        : <Card style={{ borderStyle: 'dashed', textAlign: 'center', padding: '44px 24px' }}>
          <div style={{ fontFamily: "'Source Serif 4',serif", fontSize: 17, fontWeight: 600 }}>Nada gerado ainda</div>
          <p style={{ fontSize: 13, color: C.mut, maxWidth: 500, margin: '8px auto 0' }}>Clique em “Gerar {d.title.toLowerCase()}”.</p>
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
  const items = [['Análise estratégica', pieces.analise], ['Landing page', pieces.lp], ['Régua de e-mails', pieces.regua], ['Posts', pieces.cont_posts], ['Anúncios', pieces.cont_ads], ['Carrossel', pieces.cont_carrossel]];
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
