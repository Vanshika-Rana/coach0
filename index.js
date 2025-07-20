// index.js
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// This MUST be POST and must match `/webhook`
app.post("/webhook", async (req, res) => {
  const numMedia = parseInt(req.body.NumMedia || "0", 10);
  const from = req.body.From;

  if (numMedia > 0) {
    const mediaUrl = req.body.MediaUrl0;
    const mediaType = req.body.MediaContentType0;

    try {
      const response = await axios.get(mediaUrl, {
        responseType: "arraybuffer",
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
      });

      const buffer = Buffer.from(response.data);

      let extractedText = "";

      if (mediaType === "application/pdf") {
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text;
      } else if (
        mediaType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } else {
        extractedText = "Unsupported file type. Please upload a PDF or DOCX.";
      }

      console.log(`📄 Resume from ${from}:\n\n${extractedText}`);

      res.set("Content-Type", "text/xml");
      res.send(`
        <Response>
          <Message>✅ Got your resume! Extracted text successfully. We'll review it next.</Message>
        </Response>
      `);
    } catch (err) {
      console.error("Error parsing resume:", err.message);

      res.set("Content-Type", "text/xml");
      res.send(`
        <Response>
          <Message>Failed to process your file. Try again with a different format.</Message>
        </Response>
      `);
    }
  } else {
    res.set("Content-Type", "text/xml");
    res.send(`
      <Response>
        <Message>👋 Hey! Please upload your resume as a PDF or DOCX file to begin.</Message>
      </Response>
    `);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
