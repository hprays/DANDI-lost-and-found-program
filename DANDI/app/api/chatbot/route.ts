import { NextResponse } from "next/server";

type ChatHistory = Array<{ role: "user" | "bot"; text: string }>;

type Body = {
  message?: string;
  history?: ChatHistory;
};

const SYSTEM_PROMPT = `너는 단국대학교 분실물 플랫폼 '단디'의 도우미 챗봇이다.
짧고 친절한 한국어로 답변하고, 사용자가 분실물 수령/위치/신분확인/운영시간 관련 질문을 하면 실무적으로 안내한다.
모르면 추측하지 말고 관리자 문의 또는 지도/마이페이지 확인을 안내한다.`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ answer: "질문을 입력해 주세요." }, { status: 400 });
    }

    const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
    const model = process.env.LLM_MODEL ?? process.env.OPENAI_MODEL ?? "gemini-2.5-flash";
    const baseUrl = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    if (!apiKey) {
      return NextResponse.json({
        answer: "현재 AI 서버 키가 설정되지 않아 기본 안내로 답변합니다. 지도 페이지에서 관리실 위치를 확인해 주세요.",
      });
    }

    const history = (body.history ?? []).slice(-8);
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((h) => ({
        role: h.role === "bot" ? "assistant" : "user",
        content: h.text,
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
      const text = await response.text();
      return NextResponse.json({ answer: `AI 응답 생성에 실패했습니다. (${text.slice(0, 120)})` }, { status: 500 });
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
