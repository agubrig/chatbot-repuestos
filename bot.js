const express = require('express');
const axios = require('axios');
const twilio = require('twilio');
const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: false}));

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
const FLOWISE_URL = process.env.FLOWISE_URL;
const OWNER = process.env.OWNER_WHATSAPP;
const FROM_NUM = 'whatsapp:+14155238886';

console.log('Bot iniciado. OWNER:', OWNER);

app.post('/webhook', async (req, res) => {
  const from = req.body.From;
  const text = req.body.Body;
  console.log('Mensaje recibido - From:', from, 'Text:', text);
  console.log('OWNER:', OWNER);
  console.log('Match:', from === OWNER);
  
  res.set('Content-Type', 'text/xml');
  res.send('<Response></Response>');
  
  if (!from || !text) {
    console.log('Sin from o text, saliendo');
    return;
  }
  
  const sessionId = from.replace('whatsapp:+','');

  if (from === OWNER && text.startsWith('RESP ')) {
    const parts = text.split(' ');
    const clientId = parts[1];
    const respuesta = parts.slice(2).join(' ');
    try {
      const r = await axios.post(FLOWISE_URL, {
        question: 'El vendedor confirmo: ' + respuesta + '. Continua la conversacion con el cliente.',
        overrideConfig: { sessionId: clientId }
      });
      await client.messages.create({ from: FROM_NUM, to: 'whatsapp:+' + clientId, body: r.data.text });
      await client.messages.create({ from: FROM_NUM, to: OWNER, body: 'Respuesta enviada al cliente ' + clientId });
    } catch(e) { console.error('Error RESP:', e.message); }
    return;
  }

  try {
    console.log('Enviando a Flowise...');
    const response = await axios.post(FLOWISE_URL, { question: text, overrideConfig: { sessionId } });
    const reply = response.data.text;
    console.log('Respuesta Flowise:', reply);
    const lines = reply.split('\n');
    const cleanReply = lines.filter(l =>
      !l.includes('CONSULTA_VENDEDOR:') &&
      !l.includes('VERIFICAR_PEDIDO:') &&
      !l.includes('PEDIDO_CONFIRMADO:')
    ).join('\n').trim();
    const consultaLine = lines.find(l => l.includes('CONSULTA_VENDEDOR:'));
    const verificarLine = lines.find(l => l.includes('VERIFICAR_PEDIDO:'));
    const pedidoLine = lines.find(l => l.includes('PEDIDO_CONFIRMADO:'));
    if (cleanReply) {
      await client.messages.create({ from: FROM_NUM, to: from, body: cleanReply });
    }
    if (consultaLine) {
      await client.messages.create({ from: FROM_NUM, to: OWNER,
        body: 'CONSULTA:\n' + consultaLine.replace('CONSULTA_VENDEDOR:','').trim() +
        '\n\nCliente: ' + sessionId +
        '\n\nPara responder:\nRESP ' + sessionId + ' [tu respuesta]'
      });
    }
    if (verificarLine) {
      await client.messages.create({ from: FROM_NUM, to: OWNER,
        body: 'VERIFICAR PEDIDO:\n' + verificarLine.replace('VERIFICAR_PEDIDO:','').trim() +
        '\n\nCliente: ' + sessionId +
        '\n\nPara confirmar:\nRESP ' + sessionId + ' Pedido confirmado'
      });
    }
    if (pedidoLine) {
      await client.messages.create({ from: FROM_NUM, to: OWNER,
        body: 'PEDIDO CONFIRMADO:\n' + pedidoLine.replace('PEDIDO_CONFIRMADO:','').trim()
      });
    }
  } catch(e) { console.error('Error general:', e.message); }
});

app.listen(process.env.PORT || 3001, () => console.log('Bot corriendo'));
