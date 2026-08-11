import { PLATFORM_WIDTHS } from "./stego-qim";
import * as Nostr from "./nostr-stub";

export type AgentActionName = "describe_capabilities" | "verify_event" | "get_channel_profile";

export interface AgentActionRequest {
  requestId: string;
  action: AgentActionName;
  input?: unknown;
}

export interface AgentActionResponse {
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export const AGENT_MANIFEST = {
  protocolVersion: 1,
  runtime: "host-bound",
  sideEffects: "none",
  capabilities: [
    { action: "describe_capabilities", access: "read", status: "available" },
    { action: "verify_event", access: "read", status: "available" },
    { action: "get_channel_profile", access: "read", status: "available" },
    { action: "embed_media", access: "write", status: "requires_host_approval" },
    { action: "detect_media", access: "read", status: "requires_host_binding" },
    { action: "publish_event", access: "write", status: "requires_host_approval" },
    { action: "sync_relays", access: "write", status: "requires_host_approval" },
  ],
} as const;

function getChannelProfile(input: unknown): { platform: string; maxWidth: number } {
  if (typeof input !== "string" || !(input in PLATFORM_WIDTHS)) {
    throw new Error("Unknown channel profile");
  }
  return { platform: input, maxWidth: PLATFORM_WIDTHS[input] };
}

export function executeAgentAction(request: AgentActionRequest): AgentActionResponse {
  try {
    if (!request.requestId.trim()) throw new Error("requestId is required");
    switch (request.action) {
      case "describe_capabilities":
        return { requestId: request.requestId, ok: true, result: AGENT_MANIFEST };
      case "verify_event":
        return { requestId: request.requestId, ok: true, result: Nostr.verifyEvent(request.input as Partial<Parameters<typeof Nostr.verifyEvent>[0]>) };
      case "get_channel_profile":
        return { requestId: request.requestId, ok: true, result: getChannelProfile(request.input) };
    }
  } catch (error) {
    return {
      requestId: request.requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
