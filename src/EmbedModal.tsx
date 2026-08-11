import { useState, useEffect } from "react";
import * as Nostr from "./nostr-stub";
import { isWeb, pickImageFile } from "./platform-web";
import { PLATFORM_WIDTHS, getQimCapacityForFile } from "./stego-qim";
import type { ProfileData } from "./types";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram (1080px model)",
  facebook: "Facebook (2048px model)",
  twitter: "Twitter/X (600px model)",
  whatsapp_standard: "WhatsApp Standard (800px model)",
  whatsapp_hd: "WhatsApp HD (4096px model)",
  telegram_photo: "Telegram Photo (1920px model)",
  imessage: "iMessage (1280px model)",
  none: "No resize (original size)",
};

export interface EmbedModalProps {
  onClose: () => void;
  onConfirm: () => void;
  embedding: boolean;
  stegoProgress: string;
  embedCoverFile: File | null;
  onCoverFileChange: (file: File | null) => void;
  recipientMode: "open" | "recipients";
  onRecipientModeChange: (mode: "open" | "recipients") => void;
  recipientInput: string;
  onRecipientInputChange: (value: string) => void;
  recipients: string[];
  onRecipientsChange: (recipients: string[]) => void;
  profiles: Record<string, ProfileData>;
  targetPlatform: string;
  onTargetPlatformChange: (platform: string) => void;
}

export function EmbedModal({
  onClose,
  onConfirm,
  embedding,
  stegoProgress,
  embedCoverFile,
  onCoverFileChange,
  recipientMode,
  onRecipientModeChange,
  recipientInput,
  onRecipientInputChange,
  recipients,
  onRecipientsChange,
  profiles,
  targetPlatform,
  onTargetPlatformChange,
}: EmbedModalProps) {
  const [capacityInfo, setCapacityInfo] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!embedCoverFile) {
      setCapacityInfo("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const info = await getQimCapacityForFile(embedCoverFile, targetPlatform);
        if (!cancelled) {
          setCapacityInfo(
            `Capacity: ~${Math.floor(info.capacityBytes / 1024)} KB (${info.width}x${info.height} JPEG)`,
          );
        }
      } catch {
        if (!cancelled) setCapacityInfo("Could not compute capacity");
      }
    })();
    return () => { cancelled = true; };
  }, [embedCoverFile, targetPlatform]);

  const addRecipient = () => {
    const raw = recipientInput.trim();
    if (!raw) return;
    let pk = raw;
    if (raw.startsWith("npub")) {
      try {
        const d = Nostr.nip19.decode(raw);
        if (d.type === "npub") pk = Nostr.bytesToHex(d.data);
      } catch { return; }
    }
    if (/^[a-fA-F0-9]{64}$/.test(pk) && !recipients.includes(pk)) {
      onRecipientsChange([...recipients, pk]);
      onRecipientInputChange("");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal embed-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Embed feed into image</h3>
        <p className="muted">Data is encrypted so only Stegstr users can read it. DMs are encrypted for the recipient only.</p>

        {/* Cover image picker */}
        {isWeb() && (
          <div className="embed-cover-web">
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                const file = await pickImageFile();
                if (file) onCoverFileChange(file);
              }}
            >
              {embedCoverFile ? embedCoverFile.name : "Choose cover image"}
            </button>
          </div>
        )}

        {/* Capacity info */}
        {capacityInfo && (
          <p className="muted embed-capacity-info">{capacityInfo}</p>
        )}

        {/* Recipient mode */}
        <div className="embed-recipient-mode">
          <label className="embed-recipient-mode-label">
            <input type="radio" name="embed-mode" checked={recipientMode === "open"} onChange={() => onRecipientModeChange("open")} />
            {" "}Open (any Stegstr user)
          </label>
          <label>
            <input type="radio" name="embed-mode" checked={recipientMode === "recipients"} onChange={() => onRecipientModeChange("recipients")} />
            {" "}Recipients only
          </label>
        </div>
        {recipientMode === "recipients" && (
          <div className="embed-recipients">
            <div className="row embed-recipient-input-row">
              <input
                type="text"
                value={recipientInput}
                onChange={(e) => onRecipientInputChange(e.target.value)}
                placeholder="npub or hex pubkey"
                className="wide embed-recipient-input"
              />
              <button type="button" className="btn-secondary" onClick={addRecipient}>
                Add
              </button>
            </div>
            {recipients.length > 0 && (
              <ul className="embed-recipient-list">
                {recipients.map((pk) => (
                  <li key={pk} className="embed-recipient-item">
                    <span>{profiles[pk]?.name ?? `${pk.slice(0, 12)}…`}</span>
                    <button type="button" className="btn-delete muted embed-recipient-remove" onClick={() => onRecipientsChange(recipients.filter((p) => p !== pk))}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
            {recipients.length === 0 && <p className="muted embed-recipient-empty">Add at least one recipient pubkey.</p>}
          </div>
        )}

        {/* Advanced options toggle */}
        <button
          type="button"
          className="btn-link muted embed-advanced-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? "Hide advanced options" : "Advanced options"}
        </button>

        {showAdvanced && (
          <div className="embed-advanced">
            <div className="embed-platform-selector embed-platform-options">
              <label className="embed-section-label">Target platform:</label>
                <select
                  value={targetPlatform}
                  onChange={(e) => onTargetPlatformChange(e.target.value)}
                >
                  {Object.keys(PLATFORM_WIDTHS).map((key) => (
                    <option key={key} value={key}>{PLATFORM_LABELS[key] ?? key}</option>
                  ))}
                </select>
              <p className="muted embed-platform-help">
                Pre-resizes to the selected channel model. These profiles are estimates and require field verification.
              </p>
            </div>
          </div>
        )}

        {/* Progress indicator */}
        {embedding && (
          <div className="stego-progress">
            <p className="muted detect-status">{stegoProgress || "Processing..."}</p>
            <div className="progress-bar"><div className="progress-bar-indeterminate"></div></div>
          </div>
        )}
        <div className="row modal-actions">
          <button type="button" onClick={onClose} disabled={embedding}>Cancel</button>
          <button type="button" onClick={onConfirm} className="btn-primary" disabled={embedding || (isWeb() && !embedCoverFile)}>
            {embedding ? "Embedding..." : "Embed"}
          </button>
        </div>
      </div>
    </div>
  );
}
