const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

/**
 * Returns the page count of a PDF buffer.
 * @param {Buffer} fileBuffer
 */
async function getPdfPageCount(fileBuffer) {
    const doc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    return doc.getPageCount();
}

const PAGE_SIZE = [595.28, 841.89]; // A4
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_SIZE[0] - MARGIN * 2;

// The built-in Helvetica/HelveticaBold fonts only support WinAnsiEncoding
// (roughly Latin-1) - drawing an unmapped currency symbol (₹, ₩, ₪, etc.,
// which salary slips commonly include) throws. Normalize any such symbol to
// a plain "$" so the figure still renders, then strip anything else out of
// WinAnsi range as a last resort.
const CURRENCY_SYMBOLS = /[₹₨₽₴₪₱₵₺₩₦₡₫₭₮฿]/g;

function sanitizeForPdf(text) {
    return String(text ?? '')
        .replace(CURRENCY_SYMBOLS, '$')
        .replace(/[^\x00-\xFF]/g, '?');
}

function wrapText(text, font, size, maxWidth) {
    const words = sanitizeForPdf(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
}

const STATUS_COLORS = {
    pass: rgb(0.06, 0.5, 0.3),
    warning: rgb(0.7, 0.45, 0.05),
    error: rgb(0.75, 0.15, 0.15),
};

/**
 * Builds a one-off PDF summary of a completed salary slip's extracted
 * figures and validation checks (Pro-only feature - gated in the controller).
 * @param {object} slip Sequelize salary_slip instance (or plain object)
 * @returns {Promise<Buffer>}
 */
async function generateSalarySlipReport(slip) {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

    let page = doc.addPage(PAGE_SIZE);
    let y = PAGE_SIZE[1] - MARGIN;

    function ensureSpace(height) {
        if (y - height < MARGIN) {
            page = doc.addPage(PAGE_SIZE);
            y = PAGE_SIZE[1] - MARGIN;
        }
    }

    function drawText(text, { size = 11, bold = false, color = rgb(0.15, 0.15, 0.15), gap = 6 } = {}) {
        const useFont = bold ? boldFont : font;
        const lines = wrapText(text, useFont, size, CONTENT_WIDTH);
        for (const line of lines) {
            ensureSpace(size + gap);
            page.drawText(line, { x: MARGIN, y, size, font: useFont, color });
            y -= size + gap;
        }
    }

    function drawRule() {
        ensureSpace(10);
        page.drawLine({
            start: { x: MARGIN, y },
            end: { x: PAGE_SIZE[0] - MARGIN, y },
            thickness: 0.75,
            color: rgb(0.85, 0.85, 0.85),
        });
        y -= 14;
    }

    drawText('Salary Slip Summary Report', { size: 18, bold: true, gap: 4 });
    drawText(slip.file_name || 'Salary slip', { size: 11, color: rgb(0.4, 0.4, 0.4) });
    drawText(
        `Uploaded: ${slip.createdAt ? new Date(slip.createdAt).toLocaleString('en-IN') : '-'}`,
        { size: 10, color: rgb(0.4, 0.4, 0.4), gap: 14 }
    );
    drawRule();

    if (slip.summary) {
        drawText('Summary', { size: 13, bold: true, gap: 8 });
        drawText(slip.summary, { size: 11, gap: 14 });
    }

    const details = slip.salary_details || {};
    const rows = [
        ['Gross Pay', details.gross_pay],
        ['Net Pay', details.net_pay],
        ['Tax Deduction', details.tax_deduction],
        ...(Array.isArray(details.other) ? details.other.map((d) => [d.label, d.value]) : []),
    ].filter(([, value]) => value);

    if (rows.length) {
        drawText('Salary Details', { size: 13, bold: true, gap: 8 });
        for (const [label, value] of rows) {
            ensureSpace(16);
            page.drawText(sanitizeForPdf(label), { x: MARGIN, y, size: 11, font: boldFont, color: rgb(0.15, 0.15, 0.15) });
            page.drawText(sanitizeForPdf(value), { x: MARGIN + 180, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
            y -= 18;
        }
        y -= 6;
    }

    const checks = Array.isArray(slip.checks) ? slip.checks : [];
    if (checks.length) {
        drawText('Validation Checks', { size: 13, bold: true, gap: 8 });
        for (const check of checks) {
            ensureSpace(16);
            const color = STATUS_COLORS[check.status] || rgb(0.15, 0.15, 0.15);
            page.drawText(`[${check.status.toUpperCase()}]`, { x: MARGIN, y, size: 10, font: boldFont, color });
            page.drawText(sanitizeForPdf(check.name), { x: MARGIN + 70, y, size: 10, font: boldFont, color: rgb(0.15, 0.15, 0.15) });
            y -= 14;
            drawText(check.message, { size: 10, color: rgb(0.35, 0.35, 0.35), gap: 10 });
        }
    }

    const bytes = await doc.save();
    return Buffer.from(bytes);
}

module.exports = { getPdfPageCount, generateSalarySlipReport };
