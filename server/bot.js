/*
 * AI 봇 시스템 for No Thanks! 게임 - 완전 재설계 버전
 * 
 * 핵심 개념: 감정 기반 인간다운 AI
 * - 복잡한 계산 대신 감정과 직감 중심
 * - 실시간으로 변화하는 성격과 관계
 * - 플레이어가 체감할 수 있는 명확한 차이
 */

class Bot {
  constructor(id, nickname, difficulty = 'medium') {
    this.id = id;
    this.nickname = nickname;
    this.difficulty = difficulty;
    this.tokens = 0;
    this.cards = [];
    this.isBot = true;
    
    // === 핵심: 감정 상태 시스템 ===
    this.emotionalState = {
      mood: Math.random() * 0.4 + 0.3,        // 0.3~0.7 (시작시 중간 정도)
      confidence: Math.random() * 0.4 + 0.3,   // 자신감
      competitiveness: Math.random() * 0.6 + 0.2, // 승부욕
      frustration: 0,                           // 좌절감 (시작시 0)
      greed: Math.random() * 0.4 + 0.3,       // 욕심
      vengeful: 0                               // 복수심 (시작시 0)
    };
    
    // === 플레이어 관계 및 학습 시스템 ===
    this.playerRelations = {}; // { playerId: { rivalry, trust, pattern } }
    this.gameEvents = [];      // 최근 중요 이벤트들
    this.personalityMemory = []; // 성격 변화 기록
    
    // === 난이도별 기본 성향 ===
    this.baseTendency = this.initializeTendency(difficulty);
    
    console.log(`🤖 ${this.nickname} [${this.difficulty}] 생성됨!`);
    console.log(`   감정 상태: 기분 ${this.emotionalState.mood.toFixed(2)}, 자신감 ${this.emotionalState.confidence.toFixed(2)}, 승부욕 ${this.emotionalState.competitiveness.toFixed(2)}`);
    console.log(`   성향: ${this.baseTendency.description}`);
  }
  
  /**
   * 난이도별 기본 성향 초기화
   */
  initializeTendency(difficulty) {
    switch (difficulty) {
      case 'medium':
        return {
          description: "일반적이고 예측 가능한 플레이어",
          riskTolerance: 0.5,
          emotionalIntensity: 0.3, // 감정 변화가 적음
          learningRate: 0.1,       // 학습 속도 느림
          randomness: 0.15         // 약간의 무작위성
        };
      case 'hard':
        return {
          description: "감정적이고 경쟁적인 플레이어", 
          riskTolerance: 0.7,
          emotionalIntensity: 0.6, // 감정 변화가 큼
          learningRate: 0.3,       // 학습 속도 보통
          randomness: 0.25         // 상당한 무작위성
        };
      case 'expert':
        return {
          description: "예측 불가능하고 전략적인 플레이어",
          riskTolerance: 0.8,
          emotionalIntensity: 0.8, // 극도의 감정 변화
          learningRate: 0.5,       // 빠른 학습
          randomness: 0.35         // 높은 무작위성
        };
      default:
        return this.initializeTendency('medium');
    }
  }

  /**
   * 메인 의사결정 시스템 - 안전한 에러 처리 포함
   */
  makeDecision(gameState) {
    try {
      const { currentCard, pileTokens, players } = gameState;
      
      // 입력 유효성 검사
      if (typeof currentCard !== 'number' || typeof pileTokens !== 'number' || !Array.isArray(players)) {
        console.error(`⚠️ ${this.nickname}: 잘못된 게임 상태 데이터`);
        return 'pass'; // 안전한 기본값
      }
      
      console.log(`\n🧠 ${this.nickname} [${this.difficulty}] 의사결정 시작:`);
      console.log(`   카드: ${currentCard}, 칩: ${pileTokens}, 내 토큰: ${this.tokens}`);
      
      // 1. 기본 전략적 판단 (30%)
      const basicDecision = this.makeBasicDecision(currentCard, pileTokens, gameState);
      console.log(`   기본 판단: ${basicDecision.action} (이유: ${basicDecision.reason})`);
      
      // 2. 감정 상태 적용 (40%) - 전략 시스템과 통합
      const emotionalDecision = this.applyEmotionalFactors(basicDecision, currentCard, pileTokens, players, gameState);
      console.log(`   감정 조정: ${emotionalDecision.action} (${emotionalDecision.emotionalReason})`);
      
      // 3. 플레이어 관계 고려 (20%) - 전략 시스템과 통합
      const socialDecision = this.considerPlayerRelations(emotionalDecision, currentCard, players, gameState);
      console.log(`   관계 고려: ${socialDecision.action} (${socialDecision.socialReason})`);
      
      // 4. 최종 무작위 요소 (제한적)
      const finalDecision = this.addFinalRandomness(socialDecision, currentCard, pileTokens);
      console.log(`   최종 결정: ${finalDecision} 🎯\n`);
      
      // 5. 결정 후 감정 변화 및 학습
      this.updateEmotionsAfterDecision(finalDecision, currentCard, pileTokens);
      this.learnFromSituation(currentCard, pileTokens, players, finalDecision);
      
      // 최종 유효성 검사
      if (finalDecision !== 'take' && finalDecision !== 'pass') {
        console.error(`⚠️ ${this.nickname}: 잘못된 결정값 "${finalDecision}", 패스로 대체`);
        return 'pass';
      }
      
      return finalDecision;
      
    } catch (error) {
      console.error(`🚨 ${this.nickname}: 의사결정 중 오류 발생:`, error.message);
      // 토큰이 있으면 패스, 없으면 테이크 (안전한 폴백)
      return this.tokens > 0 ? 'pass' : 'take';
    }
  }

  /**
   * 1단계: 동적 전략 기반 판단 - 상황에 따른 유연한 전략 선택
   */
  makeBasicDecision(currentCard, pileTokens, gameState) {
    // 토큰 부족시 강제 취득
    if (this.tokens <= 0) {
      return { action: 'take', reason: '토큰 없음' };
    }
    
    // 실제 손실 계산
    const realCost = this.calculateRealCost(currentCard, pileTokens);
    console.log(`   💰 실제 손실 계산: ${currentCard}점 카드 - ${this.getConnectionBonus(currentCard).toFixed(1)}연결보너스 - ${pileTokens}칩 = ${realCost.toFixed(1)}점 손실`);
    
    // 게임 상황 분석
    const situation = this.analyzeGameSituation(gameState);
    
    // 동적 전략 선택
    const strategy = this.selectStrategy(situation, currentCard, pileTokens, realCost);
    console.log(`   🎯 선택된 전략: ${strategy.name} (${strategy.description})`);
    
    // 전략에 따른 의사결정
    const decision = this.executeStrategy(strategy, currentCard, pileTokens, realCost, situation);
    console.log(`   ⚖️ 전략적 판단: ${decision.action} (${decision.reason})`);
    
    return decision;
  }
  
  /**
   * 상황에 맞는 최적 전략 선택
   */
  selectStrategy(situation, currentCard, pileTokens, realCost) {
    try {
      // 입력 유효성 검사
      if (!situation || typeof currentCard !== 'number' || typeof pileTokens !== 'number') {
        console.error(`⚠️ ${this.nickname}: selectStrategy - 잘못된 입력값`);
        return this.getDefaultStrategy();
      }
      
      const { gameProgress, myRank, pointsFromLead, pointsFromLast, tokenAdvantage, 
              isLeading, isLastPlace, isCloseGame, remainingCardsRisk, opponentAnalysis } = situation;
    
    // === 0. 견제 전략 우선 체크 ===
    if (opponentAnalysis.shouldUseBlockingStrategy) {
      const primaryThreat = opponentAnalysis.primaryThreat;
      
      // 위협적인 플레이어가 이 카드를 원할 가능성이 높은지 체크
      const threatWantsCard = this.wouldPlayerWantCard(primaryThreat, currentCard);
      
      if (threatWantsCard && gameProgress > 0.4) { // 중반 이후에만 견제 활성화
        const blockingIntensity = opponentAnalysis.blockingIntensity;
        
        return {
          name: '견제_전략',
          description: `${primaryThreat.nickname} 견제 (위험도: ${primaryThreat.riskLevel})`,
          riskTolerance: 0.7 + (blockingIntensity * 0.8), // 견제를 위해 더 큰 위험 감수
          chipValue: 0.8, // 칩보다 견제가 우선
          connectionBonus: 1.0,
          isBlocking: true,
          blockTarget: primaryThreat,
          blockingIntensity
        };
      }
    }
    
    // === 1. 게임 단계별 기본 전략 ===
    
    // 초반 전략 (0-30% 진행) - 더 적극적으로 수정
    if (gameProgress < 0.3) {
      if (tokenAdvantage < -3) {
        return {
          name: '초반_칩파밍',
          description: '초반 칩 확보 우선',
          riskTolerance: 0.7, // 0.3 → 0.7로 증가
          chipValue: 1.8, // 칩의 가치를 더 높게 평가
          connectionBonus: 1.0
        };
      } else if (this.cards.length <= 1) {
        return {
          name: '초반_빌드업',
          description: '초반 적극적 빌드업',
          riskTolerance: 0.8, // 새로운 적극적 전략
          chipValue: 1.4,
          connectionBonus: 1.3
        };
      } else {
        return {
          name: '초반_선별적',
          description: '초반 좋은 기회만 선택',
          riskTolerance: 0.5, // 0.2 → 0.5로 증가
          chipValue: 1.2, // 1.0 → 1.2로 증가
          connectionBonus: 1.2
        };
      }
    }
    
    // 후반 전략 (70%+ 진행)
    if (gameProgress >= 0.7) {
      if (isLastPlace && pointsFromLast > 8) {
        return {
          name: '후반_절망적_도박',
          description: '절망적 상황에서 과감한 도박',
          riskTolerance: 2.0,
          chipValue: 0.8,
          connectionBonus: 0.8
        };
      } else if (isLeading && pointsFromLead < -5) {
        return {
          name: '후반_리딩_수비',
          description: '확실한 리드 상황에서 안전하게',
          riskTolerance: 0.1,
          chipValue: 1.3,
          connectionBonus: 1.1
        };
      } else if (!isLeading && pointsFromLead <= 8) {
        return {
          name: '후반_추격_공세',
          description: '근소한 차이로 뒤처진 상황에서 적극 추격',
          riskTolerance: 1.2,
          chipValue: 0.9,
          connectionBonus: 1.3
        };
      } else {
        return {
          name: '후반_균형',
          description: '후반 균형잡힌 플레이',
          riskTolerance: 0.6,
          chipValue: 1.0,
          connectionBonus: 1.1
        };
      }
    }
    
    // === 2. 중반 상황별 전략 (30-70% 진행) ===
    
    // 접전 상황
    if (isCloseGame) {
      if (tokenAdvantage > 2) {
        return {
          name: '중반_접전_칩우위',
          description: '접전에서 칩 우위 활용',
          riskTolerance: 0.8,
          chipValue: 0.7, // 칩 우위가 있으니 적극 사용
          connectionBonus: 1.2
        };
      } else {
        return {
          name: '중반_접전_신중',
          description: '접전에서 신중한 플레이',
          riskTolerance: 0.4,
          chipValue: 1.2,
          connectionBonus: 1.1
        };
      }
    }
    
    // 리딩 상황  
    if (isLeading) {
      return {
        name: '중반_리딩_안정',
        description: '리딩 상황에서 안정적 운영',
        riskTolerance: 0.3,
        chipValue: 1.2,
        connectionBonus: 1.0
      };
    }
    
    // 뒤처진 상황
    if (myRank >= Math.ceil(situation.totalPlayers * 0.7)) {
      return {
        name: '중반_추격_적극',
        description: '뒤처진 상황에서 적극적 추격',
        riskTolerance: 1.0,
        chipValue: 0.8,
        connectionBonus: 1.3
      };
    }
    
    // 칩 부족 상황
    if (tokenAdvantage < -2) {
      return {
        name: '중반_칩부족_보존',
        description: '칩 부족 시 보존 우선',
        riskTolerance: 0.2,
        chipValue: 1.5,
        connectionBonus: 1.0
      };
    }
    
    // 기본 중반 전략
    return {
      name: '중반_균형',
      description: '중반 균형잡힌 플레이',
      riskTolerance: 0.5,
      chipValue: 1.0,
      connectionBonus: 1.1
    };
  } catch (error) {
    console.error(`🚨 ${this.nickname}: selectStrategy 오류:`, error.message);
    return this.getDefaultStrategy();
  }
}

  /**
   * 기본 안전 전략 반환
   */
  getDefaultStrategy() {
    return {
      name: '기본_안전',
      description: '안전한 기본 전략',
      riskTolerance: 0.3,
      chipValue: 1.0,
      connectionBonus: 1.0
    };
  }
  
  /**
   * 선택된 전략을 실행하여 구체적인 결정을 내림
   */
  executeStrategy(strategy, currentCard, pileTokens, realCost, situation) {
    const { riskTolerance, chipValue, connectionBonus } = strategy;
    
    // 견제 전략 특별 처리
    if (strategy.isBlocking) {
      return this.executeBlockingStrategy(strategy, currentCard, pileTokens, realCost, situation);
    }
    
    // 전략별 동적 임계값 계산
    const baseRiskTolerance = this.baseTendency.riskTolerance;
    const strategicRiskTolerance = baseRiskTolerance * riskTolerance;
    
    // 난이도별 기본 허용 손실 (더 적극적으로 조정)
    let baseMaxLoss;
    if (this.difficulty === 'medium') {
      baseMaxLoss = 6; // 3 → 6으로 증가
    } else if (this.difficulty === 'hard') {
      baseMaxLoss = 8; // 5 → 8로 증가
    } else {
      baseMaxLoss = 12; // 7 → 12로 대폭 증가 (전문가는 더 공격적)
    }
    
    // 전략적 최대 허용 손실 = 기본값 × 전략 위험 허용도
    const strategicMaxLoss = baseMaxLoss * strategicRiskTolerance;
    
    // 칩과 연결의 전략적 가치 조정
    const adjustedChipValue = pileTokens * chipValue;
    const adjustedConnectionBonus = this.getConnectionBonus(currentCard) * connectionBonus;
    
    // 전략적 실제 손실 재계산
    const strategicCost = currentCard - adjustedConnectionBonus - adjustedChipValue;
    
    console.log(`   📈 전략적 재계산: ${currentCard}점 - ${adjustedConnectionBonus.toFixed(1)}연결 - ${adjustedChipValue.toFixed(1)}칩 = ${strategicCost.toFixed(1)}점`);
    console.log(`   🎚️ 허용 손실: ${strategicMaxLoss.toFixed(1)}점 (기본 ${baseMaxLoss}점 × ${strategicRiskTolerance.toFixed(2)})`);
    
    // 전략적 의사결정
    
    // 1. 명백한 이익인 경우
    if (strategicCost <= 0) {
      return { action: 'take', reason: `전략적 이익 (${Math.abs(strategicCost).toFixed(1)}점 득, ${strategy.name})` };
    }
    
    // 2. 칩이 많이 쌓인 경우 특별 처리 (초반 빌드업 고려)
    if (pileTokens >= 8) {
      // 칩이 8개 이상이면 더 관대한 기준 적용
      const chipBonusLimit = strategicMaxLoss + Math.min(pileTokens * 0.5, 8); // 칩에 따른 추가 허용
      if (strategicCost <= chipBonusLimit) {
        return { action: 'take', reason: `고칩보상 (${strategicCost.toFixed(1)}점, 칩${pileTokens}개로 ${chipBonusLimit.toFixed(1)}점까지 허용)` };
      }
    }
    
    // 3. 초반 게임에서의 빌드업 전략
    if (situation.gameProgress < 0.4 && this.cards.length <= 2) {
      // 초반이고 카드가 적으면 빌드업을 위해 더 적극적
      const earlyGameLimit = strategicMaxLoss + 4; // 초반에는 4점 추가 허용
      if (strategicCost <= earlyGameLimit && currentCard <= 28) {
        return { action: 'take', reason: `초반빌드업 (${strategicCost.toFixed(1)}점, 카드${this.cards.length}개 보유중)` };
      }
    }
    
    // 4. 직접 연결의 전략적 가치
    const directConnection = this.hasDirectConnection(currentCard);
    if (directConnection) {
      const connectionLimit = strategicMaxLoss + 3; // 연결에 대한 추가 허용
      if (strategicCost <= connectionLimit) {
        return { action: 'take', reason: `전략적 직접연결 (${strategicCost.toFixed(1)}점, ${strategy.name})` };
      }
    }
    
    // 5. 간접 연결의 전략적 가치  
    const indirectConnection = this.hasIndirectConnection(currentCard);
    if (indirectConnection && strategicCost <= strategicMaxLoss + 1) {
      return { action: 'take', reason: `전략적 간접연결 (${strategicCost.toFixed(1)}점, ${strategy.name})` };
    }
    
    // 6. 전략적 허용 범위 내인 경우
    if (strategicCost <= strategicMaxLoss) {
      return { action: 'take', reason: `전략적 허용범위 (${strategicCost.toFixed(1)}점 ≤ ${strategicMaxLoss.toFixed(1)}점, ${strategy.name})` };
    }
    
    // 5. 전략적 거부
    return { action: 'pass', reason: `전략적 거부 (${strategicCost.toFixed(1)}점 > ${strategicMaxLoss.toFixed(1)}점, ${strategy.name})` };
  }
  
  /**
   * 견제 전략 실행 - 위협적인 상대방을 견제하기 위한 특별한 로직
   */
  executeBlockingStrategy(strategy, currentCard, pileTokens, realCost, situation) {
    const { blockTarget, blockingIntensity, riskTolerance } = strategy;
    
    console.log(`   🛡️ 견제 전략 실행: ${blockTarget.nickname} 견제 (강도: ${(blockingIntensity * 100).toFixed(0)}%)`);
    
    // 견제를 위한 특별한 계산 (더 적극적으로 수정)
    const baseMaxLoss = this.difficulty === 'medium' ? 6 : 
                       this.difficulty === 'hard' ? 8 : 12;
    
    // 견제 강도에 따른 허용 손실 증가
    const blockingBonus = blockingIntensity * 10; // 최대 10점까지 추가 허용 (6→10)
    const blockingMaxLoss = baseMaxLoss * riskTolerance + blockingBonus;
    
    // 견제 가치 계산 - 칩의 가치는 유지, 견제 효과는 높게
    const adjustedChipValue = pileTokens * 1.0; // 칩 가치 감소하지 않음 (0.8→1.0)
    const connectionBonus = this.getConnectionBonus(currentCard);
    const blockingCost = currentCard - connectionBonus - adjustedChipValue;
    
    console.log(`   🎯 견제 계산: ${currentCard}점 - ${connectionBonus.toFixed(1)}연결 - ${adjustedChipValue.toFixed(1)}칩 = ${blockingCost.toFixed(1)}점`);
    console.log(`   🛡️ 견제 허용 손실: ${blockingMaxLoss.toFixed(1)}점 (기본 ${baseMaxLoss}점 + 견제보너스 ${blockingBonus.toFixed(1)}점)`);
    
    // 견제 의사결정
    
    // 1. 명백한 이익이면 무조건 가져가기
    if (blockingCost <= 0) {
      return { action: 'take', reason: `견제+이익 (${Math.abs(blockingCost).toFixed(1)}점 득, ${blockTarget.nickname} 차단)` };
    }
    
    // 2. 견제 허용 범위 내라면 가져가기
    if (blockingCost <= blockingMaxLoss) {
      const blockingReason = blockTarget.riskFactors.slice(0, 2).join(', '); // 주요 위험 요소 2개만
      return { action: 'take', reason: `견제 실행 (${blockingCost.toFixed(1)}점 손실, ${blockTarget.nickname} 차단: ${blockingReason})` };
    }
    
    // 3. 견제를 위해서도 손실이 너무 크면 포기
    return { action: 'pass', reason: `견제 포기 (${blockingCost.toFixed(1)}점 > ${blockingMaxLoss.toFixed(1)}점, 손실 과다)` };
  }
  
  /**
   * 실제 손실 계산 - 게임의 핵심 로직
   */
  calculateRealCost(currentCard, pileTokens) {
    const baseCost = currentCard; // 기본 손실 = 카드 점수
    const connectionBonus = this.getConnectionBonus(currentCard); // 연결 보너스
    const chipGain = pileTokens; // 칩 이득
    
    return baseCost - connectionBonus - chipGain;
  }
  
  /**
   * 정확한 연결 보너스 계산 - 실제 점수 차이 기반 (명확한 변수명과 주석으로 개선)
   */
  getConnectionBonus(currentCard) {
    try {
      // 입력 유효성 검사
      if (typeof currentCard !== 'number') {
        console.error(`⚠️ ${this.nickname}: getConnectionBonus - 잘못된 카드 값`);
        return 0;
      }
      
      // 현재 카드만으로 계산한 순수 점수 (tokens는 보너스로 별도 처리)
      const currentPureCardScore = this.calculateCurrentScore();
      
      // 새 카드를 추가한 임시 카드 목록 생성
      const tempCards = [...this.cards, currentCard];
      
      // 새 카드 추가 후 순수 카드 점수 계산 (토큰 영향 제외)
      const newPureCardScore = this.calculatePlayerScore({ cards: tempCards, tokens: 0 });
      
      // 실제 절약되는 점수 = 기존 점수 - 새 점수 (연결로 인한 절약)
      const connectionSavings = currentPureCardScore - newPureCardScore;
      
      // 연결 정보 분석 및 로깅
      const directConnections = this.cards.filter(card => Math.abs(card - currentCard) === 1);
      const indirectConnections = this.cards.filter(card => Math.abs(card - currentCard) === 2);
      
      let connectionInfo = [];
      let finalBonus = Math.max(0, connectionSavings);
      
      if (directConnections.length > 0) {
        connectionInfo.push(`직접연결: ${directConnections.join(',')}`);
      }
      
      if (indirectConnections.length > 0) {
        // 간접 연결의 가치는 매우 제한적으로 평가 (불확실한 미래 이익)
        const indirectBonus = Math.min(connectionSavings * 0.1, currentCard * 0.05);
        connectionInfo.push(`간접연결: ${indirectConnections.join(',')} (${indirectBonus.toFixed(1)}점 추가)`);
        finalBonus = Math.max(0, connectionSavings + indirectBonus);
      }
      
      if (connectionInfo.length > 0) {
        console.log(`   🔗 연결 정보: ${connectionInfo.join(', ')} → 실제 절약 ${finalBonus.toFixed(1)}점`);
      }
      
      return finalBonus;
      
    } catch (error) {
      console.error(`🚨 ${this.nickname}: getConnectionBonus 오류:`, error.message);
      return 0; // 안전한 기본값
    }
  }
  
  /**
   * 직접 연결 체크
   */
  hasDirectConnection(currentCard) {
    return this.cards.some(card => Math.abs(card - currentCard) === 1);
  }
  
  /**
   * 간접 연결 체크
   */
  hasIndirectConnection(currentCard) {
    return this.cards.some(card => Math.abs(card - currentCard) === 2);
  }

  /**
   * 2단계: 감정 상태에 따른 조정 - 전략 시스템과 통합
   */
  applyEmotionalFactors(basicDecision, currentCard, pileTokens, players, gameState) {
    let decision = { ...basicDecision };
    let emotionalReasons = [];
    
    const emotions = this.emotionalState;
    
    // 현재 감정 상태를 더 자세히 로깅
    console.log(`   💭 감정 상태: 기분 ${emotions.mood.toFixed(2)}, 자신감 ${emotions.confidence.toFixed(2)}, 승부욕 ${emotions.competitiveness.toFixed(2)}, 좌절감 ${emotions.frustration.toFixed(2)}, 복수심 ${emotions.vengeful.toFixed(2)}`);
    
    // 전략적 결정이 견제 전략인 경우 감정 영향을 제한
    const isStrategicBlocking = basicDecision.reason && basicDecision.reason.includes('견제');
    if (isStrategicBlocking) {
      console.log(`   🛡️ 견제 전략 중이므로 감정 영향 제한`);
      emotionalReasons.push('견제 전략 유지');
      decision.emotionalReason = emotionalReasons.join(', ');
      return decision;
    }
    
    // 현재 손실 계산 다시 가져오기
    const realCost = this.calculateRealCost(currentCard, pileTokens);
    
    // === 감정 조정 with 합리적 제한 ===
    // 각 감정 상태에 따른 조정폭을 제한하여 완전히 비합리적인 결정 방지
    
    // === 기분이 좋을 때 ===
    if (emotions.mood > 0.7) {
      if (basicDecision.action === 'pass' && realCost > 0 && realCost <= 4) { // 손실이 적을 때만 약간 과감
        const chance = Math.min(0.3, (emotions.mood - 0.7) * 1.0); // 최대 30% 확률
        if (Math.random() < chance) {
          decision.action = 'take';
          emotionalReasons.push('기분 좋아서 약간 과감');
        }
      }
    }
    
    // === 기분이 나쁠 때 ===
    if (emotions.mood < 0.3) {
      if (basicDecision.action === 'take' && realCost > 1 && realCost <= 6) { // 중간 손실에서만 더 신중
        const chance = Math.min(0.25, (0.3 - emotions.mood) * 0.8); // 최대 25% 확률
        if (Math.random() < chance) {
          decision.action = 'pass';
          emotionalReasons.push('기분 나빠서 더 신중');
        }
      }
    }
    
    // === 자신감이 높을 때 ===
    if (emotions.confidence > 0.8) {
      if (basicDecision.action === 'pass' && realCost > 0 && realCost <= 3) { // 작은 손실에서만 위험 감수
        const chance = Math.min(0.2, (emotions.confidence - 0.8) * 1.0); // 최대 20% 확률
        if (Math.random() < chance) {
          decision.action = 'take';
          emotionalReasons.push('자신감으로 위험 감수');
        }
      }
    }
    
    // === 좌절감이 높을 때 ===
    if (emotions.frustration > 0.6) {
      if (basicDecision.action === 'take' && realCost > 0 && realCost <= 5) { // 중간 손실에서만 더 보수적
        const chance = Math.min(0.3, (emotions.frustration - 0.6) * 0.75); // 최대 30% 확률
        if (Math.random() < chance) {
          decision.action = 'pass';
          emotionalReasons.push('좌절감으로 극도로 신중');
        }
      }
    }
    
    // === 승부욕이 강할 때 ===
    if (emotions.competitiveness > 0.8) {
      const isLeading = this.isCurrentlyLeading(players);
      if (!isLeading && basicDecision.action === 'pass' && realCost > 0 && realCost <= 8) {
        const chance = Math.min(0.15, (emotions.competitiveness - 0.8) * 0.75); // 최대 15% 확률
        if (Math.random() < chance) {
          decision.action = 'take';
          emotionalReasons.push('승부욕으로 과감');
        }
      }
    }
    
    // === 욕심이 많을 때 ===
    if (emotions.greed > 0.7) {
      if (basicDecision.action === 'pass' && realCost > 0 && realCost <= 4 && pileTokens >= 2) {
        const chance = Math.min(0.2, (emotions.greed - 0.7) * 0.67); // 최대 20% 확률
        if (Math.random() < chance) {
          decision.action = 'take';
          emotionalReasons.push('욕심으로 기회 포착');
        }
      }
    }
    
    // === 복수심이 있을 때 ===
    if (emotions.vengeful > 0.5) {
      const targetPlayer = this.findVengefulTarget(players);
      if (targetPlayer && this.wouldPlayerWantCard(targetPlayer, currentCard)) {
        // 복수를 위한 손실은 최대 3점까지만 허용 (대폭 감소)
        if (basicDecision.action === 'pass' && realCost > 0 && realCost <= 3) {
          const chance = Math.min(0.15, (emotions.vengeful - 0.5) * 0.3); // 최대 15% 확률로 감소
          if (Math.random() < chance) {
            decision.action = 'take';
            emotionalReasons.push(`${targetPlayer.nickname}에게 복수 (손실 ${realCost.toFixed(1)}점 감수)`);
          }
        }
      }
    }
    
    decision.emotionalReason = emotionalReasons.length > 0 ? emotionalReasons.join(', ') : '감정 변화 없음';
    return decision;
  }

  /**
   * 3단계: 플레이어 관계 고려 - 전략 시스템과 통합
   */
  considerPlayerRelations(emotionalDecision, currentCard, players, gameState) {
    let decision = { ...emotionalDecision };
    let socialReasons = [];
    
    // 전략적 결정(특히 견제)이 이미 적용된 경우 관계 영향을 제한
    const isStrategicDecision = emotionalDecision.reason && 
      (emotionalDecision.reason.includes('견제') || 
       emotionalDecision.reason.includes('전략적') ||
       emotionalDecision.reason.includes('절망적_도박') ||
       emotionalDecision.reason.includes('추격_공세'));
    
    if (isStrategicDecision) {
      console.log(`   🎯 전략적 결정이므로 관계 영향 최소화`);
      socialReasons.push('전략 우선');
      decision.socialReason = socialReasons.join(', ');
      return decision;
    }
    
    // 게임 상황 분석으로 중요한 견제 대상이 있는지 확인
    const situation = this.analyzeGameSituation(gameState);
    const hasImportantThreat = situation.opponentAnalysis.primaryThreat && 
                              situation.opponentAnalysis.primaryThreat.riskLevel === 'critical';
    
    // 중요한 위협이 있을 때는 개인적 감정보다 게임 상황 우선
    if (hasImportantThreat) {
      const threat = situation.opponentAnalysis.primaryThreat;
      const threatWantsCard = this.wouldPlayerWantCard(threat, currentCard);
      
      if (threatWantsCard && decision.action === 'pass') {
        decision.action = 'take';
        socialReasons.push(`중요 위협 ${threat.nickname} 견제`);
        decision.socialReason = socialReasons.join(', ');
        return decision;
      }
    }
    
    // 기존 관계 로직 (제한적으로 적용)
    
    // 복수심이 있는 플레이어가 이 카드를 원할 수 있는지 체크 (제한적)
    if (this.emotionalState.vengeful > 0.7) { // 임계값 상향 조정
      const targetPlayer = this.findVengefulTarget(players);
      if (targetPlayer && this.wouldPlayerWantCard(targetPlayer, currentCard)) {
        if (decision.action === 'pass' && Math.random() < 0.3) { // 확률 제한
          decision.action = 'take';
          socialReasons.push(`${targetPlayer.nickname}에게 제한적 복수`);
        }
      }
    }
    
    // 동맹 관계 고려 (더욱 제한적)
    const allies = this.findAllies(players);
    if (allies.length > 0 && decision.action === 'take') {
      const wouldHelpAlly = allies.some(ally => this.wouldPlayerWantCard(ally, currentCard));
      if (wouldHelpAlly && Math.random() < 0.15) { // 확률 대폭 감소
        decision.action = 'pass';
        socialReasons.push('동맹을 위한 제한적 양보');
      }
    }
    
    decision.socialReason = socialReasons.length > 0 ? socialReasons.join(', ') : '관계 변화 없음';
    return decision;
  }

  /**
   * 4단계: 제한된 무작위 요소 추가 - 전략적 결정 보호
   */
  addFinalRandomness(socialDecision, currentCard, pileTokens) {
    // 전략적 결정인 경우 무작위성 완전 제거
    const isStrategicDecision = socialDecision.reason && 
      (socialDecision.reason.includes('견제') || 
       socialDecision.reason.includes('전략적') ||
       socialDecision.reason.includes('절망적_도박') ||
       socialDecision.reason.includes('추격_공세') ||
       socialDecision.reason.includes('중요 위협'));
    
    if (isStrategicDecision) {
      console.log(`   🎯 전략적 결정이므로 무작위성 완전 제거`);
      return socialDecision.action;
    }
    
    const randomThreshold = this.baseTendency.randomness;
    const realCost = this.calculateRealCost(currentCard, pileTokens);
    
    // 매우 명확한 상황에서는 무작위성 제한 - 범위 대폭 축소
    if (realCost <= -1) { // 명확한 이익인 경우 (기준 완화)
      console.log(`   🎲 이익이 명확하므로 무작위성 제한 (${realCost.toFixed(1)}점 이익)`);
      return socialDecision.action;
    }
    
    if (realCost >= 6) { // 명백한 손실인 경우 (기준 대폭 강화: 15점 → 6점)
      console.log(`   🎲 손실이 과도하므로 무작위성 제한 (${realCost.toFixed(1)}점 손실)`);
      return socialDecision.action;
    }
    
    // 매우 애매한 상황(실제손실 -1~6점)에서만 최소한의 무작위성 적용
    const adjustedThreshold = randomThreshold * 0.1; // 무작위성을 10%로 더욱 감소
    
    if (Math.random() < adjustedThreshold) {
      const oppositeAction = socialDecision.action === 'take' ? 'pass' : 'take';
      console.log(`   🎲 제한된 무작위 요소 발동! ${socialDecision.action} → ${oppositeAction} (손실 ${realCost.toFixed(1)}점)`);
      return oppositeAction;
    }
    
    return socialDecision.action;
  }

  /**
   * 감정 상태 업데이트 시스템 - 실제 손실 계산 기반
   */
  updateEmotionsAfterDecision(decision, currentCard, pileTokens) {
    const intensity = this.baseTendency.emotionalIntensity;
    
    if (decision === 'take') {
      // 실제 손실 계산으로 거래 품질 판단
      const realCost = this.calculateRealCost(currentCard, pileTokens);
      console.log(`   💰 감정 업데이트: 실제 손실 ${realCost.toFixed(1)}점 기준으로 판단`);
      
      if (realCost <= 0) {
        // 이익인 경우: 매우 좋은 거래
        this.emotionalState.mood = Math.min(1, this.emotionalState.mood + 0.15 * intensity);
        this.emotionalState.confidence = Math.min(1, this.emotionalState.confidence + 0.1 * intensity);
        this.emotionalState.greed = Math.min(1, this.emotionalState.greed + 0.05 * intensity);
        console.log(`   😍 훌륭한 거래! (${Math.abs(realCost).toFixed(1)}점 이익) 기분 대폭 상승!`);
      } else if (realCost <= 3) {
        // 작은 손실: 괜찮은 거래
        this.emotionalState.mood = Math.min(1, this.emotionalState.mood + 0.05 * intensity);
        this.emotionalState.confidence = Math.min(1, this.emotionalState.confidence + 0.03 * intensity);
        console.log(`   😊 합리적인 거래 (${realCost.toFixed(1)}점 손실)로 약간 기분 상승!`);
      } else if (realCost <= 8) {
        // 중간 손실: 어쩔 수 없는 거래
        this.emotionalState.confidence = Math.max(0, this.emotionalState.confidence - 0.02 * intensity);
        console.log(`   😐 어쩔 수 없는 거래 (${realCost.toFixed(1)}점 손실), 약간 자신감 하락`);
      } else {
        // 큰 손실: 나쁜 거래
        this.emotionalState.mood = Math.max(0, this.emotionalState.mood - 0.1 * intensity);
        this.emotionalState.frustration = Math.min(1, this.emotionalState.frustration + 0.15 * intensity);
        this.emotionalState.confidence = Math.max(0, this.emotionalState.confidence - 0.05 * intensity);
        console.log(`   😞 손해가 큰 거래 (${realCost.toFixed(1)}점 손실)로 기분과 자신감 하락...`);
      }
    } else {
      // 패스 결정 - 실제 손실을 고려하여 평가
      const realCost = this.calculateRealCost(currentCard, pileTokens);
      
      if (realCost > 5) {
        // 큰 손실을 피한 현명한 패스
        this.emotionalState.confidence = Math.min(1, this.emotionalState.confidence + 0.03 * intensity);
        console.log(`   🤓 현명한 패스! (${realCost.toFixed(1)}점 손실 회피) 자신감 상승`);
      } else if (realCost <= 0) {
        // 이익을 놓친 아쉬운 패스
        this.emotionalState.frustration = Math.min(1, this.emotionalState.frustration + 0.05 * intensity);
        console.log(`   😤 아쉬운 패스... (${Math.abs(realCost).toFixed(1)}점 이익 놓침) 약간 좌절`);
      } else {
        // 일반적인 패스
        this.emotionalState.confidence = Math.max(0, this.emotionalState.confidence - 0.01 * intensity);
        console.log(`   🤔 일반적인 패스 (${realCost.toFixed(1)}점 손실 회피), 약간의 자신감 하락`);
      }
    }
    
    // 감정 상태 출력
    console.log(`   감정 변화: 기분 ${this.emotionalState.mood.toFixed(2)}, 자신감 ${this.emotionalState.confidence.toFixed(2)}, 좌절 ${this.emotionalState.frustration.toFixed(2)}`);
  }

  /**
   * 상황 학습 시스템 - 관찰 가능한 정보만 활용
   */
  learnFromSituation(currentCard, pileTokens, players, myDecision) {
    // 다른 플레이어들의 **관찰 가능한** 패턴 학습
    for (const player of players) {
      if (player.id === this.id || player.isBot) continue;
      
      if (!this.playerRelations[player.id]) {
        this.playerRelations[player.id] = {
          rivalry: 0,
          trust: 0.5,
          observedPatterns: []
        };
      }
    }
    
    // 내 결정 기록
    this.gameEvents.push({
      type: 'decision',
      card: currentCard,
      tokens: pileTokens,
      myDecision,
      timestamp: Date.now()
    });
    
    // 메모리 최적화: 최근 15개 이벤트만 유지
    const MAX_EVENTS = 15;
    if (this.gameEvents.length > MAX_EVENTS) {
      this.gameEvents = this.gameEvents.slice(-MAX_EVENTS);
    }
  }
  
  /**
   * 다른 플레이어의 행동 관찰 및 학습
   */
  observePlayerAction(playerId, action, card, tokens) {
    if (!this.playerRelations[playerId]) {
      this.playerRelations[playerId] = {
        rivalry: 0,
        trust: 0.5,
        observedPatterns: []
      };
    }
    
    // 관찰된 행동 패턴 기록
    this.playerRelations[playerId].observedPatterns.push({
      type: action, // 'take' or 'pass'
      card: card,
      tokens: tokens,
      timestamp: Date.now()
    });
    
    // 메모리 최적화: 최근 20개 패턴만 유지
    const MAX_PATTERNS = 20;
    if (this.playerRelations[playerId].observedPatterns.length > MAX_PATTERNS) {
      this.playerRelations[playerId].observedPatterns = 
        this.playerRelations[playerId].observedPatterns.slice(-MAX_PATTERNS);
    }
    
    console.log(`   👁️ ${this.nickname}: ${playerId}의 행동 관찰 - ${action} (카드: ${card}, 토큰: ${tokens})`);
  }

  /**
   * 특정 이벤트에 대한 감정적 반응
   */
  reactToEvent(eventType, details) {
    const intensity = this.baseTendency.emotionalIntensity;
    
    switch (eventType) {
      case 'someone_took_my_card':
        this.emotionalState.vengeful = Math.min(1, this.emotionalState.vengeful + 0.3 * intensity);
        this.emotionalState.frustration = Math.min(1, this.emotionalState.frustration + 0.2 * intensity);
        if (details.playerId) {
          this.increaseRivalry(details.playerId, 0.2);
        }
        console.log(`😡 ${this.nickname}: ${details.playerName}이(가) 내 카드를 가져갔다! 복수심 상승!`);
        break;
        
      case 'got_overtaken':
        this.emotionalState.competitiveness = Math.min(1, this.emotionalState.competitiveness + 0.2 * intensity);
        this.emotionalState.frustration = Math.min(1, this.emotionalState.frustration + 0.15 * intensity);
        console.log(`😤 ${this.nickname}: 추월당했다! 승부욕 불타오른다!`);
        break;
        
      case 'consecutive_bad_cards':
        this.emotionalState.confidence = Math.max(0, this.emotionalState.confidence - 0.2 * intensity);
        this.emotionalState.mood = Math.max(0, this.emotionalState.mood - 0.15 * intensity);
        console.log(`😔 ${this.nickname}: 계속 나쁜 카드만... 기분이 안 좋아진다`);
        break;
        
      case 'winning_streak':
        this.emotionalState.confidence = Math.min(1, this.emotionalState.confidence + 0.2 * intensity);
        this.emotionalState.mood = Math.min(1, this.emotionalState.mood + 0.15 * intensity);
        this.emotionalState.greed = Math.min(1, this.emotionalState.greed + 0.1 * intensity);
        console.log(`😎 ${this.nickname}: 연승 중이다! 더 노려봐야지!`);
        break;
    }
  }

  // === 게임 상황 분석 시스템 ===
  
  /**
   * 게임 상황을 종합적으로 분석
   */
  analyzeGameSituation(gameState) {
    const { players, deckSize, removedCount } = gameState;
    
    // 1. 게임 진행도 분석
    const totalCards = 33; // 카드 3~35
    const cardsDealt = totalCards - removedCount - deckSize;
    const gameProgress = cardsDealt / (totalCards - removedCount); // 0~1
    
    // 2. 순위 및 점수 차이 분석
    const scores = players.map(p => ({
      id: p.id,
      nickname: p.nickname,
      score: this.calculatePlayerScore(p),
      tokens: p.tokens || 0,
      isBot: p.isBot || false
    })).sort((a, b) => a.score - b.score);
    
    const myRank = scores.findIndex(s => s.id === this.id) + 1;
    const totalPlayers = scores.length;
    const myScore = scores.find(s => s.id === this.id).score;
    
    // 3. 상대방들과의 점수 차이
    const leader = scores[0];
    const lastPlace = scores[scores.length - 1];
    const pointsFromLead = myScore - leader.score;
    const pointsFromLast = lastPlace.score - myScore;
    
    // 4. 칩 상황 분석
    const myTokens = this.tokens;
    const avgTokens = players.reduce((sum, p) => sum + (p.tokens || 0), 0) / players.length;
    const tokenAdvantage = myTokens - avgTokens;
    
    // 5. 위험도 평가
    const remainingCardsRisk = this.assessRemainingCardsRisk(deckSize);
    
    // 6. 상대방 위험도 분석
    const opponentAnalysis = this.analyzeOpponents(scores, gameProgress);
    
    const analysis = {
      gameProgress,          // 0~1: 게임 진행도
      myRank,               // 1~N: 내 순위
      totalPlayers,         // 총 플레이어 수
      pointsFromLead,       // 1등과의 점수 차이 (음수면 내가 앞서고 있음)
      pointsFromLast,       // 꼴등과의 점수 차이 (양수면 내가 앞서고 있음)
      tokenAdvantage,       // 평균 대비 칩 우위 (양수면 많이 보유)
      remainingCardsRisk,   // 남은 카드들의 위험도
      isLeading: myRank === 1,
      isLastPlace: myRank === totalPlayers,
      isCloseGame: Math.abs(pointsFromLead) <= 5, // 접전 여부
      scores,
      opponentAnalysis      // 상대방 위험도 분석 결과
    };
    
    console.log(`📊 ${this.nickname} 상황 분석:`);
    console.log(`   진행도: ${(gameProgress * 100).toFixed(0)}%, 순위: ${myRank}/${totalPlayers}`);
    console.log(`   점수차: 1등과 ${pointsFromLead > 0 ? '+' : ''}${pointsFromLead}점, 꼴등과 ${pointsFromLast > 0 ? '+' : ''}${pointsFromLast}점`);
    console.log(`   칩 우위: ${tokenAdvantage > 0 ? '+' : ''}${tokenAdvantage.toFixed(1)}개`);
    
    if (opponentAnalysis.primaryThreat) {
      console.log(`   🚨 주요 위협: ${opponentAnalysis.primaryThreat.nickname} (위험도: ${opponentAnalysis.primaryThreat.riskLevel})`);
    }
    
    return analysis;
  }
  
  /**
   * 상대방들의 위험도를 분석하고 견제 대상을 결정
   */
  analyzeOpponents(scores, gameProgress) {
    const opponents = scores.filter(s => s.id !== this.id);
    const myScore = scores.find(s => s.id === this.id).score;
    
    // 각 상대방의 위험도 계산
    const opponentRisks = opponents.map(opponent => {
      let riskScore = 0;
      let riskFactors = [];
      
      // 1. 순위 위험도 (1등이거나 1등에 가까운 경우)
      if (opponent.score <= scores[0].score) {
        riskScore += 30; // 1등이면 높은 위험도
        riskFactors.push('현재 1등');
      } else if (opponent.score - scores[0].score <= 3) {
        riskScore += 20; // 1등과 근소한 차이
        riskFactors.push('1등 근접');
      }
      
      // 2. 나와의 점수 차이 위험도
      const scoreDiff = opponent.score - myScore;
      if (scoreDiff < -8) {
        riskScore += 25; // 나보다 8점 이상 앞서면 매우 위험
        riskFactors.push(`${Math.abs(scoreDiff)}점 앞섬`);
      } else if (scoreDiff < -3) {
        riskScore += 15; // 나보다 3점 이상 앞서면 위험
        riskFactors.push(`${Math.abs(scoreDiff)}점 앞섬`);
      } else if (scoreDiff > 0 && scoreDiff <= 5) {
        riskScore += 10; // 나보다 뒤처져 있지만 근소한 차이
        riskFactors.push('근소한 차이로 뒤처짐');
      }
      
      // 3. 칩 보유량 위험도
      const avgTokens = scores.reduce((sum, s) => sum + s.tokens, 0) / scores.length;
      if (opponent.tokens > avgTokens + 3) {
        riskScore += 15; // 평균보다 칩이 많으면 위험
        riskFactors.push(`칩 ${(opponent.tokens - avgTokens).toFixed(1)}개 우위`);
      }
      
      // 4. 게임 진행도에 따른 위험도 조정
      if (gameProgress > 0.7) {
        // 후반에는 순위가 더 중요
        riskScore *= 1.3;
      } else if (gameProgress < 0.3) {
        // 초반에는 칩 보유량이 더 중요
        if (opponent.tokens > avgTokens + 2) {
          riskScore += 10;
        }
      }
      
      // 5. 최근 행동 패턴 분석 (관찰된 데이터 기반)
      const recentPattern = this.analyzeOpponentPattern(opponent.id);
      if (recentPattern.isAggressive) {
        riskScore += 10;
        riskFactors.push('공격적 플레이');
      }
      
      // 위험도 레벨 결정
      let riskLevel;
      if (riskScore >= 50) riskLevel = 'critical';
      else if (riskScore >= 30) riskLevel = 'high';
      else if (riskScore >= 15) riskLevel = 'medium';
      else riskLevel = 'low';
      
      return {
        ...opponent,
        riskScore,
        riskLevel,
        riskFactors,
        shouldBlock: riskScore >= 30 // 위험도 30 이상이면 견제 고려
      };
    });
    
    // 위험도순으로 정렬
    opponentRisks.sort((a, b) => b.riskScore - a.riskScore);
    
    // 주요 위협 대상 결정
    const primaryThreat = opponentRisks.length > 0 && opponentRisks[0].riskScore >= 25 
      ? opponentRisks[0] : null;
    
    return {
      opponents: opponentRisks,
      primaryThreat,
      shouldUseBlockingStrategy: !!primaryThreat,
      blockingIntensity: primaryThreat ? Math.min(primaryThreat.riskScore / 50, 1) : 0
    };
  }
  
  /**
   * 특정 상대방의 최근 행동 패턴 분석
   */
  analyzeOpponentPattern(opponentId) {
    const relation = this.playerRelations[opponentId];
    if (!relation || !relation.observedPatterns || relation.observedPatterns.length < 2) {
      return { isAggressive: false, confidence: 'low' };
    }
    
    const recentActions = relation.observedPatterns.slice(-3);
    const takeCount = recentActions.filter(action => action.type === 'take').length;
    const avgCardValue = recentActions
      .filter(action => action.type === 'take')
      .reduce((sum, action) => sum + action.card, 0) / takeCount;
    
    // 공격적 플레이 판단: 높은 카드를 자주 가져가거나, take 비율이 높은 경우
    const isAggressive = (takeCount / recentActions.length > 0.7) || 
                        (takeCount > 0 && avgCardValue > 20);
    
    return {
      isAggressive,
      takeRatio: takeCount / recentActions.length,
      avgCardValue: takeCount > 0 ? avgCardValue : 0,
      confidence: recentActions.length >= 3 ? 'high' : 'medium'
    };
  }
  
  /**
   * 남은 카드들의 위험도 평가
   */
  assessRemainingCardsRisk(deckSize) {
    // 덱에 남은 카드 수가 적을수록 위험도 증가
    if (deckSize <= 3) return 'very_high';
    if (deckSize <= 6) return 'high';
    if (deckSize <= 12) return 'medium';
    return 'low';
  }
  
  // === 도우미 메서드들 ===
  
  hasConnection(currentCard) {
    return this.hasDirectConnection(currentCard) || this.hasIndirectConnection(currentCard);
  }
  
  isCurrentlyLeading(players) {
    const myScore = this.calculateCurrentScore();
    return players.every(p => p.id === this.id || this.calculatePlayerScore(p) >= myScore);
  }
  
  wouldPlayerWantCard(player, currentCard) {
    if (!player || !player.id) return false;
    
    // 봇 vs 봇인 경우: 실제 카드 정보로 정확한 판단
    if (player.isBot && player.cards) {
      // 직접 연결이 있으면 높은 확률로 원함
      const hasDirectConnection = player.cards.some(card => Math.abs(card - currentCard) === 1);
      if (hasDirectConnection) return true;
      
      // 간접 연결이 있으면 중간 확률로 원함
      const hasIndirectConnection = player.cards.some(card => Math.abs(card - currentCard) === 2);
      if (hasIndirectConnection) return Math.random() < 0.6;
      
      // 낮은 가치 카드는 일반적으로 원함
      if (currentCard <= 12) return Math.random() < 0.4;
      return Math.random() < 0.2;
    }
    
    // 인간 플레이어인 경우: 관찰된 행동 패턴과 게임 진행 상황으로 추측
    // 1. 해당 플레이어가 최근에 비슷한 카드를 가져갔는지 확인
    const recentActions = this.playerRelations[player.id]?.observedPatterns || [];
    const recentTakes = recentActions.filter(action => action.type === 'take').slice(-3);
    
    // 2. 가져간 카드들로부터 패턴 추측
    if (recentTakes.length > 0) {
      const takenCards = recentTakes.map(action => action.card);
      const hasNearbyCard = takenCards.some(card => Math.abs(card - currentCard) <= 3);
      
      if (hasNearbyCard) {
        console.log(`   🔍 ${player.nickname}이(가) 최근 ${takenCards.join(',')} 카드를 가져가서 ${currentCard}를 원할 가능성 높음`);
        return true;
      }
    }
    
    // 3. 일반적인 카드 가치 기준으로 추측 (낮은 카드는 누구나 원함)
    if (currentCard <= 10) {
      return Math.random() < 0.7; // 70% 확률로 원한다고 가정
    } else if (currentCard <= 20) {
      return Math.random() < 0.4; // 40% 확률
    } else {
      return Math.random() < 0.2; // 20% 확률
    }
  }
  
  findVengefulTarget(players) {
    for (const player of players) {
      if (this.playerRelations[player.id]?.rivalry > 0.5) {
        return player;
      }
    }
    return null;
  }
  
  findAllies(players) {
    return players.filter(player => 
      this.playerRelations[player.id]?.trust > 0.7
    );
  }
  
  increaseRivalry(playerId, amount) {
    if (!this.playerRelations[playerId]) {
      this.playerRelations[playerId] = { rivalry: 0, trust: 0.5, observedPatterns: [] };
    }
    this.playerRelations[playerId].rivalry = Math.min(1, this.playerRelations[playerId].rivalry + amount);
  }

  calculateCurrentScore() {
    if (!this.cards || this.cards.length === 0) return 0;
    
    const sortedCards = [...this.cards].sort((a, b) => a - b);
    let score = 0;
    let i = 0;
    
    while (i < sortedCards.length) {
      score += sortedCards[i];
      while (i + 1 < sortedCards.length && sortedCards[i + 1] === sortedCards[i] + 1) {
        i++;
      }
      i++;
    }
    
    return score - this.tokens;
  }
  
  calculatePlayerScore(player) {
    if (!player.cards || player.cards.length === 0) return 0;
    
    const sortedCards = [...player.cards].sort((a, b) => a - b);
    let score = 0;
    let i = 0;
    
    while (i < sortedCards.length) {
      score += sortedCards[i];
      while (i + 1 < sortedCards.length && sortedCards[i + 1] === sortedCards[i] + 1) {
        i++;
      }
      i++;
    }
    
    return score - (player.tokens || 0);
  }

  // === 게임 상태 관리 ===
  
  addCard(cardNumber, tokens) {
    this.cards.push(cardNumber);
    this.tokens += tokens;
    
    console.log(`📥 ${this.nickname}: 카드 ${cardNumber} 획득 (+${tokens} 토큰)`);
  }
  
  spendToken() {
    if (this.tokens > 0) {
      this.tokens--;
      console.log(`💰 ${this.nickname}: 토큰 사용 (남은 토큰: ${this.tokens})`);
      return true;
    }
    return false;
  }
  
  reset() {
    this.tokens = 11;
    this.cards = [];
    this.gameEvents = [];
    this.playerRelations = {};
    
    // 감정 상태 초기화 (완전 리셋이 아닌 약간의 변화)
    this.emotionalState = {
      mood: Math.random() * 0.4 + 0.3,
      confidence: Math.random() * 0.4 + 0.3,
      competitiveness: Math.random() * 0.6 + 0.2,
      frustration: 0,
      greed: Math.random() * 0.4 + 0.3,
      vengeful: 0
    };
    
    console.log(`🔄 ${this.nickname}: 게임 리셋 완료`);
  }
  
  getState() {
    return {
      id: this.id,
      nickname: this.nickname,
      tokens: this.tokens,
      cards: this.cards,
      isBot: this.isBot,
      difficulty: this.difficulty,
      score: this.calculateCurrentScore(),
      // 디버깅용 감정 상태 (개발 중에만)
      emotions: this.emotionalState
    };
  }
  
  /**
   * 현재 AI 상태 요약 (디버깅용)
   */
  getDebugInfo() {
    return {
      nickname: this.nickname,
      difficulty: this.difficulty,
      emotions: this.emotionalState,
      relations: this.playerRelations,
      recentEvents: this.gameEvents.slice(-3)
    };
  }
}

module.exports = Bot;