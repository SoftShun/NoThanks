# 아트 디렉션

> 게임 이름은 아직 정하지 않았다. 화면과 코드에서는 자리표시자 **`{새 이름}`** 을 쓴다 (`Runtime/Theme.cs` 의 `Brand.Name` 한 곳만 바꾸면 됨).
> 원작 게임명·원작 카드/칩 아트는 쓰지 않는다. 현재 화면의 카드·칩·펠트·효과음은 모두 **코드로 생성한 자리표시자**이며, 아래 프롬프트로 만든 이미지로 교체할 수 있다.

## 1. 콘셉트 제안

| 안 | 이름 | 한 줄 요약 | 무드 키워드 | 장점 | 위험 |
|---|---|---|---|---|---|
| **1안 (구현)** | **벨벳 누아르** | 늦은 밤 펜던트 조명 아래 버건디 펠트 테이블, 황동 칩, 아이보리 카드 | 고급 라운지, 따뜻한 빛, 정적인 긴장감 | 2D 라이트·Bloom 과 잘 맞음, 숫자 가독성 높음, 성인 취향 | 어두워서 야외 휴대폰 화면에서 대비 관리 필요 |
| 2안 | 종이 공방 | 크래프트지·수채 얼룩, 손글씨 숫자, 나무 칩 | 아늑함, 수작업, 가족용 | 밝아서 가독성 좋음, 친근 | 연출의 "고급스러움"이 약함, 일러스트 비용 큼 |
| 3안 | 네온 아케이드 | 먹색 바탕에 시안·마젠타 네온 숫자, 스캔라인 | 경쾌함, 속도감, 스트리머 친화 | Bloom 효과가 극적, 모바일 다크모드와 잘 맞음 | 눈 피로, 카드게임의 차분한 수읽기와 어긋날 수 있음 |

## 2. 팔레트 (1안 벨벳 누아르)

| 토큰 | HEX | 용도 | 코드 |
|---|---|---|---|
| Ink | `#0E0C10` | 배경, 카메라 클리어 색 | `Pal.Ink` |
| InkSoft | `#18131B` | 카드 뒷면 바탕 | `Pal.InkSoft` |
| Felt | `#3B1622` | 테이블 펠트 기본색 | `Pal.Felt` |
| FeltDeep | `#220E16` | 펠트 그림자 | `Pal.FeltDeep` |
| Brass | `#C9A45C` | 주 강조(가져가기 버튼, 턴 링) | `Pal.Brass` |
| BrassLight | `#EBCB86` | 하이라이트, 칩 숫자, 제목 | `Pal.BrassLight` |
| BrassDim | `#7A6236` | 카드 안쪽 테두리, 칩 그림자 | `Pal.BrassDim` |
| Ivory | `#F3EBDD` | 카드 앞면 | `Pal.Ivory` |
| CardInk | `#231C20` | 카드 숫자 | `Pal.CardInk` |
| Text | `#F1E7DA` | 본문 | `Pal.Text` |
| Muted | `#A3968B` | 보조 텍스트 | `Pal.Muted` |
| Danger | `#E2645E` | 거절·시간 임박 | `Pal.Danger` |
| Good | `#7FD3A0` | (예비) 이득 표시 | `Pal.Good` |
| TierLow | `#6F8FA8` | 카드 3~12 상단 띠 | `Pal.TierLow` |
| TierMid | `#C9A45C` | 카드 13~24 상단 띠 | `Pal.TierMid` |
| TierHigh | `#B5473F` | 카드 25~35 상단 띠 (+숫자색 `#5A1E1B`) | `Pal.TierHigh` |

명도 대비 목표: 본문 Text/Ink ≥ 12:1, CardInk/Ivory ≥ 13:1, 버튼 Ink/Brass ≥ 7:1.

## 3. 타이포그래피

| 역할 | 글꼴 (OFL) | 파일 | 크기 (세로 / 가로 / 1440 / 1920) |
|---|---|---|---|
| 카드 숫자·제목·버튼 | Gowun Batang Bold | `Assets/Resources/Fonts/GowunBatang-Bold-KSubset.ttf` | 카드 높이의 40% (78 / 56 / 98 / 121px) |
| 본문·라벨 | Gowun Dodum Regular | `Assets/Resources/Fonts/GowunDodum-Regular-KSubset.ttf` | 13 / 12 / 15 / 17px |
| 서브셋 | ASCII + KS X 1001 한글 2,350자 + 기호 | `pyftsubset` 로 생성 (각 1.2~1.4MB) | — |
| 라이선스 | SIL OFL 1.1, 예약 글꼴명 없음 → 서브셋 배포 가능 | `OFL-GowunBatang.txt`, `OFL-GowunDodum.txt` 동봉 | — |

## 4. 카드 디자인 원칙

| 원칙 | 구현 |
|---|---|
| 숫자가 전부다 | 중앙 숫자를 카드 높이 40% 세리프 볼드로, 모서리 숫자는 70px 이상 카드에서만 |
| 비용을 색으로 예고 | 상단 띠 3단계(낮음 슬레이트 / 중간 황동 / 높음 크림슨), 25 이상은 숫자도 어두운 적색 |
| 종이 질감 | 아이보리 바탕 + 미세 노이즈 + 가장자리 음영 (`ProceduralArt.CardFace`) |
| 고급스러운 테두리 | 안쪽 6% 여백에 황동 1px 라인 |
| 뒷면 = 미지 | 먹색 + 황동 마름모 패턴 + 큰 `?` (덱, 숨김 카드) |
| 손패는 묶음으로 | 연속 카드는 겹쳐 하나의 묶음으로, 묶음 첫 장(점수에 들어가는 카드)만 진하게 |
| 그림자 | UI Toolkit 에 box-shadow 가 없어 블러 사각형 텍스처를 카드 뒤에 깐다 |

## 5. 칩 디자인 원칙

| 원칙 | 구현 |
|---|---|
| 황동 동전 | 원형 그라데이션 + 동심원 각인 + 12개 홈 (`ProceduralArt.Chip`) |
| 개수는 숫자로 확정 | 더미는 최대 8개만 쌓아 보여주고, 아래에 "칩 N" 숫자 |
| 움직임은 포물선 | 좌석 ↔ 카드 이동 시 아치 궤적 + 회전, 도착 시 금속음 |
| 비공개 칩 | 상대 칩 비공개면 `?` 로 표시 (서버가 값을 보내지 않음) |

## 6. 테이블·조명

| 요소 | 구현 | 비고 |
|---|---|---|
| 펠트 | 타일링 노이즈 텍스처 + Sprite-Lit 머티리얼 | 2D 라이트를 받음 |
| 펜던트 조명 | Point Light 2D (따뜻한 백색, 반경 화면 62%) + 미세한 밝기 흔들림 | reduced-motion 시 흔들림 끔 |
| 턴 강조광 | 현재 차례 좌석 쪽으로 이동하는 황동색 Point Light 2D | |
| 글로우 | HDR 색 스프라이트 → Bloom (threshold 0.85, intensity 1.15) | 카드 공개 시 밝아짐 |
| 먼지 | 조명 속을 떠다니는 파티클 (초당 7개) | reduced-motion 시 끔 |
| 후처리 | Bloom, Vignette 0.36, Tonemapping Neutral, Color Adjustments(노출 +0.15, 대비 +10, 채도 −6) | |

## 7. AI 이미지 생성 프롬프트 초안 (나중에 교체용)

> 공통 네거티브: `text, letters, watermark, logo, brand, existing card game, playing card suits, photorealistic hands, people`
> 출력 파일을 `unity/Assets/Resources/Art/{이름}.png` 에 넣으면 `ProceduralArt` 가 생성 텍스처 대신 사용한다.

| 파일명 | 크기 | 프롬프트 (영문 권장) |
|---|---|---|
| `felt.png` | 512×512 타일 | `seamless tileable burgundy velvet card table felt texture, subtle woven fibers, soft uneven dye, top-down, no lighting gradient, high detail, 4k` |
| `card_face.png` | 512×720 | `blank ivory playing card front, thick cotton paper texture, slightly warm off-white, very subtle deckled edge shading, thin brass foil inner border inset 6 percent, rounded corners, flat top-down scan, centered, no text` |
| `card_back.png` | 512×720 | `elegant card back design, deep ink black with brass art-deco diamond lattice, fine engraved lines, thin brass frame, symmetrical, rounded corners, flat top-down, no text, no logo` |
| `chip.png` | 256×256 (투명) | `single brass casino-style token seen from above, engraved concentric rings, twelve notches around the rim, warm polished metal with soft highlight top-left, isolated on transparent background, no numbers, no text` |
| 키 아트 (스토어/OG) | 1920×1080 | `moody top-down view of a burgundy velvet card table under a single warm pendant lamp, a few ivory number cards and scattered brass tokens, cinematic noir lighting, soft bloom, shallow depth of field, elegant and quiet tension, no text` |
| 앱 아이콘 | 1024×1024 | `minimal icon, single ivory card with a brass token resting on it, burgundy velvet background, warm rim light, soft shadow, flat composition, no text` |
