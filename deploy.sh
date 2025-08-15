#!/bin/bash
echo "🚀 GitHub 최신 코드로 업데이트 시작..."

# 최신 코드 받기
echo "📥 최신 코드 다운로드 중..."
git pull origin master

# 서버 업데이트
echo "📡 API 서버 업데이트 중..."
cd server
npm install
pm2 restart NoThanks-server

# 클라이언트 업데이트 (가장 중요)
echo "🌐 클라이언트 업데이트 중..."
cd ../client
npm install
npm run build  # 새로운 서버 URL이 적용됨
pm2 restart NoThanks-client

echo "✅ 업데이트 완료!"
echo "📊 현재 서비스 상태:"
pm2 list

echo "🌐 접속 주소:"
echo "- 웹사이트: http://43.201.36.137:3002"
echo "- API: http://43.201.36.137:3001"
