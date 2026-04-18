-- 1. Tabela de Categorias (Para o campo Assunto)
CREATE TABLE IF NOT EXISTS public.categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT,
    cor TEXT DEFAULT '#8D3046', -- Cor para identificação visual
    ativo BOOLEAN DEFAULT true
);

-- Inserir categorias padrão
INSERT INTO public.categorias (nome, descricao) VALUES 
('INSS/GERID', 'Suporte relacionado ao sistema INSS/GERID'),
('CADASTRO SAP', 'Suporte relacionado ao cadastro no SAP'),
('HARDWARE', 'Problemas físicos em computadores ou periféricos'),
('SOFTWARE', 'Instalação ou erro em programas'),
('REDE/INTERNET', 'Problemas de conexão ou wifi'),
('OUTROS', 'Solicitações diversas')
ON CONFLICT (nome) DO NOTHING;

-- 2. Tabela de Chamados atualizada
CREATE TABLE IF NOT EXISTS public.chamados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data TIMESTAMPTZ DEFAULT now(),
    nome TEXT NOT NULL,
    cpf TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT,
    numero TEXT, -- Número OAB
    assunto TEXT NOT NULL, -- Pode ser texto ou FK para categorias
    categoria_id UUID REFERENCES public.categorias(id),
    descricao TEXT NOT NULL,
    status TEXT DEFAULT 'Aberto' NOT NULL,
    observacao TEXT,
    imagens TEXT[] DEFAULT '{}'::TEXT[],
    protocolo TEXT,
    historico JSONB DEFAULT '[]'::JSONB,
    id_legado TEXT,
    tecnico_atribuido TEXT -- Nome ou ID do técnico
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_chamados_cpf ON public.chamados(cpf);
CREATE INDEX IF NOT EXISTS idx_chamados_protocolo ON public.chamados(protocolo);
CREATE INDEX IF NOT EXISTS idx_chamados_id_legado ON public.chamados(id_legado);
CREATE INDEX IF NOT EXISTS idx_chamados_status ON public.chamados(status);

-- RLS
ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

-- Políticas Chamados
DROP POLICY IF EXISTS "Permitir inserção de chamados" ON public.chamados;
CREATE POLICY "Permitir inserção de chamados" ON public.chamados FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir consulta de chamados" ON public.chamados;
CREATE POLICY "Permitir consulta de chamados" ON public.chamados FOR SELECT USING (true);

DROP POLICY IF EXISTS "Atualização total para service_role" ON public.chamados;
CREATE POLICY "Atualização total para service_role" ON public.chamados FOR UPDATE USING (true);

-- Políticas Categorias (Leitura pública)
DROP POLICY IF EXISTS "Categorias visíveis para todos" ON public.categorias;
CREATE POLICY "Categorias visíveis para todos" ON public.categorias FOR SELECT USING (true);
