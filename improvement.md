# Improvement Log (문제점 및 개선 사항 기록)

## 이슈 01: Naver Directions 5 API 경유지(Waypoints) 5개 제한 문제
- **해결**: 1대1 구간별(Segment-by-Segment) 분할 연산으로 5개 제한 무력화.

## 이슈 02: 블록 이동 시 잦은 API 호출 문제
- **해결**: 400ms 디바운스 및 인메모리 캐싱(`routeSegmentCache`) 적용.

---

## 이슈 03: SSR & `@dnd-kit` Hydration Error (aria-describedby Mismatch) (★ 신규 개선)

### 1. 지적 및 문제점
- **지적 내용**: Next.js App Router (SSR) 환경에서 `@dnd-kit`을 사용할 때, 서버에서 사전 렌더링된 HTML의 `aria-describedby` 속성 ID(`DndDescribedBy-1`)와 클라이언트 자바스크립트 마운트 시 생성된 ID(`DndDescribedBy-2`)가 불일치하여 React Hydration Error가 발생함.

---

### 2. 원인 분석 및 해결 방안 (Fix)

#### ① `DndContext` 고유 ID 고정 (`id="itinerary-dnd-context"`)
- `@dnd-kit`의 `DndContext`에 고유 string ID를 직접 부여하여 서버와 클라이언트가 동일한 접근성 ID 키를 생성하도록 강제.

#### ② `isMounted` Client-only Hydration Guard 패턴 적용
- `useEffect`로 클라이언트 마운트 여부(`isMounted`)를 체크하여, 서버-클라이언트 불일치를 근본적으로 100% 방지.

---

### 3. 방지 대책 및 적용 수칙
- `@dnd-kit`과 같이 클라이언트 측 동적 접근성 DOM ID를 자동 생성하는 라이브러리를 Next.js App Router에서 사용할 때는 항상 **`id` 명시** 및 **Client Mount Guard**를 기본 규칙으로 준수함.
