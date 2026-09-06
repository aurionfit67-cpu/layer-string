/**
 * ArrayBuffer <-> base64 helpers.
 *
 * IndexedDB can persist binary directly; the localStorage fallback and the JSON
 * export format cannot, so media bytes are base64 encoded there. Chunked to
 * avoid blowing the call stack on large files.
 */

export async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    let binary = "";
    for (let j = i; j < Math.min(i + chunkSize, bytes.length); j += 1) {
      binary += String.fromCharCode(bytes[j] as number);
    }
    chunks.push(btoa(binary));
  }
  return chunks.join("");
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const clean = base64.replace(/^data:[^,]*,/, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsArrayBuffer(blob);
  });
}

/** `data:<mime>;base64,<payload>` — used only for in-memory previews. */
export function toDataUrl(mime: string, base64: string): string {
  return `data:${mime || "application/octet-stream"};base64,${base64}`;
}
