/**
 * Minimal Nostr helpers. nsec decode uses bech32; real pubkey uses @noble/secp256k1.
 * Signing uses secp256k1 with @noble/hashes for sha256/hmacSha256 (required by lib).
 */

import { bech32 } from "bech32";
import * as secp from "@noble/secp256k1";
import type { NostrEvent } from "./types";
// Sync sha256/hmac for secp256k1 signing (follow, post, like, etc.)
import { sha256 as sha256Sync } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";

const secpHashes = (secp as { hashes: { sha256?: (m: Uint8Array) => Uint8Array; hmacSha256?: (k: Uint8Array, m: Uint8Array) => Uint8Array } }).hashes;
secpHashes.sha256 = (msg: Uint8Array) => sha256Sync(msg);
secpHashes.hmacSha256 = (key: Uint8Array, msg: Uint8Array) => hmac(sha256Sync, key, msg);

export function generateSecretKey(): Uint8Array {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    throw new Error("Secure random number generation is unavailable");
  }
  return crypto.getRandomValues(new Uint8Array(32));
}

export function hexToBytes(hex: string): Uint8Array {
  const len = hex.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Real secp256k1 x-only public key (32 bytes hex) for Nostr relay and display.
export function getPublicKey(secretKey: Uint8Array): string {
  const pub = secp.schnorr.getPublicKey(secretKey);
  return bytesToHex(pub);
}

// NIP-01 event id = sha256(serialize([0, pubkey, created_at, kind, tags, content]))
function serializeEvent(event: Pick<NostrEvent, "pubkey" | "created_at" | "kind" | "tags" | "content">): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify([0, event.pubkey, event.created_at, event.kind, event.tags, event.content]),
  );
}

function isEventShape(event: NostrEvent): boolean {
  return (
    /^[a-f0-9]{64}$/i.test(event.id) &&
    /^[a-f0-9]{64}$/i.test(event.pubkey) &&
    /^[a-f0-9]{128}$/i.test(event.sig) &&
    Number.isSafeInteger(event.created_at) &&
    event.created_at >= 0 &&
    Number.isSafeInteger(event.kind) &&
    event.kind >= 0 &&
    typeof event.content === "string" &&
    event.content.length <= 65536 &&
    Array.isArray(event.tags) &&
    event.tags.length <= 500 &&
    event.tags.every((tag) => Array.isArray(tag) && tag.length <= 32 && tag.every((value) => typeof value === "string" && value.length <= 1024))
  );
}

export function verifyEvent(event: NostrEvent): boolean {
  if (!isEventShape(event)) return false;
  try {
    const eventId = bytesToHex(sha256Sync(serializeEvent(event)));
    return eventId === event.id.toLowerCase() && secp.schnorr.verify(hexToBytes(event.sig), hexToBytes(eventId), hexToBytes(event.pubkey));
  } catch {
    return false;
  }
}

/** Create and sign a Nostr event (NIP-01). Use for posts, likes, replies. */
export async function finishEventAsync(
  template: { kind: number; content: string; tags: string[][]; created_at: number },
  secretKey: Uint8Array
): Promise<{ id: string; pubkey: string; created_at: number; kind: number; tags: string[][]; content: string; sig: string }> {
  const pubkey = getPublicKey(secretKey);
  const ev = {
    ...template,
    pubkey,
    id: "",
    sig: "",
  };
  const idBytes = sha256Sync(serializeEvent(ev));
  ev.id = bytesToHex(idBytes);
  ev.sig = bytesToHex(secp.schnorr.sign(idBytes, secretKey));
  return ev as { id: string; pubkey: string; created_at: number; kind: number; tags: string[][]; content: string; sig: string };
}


// NIP-19: decode nsec/npub (bech32) or hex secret
export const nip19 = {
  decode(nip19Str: string): { type: string; data: Uint8Array } {
    const s = nip19Str.trim();
    if (s.toLowerCase().startsWith("nsec1")) {
      const decoded = bech32.decode(s, 1000);
      if (decoded.prefix.toLowerCase() !== "nsec") throw new Error("Invalid nsec prefix");
      const bytes = bech32.fromWords(decoded.words);
      const key = bytes.length >= 32 ? bytes.slice(-32) : bytes;
      if (key.length !== 32) throw new Error("nsec must decode to 32 bytes");
      return { type: "nsec", data: new Uint8Array(key) };
    }
    if (s.toLowerCase().startsWith("npub1")) {
      const decoded = bech32.decode(s, 1000);
      if (decoded.prefix.toLowerCase() !== "npub") throw new Error("Invalid npub prefix");
      const bytes = bech32.fromWords(decoded.words);
      const key = bytes.length >= 32 ? bytes.slice(-32) : bytes;
      if (key.length !== 32) throw new Error("npub must decode to 32 bytes");
      return { type: "npub", data: new Uint8Array(key) };
    }
    if (/^[a-fA-F0-9]{64}$/.test(s)) {
      return { type: "nsec", data: hexToBytes(s) };
    }
    throw new Error("Invalid nsec, npub, or hex key");
  },
  nsecEncode(secretKey: Uint8Array): string {
    const words = bech32.toWords(Array.from(secretKey));
    return bech32.encode("nsec", words, 1000);
  },
  npubEncode(pubkey: Uint8Array | string): string {
    const bytes = typeof pubkey === "string" ? hexToBytes(pubkey) : pubkey;
    const words = bech32.toWords(Array.from(bytes));
    return bech32.encode("npub", words, 1000);
  },
};

/** NIP-04: decrypt kind 4 content. otherPubkeyHex = sender if we're recipient, or recipient (from p tag) if we're sender.
 *  NIP-04 uses only the X coordinate of the ECDH shared point as the AES key (32 bytes), NOT hashed. */
export async function nip04Decrypt(
  encryptedContent: string,
  ourSecretKeyHex: string,
  otherPubkeyHex: string
): Promise<string> {
  const match = encryptedContent.match(/^(.+)\?iv=(.+)$/);
  if (!match) return "[invalid NIP-04 format]";
  const [, ciphertextB64, ivB64] = match;
  const ciphertext = Uint8Array.from(atob(ciphertextB64!), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64!), (c) => c.charCodeAt(0));
  const ourPriv = hexToBytes(ourSecretKeyHex);
  // NIP-04: recipient pubkey is 32-byte x-only; ECDH needs 33-byte compressed (02 + x)
  const theirPubBytes = hexToBytes(otherPubkeyHex);
  const theirPub33 = new Uint8Array(33);
  theirPub33[0] = 0x02;
  theirPub33.set(theirPubBytes, 1);
  const shared = secp.getSharedSecret(ourPriv, theirPub33, true);
  const key = shared.slice(1, 33);
  const keyCrypto = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["decrypt"]);
  const dec = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, keyCrypto, ciphertext);
  return new TextDecoder().decode(dec);
}

/** NIP-04: encrypt for recipient (their pubkey hex). Returns encrypted content string. */
export async function nip04Encrypt(
  plaintext: string,
  ourSecretKeyHex: string,
  theirPubkeyHex: string
): Promise<string> {
  const ourPriv = hexToBytes(ourSecretKeyHex);
  const theirPubBytes = hexToBytes(theirPubkeyHex);
  const theirPub33 = new Uint8Array(33);
  theirPub33[0] = 0x02;
  theirPub33.set(theirPubBytes, 1);
  const shared = secp.getSharedSecret(ourPriv, theirPub33, true);
  const key = shared.slice(1, 33);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const keyCrypto = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["encrypt"]);
  const enc = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, keyCrypto, new TextEncoder().encode(plaintext));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(enc)));
  const ivB64 = btoa(String.fromCharCode(...iv));
  return `${ctB64}?iv=${ivB64}`;
}

export const utils = { hexToBytes, bytesToHex };
