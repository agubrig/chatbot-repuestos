const express = require('express');
const axios = require('axios');
const twilio = require('twilio');
const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: false}));

const ACCOUNT_SID = 'AC294b8885ce991c9f483f44490fa55e2a';
const AUTH_TOKEN = '5605a98591dc2b05f4e685f4e0fc8488';
const FLOWISE_URL = 'https://flowise-production-5e8c.up.railway.app/api/v1/prediction/9f284790-d526-40d0-a130-0cbb28b68652';
const OWNER_WHATSAPP = 'whatsapp:+59899046252';
const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const from = req.body.From;
  const text = req.body.Body;
  if (!from || !text) return;
  const sessionId = from.replace('whatsapp:+','');

  if (from === OWNER_WHATSAPP && text.startsWith('RESP ')) {
    const parts = text.split(' ');
    const clientId = parts[1];
    const respuesta = parts.slice(2).join(' ');
    try {
      const r = await axios.post(FLOWISE_URL, {
        question: 'El vendedor confirmo: ' + respuesta + '. Continua la conversacion con el cliente.',
        overrideConfig: { sessionId: clientId }
      });
      await client.messages.create({ from: 'whatsapp:+14155238886', to: 'whatsapp:+' + clientId, body: r.data.text });
      await client.messages.create({ from: 'whatsapp:+14155238886', to: OWNER_WHATSAPP, body: 'Respuesta enviada al cliente ' + clientId });
    } catch (err) { console.error(err.message); }
    return;
  }

  try {
    const response = await axios.post(FLOWISE_URL, { question: text, overrideConfig: { sessionId } });
    const reply = response.data.text;
    const lines = reply.split('\n');
    const cleanReply = lines.filter(l => !l.includes('CONSULTA_VENDEDOR:') && !l.includes('VERIFICAR_PEDIDO:') && !l.includes('PEDIDO_CONFIRMADO:')).join('\n').trim();
    const consultaLine = lines.find(l => l.includes('CONSULTA_VENDEDOR:'));
    const verificarLine = lines.find(l => l.includes('VERIFICAR_PEDIDO:'));
    const pedidoLine = lines.find(l => l.includes('PEDIDO_CONFIRMADO:'));
    if (cleanReply) { await client.messages.create({ from: 'whatsapp:+14155238886', to: from, body: cleanReply }); }
    if (consultaLine) { await client.messages.create({ from: 'whatsapp:+14155238886', to: OWNER_WHATSAPP, body: 'CONSULTA:\n' + consultaLine.replace('CONSULTA_VENDEDOR:','').trim() + '\n\nCliente: ' + sessionId + '\n\nPara responder:\nRESP ' + sessionId + ' [tu respuesta]' }); }
    if (verificarLine) { await client.messages.create({ from: 'whatsapp:+14155238886', to: OWNER_WHATSAPP, body: 'VERIFICAR PEDIDO:\n' + verificarLine.replace('VERIFICAR_PEDIDO:','').trim() + '\n\nCliente: ' + sessionId + '\n\nPara confirmar:\nRESP ' + sessionId + ' Pedido confirmado' }); }
    if (pedidoLine) { await client.messages.create({ from: 'whatsapp:+14155238886', to: OWNER_WHATSAPP, body: 'PEDIDO CONFIRMADO:\n' + pedidoLine.replace('PEDIDO_CONFIRMADO:','').trim() }); }
  } catch (err) { console.error(err.message); }
});

app.listen(3001, () => console.log('Bot WhatsApp corriendo en puerto 3001'));