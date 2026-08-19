# Stegstr

**Steganographic social networking.** Hide messages in images and share them anywhere—local-first, with optional Nostr sync.

Stegstr gives you two ways to use it:

- **UI app** — Desktop and mobile app. Create posts, embed them in images, and detect content from images with a graphical interface.
- **CLI module** — Command-line tool for scripts and automation. Decode, detect, embed, and create Nostr-style posts from the terminal.

Data is stored and processed **locally**; Stegstr is **not exclusively Nostr**. You can use it fully offline (embed/detect in images and share via any channel). When you want to sync over the network, Stegstr can act as a Nostr client and use relays. Relay and image imports accept only schema-bounded, cryptographically valid Nostr events.

## Quick start

### Graphical app (UI)

Download the latest release for your platform:

- [macOS](https://github.com/brunkstr/Stegstr/releases/latest/download/Stegstr-macOS.dmg) · [Windows](https://github.com/brunkstr/Stegstr/releases/latest/download/Stegstr-Windows.exe) · [Linux](https://github.com/brunkstr/Stegstr/releases/latest/download/Stegstr-Linux.deb) / [AppImage](https://github.com/brunkstr/Stegstr/releases/latest/download/Stegstr-Linux.AppImage)

See [Releases](https://github.com/brunkstr/Stegstr/releases) for other builds and Android.

### Command-line interface (CLI)

You need [Rust](https://rustup.rs) (latest stable). Clone and build the CLI:

```bash
git clone https://github.com/brunkstr/Stegstr.git
cd Stegstr
cd src-tauri && cargo build --release --bin stegstr-cli
```

Binary: `target/release/stegstr-cli` (Windows: `stegstr-cli.exe`). Example:

```bash
./target/release/stegstr-cli post "Hello from CLI" --output bundle.json
./target/release/stegstr-cli embed cover.png -o out.png --payload @bundle.json --encrypt
./target/release/stegstr-cli detect out.png
```

## Build from source (full app)

Prerequisites: Node.js 18+, Rust (latest stable). Desktop QIM also needs Python 3 with the packages in `channel_simulator/requirements.txt`.

```bash
git clone https://github.com/brunkstr/Stegstr.git
cd Stegstr
npm ci
npm test
npm run build
npm run build:mac   # or build:win, build:linux
```

For the desktop QIM path:

```bash
python3 -m pip install -r channel_simulator/requirements.txt
```

## Contest verification

1. In **Embed image**, keep the default **QIM (JPEG, robust)** method and choose the target platform. The web app refuses to download a QIM image unless local round-trip and repeated JPEG recompression checks recover the exact payload.
2. Test each final image by sending it through the intended platform, downloading the processed image, and using **Detect image**. Real platform handling changes over time, so the local check is a guardrail—not a substitute for this end-to-end test.
3. Use **Network ON** only when relay synchronization is wanted. Relay connections retry automatically and received events are signature-verified.
4. Use **Recipients only** when confidentiality is required. The **Open** mode is interoperable transport obfuscation, not a secret shared only by Stegstr users.

The legacy Dot/PNG and DWT CLI codecs are lossless-channel compatibility paths; do not use them for platforms that recompress or resize images.

See the repo for platform-specific build deps (e.g. Xcode CLI tools, Visual Studio Build Tools, Linux dev packages).

## Links

- [Website](https://stegstr.com) — Downloads, getting started, wiki
- [Wiki / CLI docs](https://stegstr.com/wiki/cli.html) — Full CLI reference
- [Releases](https://github.com/brunkstr/Stegstr/releases)

## License

MIT
