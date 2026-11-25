# 게임 인터페이스 계약 (클라이언트 ↔ 서버)

실제 백엔드 없이, **Colyseus Room 구조를 그대로 흉내 낸 로컬 목 서버**로 동작한다.
나중에 실제 Colyseus 서버로 갈아끼울 때 **이 문서의 계약은 그대로** 두고 전송 계층만 바꾼다.
웹과 Unity 둘 다 이 계약을 따른다.

| 구분 | 웹 구현 파일 |
|---|---|
| 계약 타입 (상태·메시지·이벤트·`applyEvent`) | `web/src/net/protocol.ts` |
| Colyseus 흉내 프레임워크 (Room / Client / 지연 링크) | `web/src/net/colyseusLike.ts` |
| 방 로직 (master `index.js` 흐름 이식) | `web/src/net/NoThanksRoom.ts` |
| 클라이언트 세션 (낙관적 반응·롤백·재동기화) | `web/src/app/session.ts` |

## 1. 방

| 항목 | 값 |
|---|---|
| 방 이름 | `no_thanks` (`client.joinOrCreate('no_thanks', options)`) |
| 입장 옵션 | `{ nickname: string, botSpeed?: number, hiddenRevealDelayMs?: number }` |
| sessionId | 서버가 발급. `PlayerState.id` 와 같음 |
| 상태 동기화 주기 | `patchRate = 50ms` (Colyseus 기본값) |
| 클라이언트별 필터 | 상대 칩 비공개 설정이고 `phase = 'playing'` 이면 본인 외 `tokens = -1` (Colyseus `@filter` 대응) |
| 프로토콜 버전 | `PROTOCOL_VERSION = 1` |

## 2. 상태 (Schema)

`RoomState`

| 필드 | 타입 | 설명 |
|---|---|---|
| `phase` | `'lobby' \| 'playing' \| 'ended'` | 방 단계 |
| `hostId` | string | 방장 sessionId |
| `players` | `PlayerState[]` | **턴 순서대로** (시작 시 섞임) — Colyseus `ArraySchema` |
| `currentCard` | number \| null | 공개 카드. 히든 미공개면 `-1`, 덱 소진/게임 전 `null` |
| `currentCardHidden` | boolean | 히든 미공개 여부 |
| `pileTokens` | number | 카드 위에 쌓인 칩 |
| `currentPlayerId` | string | 현재 차례 |
| `deckSize` | number | 가운데 카드를 **제외한** 덱 장수 (master `deck.length`) |
| `removedCount` | number | 제외된 카드 수 (값은 비공개) |
| `settings` | `GameSettings` | 아래 표 |
| `turnDeadline` | number | 턴 마감 시각(ms, 서버 시계). 0 = 무제한/봇 턴 |
| `lastSeq` | number | 마지막으로 보낸 이벤트 seq |
| `results` | `ScoreRow[]` | `phase = 'ended'` 일 때 최종 순위 |
| `hiddenTotal` / `hiddenRevealed` | number | 히든 모드 진행 |

`PlayerState`: `id, nickname, tokens(-1=비공개), cards: number[], isBot, difficulty('medium'|'hard'|'expert'|''), connected`

`GameSettings`: `removedCount(9), initialTokens(11), showOpponentTokens(false), showRealTimeScore(true), turnTimeLimit(30), gameMode('normal'), hiddenCardCount(3)` — 괄호는 기본값, 범위는 rules.md.

## 3. 클라이언트 → 서버 메시지

모든 메시지는 `actionId`(클라이언트가 만든 고유 문자열)를 가진다. 서버는 **반드시 `ack`** 로 답한다.

| type | payload | 권한 | 거절 사유(`ack.error`) |
|---|---|---|---|
| `pass` | `{ actionId }` | 현재 차례 | `Not your turn`, `Game not started`, `카드 공개 중입니다.` |
| `take` | `{ actionId }` | 현재 차례 | 〃 |
| `start` | `{ actionId }` | 방장 | `Only the host can start the game`, `Game already started` … |
| `updateSettings` | `{ actionId, settings: Partial<GameSettings> }` | 방장, 로비 | 범위는 서버가 잘라냄 |
| `addBot` | `{ actionId, difficulty }` | 방장, 로비 | `봇을 추가할 수 없습니다. (최대 3개, 총 인원 7명 제한)` |
| `removeBot` | `{ actionId, botId }` | 방장, 로비 | |
| `setNickname` | `{ actionId, nickname }` | 본인, 로비 | 20자 초과·중복 |
| `returnToLobby` | `{ actionId }` | 누구나, 종료 후 | |
| `resync` | `{ actionId }` | 누구나 | 시퀀스 공백 시 상태 패치 즉시 요청 |

## 4. 서버 → 클라이언트 메시지

| type | payload | 설명 |
|---|---|---|
| `ack` | `{ actionId, ok, error?, seq? }` | 요청 결과. `seq` = 이 요청으로 생긴 첫 이벤트 |
| `event` | `SeqEvent` | 순서 보장 게임 이벤트 (아래) |
| `toast` | `{ message }` | 안내 문구 |

### 이벤트 (`SeqEvent = GameEvent & { seq, t, actionId? }`)

- `seq`: 방 단위 1부터 **빈틈없이 1씩 증가**. 클라는 `seq ≠ 기대값` 이면 큐를 비우고 `resync` 후 상태로 스냅.
- `t`: 서버 시각(ms) · `actionId`: 이 이벤트를 만든 클라 요청(낙관적 반응 매칭용, 자동 행동은 없음)

| type | 필드 | 발생 시점 | 클라 연출 |
|---|---|---|---|
| `game_started` | `order[], deckSize, removedCount, startTokens, opponentTokensVisible` | 시작 | 좌석 등장 + 덱 셔플 |
| `card_revealed` | `card(null/-1/값), hidden, deckSize` | 시작 직후, 가져간 직후 | 카드 공개(슬라이드+뒤집기) |
| `chip_placed` | `playerId, pileTokens, nextPlayerId, auto` | 패스 | 칩 걸기(포물선) |
| `hidden_flipped` | `playerId, card` | 히든 카드 가져가기 1단계 | 흔들림+공개+반짝임 |
| `card_taken` | `playerId, card, tokens, forced, auto` | 가져가기(히든이면 1초 뒤) | 카드·칩 이동, 점수 팝업 |
| `turn_changed` | `playerId, deadline` | 모든 행동 처리 후 | 차례 링 이동, 내 차례 알림 |
| `game_ended` | `results: ScoreRow[]` | 마지막 카드를 가져간 직후 | 테이블 어둡게 → 점수 집계 화면 |

### 행동별 이벤트 순서

| 행동 | 이벤트 순서 → 그 다음 `ack` |
|---|---|
| 시작 | `game_started` → `card_revealed` → `turn_changed` |
| 패스 | `chip_placed` → `turn_changed` |
| 가져가기 | `card_taken` → `card_revealed` → `turn_changed` (마지막 카드면 `card_taken` → `game_ended`) |
| 히든 가져가기 | `hidden_flipped` → (1000ms) → `card_taken` → `card_revealed` → `turn_changed` |
| 시간 초과 | 위와 같되 `auto = true`, `actionId` 없음 |

## 5. 클라이언트 처리 규칙 (웹 `session.ts` — Unity 도 동일하게)

| 규칙 | 내용 |
|---|---|
| 표시 상태 | `TableView` = 이벤트를 **순서대로 `applyEvent()`** 한 결과. 상태 패치는 로비·재동기화·검증에만 사용 |
| 단일 애니메이션 큐 | 모든 이벤트 연출은 하나의 큐에서 순서대로. 밀리면 timeScale ↑ (2개 이상 1.4배, 4개 이상 2.2배) |
| 낙관적 반응 | 내 `pass`/`take` 는 누르는 즉시 **예측 이벤트**(`chip_placed`/`card_taken`)를 큐 맨 앞에서 실행 → 같은 프레임에 반응 |
| 예측 확인 | 같은 `actionId` + 같은 type 이벤트가 오면 다시 연출하지 않고 `lastSeq` 만 갱신 |
| 보류 | 예측이 확인되기 전 도착한 다른 이벤트(예: 시간 초과 자동 패스)는 `ack` 까지 보류 |
| 롤백 | `ack.ok = false` → 예측 직전 상태로 되돌리는 연출 + 토스트 + 진동, 보류 이벤트 재생 |
| 히든 카드 | 결과를 모르므로 예측하지 않음. 카드 들썩임·효과음만 즉시 |
| 검증·스냅 | 큐가 비고 `room.lastSeq == view.lastSeq` 일 때 `viewHash()` 비교, 다르면 서버 상태로 스냅 |

## 6. 지연 시뮬레이션

| 옵션 | 의미 | 구현 |
|---|---|---|
| 0ms | 지연 없음(마이크로태스크로 비동기만 유지) | `LatencyLink` |
| 100ms | **왕복** 100ms (편도 50ms ±15% 지터) | 〃 |
| 300ms | **왕복** 300ms (편도 150ms ±15% 지터) | 〃 |

- 방향별 FIFO 보장(지터가 있어도 순서 뒤바뀜 없음). 모든 페이로드는 JSON 직렬화로 복사(참조 공유 없음).
- 로비/설정 시트에서 바꾸면 즉시 적용.

## 7. 실제 Colyseus 로 교체하는 방법

| 바꿀 것 | 방법 |
|---|---|
| 서버 | `NoThanksRoom` 을 `@colyseus/core` 의 `Room<RoomStateSchema>` 로 옮김. `onMessage`/`broadcast`/`clock` API 이름이 같음. `RoomState` 는 `@colyseus/schema` 클래스로 정의(`players` = `ArraySchema<PlayerSchema>`), 칩 비공개는 `@filter` 사용 |
| 클라 | `MockClient` → `new Client(url)` (colyseus.js). `RoomConnection` 의 `send/onMessage/onStateChange/onLeave/leave/sessionId/state` 가 colyseus.js `Room` 과 같은 이름 |
| 규칙·봇 | `engine/rules.ts`, `engine/legacyBot.js` 를 서버로 그대로 이동(브라우저 의존성 없음) |
| 변경 불필요 | `protocol.ts` 의 이벤트/메시지 타입, `applyEvent`, 클라 큐·낙관적 반응 로직 |
