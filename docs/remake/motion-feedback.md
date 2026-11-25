# 모션 · 피드백 명세

> 트윈 라이브러리: **LitMotion v2.0.2** (UPM git, DOTween 미사용). 모든 트윈은 `Runtime/Motion.cs` 의 `Tw.Run()` 한 곳에서 만들고, 시간 상수는 `MotionSpec` 에 있다.
> 스케줄러는 `MotionScheduler.UpdateIgnoreTimeScale` (타임스케일 영향 없음).

## 1. 원칙

| 원칙 | 구현 |
|---|---|
| 입력 → 100ms 안에 반응 | 누르는 순간(PointerDown) 버튼 눌림 스케일 0.95 + 탭음 + 가벼운 햅틱. 손을 떼면 `GameClient` 가 **전송 전에** 예측 연출을 큐에 넣고, 큐가 비어 있으므로 같은 프레임에 시작 |
| 서버가 거절하면 롤백 | `action_result{Ok=false}` → 되돌리기 연출(카드는 좌석→중앙, 칩은 카드→좌석) + 오류음 + 햅틱 + 적색 토스트 |
| 순서 보장 = 단일 큐 | `AnimQueue`: 서버 이벤트·예측·롤백·결과 집계 모두 한 줄로 재생. 각 단계는 `done()` 을 호출해야 다음으로 넘어감, 3초(종료 5초) 워치독 |
| 적체되면 따라잡기 | 대기 단계 2~3개 → 배속 ×1.4, 4개 이상 → ×2.2 (시간을 나눠서 적용) |
| 60fps | 이동은 절대 위치 요소 1~9개만 트윈, 레이아웃 재계산이 큰 손패 재구성은 도착 순간 1회만 |
| 큐가 비면 맞추기 | 서버 상태와 표시 상태의 서명이 다르면 즉시 상태로 맞춤(보정 횟수는 성능 표시에 노출) |
| reduced-motion | 브라우저 `prefers-reduced-motion`(자동) 또는 로비/메뉴 설정 → 모든 이동을 최대 120ms 선형 페이드로, 흔들림·먼지·불꽃 끔 |

## 2. 타이밍 · 이징 표

| 연출 | 트리거 | 시간 | 이징 | 내용 | 코드 |
|---|---|---|---|---|---|
| 버튼 눌림 | PointerDown / 단축키 | 즉시 (0ms), 복귀 90ms | — | 스케일 0.95, 배경 15% 어둡게 | `ActionButton` |
| 버튼 hover | PointerEnter | 즉시 | — | 스케일 1.03, 2px 위로, 12% 밝게 | `ActionButton.Refresh` |
| 카드 공개 | `card_revealed` | **360ms** | OutCubic | 덱 → 중앙 포물선(높이 18), 0.45→1 확대, 중간(50%)에 뒷면→앞면 뒤집기 | `AnimReveal` |
| ㄴ 착지 | 공개 끝 | 220ms / 500ms | OutBack / InOutCubic | 1.06→1 바운스 + 사선 광택 지나감 + 테이블 글로우(Bloom) | 〃 |
| 칩 걸기 | `chip_placed` / 예측 패스 | **280ms** | OutQuad | 좌석 칩 아이콘 → 카드 위 더미, 포물선(높이 40), 220° 회전, 도착 시 칩 수 바운스 | `AnimChip` |
| 카드 가져가기 | `card_taken` / 예측 가져가기 | **420ms** | InOutCubic | 중앙 → 손패 끝, 손패 카드 크기로 축소, −8° 기울기, 칩 최대 8개가 30ms 간격으로 따라감 | `AnimTake` |
| ㄴ 도착 | 가져가기 끝 | 300ms | OutQuad | 좌석 1.04 펄스 + 금빛 불꽃 파티클 | `SeatView.Pulse`, `TableFx.Burst` |
| 턴 전환 | `turn_changed` | **240ms** | OutCubic | 좌석 링 페이드, 패널 밝기, 강조광(2D 라이트) 이동 | `AnimTurn` |
| ㄴ 내 차례 | 〃 | 260ms / 300ms | OutBack / OutQuad | 버튼 14px 아래→제자리, 턴 라벨 1.12 펄스 | 〃 |
| 숨김 공개 | `hidden_revealed` | 300ms + 360ms | Linear / InOutCubic | ±4° 흔들림 → 가로 뒤집기로 숫자 공개 → 광택 | `AnimHiddenReveal` |
| 롤백 | `action_result` 거절 | **220ms** | OutBack | 카드/칩 되돌리기 + 좌석 흔들림 180ms | `AnimReturnCard`, `SeatView.Shake` |
| 불가 입력 | 내 차례 아님 / 칩 0 패스 | 200ms | Linear | 버튼 좌우 흔들림 7px | `ShakeButton` |
| 토스트 | 알림 | 2.2초 (등장 176ms, 퇴장 330ms) | Linear | 상단 중앙 알약 | `Toast` |
| 게임 종료 | `game_ended` | 600ms + 500ms 유지 | OutCubic | "게임 종료" 배너 1.15→1 + 페이드 | `AnimEndBanner` |
| 점수 집계 | 결과 화면 | 1인당 ≈ 0.25 + 묶음×≤0.12 + 0.35초 | OutCubic | 행 등장 → 연속 묶음을 하나씩 밝히며 카드 점수 누적(틱음, 음높이 상승) → 칩 차감 카운트 → 1위 순위 바운스 | `ResultScreen` |
| 우승 | 내가 1위 | — | — | 금빛 낙하 파티클 120개 + 팡파르 + 강한 햅틱 | `TableFx.Confetti` |
| 메뉴 | Esc / ≡ | 160ms | OutQuad | 오버레이 페이드 | `ShowMenu` |
| 로비 진입 | 화면 전환 | 250ms, 카드 3장 500ms(80ms 간격) | OutQuad / OutBack | 페이드 + 카드 떠오름 | `LobbyScreen` |
| 분위기 | 항상 | — | — | 펜던트 조명 밝기 ±0.03 (0.7Hz), 먼지 파티클 | `TableFx.Update` |

### 지연별 체감 (예측 덕분에 내 행동 반응은 지연과 무관)

| 지연(단방향) | 버튼 반응 | 내 카드/칩 이동 시작 | 서버 확정 | 다음 카드 공개 시작 |
|---|---|---|---|---|
| 0ms | 같은 프레임 | 같은 프레임 | 즉시 | 예측 연출(420ms) 직후 |
| 100ms | 같은 프레임 | 같은 프레임 | 200ms | 예측 연출 직후 |
| 300ms | 같은 프레임 | 같은 프레임 | 600ms | ≈ 600ms (예측 연출 420ms + 대기 180ms) |

## 3. 효과음 (임시음 — 실행 시 PCM 합성)

> 외부 음원 파일 없음. `Resources/Audio/{이름}.wav` 를 넣으면 그것을 우선 사용 (`Sfx.Awake`).

| ID | 파일명(교체 시) | 쓰임 | 합성 방법 | 길이 |
|---|---|---|---|---|
| `Tap` | `tap` | 버튼·칩 선택 누름 | 1.8kHz 사인 + 짧은 노이즈 | 50ms |
| `Chip` | `chip` | 칩 도착 | 비조화 사인 3개(2.8/4.2/6.3kHz) 금속음 ×2 | 160ms |
| `Flip` | `flip` | 카드 공개·뒤집기 | 저역통과 노이즈 스윕 + 420Hz 착지 | 140ms |
| `Take` | `take` | 카드 가져가기 | 노이즈 스윕 + 칩 3번 | 340ms |
| `MyTurn` | `myturn` | 내 차례 (연속 차례면 높고 작게) | 880 + 1318Hz 종소리 | 500ms |
| `Tick` | `tick` | 턴 5초 이하 매초 | 1.2kHz 클릭 (초마다 음높이 상승) | 30ms |
| `Error` | `error` | 거절·불가 | 180/150Hz 낮은 2음 | 240ms |
| `Tally` | `tally` | 점수 집계 | 1.56kHz 틱 | 50ms |
| `Win` | `win` | 1위 | C5-E5-G5-C6 아르페지오 | 900ms |
| `End` | `end` | 게임 종료 | A 단조 화음 | 700ms |
| `Reveal` | `reveal` | 숨김 카드 공개 | 노이즈 상승 + 660/990Hz | 400ms |

## 4. 햅틱 (모바일)

| 상황 | 세기 | WebGL (`navigator.vibrate`) | 비고 |
|---|---|---|---|
| 버튼 누름 | Light | 8ms | |
| 내 행동 예측 시작 / 내가 가져감 | Medium | 18ms | |
| 내 차례 | Light | 8ms | |
| 거절·불가 | Error | 45ms | |
| 우승 | Heavy | 32ms | |
| 지원 범위 | Android Chrome 동작, **iOS Safari 는 Vibration API 미지원**(무시됨) | | 설정에서 끌 수 있음 |
