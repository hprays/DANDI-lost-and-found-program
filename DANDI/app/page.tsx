import Link from "next/link";
import {
  Bot,
  Camera,
  Check,
  ListChecks,
  LocateFixed,
  LogIn,
  Search,
  Wallet,
} from "lucide-react";
import { LandingHeader } from "@/components/landing-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const featureCards = [
  {
    title: "실시간 습득물 조회",
    desc: "캠퍼스 곳곳에서 발견된 습득물을 카테고리와 건물별로 빠르게 확인해요.",
    points: ["카테고리별 필터링", "건물별 분류", "키워드 검색"],
    icon: Search,
  },
  {
    title: "AI 수령 안내",
    desc: "물품 정보와 위치를 기반으로 수령 절차와 준비물을 자동 안내합니다.",
    points: ["물품별 맞춤 안내", "수령 절차 요약", "신분 확인 가이드"],
    icon: Bot,
    emphasized: true,
  },
  {
    title: "관리실 위치 안내",
    desc: "가장 가까운 관리실 위치와 연락처를 지도 기반으로 즉시 확인할 수 있어요.",
    points: ["인터랙티브 캠퍼스 지도", "운영시간 안내", "관리실 연락처"],
    icon: LocateFixed,
  },
];

const heroStats = [
  { label: "실시간", desc: "습득물 업데이트" },
  { label: "AI", desc: "수령 안내 제공" },
  { label: "지도", desc: "관리실 위치 안내" },
];

const categories = ["전자기기", "지갑/가방", "신분증", "의류/악세서리", "도서/문구", "기타"];

const faqs = [
  {
    q: "단디는 누구나 사용할 수 있나요?",
    a: "단디는 단국대학교 구성원을 위한 서비스입니다. 가입 시 학교 이메일 도메인을 확인합니다.",
  },
  {
    q: "물건을 잃어버렸는데 어떻게 해야 하나요?",
    a: "홈에서 키워드/카테고리 검색 후 일치하는 항목을 선택하고, 지도 안내로 관리실 위치를 확인해 주세요.",
  },
  {
    q: "습득물을 발견했을 때 어떻게 등록하나요?",
    a: "분실물 등록 페이지에서 사진과 위치, 습득 시간을 입력하면 관리자 확인 후 게시됩니다.",
  },
  {
    q: "AI 수령 안내는 어떻게 작동하나요?",
    a: "분실물 상세 정보와 카테고리를 바탕으로 신분증 지참 여부 등 필요한 주의사항을 자동 안내합니다.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <LandingHeader />

      <section className="bg-primary px-4 pb-12 pt-12 text-white md:pb-16 md:pt-20">
        <div className="mx-auto max-w-screen-lg">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="rounded-full bg-white/15 px-4 py-1 text-white">
              단국대학교 재학생 전용 서비스
            </Badge>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.15] tracking-tight md:text-6xl">
              <span className="block">잃어버린 물건</span>
              <span className="block">단디가 찾아드려요</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">
              캠퍼스 내 분실물 현황을 실시간으로 확인하고, AI 수령 안내와 지도 기반 경로로 빠르게 되찾아보세요.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-xl bg-white text-primary hover:bg-white/90">
                <Link href="/login">
                  <Search className="h-4 w-4" />
                  분실물 찾기
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link href="/login">
                  <Camera className="h-4 w-4" />
                  습득물 등록하기
                </Link>
              </Button>
            </div>
          </div>

          <dl className="mx-auto mt-10 grid max-w-3xl grid-cols-3 divide-x divide-white/20 rounded-2xl border border-white/20 bg-white/10">
            {heroStats.map((stat) => (
              <div key={stat.label} className="px-3 py-4 text-center md:py-5">
                <dt className="text-lg font-bold md:text-2xl">{stat.label}</dt>
                <dd className="mt-1 text-xs text-white/80 md:text-sm">{stat.desc}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="features" className="container py-16">
        <div className="text-center">
          <p className="text-xs font-bold tracking-[0.24em] text-primary">FEATURES</p>
          <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">단디의 주요 기능</h2>
          <p className="mt-3 text-muted-foreground">분실물 찾기의 모든 과정을 더 쉽고 빠르게</p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {featureCards.map((card) => (
            <Card key={card.title} className={card.emphasized ? "border-primary bg-primary text-white" : ""}>
              <CardHeader>
                <div className={`mb-4 w-fit rounded-xl p-3 ${card.emphasized ? "bg-white/20" : "bg-primary/10"}`}>
                  <card.icon className={`h-5 w-5 ${card.emphasized ? "text-white" : "text-primary"}`} />
                </div>
                <CardTitle className="text-xl">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`leading-relaxed ${card.emphasized ? "text-white/85" : "text-muted-foreground"}`}>{card.desc}</p>
                <ul className="mt-4 space-y-2">
                  {card.points.map((point) => (
                    <li key={point} className="flex items-center gap-2 text-sm font-semibold">
                      <Check className={`h-4 w-4 ${card.emphasized ? "text-white" : "text-primary"}`} />
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-white py-16">
        <div className="container">
          <div className="text-center">
            <p className="text-xs font-bold tracking-[0.24em] text-primary">HOW IT WORKS</p>
            <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">3단계로 끝내는 분실물 찾기</h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3 md:gap-5">
            {[
              { step: "1", title: "로그인", desc: "단국대 이메일로 간편하게 가입하고 로그인해요.", icon: LogIn },
              { step: "2", title: "습득물 확인", desc: "실시간 목록과 필터로 내 물건을 찾아봐요.", icon: ListChecks },
              { step: "3", title: "수령하기", desc: "AI 안내에 따라 준비물 확인 후 관리실에서 수령해요.", icon: Wallet },
            ].map((item) => (
              <Card key={item.step}>
                <CardHeader>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                      <item.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="text-sm font-bold text-primary">STEP {item.step}</span>
                  </div>
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="leading-relaxed text-muted-foreground">{item.desc}</CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 rounded-2xl bg-accent px-6 py-8 text-center">
            <h3 className="text-xl font-bold md:text-2xl">다양한 물품 카테고리</h3>
            <ul className="mt-5 flex flex-wrap justify-center gap-2">
              {categories.map((category) => (
                <li
                  key={category}
                  className="rounded-full border border-primary/15 bg-card px-4 py-2 text-sm font-semibold text-accent-foreground"
                >
                  {category}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="faq" className="container py-16">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="text-xs font-bold tracking-[0.24em] text-primary">FAQ</p>
            <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">자주 묻는 질문</h2>
          </div>
          <Card className="mt-8 rounded-2xl px-4">
            <Accordion type="single" collapsible>
              {faqs.map((faq, idx) => (
                <AccordionItem key={faq.q} value={`item-${idx}`}>
                  <AccordionTrigger className="py-5 text-base">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </div>
      </section>

      <section className="bg-primary px-4 py-16 text-white">
        <div className="mx-auto max-w-screen-md text-center">
          <h2 className="text-3xl font-extrabold md:text-4xl">지금 바로 시작하세요</h2>
          <p className="mt-3 text-white/85">단국대학교 이메일만 있으면 무료로 이용할 수 있습니다.</p>
          <Button asChild size="lg" className="mt-8 rounded-xl bg-white text-primary hover:bg-white/90">
            <Link href="/login">단디 시작하기</Link>
          </Button>
        </div>
      </section>

      <footer className="bg-slate-950 px-4 pb-safe py-7 text-slate-300">
        <div className="mx-auto flex max-w-screen-lg flex-col justify-between gap-3 text-sm md:flex-row md:items-center">
          <div className="font-semibold">단디(DANDI) - 단국대학교 스마트 분실물 플랫폼</div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-white">로그인</Link>
            <Link href="/login" className="hover:text-white">회원가입</Link>
            <Link href="/home" className="hover:text-white">메인</Link>
          </div>
          <div className="text-xs text-slate-400">© 2026 DANDI. Dankook University Capstone Design.</div>
        </div>
      </footer>
    </div>
  );
}
