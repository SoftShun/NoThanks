# 게임 인터페이스 계약 (Colyseus Room 모양)

> 프로토타입은 실제 서버 없이 **로컬 목 서버**(`Core/Net/MockRoomServer.cs`)로 돈다.
> 클라이언트는 `IRoom` 인터페이스만 보므로, 나중에 Colyseus 서버 + `colyseus-unity-sdk`(또는 웹 `colyseus.js`)로 바꿀 때
> **아래 표의 상태 필드·메시지·이벤트 이름을 그대로 유지**하면 UI 코드는 수정하지 않아도 된다.

## 1. 구성

| 계층 | 클래스 | Colyseus 대응 | 비고 |
|---|---|---|---|
| 권한 상태 | `GameEngine` | Room 내부 게임 로직 | master `game.js` 1:1 |
| 룸 | `MockRoomServer` | `Room<NoThanksState>` (`onCreate`, `onJoin`, `onMessage`, `onLeave`) | master `index.js` 흐름 |
| 상태 스키마 | `RoomStateSchema` / `PlayerSchema` / `SettingsSchema` / `ResultSchema` | `@colyseus/schema` `Schema` 클래스 | 클라이언트별 필터링 = `StateView` |
| 전송 | `LocalRoom` (`IRoom` 구현, 지연 시뮬레이션) | `colyseus.js` `Room` / Unity SDK `ColyseusRoom<T>` | `Send`, `OnStateChange`, `OnEvent`(=onMessage("event")) |
| 클라이언트 세션 | `GameClient` | (SDK 위의 앱 코드) | Seq 정렬, 낙관적 반응, 롤백, resync |
| 시계 | `Scheduler` (가상 시계) | `this.clock` (Colyseus Clock) | 봇 사고 시간·턴 제한·숨김 공개 1초 |

## 2. 상태 스키마 `RoomStateSchema`

| 필드 | 타입 | 의미 |
|---|---|---|
| `Phase` | string | `"lobby"` / `"playing"` / `"ended"` |
| `HostId` | string | 방장 세션 ID |
| `CurrentPlayerId` | string | 현재 차례 (진행 중일 때만) |
| `CurrentCard` | int | 공개 카드. `0`=없음, **`-1`=숨김 카드(미공개)** |
| `PileChips` | int | 카드 위 칩 |
| `DeckCount` | int | 남은 덱 (공개 카드 제외) |
| `RemovedCount` | int | 제거된 카드 수 (어떤 카드인지는 비공개) |
| `HiddenTotal` / `RevealedCount` | int | 숨김 모드 카드 수 / 공개된 수 |
| `RevealPending` | bool | 숨김 카드 공개 후 1초 대기 중 (입력 불가) |
| `TurnRemainingMs` | number | 상태 생성 시점 기준 남은 턴 시간 (0 = 무제한/봇) |
| `ServerTimeMs` | number | 서버 시계 |
| `Players` | `PlayerSchema[]` | **턴 순서대로** |
| `Settings` | `SettingsSchema` | 아래 표 |
| `Results` | `ResultSchema[]` | `Phase=ended` 일 때 순위표 |
| `Version` | long | 서버가 상태를 바꿀 때마다 +1 |

| `PlayerSchema` 필드 | 타입 | 의미 |
|---|---|---|
| `Id`, `Nickname` | string | |
| `IsBot`, `Difficulty` | bool, string | `"medium"`/`"hard"`/`"expert"` |
| `Chips` | int | 보유 칩. **상대 칩 비공개 설정이면 다른 사람에게는 `-1`** (StateView 필터) |
| `Cards` | int[] | 가져온 카드 (공개 정보) |
| `CardPoints` | int | 연속 묶음 최저값 합 (칩 차감 전) |
| `Seat` | int | 턴 순서 인덱스 |

| `SettingsSchema` 필드 | 기본 | 범위 |
|---|---|---|
| `RemovedCount` | 9 | 1~32 |
| `InitialTokens` | 11 | 1~50 |
| `ShowOpponentTokens` | false | |
| `ShowRealTimeScore` | true | |
| `TurnTimeLimit` (초) | 30 | 0~300 (0=무제한) |
| `GameMode` | `"normal"` | `"normal"` / `"hidden"` |
| `HiddenCardCount` | 3 | 1~5 |

## 3. 클라이언트 → 서버 메시지 (`room.send(type, message)`)

| type | 본문 (`ClientMessage`) | 권한 | 성공 시 | 실패 사유 예 |
|---|---|---|---|---|
| `start` | `ReqId` | 방장 | `game_started` → `card_revealed` → `turn_changed` | `Only the host can start the game`, `Game already started` |
| `take` | `ReqId` | 현재 차례 | `card_taken` (+`card_revealed`, `turn_changed`) 또는 숨김이면 `hidden_revealed` → 1초 후 `card_taken` … | `Not your turn`, `Game not started`, `Reveal in progress` |
| `pass` | `ReqId` | 현재 차례 | `chip_placed` → `turn_changed` (칩 0개면 `card_taken{Forced}`) | 위와 같음 |
| `updateSettings` | `Settings: SettingsPatchDto` (null 필드는 유지) | 방장, 대기 중 | 상태 갱신 | `방장만 설정을 변경할 수 있습니다.` |
| `addBot` | `Difficulty` | 방장 | 상태 갱신 | `봇을 추가할 수 없습니다. (최대 3개, 총 인원 7명 제한)` |
| `removeBot` | `BotId` | 방장 | 상태 갱신 | |
| `backToLobby` | `ReqId` | 누구나, 종료 후 | `Phase=lobby` | |
| `resync` | — | 누구나 | 전체 상태 + `resync` 이벤트 | |

모든 요청은 `action_result { ReqId, Ok, Reason, Action }` 으로 **요청자에게만** 응답한다.

## 4. 서버 → 클라이언트 이벤트 (`room.onMessage("event")`)

모든 이벤트에 `Seq`(클라이언트별 1부터 1씩 증가), `ServerTimeMs`, `StateVersion` 이 붙는다.
`ReqId` 는 **그 행동을 요청한 클라이언트에게만** 채워진다 (낙관적 반응 확인용).

| Type | 주요 필드 | 발생 시점 | 클라이언트 연출 |
|---|---|---|---|
| `action_result` | `ReqId`, `Ok`, `Reason`, `Action` | 모든 요청 직후 (요청자에게만) | 거절이면 롤백 |
| `game_started` | `Order[]`, `DeckCount` | 시작 | 좌석 배치 |
| `card_revealed` | `Card`(-1 숨김), `DeckCount`, `PileChips` | 시작·가져가기 후 | 덱 → 중앙 + 뒤집기 |
| `chip_placed` | `PlayerId`, `PileChips`, `PlayerChips`(비공개면 -1), `Forced` | 패스·시간초과 | 좌석 → 카드 칩 이동 |
| `card_taken` | `PlayerId`, `Card`, `Chips`, `PlayerChips`, `Forced` | 가져가기 | 카드·칩 → 좌석 |
| `hidden_revealed` | `PlayerId`, `Card` | 숨김 카드 가져가기 1단계 | 흔들림 + 뒤집기 |
| `turn_changed` | `PlayerId`, `SamePlayer`, `TurnMs` | 매 턴 | 좌석 링·턴 라벨·타이머 |
| `game_ended` | `Results[]` | 덱 소진/이탈 | 종료 배너 → 결과 화면 |
| `resync` | — | `resync` 요청 응답 | 시퀀스 재기준 + 상태 맞춤 |
| `toast` | `Reason` | 서버 측 비동기 오류 | 토스트 |

### 이벤트 순서 보장
| 규칙 | 구현 |
|---|---|
| 한 행동의 이벤트는 정해진 순서로 연속 발송 | 예: take → `action_result` → `card_taken` → `card_revealed` → `turn_changed` → (상태) |
| 클라이언트는 `Seq` 순서로만 처리 | `GameClient` 가 버퍼링 후 연속된 것만 방출 |
| 구멍(누락)이 1.5초 넘게 안 메워지면 | `resync` 요청 → 서버가 전체 상태 + `resync` 이벤트 |
| 상태와 이벤트 | 이벤트 = 연출의 원천, 상태 = 최종 진실. 애니메이션 큐가 비면 화면을 상태에 맞춘다(reconcile) |

## 5. 낙관적 반응 / 롤백

| 단계 | 내용 |
|---|---|
| 1 | 입력 즉시 `GameClient.RequestTake/Pass()` 가 `PendingAction{ReqId, 예측값}` 을 만들고 **전송보다 먼저** `OnPredicted` 호출 → 같은 프레임에 연출 시작 |
| 2 | 서버의 같은 `ReqId` 이벤트(`card_taken`/`chip_placed`)가 오면 `predicted=true` 로 전달 → 연출은 생략하고 수치만 동기화, `OnConfirmed` |
| 3 | `action_result{Ok=false}` → `OnRolledBack` → 카드/칩을 되돌리는 연출 + 토스트 + 햅틱 |
| 4 | 4초 안에 응답이 없으면 롤백 + `resync` |
| 예측 범위 | 내 행동 결과(카드·칩 이동)만 예측. **다음 카드는 서버만 알기 때문에 예측하지 않음** |

## 6. 지연 시뮬레이션

| 옵션 | 단방향 지연 | 왕복 | 설정 위치 |
|---|---|---|---|
| 0ms | 0 | 0 | 로비 / 게임 메뉴 / 데스크톱 `1` 키 |
| 100ms | 100 | 200ms | `2` 키 |
| 300ms | 300 | **600ms** | `3` 키 |
| 거절 시뮬레이션 | 서버가 take/pass 를 20% 확률로 거절 | | 로비 "거절 시뮬레이션" |
| 봇 사고 시간 | ×1 (master) / ×0.35 | | 로비 "봇 사고 시간" |

`LocalRoom.LatencyMs` 는 보내기·받기 각각에 적용하며 같은 방향 메시지의 순서는 유지한다(WebSocket 과 동일).

## 7. 실제 Colyseus 로 교체하는 방법

| 작업 | 내용 |
|---|---|
| 서버 | `MockRoomServer` 의 핸들러를 `Room.onMessage(type, (client, msg) => …)` 로 옮긴다. 게임 로직은 master `game.js`/`bot.js` 를 그대로 사용 (패리티 테스트로 C# 이식본과 같음을 확인) |
| 상태 | 위 스키마를 `@colyseus/schema` 로 정의. 상대 칩 비공개는 `StateView` 또는 `@view()` 로 필터 |
| 이벤트 | `client.send("event", {...})` 로 보내되 **클라이언트별 `seq` 카운터**를 붙인다 |
| 시계 | `setTimeout` 대신 `this.clock.setTimeout` (봇 사고 시간, 턴 제한, 숨김 1초) |
| 클라이언트 | `IRoom` 을 구현하는 `ColyseusRoomAdapter` 작성: `room.OnStateChange` → `OnStateChange`, `room.OnMessage<ServerEvent>("event")` → `OnEvent`, `Send` → `room.Send(type, msg)` |
| UI | 변경 없음 (`GameClient` 이하 동일) |
