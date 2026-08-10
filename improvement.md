# Improvement Log (문제점 및 개선 사항 기록)

## 이슈 01: Naver Directions 5 API 경유지(Waypoints) 5개 제한 문제
- **해결**: 1대1 구간별(Segment-by-Segment) 분할 연산으로 5개 제한 무력화.

## 이슈 02: 블록 이동 시 잦은 API 호출 문제
- **해결**: 400ms 디바운스 및 인메모리 캐싱(`routeSegmentCache`) 적용.

## 이슈 03: SSR & `@dnd-kit` Hydration Error (aria-describedby Mismatch)
- **해결**: `DndContext` 고유 `id` 설정 및 `isMounted` Client Guard 적용.

---

## 이슈 04: 브라우저 확장 프로그램(Browser Extension)으로 인한 `<html>` 태그 Hydration Error (★ 신규 개선)

### 1. 지적 및 문제점
- **지적 내용**: 사용자의 브라우저 확장 프로그램(번역/다크모드/웹툴 등)이 React 가동 전 `<html>` 태그에 인라인 스타일(`style="--color-tl-primary..."`)을 주입하여 SSR 렌더링 결과와 브라우저 DOM 속성이 불일치하는 콘솔 에러 발생.

---

### 2. 원인 분석 및 해결 방안 (Fix)
- Next.js 공식 권장 사양에 따라 `src/app/layout.tsx`의 `<html>` 태그에 **`suppressHydrationWarning={true}`** 속성을 부여.
- 브라우저 익스텐션에 의한 외부 DOM 변형 시 발생하는 React Hydration 경고를 안전하게 차단/억제함.
- `lang="ko"` 속성 추가로 한글 웹 서비스에 맞게 메타 데이터 개선.

---

### 3. 방지 대책 및 적용 수칙
- Root Layout의 `<html>` 및 `<body>` 태그에는 브라우저 확장 프로그램 개입에 대응하기 위해 항상 `suppressHydrationWarning`을 부여하는 것을 표준 개발 관례로 지정함.
