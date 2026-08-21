# Stegstr — Contest Submission

## Overview

Stegstr is a steganographic Nostr client that hides signed Nostr events (posts, DMs, profiles) inside JPEG images using Quantization Index Modulation (QIM) in the DCT domain. The hidden data survives real-world platform processing (WhatsApp, Telegram, Instagram, Facebook, Twitter/X) because it is embedded in the frequency domain with strong error correction, not in the pixel domain.

## Quick Start (Web App)

```bash
npm ci
npm run dev
```

Open the browser at the URL shown (typically http://localhost:1420). No build step or native dependencies needed for the web app.

## Quick Start (Desktop App)

```bash
npm ci
npm run tauri dev      # development
npm run build:mac      # or build:win, build:linux for release builds
```

## Quick Start (CLI)

```bash
cd src-tauri && cargo build --release --bin stegstr-cli
# Binary: target/release/stegstr-cli

stegstr-cli post "Hello from CLI" --output bundle.json
stegstr-cli embed cover.png -o out.png --payload @bundle.json --encrypt
stegstr-cli detect out.png
stegstr-cli capabilities
```

The `capabilities` command prints machine-readable JSON describing all supported inputs and commands, for integration with automation pipelines.

## How It Works

### Embedding (QIM — default, robust)

1. User creates posts/DMs in the app (feed, messages, etc.)
2. Click **Embed image** → choose a cover image
3. Select target platform (Instagram, WhatsApp, Telegram, etc.)
4. The app:
   - Pre-resizes the cover to match the platform's max width (avoids platform resize destroying data)
   - Converts to JPEG at quality 75
   - Computes 8×8 DCT blocks on the luminance channel
   - Embeds payload bits via QIM (δ=14) in 24 AC coefficients per block
   - Applies 5× bit repetition for majority voting
   - Adds Reed-Solomon error correction (128 parity symbols)
   - Compresses payload with deflate before embedding
5. **Self-test**: immediately decodes the embedded image to verify round-trip integrity
6. **Resilience test**: simulates real platform processing (resize + recompress at platform quality, multiple passes) for WhatsApp, Telegram, Instagram, Facebook, and Twitter/X — the download is blocked if any platform simulation fails
7. Downloads the JPEG image

### Platform Simulation Profiles

Each platform is modeled with its own max width, JPEG quality, and recompression pass count. These values reflect how each platform actually processes uploaded images:

| Platform     | Max Width | JPEG Quality | Passes |
|--------------|-----------|-------------|--------|
| WhatsApp     | 1600px    | 55          | 2      |
| Telegram     | 1280px    | 72          | 1      |
| Instagram    | 1080px    | 72          | 1      |
| Facebook     | 2048px    | 70          | 1      |
| Twitter/X    | 1200px    | 85          | 1      |

WhatsApp is the most aggressive channel: double-pass recompression at quality 55. The QIM embedding (δ=14, 5× repetition, RS-128) is tuned to survive this worst case. If the payload survives WhatsApp, it survives all other platforms.

### Detection (Decode)

1. User clicks **Detect image** → selects a JPEG or PNG
2. The app tries QIM decode first (for JPEG), then falls back to Dot/DWT decode (for PNG)
3. QIM decode:
   - Decodes JPEG to pixels, computes DCT blocks
   - Extracts QIM bits with confidence margins
   - Majority vote de-repeats bits
   - Marks low-confidence bytes as erasures for Reed-Solomon
   - RS corrects errors, verifies STEGSTR magic
   - Decompresses payload, parses Nostr bundle JSON
4. Events are merged into the feed, DMs into messages

### Encryption

- **Open mode**: AES-GCM with app-derived key — any Stegstr user can detect and read
- **Recipients only**: inner payload encrypted with random symmetric key; key encrypted per-recipient via NIP-04 (ECDH + AES-CBC). Only listed pubkeys can decrypt.

The outer layer is always AES-GCM with a `STEGSTR1` magic header and version byte, so the decoder can detect Stegstr payloads and distinguish them from random noise.

### Networking (Nostr)

- Toggle Network ON to connect to Nostr relays (Primal, Damus, nos.lol, nostr.band)
- Remote relay config fetched from `stegstr.com/config/relay.json` with local fallback
- Publishes posts/likes/reposts/DMs for Nostr-category identities
- Local-category identities never publish to relays (steganographic only)
- Relay connections auto-reconnect with exponential backoff
- All received events are signature-verified (NIP-01)
- Subscribes to kinds 0, 1, 3, 4, 5, 6, 7, 9735, 10003

### Multi-Identity

- **Local identities**: steganographic only — data lives in images, never touches relays
- **Nostr identities**: relay-synced — publish and receive from the Nostr network
- Both types are convertible. A user can start local (anonymous) and later attach a Nostr key to go online.

## Key Features

| Feature | Description |
|---------|-------------|
| **QIM DCT steganography** | Embeds in JPEG DCT domain; invisible and robust to recompression |
| **Platform pre-resize** | Matches target platform max width to avoid destructive resizing |
| **Reed-Solomon + repetition** | 128 parity symbols + 5× repetition for error correction |
| **Multi-platform resilience test** | Verifies payload survives simulated WhatsApp, Telegram, Instagram, Facebook, Twitter processing before download |
| **Self-test before download** | Immediate encode→decode round-trip verification |
| **AES-GCM encryption** | App-level encryption for all embedded payloads |
| **NIP-04 recipient encryption** | Per-recipient encryption for private bundles |
| **Nostr relay networking** | Publish/subscribe with auto-reconnect, signature verification |
| **Multi-identity support** | Local (steganographic only) and Nostr (relay-synced) identities |
| **CLI for automation** | Headless embed/detect/post/capabilities for scripts and AI agents |
| **Cross-platform** | Web, macOS, Windows, Linux desktop via Tauri |

## Testing

### Unit Tests

```bash
npm test
```

Tests cover: DCT round-trip, quantization tables, Reed-Solomon encode/decode, QIM capacity, QIM embed/detect math, stego-crypto encryption, dot steganography, and utilities.

### Channel Simulator (Python)

```bash
cd channel_simulator
pip install -r requirements.txt
python run_matrix.py
```

Runs the encoder × channel pass/fail matrix: DWT, DCT, DCT-sign, DCT-TCM, DCT-RS64, DCT-QIM against WhatsApp, Instagram, Facebook, Twitter profiles. QIM is the only method that passes all four channels.

### E2E Permutation Tests

```bash
npm run test:e2e
```

Validates the 10-permutation matrix (Network × Nostr × Local for two instances) and 9 action types (post, reply, like, follow, DM, etc.).

## Architecture

```
src/
  stego-qim.ts        — QIM DCT-domain embed/detect (browser, robust)
  stego-dot.ts        — Dot-offset embed/detect (browser, legacy, visible)
  stego-web.ts        — DWT Haar 2D embed/detect (browser, legacy, lossless only)
  stego-crypto.ts     — AES-GCM + NIP-04 encryption
  dct.ts              — 8×8 DCT/IDCT, quantization tables
  reed-solomon.ts     — GF(2^8) RS encoder/decoder
  relay.ts            — Nostr relay client (subscribe, publish, reconnect)
  nostr-stub.ts       — NIP-01 event signing/verification, NIP-04 DM encryption
  App.tsx             — Main application (feed, messages, embed/detect, identities)

src-tauri/
  src/stego.rs        — DWT steganography (Rust, desktop)
  src/stego_dot.rs    — Dot steganography (Rust, desktop)
  src/stego_crypto.rs — App-layer encryption (Rust, desktop)
  src/bin/stegstr_cli.rs — CLI tool

channel_simulator/
  channel.py          — Platform channel simulator
  dct_stego.py        — DCT steganography (Python reference)
  dct_variants.py     — QIM, sign, TCM, RS64 variants
  run_matrix.py       — Full encoder × channel matrix test
```

## Contest Verification

To verify the submission:

1. **Run the web app**: `npm ci && npm run dev`
2. **Create a post** in the feed
3. **Click Embed image** → choose a JPEG cover → select "WhatsApp Standard (1600px)" as target platform
4. The app will embed, self-test, and run resilience tests against all 5 platforms before downloading
5. **Send the downloaded JPEG through real WhatsApp/Telegram/Instagram**
6. **Download the processed image** from the platform
7. **Click Detect image** in Stegstr → select the platform-processed image
8. The post should appear in the feed

## Version

0.1.0 — MIT License
