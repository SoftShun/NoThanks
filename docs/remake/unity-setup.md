# 맥에서 Unity 버전 확인하기

> 대상 브랜치: `remake/unity2d-ui` · 프로젝트 폴더: `unity/` · 고정 버전: **Unity 6000.3.28f1 (Unity 6.3 LTS)**
> 씬·URP 설정 에셋은 저장소에 없다. 아래 4단계의 메뉴가 만들어 준다 (손으로 쓴 YAML 없음).

## 0. 준비물

| 항목 | 내용 |
|---|---|
| macOS | Apple Silicon 또는 Intel, 디스크 여유 15GB 이상 |
| Git LFS | `brew install git-lfs && git lfs install` (한글 폰트가 LFS 로 저장됨) |
| Python 3 | macOS 기본 `python3` (로컬 서버용) |
| (선택) .NET SDK 8 | `brew install dotnet@8` — 규칙/봇 단위 테스트를 직접 돌릴 때 |

## 1. 저장소 받기

| 순서 | 명령 / 동작 | 확인 |
|---|---|---|
| 1 | `git clone https://github.com/SoftShun/NoThanks.git && cd NoThanks` | |
| 2 | `git checkout remake/unity2d-ui` | |
| 3 | `git lfs pull` | `ls -la unity/Assets/Resources/Fonts/*.ttf` 가 1MB 이상 (100바이트대면 LFS 포인터만 받은 것) |
| 4 | (선택) `cd unity/dotnet/NoThanks.Core.Tests && dotnet test` | `Passed! - Failed: 0, Passed: 51` |

## 2. Unity Hub · 에디터 설치

| 순서 | 동작 | 비고 |
|---|---|---|
| 1 | https://unity.com/download 에서 **Unity Hub** 설치 후 로그인 (Personal 라이선스) | |
| 2 | Hub ▸ Installs ▸ Install Editor ▸ **6000.3.28f1** 선택 (목록에 없으면 Archive 탭 → "Download archive" 에서 6000.3.28f1 의 *Install with Unity Hub*) | 더 최신 6.3 LTS 패치(6000.3.x)도 동작해야 정상. 그 경우 열 때 버전 변경 확인창에서 Continue |
| 3 | 모듈 선택에서 **Web Build Support** 체크 | 빠뜨렸으면 Installs ▸ 톱니 ▸ Add modules |

## 3. 프로젝트 열기

| 순서 | 동작 | 확인 |
|---|---|---|
| 1 | Hub ▸ Projects ▸ Add ▸ Add project from disk ▸ 저장소의 **`unity` 폴더** 선택 | |
| 2 | 열기 (첫 임포트 3~10분: 패키지 다운로드 — URP, Input System, LitMotion(github), Burst 등) | 하단 진행바가 끝날 때까지 대기 |
| 3 | "Input System 패키지가 새 입력 백엔드를 켜려 합니다 / 재시작" 창이 뜨면 **Yes** | 코드가 신·구 입력 모두 지원하므로 어느 쪽이든 동작 |
| 4 | Console 창(⌘⇧C)에 **빨간 컴파일 오류가 없는지** 확인 | 오류가 있으면 §8 참고 |

## 4. 씬 생성 메뉴 실행

| 순서 | 메뉴 | 하는 일 |
|---|---|---|
| 1 | **Tools ▸ NoThanks Proto ▸ 0. 전체 실행 (설정 → 씬 생성)** | 아래 1·2를 연속 실행 |
| (1) | Tools ▸ NoThanks Proto ▸ 1. 프로젝트 설정 | `Assets/NoThanksProto/Generated/` 에 URP 2D 렌더러·URP 에셋 생성 후 Graphics/Quality 에 지정, HDR, Linear, Web(Brotli + 압축 해제 대체), WebGL 템플릿 `NoThanksProto` 지정 |
| (2) | Tools ▸ NoThanks Proto ▸ 2. 씬 생성 | `Assets/NoThanksProto/Scenes/Main.unity` 생성: 카메라(포스트프로세싱), 2D 라이트 3개, Global Volume(Bloom 등), TableFx, App(UIDocument + 테마) → Build Settings 등록 |
| 2 | Console 에 `[NoThanksProto] 씬 생성 완료` 확인 | "Active Input Handling → Both" 로그가 보이면 에디터 재시작 |

## 5. 에디터에서 플레이

| 순서 | 동작 | 확인 포인트 |
|---|---|---|
| 1 | Project 창에서 `Assets/NoThanksProto/Scenes/Main.unity` 열기 | |
| 2 | Game 뷰 해상도 드롭다운 ▸ **+** 로 4개 추가: `390×844`, `844×390`, `1440×900`, `1920×1080` (Fixed Resolution) | 에디터는 배율 1 → 이 숫자가 그대로 논리 px |
| 3 | ▶ Play | 로비 표시, 테이블 조명·먼지 보임 |
| 4 | **게임 시작** (또는 Enter) | 3봇과 대전 시작 |
| 5 | 플레이 중 해상도를 바꿔 보기 | 세로/가로/데스크톱 레이아웃이 **서로 다른 배치**로 즉시 전환 |
| 6 | `F3` | 성능 표시: fps, 1% low, 입력→반응 ms, 큐, 롤백/보정 |
| 7 | `1` `2` `3` | 지연 0/100/300ms 전환 → 300 에서도 버튼·카드 이동이 즉시 반응하는지 |
| 8 | 로비 ▸ 거절 시뮬레이션 "20% 거절" | 가끔 카드/칩이 되돌아가는 롤백 연출 |
| 9 | 로비 ▸ 모션 "줄이기" | 이동 대신 짧은 페이드 |

## 6. Web 빌드

| 순서 | 동작 | 결과 |
|---|---|---|
| 1 | **Tools ▸ NoThanks Proto ▸ 3. Web 빌드** (처음엔 Web 플랫폼 전환에 몇 분) | `unity/WebBuild/` 생성, Finder 가 열림 |
| 2 | `unity/WebBuild/build-report.txt` 확인 | 결과, 빌드 시간, **Build/ 폴더 크기 = 다운로드 용량** (acceptance.md 비교표에 기입) |
| (대안) | 터미널 배치 빌드: `/Applications/Unity/Hub/Editor/6000.3.28f1/Unity.app/Contents/MacOS/Unity -batchmode -quit -projectPath unity -executeMethod NoThanks.ProtoEditor.ProtoSetup.CommandLineAll -logFile -` | 설정·씬·빌드 한 번에 |

## 7. 로컬 서버로 열기 · 휴대폰에서 접속

| 순서 | 동작 | 비고 |
|---|---|---|
| 1 | `cd unity/WebBuild && python3 -m http.server 8080 --bind 0.0.0.0` | Brotli 파일을 헤더 없이 보내도 *decompressionFallback* 덕분에 열림 |
| 2 | 맥 브라우저에서 `http://localhost:8080` | 로딩 바 → 로비. 콘솔에 `[NoThanksProto] load ms: …` (첫 로딩 시간) |
| 3 | 맥 IP 확인: `ipconfig getifaddr en0` (예: 192.168.0.12) | 유선이면 `en1` 등 |
| 4 | 휴대폰을 **같은 와이파이**에 연결 → 브라우저에서 `http://192.168.0.12:8080` | 처음 접속 시 macOS 방화벽 "python3 수신 연결 허용" → 허용 |
| 5 | 휴대폰 세로/가로 회전 | 세로 390×844 / 가로 844×390 레이아웃 전환, 노치 영역(safe area) 회피 |
| 6 | 지연 배지(우상단) 탭 → 성능 표시 | 휴대폰 fps · 입력 반응 기록 |
| 주의 | 사운드는 첫 터치 후부터 재생 (브라우저 자동재생 정책). 진동은 Android Chrome 만, iOS Safari 는 미지원 | |
| 주의 | 웹 버전과 나란히 비교할 때는 두 서버 포트를 다르게 (예: 웹 5173, Unity 8080) | |

## 8. 문제 해결

| 증상 | 원인 / 조치 |
|---|---|
| 패키지 오류 `com.annulusgames.lit-motion` | GitHub 접속 필요. `git` 이 설치되어 있어야 UPM git 패키지가 받아짐 (`xcode-select --install`) |
| `com.unity.inputsystem 1.14.0` 해석 실패 | Package Manager 에서 Input System 을 에디터 권장 버전으로 업데이트 |
| 폰트가 □ 로 보임 | `git lfs pull` 을 안 한 것 (폰트 파일이 포인터 텍스트) |
| URP 관련 분홍색 화면 | 메뉴 1(프로젝트 설정) 미실행. 실패 시 수동: Assets ▸ Create ▸ Rendering ▸ *URP Asset (with 2D Renderer)* → Project Settings ▸ Graphics / Quality 에 지정 |
| "No Theme Style Sheet" 경고 | `Assets/NoThanksProto/UI/NoThanksTheme.tss` 가 PanelSettings 에 지정 안 됨 → 메뉴 2 재실행 |
| Web 빌드 후 흰 화면 | 템플릿 문제 시 Player Settings ▸ Web ▸ Resolution and Presentation ▸ WebGL Template 를 Default 로 바꿔 재빌드 (safe area·로딩 시간 측정은 빠짐) |
| 컴파일 오류 | `cd unity/dotnet/UnityCompileCheck && dotnet build` 로 런타임 코드 재검사 가능 (2021.3 참조 기준). 에디터 전용 오류면 오류 메시지를 그대로 공유 |
