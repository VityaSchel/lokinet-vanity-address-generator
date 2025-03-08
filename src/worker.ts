import crypto from 'crypto'
import { ready, default as sodium } from 'libsodium-wrappers-sumo'

declare let self: Worker

self.addEventListener('message', async (event: MessageEvent) => {
  const prefix = event.data
  if (typeof prefix === 'string' && prefix.length > 0) {
    generate(prefix)
  }
})

async function generate(prefix: string) {
  await ready

  let lastTime = performance.now()
  while (true) {
    const batch = batchGenerate()
    await new Promise((resolve) => setTimeout(resolve, 0))
    for (let i = 0; i < batch.addresses.length; i++) {
      const address = batch.addresses[i]
      if (address.startsWith(prefix)) {
        const seed = batch.seeds[i]
        const signingKey = batch.signingKeys[i]
        const s = Buffer.concat([seed, signingKey])
        postMessage({ type: 0, address, s })
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }
    const now = performance.now()
    postMessage({ type: 1, delta: now - lastTime })
    lastTime = now
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

function batchGenerate() {
  const addresses = new Array<string>(4000)
  const seeds = new Array<Uint8Array>(4000)
  const signingKeys = new Array<Uint8Array>(4000)

  for (let i = 0; i < 4000; i++) {
    const seed = crypto.randomBytes(32)
    const privateKey = toPrivateKey(seed)
    const signingKey = sodium.crypto_scalarmult_ed25519_base_noclamp(privateKey)
    const address = zbase32(signingKey)

    addresses[i] = address
    signingKeys[i] = signingKey
    seeds[i] = seed
  }

  return { addresses, seeds, signingKeys }
}

function toPrivateKey(seed: Buffer) {
  if (!Buffer.isBuffer(seed) || seed.length !== 32) {
    throw new Error('Seed must be a Buffer with 32 bytes')
  }

  const hash = crypto.createHash('sha512')
  hash.update(seed)
  const h = hash.digest()

  h[0] &= 248
  h[31] &= 63
  h[31] |= 64

  return h.subarray(0, 32)
}

const alphabet = 'ybndrfg8ejkmcpqxot1uwisza345h769'
export function zbase32(input: Uint8Array): string {
  let output = ''
  let buffer = 0
  let bufferLength = 0

  for (let i = 0; i < input.length; i++) {
    buffer = (buffer << 8) | input[i]
    bufferLength += 8

    while (bufferLength >= 5) {
      bufferLength -= 5
      const index = (buffer >> bufferLength) & 0x1f
      output += alphabet[index]
    }
  }

  if (bufferLength > 0) {
    buffer <<= 5 - bufferLength
    const index = buffer & 0x1f
    output += alphabet[index]
  }

  return output
}
