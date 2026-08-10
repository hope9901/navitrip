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

---

### 2. 원인 분석 (Root Cause)
- 백엔드 `/api/search/route.ts`에 키 미설정 또는 오류 발생 시 임의의 추천 장소 객체를 리턴하는 fallback 및 하드코딩 데이터베이스가 잔존해 있었음.
- 네이버 지역 검색 API와 Geocoding API가 병렬로 통합 처리되지 않고 단순 텍스트 검색에 의존했음.

---

### 3. 해결 대책 (Fix)

#### ① mock 데이터 및 하드코딩 완전 제거
- `route.ts` 내의 모든 mock 장소 배열, 샘플 추천 목록, 서울시청 대체 좌표, 지역별 하드코딩 데이터베이스(`REGION_DATABASE`)를 100% 삭제함.
- API 키가 없거나 API 호출 실패 시 가짜 장소를 리턴하지 않고 `NAVER_SEARCH_NOT_CONFIGURED` 또는 `NAVER_SEARCH_API_FAILED` 구체적인 에러 객체를 리턴하도록 전면 수정.

#### ② 장소 검색 & 주소 검색 공식 API 병렬 통합 연산 (`Promise.allSettled`)
- **A. 장소명·업체·관광지 검색**: 네이버 개발자센터 지역 검색 API (`GET https://openapi.naver.com/v1/search/local.json`)
  - 파라미터: `query={원문}`, `display=5`, `start=1`, `sort=random` (`sort=comment` 제거 및 공식 최댓값 `display=5` 적용)
- **B. 주소·지역명 검색**: 네이버 클라우드 Maps Geocoding API (`GET https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode`)
  - 헤더: `x-ncp-apigw-api-key-id`, `x-ncp-apigw-api-key`
  - 응답 `x`, `y`를 `Number(y)` (위도), `Number(x)` (경도)로 정확히 파싱.

#### ③ 중복 제거 및 엄격한 좌표 검증
- 정규화된 도로명 주소, 지번 주소 또는 (위경도 차이 < 0.0001 && 제목 동일) 조건으로 중복 결과 병합.
- 한국 유효 좌표 범주(`lat: 33~39`, `lng: 124~132`)를 벗어난 부적절한 좌표 항목은 서버 로그로 원인 기록 후 결괏값에서 전면 제외 (서울 좌표로 절대 대체하지 않음).

#### ④ 검색 결과 정렬 및 UI 반영 (`PlaceSearchCard.tsx`)
- 정렬 우선순위: Exact Title Match ➔ Title Includes Query ➔ Geocoding Address ➔ Remaining Place Results.
- 결과 카드에 `[장소]` / `[주소]` 구분 배지, 카테고리, 도로명주소, 지번주소, 실제 존재하는 네이버 상세 링크만 노출.
- 카드를 클릭하면 네이버 지도가 해당 위경도로 Pan 및 Zoom 이동하며, `[일정에 추가]` 버튼을 눌렀을 때만 여행 일정 블록으로 최종 등록됨.
