const { GoogleGenAI } = require('@google/genai');

const MODEL = 'gemini-3.5-flash';

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

Produce at least 4 checks covering different aspects of the document. Be specific in each check's message and reference actual numbers from the document where relevant.

Also extract the key salary figures shown on the document (gross pay, net pay, total tax deducted, and any other relevant figures such as pay period, employer name, overtime pay, bonuses, YTD totals, or other deductions), as exact strings including currency symbols where shown. Leave a field as an empty string if it isn't present on the document. Respond only with JSON matching the given schema - no prose.`;

const RESPONSE_SCHEMA = {
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
    salary_details: {
      type: 'object',
      description: 'Key salary figures extracted verbatim from the document (with currency symbols where shown). Use an empty string for any figure not present.',
      properties: {
        gross_pay: {
          type: 'string',
          description: "This period's gross pay, or empty string if not present.",
        },
        net_pay: {
          type: 'string',
          description: "This period's net (take-home) pay, or empty string if not present.",
        },
        tax_deduction: {
          type: 'string',
          description: "This period's total tax withheld/deducted, or empty string if not present.",
        },
        other: {
          type: 'array',
          description: 'Any other relevant salary figures found, e.g. pay period, employer name, overtime pay, bonuses, YTD gross/net, other deductions.',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['label', 'value'],
          },
        },
      },
      required: ['gross_pay', 'net_pay', 'tax_deduction', 'other'],
    },
  },
  required: ['summary', 'checks', 'salary_details'],
};

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

/**
 * Sends the uploaded salary slip to Gemini and returns { summary, checks }.
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 */
async function analyzeSalarySlip(fileBuffer, mimeType) {
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

  if (!parsed || !Array.isArray(parsed.checks)) {
    throw new Error('Gemini did not return a structured analysis');
  }

  return {
    ...parsed,
    salary_details: {
      gross_pay: parsed.salary_details?.gross_pay || '',
      net_pay: parsed.salary_details?.net_pay || '',
      tax_deduction: parsed.salary_details?.tax_deduction || '',
      other: Array.isArray(parsed.salary_details?.other) ? parsed.salary_details.other : [],
    },
  };
}

module.exports = { analyzeSalarySlip };
