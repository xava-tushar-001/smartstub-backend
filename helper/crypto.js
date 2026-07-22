const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex) {
        throw new Error('ENCRYPTION_KEY is not configured');
    }
    const key = Buffer.from(hex, 'hex');
    if (key.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be a 32-byte (64 hex character) key');
    }
    return key;
}

/**
 * Encrypts a plaintext string. Returns "iv:authTag:ciphertext" (all hex),
 * safe to store as a single TEXT column value.
 */
function encrypt(plainText) {
    const key = getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts a value produced by encrypt().
 */
function decrypt(payload) {
    const key = getKey();
    const [ivHex, authTagHex, ciphertextHex] = String(payload).split(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]);
    return plaintext.toString('utf8');
}

module.exports = { encrypt, decrypt };
