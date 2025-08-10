# No Thanks! 온라인 게임 프로젝트

이 저장소는 **No Thanks!** 보드게임을 간단한 온라인 버전으로 구현한 예제입니다. 친구들과 함께 한 개의 방에서 실시간으로 게임을 진행할 수 있도록 설계되었습니다. 회원가입 없이 닉네임만 입력하면 게임에 참여할 수 있으며, 기본적인 게임 규칙(카드 제거, 토큰 지불/획득, 점수 계산)을 따릅니다.

## 구성

```
nothanks/
├── server/        # Node.js + Express + Socket.io 서버 코드
│   ├── game.js    # 게임 상태와 로직을 관리하는 클래스
│   ├── index.js   # 서버 진입점: 소켓 이벤트 처리 및 API 설정
│   └── package.json
├── client/        # React + TypeScript 프론트엔드 코드 (Vite 사용)
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/ (JoinPage, GamePage, ResultPage)
│   │   ├── contexts/SocketContext.tsx
│   │   └── ...
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── README.md
```

## 로컬에서 실행하기

사전에 [Node.js](https://nodejs.org/)가 설치되어 있어야 합니다. 

1. 저장소를 원하는 위치에 복사한 후 터미널에서 프로젝트 루트(`nothanks`)로 이동합니다.

2. 서버 의존성 설치:
   ```bash
   cd server
   npm install
   ```

3. 클라이언트 의존성 설치:
   ```bash
   cd ../client
   npm install
   ```

4. 개발 모드로 실행:
   - 새 터미널 창/탭에서 서버 실행:
     ```bash
     cd server
     npm start
     ```
     서버는 기본적으로 포트 **3001**에서 실행됩니다.

   - 또 다른 터미널에서 프론트엔드 개발 서버 실행:
     ```bash
     cd client
     npm run dev
     ```
     프론트엔드는 기본적으로 포트 **5173**에서 실행됩니다. 브라우저에서 `http://localhost:5173`에 접속하면 닉네임을 입력하고 게임에 참여할 수 있습니다.

5. 게임 시작:
   - 첫 번째로 접속한 플레이어가 자동으로 방장이 되며, 카드 제거 수와 초기 토큰 수를 설정한 뒤 **게임 시작** 버튼을 누르면 게임이 시작됩니다.
   - 다른 플레이어는 방장이 시작할 때까지 기다리면 됩니다.

## 프로덕션 빌드 및 단일 서버 배포

프론트엔드를 빌드하여 서버에서 정적 파일로 서빙하는 것이 가능하며, AWS EC2 같은 가상 서버 한 대에서 전체 애플리케이션을 동작시킬 수 있습니다. 여기서는 간단한 무료(Free Tier) 환경을 가정합니다.

1. EC2 인스턴스(t2.micro 또는 t3.micro) 생성 후 **Ubuntu 20.04** 등의 이미지를 선택합니다. 보안 그룹에서 **포트 80**(HTTP)과 **3001**을 오픈합니다.

2. 서버에 SSH로 접속한 뒤 Node.js와 git을 설치합니다:
   ```bash
   sudo apt update && sudo apt install -y git nodejs npm
   ```

3. 저장소를 서버에 업로드하거나 git으로 클론합니다. 이후 서버와 클라이언트 의존성을 설치합니다:
   ```bash
   # 프로젝트 디렉터리로 이동
   cd nothanks/server
   npm install
   cd ../client
   npm install
   ```

4. 프론트엔드 빌드:
   ```bash
   cd client
   npm run build
   ```
   빌드가 완료되면 `client/dist` 디렉터리가 생성됩니다.

5. 서버에서 정적 파일 서빙:
   - 서버 코드(`server/index.js`)는 기본적으로 `../client/dist` 경로의 정적 파일을 제공하도록 구성되어 있습니다. 빌드 폴더를 그대로 두면 Express가 자동으로 React 앱을 서빙합니다.

6. 서버 실행:
   ```bash
   cd server
   npm start
   ```
   서버는 포트 **3001**에서 실행됩니다. EC2의 보안 그룹에서 해당 포트를 오픈했으면, 퍼블릭 IP나 도메인으로 접속하여 게임을 즐길 수 있습니다. 예를 들어 `http://YOUR_PUBLIC_IP:3001`.

7. (옵션) 포트 80으로 리버스 프록시 구성:
   - 더 편리한 URL(`http://YOUR_DOMAIN`)을 사용하고 싶다면 Nginx 등을 설치하여 80번 포트로 들어온 요청을 3001번 포트로 프록시하도록 설정할 수 있습니다. 무료 인증서가 필요 없으므로 HTTPS 설정은 생략할 수 있습니다.

## 참고 사항

- 이 예제는 **단일 방**만을 지원합니다. 여러 방이나 사용자 인증, 데이터베이스 연동 등은 포함되지 않았습니다.
- 게임 규칙에 따라 토큰을 모두 소진한 상태에서 패스할 경우 자동으로 카드를 가져가도록 구현되어 있습니다.
- 프런트엔드는 디자인보다 기능 구현에 초점을 맞췄으며, 필요에 따라 스타일을 추가할 수 있습니다.
- 소스 코드를 수정한 뒤 재배포하려면 서버를 다시 시작해야 합니다.

즐거운 게임 되세요!