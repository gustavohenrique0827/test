const express = require('express');
const cors = require('cors');
const { pool, testConnection } = require('./db');
const requestsRoutes = require('./routes/requests');
const quotesRoutes = require('./routes/quotes');
const suppliersRoutes = require('./routes/suppliers');
const usersRoutes = require('./routes/users');
const costCentersRoutes = require('./routes/costCenters');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Permitindo qualquer origem em desenvolvimento
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Adicionando log para depuração
app.use((req, res, next) => {
  const now = new Date();
  const formattedTime = now.toISOString();
  console.log(`[${formattedTime}] ${req.method} ${req.url} - IP: ${req.ip}`);
  
  // Logar corpo da requisição para métodos não GET
  if (req.method !== 'GET' && req.body) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  
  // Capturar informações de resposta
  const originalSend = res.send;
  res.send = function(body) {
    console.log(`[${formattedTime}] Response status: ${res.statusCode}`);
    return originalSend.call(this, body);
  };
  
  next();
});

// Teste de conexão ao iniciar o servidor
app.get('/api/test-connection', async (_req, res) => {
  const isConnected = await testConnection();
  if (isConnected) {
    res.json({ success: true, message: 'Conexão com banco de dados estabelecida!' });
  } else {
    res.status(500).json({ success: false, message: 'Falha na conexão com o banco de dados' });
  }
});

// Rotas
app.use('/api/requests', requestsRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/cost-centers', costCentersRoutes);

// Rota padrão
app.get('/login', (_req, res) => {
  res.send('API do SISDINENG está rodando!');
});

// Status da API
app.get('/api/status', (_req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Middleware para rotas não encontradas (404)
app.use((_req, res, _next) => {
  res.status(404).json({ success: false, message: 'Rota não encontrada' });
});

// Middleware para tratamento de erros
app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${req.method} ${req.url} - ${err.stack}`);
  res.status(500).json({
    success: false,
    message: 'Erro interno no servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse a API em http://localhost:${PORT}`);
  console.log(`Verificando conexão com banco de dados...`);
  testConnection();
});

// Tratamento para encerramento gracioso do servidor
process.on('SIGTERM', () => {
  console.log('Sinal SIGTERM recebido. Encerrando o servidor...');
  pool.end();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Sinal SIGINT recebido. Encerrando o servidor...');
  pool.end();
  process.exit(0);
});
