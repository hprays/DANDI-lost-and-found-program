import { categories } from "@/lib/mock-data";

/** 물품명 키워드 → 카테고리 (카테고리명은 mock-data.ts categories와 동일) */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "신분증": ["학생증", "신분증", "주민등록증", "운전면허", "여권", "외국인등록증"],
  "카드/티켓": ["카드", "티켓", "교통카드"],
  "지갑/가방": ["지갑", "카드지갑", "가방", "백팩", "파우치", "에코백", "쇼핑백", "크로스백"],
  "전자기기": [
    "이어폰", "에어팟", "버즈", "애플워치", "갤럭시워치", "워치", "휴대폰", "핸드폰", "아이폰", "갤럭시",
    "노트북", "태블릿", "테블릿", "아이패드", "패드", "갤럭시탭", "충전기", "보조배터리", "보존배터리",
    "배터리", "베터리", "마우스", "키보드", "애플펜슬", "펜슬", "USB", "케이블", "드론", "전자담배",
    "헤드셋", "헤드폰", "스피커", "계산기",
  ],
  "의류": [
    "모자", "바지", "자켓", "재킷", "점퍼", "후드", "셔츠", "니트", "가디건", "목도리", "장갑",
    "슬리퍼", "신발", "양말", "패딩", "코트", "조끼", "바라클라바", "의류", "옷",
  ],
  "악세서리": ["안경", "선글라스", "반지", "목걸이", "귀걸이", "팔찌", "시계", "머리끈", "집게삔", "헤어", "스크런치", "거울"],
  "도서/문구": ["책", "노트", "필통", "볼펜", "샤프", "연필", "S펜", "교재", "수첩", "파일", "도서", "문제집", "스케치북"],
  "스포츠/운동": ["라켓", "축구공", "농구공", "배구공", "운동", "요가"],
  "악기": ["악기", "리코더", "우쿨렐레"],
  "텀블러/생활용품": ["텀블러", "물병", "보틀", "컵", "안약", "렌즈", "손풍기", "선풍기", "담요", "쿠션", "인형", "피규어", "증명사진", "칫솔", "약"],
  "열쇠/키링": ["열쇠", "키링", "키홀더", "차키"],
  "우산/우비": ["우산", "우비"],
  "화장품": ["틴트", "립", "화장품", "파우더", "향수", "핸드크림"],
};

/** 물품명에서 가장 앞에 나온 키워드(같은 위치면 긴 키워드)의 카테고리, 없으면 "기타" */
export function guessCategory(text: string): string {
  let best: { pos: number; len: number; category: string } | null = null;
  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const word of words) {
      const pos = text.indexOf(word);
      if (pos < 0) continue;
      if (!best || pos < best.pos || (pos === best.pos && word.length > best.len)) {
        best = { pos, len: word.length, category };
      }
    }
  }
  return best?.category ?? "기타";
}

/** API 카테고리가 화면 카테고리 목록에 있으면 그대로, 아니면 물품명으로 추정 */
export function resolveCategory(apiCategory: string | undefined, name: string): string {
  if (apiCategory && categories.includes(apiCategory)) return apiCategory;
  return guessCategory(`${name} ${apiCategory ?? ""}`);
}
