const { PDFDocument } = require('pdf-lib');

/**
 * Returns the page count of a PDF buffer.
 * @param {Buffer} fileBuffer
 */
async function getPdfPageCount(fileBuffer) {
    const doc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    return doc.getPageCount();
}

module.exports = { getPdfPageCount };
