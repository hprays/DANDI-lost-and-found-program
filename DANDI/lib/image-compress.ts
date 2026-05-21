/** Vision·등록 업로드 전 클라이언트 리사이즈 (용량·분석 시간 단축) */
export async function compressImageFile(
  file: File,
  maxEdge = 1280,
  quality = 0.82
): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 600_000) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
  );
  if (!blob) return file;

  const base = file.name.replace(/\.[^.]+$/, "") || "upload";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}
