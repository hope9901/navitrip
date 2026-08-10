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

## 이슈 12: 검색 기능 전면 수정 및 네이버 공식 API 완전 동기화 (★ 전면 개편)

### 1. 지적 및 문제점
- **지적 내용**:
  1. 기존 검색 기능에 mock 데이터, 샘플 검색 결과, 임의 추천, 서울/속초 등 강제 대체 좌표가 포함되어 있었음.
  2. 네이버 공식 API의 실제 검색 응답이 그대로 전달되지 않고 하드코딩된 결과가 섞여서 출력되었음.

### 2. 원인 분석 (Root Cause)
- 백엔드 `/api/search/route.ts`에 키 미설정 또는 오류 발생 시 임의의 추천 장소 객체를 리턴하는 fallback 및 하드코딩 데이터베이스가 잔존해 있었음.
- 네이버 지역 검색 API와 Geocoding API가 병렬로 통합 처리되지 않고 단순 텍스트 검색에 의존했음.

### 3. 해결 대책 (Fix)
- mock 데이터 및 하드코딩 100% 제거.
- `Promise.allSettled`로 장소 검색과 주소 검색 병렬 통합 연산.
- 중복 제거 및 엄격한 유효 좌표 검증 (`lat: 33~39`, `lng: 124~132`).

---

## 이슈 13: 2026 NAVER API HUB 신규 API 규격 및 최신 Endpoint 전환

### 1. 문제점
- `localSearch` API 호출 시 구형 `openapi.naver.com` 도메인 및 헤더(`X-Naver-Client-Id`) 사용으로 인해 401 (`024 NID AUTH Result Invalid`) 오류 지속 발생.
- `geocoding` 및 `directions` API 호출 시 구형 `naveropenapi.apigw.ntruss.com` 도메인 사용으로 인한 인증 실패.

### 2. 원인 분석
- Naver Cloud Platform의 2026 신규 NAVER API HUB 서비스는 구형 openapi 도메인이 아닌 `naverapihub.apigw.ntruss.com` 및 `maps.apigw.ntruss.com` 도메인과 `X-NCP-APIGW-API-KEY-ID` / `X-NCP-APIGW-API-KEY` 헤더를 사용함.

### 3. 해결 대책
- **Local Search**: `https://naverapihub.apigw.ntruss.com/search/v1/local` 적용 및 `parseLocalCoordinate` 호환 파싱 함수 적용 (HTTP 200 OK 달성).
- **Geocoding**: `https://maps.apigw.ntruss.com/map-geocode/v2/geocode` 적용 (HTTP 200 OK 달성).
- **Directions**: `https://maps.apigw.ntruss.com/map-direction/v1/driving` 적용.

---

## 이슈 14: 모바일 브라우저 너비 축소 시 장소 제거 X 버튼 중복 노출 및 겹침 문제

### 1. 문제점
- 브라우저 너비를 모바일 스크린 크기로 축소하고 장소 카드에 마우스를 얹으면(hover), X 삭제 버튼이 2개 중복되어 시각적으로 지저분하게 보이는 현상 발생.

### 2. 원인 분석
- `SortableBlockItem.tsx` 내부에서 데스크톱 hover 전용 ✕ 버튼(절대 좌표 `absolute top-2 right-2`)과 모바일 항시 노출 전용 ✕ 버튼(`md:hidden`)이 2개 별도로 정의되어 있어, 반응형 분기점 및 hover 상태가 겹칠 때 두 버튼이 동시에 화면에 나타남.

### 3. 해결 대책
- 두 개의 중복 ✕ 버튼을 단일 반응형 버튼(`opacity-80 md:opacity-0 group-hover/card:opacity-100`)으로 통합하여 모든 화면 크기(데스크톱 hover, 모바일 터치)에서 깔끔하게 단 1개의 ✕ 삭제 버튼만 노출되도록 개선.
