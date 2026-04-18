const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { createClient } = require('@supabase/supabase-js');

const app = express();
<<<<<<< HEAD
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Configurações Supabase (Usando as chaves fornecidas pelo usuário)
const SUPABASE_URL = 'https://vhfjuttwavxuxeceffpa.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoZmp1dHR3YXZ4dXhlY2VmZnBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ4OTg3MywiZXhwIjoyMDkyMDY1ODczfQ.Q8OA-hb6-u9UTbHwbC5KsYirS7YvM94DfE9gGJG1lPY';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Garantir que os diretórios existam
fs.ensureDirSync(UPLOADS_DIR);
=======

// Definição de caminhos
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'chamados.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Garantir que os diretórios e arquivos existam
fs.ensureDirSync(UPLOADS_DIR);
fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(DATA_FILE)) {
    fs.writeJsonSync(DATA_FILE, []);
}
>>>>>>> 7830a19775881e9a8b4a028d7357bea174a9d9ad

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

<<<<<<< HEAD
// Login Simples (Mantido por compatibilidade)
=======
// Login Simples para administração
>>>>>>> 7830a19775881e9a8b4a028d7357bea174a9d9ad
app.post('/api/login', (req, res) => {
    const { usuario, senha } = req.body;
    if (usuario === 'adm' && senha === '1234') {
        res.status(200).json({ success: true, token: 'fake-jwt-token' });
    } else {
        res.status(401).json({ success: false, message: 'Usuário ou senha inválidos' });
    }
});

<<<<<<< HEAD
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
=======
// Listar Chamados (GET)
app.get('/api/chamados', async (req, res) => {
    try {
        const chamados = await fs.readJson(DATA_FILE);
        // Retorna ordenado por data (mais recentes primeiro)
        res.status(200).json(chamados.sort((a,b) => new Date(b.data) - new Date(a.data)));
>>>>>>> 7830a19775881e9a8b4a028d7357bea174a9d9ad
    } catch (error) {
        console.error("Erro ao listar chamados:", error);
        res.status(500).json({ error: 'Erro ao ler chamados do banco' });
    }
});

<<<<<<< HEAD
// Endpoint Público de Consulta (Seguro) - Busca no Supabase
app.get('/api/public/chamados/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const normalizedId = id.replace(/\D/g, '');

        const { data: resultados, error } = await supabase
            .from('chamados')
            .select('*')
            .or(`id_legado.eq.${id},protocolo.eq.${id},cpf.eq.${id},cpf.eq.${normalizedId}`);
=======
// Consulta Pública por ID, Protocolo ou CPF
app.get('/api/public/chamados/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const chamados = await fs.readJson(DATA_FILE);
        const searchId = id.replace(/\D/g, ''); // Para busca por CPF sem formatação

        const resultados = chamados.filter(c => 
            c.id === id || 
            c.protocolo === id || 
            (c.cpf && c.cpf.replace(/\D/g, '') === searchId)
        );
>>>>>>> 7830a19775881e9a8b4a028d7357bea174a9d9ad

        if (error) throw error;
        if (!resultados || resultados.length === 0) return res.status(404).json({ error: 'Nenhum chamado encontrado.' });

<<<<<<< HEAD
        const simplificados = resultados.map( chamado => ({
            id: chamado.id_legado || chamado.id,
            protocolo: chamado.protocolo || 'Aguardando Atendimento',
=======
        // Retorna apenas dados públicos
        const simplificados = resultados.map( chamado => ({
            id: chamado.id,
            protocolo: chamado.protocolo || 'Pendente',
>>>>>>> 7830a19775881e9a8b4a028d7357bea174a9d9ad
            status: chamado.status,
            observacao: chamado.observacao,
            data: chamado.data,
            assunto: chamado.assunto,
            nome: chamado.nome,
<<<<<<< HEAD
            cpf: chamado.cpf,
            email: chamado.email,
            telefone: chamado.telefone,
            numero: chamado.numero,
            descricao: chamado.descricao,
            categoria_id: chamado.categoria_id,
            historico: chamado.historico || [{ status: 'Aberto', data: chamado.data, observacao: 'Chamado registrado no sistema.' }]
=======
            historico: chamado.historico || []
>>>>>>> 7830a19775881e9a8b4a028d7357bea174a9d9ad
        }));

        res.status(200).json(simplificados);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao consultar chamado' });
    }
});

<<<<<<< HEAD
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
        let { status, observacao } = req.body;

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
            from: 'smtp_glpi@oabce.org.br',
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
=======
// Criar Chamado (POST)
>>>>>>> 7830a19775881e9a8b4a028d7357bea174a9d9ad
app.post('/api/chamados', upload.array('imagens', 4), async (req, res) => {
    try {
        const { nome, cpf, email, telefone, numero, assunto, descricao, categoria_id } = req.body;
        const arquivos = req.files || [];
<<<<<<< HEAD
        
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
=======
        const id = Date.now().toString();
        const dataAtual = new Date().toISOString();

        const novoChamado = {
            id,
            data: dataAtual,
>>>>>>> 7830a19775881e9a8b4a028d7357bea174a9d9ad
            nome,
            cpf,
            email,
            telefone,
            numero,
            assunto,
            categoria_id: categoria_id || null,
            descricao,
            status: 'Aberto',
            observacao: '',
            imagens: arquivos.map(f => `/uploads/${f.filename}`),
            protocolo: null, // Será gerado no primeiro atendimento
            historico: [
                {
                    status: 'Aberto',
                    data: dataAtual,
                    observacao: 'Chamado registrado no sistema com sucesso.'
                }
            ]
        };

<<<<<<< HEAD
        const { data, error } = await supabase
            .from('chamados')
            .insert(novoChamado)
            .select()
            .single();

        if (error) throw error;
        
        // Enviar E-mail
=======
        const chamados = await fs.readJson(DATA_FILE);
        chamados.push(novoChamado);
        await fs.writeJson(DATA_FILE, chamados);

        // Enviar E-mail de confirmação de abertura
>>>>>>> 7830a19775881e9a8b4a028d7357bea174a9d9ad
        const anexosFormatados = arquivos.map(file => ({
            filename: file.originalname,
            path: file.path
        }));

        const mailOptions = {
            from: 'smtp_glpi@oabce.org.br',
            replyTo: email,
<<<<<<< HEAD
            to: 'chamado@oabce.org.br',
            subject: `Novo Chamado: ${assunto} - ${protocoloGerado}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; color: #333; text-align: left;">
                    <h2 style="color: #8D3046;">Novo Chamado Aberto (#${protocoloGerado})</h2>
=======
            to: 'umadruginha@gmail.com',
            subject: `Novo Chamado: ${assunto} - ${nome}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; color: #333;">
                    <h2 style="color: #8D3046;">Novo Chamado Recebido (#${id})</h2>
                    <p><strong>Solicitante:</strong> ${nome}</p>
>>>>>>> 7830a19775881e9a8b4a028d7357bea174a9d9ad
                    <p><strong>Assunto:</strong> ${assunto}</p>
                    <hr>
                    <p>${descricao.replace(/\n/g, '<br>')}</p>
                    <hr>
                    <p style="font-size: 12px; color: #666;">Acesse o portal para acompanhar o status com seu CPF ou ID: ${id}</p>
                </div>
            `,
            attachments: anexosFormatados 
        };

<<<<<<< HEAD
        transporter.sendMail(mailOptions).catch(err => console.error("Erro ao enviar e-mail de criação:", err));

        res.status(200).json({ message: 'Chamado enviado e registrado!', id: protocoloGerado, protocolo: protocoloGerado });
=======
        await transporter.sendMail(mailOptions).catch(e => console.error("Erro e-mail:", e));
        
        res.status(200).json({ message: 'Chamado aberto com sucesso!', id });
>>>>>>> 7830a19775881e9a8b4a028d7357bea174a9d9ad

    } catch (error) {
        console.error("ERRO POST:", error);
        res.status(500).json({ error: error.message });
    }
});

<<<<<<< HEAD
app.listen(3000, () => console.log('Servidor rodando na porta 3000 com integração Supabase'));
=======
// Atualizar Chamado (PATCH)
app.patch('/api/chamados/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let { status, observacao } = req.body;

        if (observacao === '--') observacao = undefined;

        let chamados = await fs.readJson(DATA_FILE);
        const index = chamados.findIndex(c => c.id === id);

        if (index === -1) return res.status(404).json({ error: 'Chamado não encontrado' });

        const antigo = { ...chamados[index] };
        let statusMudou = false;

        if (status && status !== antigo.status) {
            chamados[index].status = status;
            statusMudou = true;

            // Gerar protocolo formal no primeiro atendimento
            if (status === 'Em Atendimento' && !chamados[index].protocolo) {
                const ano = new Date().getFullYear();
                const random = Math.floor(1000 + Math.random() * 9000);
                chamados[index].protocolo = `${ano}-CH${random}`;
            }
        }

        if (observacao !== undefined) chamados[index].observacao = observacao;

        // Histórico
        if (!chamados[index].historico) chamados[index].historico = [];
        if (statusMudou || (observacao !== undefined && observacao !== antigo.observacao)) {
            chamados[index].historico.push({
                status: chamados[index].status,
                data: new Date().toISOString(),
                observacao: observacao || (statusMudou ? 'Status alterado pelo suporte.' : 'Informações atualizadas.')
            });
        }

        await fs.writeJson(DATA_FILE, chamados);
        const atualizado = chamados[index];

        // Notificar por e-mail se houver mudança relevante
        const mailOptions = {
            from: 'smtp_glpi@oabce.org.br',
            to: atualizado.email,
            subject: `Atualização: ${atualizado.status} - Protocolo ${atualizado.protocolo || atualizado.id}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; color: #333;">
                    <h2 style="color: #254E70;">Olá, ${atualizado.nome}</h2>
                    <p>Seu chamado teve uma atualização de status: <strong>${atualizado.status}</strong></p>
                    <p><strong>Parecer Técnico:</strong> ${atualizado.observacao || 'Em análise.'}</p>
                </div>
            `
        };
        transporter.sendMail(mailOptions).catch(e => console.error("Erro e-mail update:", e));

        res.status(200).json(atualizado);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar' });
    }
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
>>>>>>> 7830a19775881e9a8b4a028d7357bea174a9d9ad
