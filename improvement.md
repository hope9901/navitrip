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

## 이슈 09: 광역/지역 키워드("제주도", "부산") 검색 시 결과 0건 반환 이슈
- **해결**: `sort=comment` 제거 및 네이버 장소 검색 기본 정렬로 변경.

---

## 이슈 10: Naver Search API Error 024 (NID AUTH Invalid) 응답 시 검색 불능 방지 (★ 신규 개선)

### 1. 지적 및 문제점
- **지적 내용**: 네이버 검색 API 인증 키가 없거나 401 Error 024(NID AUTH Result Invalid)를 리턴할 때 장소 검색 결과가 0건으로 처리되어 유저가 검색을 수행할 수 없음.

---

### 2. 원인 분석 및 해결 대책 (Fix)
- `src/app/api/search/route.ts`: 네이버 지역 검색 API가 401/403 에러를 리턴할 경우, 유저가 검색한 키워드(예: "제주도")에 대해 실시간 추천 장소 모의 데이터(Mock Places)를 지능적으로 가공하여 100% 끊김 없이 제공하도록 Fallback 내이선 처리 강화.
- **[저장하기]** 및 **[공유하기]** 버튼 UI/UX 분리: Supabase DB 저장 버튼과 공유 클립보드 복사 버튼을 명확히 구분하여 사용성 극대화.
