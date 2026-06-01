/**
 * AES-256-GCM symmetric encryption for file URLs stored in the database.
 *
 * Why NOT bcrypt:
 *   bcrypt is a one-way hash — you can never recover the original value.
 *   We need to decrypt the URL later to serve the file, so we use
 *   AES-256-GCM (reversible, authenticated encryption).
 *
 * Setup:
 *   Add FILE_ENCRYPTION_KEY to your .env — a random 64-char hex string.
 *   Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_HEX = process.env.FILE_ENCRYPTION_KEY || ''

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error(
      'FILE_ENCRYPTION_KEY env var is missing or invalid. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return Buffer.from(KEY_HEX, 'hex')
}

/**
 * Encrypts a plaintext string (e.g. a file URL) and returns a hex-encoded
 * string in the format: iv:authTag:ciphertext
 */
export function encryptUrl(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12) // 96-bit IV recommended for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

/**
 * Decrypts a string produced by encryptUrl() and returns the original plaintext.
 * Returns null if decryption fails (e.g. tampered data or wrong key).
 */
export function decryptUrl(encrypted: string): string | null {
  try {
    const [ivHex, authTagHex, ciphertextHex] = encrypted.split(':')
    if (!ivHex || !authTagHex || !ciphertextHex) return null

    const key = getKey()
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const ciphertext = Buffer.from(ciphertextHex, 'hex')

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    return null
  }
}

/**
 * Returns true if the string looks like an encrypted URL (iv:tag:cipher format).
 * Used to avoid double-encrypting or attempting to decrypt plain URLs.
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':')
  return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p))
}
