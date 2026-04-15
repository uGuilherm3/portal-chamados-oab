const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const multer = require('multer'); // Importando o Multer

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configurando o Multer para guardar o arquivo temporariamente na memória
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Limite de 10MB por imagem para evitar travar o servidor
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

// Adicionamos o middleware do multer na rota: ele procura pelo campo "imagens" e aceita até 4 arquivos
app.post('/api/chamados', upload.array('imagens', 4), async (req, res) => {
    try {
        // Os textos vêm no req.body
        const { nome, cpf, email, telefone, numero, assunto, descricao } = req.body;

        // As imagens chegam no req.files (array gerado pelo multer)
        const arquivos = req.files || [];

        // Preparamos os anexos no formato exato que o Nodemailer exige
        const anexosFormatados = arquivos.map(file => ({
            filename: file.originalname,
            content: file.buffer // O buffer é o arquivo cru na memória
        }));

        const mailOptions = {
            from: 'smtp_glpi@oabce.org.br',
            replyTo: email,
            to: 'umadruginha@gmail.com',
            subject: `Novo Chamado: ${assunto} - ${nome}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; color: #333;">
                    <h2 style="color: #8D3046;">Novo Chamado Aberto</h2>
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
            // Passamos a lista de imagens preparadas para o e-mail
            attachments: anexosFormatados 
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Chamado enviado com anexos!' });

    } catch (error) {
        console.error("ERRO NO SMTP OU UPLOAD:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));