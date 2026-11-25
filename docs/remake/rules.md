# 규칙 추출표 (master 기준)

- 기준 커밋: `master` = `3ce707c` (remake/web-ui·remake/unity2d-ui 분기점과 동일)
- 원칙: **규칙·봇 로직은 바꾸지 않는다.** 웹/Unity 모두 이 표를 정답으로 삼는다.
- 웹 이식 위치: `web/src/engine/rules.ts`(규칙), `web/src/engine/legacyBot.js`(봇 원본 이식본), `web/src/net/NoThanksRoom.ts`(턴 진행·타이머·봇 호출 흐름)

## 1. 게임 규칙

| 항목 | 값 / 동작 | master 위치 | 웹 이식 위치 |
|---|---|---|---|
| 카드 범위 | 3 ~ 35 (33장) | `server/game.js:148-150` | `rules.ts fullDeck()` |
| 제거 카드 수 | 기본 **9장**, 설정 1~32. 남은 카드에서 무작위로 1장씩 뽑아 제거(값 비공개) | `game.js:49, 152-160, 326` | `rules.ts buildDeck()`, `clampSettings()` |
| 덱 셔플 | 제거 후 남은 카드 피셔-예이츠 셔플 | `game.js:163-167` | `rules.ts buildDeck()` |
| 플레이어 수 | 최대 **7명**(사람+봇), 봇은 최대 **3개**. 최소 인원 검사 없음(사람 1명 이상이면 시작) | `game.js:72, 401-405`, `index.js:353` | `types.ts MAX_PLAYERS/MAX_BOTS`, `NoThanksRoom.addBot()/handleStart()` |
| 인원별 칩 수 | **인원과 무관하게 동일**: 기본 **11개**, 설정 1~50. (원작처럼 인원별로 다르지 않음 — master 그대로 유지) | `game.js:50, 179-183, 329` | `rules.ts startGame()` |
| 턴 순서 | 시작 시 플레이어 순서를 무작위로 섞고 0번부터 | `game.js:176-186, 445-450` | `rules.ts startGame()/shuffleInPlace()` |
| 첫 카드 | 덱 맨 위 1장 공개, 쌓인 칩 0 | `game.js:188-190` | `rules.ts startGame()` |
| 패스(칩 걸기) | 칩 1개를 카드 위에 올리고 **다음 사람**에게 | `game.js:214-226` | `rules.ts pass()` |
| 칩 0개일 때 패스 | **강제로 가져가기**로 바뀜 | `game.js:228-229` | `rules.ts pass()` (`forcedTake` 표시만 추가) |
| 가져가기 | 카드 + 쌓인 칩을 모두 가져가고, 새 카드 공개, **같은 사람이 계속** | `game.js:242-276` | `rules.ts takeCard()` |
| 종료 조건 | 가져간 뒤 덱이 비어 다음 카드가 없으면 즉시 종료 | `game.js:269-273` | `rules.ts takeCard()` |
| 점수 | 카드를 오름차순 정렬, **연속 묶음은 가장 낮은 카드만 합산**, 그 합에서 **남은 칩 수를 뺌**. 낮을수록 좋음 | `game.js:284-304` | `rules.ts cardPoints()/playerScore()` |
| 순위 | 점수 오름차순 정렬 후 순번(동점도 정렬 순서대로 다른 순위) | `game.js:305-310` | `rules.ts calculateScores()` |
| 턴 시간 제한 | 기본 **30초**, 설정 0(무제한)~300. UI 선택지: 없음/15/30/60 | `game.js:53, 332`, `client/src/pages/GamePage.tsx:468-471` | `NoThanksRoom.startNextTurn()` |
| 시간 초과 | 칩이 있으면 자동 패스, 없으면 자동 가져가기. **사람만** 해당(봇 턴엔 타이머 없음) | `index.js:38-57`, `game.js:479-492` | `NoThanksRoom.handleTurnTimeout()` |
| 상대 칩 공개 | 기본 **비공개** | `game.js:51` | `NoThanksRoom.filterStateFor()` |
| 실시간 점수 | 기본 **표시** | `game.js:52` | `TableScene.seatData()`, `GameScreen` |
| 히든 모드 | 선택 모드. 남은 덱에서 1~5장(기본 3)을 히든으로 지정. 히든 카드는 숫자를 숨긴 채 진행, **가져가기 시 먼저 공개만** 하고 1초 뒤 실제로 가져감 | `game.js:54-55, 169-174, 251-257, 456-473`, `index.js:93-117, 216-246` | `rules.ts selectHiddenCards()/takeCard()`, `NoThanksRoom.resolveResult()` |
| 중도 이탈 | 사람이 없으면 게임 취소·초기화, 2명 미만이면 즉시 종료 | `index.js:362-393` | `NoThanksRoom.onLeave()` |

## 2. 봇 (3단계 난이도)

봇 로직은 `server/bot.js` 를 **파일째 이식**했다(`web/src/engine/legacyBot.js`). 바뀐 것은 ① 난수 모듈 import 경로, ② `console.log` 제거, ③ ESM export 뿐이다.
`web/src/__tests__/bot.test.ts` 가 **원본 bot.js 를 그대로 로드**해 같은 시드에서 이식본과 결정이 100% 같은지 20판을 비교한다.

| 항목 | 중 (`medium`) | 상 (`hard`) | 최상 (`expert`) | master 위치 |
|---|---|---|---|---|
| 성향 설명 | 일반적·예측 가능 | 감정적·경쟁적 | 예측 불가·전략적 | `bot.js:47-77` |
| riskTolerance | 0.5 | 0.7 | 0.8 | `bot.js:51, 59, 67` |
| emotionalIntensity | 0.3 | 0.6 | 0.8 | 〃 |
| learningRate | 0.1 | 0.3 | 0.5 | 〃 |
| randomness | 0.15 | 0.25 | 0.35 | 〃 |
| 기본 허용 손실 `baseMaxLoss` | 6 | 8 | 12 | `bot.js:531-538, 626` |
| 히든 카드 판단 임계값 | +1 | 0 | −1 | `bot.js:1780-1785` |
| 사고 시간(ms) | 800 + 0~2000 | 900 + 0~2800 | 1000 + 0~3500 | `index.js:65-78` |
| 닉네임 | `AI봇 N (중)` | `AI봇 N (상)` | `AI봇 N (최상)` | `game.js:409-410` |

### 의사결정 파이프라인 (모든 난이도 공통)

| 단계 | 내용 | master 위치 |
|---|---|---|
| 0 | 칩 0개면 무조건 가져가기 / 히든 카드면 기대값 기반 별도 판단 | `bot.js:139-141, 91-94, 1750-1869` |
| 1 기본 전략 | 실제 손실 = 카드값 − 연결 보너스 − 쌓인 칩. 진행도(초반/중반/후반)·순위·칩 우위로 전략 선택 → 견제·빌드업·경쟁 분석·연결 가치로 take/pass | `bot.js:137-160, 165-381, 518-614, 661-755, 1429-1540` |
| 2 감정 | 기분·자신감·좌절·승부욕·욕심·복수심에 따라 제한된 확률로 뒤집기 | `bot.js:757-865` |
| 3 관계 | 중요한 위협 견제, 복수 대상, 동맹 양보 | `bot.js:870-931` |
| 4 무작위 | 실제 손실 −1~6점 구간에서만 `randomness × 0.1` 확률로 반대 행동 | `bot.js:936-974` |
| 5 학습 | 결정 후 감정 갱신, 최근 이벤트 15개 기억 | `bot.js:979-1063` |

### 봇에게 가는 알림 (서버 흐름 — 그대로 유지)

| 알림 | 언제 | master 위치 | 웹 위치 |
|---|---|---|---|
| `observePlayerAction` | 사람·봇의 pass/take 직후 (시간 초과 자동 행동은 알리지 않음) | `index.js:239-245, 390, 451` | `NoThanksRoom.notifyBotsOfPlayerAction()` |
| `someone_took_my_card` | 누군가 카드를 가져갔고, 그 카드를 원했던 봇 | `index.js:152-174` | `notifyBotsOfCardTaken()` |
| `got_overtaken` / `winning_streak` | 상태 브로드캐스트마다 순위 확인 | `index.js:179-214` | `notifyBotsOfRankingChange()` |
| `consecutive_bad_cards` | 최근 3결정이 모두 나쁜 가져가기 | `index.js:250-268` | `checkBotsConsecutiveResults()` |

## 3. 규칙이 아닌 부분에서 원본과 다른 점 (의도적)

| 항목 | master | 프로토타입 | 이유 |
|---|---|---|---|
| 판 종료 후 | 봇 제거 + 설정 기본값 초기화 | 봇·설정 유지, "같은 설정으로 다시" 제공. 시작 시 봇은 **새 인스턴스**로 교체(감정 상태 초기화 = 원본에서 다시 추가한 것과 같음) | 반복 비교 테스트 편의 |
| 히든 카드 공개 대기 1초 | 그 사이 입력 잠금 없음(빠른 중복 입력 시 다음 카드까지 가져가는 버그 가능) | 대기 중 입력 거절(`revealLock`) | 버그 방지. 규칙 변화 없음 |
| 난수 | `crypto.randomBytes` | `crypto.getRandomValues` (테스트에서는 시드 RNG) | 브라우저 실행 |
| 봇 사고 시간 | 고정 | 기본은 원본과 같음. 시연용 배율(×2, ×4) 옵션 추가 | 프로토타입 시연 |
| 첫 입장 | 빈 방 | 봇 2개(중·상) 자동 추가 | 바로 시작해 볼 수 있게 |
