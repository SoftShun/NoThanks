# 수용 기준 체크리스트 (Unity 버전)

> 상태 표기: **✅ 검증함**(이 클라우드 환경에서 실제 실행) · **🟡 구현됨, 미검증**(에디터/기기 필요) · **⬜ 해당 없음/미구현**
> 이 환경에는 Unity 에디터·GPU·브라우저 기기가 없어 화면·빌드·fps 는 측정하지 못했다. 맥에서 `unity-setup.md` 순서로 확인 후 칸을 채운다.

## 1. 공통 기준

| # | 기준 | 상태 | 근거 / 확인 방법 |
|---|---|---|---|
| 1-1 | master 규칙(카드 3~35, 제거 9, 칩 11, 점수, 턴, 종료) 그대로 | ✅ | `rules.md` · master `game.js` 를 Node 로 실행한 200판 패리티 테스트 일치 |
| 1-2 | 봇 3단계 로직 그대로 | ✅ | master `bot.js` 600개 상황 패리티 일치 (결정·근거·감정·난수 소비) |
| 1-3 | 규칙 표 + 코드 위치 문서 | ✅ | `docs/remake/rules.md` |
| 2-1 | 원작 이름·아트 미사용, `{새 이름}` 자리표시자 | ✅ | `Brand.Name`, 모든 그래픽·소리는 코드 생성 |
| 2-2 | 콘셉트 2~3안 제안 + 1안 구현 | ✅ | `art-direction.md` §1 (벨벳 누아르 구현) |
| 2-3 | 팔레트·타이포·카드/칩 원칙·AI 프롬프트 | ✅ | `art-direction.md` |
| 3-1 | 실제 백엔드 없이 Colyseus 형 목 서버 + 봇 | ✅ | `MockRoomServer`, `NetTests` (3봇 전체 판) |
| 3-2 | Schema 상태 + 메시지 타입 + Seq 이벤트 계약 문서 | ✅ | `game-interface.md`, Seq 연속성 테스트 |
| 4-1 | 390×844 / 844×390 / 1440×900 / 1920×1080 각각 별도 레이아웃 | 🟡 | `GameScreen.Build*` 4종, `ux-spec.md`. 화면 확인 필요 |
| 4-2 | 터치 타깃 ≥ 44px, safe area | 🟡 | 코드상 최소 44 (`ux-spec.md` §4). 노치 기기 확인 필요 |
| 4-3 | 데스크톱 hover · 키보드 단축키 | 🟡 | `ActionButton`, `Keys` |
| 5-1 | 입력 100ms 안 반응 (낙관적 반응) | ✅/🟡 | 로직: 예측 콜백이 전송 전 동기 호출됨을 테스트로 확인(300ms 지연에서 예측 0ms, 확정 600ms). 실제 프레임 반응(ms)은 `F3` 로 측정 필요 |
| 5-2 | 서버 거절 시 롤백 | ✅/🟡 | `Server_Reject_Rolls_Back` 테스트 / 연출은 화면 확인 필요 |
| 5-3 | 단일 애니메이션 큐로 순서 보장 | 🟡 | `AnimQueue` (에디터 확인 필요) |
| 5-4 | 60fps 유지 | 🟡 | 측정 필요 (`F3`) |
| 5-5 | 카드 공개·칩 걸기·가져가기·턴 전환·점수 집계·종료 연출 | 🟡 | `motion-feedback.md` §2 |
| 5-6 | prefers-reduced-motion | 🟡 | jslib `matchMedia` + 설정. 브라우저 확인 필요 |
| 5-7 | 햅틱 · 임시 효과음 | 🟡 | 합성 SFX 11종, `navigator.vibrate` (Android) |
| 5-8 | 타이밍·이징 표, SFX 목록 | ✅ | `motion-feedback.md` |
| 6-1 | 지연 0/100/300ms 옵션 | ✅ | `LocalRoom.LatencyMs`, 3가지 지연으로 전체 판 테스트 |
| 6-2 | 300ms 에서도 조작감 | 🟡 | 예측으로 내 행동은 즉시. 체감 확인 필요 |
| 7-1 | 문서 한국어·표 위주 | ✅ | `docs/remake/*.md` 7종 |
| 7-2 | 루트 CLAUDE.md (브랜치 규칙·폴더 구조) | ✅ | `/CLAUDE.md` |

## 2. Unity 전용 기준

| # | 기준 | 상태 | 근거 |
|---|---|---|---|
| U-1 | Unity 6 LTS 프로젝트, 버전 고정 | ✅(파일) / 🟡(열기) | `ProjectSettings/ProjectVersion.txt` = 6000.3.28f1 |
| U-2 | URP 2D, Input System, UI Toolkit, 한글 OFL 폰트 | ✅(파일) / 🟡 | `Packages/manifest.json`, Gowun Dodum/Batang 서브셋 + OFL 전문 |
| U-3 | 트윈 = UPM LitMotion (DOTween 없음) | ✅ | manifest git URL `#v2.0.2`, `Tw` 래퍼 |
| U-4 | 빌드 타깃 Web | 🟡 | 메뉴 3 / `CommandLineAll` |
| U-5 | 게임 로직 = UnityEngine 비의존 순수 C# 어셈블리 | ✅ | `NoThanks.Core.asmdef` (`noEngineReferences: true`), netstandard2.1 로 별도 빌드 성공 |
| U-6 | `dotnet test` 단위 테스트 실제 실행 | ✅ | **51개 통과, 0 실패** (.NET 8.0.134) |
| U-7 | 비율별 레이아웃 전환 + `Screen.safeArea` | 🟡 | `LayoutRules`, `WebBridge.SafeInsets` |
| U-8 | 터치·마우스·키보드 | 🟡 | UI Toolkit 포인터 이벤트 + `Keys` (신·구 입력 시스템 모두) |
| U-9 | 2D 라이트·파티클·Bloom | 🟡 | 씬 생성 메뉴 + `TableFx` |
| U-10 | 씬·프리팹을 YAML 대신 에디터 메뉴로 생성 | ✅(코드) / 🟡(실행) | `Editor/ProtoSetup.cs` |
| U-11 | 컴파일 오류 방지 (보수적 API) | ✅ 부분 | 런타임 코드: UnityEngine 2021.3 참조 + LitMotion/URP/InputSystem 실제 시그니처 스텁으로 **3가지 정의 조합 모두 오류·경고 0**. 에디터 스크립트는 UnityEditor 참조가 없어 수동 검토만 |
| U-12 | Unity .gitignore + Git LFS(이미지·오디오·폰트) | ✅ | `unity/.gitignore`, 루트 `.gitattributes`, 폰트 2개 LFS 업로드 확인 |
| U-13 | 맥 확인 순서 문서 | ✅ | `unity-setup.md` |

## 3. 화면 체크리스트 (맥/휴대폰에서 체크)

| 확인 항목 | 390×844 | 844×390 | 1440×900 | 1920×1080 |
|---|---|---|---|---|
| 로비 배치가 잘리지 않음 | ☐ | ☐ | ☐ | ☐ |
| 상대 3명 + 내 손패 + 버튼이 한 화면에 | ☐ | ☐ | ☐ | ☐ |
| 버튼 ≥ 44px, 엄지 닿는 위치 | ☐ | ☐ | — | — |
| 노치/홈바 영역 침범 없음 | ☐ | ☐ | — | — |
| hover 강조 · 단축키 동작 | — | — | ☐ | ☐ |
| 카드 공개/칩/가져가기/턴/종료/집계 연출 순서 | ☐ | ☐ | ☐ | ☐ |
| 300ms 에서 버튼 반응 즉시 | ☐ | ☐ | ☐ | ☐ |
| 거절 20% 에서 롤백 자연스러움 | ☐ | ☐ | ☐ | ☐ |
| reduced-motion 에서 이동 없음 | ☐ | ☐ | ☐ | ☐ |
| 효과음 · (Android) 진동 | ☐ | ☐ | ☐ | ☐ |

## 4. 웹 vs Unity 비교표

> Unity 칸 중 "측정값"은 맥에서 빌드/실행해 채운다. 이 환경에서 측정한 값만 숫자로 적었다.

| 항목 | 웹 버전 | Unity 버전 | Unity 확인 여부 | 측정 방법 (Unity) |
|---|---|---|---|---|
| 빌드 용량 (다운로드, 압축) | (웹 측 기입) | **미측정** (참고: 포함 폰트 2개 합계 2.5MB, 압축 전) | ❌ 빌드 못 함 | `WebBuild/build-report.txt` 의 "Build/ 폴더" 크기 |
| 첫 로딩 시간 | (웹 측 기입) | **미측정** | ❌ | 템플릿이 브라우저 콘솔에 `[NoThanksProto] load ms` 출력, `F3` 표시에 "로드 ms" |
| fps (평균 / 1% low) | (웹 측 기입) | **미측정** · 목표 60 / ≥50 | ❌ | 게임 중 `F3` |
| 입력 반응 (입력 → 첫 연출 프레임) | (웹 측 기입) | 로직상 0ms 지연(같은 호출에서 예측 연출 시작, 테스트로 확인) · 실제 프레임 기준 **미측정**, 목표 ≤ 1프레임(≈16ms) | ⚠️ 로직만 확인 | `F3` 의 "입력→반응" = 클릭 확정(또는 키 입력) 시각 → 예측 연출이 그려진 프레임 다음 프레임 시작까지 |
| 300ms 지연 시 서버 확정 | (웹 측 기입) | 600ms (왕복, 테스트로 확인) | ✅ 테스트 | `NetTests.Prediction_Is_Immediate_And_Confirmation_After_RoundTrip_At_300ms` |
| 규칙·봇 동일성 | master 원본 | master 와 패리티 100% (봇 600 / 게임 200 케이스) | ✅ 테스트 | `dotnet test` |
| 확인 여부 요약 | | 로직·문서 ✅ / 화면·빌드·성능 ❌(맥에서 확인 필요) | | |
