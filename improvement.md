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

---

## 이슈 19: 공유 시점 뷰포트(mapView), 자동차 이동 거리/시간 문구 및 합산 보완, 포커스 흐름 구조화 및 네이버 상세보기 링크 개편

### 1. 지적 및 문제점
- **지적 내용**:
  1. 공유 링크 최초 접속 시 서울 기본 화면이 표시되고 전체 보기/공유 시의 실제 카메라 위치가 반영되지 않는 현상.
  2. 이동 거리/시간 문구가 "총 자동차 이동 거리/시간"으로 표기되고 직선 거리 fallback 구간까지 이동 계산에 합산되는 문제.
  3. 장소 카드/마커 클릭 시 첫 클릭부터 올바른 좌표로 이동하지 않고 엉뚱한 위치로 튀던 버그.
  4. 네이버 장소/주소 검색 결과 패널에서 상세정보 새 탭 연결 링크 누락.

### 2. 원인 분석 (Root Cause)
- `PlaceSearchCard`에서 검색 완료 직후 클릭하지 않은 1번 결과를 자동으로 `onSelectPlace`로 호출하여 카메라 포커스 state를 오염시킴.
- `NaverMap` 내에서 렌더링 시점의 stale state를 읽어 좌표를 이동시킴.
- 공유 저장 시 `NaverMap`의 실제 카메라 center, zoom, bounds를 추출하여 DB에 저장하는 뷰포트 영속성 필드(`mapView`) 부재.

### 3. 해결 대책 (Fix)
- **`mapView` 영속성**: `NaverMap` ref의 `getMapView()`로 공유/저장 시점의 center, zoom, bounds를 `PlanData.mapView`에 보존하고, 공유 페이지 최초 진입 시 **정확히 1회** 보존된 뷰포트를 복원하도록 구현.
- **이동 거리/시간 문구 & 합산**: "예상 자동차 이동 거리/시간"으로 문구 수정 및 `source === 'naver'` 인 실제 운전 구간만 합산 (실패 시 *"자동차 이동 경로를 계산할 수 없습니다."* 안내 및 각주 추가).
- **통합 포커스 흐름 (`MapFocusRequest`)**: 마커/블록/검색결과 클릭 시 인자로 전달받은 number 좌표로 `panTo` (zoom 15) 및 인포윈도우를 직접 활성화하고, 검색 완료 시의 자동 포커스 호출을 원천 차단.
- **네이버 지도 상세보기 링크**: 공통 URL 생성기 `getNaverMapUrl` 신설하여 마커 인포윈도우, 사이드바 일정 블록, 검색 결과 카드 3곳 모두에 **[네이버 지도 상세보기 ↗]** (`target="_blank" rel="noopener noreferrer"`) 제공.

---

## 이슈 21: 전체 보기 및 일정 수준 이상의 지도 축소 시 마커 인포윈도우 자동 닫기

### 1. 지적 및 문제점
- **지적 내용**:
  1. 전체 보기를 누르거나 지도를 일정 축소 레벨 이하로 줌아웃하더라도 이전에 클릭된 마커 인포윈도우(정보창)가 계속 열려 있어 전체 화면을 가리는 문제.

### 2. 원인 분석 (Root Cause)
- `fitAllBounds` 실행 시 및 수동 zoom out 발생 시 active `InfoWindow` 닫기 이벤트 처리가 연결되어 있지 않았음.

### 3. 해결 대책 (Fix)
- `fitAllBounds` 함수 호출 시 `infoWindowRef.current?.close()`를 명시적으로 실행.
- Naver Maps `zoom_changed` 이벤트 리스너를 등록하여 사용자가 축소(zoom 레벨 <= 12)할 시 열려 있는 마커 인포윈도우를 자동으로 닫도록 구현.

---

## 이슈 22: Naver Cloud Driving API 불필요 중복 호출 차단 및 Supabase 영속 캐시·구간별 캐싱·routeSignature·수동 새로고침 구축

### 1. 지적 및 문제점
- **지적 내용**:
  1. Day 변경, 일정 재오픈, 공유 링크 접속, 새로고침, 마커/블록 클릭 등 UI 조작 시 장소가 변경되지 않았음에도 Naver Driving API가 불필요하게 반복 호출되어 쿼터가 낭비되는 문제.

### 2. 원인 분석 (Root Cause)
- 장소 좌표 및 순서에 근거한 결정론적 경로 서명(`routeSignature`) 부재.
- 구간별(Leg-by-Leg) 부분 캐싱 미적용으로 인해 일부 장소 변경 시 전체 경로를 재요청함.
- Vercel 서버리스 인스턴스 메모리 휘발성으로 인해 영속 서버 캐시 DB 부재.
- 저장/공유 일정 데이터 내에 계산 결과 요약(`savedRoute`) 미보존.

### 3. 해결 대책 (Fix)
- **`routeSignature` & 5자리 정규화**: `src/lib/routeSignature.ts` 신설. 소수점 5자리 정규화 좌표, 경유지 순서, 옵션(`trafast`), 버전(`1`)을 조합한 클라이언트/서버 공통 해시 서명 생성.
- **구간별(Leg-by-Leg) 캐싱**: `A → B → C` 경로에서 `D` 추가 시 `A → B` 및 `B → C` 구간 캐시는 재사용하고 신규 `C → D` 구간만 API 호출.
- **Supabase 영속 캐시 (`route_cache` 테이블)**: `supabase/migrations/20260811_route_cache.sql` 마이그레이션 SQL 작성 및 `/api/directions/route.ts` 서버 라우트에서 `SUPABASE_SERVICE_ROLE_KEY` 기반 24시간 TTL 자동 영속 관리.
- **저장/공유 일정 경로 보존 (`savedRoute`)**: `DayItinerary` 내 `savedRoute` 요약을 보존하여 저장/공유 일정 재오픈 시 **외부 API 호출 0회** (`source: "saved"`).
- **800ms 디바운스 & activeDay 전용 계산**: 현재 활성화된 Day만 연산하며, 연속 장소 변경 시 800ms 디바운스 및 `AbortController` 적용.
- **수동 "예상 시간 새로고침" 버튼**: `NaverMap.tsx`에 새로고침 버튼 및 상태 라벨(`저장된 예상 경로`, `최신 예상 경로`, `서버 캐시 예상 경로`, `이전 계산 결과`, `마지막 계산: HH:mm`) 제공. 60초 쿨다운 적용.

---

## 이슈 23: 모바일 Chrome 상단/하단 잘림 수정, Safe Area 적용, iOS 16px 자동확대 차단 및 반응형 터치 UX 종합 개편

### 1. 지적 및 문제점
- **지적 내용**:
  1. 모바일 Chrome 탭 그룹 및 주소창이 노출된 상태에서 100vh 계산 오차로 상단 헤더 또는 하단 액션 버튼이 가려지거나 잘리는 현상.
  2. iPhone/Android 노치 및 Safe Area 뷰포트 처리 미비.
  3. iOS Safari에서 입력창 클릭 시 화면 자동 확대(Zoom-in) 현상.
  4. 데스크톱 레이아웃 훼손 가능성 및 모바일 하단 패널(Bottom Sheet) 가림 영역 처리 미비.

### 2. 원인 분석 (Root Cause)
- `layout.tsx` 내 `viewportFit=cover` 명시 미비.
- 최상위 컨테이너 높이가 `h-screen` (100vh)으로 지정되어 주소창 동적 높이를 계산하지 못함.
- `<input>` 모바일 폰트 크기가 12~14px로 지정되어 iOS Safari 자동 확대 유발.

### 3. 해결 대책 (Fix)
- **`viewportFit=cover` & `100dvh`**: `layout.tsx`에 Next.js `viewport` 설정을 추가하고 최상위 컨테이너 높이를 **`h-[100dvh] min-h-[100svh]`**로 교체.
- **Safe Area Inset**: `globals.css`에 `.safe-pt`, `.safe-pb` 작성하여 모바일 헤더 및 하단 바텀시트에 적용 (데스크톱 0px 유지).
- **데스크톱 레이아웃 100% 보존**: 데스크톱(`md: flex`, `lg: flex`) 사이드바, 지도, 검색창 및 버튼 배치를 1px의 오차 없이 그대로 유지.
- **iOS Safari 자동 확대 차단**: 모든 `<input>` 폰트 크기를 모바일 최소 **16px (`text-base md:text-xs`)**로 설정.
- **모바일 지도 오프셋 이동**: 모바일 Viewport에서 장소 선택 시 마커가 바텀시트에 가려지지 않도록 위도 오프셋(`lat - 0.002`) 중심 연산 적용.
- **터치 영역 & API 0회 재호출**: 버튼 터치 영역 최소 44x44px 확보, 모바일 화면 회전/드래그/뷰포트 변경 시 외부 API 호출 0회 유지.

---

## 이슈 24: 모바일 지도 확대·축소 컨트롤 비활성화 및 모바일 전용 예상 이동 요약 카드(가림 해결) 구축

### 1. 지적 및 문제점
- **지적 내용**:
  1. 모바일 화면에서 지도 우측 상단 +/- 확대·축소 컨트롤이 시야를 가리는 불필요한 문제.
  2. 기존 지도 내부 플로팅 배지가 모바일 바텀시트 패널에 가려져 예상 거리 및 시간이 전혀 보이지 않는 문제.

### 2. 원인 분석 (Root Cause)
- `NaverMap.tsx` 내 `zoomControl` 옵션이 화면 크기와 무관하게 항시 `true`로 설정되어 있었음.
- 요약 배지가 `position: absolute; bottom: 6`으로 띄워져 있어 모바일 바텀시트에 가려짐.

### 3. 해결 대책 (Fix)
- **모바일 `zoomControl: false` 옵션 적용**: `mapInstance.current.setOptions({ zoomControl: !isMobile })`를 적용하여 모바일 스크린(`< 768px`)에서는 우측 상단 +/- 컨트롤을 숨기고, 핀치 줌 및 터치 이동만 활성화. 데스크톱(`>= 768px`)에서는 +/- 컨트롤 100% 유지.
- **모바일 전용 `RouteSummaryCard` 문맥 배치**: 문서 흐름(Document Flow) 상 상단 헤더 바로 아래 / 지도 바로 위 위치에 전용 요약 카드를 배치하여 가림 현상을 원천 해결. 2열 그리드(`grid grid-cols-2`)로 "예상 이동 거리" 및 "예상 이동 시간" 명확히 표기.
- **지도 flex 유연 높이 연산 (`flex-1 min-h-0`)**: 하드코딩 높이 공식 대신 Flexbox `flex-1 min-h-0`을 사용하여 남은 높이를 지도가 100% 채우도록 보완.
