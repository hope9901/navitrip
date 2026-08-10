# Improvement Log (문제점 및 개선 사항 기록)

## 이슈 01: Naver Directions 5 API 경유지(Waypoints) 5개 제한 문제
- **해결**: 1대1 구간별(Segment-by-Segment) 분할 연산으로 5개 제한 무력화.

## 이슈 02: 블록 이동 시 잦은 API 호출 문제
- **해결**: 400ms 디바운스 및 인메모리 캐싱(`routeSegmentCache`) 적용.

## 이슈 03: SSR & `@dnd-kit` Hydration Error (aria-describedby Mismatch)
- **해결**: `DndContext` 고유 `id` 설정 및 `isMounted` Client Guard 적용.

## 이슈 04: 브라우저 확장 프로그램(Browser Extension)으로 인한 `<html>` 태그 Hydration Error
- **해결**: Root Layout `<html>` 및 `<body>` 태그에 `suppressHydrationWarning` 속성 적용.

## 이슈 05: 네이버 지도 OpenAPI 인증 실패 문제
- **해결**: NCP 콘솔 Web 서비스 URL 등록 가이드 및 스크립트 렌더링 예외 처리 보완.

## 이슈 06: developers.naver.com vs ncloud.com Client ID 구분
- **해결**: ncloud.com 전용 `ncpKeyId` 적용 및 구분 안내.

---

## 이슈 07: `<input>` 폼 필드 `id` / `name` 속성 누락 경고 (★ 신규 개선)

### 1. 지적 및 문제점
- **지적 내용**: 웹 브라우저의 폼 자동완성(Autofill) 및 접근성(SEO) 표준에 따라 `<input>` 폼 필드 엘리먼트에 `id` 또는 `name` 속성이 누락되면 콘솔 경고 메시지가 발생함.

---

### 2. 원인 분석 및 해결 방안 (Fix)
- `PlaceSearchCard.tsx`: 장소 검색 `<input>` 태그에 `id="place-search-input"`, `name="placeSearchQuery"`, `autoComplete="off"` 속성 추가.
- `ItinerarySidebar.tsx`: 여행 제목 입력 `<input>` 태그에 `id="plan-title-input"`, `name="planTitle"` 속성 추가.

---

### 3. 방지 대책 및 적용 수칙
- 모든 사용자 입력을 받는 `<input>`, `<textarea>`, `<select>` 등의 폼 엘리먼트에는 고유한 `id` 및 `name` 속성을 필수로 선언하는 개발 수칙을 준수함.
