# CLAUDE.md — 작업 규칙

## 브랜치 규칙

| 브랜치 | 용도 | 규칙 |
|---|---|---|
| `master` | 기존 서비스(Socket.io 서버 + React 클라이언트) | **수정·병합 금지** |
| `remake/web-ui` | 웹 UI/UX 프로토타입 (이 폴더의 `web/`, `docs/remake/`) | 이 브랜치에만 커밋·푸시. PR 만들지 않음 |
| `remake/unity2d-ui` | Unity 2D 프로토타입 (별도 작업) | 웹 작업에서 건드리지 않음 |

- `client/`, `server/` 는 **참고용 원본**. 읽기만 하고 수정하지 않는다.
- 게임 규칙·봇 로직은 `server/game.js`, `server/bot.js`, `server/index.js` 가 정답. 바꾸지 않는다(`docs/remake/rules.md`).
- 문서는 한국어, 표 위주.

## 폴더 구조

```
.
├── client/                 # (원본, 수정 금지) 기존 React 클라이언트
├── server/                 # (원본, 수정 금지) 기존 Node 서버: game.js 규칙, bot.js 봇, index.js 흐름
├── web/                    # 웹 프로토타입 (React + TS + Vite)
│   ├── src/
│   │   ├── engine/         # 규칙(rules.ts), 봇 원본 이식본(legacyBot.js), RNG
│   │   ├── net/            # 계약(protocol.ts), Colyseus 흉내(colyseusLike.ts), 목 서버 방(NoThanksRoom.ts)
│   │   ├── app/            # 세션 컨트롤러(낙관적 반응·롤백), Zustand 스토어, 설정·테마
│   │   ├── anim/           # 단일 애니메이션 큐, 모션 토큰
│   │   ├── table/          # PixiJS 테이블 장면(TableView.ts)과 그리기 노드
│   │   ├── fx/             # 효과음(Howler + jsfxr), 햅틱
│   │   ├── ui/             # DOM HUD·로비·결과·설정, 스타일
│   │   └── __tests__/      # Vitest 단위 테스트 (규칙·점수·봇·목 서버)
│   └── scripts/            # Playwright 스크린샷·성능 측정
└── docs/remake/            # 기획·명세 문서 (한국어)
    ├── rules.md            # master 규칙·봇 추출표 (코드 위치 포함)
    ├── game-interface.md   # 클라↔서버 계약 (Colyseus 교체용)
    ├── art-direction.md    # 콘셉트·팔레트·타이포·카드/칩 원칙·AI 프롬프트
    ├── ux-spec.md          # 화면별 배치도·브레이크포인트
    ├── motion-feedback.md  # 타이밍·이징·SFX·햅틱
    ├── acceptance.md       # 체크리스트 + 웹 vs Unity 비교표
    ├── measure-web.json    # 측정 원자료
    └── screens/web/        # 4개 해상도 × (로비/게임/점수) 스크린샷
```

## 자주 쓰는 명령 (web/)

| 명령 | 설명 |
|---|---|
| `npm install` | 의존성 설치 |
| `npm run dev` | 개발 서버 (`--host`: 같은 와이파이 기기에서 접속 가능) |
| `npm test` | 단위 테스트 |
| `npm run typecheck` | 타입 검사 |
| `npm run build` / `npm run preview` | 프로덕션 빌드 / 미리보기(4173) |
| `npm run shots` | 스크린샷 (`BASE_URL` 지정, 서버 먼저 실행) |
| `npm run measure` | 성능 측정 (`npm run preview` 실행 후) |
