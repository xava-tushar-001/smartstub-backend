/**
 * Salary figures are stored as verbatim strings from Gemini's extraction
 * (e.g. "₹82,250.00", "$1,234.56"), not numbers, since slips can use any
 * currency/format. For dashboard totals we only need a best-effort numeric
 * value - strip everything except digits, the decimal point, and a leading
 * minus sign (thousands separators like "," are just noise here).
 */
function parseCurrencyValue(text) {
    if (typeof text !== 'string' || !text.trim()) return 0;
    const cleaned = text.replace(/[^0-9.-]/g, '');
    const value = parseFloat(cleaned);
    return Number.isFinite(value) ? value : 0;
}

module.exports = { parseCurrencyValue };
