import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "개인정보 처리방침 | DANDI" };

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. 수집하는 항목",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>로그인: 단국대학교 Google 계정 이메일(@dankook.ac.kr)</li>
        <li>프로필: 이름, 학과, 학번</li>
        <li>분실물 신고: 물품 정보, 분실·습득 장소와 시간, 물품 사진</li>
        <li>이용 기록: 수령 QR 발급·사용 기록, 관심 물품, 관심 키워드, 알림</li>
      </ul>
    ),
  },
  {
    title: "2. 이용 목적",
    body: "분실물 신고 접수와 조회, 수령할 때 본인 확인, 관심 키워드 알림에만 사용합니다. 다른 목적으로 쓰지 않습니다.",
  },
  {
    title: "3. 보관 기간과 파기",
    body: "시범 운영이 끝나는 2026년 12월 20일까지 보관하며, 그 뒤 서버, 데이터베이스, 사진 저장소를 함께 삭제합니다. 탈퇴나 삭제를 요청하면 지체 없이 지웁니다.",
  },
  {
    title: "4. 처리를 맡기는 곳",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Amazon Web Services(서울 리전): 서버, 데이터베이스, 사진 저장</li>
        <li>Google Firebase: 로그인 확인</li>
        <li>Google Cloud Vision: 사진 속 글자 인식(개인정보 가림 처리)</li>
        <li>Google Gemini: 챗봇 질문에 대한 답변 생성(질문 내용을 따로 저장하지 않음)</li>
        <li>Vercel: 웹 화면 제공</li>
        <li>QR Server(api.qrserver.com): 수령 QR 이미지 생성</li>
      </ul>
    ),
  },
  {
    title: "5. 사진 속 개인정보",
    body: "신분증·학생증·카드 사진은 글자를 검은색으로 가린 뒤 공개합니다. 가리기 전 원본은 저장하지 않습니다.",
  },
  {
    title: "6. 동의를 거부할 권리",
    body: "개인정보 수집·이용에 대한 동의를 거부할 권리가 있습니다. 다만, 동의를 거부할 경우 서비스 이용이 제한됩니다.",
  },
  {
    title: "7. 열람·수정·삭제 요청과 문의",
    body: "이름, 학과, 학번은 마이페이지에서 고칠 수 있습니다. 열람·삭제 요청과 문의는 인스타그램 @dku_dandi 메시지로 보내 주세요.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <article className="mx-auto max-w-2xl space-y-6 rounded-2xl bg-white p-6 shadow-sm">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">개인정보 처리방침</h1>
          <p className="text-sm text-muted-foreground">DANDI(단디) 분실물 찾기 서비스 · 시행일 2026년 11월 14일</p>
        </header>
        {sections.map((s) => (
          <section key={s.title} className="space-y-2">
            <h2 className="text-base font-semibold">{s.title}</h2>
            <div className="text-sm leading-relaxed text-slate-700">{s.body}</div>
          </section>
        ))}
        <Link href="/" className="inline-block text-sm font-medium text-primary hover:underline">
          처음 화면으로
        </Link>
      </article>
    </div>
  );
}
