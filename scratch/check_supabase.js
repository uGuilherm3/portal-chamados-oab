const https = require('https');

const token = 'sbp_e69c79c7a769e5b652c93c323c678c98846c2e7e';
const projectRef = 'vhfjuttwavxuxeceffpa';

const sql = `
-- Tabela de Chamados
CREATE TABLE IF NOT EXISTS public.chamados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data TIMESTAMPTZ DEFAULT now(),
    nome TEXT,
    cpf TEXT,
    email TEXT,
    telefone TEXT,
    numero TEXT,
    assunto TEXT,
    descricao TEXT,
    status TEXT DEFAULT 'Aberto',
    observacao TEXT,
    imagens TEXT[],
    protocolo TEXT,
    historico JSONB DEFAULT '[]'::jsonb,
    id_legado TEXT
);

CREATE INDEX IF NOT EXISTS idx_chamados_cpf ON public.chamados(cpf);
CREATE INDEX IF NOT EXISTS idx_chamados_protocolo ON public.chamados(protocolo);
CREATE INDEX IF NOT EXISTS idx_chamados_id_legado ON public.chamados(id_legado);

ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir inserção pública" ON public.chamados;
CREATE POLICY "Permitir inserção pública" ON public.chamados FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir consulta pública" ON public.chamados;
CREATE POLICY "Permitir consulta pública" ON public.chamados FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir atualização irrestrita" ON public.chamados;
CREATE POLICY "Permitir atualização irrestrita" ON public.chamados FOR UPDATE USING (true) WITH CHECK (true);
`;

// Note: The Management API doesn't have a direct SQL execution endpoint for users.
// We usually use the CLI or the SQL Editor.
// However, we can try to find if there's any other way or just report the status.
console.log("Tentando validar o token e o projeto...");

const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${projectRef}`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log("Projeto encontrado e Token válido!");
      console.log("Infelizmente a API de Gerenciamento do Supabase não permite executar SQL direto sem o CLI.");
      console.log("Por favor, cole o conteúdo de 'data/schema.sql' no SQL Editor do Supabase.");
    } else {
      console.log(`Erro ao validar: ${res.statusCode}`);
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.end();
