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

## 이슈 08: 데스크톱/모바일 동시 마운트로 인한 Duplicate Form Field ID & 검색 불능 (★ 신규 개선)

### 1. 지적 및 문제점
- **지적 내용**:
  1. `Multiple form field elements in the same form have the same id attribute value` 콘솔 오류 발생.
  2. 장소 검색이 동작하지 않는 현상.

---

### 2. 원인 분석 (Root Cause)
- **데스크톱 사이드바 (`ItinerarySidebar`)**와 **모바일 바텀시트 (`MobileBottomSheet`)**가 DOM에 동시에 마운트되면서, 하위 컴포넌트인 `PlaceSearchCard`와 `ItinerarySidebar` 내부의 `<input>` 엘리먼트에 동일한 고정 ID (`id="place-search-input"`, `id="plan-title-input"`)가 2개씩 생성됨.
- 중복된 DOM ID로 인해 폼 제출(Submit) 이벤트 대상 이벤트를 브라우저가 오동작 처리하여 검색 폼 작동 불능 및 접근성 에러가 발생함.

---

### 3. 해결 대책 (Fix)
- React 18+ 내장 **`useId()`** 훅을 활용하여 각 컴포넌트 인스턴스마다 100% 고유한(Unique) DOM ID를 동적으로 생성.
- `PlaceSearchCard.tsx` ➔ `const searchInputId = useId();`
- `ItinerarySidebar.tsx` ➔ `const titleInputId = useId();`
- 데스크톱과 모바일 영역에서 각각 독립된 유일 ID가 부여되어 중복 ID 오류 및 검색 기능 장애를 완전 해결.
