# Improvement Log (문제점 및 개선 사항 기록)

## 이슈 01: Naver Directions 5 API 경유지(Waypoints) 5개 제한 문제
- **해결**: 1대1 구간별(Segment-by-Segment) 분할 연산으로 5개 제한 무력화.

## 이슈 02: 블록 이동 시 잦은 API 호출 문제
- **해결**: 400ms 디바운스 및 인메모리 캐싱(`routeSegmentCache`) 적용.

## 이슈 03: SSR & `@dnd-kit` Hydration Error (aria-describedby Mismatch)
- **해결**: `DndContext` 고유 `id` 설정 및 `isMounted` Client Guard 적용.

## 이슈 04: 브라우저 확장 프로그램(Browser Extension)으로 인한 `<html>` 태그 Hydration Error
- **해결**: Root Layout `<html>` 및 `<body>` 태그에 `suppressHydrationWarning` 속성 적용.

---

## 이슈 06: developers.naver.com vs ncloud.com Client ID 혼동 이슈 (★ 원인 규명)

### 1. 지적 및 문제점
- **지적 내용**: 콘솔에 Web 서비스 URL(`http://localhost:3000/`)을 추가했음에도 `Authentication Failed (Error Code 200)`이 계속 발생하며 지도가 렌더링되지 않음.

---

### 2. 원인 분석 (Root Cause)
- **네이버 두 플랫폼 간 API Key 불일치**:
  - `developers.naver.com` (네이버 개발자 센터): 로그인, 블로그, **지역 검색 API** 전용.
  - `ncloud.com` (네이버 클라우드 플랫폼): **Web Dynamic Map v3**, **Directions 5 자동차 길찾기** 전용.
- 네이버 개발자 센터(`developers.naver.com`)에서 발급받은 Client ID는 Maps v3 JavaScript API에서 `Authentication Failed`를 리턴함.

---

### 3. 해결 대책
- 지도/길찾기용 Client ID는 반드시 **[Naver Cloud Platform (ncloud.com)](https://console.ncloud.com/)** 콘솔에서 등록/발급받은 Client ID를 사용해야 함.
