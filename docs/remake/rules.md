# 규칙 추출 (master → 리메이크)

> 출처: `master` 브랜치 `server/game.js`, `server/index.js`, `server/bot.js` (커밋 `3ce707c`).
> 원본 파일은 수정하지 않고 읽기만 했다. C# 이식본은 `unity/Assets/NoThanksProto/Core/` 에 있다.
> **규칙은 바꾸지 않았다.** 원본에서 처리되지 않던 경합/예외 경로를 보완한 부분은 §6 에 따로 적었다.

## 1. 게임 규칙

| 항목 | master 값 / 동작 | master 코드 위치 | C# 위치 |
|---|---|---|---|
| 카드 범위 | 3 ~ 35 (33장) | `game.js:150` `for (let i = 3; i <= 35; i++)` | `Core/Rules/GameRules.cs` `MinCard`, `MaxCard` |
| 제거 카드 수 | 기본 **9장**, 설정 범위 1~32 | `game.js:49`, `game.js:326` | `GameSettings.RemovedCount`, `GameSettings.Clamp()` |
| 제거 방식 | 남은 카드에서 무작위로 1장씩 뽑아 제거 (비공개) | `game.js:153~160` | `GameEngine.Start()` |
| 덱 셔플 | Fisher–Yates | `game.js:163~167` | `GameEngine.Start()` |
| 시작 칩 | 기본 **11개**, 설정 범위 1~50 | `game.js:50`, `game.js:329`, `game.js:181` | `GameSettings.InitialTokens` |
| **인원별 칩 수** | **인원과 무관하게 모두 같은 개수(기본 11)**. master 에 인원별 표가 없다 | `game.js:180~183` (모든 플레이어에 `initialTokens` 대입) | `GameEngine.Start()` |
| 인원 | 최대 7명 (사람 + 봇), 봇 최대 3 | `game.js:72`, `game.js:401`, `game.js:405` | `GameRules.MaxPlayers`, `MaxBots` |
| 최소 인원 | 사람 1명 이상이면 시작 가능 (인원 하한 없음) | `index.js:353` `hasHumanPlayers()` | `MockRoomServer.HandleStart()` |
| 턴 순서 | 매 게임 시작 시 플레이어 순서를 무작위로 섞고 0번부터 | `game.js:177`, `game.js:445`, `game.js:186` | `GameEngine.ShufflePlayerOrder()` |
| 첫 카드 | 시작 시 덱 맨 위 1장 공개, 카드 위 칩 0 | `game.js:189~190` | `GameEngine.Start()` |
| 패스 | 칩 1개를 카드 위에 놓고 **다음 사람**으로 턴 이동 | `game.js:221~226` | `GameEngine.Pass()` |
| 칩 0개 패스 | 강제로 **가져가기**로 처리 | `game.js:228~229` | `GameEngine.Pass()` → `TakeCard()` |
| 가져가기 | 카드 + 카드 위 칩 전부 획득, 새 카드 공개, **같은 사람이 계속** | `game.js:259~276` | `GameEngine.TakeCard()` |
| 종료 조건 | 가져간 뒤 덱이 비어 다음 카드가 없으면 즉시 종료 | `game.js:269~274` | `GameEngine.TakeCard()` |
| 점수 | 카드를 정렬해 **연속 묶음은 가장 낮은 숫자만** 더하고, 보유 칩 수를 뺀다. 낮을수록 좋다 | `game.js:285~298` | `Scoring.Score()` |
| 순위 | 점수 오름차순 **안정 정렬**, 동점이어도 1,2,3… 순번 | `game.js:306~310` | `GameEngine.CalculateScores()` (LINQ `OrderBy` = 안정) |
| 턴 제한 | 기본 30초, 0=무제한, 범위 0~300초. 사람에게만 적용 | `game.js:53`, `game.js:332`, `game.js:479~492` | `MockRoomServer.StartNextTurn()` |
| 시간 초과 | 칩이 있으면 자동 패스, 없으면 자동 가져가기 | `index.js:38~58` | `MockRoomServer.HandleTurnTimeout()` |
| 숨김 모드 | 제거되지 않은 카드 중 1~5장(기본 3)을 숨김으로 지정. 숨김 카드는 뒷면으로 나오고, 가져가기를 누르면 먼저 **공개만** 한 뒤 **1초 후** 실제로 가져감 | `game.js:54~55`, `game.js:456~473`, `game.js:252~257`, `index.js:93~117`, `index.js:415~445` | `GameEngine.SelectHiddenCards()`, `MockRoomServer.BeginHiddenReveal()` |
| 상대 칩 공개 | 기본 비공개 | `game.js:51` | 서버가 상태를 클라이언트별로 필터링(`Chips=-1`) |
| 실시간 점수 | 기본 표시 | `game.js:52` | `SettingsSchema.ShowRealTimeScore` |
| 게임 후 | 봇 제거, 설정 기본값 복귀, 사람만 대기실로 | `game.js:505~550`, `index.js:297` | `GameEngine.SoftReset()` |
| 중도 이탈 | 2명 미만이면 즉시 종료·정산, 사람이 없으면 취소 | `index.js:567~589` | `MockRoomServer.Leave()` |

## 2. 봇 3단계 난이도

| 항목 | 중 (medium) | 상 (hard) | 최상 (expert) | master 위치 | C# 위치 |
|---|---|---|---|---|---|
| 위험 허용도 | 0.5 | 0.7 | 0.8 | `bot.js:47~78` | `BotBrain.InitializeTendency()` |
| 감정 강도 | 0.3 | 0.6 | 0.8 | 〃 | 〃 |
| 학습률 | 0.1 | 0.3 | 0.5 | 〃 | 〃 |
| 무작위성 | 0.15 | 0.25 | 0.35 | 〃 | 〃 |
| 기본 허용 손실 | 6점 | 8점 | 12점 | `bot.js:527~534`, `bot.js:592~593` | `BotBrain.BaseMaxLoss()` |
| 숨김 카드 결정 기준 | 순가치 ≥ +1 | ≥ 0 | ≥ −1 | `bot.js:1750~1795` | `BotBrain.MakeHiddenCardDecision()` |
| 사고 시간 | 0.8초 + 0~2.0초 | 0.9초 + 0~2.8초 | 1.0초 + 0~3.5초 | `index.js:66~78` | `BotBrain.ThinkDelayMs()` |

### 2-1. 의사결정 파이프라인 (모든 난이도 공통, 수치만 다름)

| 단계 | 내용 | master 위치 | C# 위치 |
|---|---|---|---|
| 0 | 칩 0개 → 무조건 가져가기 | `bot.js:139~141` | `MakeBasicDecision()` |
| 1. 전략 판단 | 실제 손실 = 카드 − 연결 보너스(실제 점수 증가량 기반) − 칩. 진행도(초반 <30% / 중반 / 후반 ≥70%)·순위·칩 우위로 전략 선택(견제/꼴찌탈출/칩파밍/빌드업/1등유지 등 16종) 후 허용 손실과 비교 | `bot.js:137~660` | `SelectStrategy()`, `ExecuteStrategy()`, `ExecuteBlockingStrategy()` |
| 1-a. 견제 | 위험도 ≥25 인 상대(1등·점수 앞섬·칩 우위·공격적 패턴)가 원할 카드이고 진행도 >40% 면 견제 전략 | `bot.js:177~199`, `bot.js:1210~1298` | `AnalyzeOpponents()` |
| 1-b. 경쟁 분석 | 내 직접연결+경쟁자 → 강제 가져가기(+8), 상대 직접연결 차단(+5), 2명 이상 경쟁(+3) / 내게 무관하고 상대에 큰 이익(20 이상 카드) → 회피 | `bot.js:1429~1540` | `AnalyzeCardCompetition()` |
| 2. 감정 보정 | 기분·자신감·좌절·승부욕·욕심·복수심에 따라 제한된 확률로 결정을 뒤집음 (견제 결정은 보호) | `bot.js:757~868` | `ApplyEmotionalFactors()` |
| 3. 관계 보정 | 'critical' 위협이 원하는 카드면 가져가기, 복수(경쟁심 >0.5), 동맹 양보 | `bot.js:870~934` | `ConsiderPlayerRelations()` |
| 4. 제한적 무작위 | 실제 손실이 −1~6 사이 애매한 경우에만 `무작위성×0.1` 확률로 반대 행동 (전략적 결정은 보호) | `bot.js:936~977` | `AddFinalRandomness()` |
| 5. 감정 갱신/학습 | 거래 품질에 따라 감정 변화, 최근 결정 15개·상대 관찰 20개 유지 | `bot.js:979~1096` | `UpdateEmotionsAfterDecision()`, `LearnFromSituation()`, `ObservePlayerAction()` |
| 서버 알림 | 카드 가져감/행동 관찰/순위 변동/연속 나쁜 카드 → 감정 반응 | `index.js:160~268`, `index.js:274~283` | `MockRoomServer.NotifyBots*()` |

> 원본은 분기 조건이 근거 문자열(`'견제'`, `'전략적'` 등 포함 여부)에 의존한다. 이식본도 **근거 문자열을 원본과 글자 단위로 동일하게** 유지했다.

## 3. 이식 검증 (실제 실행함)

| 검증 | 방법 | 결과 |
|---|---|---|
| 봇 패리티 | `unity/dotnet/parity/gen-bot-parity.js` 가 master `bot.js` 를 Node 로 실행(난수만 고정 주입)해 600개 상황을 기록 → C# 이 같은 난수열로 재생 | **600/600 일치** (결정, 1단계 근거 문자열, 감정 변화, 난수 소비 횟수) |
| 게임 패리티 | `gen-game-parity.js` 가 master `game.js` 로 200판(2~7인, 일반/숨김, 설정 무작위)을 진행 → C# 재생 | **200/200 일치** (제거 카드, 셔플 순서, 숨김 카드, 매 행동 후 상태, 최종 점수·순위) |
| 규칙 단위 테스트 | xUnit (`dotnet test`) | 51개 전부 통과 (§5 참고) |

## 4. 원본 수치 그대로 둔 특이점

| 특이점 | 설명 | 처리 |
|---|---|---|
| 인원별 칩 표 없음 | 원작 보드게임은 인원별 칩 수가 다르지만 master 는 고정 11개 | master 그대로 (11개, 설정 가능) |
| 동점 순위 | 동점이어도 순위가 1,2,3… 으로 갈림 | 그대로 |
| 숨김 진행도 공식 | `(35 − 덱 수) / 24` 를 진행도로 씀 (제거 수와 무관) | 그대로 |
| 위협 판단 시 카드 정보 | 견제 대상 판단에서 봇 상대의 카드 목록이 전달되지 않아(점수표 객체) 봇 상대는 '원하지 않음'으로 판정 | 그대로 (패리티 테스트로 확인) |
| 동맹 | 신뢰도가 0.5 에서 바뀌지 않아 동맹 양보는 실제로 발동하지 않음 | 그대로 |
| 재접속 방장 | id 교체 후 비교하므로 방장 id 가 갱신되지 않음 | 그대로 (로컬 프로토타입에서 재접속 없음) |

## 5. 원본 미처리 경로 보완 (규칙 결과는 동일)

| 경로 | master 동작 | 리메이크 동작 | 이유 |
|---|---|---|---|
| 숨김 카드에서 칩 0개 패스 / 시간 초과 | 공개만 되고 1초 후 가져가기가 실행되지 않음(같은 사람이 한 번 더 눌러야 함) | take 와 같게 공개 → 1초 후 가져가기 | 같은 결과에 도달하는 경로를 일관되게 |
| 숨김 공개 1초 사이 재입력 | 다시 take 하면 즉시 가져가고, 1초 타이머가 다음 카드까지 가져갈 수 있음 | 공개 대기 중 take/pass 는 거절(`Reveal in progress`) | 이중 처리 경합 방지 |
| 숨김 공개 중 턴 타이머 | 계속 돌아감 | 공개 시작 시 정지, 다음 턴에 재시작 | 위와 같음 |
| 게임 종료 후 결과 | 즉시 소프트 리셋하고 결과 이벤트만 보냄 | 소프트 리셋은 같게, 결과 화면용으로 `Results`/`Phase=ended` 를 상태에 유지 | 결과 화면 UX |
| 난수 | `crypto.randomBytes` | `System.Random` (분포 동일, 테스트는 시드 고정) | WebGL/순수 C# 호환 |

## 6. 실행한 테스트 목록

| 파일 | 내용 |
|---|---|
| `RulesTests.cs` | 기본값, 시작 분배(2~7인), 패스/강제 가져가기/가져가기, 턴 검증, 종료, 점수(연속 묶음), 안정 정렬 순위, 설정 범위, 봇 수 제한·이름 재정렬, 방장 양도, 숨김 공개, 소프트 리셋, 순서 셔플 |
| `BotTests.cs` | 난이도 수치, 사고 시간 범위, 감정 초기 범위, 칩 0 → 가져가기, 명백한 이익 → 가져가기, 고립 고가 카드 → 대부분 패스, 연결 보너스, 숨김 판단, 기록 상한, 봇끼리 끝까지 대전(75판, 칩 보존) |
| `NetTests.cs` | 목 서버로 3봇 상대 전체 판(지연 0/100/300) + Seq 연속성, 300ms 에서 예측 즉시·확정 600ms, 거절 → 롤백, 예측 이벤트 표시, 턴 아님 거절, 상대 칩 비공개, 시간 초과 자동 패스, 숨김 공개 1초, 이벤트 재정렬·구멍 시 resync, 로비 복귀 후 재시작, 스케줄러 FIFO |
| `BotParityTests.cs` / `GameParityTests.cs` | §3 |
