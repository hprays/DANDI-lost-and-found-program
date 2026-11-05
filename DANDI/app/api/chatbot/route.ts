import { NextResponse } from "next/server";

type ChatHistory = Array<{ role: "user" | "bot"; text: string }>;

type Body = {
  message?: string;
  history?: ChatHistory;
};

const SYSTEM_PROMPT = `너는 단국대학교 분실물 플랫폼 '단디'의 도우미 챗봇이다.
짧고 친절한 한국어로 답변하고, 사용자가 분실물 수령/위치/신분확인/운영시간 관련 질문을 하면 실무적으로 안내한다.
모르면 추측하지 말고 관리자 문의 또는 지도/마이페이지 확인을 안내한다.`;

const MAX_MESSAGE_CHARS = 500;
const MAX_HISTORY = 8;
const RATE_LIMIT_PER_MINUTE = 10;
const TOKEN_CACHE_MS = 5 * 60_000;

// ponytail: 서버리스 인스턴스마다 메모리가 따로라 인스턴스 단위 제한. 공유가 필요하면 KV/Redis로.
const verifiedTokens = new Map<string, { uid: string; until: number }>();
const recentCalls = new Map<string, number[]>();

/** 백엔드(/api/auth/me)로 Firebase 토큰을 확인 — 로그인한 @dankook.ac.kr 사용자만 허용 */
async function resolveUid(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const cached = verifiedTokens.get(token);
  if (cached && cached.until > Date.now()) return cached.uid;

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
  if (!apiBase) return null;
  try {
    const res = await fetch(`${apiBase}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const me = (await res.json()) as { uid?: string };
    if (!me.uid) return null;
    verifiedTokens.set(token, { uid: me.uid, until: Date.now() + TOKEN_CACHE_MS });
    return me.uid;
  } catch {
    return null;
  }
}

function allowCall(uid: string): boolean {
  const now = Date.now();
  const calls = (recentCalls.get(uid) ?? []).filter((t) => now - t < 60_000);
  if (calls.length >= RATE_LIMIT_PER_MINUTE) {
    recentCalls.set(uid, calls);
    return false;
  }
  calls.push(now);
  recentCalls.set(uid, calls);
  return true;
}

export async function POST(req: Request) {
  try {
    const uid = await resolveUid(req);
    if (!uid) {
      return NextResponse.json({ answer: "로그인 후 이용해 주세요." }, { status: 401 });
    }
    if (!allowCall(uid)) {
      return NextResponse.json(
        { answer: "질문이 너무 잦습니다. 1분 뒤에 다시 시도해 주세요." },
        { status: 429 },
      );
    }

    const body = (await req.json()) as Body;
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ answer: "질문을 입력해 주세요." }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        { answer: `질문은 ${MAX_MESSAGE_CHARS}자 이내로 입력해 주세요.` },
        { status: 400 },
      );
    }

    const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
    const model = process.env.LLM_MODEL ?? process.env.OPENAI_MODEL ?? "gemini-2.5-flash";
    const baseUrl = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    if (!apiKey) {
      return NextResponse.json({
        answer: "현재 AI 서버 키가 설정되지 않아 기본 안내로 답변합니다. 지도 페이지에서 관리실 위치를 확인해 주세요.",
      });
    }

    const history = (Array.isArray(body.history) ? body.history : []).slice(-MAX_HISTORY);
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((h) => ({
        role: h.role === "bot" ? "assistant" : "user",
        content: String(h.text ?? "").slice(0, MAX_MESSAGE_CHARS),
      })),
      { role: "user", content: message },
    ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      // 외부 LLM 오류 내용은 사용자에게 보내지 않는다 (서버 로그에만 상태 코드 기록)
      console.error("chatbot upstream failed", response.status);
      return NextResponse.json({ answer: "AI 응답 생성에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = data.choices?.[0]?.message?.content?.trim() ?? "답변을 생성하지 못했습니다.";

    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ answer: "챗봇 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
