import crypto from "crypto"

const ALGORITHM = "aes-256-cbc"
const IV_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error("ENCRYPTION_KEY environment variable is not set")
  const buf = Buffer.alloc(32)
  Buffer.from(key, "utf8").copy(buf)
  return buf
}

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()])
  return iv.toString("hex") + ":" + encrypted.toString("hex")
}

export function decryptToken(encryptedToken: string): string {
  const [ivHex, encHex] = encryptedToken.split(":")
  const iv = Buffer.from(ivHex, "hex")
  const enc = Buffer.from(encHex, "hex")
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv)
  const decrypted = Buffer.concat([decipher.update(enc), decipher.final()])
  return decrypted.toString("utf8")
}
