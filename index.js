// index.js
const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const axios = require("axios");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const twilio = require("twilio");
const getResumeFeedback = require("./gpt");

dotenv.config();

// maximum message length to fit Twilio's limit
const TWILIO_SEND_LIMIT = parseInt(process.env.TWILIO_SEND_LIMIT, 10) || 1550;

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER } =
  process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Helper to split text into chunks no larger than `limit`
function chunkMessage(text, limit) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + limit;
    if (end < text.length) {
      // try to break at a newline or space
      const nl = text.lastIndexOf("\n", end);
      const sp = text.lastIndexOf(" ", end);
      end = nl > start ? nl : sp > start ? sp : end;
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks;
}

app.post("/webhook", async (req, res) => {
  console.log("Webhook received:", req.body);

  const numMedia = parseInt(req.body.NumMedia || "0", 10);
  const from = req.body.From;
  let feedback = "";

  try {
    if (numMedia > 0) {
      const mediaUrl = req.body.MediaUrl0;
      const mediaType = req.body.MediaContentType0;
      const download = await axios.get(mediaUrl, {
        responseType: "arraybuffer",
        auth: {
          username: TWILIO_ACCOUNT_SID,
          password: TWILIO_AUTH_TOKEN,
        },
      });
      const buffer = Buffer.from(download.data);

      // Extract text
      let extracted = "";
      if (mediaType === "application/pdf") {
        extracted = (await pdfParse(buffer)).text;
      } else if (
        mediaType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        extracted = (await mammoth.extractRawText({ buffer })).value;
      }
      if (!extracted.trim()) throw new Error("No text extracted");

      console.log("Extracted text (first 200 chars):", extracted.slice(0, 200));

      // GPT feedback
      const gptRaw = await getResumeFeedback(extracted);
      feedback = gptRaw
        .replace(/\r\n/g, "\n")
        .replace(/^(\s*\d+\.\s.*)$/gm, "*$1*") // bold numbered headings
        .trim();
    } else {
      feedback =
        "Hey! Please upload your resume as a PDF or DOCX to get full feedback and a rewrite.";
    }
  } catch (err) {
    console.error("Processing error:", err);
    feedback =
      "Oops, I couldn't process that file. Please try again with a valid PDF or DOCX.";
  }

  // Split and send in chunks
  const chunks = chunkMessage(feedback, TWILIO_SEND_LIMIT);
  for (const chunk of chunks) {
    try {
      await client.messages.create({
        from: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
        to: from,
        body: chunk,
      });
      console.log("Sent chunk to", from);
    } catch (err) {
      console.error("Error sending chunk:", err);
    }
  }

  // Acknowledge webhook
  res.sendStatus(200);
});

app.get("/", (_, res) => res.send("Resume Coach Bot is running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server up on http://localhost:${PORT}`));
