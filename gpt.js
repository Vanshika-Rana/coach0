const dotenv = require("dotenv");
dotenv.config();
const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getResumeFeedback(resumeText, jobDescription = null) {
	const messages = [
		{
			role: "system",
			content: `You are a professional resume coach and career consultant. You give clear, helpful, and encouraging feedback.`,
		},
		{
			role: "user",
			content: `
Here is a resume:

${resumeText}

${jobDescription ? `And here is the job description:\n\n${jobDescription}` : ""}

Please:
1. Critique this resume (format, structure, clarity, tone)
2. Suggest specific improvements
3. Rewrite it (tailored to the job if provided)

Use bullet points where helpful.
Respond in a friendly but professional tone.
      `,
		},
	];

	const completion = await openai.chat.completions.create({
		model: "gpt-4",
		messages,
	});

	return completion.choices[0].message.content;
}

module.exports = getResumeFeedback;
