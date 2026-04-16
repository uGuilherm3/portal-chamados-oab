# Estágio 1: Build
FROM node:18-alpine AS builder

# Diretório de trabalho no container
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências (apenas produção se preferir, mas aqui usamos tudo)
RUN npm install

# Copiar o restante do código do projeto
COPY . .

# Expor a porta 3000 (onde o server.js roda)
EXPOSE 3000

# Comando para rodar a aplicação
CMD ["node", "server.js"]
