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

---

## 이슈 15: 사용자 식별(UserName) 기반 DB 일정 격리 및 공유 일정 버전 분리

### 1. 지적 및 문제점
- **지적 내용**:
  1. 저장된 일정을 무분별하게 불러올 수 있어 다른 사람이 작성한 일정을 무단으로 조회하는 보안/개인정보 문제.
  2. 공유받은 일정을 수정할 때 원작자의 일정이 덮어씌워져 버전 구분이 불가능한 문제.

### 2. 원인 분석
- DB 및 LocalStorage에서 작성자 식별자 없이 모든 일정이 단일 목록으로 조회되었음.
- 공유 링크로 진입하여 수정 후 저장 시 동일한 `planId`로 upsert가 수행되었음.

### 3. 해결 대책
- `UserNameModal`을 신설하여 초기 접속 시 작성자 이름(닉네임) 입력 및 변경 기능 구축.
- `listSavedPlansFromDB(userName)`으로 현재 접속한 작성자의 저장 일정만 격리 조회.
- 타인 작성 일정을 편집 및 저장 시 `순천만 힐링 여행 (김철수 편집본)` 형태로 신규 고유 `planId`를 할당하여 버전 분리 저장.

---

## 이슈 16: Vercel 배포 환경과 Localhost 간 자동차 경로 안내(`directions`) 차이 및 Vercel 환경 변수 바인딩 누락 문제

### 1. 지적 및 문제점
- **지적 내용**:
  1. 로컬 환경(`localhost`)에서는 정상 작동하던 자동차 실제 이동 경로(Driving Polyline & 소요시간) 안내가 Vercel 배포 환경에서는 적용되지 않고 직선으로 렌더링되는 문제 발생.

### 2. 원인 분석
- `src/app/api/directions/route.ts` 등 서버사이드 API 라우트에서 환경 변수 조회 시 `process.env.NAVER_MAP_CLIENT_ID` 단일 키 이름만 참조하고 있었음.
- Vercel 대시보드 환경 변수에 클라이언트 키 명칭인 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` 및 `NEXT_PUBLIC_NAVER_MAP_CLIENT_SECRET`로 설정되어 있었을 경우, 서버 라우트에서 `ncpKeyId`가 `undefined`로 평가되어 직선 거리 Fallback 연산으로 이탈함.

### 3. 해결 대책
- `src/app/api/directions/route.ts` 및 `src/app/api/search/route.ts` 등 모든 API 라우트에서 `process.env.NAVER_MAP_CLIENT_ID || process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` 및 `NAVER_SEARCH_CLIENT_ID` 듀얼 룩업 구조로 변경하여 Vercel 및 로컬 환경 변수 설정 형태와 무관하게 100% 정상 발급/인증되도록 보완.

---

## 이슈 17: 좌측 일차 장소 블록 클릭 시 지도가 잘못된 좌표(Null Island 등)로 이동하는 문제

### 1. 지적 및 문제점
- **지적 내용**:
  1. 일정 사이드바의 장소 블록 클릭 시 지도가 선택한 장소의 위치로 이동하지 않고 비정상적인 위치로 지도가 이동하는 현상 발생.

### 2. 원인 분석
- 좌표 파싱 과정 중 비정상 또는 유효 범위를 벗어난 값이 포함된 상태에서 NaverMap의 `selectedPlace` `panTo` 카메라 이동 효과가 유효성 검사 없이 실행되었음.

### 3. 해결 대책
- `NaverMap.tsx` 내 `selectedPlace` 카메라 이동(`panTo`) 실행 전 대한민국 위경도 유효 범위(`lat: 33 ~ 39`, `lng: 124 ~ 132`) 및 `Number.isFinite()` 검증 로직을 엄격하게 적용하여 0 또는 비정상 좌표로 지도가 튀는 버그를 원천 차단.

---

## 이슈 18: Vercel 경로 API 엄격 검증, 지도 카메라 우선순위, 보안 삭제 토큰 및 공유 일정 복사 저장 종합 개편

### 1. 지적 및 문제점
- **지적 내용**:
  1. Directions API 호출 실패 시 Haversine 직선 경로로 자동 대체되어 실제 서버 오류가 은폐되는 현상.
  2. 지도 카메라가 경로 갱신 시마다 fitBounds를 재실행하여 사용자가 선택한 장소 포커스를 덮어쓰는 문제.
  3. 단순히 작성자 닉네임이나 admin 문구만으로 타인의 일정을 삭제할 수 있는 보안 문제.
  4. 공유받은 일정을 수정 및 저장할 때 복사본 저장 워크플로우 미비 및 URL 미전환 문제.

### 2. 원인 분석
- 서버 API 라우트에서 오류 발생 시 fallback 객체를 그대로 리턴하였음.
- 카메라 fitBounds 제어와 마커/경로 렌더링 effect가 분리되지 않고 묶여 있었음.
- 일정 삭제 시 암호화 검증 없이 단순 authorString을 확인하였음.

### 3. 해결 대책
- **Directions API**: 서버 전용 환경변수(`NAVER_MAP_CLIENT_ID`, `NAVER_MAP_CLIENT_SECRET`)만 엄격 조회, 실패 시 HTTP 502 구조화 JSON 반환 (`ALLOW_ROUTE_FALLBACK=true` 시 회색 점선 표시). `AbortController`로 비동기 취소 적용.
- **카메라 제어**: 우선순위 1(선택 블록 panTo), 2(전체 보기 버튼), 3(일정/날짜 변경 fitBounds 1회) 분리 구축. `selectedBlockId` + `focusRequestId`로 동일 블록 재클릭 포커스 구현. NaverMap 1km 미만 거리 표시 버그(`durationSeconds` ➔ `distanceMeter`) 수정.
- **보안 토큰 시스템**: 일정 저장 시 32자리 `manageToken` 생성, client localStorage에 원문 저장, Supabase에는 `token_hash` (SHA-256) 저장. `/api/plans/[id]` DELETE/PATCH 검증 추가. 모달 삭제 UI(확인창, 로딩 상태, 삭제 후 활성 일정 초기화) 구현.
- **공유 일정 복사 저장**: 공유받은 사용자 저장 시 입력한 제목 그대로 새 복사본 생성 후 `router.replace('/plan/[newId]')`로 상태 전환하여 중복 생성 방지.
