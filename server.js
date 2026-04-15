const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const DATA_FILE = path.join(__dirname, 'data', 'chamados.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Garantir que os diretórios existam
fs.ensureDirSync(UPLOADS_DIR);
fs.ensureFileSync(DATA_FILE);
if (!fs.readFileSync(DATA_FILE, 'utf8')) {
    fs.writeJsonSync(DATA_FILE, []);
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configurando o Multer para salvar no disco
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
        pass: '4h}E*Ub&amp;CEcpXa'
    },
    tls: { rejectUnauthorized: false }
});

// Login Simples
app.post('/api/login', (req, res) => {
    const { usuario, senha } = req.body;
    if (usuario === 'adm' && senha === '1234') {
        res.status(200).json({ success: true, token: 'fake-jwt-token' });
    } else {
        res.status(401).json({ success: false, message: 'Usuário ou senha inválidos' });
    }
});

// Listar Chamados (Para o Painel do Agente)
app.get('/api/chamados', async (req, res) => {
    try {
        const chamados = await fs.readJson(DATA_FILE);
        res.status(200).json(chamados);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao ler chamados' });
    }
});

// Endpoint Público de Consulta (Seguro)
app.get('/api/public/chamados/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const chamados = await fs.readJson(DATA_FILE);

        // Procurar por ID ou Protocolo
        const chamado = chamados.find(c => c.id === id || c.protocolo === id);

        if (!chamado) return res.status(404).json({ error: 'Chamado não encontrado' });

        // Retorna apenas dados não sensíveis
        res.status(200).json({
            id: chamado.id,
            protocolo: chamado.protocolo || 'Aguardando Atendimento',
            status: chamado.status,
            observacao: chamado.observacao,
            data: chamado.data,
            assunto: chamado.assunto
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao consultar chamado' });
    }
});

// Atualizar Status/Observação do Chamado
app.patch('/api/chamados/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, observacao } = req.body;
        let chamados = await fs.readJson(DATA_FILE);

        const index = chamados.findIndex(c => c.id === id);
        if (index === -1) return res.status(404).json({ error: 'Chamado não encontrado' });

        const chamadoAntigo = { ...chamados[index] };
        let statusMudou = false;

        if (status && status !== chamadoAntigo.status) {
            chamados[index].status = status;
            statusMudou = true;

            // Gerar protocolo se estiver em "Em Atendimento" pela primeira vez
            if (status === 'Em Atendimento' && !chamados[index].protocolo) {
                const ano = new Date().getFullYear();
                const random = Math.floor(1000 + Math.random() * 9000); // 4 dígitos aleatórios
                chamados[index].protocolo = `${ano}-CH${random}`;
            }
        }

        if (observacao !== undefined) chamados[index].observacao = observacao;

        await fs.writeJson(DATA_FILE, chamados);
        const chamadoAtualizado = chamados[index];

        // Enviar E-mail de Notificação ao Solicitante
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
        res.status(500).json({ error: 'Erro ao atualizar chamado' });
    }
});

app.post('/api/chamados', upload.array('imagens', 4), async (req, res) => {
    try {
        const { nome, cpf, email, telefone, numero, assunto, descricao } = req.body;
        const arquivos = req.files || [];

        // Criar objeto do chamado para salvar no JSON
        const novoChamado = {
            id: Date.now().toString(),
            data: new Date().toISOString(),
            nome,
            cpf,
            email,
            telefone,
            numero,
            assunto,
            descricao,
            status: 'Aberto',
            observacao: '',
            imagens: arquivos.map(f => `/uploads/${f.filename}`)
        };

        // Salvar no JSON
        const chamados = await fs.readJson(DATA_FILE);
        chamados.unshift(novoChamado); // Adiciona no início
        await fs.writeJson(DATA_FILE, chamados);

        // Enviar E-mail
        const anexosFormatados = arquivos.map(file => ({
            filename: file.originalname,
            path: file.path // Agora usamos o path do arquivo no disco
        }));

        const mailOptions = {
            from: 'smtp_glpi@oabce.org.br',
            replyTo: email,
            to: 'chamado@oabce.org.br', // Alterado conforme conversas anteriores
            subject: `Novo Chamado: ${assunto} - ${nome}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; color: #333;">
                    <h2 style="color: #8D3046;">Novo Chamado Aberto (#${novoChamado.id})</h2>
                    <p><strong>Assunto:</strong> ${assunto}</p>
                    <hr>
                    <p><strong>Solicitante:</strong> ${nome}</p>
                    <p><strong>CPF:</strong> ${cpf}</p>
                    <p><strong>E-mail:</strong> ${email}</p>
                    <p><strong>Telefone:</strong> ${telefone}</p>
                    <p><strong>Nº OAB:</strong> ${numero || 'Não informado'}</p>
                    <hr>
                    <h3>Descrição:</h3>
                    <p style="background: #f4f4f4; padding: 15px; border-radius: 5px;">${descricao.replace(/\n/g, '<br>')}</p>
                </div>
            `,
            attachments: anexosFormatados
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Chamado enviado e registrado!', id: novoChamado.id });

    } catch (error) {
        console.error("ERRO AO PROCESSAR CHAMADO:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));