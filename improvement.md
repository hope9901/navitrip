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

## 이슈 05: 네이버 지도 OpenAPI 인증 실패 (인증 오류 팝업 및 지도 사라짐) (★ 신규 개선)

### 1. 지적 및 문제점
- **지적 내용**: 새로고침(F5) 시 지도가 아주 잠깐 보였다가 "네이버 지도 openapi 인증이 실패했습니다" 알림 팝업이 뜨며 지도가 사라지는 현상.

---

### 2. 원인 분석 및 해결 방안 (Troubleshooting)

네이버 클라우드 플랫폼(NCP)의 인증 실패 팝업은 다음 **3가지 원인**으로 발생합니다:

#### 원인 ① Web 서비스 URL 미등록 / 포트 불일치 (가장 흔함)
- **원인**: 네이버 클라우드 콘솔의 `Web 서비스 URL`에 현재 접속 중인 주소(`http://localhost:3000`)가 등록되지 않았거나, 포트가 `3001` 등으로 변경되었을 때.
- **해결**: NCP 콘솔 ➔ Application 수정 ➔ Web 서비스 URL에 `http://localhost:3000`, `http://localhost:3001`, `http://127.0.0.1:3000`을 모두 추가.

#### 원인 ② Web Dynamic Map 서비스 체크 누락
- **원인**: NCP Application 선택 서비스 항목에서 `Web Dynamic Map` 체크박스가 체크 해제되어 있는 경우.
- **해결**: Application 수정 ➔ `Web Dynamic Map` 체크박스 선택 후 저장.

#### 원인 ③ Client ID 오타 또는 환경 변수 미반영
- **원인**: `.env.local`의 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` 값이 잘못되었거나 개발 서버가 오타 있는 상태로 켜졌을 때.
- **해결**: Client ID 재확인 및 개발 서버 재시작.

---

### 3. 프론트엔드 방어 코드 강화
- `NaverMap.tsx`에서 네이버 지도가 인증 에러로 렌더링에 실패했을 때, 지도가 그냥 까맣게 사라지지 않고 원인 및 해결 방법 안내 뱃지가 나타나도록 에러 감지 로직 강화.
