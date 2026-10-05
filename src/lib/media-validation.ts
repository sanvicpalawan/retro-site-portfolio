export const MAX_MEDIA_ITEMS = 12;
export const MAX_MEDIA_BYTES = 1024 * 1024;
export const MAX_SITE_IMAGES = 20;
export const MAX_SITE_IMAGE_BYTES = 700 * 1024;

export type MediaUpload = {
  filename: string;
  mimeType: "image/webp" | "image/jpeg" | "image/png";
  altText: string;
  data: string;
};

export function parseMediaUpload(value: unknown): MediaUpload | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const filename = typeof input.filename === "string" ? input.filename.trim().slice(0, 180) : "";
  const altText = typeof input.altText === "string" ? input.altText.trim().slice(0, 180) : "";
  const dataUrl = typeof input.dataUrl === "string" ? input.dataUrl : "";
  const match = dataUrl.match(/^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!filename || !match) return null;

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_MEDIA_BYTES) return null;

  return {
    filename,
    mimeType: match[1] as MediaUpload["mimeType"],
    altText,
    data: match[2],
  };
}

export type SiteImageUpload = MediaUpload & { siteId: number };

export function parseSiteImageUpload(value: unknown, siteId: number): SiteImageUpload | null {
  const upload = parseMediaUpload(value);
  if (!upload || Buffer.byteLength(upload.data, "base64") > MAX_SITE_IMAGE_BYTES) return null;
  return {
    ...upload,
    siteId,
    filename: upload.filename.replace(/[\\/]/g, "_").slice(0, 180),
  };
}
