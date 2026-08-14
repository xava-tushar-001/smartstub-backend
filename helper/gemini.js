const { GoogleGenAI } = require('@google/genai');
const { SYSTEM_PROMPT, RESPONSE_SCHEMA, normalizeResult } = require('./salarySlipPrompt');

const MODEL = 'gemini-3.5-flash';

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

/**
 * Sends the uploaded salary slip to Gemini and returns { summary, checks, salary_details }.
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 */
async function analyzeWithGemini(fileBuffer, mimeType) {
  const client = getClient();
  const base64Data = fileBuffer.toString('base64');

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: 'Analyze this salary slip and record your findings as JSON matching the schema.' },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  let parsed;
  try {
    parsed = JSON.parse(response.text);
  } catch (err) {
    throw new Error('Gemini did not return valid JSON');
  }

  return normalizeResult(parsed);
}

module.exports = { analyzeWithGemini };
