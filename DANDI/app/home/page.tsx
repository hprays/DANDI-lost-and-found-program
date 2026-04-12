import Link from "next/link";
import Image from "next/image";
import { CirclePlus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { QAChatbot } from "@/components/qa-chatbot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildings, categories, lostItems } from "@/lib/mock-data";

export default function HomePage() {
  return (
    <AppShell subtitle="분실물 현황을 실시간으로 확인해보세요.">
      <section className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-muted-foreground">물건을 잃어버리셨나요?</p>
                <p className="text-lg font-bold">관리자에게 신고 접수</p>
              </div>
              <Button asChild>
                <Link href="/register-item">
                  <CirclePlus className="h-4 w-4" />
                  신고하기
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-muted-foreground">주인을 찾아주세요</p>
                <p className="text-lg font-bold">주변 관리실 위치 안내</p>
              </div>
              <Button asChild variant="outline">
                <Link href="/map">지도 보기</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="분실물 키워드 검색 (예: 에어팟, 검정 지갑)" className="pl-9" />
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">카테고리 분류</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((category, idx) => (
                <Badge key={category} variant={idx === 0 ? "default" : "outline"} className="cursor-pointer whitespace-nowrap px-3 py-1">
                  {category}
                </Badge>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">건물별 분류</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {buildings.map((building, idx) => (
                <Badge key={building} variant={idx === 0 ? "default" : "secondary"} className="cursor-pointer whitespace-nowrap px-3 py-1">
                  {building}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {lostItems.map((item) => (
            <Link key={item.id} href={`/lost/${item.id}`}>
              <Card className="cursor-pointer overflow-hidden transition-transform hover:-translate-y-0.5">
                <div className="relative h-40">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <Badge>{item.category}</Badge>
                    <span className="text-xs text-muted-foreground">{item.time}</span>
                  </div>
                  <h3 className="text-base font-bold">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">{item.place}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <QAChatbot />
    </AppShell>
  );
}
