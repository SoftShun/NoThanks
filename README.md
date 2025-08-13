# No Thanks! 온라인 게임

**No Thanks!** 카드게임의 온라인 멀티플레이어 버전입니다. 최대 7명까지 실시간으로 게임할 수 있으며, AI 봇 지원과 다양한 게임 설정을 제공합니다.

## 주요 기능

- **멀티플레이어**: 최대 7명 (인간 + AI 봇)
- **AI 봇**: 3단계 난이도 (중/상/최상), 최대 3개
- **게임 설정**: 제거 카드 수, 초기 토큰, 턴 시간제한 등
- **실시간 기능**: 실시간 점수 표시, 턴 타이머
- **모바일 최적화**: 반응형 UI

## 빠른 시작

### 로컬 실행

```bash
# 서버 설치 및 실행
cd server
npm install
npm start

# 클라이언트 설치 및 실행 (새 터미널)
cd client  
npm install
npm run dev
```

서버: `http://localhost:3001` | 클라이언트: `http://localhost:5173`

### 프로덕션 배포

```bash
# 클라이언트 빌드
cd client
npm run build

# 서버 실행 (빌드된 클라이언트 자동 서빙)
cd ../server
npm start
```

## 게임 규칙

- **목표**: 가장 낮은 점수 얻기
- **점수**: 연속카드 중 최저값만 합산, 토큰 수 차감
- **턴**: 카드 가져가기 vs 토큰 지불해서 패스
- **종료**: 덱이 모두 소진되면 게임 종료

## 기술 스택

- **Backend**: Node.js + Express + Socket.io
- **Frontend**: React + TypeScript + Vite
- **AI**: 확률 기반 의사결정 알고리즘

## 라이선스

MIT License