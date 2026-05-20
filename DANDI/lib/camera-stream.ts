export type CameraOpenResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; error: string };

const VIDEO_CONSTRAINT_ATTEMPTS: MediaStreamConstraints[] = [
  { video: { facingMode: { ideal: "environment" } }, audio: false },
  { video: { facingMode: "environment" }, audio: false },
  { video: true, audio: false },
];

function formatMediaError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "카메라 권한이 거부되었습니다. 브라우저 주소창 옆 카메라 허용 후 다시 시도해 주세요.";
    }
    if (error.name === "NotFoundError") {
      return "사용 가능한 카메라가 없습니다. 웹캠 연결을 확인해 주세요.";
    }
    if (error.name === "NotReadableError") {
      return "카메라가 다른 프로그램에서 사용 중입니다. 다른 앱을 종료한 뒤 다시 시도해 주세요.";
    }
    if (error.name === "OverconstrainedError") {
      return "요청한 카메라 설정을 지원하지 않습니다. 기본 카메라로 다시 시도해 주세요.";
    }
    return error.message || error.name;
  }
  return error instanceof Error ? error.message : "카메라를 사용할 수 없습니다.";
}

/** 후면 카메라 우선, PC 웹캠은 video:true 로 폴백 */
export async function requestCameraStream(): Promise<CameraOpenResult> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, error: "이 브라우저에서는 카메라를 지원하지 않습니다." };
  }

  let lastError: unknown = null;
  for (const constraints of VIDEO_CONSTRAINT_ATTEMPTS) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      if (!track) {
        stream.getTracks().forEach((t) => t.stop());
        continue;
      }
      return { ok: true, stream };
    } catch (error) {
      lastError = error;
    }
  }

  return { ok: false, error: formatMediaError(lastError) };
}

/** video 재생 실패 시 사용자에게 보여줄 메시지 반환 (성공 시 null) */
export async function attachStreamToVideo(
  video: HTMLVideoElement,
  stream: MediaStream
): Promise<string | null> {
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;

  try {
    await video.play();
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          video.removeEventListener("loadeddata", onReady);
          video.removeEventListener("error", onErr);
          resolve();
        };
        const onErr = () => {
          video.removeEventListener("loadeddata", onReady);
          video.removeEventListener("error", onErr);
          reject(new Error("비디오 스트림을 불러오지 못했습니다."));
        };
        video.addEventListener("loadeddata", onReady);
        video.addEventListener("error", onErr);
      });
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "카메라 영상 재생에 실패했습니다.";
  }
}
