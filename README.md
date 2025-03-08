# Lokinet vanity address generator

![lokigen](https://github.com/user-attachments/assets/767150ef-08e2-4e6a-b055-94b12286dc36)

[Download](https://github.com/VityaSchel/lokinet-vanity-address-generator/releases)

Usage: `./lokigen [your prefix]` — the program will write .private files to ./output directory.

Help: `./lokigen --help`

After generation, put the resulting .private file to the lokinet directory (on Ubuntu/Debian it's /var/lib/lokinet), assign _lokinet:_loki owner and set 644 file mode:

```
chmod 644 /var/lib/lokinet/yourdomain.loki.private
chown _lokinet:_loki /var/lib/lokinet/yourdomain.loki.private
```

Edit lokinet.ini by pointing keyfile to the location of .private file and run `sudo systemctl restart lokinet`

## Features

- Straightforward to use: just download a binary for your OS and run it
- Fast and secure: only two dependencies for actual generation are used: bencode and libsodium-wrappers-sumo both of which are safe; you can review the whole code in just [two](./src/index.ts) [files](./src/worker.ts)
- You can adjust number of threads

Written in JavaScript with Bun.sh by [hloth](https://hloth.dev)

## Generation time estimation

The time it will take for the program to find a matching name depends on your hardware (CPU specifically), number of threads you run it with and, most importantly, length. Below you can find some reference information.

There is a formula that allows us to calculate probability of getting a match for a given number of characters: `p = 1/(32^𝑛)` where 𝑛 is the number of characters in prefix. We can roughly calculate number of attempts needed to reach a specific solid probability by using this formula: `x = log(p)/log(1-(1/(32^𝑛)))` where p = 1-probability.

| Characters in prefix | Estimated attempts for 50% probability |
| -------------------- | -------------------------------------- |
| 1                    | ~21                                    |
| 2                    | ~709                                   |
| 3                    | ~22712                                 |
| 4                    | 726817                                 |
| 5                    | 23258200                               |
| 6                    | 744261000                              |
| 7                    | 23816400000                            |
| 8                    | 762123000000                           |
|                      |                                        |

Assuming your PC can generate 100.000 attempts/second, this translates to this table:

| Characters in prefix | Estimated time for 50% probability |
| -------------------- | ---------------------------------- |
| 1                    | instantly                          |
| 2                    | instantly                          |
| 3                    | 0.2 seconds                        |
| 4                    | 7.2 seconds                        |
| 5                    | 3 minutes and 52 seconds           |
| 6                    | 2.06 hours                         |
| 7                    | 2.75 days                          |
| 8                    | 88 days                            |
|                      |                                    |

Which means it will only take you approx 270544026955332857686453576864535768645357686453576864535768645357686453 years to have at least 1% chance of bruteforcing full 52 characters lokinet hostname.

Here are some benchmarks:

| CPU/SIP                   | Generations per second |
| ------------------------- | ---------------------- |
| Apple M1 PRO (8 threads)  | 230.000                |
| Apple M4 PRO (12 threads) | 500.000                |
|                           |                        |

## How does this work?

Based on lokinet's [ServiceInfo](https://github.com/oxen-io/lokinet/blob/178ac1757b1a6e835b9e39561376318c77e5ff08/llarp/service/info.cpp#L23) and [Identity](https://github.com/oxen-io/lokinet/blob/178ac1757b1a6e835b9e39561376318c77e5ff08/llarp/service/identity.cpp#L47). Proto version can be found [here](https://github.com/oxen-io/lokinet/blob/178ac1757b1a6e835b9e39561376318c77e5ff08/llarp/constants/proto.hpp#L7) (as of 8th March 2025, it's `0`).

.private file is `bencode({ "s": signkey, "v": 0 })`

Lokinet address is: `zbase32(blake2b_256bit(bencode({ "s": signkey, "v": 0 }))) + ".loki"`

Pseudo-language implementation:

```
// 64 bytes
signingKey = crypto_random_bytes(64)

// as of 8th March 2025
protoVersion = 0

// 24 bytes
nonce = crypto_random_bytes(24)

// arbitrary size string
serviceInfo = bencode({
  "s": signingKey,
  "v": protoVersion
})

// Now you can write serviceInfo to .private file of snapp for lokinet daemon

// 32 bytes
serviceInfoHash = blake2b_256bit(serviceInfo)

// 32 bytes
encodedServiceAddress = zbase32(serviceInfoHash)

finalAddress = encodedServiceAddress + ".loki"
```

[ZBase32 encoding c++  headers by oxen](https://github.com/oxen-io/oxen-encoding/blob/dev/oxenc/base32z.h)
[Bencode c++ headers by oxen](https://github.com/oxen-io/oxen-encoding/blob/dev/oxenc/bt.h)

## Donate

[hloth.dev/donate](https://hloth.dev/donate)

## License

[MIT](./LICENSE.md)