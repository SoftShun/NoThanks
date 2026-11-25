# {새 이름} — 웹 UI/UX 프로토타입

규칙·봇은 master(`server/`) 그대로, 서버는 Colyseus 를 흉내 낸 **브라우저 안 목 서버**로 동작합니다(백엔드 없음).
문서는 `../docs/remake/` 참고.

## 맥에서 실행

```bash
# Node 20 이상 (권장 22). 없으면: brew install node
cd web
npm install
npm run dev            # http://localhost:5173
```

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (같은 와이파이 기기에서 접속 가능하도록 `--host`) |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run build` → `npm run preview` | 프로덕션 빌드 → http://localhost:4173 |
| `npx playwright install chromium` | (스크린샷·측정을 처음 돌릴 때 한 번) |
| `BASE_URL=http://localhost:4173 npm run shots` | 4개 해상도 스크린샷 → `docs/remake/screens/web/` |
| `BASE_URL=http://localhost:4173 npm run measure` | 빌드 용량·로딩·FPS·입력 반응 측정 → `docs/remake/measure-web.json` |
| `BASE_URL=http://localhost:4173 npm run verify` | 300ms 지연 일관성·롤백·모션 줄이기 검증 |

## 휴대폰에서 접속 (같은 와이파이)

1. 맥과 휴대폰을 **같은 와이파이**에 연결
2. `npm run dev` 실행 → 터미널의 `Network: http://192.168.x.x:5173/` 주소 확인
   (또는 `ipconfig getifaddr en0` 로 맥 IP 확인)
3. 휴대폰 브라우저에서 그 주소 열기
4. 맥 방화벽이 막으면: 시스템 설정 → 네트워크 → 방화벽 → node 수신 연결 허용
5. 프로덕션 빌드로 보려면 `npm run build && npm run preview` 후 `http://<맥IP>:4173`

> 홈 화면에 추가하면 주소창 없이 전체 화면으로 볼 수 있습니다(safe area 확인용).
> 햅틱은 안드로이드 크롬만 지원(iOS 사파리는 Vibration API 미지원).

## 프로토타입 조작

- 로비: 봇 추가/제거(중·상·최상), 게임 설정(master 와 같은 범위), **목 서버 지연 0/100/300ms**, 봇 생각 속도
- 게임: `칩 걸기`/`가져가기` (데스크톱 `Space`/`Enter`), 설정(`Esc`): 모션·효과음·햅틱·성능 표시
- URL `?nick=이름` 으로 닉네임 지정
