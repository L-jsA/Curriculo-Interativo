require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
app.use(bodyParser.json());

// Conexão com PostgreSQL (Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

console.log('✅ Conectado ao PostgreSQL');

// 2. Rota do Webhook
app.post('/webhook', (req, res) => {
  console.log("--- NOVA REQUISIÇÃO RECEBIDA ---");
  
  const data = req.body;

  if (!data || !data.payload) {
    console.warn("⚠️ Payload vazio ou inválido recebido.");
    return res.status(400).send('Payload inválido');
  }

  // EXTRAÇÃO DOS DADOS (Incluindo a URI única para evitar duplicados)
  const nome = data.payload.name;
  const email = data.payload.email;
  const calendlyUri = data.payload.uri; // O "RG" único do agendamento
  const eventoRaw = data.payload.scheduled_event ? data.payload.scheduled_event.start_time : null;

  if (!eventoRaw) {
    console.error("❌ Erro: Horário não encontrado no JSON.");
    return res.status(400).send('Dados de horário ausentes');
  }

  // Formata a data para o banco: YYYY-MM-DD HH:MM:SS
  const evento = new Date(eventoRaw).toISOString().slice(0, 19).replace('T', ' ');

  console.log(`Verificando agendamento: ${nome} | ${calendlyUri}`);

  const sql = `
      INSERT INTO agendamentos (nome, email, horario, calendly_uri)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (calendly_uri) DO NOTHING`;
  
  pool.query(sql, [nome, email, evento, calendlyUri], (err, result) => {
    if (err) {
      console.error('❌ ERRO AO INSERIR NO BANCO:', err.message);
      return res.status(500).send('Erro no banco');
    }

    // CORREÇÃO: No PostgreSQL, usamos rowCount
    if (result.rowCount === 0) {
      console.log(`⚠️ Registro ignorado: O agendamento de ${nome} já existe.`);
      res.status(200).send('Agendamento já processado anteriormente.');
    } else {
      console.log(`✅ SUCESSO! Novo agendamento de ${nome} salvo.`);
      res.status(200).send('Agendamento salvo!');
    }
  });
});

/*app.listen(3000, () => {
  console.log('🚀 Servidor rodando na porta 3000');
});*/

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('🚀 Servidor rodando na porta ' + PORT);
});