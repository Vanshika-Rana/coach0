const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const axios = require("axios");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const getResumeFeedback = require("./gpt"); // Import GPT logic

dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post("/webhook", async (req, res) => {
	console.log("📥 Webhook received!");
	console.log("📥 Full request body:", JSON.stringify(req.body, null, 2));
	console.log("📥 Headers:", JSON.stringify(req.headers, null, 2));
	
	const numMedia = parseInt(req.body.NumMedia || "0", 10);
	const from = req.body.From;
	
	console.log(`📱 Message from: ${from}, Media count: ${numMedia}`);

	if (numMedia > 0) {
		const mediaUrl = req.body.MediaUrl0;
		const mediaType = req.body.MediaContentType0;

		try {
			// Download file from Twilio with auth
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
				extractedText =
					"❌ Unsupported file type. Please upload a PDF or DOCX.";
			}

			console.log(
				`📄 Resume received from ${from}:\n${extractedText.slice(
					0,
					500
				)}...`
			);

			// Get GPT feedback
			console.log("🔄 Calling GPT for feedback...");
			const gptResponse = await getResumeFeedback(extractedText);
			console.log("🧠 GPT Feedback received:");
			console.log("📝 Response length:", gptResponse.length);
			console.log("📝 First 200 chars:", gptResponse.slice(0, 200));

			// Clean + split into ~1400 char chunks
			const cleanText = gptResponse
				.replace(/\n{3,}/g, "\n\n")
				.replace(/&/g, "and"); // XML safety

			const chunks = [];
			for (let i = 0; i < cleanText.length; i += 1400) {
				chunks.push(cleanText.slice(i, i + 1400));
			}

			// Build TwiML response
			console.log("📤 Building TwiML response...");
			console.log("📊 Number of chunks:", chunks.length);
			
			let twiml = `<Response>`;
			twiml += `<Message>✅ Here's your resume feedback:</Message>`;
			chunks.slice(0, 3).forEach((chunk, index) => {
				console.log(`📤 Adding chunk ${index + 1}, length: ${chunk.length}`);
				twiml += `<Message>${chunk}</Message>`;
			});
			twiml += `</Response>`;

			console.log("📤 Final TwiML length:", twiml.length);
			console.log("📤 Sending TwiML response...");
			
			res.set("Content-Type", "text/xml");
			res.send(twiml);
		} catch (err) {
			console.error("❌ Error:", err.message);
			res.set("Content-Type", "text/xml");
			res.send(`
        <Response>
          <Message>❌ Failed to process your file. Please try again with a valid PDF or DOCX.</Message>
        </Response>
      `);
		}
	} else {
		res.set("Content-Type", "text/xml");
		res.send(`
      <Response>
        <Message>👋 Hey! Please upload your resume as a PDF or DOCX to get feedback and a rewrite.</Message>
      </Response>
    `);
	}
});

app.get("/", (req, res) => {
	res.send("✅ Resume Coach Bot is running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`🚀 Server running on http://localhost:${PORT}`);
});
