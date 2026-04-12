import { NextResponse } from "next/server";

type Body = {
  name?: string;
  category?: string;
  type?: string;
};

const categoryCautions: Record<string, string[]> = {
  전자기기: [
    "수령 시 기기 잠금 해제 또는 고유 정보(케이스 특징)를 요청받을 수 있습니다.",
    "충전 케이블/케이스 등 부속품 정보까지 함께 설명하면 확인이 빨라집니다.",
  ],
  "지갑/가방": [
    "신분증 또는 학생증으로 본인 확인 후 수령 가능합니다.",
    "지갑 내부 카드 종류를 일부 확인할 수 있으니 기억해 두세요.",
  ],
  신분증: [
    "본인 확인을 위한 추가 인증(학번/생년월일) 절차가 있을 수 있습니다.",
    "분실 신분증은 수령 즉시 재발급 여부를 확인해 주세요.",
  ],
};

export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  const category = body.category ?? "기타";
  const name = body.name ?? "분실물";
  const type = body.type ?? "개인 소지품";

  const defaultCautions = [
    "학생증 또는 신분증을 지참해 주세요.",
    "습득 장소/시간을 확인하면 수령 절차가 빨라집니다.",
  ];

  const cautions = [...(categoryCautions[category] ?? defaultCautions), "대리 수령 시 위임 확인 정보가 필요할 수 있습니다."];

  return NextResponse.json({
    cautionTitle: `AI 분석 결과: ${name} (${category}/${type}) 수령 안내`,
    cautions,
    chatbotTips: [
      "어디로 가야 하나요?",
      "학생증이 꼭 필요한가요?",
      "운영시간이 언제인가요?",
      "대리 수령이 가능한가요?",
    ],
  });
}
