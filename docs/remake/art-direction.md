# 아트 디렉션

- 게임 이름: **`{새 이름}`** (자리표시자. 코드에서는 `web/src/app/config.ts GAME_TITLE` 한 곳만 바꾸면 됨)
- 원작 게임명·원작 카드/박스 아트·원작 색 구성은 쓰지 않는다. 모든 그래픽은 코드로 그린 도형(Pixi Graphics, CSS)이다.

## 1. 콘셉트 후보

| 안 | 이름 | 한 줄 요약 | 카드 | 칩 | 색 | 장점 | 단점 |
|---|---|---|---|---|---|---|---|
| **1안 (채택)** | **심야 전당포** | 늦은 밤 전당포 카운터에서 물건(카드)을 흥정하는 경매 | 크림색 **전당표**(왼쪽 펀치 구멍, 숫자 크게) | 놋쇠 **엽전**(가운데 네모 구멍) | 먹색 남색 + 놋쇠 + 종이 크림 | 규칙("돈을 내고 떠넘기기")과 이야기가 맞음. 어두운 바탕이라 숫자 가독성·OLED 배터리 유리. 한국적 소품(엽전)으로 차별화 | 전체가 어두워 밝은 곳에서 대비 확인 필요 |
| 2안 | 온실 씨앗 시장 | 씨앗 봉투를 사고파는 아침 시장 | 씨앗 봉투 | 씨앗/콩 | 연두·흙색·하늘색 파스텔 | 밝고 친근, 가족용 | 다른 캐주얼 카드게임과 비슷해 보이기 쉬움 |
| 3안 | 궤도 경매소 | 우주 정거장 화물 경매 | 홀로그램 화물 태그 | 에너지 셀 | 검정 + 네온 시안/마젠타 | 화려한 연출 | 네온 글로 효과가 많아 모바일 성능·가독성 부담 |

## 2. 팔레트 (1안)

| 토큰 | HEX | 용도 |
|---|---|---|
| `ink` | `#10131C` | 앱 배경, 칩 구멍 |
| `ink-2` | `#161B27` | 패널·HUD 배경 |
| `felt` | `#1A2133` | 테이블 천 |
| `felt-2` | `#232C42` | 카드 뒷면, 보조 패널 |
| `edge` | `#0B0E15` | 테이블 테두리 |
| `brass` | `#D9A441` | 주 강조(칩, 내 차례, 주요 버튼) |
| `brass-2` | `#F0C869` | 하이라이트, 차례 링 |
| `brass-3` | `#8A6420` | 칩 테두리, 버튼 외곽선 |
| `paper` | `#F3E9D2` | 카드 앞면 |
| `paper-2` | `#D8C9A6` | 겹친 카드, 카드 테두리 |
| `teal` | `#3AA39A` | 낮은 카드(안전), 봇 아바타 |
| `vermilion` | `#E2553B` | 높은 카드(위험), 오류 |
| `text` | `#EDE6D6` | 본문 |
| `muted` | `#8C93A8` | 보조 글 |
| `good` | `#6CC28A` | 이득(점수 감소·칩 획득) |

- **카드 위험색**: 카드 값 3→35 를 `teal → brass → vermilion` 으로 보간(`theme.ts cardAccent`). 숫자를 읽지 않아도 "싼 카드/비싼 카드"가 느껴지게.
- 명도 대비: `paper` 위 `#23202A` 숫자 ≈ 14:1, `ink-2` 위 `text` ≈ 13:1, `muted` ≈ 5.6:1 (WCAG AA 통과).

## 3. 타이포그래피 (모두 SIL OFL 1.1)

| 용도 | 글꼴 | 굵기 | 크기(모바일/데스크톱) | 비고 |
|---|---|---|---|---|
| UI 전체(한글) | **Pretendard Variable** | 400·600·700·800 | 13~18 / 13~20px | npm `pretendard`, **동적 서브셋**(쓰는 글자 묶음만 내려받음) |
| 카드·점수 숫자 | **DM Serif Display** | 400 | 카드 높이 × 0.44 | `@fontsource/dm-serif-display` 라틴 서브셋만 (≈ 15KB) |
| 단축키 | Pretendard | 700 | 11px | `<kbd>` |

## 4. 카드 디자인 원칙

| 원칙 | 구현 |
|---|---|
| 숫자가 주인공 | 앞면 중앙 숫자 = 카드 높이의 44%, 세리프 숫자. 모서리 숫자는 180° 회전 |
| 위험이 색으로 보인다 | 안쪽 테두리 + 숫자 아래 띠가 위험색 |
| 전당표 모티프 | 왼쪽 가장자리 펀치 구멍 5개(테이블 색으로 뚫림), 둥근 모서리 반경 = 폭의 10% |
| 뒷면 | 남색 + 놋쇠 마름모 격자 + 가운데 원 문양. 히든 카드는 원 안에 `?` |
| 손패(묶음) | 연속 묶음은 겹쳐 놓고 **점수에 들어가는 가장 낮은 카드가 맨 위**. 나머지는 오른쪽으로 비껴 숫자만 보이고 색을 낮춤 |
| 그림자 | 아래로 6px, 35% 검정 (조명이 위에서) |

## 5. 칩 디자인 원칙

| 원칙 | 구현 |
|---|---|
| 엽전 | 놋쇠 원 + 안쪽 밝은 고리 + **가운데 네모 구멍** |
| 쌓임 | 최대 10개까지 위로 살짝 엇갈려 쌓고, 정확한 수는 `×N` 배지 |
| 크기 | 반지름 11~18px (모드별). 터치 대상이 아니므로 크기 제한 없음 |
| 보이지 않는 칩 | 상대 칩 비공개면 숫자 대신 `?` |

## 6. AI 이미지 생성 프롬프트 초안 (최종 아트 제작 시)

> 공통 접미사: `flat vector illustration, clean shapes, subtle paper grain, no text, no logos, no trademarked characters, consistent warm lamp lighting from top-left`

| 대상 | 프롬프트 (영문) | 비고 |
|---|---|---|
| 테이블 배경 | `Top-down view of a dark navy felt counter inside a cozy late-night Korean pawnshop, brass lamp glow pooling in the center, worn wood edge, scattered shadows, deep indigo #1A2133 and brass #D9A441 palette, empty center area for cards` | 1920×1080, 2560×1440, 세로 1170×2532 각각 |
| 카드 앞면 틀 | `Blank cream pawn ticket card, rounded corners, perforated punch holes along left edge, thin colored inner border, aged paper texture, front view, isolated on transparent background` | 숫자는 런타임에 얹음. 위험색 테두리 3종(teal/brass/vermilion) |
| 카드 뒷면 | `Back of a playing card, deep navy with fine brass diamond lattice pattern and a round brass emblem in the center, art-deco meets Korean traditional pattern, symmetrical` | |
| 칩(엽전) | `Single antique brass coin with a square hole in the center, Korean yeopjeon style but without any characters, slight wear, soft top-left light, isolated, front view` | 64/128px |
| 봇 아바타 3종 | `Friendly round portrait of a pawnshop {apprentice / clerk / old master} automaton, teal enamel and brass, simple shapes, warm expression, circle crop` | 중/상/최상 |
| 앱 아이콘 | `App icon: brass coin with square hole on deep navy, single cream ticket peeking behind, minimal, bold silhouette` | |
| 승리 연출 | `Burst of brass coins and paper tickets flying upward, celebratory, dark navy background, motion streaks` | 결과 화면 배경 |
