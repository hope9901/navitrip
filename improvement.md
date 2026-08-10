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

## 이슈 07: `<input>` 폼 필드 `id` / `name` 속성 누락 경고
- **해결**: `PlaceSearchCard` 및 `ItinerarySidebar`에 unique `id` 및 `name` 속성 부여.

## 이슈 08: 데스크톱/모바일 동시 마운트로 인한 Duplicate Form Field ID & 검색 불능
- **해결**: React 18 `useId()` 훅으로 동적 고유 ID 부여.

---

## 이슈 09: 광역/지역 키워드("제주도", "부산") 검색 시 결과 0건 반환 이슈 (★ 신규 개선)

### 1. 지적 및 문제점
- **지적 내용**: "제주도", "강원도" 와 같은 광역 키워드로 검색 시 검색 결과가 0개로 표시되는 현상.

---

### 2. 원인 분석 (Root Cause)
- `src/app/api/search/route.ts` 호출 시 `sort=comment` 옵션이 파라미터로 지정되어 있었음.
- 네이버 지역 검색 API(`local.json`)에서 `sort=comment`는 특정 단일 상호명 검색 시에는 동작하지만, "제주도", "속초" 등 광역/지역 단어 검색 시에는 네이버 API 내부 정렬 필터링 과정에서 결과가 0건으로 누락 리턴됨.

---

### 3. 해결 대책 (Fix)
- `sort=comment` 파라미터를 제거하고 네이버 지역 검색 기본 정렬(`random`/기본 유사도)로 변경.
- "제주도", "속초", "강릉", "해운대" 등 단일 지역 키워드로 검색하더라도 네이버 장소 검색 결과 10건이 정상적으로 폭넓게 반환되도록 수정.
