const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

const app = express();

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
    limits: { fileSize: 10 * 1024 * 1024 }
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

// Login Simples para administração
app.post('/api/login', (req, res) => {
    const { usuario, senha } = req.body;
    if (usuario === 'adm' && senha === '1234') {
        res.status(200).json({ success: true, token: 'fake-jwt-token' });
    } else {
        res.status(401).json({ success: false, message: 'Usuário ou senha inválidos' });
    }
});

// Listar Chamados (GET)
app.get('/api/chamados', async (req, res) => {
    try {
        const chamados = await fs.readJson(DATA_FILE);
        // Retorna ordenado por data (mais recentes primeiro)
        res.status(200).json(chamados.sort((a,b) => new Date(b.data) - new Date(a.data)));
    } catch (error) {
        res.status(500).json({ error: 'Erro ao ler chamados' });
    }
});

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

        if (resultados.length === 0) return res.status(404).json({ error: 'Nenhum chamado encontrado.' });

        // Retorna apenas dados públicos
        const simplificados = resultados.map( chamado => ({
            id: chamado.id,
            protocolo: chamado.protocolo || 'Pendente',
            status: chamado.status,
            observacao: chamado.observacao,
            data: chamado.data,
            assunto: chamado.assunto,
            nome: chamado.nome,
            historico: chamado.historico || []
        }));

        res.status(200).json(simplificados);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao consultar chamado' });
    }
});

// Criar Chamado (POST)
app.post('/api/chamados', upload.array('imagens', 4), async (req, res) => {
    try {
        const { nome, cpf, email, telefone, numero, assunto, descricao } = req.body;
        const arquivos = req.files || [];
        const id = Date.now().toString();
        const dataAtual = new Date().toISOString();

        const novoChamado = {
            id,
            data: dataAtual,
            nome,
            cpf,
            email,
            telefone,
            numero,
            assunto,
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

        const chamados = await fs.readJson(DATA_FILE);
        chamados.push(novoChamado);
        await fs.writeJson(DATA_FILE, chamados);

        // Enviar E-mail de confirmação de abertura
        const anexosFormatados = arquivos.map(file => ({
            filename: file.originalname,
            path: file.path
        }));

        const mailOptions = {
            from: 'smtp_glpi@oabce.org.br',
            replyTo: email,
            to: 'umadruginha@gmail.com',
            subject: `Novo Chamado: ${assunto} - ${nome}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; color: #333;">
                    <h2 style="color: #8D3046;">Novo Chamado Recebido (#${id})</h2>
                    <p><strong>Solicitante:</strong> ${nome}</p>
                    <p><strong>Assunto:</strong> ${assunto}</p>
                    <hr>
                    <p>${descricao.replace(/\n/g, '<br>')}</p>
                    <hr>
                    <p style="font-size: 12px; color: #666;">Acesse o portal para acompanhar o status com seu CPF ou ID: ${id}</p>
                </div>
            `,
            attachments: anexosFormatados 
        };

        await transporter.sendMail(mailOptions).catch(e => console.error("Erro e-mail:", e));
        
        res.status(200).json({ message: 'Chamado aberto com sucesso!', id });

    } catch (error) {
        console.error("ERRO POST:", error);
        res.status(500).json({ error: error.message });
    }
});

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