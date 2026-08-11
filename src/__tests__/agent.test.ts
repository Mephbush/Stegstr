import { describe, expect, it } from "vitest";
import { AGENT_MANIFEST, executeAgentAction } from "../agent";
import * as Nostr from "../nostr-stub";

const secretKey = new Uint8Array(32).fill(9);

describe("agent operations", () => {
  it("exposes only read-only actions without host binding", () => {
    expect(AGENT_MANIFEST.sideEffects).toBe("none");
    expect(AGENT_MANIFEST.capabilities.some((item) => item.action === "publish_event" && item.status === "requires_host_approval")).toBe(true);
  });

  it("returns a channel profile", () => {
    const result = executeAgentAction({ requestId: "profile-1", action: "get_channel_profile", input: "instagram" });
    expect(result).toEqual({ requestId: "profile-1", ok: true, result: { platform: "instagram", maxWidth: 1080 } });
  });

  it("verifies events without exposing a write action", async () => {
    const event = await Nostr.finishEventAsync(
      { kind: 1, content: "agent check", tags: [], created_at: 1_700_000_001 },
      secretKey,
    );
    const result = executeAgentAction({ requestId: "verify-1", action: "verify_event", input: event });
    expect(result).toEqual({ requestId: "verify-1", ok: true, result: true });
  });

  it("rejects unknown profiles", () => {
    const result = executeAgentAction({ requestId: "profile-2", action: "get_channel_profile", input: "unknown" });
    expect(result.ok).toBe(false);
  });
});
