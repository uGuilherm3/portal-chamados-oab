const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const transporter = nodemailer.createTransport({
    host: 'cloud54.mailgrid.net.br',
    port: 587,
    secure: false,
    auth: {
        user: 'smtp_glpi@oabce.org.br',
        pass: '4h}E*Ub&amp;CEcpXa' // Usando o &amp; como você confirmou
    },
    tls: { rejectUnauthorized: false }
});

app.post('/api/chamados', async (req, res) => {
    // Pegando exatamente o que vem do seu formulário novo
    const { nome, cpf, email, telefone, numero, assunto, descricao } = req.body;

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
                <p style="background: #f4f4f4; padding: 15px;">${descricao}</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Enviado!' });
    } catch (error) {
        console.error("ERRO NO SMTP:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));