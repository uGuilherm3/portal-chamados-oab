const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Configurações Supabase (Usando as chaves fornecidas pelo usuário)
const SUPABASE_URL = 'https://vhfjuttwavxuxeceffpa.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoZmp1dHR3YXZ4dXhlY2VmZnBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ4OTg3MywiZXhwIjoyMDkyMDY1ODczfQ.Q8OA-hb6-u9UTbHwbC5KsYirS7YvM94DfE9gGJG1lPY';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Garantir que os diretórios existam
fs.ensureDirSync(UPLOADS_DIR);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuração do Multer para persistência em disco
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 4 * 1024 * 1024 } // Limite de 4MB por arquivo
});

const transporter = nodemailer.createTransport({
    host: 'cloud54.mailgrid.net.br',
    port: 587,
    secure: false,
    auth: {
        user: 'smtp_glpi@oabce.org.br',
        pass: '4h}E*Ub&CEcpXa'
    },
    tls: { rejectUnauthorized: false }
});

// Login Simples (Mantido por compatibilidade)
app.post('/api/login', (req, res) => {
    const { usuario, senha } = req.body;
    if (usuario === 'adm' && senha === '1234') {
        res.status(200).json({ success: true, token: 'fake-jwt-token' });
    } else {
        res.status(401).json({ success: false, message: 'Usuário ou senha inválidos' });
    }
});

// Listar Chamados (Busca do Supabase)
app.get('/api/chamados', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('chamados')
            .select('*')
            .order('data', { ascending: false });

        if (error) throw error;
        
        // Mapear id para id_legado para manter compatibilidade com o front se necessário
        // Mas o front provavelmente usa o 'id' retornado.
        res.status(200).json(data);
    } catch (error) {
        console.error("Erro ao listar chamados:", error);
        res.status(500).json({ error: 'Erro ao ler chamados do banco' });
    }
});

// Endpoint Público de Consulta (Seguro) - Busca no Supabase
app.get('/api/public/chamados/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const normalizedId = id.replace(/\D/g, '');

        const { data: resultados, error } = await supabase
            .from('chamados')
            .select('*')
            .or(`id_legado.eq.${id},protocolo.eq.${id},cpf.eq.${id},cpf.eq.${normalizedId}`);

        if (error) throw error;
        if (!resultados || resultados.length === 0) return res.status(404).json({ error: 'Nenhum chamado encontrado.' });

        const simplificados = resultados.map( chamado => ({
            id: chamado.id_legado || chamado.id,
            protocolo: chamado.protocolo || 'Aguardando Atendimento',
            status: chamado.status,
            observacao: chamado.observacao,
            data: chamado.data,
            assunto: chamado.assunto,
            nome: chamado.nome,
            cpf: chamado.cpf,
            email: chamado.email,
            telefone: chamado.telefone,
            numero: chamado.numero,
            descricao: chamado.descricao,
            categoria_id: chamado.categoria_id,
            imagens: chamado.imagens || chamado.imagen || [],
            historico: chamado.historico || [{ status: 'Aberto', data: chamado.data, observacao: 'Chamado registrado no sistema.' }]
        }));

        res.status(200).json(simplificados);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao consultar chamado' });
    }
});

// Listar Categorias (Público)
app.get('/api/public/categorias', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('categorias')
            .select('*')
            .eq('ativo', true)
            .order('nome');

        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar categorias' });
    }
});

// Atualizar Status/Observação do Chamado (No Supabase)
app.patch('/api/chamados/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let { status, observacao, prioridade } = req.body;

        // CORREÇÃO: Evitar "--" infinito ou observações vazias
        if (observacao === '--' || (observacao && observacao.trim() === '')) {
            observacao = null;
        }

        // Buscar chamado atual
        // Usamos aspas para garantir que o ID (UUID ou string) seja tratado corretamente na query OR
        const { data: chamadoAtual, error: fetchError } = await supabase
            .from('chamados')
            .select('*')
            .or(`id.eq."${id}",id_legado.eq."${id}"`)
            .single();

        if (fetchError || !chamadoAtual) return res.status(404).json({ error: 'Chamado não encontrado' });

        const updates = {};
        let statusMudou = false;

        if (status && status !== chamadoAtual.status) {
            updates.status = status;
            statusMudou = true;

            if (status === 'Em Atendimento' && !chamadoAtual.protocolo) {
                const ano = new Date().getFullYear();
                
                // Contar quantos chamados já possuem protocolo no ano atual para gerar o sequencial
                const { count, error: countError } = await supabase
                    .from('chamados')
                    .select('*', { count: 'exact', head: true })
                    .not('protocolo', 'is', null);

                const sequencial = (count || 0) + 1;
                updates.protocolo = `${ano}E${sequencial.toString().padStart(4, '0')}`;
            }
        }

        if (observacao !== null) updates.observacao = observacao;
        if (prioridade) updates.prioridade = prioridade;

        // Atualizar Histórico
        const historico = chamadoAtual.historico || [];
        if (statusMudou || (observacao !== null && observacao !== chamadoAtual.observacao)) {
            historico.push({
                status: updates.status || chamadoAtual.status,
                data: new Date().toISOString(),
                observacao: observacao || (statusMudou ? 'Status atualizado pelo técnico.' : 'Observação atualizada.')
            });
            updates.historico = historico;
        }

        const { data: chamadoAtualizado, error: updateError } = await supabase
            .from('chamados')
            .update(updates)
            .eq('id', chamadoAtual.id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Enviar E-mail de Notificação
        const mailOptions = {
            from: 'ti@oabce.org.br',
            to: chamadoAtualizado.email,
            subject: `Atualização de Chamado: ${chamadoAtualizado.status} - Protocolo ${chamadoAtualizado.protocolo || chamadoAtualizado.id}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; color: #333; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #8D3046;">Olá, ${chamadoAtualizado.nome}</h2>
                    <p>O status do seu chamado <strong>#${chamadoAtualizado.assunto}</strong> foi atualizado.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p><strong>Novo Status:</strong> <span style="color: #254E70;">${chamadoAtualizado.status}</span></p>
                    <p><strong>Protocolo:</strong> ${chamadoAtualizado.protocolo || 'Em processamento'}</p>
                    <p><strong>Resposta do Técnico:</strong></p>
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; font-style: italic;">
                        ${chamadoAtualizado.observacao || 'Sem observações adicionais.'}
                    </div>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #666;">Você pode consultar o status em tempo real no nosso portal utilizando seu protocolo.</p>
                </div>
            `
        };

        transporter.sendMail(mailOptions).catch(err => console.error("Erro ao enviar e-mail de atualização:", err));

        res.status(200).json(chamadoAtualizado);
    } catch (error) {
        console.error("Erro ao atualizar:", error);
        res.status(500).json({ error: 'Erro ao atualizar chamado' });
    }
});

// Resolver Pendência (Público) com suporte a arquivos
app.patch('/api/public/chamados/:id/resolver', upload.array('imagens', 4), async (req, res) => {
    try {
        const { id } = req.params;
        const { email, telefone, nova_observacao, cpf, nome, assunto, descricao, categoria_id } = req.body;
        const novosArquivos = req.files || [];

        // Buscar chamado atual
        console.log("Tentando resolver pendência para:", id);
        
        // Verifica se é um UUID válido para evitar erro de sintaxe do Postgres
        const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
        const orFilter = isUUID 
            ? `id.eq.${id},protocolo.eq.${id},id_legado.eq.${id}`
            : `protocolo.eq.${id},id_legado.eq.${id}`;

        const { data: chamado, error: fetchError } = await supabase
            .from('chamados')
            .select('*')
            .or(orFilter)
            .single();

        if (fetchError) {
            console.error("Erro Supabase Fetch:", fetchError);
            return res.status(404).json({ error: 'Chamado não encontrado' });
        }

        // Validação de Tamanho Total (4MB) incluindo novos arquivos
        const tamanhoNovos = novosArquivos.reduce((acc, f) => acc + f.size, 0);
        if (tamanhoNovos > 4 * 1024 * 1024) {
             return res.status(400).json({ error: 'O tamanho total dos novos anexos excede 4MB.' });
        }

        const updates = { 
            status: 'Pendencia Concluída',
            email: email || chamado.email,
            telefone: telefone || chamado.telefone,
            nome: nome || chamado.nome,
            cpf: cpf || chamado.cpf,
            assunto: assunto || chamado.assunto,
            descricao: descricao || chamado.descricao,
            categoria_id: categoria_id || chamado.categoria_id,
            imagens: [...(chamado.imagens || []), ...novosArquivos.map(f => `/uploads/${f.filename}`)]
        };

        // Adicionar ao histórico
        const historico = chamado.historico || [];
        historico.push({
            status: 'Pendencia Concluída',
            data: new Date().toISOString(),
            observacao: nova_observacao || 'O usuário atualizou os dados do chamado para resolver pendências.'
        });
        updates.historico = historico;

        const { data: atualizado, error: updateError } = await supabase
            .from('chamados')
            .update(updates)
            .eq('id', chamado.id)
            .select()
            .single();

        if (updateError) {
            console.error("Erro ao atualizar chamado no Supabase:", updateError);
            return res.status(500).json({ error: 'Erro ao salvar alterações no banco de dados' });
        }

        console.log("Chamado atualizado com sucesso para Pendencia Concluída:", atualizado.protocolo);
        res.status(200).json(atualizado);
    } catch (error) {
        console.error("Erro ao resolver:", error);
        res.status(500).json({ error: 'Erro ao resolver pendência' });
    }
});

// Criar Chamado (POST)
app.post('/api/chamados', upload.array('imagens', 4), async (req, res) => {
    try {
        const { nome, cpf, email, telefone, numero, assunto, descricao, categoria_id } = req.body;
        const arquivos = req.files || [];
        
        // Validação de Tamanho Total (4MB) no Servidor
        const tamanhoTotal = arquivos.reduce((acc, f) => acc + f.size, 0);
        if (tamanhoTotal > 4 * 1024 * 1024) {
            return res.status(400).json({ error: 'O tamanho total dos anexos excede 4MB.' });
        }

        const idGerado = Date.now().toString();
        const ano = new Date().getFullYear();

        // Gerar Protocolo Sequencial Imediato
        const { count, error: countError } = await supabase
            .from('chamados')
            .select('*', { count: 'exact', head: true });
        
        const sequencial = (count || 0) + 1;
        const protocoloGerado = `${ano}E${sequencial.toString().padStart(4, '0')}`;

        const novoChamado = {
            id_legado: idGerado,
            protocolo: protocoloGerado,
            data: new Date().toISOString(),
            nome,
            cpf,
            email,
            telefone,
            numero,
            assunto,
            categoria_id: categoria_id || null,
            descricao,
            status: 'Aberto',
            observacao: null,
            imagens: arquivos.map(f => `/uploads/${f.filename}`),
            historico: [
                {
                    status: 'Aberto',
                    data: new Date().toISOString(),
                    observacao: 'Chamado registrado no sistema com sucesso.'
                }
            ]
        };

        const { data, error } = await supabase
            .from('chamados')
            .insert(novoChamado)
            .select()
            .single();

        if (error) throw error;
        
        // Enviar E-mail
        const anexosFormatados = arquivos.map(file => ({
            filename: file.originalname,
            path: file.path
        }));

        const mailOptions = {
            from: 'smtp_glpi@oabce.org.br',
            replyTo: email,
            to: 'chamado@oabce.org.br',
            subject: `Novo Chamado: ${assunto} - ${protocoloGerado}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; color: #333; text-align: left;">
                    <h2 style="color: #8D3046;">Novo Chamado Aberto (#${protocoloGerado})</h2>
                    <p><strong>Assunto:</strong> ${assunto}</p>
                    <hr>
                    <p>${descricao.replace(/\n/g, '<br>')}</p>
                    <hr>
                    <p style="font-size: 12px; color: #666;">Acesse o portal para acompanhar o status com seu CPF ou ID: ${protocoloGerado}</p>
                </div>
            `,
            attachments: anexosFormatados 
        };

        transporter.sendMail(mailOptions).catch(err => console.error("Erro ao enviar e-mail de criação:", err));

        res.status(200).json({ message: 'Chamado enviado e registrado!', id: protocoloGerado, protocolo: protocoloGerado });

    } catch (error) {
        console.error("ERRO POST:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000 com integração Supabase'));
