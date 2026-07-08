# Manual de Publicação — Whale Hunting Campaign Builder · VendaMais

Este manual cobre: subir o sistema para o **GitHub**, publicar na **Vercel**, criar o banco no **Supabase** e onde colocar a **chave da OpenAI**.

---

## 0. O que você tem hoje

O arquivo `Whale Hunting Campaign Builder.dc.html` é a **interface completa e navegável** do sistema (15 telas, em branco, pronta para demonstração e teste de fluxo). As ações de IA e banco de dados são **simuladas** — os botões "Gerar com IA" mostram um aviso.

Há dois caminhos, e eles se complementam:

- **Caminho A (15 min):** publicar a interface na web como está — para testar, apresentar e validar o fluxo com a equipe.
- **Caminho B (projeto de desenvolvimento):** conectar IA (OpenAI), banco (Supabase) e uploads reais. É aqui que entram as chaves e variáveis de ambiente.

---

## Caminho A — Publicar a interface na web (GitHub + Vercel)

### Passo 1 · Baixar o projeto
Baixe o ZIP do projeto (botão de download no chat) e descompacte. Você precisa destes arquivos:

```
index.html          ← renomeie "Whale Hunting Campaign Builder.dc.html" para index.html
support.js
assets/logo-vendamais.png
```

> **Importante:** renomeie o arquivo principal para `index.html` (a Vercel abre esse nome automaticamente). Não mova o `support.js` nem a pasta `assets/` — o sistema depende deles nos mesmos lugares.

### Passo 2 · GitHub
1. Crie uma conta em **github.com** (se não tiver).
2. Clique em **New repository** → nome: `whale-hunting-campaign-builder` → marque **Private** → **Create repository**.
3. Na página do repositório, clique em **uploading an existing file**, arraste os 3 itens acima (incluindo a pasta `assets`) e clique em **Commit changes**.

### Passo 3 · Vercel
1. Crie uma conta em **vercel.com** usando **Continue with GitHub** (isso já conecta os dois).
2. Clique em **Add New… → Project** → selecione o repositório `whale-hunting-campaign-builder` → **Import**.
3. Não mude nenhuma configuração (Framework Preset: **Other**) → clique em **Deploy**.
4. Em ~1 minuto a Vercel entrega a URL pública, tipo `whale-hunting-campaign-builder.vercel.app`.

Para atualizar o sistema depois: substitua os arquivos no GitHub (novo commit) — a Vercel republica sozinha.

> **Acesso restrito:** para que só a equipe veja, use **Settings → Deployment Protection** na Vercel (recurso pago) ou mantenha a URL fora de divulgação. O repositório privado protege o código, não a URL.

---

## Caminho B — Conectar IA e banco (versão funcional)

Arquitetura recomendada: **Next.js hospedado na Vercel + Supabase + OpenAI**. Este caminho exige um desenvolvedor (ou o Claude Code) usando este protótipo como especificação de telas e fluxo.

### Passo 1 · Supabase (banco de dados + arquivos)
1. Crie conta em **supabase.com** → **New project** → nome `whale-hunting` → escolha região `South America (São Paulo)` → guarde a senha do banco.
2. Em **SQL Editor**, crie as tabelas iniciais:

```sql
create table campanhas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  segmento text,
  objetivo text,
  publico_alvo text,
  cargos text,
  solucao_principal text,
  solucoes_secundarias text,
  cta_principal text,
  restricoes text,
  status text default 'rascunho',
  periodo_inicio date,
  periodo_fim date,
  criada_em timestamptz default now()
);

create table materiais (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid references campanhas(id),
  tipo text,            -- special_report | infografico | radar | contas_alvo | outro
  arquivo_url text,
  texto_extraido text,
  observacoes text
);

create table pecas (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid references campanhas(id),
  tipo text,            -- analise | lp | obrigado | regua | post | anuncio | roteiro | carrossel_agencia
  conteudo jsonb,
  versao int default 1,
  status text default 'rascunho'
);

create table aprovacoes (
  id uuid primary key default gen_random_uuid(),
  peca_id uuid references pecas(id),
  aprovador text,
  acao text,            -- aprovado | ajustes | comentario
  comentario text,
  criada_em timestamptz default now()
);

create table resultados (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid references campanhas(id),
  semana date,
  metricas jsonb        -- impressões, cliques, leads, qualificados, super_pci, reunioes, propostas
);
```

3. Em **Storage**, crie um bucket `materiais` (privado) para os PDFs e infográficos.
4. Copie as credenciais em **Settings → API**:
   - **Project URL** → vira `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → vira `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → vira `SUPABASE_SERVICE_ROLE_KEY` (⚠ só no servidor, nunca no navegador)

### Passo 2 · OpenAI (onde colocar o código/chave)
1. Acesse **platform.openai.com** → faça login → menu **API keys** → **Create new secret key** → copie a chave (`sk-...`). Ela só aparece uma vez.
2. Em **Billing**, adicione um cartão e um limite mensal (ex.: US$ 20) — sem billing a API não responde.
3. **Onde a chave vai:** na **Vercel**, dentro do projeto → **Settings → Environment Variables** → adicione:

| Nome | Valor | Onde é usada |
|---|---|---|
| `OPENAI_API_KEY` | `sk-...` | Só no servidor (rotas de API) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | Navegador + servidor |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | Navegador + servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | Só no servidor |

4. **Regra de ouro:** a chave da OpenAI **nunca** vai no HTML, no JavaScript do navegador ou no GitHub. Ela vive apenas como variável de ambiente na Vercel, e as chamadas à OpenAI acontecem numa **rota de API** (ex.: `/api/gerar-analise`) que roda no servidor. O navegador chama a sua rota; a sua rota chama a OpenAI.

### Passo 3 · O que cada serviço faz

| Serviço | Papel no sistema |
|---|---|
| **GitHub** | Guarda o código e o histórico de versões |
| **Vercel** | Hospeda o site e executa as rotas de API (onde a OpenAI é chamada) |
| **Supabase** | Banco (campanhas, peças, aprovações, resultados) + storage dos PDFs |
| **OpenAI** | Gera análise estratégica, blocos da LP, régua, posts, copies e avaliação da peça da agência |

### Passo 4 · Ordem recomendada de implementação
1. Publicar o protótipo (Caminho A) e validar o fluxo com a equipe.
2. Criar Supabase + tabelas (acima).
3. Desenvolver a versão Next.js: começar por **Nova campanha → Materiais → Análise estratégica** (o coração do sistema), depois LP Builder e exportação, depois o resto.
4. Conectar OpenAI numa rota de API por vez, sempre com o padrão: *IA gera → humano edita → humano aprova*.

---

## Segurança — checklist rápido

- [ ] Repositório GitHub **privado**
- [ ] Nenhuma chave (`sk-...`, service_role) commitada no código — use só Environment Variables da Vercel
- [ ] Arquivo `.env.local` no `.gitignore` (no projeto Next.js)
- [ ] Bucket de materiais do Supabase **privado** (os PDFs são material estratégico)
- [ ] Formulários de LP com consentimento LGPD (já previsto no bloco Formulário)
- [ ] Limite de gasto mensal configurado na OpenAI

---

*Dúvidas comuns: se a Vercel mostrar página em branco, confira se o arquivo se chama `index.html` e se `support.js` e `assets/` subiram junto. Se a OpenAI retornar erro 429, é limite de billing.*
