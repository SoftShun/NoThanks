# CLAUDE.md — 작업 규칙

## 브랜치 규칙 (중요)

| 규칙 | 내용 |
|---|---|
| 작업 브랜치 | **`remake/unity2d-ui` 에만 커밋·푸시** |
| 금지 | `master` 및 다른 브랜치 수정·병합 금지, PR 생성 금지 (사용자가 직접 요청할 때만) |
| 읽기 전용 | `client/`, `server/` 는 기존 웹 버전(master 와 동일). **참고만 하고 수정하지 않는다** |
| 규칙 변경 금지 | 게임 규칙·봇 로직은 master `server/game.js`, `server/bot.js` 와 같아야 한다. 바꾸면 패리티 테스트가 실패해야 정상 |
| 커밋 | 한국어 커밋 메시지, 기능 단위로 나눠서 |

## 폴더 구조

| 경로 | 내용 |
|---|---|
| `client/` | 기존 React 웹 클라이언트 (읽기 전용) |
| `server/` | 기존 Node/Socket.io 서버 — 규칙·봇 원본 (읽기 전용) |
| `docs/remake/` | 리메이크 문서 (한국어, 표 위주): `rules.md`, `art-direction.md`, `game-interface.md`, `ux-spec.md`, `motion-feedback.md`, `acceptance.md`, `unity-setup.md` |
| `unity/` | Unity 6.3 LTS 프로젝트 (버전: `unity/ProjectSettings/ProjectVersion.txt`) |
| `unity/Packages/manifest.json` | URP, Input System, uGUI, LitMotion(UPM git) |
| `unity/Assets/NoThanksProto/Core/` | **순수 C#** 게임 로직 (`NoThanks.Core.asmdef`, UnityEngine 참조 없음): `Rules/`(엔진·점수), `Bots/`(봇), `Net/`(목 서버·스키마·메시지·스케줄러·지연), `Client/`(예측·롤백·Seq) |
| `unity/Assets/NoThanksProto/Runtime/` | Unity 런타임 (UI Toolkit 코드 빌드 UI, 레이아웃 4종, 애니메이션 큐, 연출, 효과음, 햅틱) |
| `unity/Assets/NoThanksProto/Editor/` | `ProtoSetup.cs` — Tools ▸ NoThanks Proto 메뉴 (프로젝트 설정 / 씬 생성 / Web 빌드) |
| `unity/Assets/NoThanksProto/Generated/`, `Scenes/` | 메뉴가 생성 (저장소에 없음) |
| `unity/Assets/Resources/Fonts/` | 한글 OFL 폰트 (Git LFS) + 라이선스 |
| `unity/Assets/Plugins/WebGL/` | 브라우저 연동 jslib (진동, reduced-motion, DPR, safe area) |
| `unity/Assets/WebGLTemplates/NoThanksProto/` | Web 템플릿 (viewport-fit=cover, 로딩 시간 기록) |
| `unity/dotnet/` | Unity 밖 검증: `NoThanks.Core.csproj`, `NoThanks.Core.Tests/`(xUnit), `parity/`(master JS 패리티 생성기), `UnityCompileCheck/`(런타임 컴파일 검사) |

## 자주 쓰는 명령

| 목적 | 명령 |
|---|---|
| 단위 테스트 | `cd unity/dotnet/NoThanks.Core.Tests && dotnet test` |
| 패리티 픽스처 재생성 (master JS 실행) | `node unity/dotnet/parity/gen-bot-parity.js && node unity/dotnet/parity/gen-game-parity.js` |
| 런타임 컴파일 검사 | `cd unity/dotnet/UnityCompileCheck && dotnet build -p:ExtraDefines="ENABLE_INPUT_SYSTEM"` |
| Unity 배치 빌드 | `Unity -batchmode -quit -projectPath unity -executeMethod NoThanks.ProtoEditor.ProtoSetup.CommandLineAll` |

## 이름 규칙

| 항목 | 규칙 |
|---|---|
| 게임 이름 | 미정. 화면에는 `{새 이름}` (`Runtime/Theme.cs` 의 `Brand.Name`) |
| 원작 | 원작 게임명·원작 아트 사용 금지. 코드 네임스페이스/폴더의 `NoThanks` 는 저장소 이름을 따른 내부 식별자 |
