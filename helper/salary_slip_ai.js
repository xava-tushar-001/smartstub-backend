const { analyzeWithGemini } = require('./gemini');
const { analyzeWithOpenRouter } = require('./openrouter');

/**
 * Analyzes a salary slip with Gemini, falling back to OpenRouter (if configured)
 * when Gemini errors out (e.g. 503 UNAVAILABLE during high demand).
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 */
async function analyzeSalarySlip(fileBuffer, mimeType) {
  try {
    return await analyzeWithGemini(fileBuffer, mimeType);
  } catch (geminiError) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw geminiError;
    }
    console.error('Gemini analysis failed, falling back to OpenRouter:', geminiError.message);
    return await analyzeWithOpenRouter(fileBuffer, mimeType);
  }
}

module.exports = { analyzeSalarySlip };
