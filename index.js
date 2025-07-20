// index.js
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// This MUST be POST and must match `/webhook`
app.post('/webhook', (req, res) => {
  const msg = req.body.Body;
  const from = req.body.From;

  console.log(`📩 Message from ${from}: ${msg}`);

  // Respond with XML TwiML
  res.set('Content-Type', 'text/xml');
  res.send(`
    <Response>
      <Message>👋 Hey! Resume Coach is live. Send your resume to begin.</Message>
    </Response>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));