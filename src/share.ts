export interface SharePayload {
  /** Raw text of the old/left spec. */
  old: string;
  /** Raw text of the new/right spec. */
  next: string;
}

const PREFIX = "d=";

/**
 * Encodes both spec texts into a URL-safe string for the location hash. The
 * comparison lives entirely in the link (base64url of a UTF-8 JSON payload) —
 * nothing is sent to a server, which is what makes the shareable link honest
 * per docs/VISION.md. Stored in the hash fragment, so length is bounded by the
 * browser's (multi-MB) fragment limit, not a server URL cap (story 3.2).
 */
export function encodeShare(payload: SharePayload): string {
  const json = JSON.stringify({ o: payload.old, n: payload.next });
  const bytes = new TextEncoder().encode(json);
  return PREFIX + bytesToBase64url(bytes);
}

/** Decodes a hash produced by {@link encodeShare}; returns null on any garbage. */
export function decodeShare(hash: string): SharePayload | null {
  const raw = hash.replace(/^#/, "");
  if (!raw.startsWith(PREFIX)) return null;
  try {
    const bytes = base64urlToBytes(raw.slice(PREFIX.length));
    const json = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).o === "string" &&
      typeof (parsed as Record<string, unknown>).n === "string"
    ) {
      const obj = parsed as { o: string; n: string };
      return { old: obj.o, next: obj.n };
    }
    return null;
  } catch {
    return null;
  }
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 =
    typeof btoa === "function"
      ? btoa(binary)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).Buffer.from(binary, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const binary =
    typeof atob === "function"
      ? atob(b64)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).Buffer.from(b64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
