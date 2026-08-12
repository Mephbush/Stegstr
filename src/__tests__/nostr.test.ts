import { describe, expect, it } from "vitest";
import * as Nostr from "../nostr-stub";

const secretKey = new Uint8Array(32).fill(7);

async function makeEvent() {
  return Nostr.finishEventAsync(
    {
      kind: 1,
      content: "verified event",
      tags: [["t", "stegstr"]],
      created_at: 1_700_000_000,
    },
    secretKey,
  );
}

describe("Nostr event verification", () => {
  it("accepts a correctly signed event", async () => {
    const event = await makeEvent();
    expect(Nostr.verifyEvent(event)).toBe(true);
  });

  it("rejects content tampering", async () => {
    const event = await makeEvent();
    expect(Nostr.verifyEvent({ ...event, content: "tampered" })).toBe(false);
  });

  it("rejects an invalid event id", async () => {
    const event = await makeEvent();
    expect(Nostr.verifyEvent({ ...event, id: "0".repeat(64) })).toBe(false);
  });

  it("rejects an invalid signature", async () => {
    const event = await makeEvent();
    expect(Nostr.verifyEvent({ ...event, sig: "0".repeat(128) })).toBe(false);
  });
});
