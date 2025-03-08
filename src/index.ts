import bencode from 'bencode'
import fs from 'fs/promises'
import yargs from 'yargs/yargs'
import path from 'path'
import { createLogUpdate } from 'log-update'
import chalk from 'chalk'

async function main() {
  const logUpdate = createLogUpdate(process.stdout, {
    showCursor: true,
  })

  const args = await yargs(process.argv.slice(2))
    .scriptName('lokigen')
    .command('$0 <prefix>', 'Prefix for lokinet hostname')
    .option('out', {
      alias: 'o',
      describe: 'Path to output directory',
      default: './output',
      normalize: true,
      type: 'string',
    })
    .option('threads', {
      alias: 't',
      describe:
        'Number of workers to spawn. By default, Math.ceil(navigator.hardwareConcurrency / 3)',
      type: 'number',
      number: true,
    })
    .epilogue('Usage: lokigen <prefix> [-o <output>] [-t <threads>]')
    .parse()

  if (!args.out || typeof args.out !== 'string' || args.out.length === 0) {
    console.error('Invalid output directory')
    process.exit(1)
  }

  if (!args.prefix) {
    console.error(
      'Invalid prefix. Usage: lokigen <prefix> [-o <output>] [-t <threads]',
    )
    process.exit(1)
  }
  const prefix = String(args.prefix).toLowerCase()
  if (!prefix || typeof prefix !== 'string' || prefix.length === 0) {
    console.error(
      'Invalid prefix. Usage: lokigen <prefix> [-o <output>] [-t <threads>]',
    )
    process.exit(1)
  }

  if (prefix.length > 52) {
    console.error(
      'Prefix is longer than possible lokinet hostname (max 52 chars)',
    )
    process.exit(1)
  }
  const base32Alphabet = 'ybndrfg8ejkmcpqxot1uwisza345h769'
  if (!prefix.split('').every((c) => base32Alphabet.includes(c))) {
    console.error(
      'Prefix is invalid. You can only use z-base32 characters: ' +
        base32Alphabet,
    )
    process.exit(1)
  }

  console.log()

  await fs.mkdir(args.out, { recursive: true })

  if (args.threads !== undefined && !Number.isSafeInteger(args.threads)) {
    console.error('Invalid number of threads')
    process.exit(1)
  }
  const threads = args.threads ?? Math.ceil(navigator.hardwareConcurrency / 3)

  const workers: Worker[] = []
  for (let i = 0; i < threads; i++) {
    const worker = new Worker('./worker.ts')
    worker.postMessage(prefix)
    worker.addEventListener('error', (event) => {
      console.error('Worker error', event)
    })
    worker.addEventListener('message', (event) => {
      if (event.data && typeof event.data === 'object') {
        if ('type' in event.data && typeof event.data.type === 'number') {
          if (event.data.type === 0) {
            if ('address' in event.data && 's' in event.data) {
              onResult({
                address: event.data.address + '.loki',
                s: event.data.s,
              })
            }
          } else if (event.data.type === 1) {
            if ('delta' in event.data && typeof event.data.delta === 'number') {
              onMetricsUpdate((4000 * 1000) / event.data.delta)
            }
          }
        }
      }
    })
  }

  let matches = 0

  const metrics: number[] = []
  let generationsPerSecond: number
  function onMetricsUpdate(n: number) {
    metrics.push(n)
    generationsPerSecond = Math.round(
      metrics.slice(-threads).reduce((a, b) => a + b, 0),
    )
    logMetrics()
  }

  function logMetrics() {
    logUpdate(
      '\n',
      chalk.bold(generationsPerSecond + ' generations per second'),
      '•',
      chalk.bold(threads + ' threads'),
      '\n',
      'Found: ',
      chalk.ansi256(240)(matches),
      '\n',
      'Prefix: ',
      chalk.bold(chalk.ansi256(240)(prefix)),
    )
  }

  function onResult({ address, s }: { address: string; s: Buffer }) {
    matches++
    logUpdate.clear()
    console.log('    ' + address)
    fs.writeFile(
      path.resolve(args.out, address + '.private'),
      bencode.encode({ s, v: 0 }),
      {
        flag: 'w',
      },
    )
    logMetrics()
  }

  process.on('SIGINT', () => {
    workers.forEach((w) => w.terminate())
    process.exit(0)
  })
}

main()
