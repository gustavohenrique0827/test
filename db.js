
// Conexão com o banco de dados MySQL
const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração do pool de conexões usando variáveis de ambiente
const pool = mysql.createPool({
  host: process.env.DB_HOST || '192.168.0.249',
  user: process.env.DB_USER || 'dineng',
  password: process.env.DB_PASSWORD || 'dineng@@2025',
  database: process.env.DB_NAME || 'sisdineng',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Função para testar a conexão
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Conexão com o banco de dados estabelecida com sucesso!');
    console.log(`Conectado a: ${process.env.DB_HOST}:${process.env.DB_PORT} (${process.env.DB_NAME})`);
    connection.release();
    return true;
  } catch (error) {
    console.error('Erro ao conectar-se ao banco de dados:', error);
    console.error(`Tentando conectar a: ${process.env.DB_HOST}:${process.env.DB_PORT} (${process.env.DB_NAME})`);
    console.error('Verifique as configurações em .env e a disponibilidade do servidor MySQL');
    return false;
  }
};

// Verificar conexão periodicamente para mantê-la ativa
setInterval(async () => {
  try {
    const connection = await pool.getConnection();
    connection.query('SELECT 1');
    connection.release();
    console.log('Conexão com banco de dados verificada e mantida ativa');
  } catch (error) {
    console.error('Erro ao verificar conexão com o banco de dados:', error);
  }
}, 60000); // Verificar a cada 1 minuto

// Exporta o pool e a função de teste
module.exports = { pool, testConnection };
