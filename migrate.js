const { createClient } = require('@supabase/supabase-js');
const fs = require('fs-extra');
const path = require('path');

const SUPABASE_URL = 'https://vhfjuttwavxuxeceffpa.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoZmp1dHR3YXZ4dXhlY2VmZnBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ4OTg3MywiZXhwIjoyMDkyMDY1ODczfQ.Q8OA-hb6-u9UTbHwbC5KsYirS7YvM94DfE9gGJG1lPY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const DATA_FILE = path.join(__dirname, 'data', 'chamados.json');

async function migrate() {
    try {
        console.log('--- Iniciando Migração para o Supabase ---');
        
        if (!fs.existsSync(DATA_FILE)) {
            console.error('Arquivo chamados.json não encontrado!');
            return;
        }

        const chamados = await fs.readJson(DATA_FILE);
        console.log(`Encontrados ${chamados.length} chamados para migrar.`);

        for (const chamado of chamados) {
            console.log(`Migrando: ${chamado.protocolo || chamado.id}...`);

            // Mapear os dados para as colunas do banco
            const { data, nome, cpf, email, telefone, numero, assunto, descricao, status, observacao, imagens, protocolo, historico, id } = chamado;

            const { error } = await supabase
                .from('chamados')
                .upsert({
                    id_legado: id,
                    data: data,
                    nome: nome,
                    cpf: cpf,
                    email: email,
                    telefone: telefone,
                    numero: numero,
                    assunto: assunto,
                    descricao: descricao,
                    status: status,
                    observacao: observacao,
                    imagens: imagens || [],
                    protocolo: protocolo,
                    historico: historico || []
                }, { onConflict: 'id_legado' });

            if (error) {
                console.error(`Erro ao migrar ${id}:`, error.message);
            }
        }

        console.log('--- Migração Concluída com Sucesso! ---');

    } catch (err) {
        console.error('Erro fatal durante a migração:', err);
    }
}

migrate();
