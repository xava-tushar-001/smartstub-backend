const { SYSTEM_PROMPT, RESPONSE_SCHEMA, parseModelJson, normalizeResult } = require('./salarySlipPrompt');

// Any vision-capable model listed at https://openrouter.ai/models?max_price=0 works here.
// Override with OPENROUTER_MODEL if this one is retired or rate-limited.
const DEFAULT_MODEL = 'google/gemma-4-26b-a4b-it:free';

/**
 * Sends the uploaded salary slip to an OpenRouter-hosted model and returns
 * { summary, checks, salary_details }. Used as a fallback when Gemini is unavailable.
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 */
async function analyzeWithOpenRouter(fileBuffer, mimeType) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const base64Data = fileBuffer.toString('base64');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost',
      'X-Title': 'SmartStub',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this salary slip and record your findings as JSON matching the schema. Respond with JSON only, no markdown fences and no prose.' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter request failed (${res.status}): ${body || res.statusText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter did not return any content');
  }

  let parsed;
  try {
    parsed = parseModelJson(content);
  } catch (err) {
    throw new Error('OpenRouter did not return valid JSON');
  }

  return normalizeResult(parsed);
}

module.exports = { analyzeWithOpenRouter, RESPONSE_SCHEMA };
