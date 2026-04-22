const express = require('express');
require('dotenv').config();
const nodemailer = require('nodemailer');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const { convert } = require('html-to-text');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Ignora validação de SSL caso o GLPI interno use certificado autoassinado em algum momento
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const app = express();
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

fs.ensureDirSync(UPLOADS_DIR);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// CONFIGURAÇÕES (MULTER & SMTP)
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 20 * 1024 * 1024 } });

const transporter = nodemailer.createTransport({
    host: 'cloud54.mailgrid.net.br',
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: { rejectUnauthorized: false }
});

// ==========================================
// SERVIÇO DE INTEGRAÇÃO COM O GLPI
// ==========================================
class GlpiService {
    constructor() {
        this.baseUrl = process.env.GLPI_URL;
        this.appToken = process.env.GLPI_APP_TOKEN;
        this.userToken = process.env.GLPI_USER_TOKEN;
    }

    async conectar() {
        try {
            const res = await axios.get(`${this.baseUrl}/initSession`, {
                headers: {
                    'App-Token': this.appToken,
                    'Authorization': `user_token ${this.userToken}`
                }
            });
            return res.data.session_token;
        } catch (error) {
            console.error("[GLPI] Erro de autenticação:", error.message);
            throw new Error("Falha ao conectar no GLPI");
        }
    }

    async desconectar(sessionToken) {
        if (!sessionToken) return;
        await axios.get(`${this.baseUrl}/killSession`, {
            headers: {
                'App-Token': this.appToken,
                'Session-Token': sessionToken
            }
        });
    }
}
const glpiAPI = new GlpiService();

// ==========================================
// ROTAS DE CHAMADOS / EMPRÉSTIMOS
// ==========================================

// Criar Chamado no GLPI
app.post('/api/chamados', upload.array('imagens', 4), async (req, res) => {
    let sessionToken = null;
    try {
        const { nome, cpf, email, telefone, assunto, descricao } = req.body;
        const arquivos = req.files || [];

        // Conecta ao GLPI
        sessionToken = await glpiAPI.conectar();

        // Monta o payload para o GLPI (Convertendo dados do Frontend para o padrão GLPI)
        const payloadGlpi = {
            input: {
                name: assunto || 'Novo Chamado Aberto via Portal',
                content: `
                    <strong>Dados do Solicitante:</strong><br>
                    Nome: ${nome}<br>
                    CPF: ${cpf}<br>
                    E-mail: ${email}<br>
                    Telefone: ${telefone}<br><br>
                    <strong>Descrição:</strong><br>
                    ${descricao}
                `,
                status: 1, // 1 = Novo
                type: 2,   // 2 = Requisição (Request)
                urgency: 3 // Urgência média
            }
        };

        // Cria o chamado (Ticket) no GLPI
        const glpiRes = await axios.post(`${glpiAPI.baseUrl}/Ticket`, payloadGlpi, {
            headers: {
                'Content-Type': 'application/json',
                'App-Token': glpiAPI.appToken,
                'Session-Token': sessionToken
            }
        });

        const idChamadoGLPI = glpiRes.data.id;

        // Dispara o e-mail de notificação com anexos (Se houver)
        const anexosFormatados = arquivos.map(file => ({
            filename: file.originalname,
            path: file.path
        }));

        const mailOptions = {
            from: process.env.SMTP_FROM,
            replyTo: email,
            to: process.env.SMTP_TO,
            subject: `Novo Chamado #${idChamadoGLPI}: ${assunto}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; color: #333;">
                    <h2 style="color: #8D3046;">Chamado Registrado no GLPI (#${idChamadoGLPI})</h2>
                    <p><strong>Solicitante:</strong> ${nome}</p>
                    <p><strong>Assunto:</strong> ${assunto}</p>
                    <hr>
                    <p>${descricao.replace(/\n/g, '<br>')}</p>
                </div>
            `,
            attachments: anexosFormatados 
        };

        transporter.sendMail(mailOptions).catch(err => console.error("Erro no envio de e-mail:", err));

        res.status(201).json({ 
            message: 'Chamado registrado com sucesso no GLPI!', 
            id: idChamadoGLPI, 
            protocolo: idChamadoGLPI 
        });

    } catch (error) {
        console.error("Erro ao criar chamado:", error);
        res.status(500).json({ error: 'Erro ao processar o chamado no servidor.' });
    } finally {
        if (sessionToken) await glpiAPI.desconectar(sessionToken);
    }
});

// Listar/Consultar Chamado do GLPI
app.get('/api/public/chamados/:id', async (req, res) => {
    let sessionToken = null;
    try {
        const { id } = req.params;
        sessionToken = await glpiAPI.conectar();

        const ticketRes = await axios.get(`${glpiAPI.baseUrl}/Ticket/${id}`, {
            headers: {
                'App-Token': glpiAPI.appToken,
                'Session-Token': sessionToken
            }
        });

        const chamado = ticketRes.data;

        // Limpa o HTML do conteúdo para enviar para o Frontend
        const descricaoLimpa = convert(chamado.content, { wordwrap: false });

        // Mapeamento de Status do GLPI para o seu Frontend
        const statusMap = {
            1: 'Novo',
            2: 'Em Atendimento',
            3: 'Em Atendimento (Planejado)',
            4: 'Pendente',
            5: 'Solucionado',
            6: 'Fechado'
        };

        const formatoFrontend = {
            id: chamado.id,
            protocolo: chamado.id,
            status: statusMap[chamado.status] || 'Desconhecido',
            assunto: chamado.name,
            descricao: descricaoLimpa,
            data: chamado.date_creation
        };

        // Retorna como array para manter a compatibilidade com o front original
        res.status(200).json([formatoFrontend]);

    } catch (error) {
        if (error.response && error.response.status === 404) {
            return res.status(404).json({ error: 'Chamado não encontrado no GLPI.' });
        }
        res.status(500).json({ error: 'Erro ao consultar chamado' });
    } finally {
        if (sessionToken) await glpiAPI.desconectar(sessionToken);
    }
});


// ==========================================
// BOT DE CONHECIMENTO (GEMINI + GLPI RAG)
// ==========================================

async function perguntarGemini(prompt, arquivosPDF = []) {
    try {
        if (!process.env.GEMINI_API_KEY) throw new Error("Chave Gemini ausente.");
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        // Prepara a lista de informações (Texto da pergunta + Anexos)
        const partesDoPrompt = [{ text: prompt }];

        // Se houver PDFs, injeta eles diretamente na mente da IA
        for (const pdf of arquivosPDF) {
            partesDoPrompt.push({
                inlineData: {
                    data: pdf.base64,
                    mimeType: "application/pdf"
                }
            });
        }

        // Envia tudo de uma vez
        const result = await model.generateContent(partesDoPrompt);
        const responseText = result.response.text();
        
        // Garante que não retorne apenas traços ou mensagens de erro cruas
        if (!responseText || responseText.trim() === "--") {
            return "Não consegui formular uma resposta clara. Por favor, tente reformular sua pergunta.";
        }
        
        return responseText;
    } catch (error) {
        console.error("[GEMINI API ERROR]:", error.message);
        if (error.message.includes("API_KEY_INVALID") || error.message.includes("blocked")) {
            return "Desculpe, meu serviço de IA está temporariamente indisponível (Erro de Autenticação). Por favor, tente novamente mais tarde.";
        }
        return "Não consegui processar sua pergunta no momento. Tente novamente.";
    }
}

app.post('/api/bot/ask', async (req, res) => {
    let sessionToken = null;
    try {
        const { question } = req.body;
        if (!question) return res.status(400).json({ error: 'Pergunta é obrigatória' });

        console.log(`\n[BOT] 1. Recebi a pergunta: "${question}"`);

        sessionToken = await glpiAPI.conectar();
        
        // =========================================================
        // CORREÇÃO: Variável central para o ID do Artigo
        // =========================================================
        const idArtigo = 23; 
        
        const baseRes = await axios.get(`${glpiAPI.baseUrl}/KnowbaseItem/${idArtigo}?expand_dropdowns=true`, {
            headers: { 'App-Token': glpiAPI.appToken, 'Session-Token': sessionToken }
        });
        const artigoGLPI = baseRes.data;
        
        let conteudoTextoBase = convert(artigoGLPI.answer, { wordwrap: false });
        let listaDePdfsParaGemini = []; // Array que vai guardar os PDFs

        console.log(`[BOT] 2. Lendo o artigo: "${artigoGLPI.name}" e buscando anexos...`);
        try {
            // Usa a mesma variável idArtigo aqui
            const docItemsRes = await axios.get(`${glpiAPI.baseUrl}/KnowbaseItem/${idArtigo}/Document_Item`, {
                headers: { 'App-Token': glpiAPI.appToken, 'Session-Token': sessionToken }
            });

            const anexos = Array.isArray(docItemsRes.data) ? docItemsRes.data : [];
            
            for (const anexo of anexos) {
                try {
                    const docId = anexo.documents_id;
                    if (!docId) continue;
                    
                    const docRes = await axios.get(`${glpiAPI.baseUrl}/Document/${docId}`, {
                        headers: { 'App-Token': glpiAPI.appToken, 'Session-Token': sessionToken }
                    });
                    const docData = docRes.data;

                    if (docData.mime === 'application/pdf' || (docData.filename && docData.filename.endsWith('.pdf'))) {
                        console.log(`[BOT] 📥 Baixando PDF para a IA ler nativamente: ${docData.filename}`);
                        
                        const downloadUrl = `${glpiAPI.baseUrl}/Document/${docId}?alt=media`;
                        const fileRes = await axios.get(downloadUrl, { 
                            headers: { 'App-Token': glpiAPI.appToken, 'Session-Token': sessionToken },
                            responseType: 'arraybuffer' 
                        });

                        // 💡 O TRUQUE: Converte o binário do arquivo para Base64 (O formato que a API do Gemini exige)
                        const base64Pdf = Buffer.from(fileRes.data, 'binary').toString('base64');
                        
                        listaDePdfsParaGemini.push({
                            nome: docData.filename,
                            base64: base64Pdf
                        });
                        
                        console.log(`[BOT] ✅ PDF empacotado para envio! (${docData.filename})`);
                    }
                } catch (innerErr) {
                    console.error(`[BOT AVISO] Anexo ignorado: ${innerErr.message}`);
                }
            }
        } catch (docError) {
            console.error(`[BOT AVISO] Não foi possível carregar a lista de anexos.`);
        }

        const urlArtigo = `https://chamados.oabce.org.br/front/knowbaseitem.form.php?id=${artigoGLPI.id}`;

        const prompt = `
            Você é o assistente virtual de TI da OAB-CE.
            
            REGRAS OBRIGATÓRIAS:
            1. Seja EXTREMAMENTE conciso e vá direto ao ponto.
            2. Responda APENAS baseado no CONTEXTO abaixo E nos arquivos PDF que estou te enviando em anexo. 
            3. Analise tanto os textos quanto as IMAGENS contidas nos PDFs em anexo para formular sua resposta.
            4. Se não encontrar a informação, diga "Não sei informar." NUNCA invente passos.
            5. SEMPRE inclua este link no final da resposta: [Ver documento completo](${urlArtigo})

            CONTEXTO EM TEXTO (Descrição do Artigo):
            ${conteudoTextoBase}

            PERGUNTA DO USUÁRIO:
            "${question}"
        `;

        // Passa o prompt E a lista de PDFs recém-baixados
        const answer = await perguntarGemini(prompt, listaDePdfsParaGemini);

        res.status(200).json({ 
            answer: answer,
            sources: [{ titulo: artigoGLPI.name, url: urlArtigo }]
        });

    } catch (error) {
        console.error("[BOT ERROR]:", error.message);
        res.status(500).json({ error: 'Erro interno no processamento da IA.' });
    } finally {
        if (sessionToken) await glpiAPI.desconectar(sessionToken);
    }
});

// Inicialização do Servidor
const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
    console.log("⏳ Iniciando verificações do sistema...");

    // 1. Teste Real do GLPI
    try {
        console.log("🔄 Testando conexão com GLPI...");
        const tokenTeste = await glpiAPI.conectar();
        if (tokenTeste) {
            console.log('✅ Integração GLPI: Ativa e Autenticada!');
            // Desconecta logo em seguida para não deixar sessão fantasma presa
            await glpiAPI.desconectar(tokenTeste); 
        }
    } catch (error) {
        console.error('❌ Integração GLPI: FALHOU! Verifique IP, App-Token e User-Token.');
        console.error(`   Detalhe do erro: ${error.message}`);
    }

    // 2. Teste Real do Gemini
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20) {
        console.log('✅ Integração Gemini: Ativa (Chave detectada no .env)');
    } else {
        console.error('❌ Integração Gemini: FALHOU! Chave API ausente ou inválida.');
    }

    // 3. Inicia o servidor para ouvir as requisições
    app.listen(PORT, () => {
        console.log(`🚀 Servidor Express rodando com sucesso na porta ${PORT}`);
        console.log(`-----------------------------------------------------`);
    });
}

// Roda a função de inicialização
iniciarServidor();