# my-tree-front

React + Vite 기반 프론트엔드 기본 프로젝트입니다.

## 시작하기

```bash
npm install
npm run dev
```

개발 서버는 `0.0.0.0:5173`으로 열리도록 설정되어 있어 같은 네트워크의 다른 장치에서도 접근할 수 있습니다.

## 환경 변수

`.env.example`을 참고해서 API 서버 주소를 맞추면 됩니다.

```env
VITE_API_BASE_URL=http://localhost:8081
```

## 기본 구조

```text
src/
  api/         API 클라이언트
  assets/      정적 리소스
  components/  공통 컴포넌트
  features/    도메인 단위 기능
  hooks/       커스텀 훅
  layouts/     화면 레이아웃
  pages/       라우트 페이지
  routes/      라우터 설정
  styles/      전역 스타일
  utils/       공용 유틸
```
