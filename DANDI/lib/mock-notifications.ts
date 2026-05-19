export type MockNotification = {
  id: string;
  title: string;
  summary: string;
  detail: string;
  createdAt: string;
  read: boolean;
  type: "report" | "pickup" | "match" | "system";
};

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: "mock-notice-1",
    title: "분실물 신고가 접수되었습니다",
    summary: "에어팟 프로 · ICT관 3층 로비",
    detail:
      "관리자에게 분실물 신고가 전달되었습니다. 검수 후 습득 여부를 알림으로 안내드립니다.\n\n물품명: 에어팟 프로\n장소: ICT관 3층 로비\n상태: 검수 대기",
    createdAt: "2026-05-19 09:12",
    read: false,
    type: "report",
  },
  {
    id: "mock-notice-2",
    title: "습득물이 확인되었습니다",
    summary: "검정 반지갑 · 범정관 1층 안내 데스크",
    detail:
      "신고하신 물품과 유사한 습득물이 등록되었습니다. 본인 확인 후 관리실에서 수령해 주세요.\n\n물품명: 검정 반지갑\n보관 장소: 범정관 1층 안내 데스크\n필요 서류: 학생증 또는 신분증",
    createdAt: "2026-05-18 16:40",
    read: false,
    type: "match",
  },
  {
    id: "mock-notice-3",
    title: "수령 QR이 발급되었습니다",
    summary: "유효 시간 30분 · 마이페이지에서 확인",
    detail:
      "수령 QR이 발급되었습니다. 관리실 방문 시 QR 코드를 제시해 주세요.\n\n유효 시간: 발급 후 30분\n확인 위치: 마이페이지 > 내 수령 QR",
    createdAt: "2026-05-17 14:05",
    read: true,
    type: "pickup",
  },
  {
    id: "mock-notice-4",
    title: "관심 키워드 알림",
    summary: "키워드 '에어팟'과 유사한 습득물 등록",
    detail:
      "설정하신 관심 키워드와 일치하는 습득물이 등록되었습니다.\n\n키워드: 에어팟\n물품: 무선 이어폰(화이트)\n위치: 퇴계도서관 2층",
    createdAt: "2026-05-16 11:20",
    read: true,
    type: "system",
  },
];

const MOCK_READ_KEY = "dandi.mock-notices.read";

export function getMockNotificationReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(MOCK_READ_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function markMockNotificationRead(id: string) {
  if (typeof window === "undefined") return;
  const ids = getMockNotificationReadIds();
  ids.add(id);
  window.localStorage.setItem(MOCK_READ_KEY, JSON.stringify([...ids]));
}

export function getMockNotificationsWithReadState(): MockNotification[] {
  const readIds = getMockNotificationReadIds();
  return MOCK_NOTIFICATIONS.map((n) => ({
    ...n,
    read: readIds.has(n.id) ? true : n.read,
  }));
}
