const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = '8600150941:AAHnKTZ7Re7cOP8kXcOJOPikidiIPpClEfs';
const FLOWISE_URL = 'https://flowise-production-5e8c.up.railway.app/api/v1/prediction/9f284790-d526-40d0-a130-0cbb28b68652';
const OWNER_CHAT_ID = '8757413202';

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const msg = req.body.message;
  if (!msg || !msg.text) return;
  const chatId = msg.chat.id;
  const text = msg.text;

  if (String(chatId) === String(OWNER_CHAT_ID) && text.startsWith('RESP ')) {
    const parts = text.split(' ');
    const clientId = parts[1];
    const respuesta = parts.slice(2).join(' ');
    try {
      await axios.post(FLOWISE_URL, {
        question: 'El vendedor responde: ' + respuesta,
        overrideConfig: { sessionId: String(clientId) }
      });
      const r2 = await axios.post(FLOWISE_URL, {
        question: 'El vendedor confirmo: ' + respuesta + '. Continua la conversacion con el cliente.',
        overrideConfig: { sessionId: String(clientId) }
      });
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: clientId,
        text: r2.data.text
      });
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: OWNER_CHAT_ID,
        text: '✅ Respuesta enviada al cliente ' + clientId
      });
    } catch (err) {
      console.error(err.message);
    }
    return;
  }

  try {
    const response = await axios.post(FLOWISE_URL, {
      question: text,
      overrideConfig: { sessionId: String(chatId) }
    });
    const reply = response.data.text;
    const lines = reply.split('\n');
    const cleanReply = lines.filter(l => !l.includes('CONSULTA_VENDEDOR:') && !l.includes('VERIFICAR_PEDIDO:') && !l.includes('PEDIDO_CONFIRMADO:')).join('\n').trim();
    const consultaLine = lines.find(l => l.includes('CONSULTA_VENDEDOR:'));
    const verificarLine = lines.find(l => l.includes('VERIFICAR_PEDIDO:'));
    const pedidoLine = lines.find(l => l.includes('PEDIDO_CONFIRMADO:'));
    if (cleanReply) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: cleanReply
      });
    }
    if (consultaLine) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: OWNER_CHAT_ID,
        text: '🔍 CONSULTA:\n' + consultaLine.replace('CONSULTA_VENDEDOR:', '').trim() + '\n\nCliente ID: ' + chatId + '\n\nPara responder escribi:\nRESP ' + chatId + ' [tu respuesta]'
      });
    }
    if (verificarLine) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: OWNER_CHAT_ID,
        text: '✅ VERIFICAR PEDIDO:\n' + verificarLine.replace('VERIFICAR_PEDIDO:', '').trim() + '\n\nCliente ID: ' + chatId + '\n\nPara confirmar escribi:\nRESP ' + chatId + ' Pedido confirmado'
      });
    }
    if (pedidoLine) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: OWNER_CHAT_ID,
        text: '🎉 PEDIDO CONFIRMADO:\n' + pedidoLine.replace('PEDIDO_CONFIRMADO:', '').trim() + '\n\nCliente ID: ' + chatId
      });
    }
  } catch (err) {
    console.error(err.message);
  }
});

app.listen(3001, () => console.log('Bot corriendo en puerto 3001'));