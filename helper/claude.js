const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT = `You are a meticulous payroll auditor analyzing a single salary slip (pay stub) image or PDF that a user has uploaded.

Carefully read the document and perform the checks a careful payroll auditor would perform, for example (only include checks that are actually relevant to what is visible in the document):
- Gross pay is correctly broken down into its components (base pay, overtime, bonuses, etc.)
- Net pay equals gross pay minus taxes and deductions
- Tax withholding looks reasonable for the stated gross pay
- Year-to-date (YTD) figures are consistent with the current period's figures
- Required fields are present (employee name, pay period dates, employer name, pay date)
- Overtime hours/rate are calculated correctly, if present
- No obviously missing, inconsistent, or contradictory information

For each check, decide a status:
- "pass": the check succeeded, nothing wrong.
- "warning": something looks unusual, incomplete, or worth double-checking, but is not clearly an error.
- "error": something is missing, inconsistent, miscalculated, or fails validation.

Produce at least 4 checks covering different aspects of the document. Be specific in each check's message and reference actual numbers from the document where relevant. Record your analysis using the record_analysis tool - do not respond with plain text.`;

const ANALYSIS_TOOL = {
  name: 'record_analysis',
  description: 'Record the structured salary slip analysis results.',
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'A 2-4 sentence plain-English summary of the overall analysis.',
      },
      checks: {
        type: 'array',
        description: 'The list of individual validation checks performed.',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: "Short name of the check, e.g. 'Net pay calculation'.",
            },
            status: {
              type: 'string',
              enum: ['pass', 'warning', 'error'],
            },
            message: {
              type: 'string',
              description: 'Explanation of the result of this specific check.',
            },
          },
          required: ['name', 'status', 'message'],
        },
      },
    },
    required: ['summary', 'checks'],
  },
};

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * Sends the uploaded salary slip to Claude and returns { summary, checks }.
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 */
async function analyzeSalarySlip(fileBuffer, mimeType) {
  const client = getClient();
  const base64Data = fileBuffer.toString('base64');

  const documentBlock = mimeType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
    : { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } };

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: 'tool', name: 'record_analysis' },
    messages: [
      {
        role: 'user',
        content: [
          documentBlock,
          { type: 'text', text: 'Analyze this salary slip and record your findings using the record_analysis tool.' },
        ],
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === 'tool_use');
  if (!toolUse || !Array.isArray(toolUse.input?.checks)) {
    throw new Error('Claude did not return a structured analysis');
  }

  return toolUse.input;
}

module.exports = { analyzeSalarySlip };
