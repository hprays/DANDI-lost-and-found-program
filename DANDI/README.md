# DANDI Frontend

단국대학교 교내 분실물 통합 웹 서비스 단디의 Next.js 애플리케이션입니다.

서비스 소개, 아키텍처, 기술 스택, 핵심 기능, 트러블슈팅과 제출 자료는 **[저장소 메인 README](../README.md)**에서 확인할 수 있습니다.

## 로컬 실행

이 디렉터리에서 실행합니다.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Firebase 웹 앱 설정과 백엔드 주소를 `.env.local`에 입력합니다. 챗봇을 사용하려면 서버 전용 LLM 환경 변수도 설정합니다. 자세한 내용은 [메인 README의 로컬 사용법](../README.md#로컬-사용법)을 참고하세요.

- 프론트엔드: http://localhost:3000
- 백엔드 기본 주소: http://localhost:8080 (별도 실행)

## 점검

```bash
npm run check:ids
npm run check:filters
npm run lint
npm run build
```
