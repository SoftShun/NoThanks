// @ts-nocheck
/*
 * [이식본] master 브랜치 server/bot.js 를 그대로 옮긴 파일입니다.
 * 변경점(로직 불변):
 *   1) require('./crypto-random') → import { CryptoRandom } from './rng' (테스트용 시드 주입 가능)
 *   2) console.log / console.error 디버그 출력 제거
 *   3) module.exports → export default
 * 의사결정 로직·수치·확률은 원본과 동일합니다. 수정 금지 — 원본이 바뀌면 다시 이식하세요.
 */
/*
 * AI 봇 시스템 for No Thanks! 게임 - 완전 재설계 버전
 * 
 * 핵심 개념: 감정 기반 인간다운 AI
 * - 복잡한 계산 대신 감정과 직감 중심
 * - 실시간으로 변화하는 성격과 관계
 * - 플레이어가 체감할 수 있는 명확한 차이
 */

import { CryptoRandom } from './rng';

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
      mood: CryptoRandom.enhancedRandom() * 0.4 + 0.3,        // 0.3~0.7 (시작시 중간 정도)
      confidence: CryptoRandom.enhancedRandom() * 0.4 + 0.3,   // 자신감
      competitiveness: CryptoRandom.enhancedRandom() * 0.6 + 0.2, // 승부욕
      frustration: 0,                           // 좌절감 (시작시 0)
      greed: CryptoRandom.enhancedRandom() * 0.4 + 0.3,       // 욕심
      vengeful: 0                               // 복수심 (시작시 0)
    };
    
    // === 플레이어 관계 및 학습 시스템 ===
    this.playerRelations = {}; // { playerId: { rivalry, trust, pattern } }
    this.gameEvents = [];      // 최근 중요 이벤트들
    this.personalityMemory = []; // 성격 변화 기록
    
    // === 난이도별 기본 성향 ===
    this.baseTendency = this.initializeTendency(difficulty);
    
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
      const { currentCard, pileTokens, players, isCurrentCardHidden } = gameState;
      
      // 입력 유효성 검사
      if (typeof currentCard !== 'number' || typeof pileTokens !== 'number' || !Array.isArray(players)) {
        return 'pass'; // 안전한 기본값
      }
      
      // 히든 카드 처리
      if (isCurrentCardHidden) {
        return this.makeHiddenCardDecision(currentCard, pileTokens, gameState);
      }
      
      
      // 1. 기본 전략적 판단 (30%)
      const basicDecision = this.makeBasicDecision(currentCard, pileTokens, gameState);
      
      // 2. 감정 상태 적용 (40%) - 전략 시스템과 통합
      const emotionalDecision = this.applyEmotionalFactors(basicDecision, currentCard, pileTokens, players, gameState);
      
      // 3. 플레이어 관계 고려 (20%) - 전략 시스템과 통합
      const socialDecision = this.considerPlayerRelations(emotionalDecision, currentCard, players, gameState);
      
      // 4. 최종 무작위 요소 (제한적)
      const finalDecision = this.addFinalRandomness(socialDecision, currentCard, pileTokens);
      
      // 5. 결정 후 감정 변화 및 학습
      this.updateEmotionsAfterDecision(finalDecision, currentCard, pileTokens);
      this.learnFromSituation(currentCard, pileTokens, players, finalDecision);
      
      // 최종 유효성 검사
      if (finalDecision !== 'take' && finalDecision !== 'pass') {
        return 'pass';
      }
      
      return finalDecision;
      
    } catch (error) {
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
    
    // 실제 손실 계산 (삭제된 카드 정보 포함)
    const removedCards = gameState.removedCards || [];
    const realCost = this.calculateRealCost(currentCard, pileTokens, removedCards);
    
    // 게임 상황 분석
    const situation = this.analyzeGameSituation(gameState);
    
    // 동적 전략 선택
    const strategy = this.selectStrategy(situation, currentCard, pileTokens, realCost);
    
    // 전략에 따른 의사결정
    const decision = this.executeStrategy(strategy, currentCard, pileTokens, realCost, situation);
    
    return decision;
  }
  
  /**
   * 상황에 맞는 최적 전략 선택
   */
  selectStrategy(situation, currentCard, pileTokens, realCost) {
    try {
      // 입력 유효성 검사
      if (!situation || typeof currentCard !== 'number' || typeof pileTokens !== 'number') {
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
    
    // === 1. 게임 단계별 기본 전략 - 1등 목표 강화 ===
    
    // 초반 전략 (0-30% 진행) - 1등을 위한 초반 기반 구축
    if (gameProgress < 0.3) {
      // 꼴찌 근처에 있다면 더 적극적인 플레이
      if (myRank >= Math.ceil(situation.totalPlayers * 0.7)) {
        return {
          name: '초반_꼴찌탈출',
          description: '꼴찌 탈출을 위한 적극적 플레이',
          riskTolerance: 1.0,
          chipValue: 1.5,
          connectionBonus: 1.4
        };
      } else if (tokenAdvantage < -3) {
        return {
          name: '초반_칩파밍',
          description: '1등을 위한 칩 확보 우선',
          riskTolerance: 0.8, // 더 적극적으로
          chipValue: 2.0, // 칩의 가치를 더 높게 평가
          connectionBonus: 1.0
        };
      } else if (this.cards.length <= 1) {
        return {
          name: '초반_빌드업',
          description: '1등을 위한 적극적 빌드업',
          riskTolerance: 0.9, // 더 적극적으로
          chipValue: 1.4,
          connectionBonus: 1.5,
          buildupMode: true // 빌드업 모드 활성화
        };
      } else {
        return {
          name: '초반_선별적',
          description: '1등을 위한 선택적 플레이',
          riskTolerance: 0.6, // 조금 더 적극적으로
          chipValue: 1.3,
          connectionBonus: 1.3
        };
      }
    }
    
    // 후반 전략 (70%+ 진행) - 1등 확정 또는 꼴찌 회피
    if (gameProgress >= 0.7) {
      if (isLastPlace && pointsFromLast > 8) {
        return {
          name: '후반_절망적_도박',
          description: '꼴찌 탈출을 위한 필사적 도박',
          riskTolerance: 2.5, // 더 과감하게
          chipValue: 0.6,
          connectionBonus: 0.8
        };
      } else if (isLastPlace && pointsFromLast > 3) {
        return {
          name: '후반_꼴찌탈출',
          description: '꼴찌 회피를 위한 적극적 플레이',
          riskTolerance: 1.5,
          chipValue: 0.8,
          connectionBonus: 1.2
        };
      } else if (isLeading && pointsFromLead < -5) {
        return {
          name: '후반_1등확정',
          description: '1등 확정을 위한 안전한 플레이',
          riskTolerance: 0.2, // 매우 보수적
          chipValue: 1.5,
          connectionBonus: 1.2
        };
      } else if (myRank === 1 || pointsFromLead <= 3) {
        return {
          name: '후반_1등경쟁',
          description: '1등 경쟁을 위한 전략적 플레이',
          riskTolerance: 0.7,
          chipValue: 1.1,
          connectionBonus: 1.3
        };
      } else if (!isLeading && pointsFromLead <= 8) {
        return {
          name: '후반_1등추격',
          description: '1등 추격을 위한 공격적 플레이',
          riskTolerance: 1.3, // 더 적극적으로
          chipValue: 0.8,
          connectionBonus: 1.4
        };
      } else {
        return {
          name: '후반_순위유지',
          description: '현재 순위 유지 플레이',
          riskTolerance: 0.7,
          chipValue: 1.0,
          connectionBonus: 1.2
        };
      }
    }
    
    // === 2. 중반 상황별 전략 (30-70% 진행) - 1등 목표 중심 ===
    
    // 꼴찌 위험 상황 - 최우선 처리
    if (myRank >= Math.ceil(situation.totalPlayers * 0.8)) {
      return {
        name: '중반_꼴찌위험',
        description: '꼴찌 위험 - 즉시 탈출 필요',
        riskTolerance: 1.2,
        chipValue: 0.9,
        connectionBonus: 1.3
      };
    }
    
    // 1등 상황
    if (isLeading) {
      if (pointsFromLead < -3) {
        return {
          name: '중반_1등유지',
          description: '1등 우위 유지',
          riskTolerance: 0.4,
          chipValue: 1.3,
          connectionBonus: 1.1
        };
      } else {
        return {
          name: '중반_1등불안',
          description: '1등이지만 불안정 - 신중하게',
          riskTolerance: 0.5,
          chipValue: 1.2,
          connectionBonus: 1.2
        };
      }
    }
    
    // 1등 경쟁권 (2-3등)
    if (myRank <= 3 && pointsFromLead <= 5) {
      if (tokenAdvantage > 2) {
        return {
          name: '중반_1등도전_칩우위',
          description: '1등 도전 - 칩 우위 활용',
          riskTolerance: 0.9,
          chipValue: 0.8, // 칩 우위가 있으니 적극 사용
          connectionBonus: 1.3
        };
      } else {
        return {
          name: '중반_1등도전',
          description: '1등 도전을 위한 균형잡힌 플레이',
          riskTolerance: 0.7,
          chipValue: 1.1,
          connectionBonus: 1.2
        };
      }
    }
    
    // 중위권에서 추격
    if (myRank >= Math.ceil(situation.totalPlayers * 0.4)) {
      return {
        name: '중반_상위추격',
        description: '상위권 진입을 위한 적극적 플레이',
        riskTolerance: 1.0,
        chipValue: 0.9,
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
   * 빌드업 전략 실행 - 삭제된 카드 고려한 똑똑한 빌드업
   */
  executeBuildupStrategy(currentCard, pileTokens, strategicCost, strategicMaxLoss, situation) {
    const { cardAvailability } = situation;
    
    // 1. 괜찮은 숫자(낮은 카드) 우선 수집
    if (currentCard <= 15) {
      const buildupLimit = strategicMaxLoss + 6; // 낮은 카드는 더 관대하게
      if (strategicCost <= buildupLimit) {
        return { action: 'take', reason: `빌드업_낮은카드 (${currentCard}≤15, ${strategicCost.toFixed(1)}점)` };
      }
    }
    
    // 2. 높은 카드 위험 감수 전략 - 미래 연결 가능성 고려
    if (currentCard >= 25 && cardAvailability) {
      const futureConnectionValue = this.analyzeFutureConnections(currentCard, cardAvailability);
      if (futureConnectionValue > 0) {
        const highCardLimit = strategicMaxLoss + futureConnectionValue + 3; // 미래 가치 반영
        if (strategicCost <= highCardLimit) {
          return { action: 'take', reason: `빌드업_고카드투자 (${currentCard}≥25, 미래가치${futureConnectionValue.toFixed(1)}점)` };
        }
      }
    }
    
    // 3. 상대방 간섭 최소화 - 상대방이 원하지 않는 카드 우선
    const opponentInterference = this.calculateOpponentInterference(currentCard, situation.players);
    if (opponentInterference.isLowInterference) {
      const safetyLimit = strategicMaxLoss + 2; // 간섭이 적으면 약간 더 관대
      if (strategicCost <= safetyLimit) {
        return { action: 'take', reason: `빌드업_간섭최소 (상대방 관심도 낮음, ${strategicCost.toFixed(1)}점)` };
      }
    }
    
    // 4. 카드 부족 시 적극적 수집
    if (this.cards.length === 0 && currentCard <= 28) {
      const desperateLimit = strategicMaxLoss + 8; // 카드가 없으면 매우 관대
      if (strategicCost <= desperateLimit) {
        return { action: 'take', reason: `빌드업_급구 (카드0개, ${strategicCost.toFixed(1)}점)` };
      }
    }
    
    return null; // 빌드업 조건에 맞지 않음
  }
  
  /**
   * 미래 연결 가능성 분석 - 높은 카드의 투자 가치 계산
   */
  analyzeFutureConnections(currentCard, cardAvailability) {
    if (!cardAvailability || !cardAvailability.connectionRisks) {
      return 0;
    }
    
    let futureValue = 0;
    const adjacentCards = [currentCard - 1, currentCard + 1];
    
    adjacentCards.forEach(adjacentCard => {
      if (adjacentCard >= 3 && adjacentCard <= 35) {
        const riskInfo = cardAvailability.connectionRisks.get(adjacentCard);
        if (riskInfo) {
          // 연결 위험도가 낮을수록 미래 가치 높음
          const connectionProbability = 1 - riskInfo.risk; // 0~1
          futureValue += adjacentCard * connectionProbability * 0.3; // 미래 가치 계수
        }
      }
    });
    
    // 높은 카드일수록 연결시 더 큰 절약 효과
    if (currentCard >= 30) {
      futureValue *= 1.5; // 30+ 카드는 1.5배 가치
    }
    
    return futureValue;
  }
  
  /**
   * 상대방 간섭도 계산 - 상대방이 얼마나 원하는 카드인지
   */
  calculateOpponentInterference(currentCard, players) {
    const opponents = players.filter(p => p.id !== this.id);
    let totalInterference = 0;
    let interferingOpponents = 0;
    
    opponents.forEach(opponent => {
      let wantLevel = 0;
      
      if (opponent.isBot && opponent.cards) {
        // 봇의 경우 실제 카드로 정확히 계산
        const hasConnection = opponent.cards.some(card => 
          Math.abs(card - currentCard) <= 2
        );
        if (hasConnection) {
          wantLevel = Math.abs(opponent.cards.find(card => 
            Math.abs(card - currentCard) <= 2
          ) - currentCard) === 1 ? 3 : 1;
        }
      } else {
        // 인간 플레이어의 경우 추정
        wantLevel = this.estimateHumanPlayerWant(opponent, currentCard);
      }
      
      if (wantLevel > 0) {
        totalInterference += wantLevel;
        interferingOpponents++;
      }
    });
    
    const avgInterference = interferingOpponents > 0 ? totalInterference / interferingOpponents : 0;
    
    return {
      totalInterference,
      avgInterference,
      interferingOpponents,
      isLowInterference: avgInterference <= 1 && interferingOpponents <= 1,
      isHighInterference: avgInterference >= 2 || interferingOpponents >= 2
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
    
    
    // 전략적 의사결정
    
    // 1. 명백한 이익인 경우
    if (strategicCost <= 0) {
      return { action: 'take', reason: `전략적 이익 (${Math.abs(strategicCost).toFixed(1)}점 득, ${strategy.name})` };
    }
    
    // 2. 상대방 카드 경쟁 분석 - 우선순위 최상위
    const competitionAnalysis = this.analyzeCardCompetition(currentCard, situation.players);
    
    if (competitionAnalysis.shouldForceTake) {
      // 경쟁이 치열한 카드는 손실을 감수하고라도 가져가야 함
      const competitionLimit = strategicMaxLoss + competitionAnalysis.competitionBonus;
      if (strategicCost <= competitionLimit) {
        return { action: 'take', reason: `경쟁차단 (${strategicCost.toFixed(1)}점, ${competitionAnalysis.reason})` };
      }
    }
    
    if (competitionAnalysis.shouldAvoidTake) {
      // 상대방에게 너무 유리한 카드는 가져가지 않음
      return { action: 'pass', reason: `상대이익방지 (${competitionAnalysis.reason})` };
    }
    
    // 3. 칩이 많이 쌓인 경우 특별 처리 (초반 빌드업 고려)
    if (pileTokens >= 8) {
      // 칩이 8개 이상이면 더 관대한 기준 적용
      const chipBonusLimit = strategicMaxLoss + Math.min(pileTokens * 0.5, 8); // 칩에 따른 추가 허용
      if (strategicCost <= chipBonusLimit) {
        return { action: 'take', reason: `고칩보상 (${strategicCost.toFixed(1)}점, 칩${pileTokens}개로 ${chipBonusLimit.toFixed(1)}점까지 허용)` };
      }
    }
    
    // 3. 초반 게임에서의 빌드업 전략 - 개선된 버전
    if (strategy.buildupMode || (situation.gameProgress < 0.4 && this.cards.length <= 2)) {
      const buildupDecision = this.executeBuildupStrategy(currentCard, pileTokens, strategicCost, strategicMaxLoss, situation);
      if (buildupDecision) {
        return buildupDecision;
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
  calculateRealCost(currentCard, pileTokens, removedCards = []) {
    const baseCost = currentCard; // 기본 손실 = 카드 점수
    const connectionBonus = this.getConnectionBonus(currentCard, removedCards); // 연결 보너스 (삭제된 카드 고려)
    const chipGain = pileTokens; // 칩 이득
    
    return baseCost - connectionBonus - chipGain;
  }
  
  /**
   * 정확한 연결 보너스 계산 - 실제 점수 차이 기반 + 삭제된 카드 고려
   */
  getConnectionBonus(currentCard, removedCards = []) {
    try {
      // 입력 유효성 검사
      if (typeof currentCard !== 'number') {
        return 0;
      }
      
      // 연결 보너스 계산: 카드를 가져가지 않으면 currentCard점만큼 손해
      // 하지만 연결이 있으면 실제 증가하는 점수는 더 적음
      
      // 새 카드를 추가한 임시 카드 목록 생성
      const tempCards = [...this.cards, currentCard];
      
      // 현재 카드만으로 계산한 순수 점수 + 새 카드 점수
      const currentPureCardScore = this.calculatePlayerScore({ cards: this.cards, tokens: 0 });
      const rawCardValue = currentCard; // 가져가지 않으면 이만큼 점수 증가
      
      // 새 카드 추가 후 실제 증가하는 점수
      const newPureCardScore = this.calculatePlayerScore({ cards: tempCards, tokens: 0 });
      const actualIncrease = newPureCardScore - currentPureCardScore;
      
      // 연결 보너스 = 명목 가치 - 실제 증가량
      const connectionSavings = rawCardValue - actualIncrease;
      
      // 연결 정보 분석 및 로깅
      const directConnections = this.cards.filter(card => Math.abs(card - currentCard) === 1);
      const indirectConnections = this.cards.filter(card => Math.abs(card - currentCard) === 2);
      
      let connectionInfo = [];
      let finalBonus = Math.max(0, connectionSavings);
      
      if (directConnections.length > 0) {
        connectionInfo.push(`직접연결: ${directConnections.join(',')}`);
      }
      
      if (indirectConnections.length > 0) {
        // 간접 연결의 가치 계산 - 삭제된 카드 고려
        let indirectBonus = Math.min(connectionSavings * 0.1, currentCard * 0.05);
        
        // 삭제된 카드 정보가 있으면 간접 연결의 위험도 조정
        if (removedCards.length > 0) {
          indirectConnections.forEach(indirectCard => {
            const bridgeCard = (indirectCard + currentCard) / 2;
            // 중간 카드가 삭제되었으면 간접 연결 가치 대폭 하락
            if (Number.isInteger(bridgeCard) && removedCards.includes(bridgeCard)) {
              indirectBonus *= 0.2; // 80% 감소
              connectionInfo.push(`간접연결 위험: ${bridgeCard} 삭제됨`);
            }
          });
        }
        
        connectionInfo.push(`간접연결: ${indirectConnections.join(',')} (${indirectBonus.toFixed(1)}점 추가)`);
        finalBonus = Math.max(0, connectionSavings + indirectBonus);
      }
      
      if (connectionInfo.length > 0) {
      }
      
      return finalBonus;
      
    } catch (error) {
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
    
    // 전략적 결정이 견제 전략인 경우 감정 영향을 제한
    const isStrategicBlocking = basicDecision.reason && basicDecision.reason.includes('견제');
    if (isStrategicBlocking) {
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
        if (CryptoRandom.enhancedRandom() < chance) {
          decision.action = 'take';
          emotionalReasons.push('기분 좋아서 약간 과감');
        }
      }
    }
    
    // === 기분이 나쁠 때 ===
    if (emotions.mood < 0.3) {
      if (basicDecision.action === 'take' && realCost > 1 && realCost <= 6) { // 중간 손실에서만 더 신중
        const chance = Math.min(0.25, (0.3 - emotions.mood) * 0.8); // 최대 25% 확률
        if (CryptoRandom.enhancedRandom() < chance) {
          decision.action = 'pass';
          emotionalReasons.push('기분 나빠서 더 신중');
        }
      }
    }
    
    // === 자신감이 높을 때 ===
    if (emotions.confidence > 0.8) {
      if (basicDecision.action === 'pass' && realCost > 0 && realCost <= 3) { // 작은 손실에서만 위험 감수
        const chance = Math.min(0.2, (emotions.confidence - 0.8) * 1.0); // 최대 20% 확률
        if (CryptoRandom.enhancedRandom() < chance) {
          decision.action = 'take';
          emotionalReasons.push('자신감으로 위험 감수');
        }
      }
    }
    
    // === 좌절감이 높을 때 ===
    if (emotions.frustration > 0.6) {
      if (basicDecision.action === 'take' && realCost > 0 && realCost <= 5) { // 중간 손실에서만 더 보수적
        const chance = Math.min(0.3, (emotions.frustration - 0.6) * 0.75); // 최대 30% 확률
        if (CryptoRandom.enhancedRandom() < chance) {
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
        if (CryptoRandom.enhancedRandom() < chance) {
          decision.action = 'take';
          emotionalReasons.push('승부욕으로 과감');
        }
      }
    }
    
    // === 욕심이 많을 때 ===
    if (emotions.greed > 0.7) {
      if (basicDecision.action === 'pass' && realCost > 0 && realCost <= 4 && pileTokens >= 2) {
        const chance = Math.min(0.2, (emotions.greed - 0.7) * 0.67); // 최대 20% 확률
        if (CryptoRandom.enhancedRandom() < chance) {
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
          if (CryptoRandom.enhancedRandom() < chance) {
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
        if (decision.action === 'pass' && CryptoRandom.enhancedRandom() < 0.3) { // 확률 제한
          decision.action = 'take';
          socialReasons.push(`${targetPlayer.nickname}에게 제한적 복수`);
        }
      }
    }
    
    // 동맹 관계 고려 (더욱 제한적)
    const allies = this.findAllies(players);
    if (allies.length > 0 && decision.action === 'take') {
      const wouldHelpAlly = allies.some(ally => this.wouldPlayerWantCard(ally, currentCard));
      if (wouldHelpAlly && CryptoRandom.enhancedRandom() < 0.15) { // 확률 대폭 감소
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
      return socialDecision.action;
    }
    
    const randomThreshold = this.baseTendency.randomness;
    const realCost = this.calculateRealCost(currentCard, pileTokens);
    
    // 매우 명확한 상황에서는 무작위성 제한 - 범위 대폭 축소
    if (realCost <= -1) { // 명확한 이익인 경우 (기준 완화)
      return socialDecision.action;
    }
    
    if (realCost >= 6) { // 명백한 손실인 경우 (기준 대폭 강화: 15점 → 6점)
      return socialDecision.action;
    }
    
    // 매우 애매한 상황(실제손실 -1~6점)에서만 최소한의 무작위성 적용
    const adjustedThreshold = randomThreshold * 0.1; // 무작위성을 10%로 더욱 감소
    
    if (CryptoRandom.enhancedRandom() < adjustedThreshold) {
      const oppositeAction = socialDecision.action === 'take' ? 'pass' : 'take';
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
      
      if (realCost <= 0) {
        // 이익인 경우: 매우 좋은 거래
        this.emotionalState.mood = Math.min(1, this.emotionalState.mood + 0.15 * intensity);
        this.emotionalState.confidence = Math.min(1, this.emotionalState.confidence + 0.1 * intensity);
        this.emotionalState.greed = Math.min(1, this.emotionalState.greed + 0.05 * intensity);
      } else if (realCost <= 3) {
        // 작은 손실: 괜찮은 거래
        this.emotionalState.mood = Math.min(1, this.emotionalState.mood + 0.05 * intensity);
        this.emotionalState.confidence = Math.min(1, this.emotionalState.confidence + 0.03 * intensity);
      } else if (realCost <= 8) {
        // 중간 손실: 어쩔 수 없는 거래
        this.emotionalState.confidence = Math.max(0, this.emotionalState.confidence - 0.02 * intensity);
      } else {
        // 큰 손실: 나쁜 거래
        this.emotionalState.mood = Math.max(0, this.emotionalState.mood - 0.1 * intensity);
        this.emotionalState.frustration = Math.min(1, this.emotionalState.frustration + 0.15 * intensity);
        this.emotionalState.confidence = Math.max(0, this.emotionalState.confidence - 0.05 * intensity);
      }
    } else {
      // 패스 결정 - 실제 손실을 고려하여 평가
      const realCost = this.calculateRealCost(currentCard, pileTokens);
      
      if (realCost > 5) {
        // 큰 손실을 피한 현명한 패스
        this.emotionalState.confidence = Math.min(1, this.emotionalState.confidence + 0.03 * intensity);
      } else if (realCost <= 0) {
        // 이익을 놓친 아쉬운 패스
        this.emotionalState.frustration = Math.min(1, this.emotionalState.frustration + 0.05 * intensity);
      } else {
        // 일반적인 패스
        this.emotionalState.confidence = Math.max(0, this.emotionalState.confidence - 0.01 * intensity);
      }
    }
    
    // 감정 상태 출력
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
        break;
        
      case 'got_overtaken':
        this.emotionalState.competitiveness = Math.min(1, this.emotionalState.competitiveness + 0.2 * intensity);
        this.emotionalState.frustration = Math.min(1, this.emotionalState.frustration + 0.15 * intensity);
        break;
        
      case 'consecutive_bad_cards':
        this.emotionalState.confidence = Math.max(0, this.emotionalState.confidence - 0.2 * intensity);
        this.emotionalState.mood = Math.max(0, this.emotionalState.mood - 0.15 * intensity);
        break;
        
      case 'winning_streak':
        this.emotionalState.confidence = Math.min(1, this.emotionalState.confidence + 0.2 * intensity);
        this.emotionalState.mood = Math.min(1, this.emotionalState.mood + 0.15 * intensity);
        this.emotionalState.greed = Math.min(1, this.emotionalState.greed + 0.1 * intensity);
        break;
    }
  }

  // === 게임 상황 분석 시스템 ===
  
  /**
   * 게임 상황을 종합적으로 분석
   */
  analyzeGameSituation(gameState) {
    const { players, deckSize, removedCount, removedCards } = gameState;
    
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
    
    // 7. 삭제된 카드 기반 연결 가능성 분석
    const cardAvailability = this.analyzeCardAvailability(removedCards || []);
    
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
      opponentAnalysis,     // 상대방 위험도 분석 결과
      players,              // 경쟁 분석을 위한 플레이어 정보 추가
      cardAvailability      // 삭제된 카드 기반 연결 가능성 분석
    };
    
    
    if (opponentAnalysis.primaryThreat) {
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
  
  /**
   * 삭제된 카드를 고려한 연결 가능성 분석
   */
  analyzeCardAvailability(removedCards) {
    const analysis = {
      removedCards: removedCards || [],
      connectionRisks: new Map(), // 각 카드별 연결 위험도
      brokenChains: [], // 끊어진 연속 구간
      safeCards: [], // 안전한 카드들 (연결 가능성 높음)
      riskyCards: [] // 위험한 카드들 (연결 끊어질 가능성 높음)
    };
    
    // 3~35 범위의 모든 카드에 대해 연결 가능성 분석
    for (let card = 3; card <= 35; card++) {
      const prevCard = card - 1;
      const nextCard = card + 1;
      
      let connectionRisk = 0;
      let riskFactors = [];
      
      // 이전 카드가 삭제되었는지 체크
      if (prevCard >= 3 && removedCards.includes(prevCard)) {
        connectionRisk += 0.5;
        riskFactors.push(`${prevCard} 삭제됨`);
      }
      
      // 다음 카드가 삭제되었는지 체크
      if (nextCard <= 35 && removedCards.includes(nextCard)) {
        connectionRisk += 0.5;
        riskFactors.push(`${nextCard} 삭제됨`);
      }
      
      // 양쪽이 모두 삭제된 경우 (완전 고립)
      if (connectionRisk >= 1.0) {
        analysis.riskyCards.push({
          card,
          risk: 'isolated',
          factors: riskFactors
        });
      } else if (connectionRisk >= 0.5) {
        analysis.riskyCards.push({
          card,
          risk: 'partial',
          factors: riskFactors
        });
      } else {
        analysis.safeCards.push({
          card,
          risk: 'safe',
          factors: []
        });
      }
      
      analysis.connectionRisks.set(card, {
        risk: connectionRisk,
        factors: riskFactors
      });
    }
    
    // 끊어진 연속 구간 분석
    let chainStart = 3;
    for (let card = 3; card <= 35; card++) {
      if (removedCards.includes(card)) {
        if (card > chainStart) {
          analysis.brokenChains.push({
            start: chainStart,
            end: card - 1,
            length: card - chainStart
          });
        }
        chainStart = card + 1;
      }
    }
    
    // 마지막 구간 처리
    if (chainStart <= 35) {
      analysis.brokenChains.push({
        start: chainStart,
        end: 35,
        length: 35 - chainStart + 1
      });
    }
    
    if (analysis.brokenChains.length > 0) {
    }
    
    return analysis;
  }
  
  /**
   * 카드 경쟁 상황 분석 - 핵심 전략 로직
   */
  analyzeCardCompetition(currentCard, players) {
    const opponents = players.filter(p => p.id !== this.id);
    let competitionLevel = 0;
    let competitorsWhoWant = [];
    let myConnectionValue = 0;
    let opponentBenefits = [];
    
    // 1. 내가 이 카드를 얼마나 원하는지 계산
    const myDirectConnection = this.hasDirectConnection(currentCard);
    const myIndirectConnection = this.hasIndirectConnection(currentCard);
    
    if (myDirectConnection) myConnectionValue = 3;
    else if (myIndirectConnection) myConnectionValue = 1;
    
    // 2. 각 상대방이 이 카드를 얼마나 원하는지 분석
    opponents.forEach(opponent => {
      let opponentWantLevel = 0;
      let benefit = 0;
      
      // 봇인 경우 실제 카드로 정확히 계산
      if (opponent.isBot && opponent.cards) {
        const hasDirectConn = opponent.cards.some(card => Math.abs(card - currentCard) === 1);
        const hasIndirectConn = opponent.cards.some(card => Math.abs(card - currentCard) === 2);
        
        if (hasDirectConn) {
          opponentWantLevel = 3;
          benefit = 5; // 직접 연결은 높은 이익
        } else if (hasIndirectConn) {
          opponentWantLevel = 2;
          benefit = 2; // 간접 연결은 중간 이익
        } else if (currentCard <= 15) {
          opponentWantLevel = 1;
          benefit = 1; // 낮은 카드는 누구나 원함
        }
      } else {
        // 인간 플레이어는 관찰된 패턴과 추정 로직으로 분석
        const wantLevel = this.estimateHumanPlayerWant(opponent, currentCard);
        if (wantLevel > 0) {
          opponentWantLevel = wantLevel;
          benefit = wantLevel + 1; // 원하는 정도에 비례한 이익
        }
      }
      
      if (opponentWantLevel > 0) {
        competitorsWhoWant.push({
          player: opponent,
          wantLevel: opponentWantLevel,
          benefit: benefit
        });
        competitionLevel += opponentWantLevel;
      }
      
      opponentBenefits.push({ player: opponent, benefit });
    });
    
    // 3. 경쟁 상황 판단
    const totalCompetitors = competitorsWhoWant.length;
    const maxOpponentBenefit = Math.max(...opponentBenefits.map(b => b.benefit));
    const highBenefitOpponents = opponentBenefits.filter(b => b.benefit >= 4);
    
    
    // === 결정 로직 ===
    
    // 강제 가져가기 상황
    let shouldForceTake = false;
    let competitionBonus = 0;
    let forceReason = '';
    
    // 1) 내가 직접연결이고 상대방도 원하는 경우 - 무조건 가져가기
    if (myConnectionValue >= 3 && totalCompetitors > 0) {
      shouldForceTake = true;
      competitionBonus = 8; // 큰 손실까지 감수
      forceReason = `내 직접연결+${totalCompetitors}명 경쟁`;
    }
    // 2) 내가 간접연결이고 상대방이 직접연결 가능한 경우
    else if (myConnectionValue >= 1 && competitorsWhoWant.some(c => c.wantLevel >= 3)) {
      shouldForceTake = true;
      competitionBonus = 5;
      forceReason = `상대 직접연결 차단`;
    }
    // 3) 여러 상대방이 원하는 카드인 경우
    else if (totalCompetitors >= 2) {
      shouldForceTake = true;
      competitionBonus = 3;
      forceReason = `${totalCompetitors}명 경쟁차단`;
    }
    
    // 가져가지 말아야 할 상황
    let shouldAvoidTake = false;
    let avoidReason = '';
    
    // 1) 내게는 별 이익이 없는데 상대방에게 큰 이익이 되는 경우
    if (myConnectionValue === 0 && highBenefitOpponents.length > 0 && currentCard >= 20) {
      shouldAvoidTake = true;
      avoidReason = `상대에게 ${highBenefitOpponents[0].player.nickname} 큰 이익 제공`;
    }
    
    return {
      shouldForceTake,
      shouldAvoidTake,
      competitionBonus,
      competitionLevel,
      totalCompetitors,
      reason: shouldForceTake ? forceReason : avoidReason,
      competitorsWhoWant
    };
  }
  
  // === 도우미 메서드들 ===
  
  hasConnection(currentCard) {
    return this.hasDirectConnection(currentCard) || this.hasIndirectConnection(currentCard);
  }
  
  isCurrentlyLeading(players) {
    const myScore = this.calculateCurrentScore();
    return players.every(p => p.id === this.id || this.calculatePlayerScore(p) >= myScore);
  }
  
  /**
   * 인간 플레이어가 특정 카드를 원하는 정도를 추정 (0-3 스케일)
   */
  estimateHumanPlayerWant(player, currentCard) {
    if (!player || player.isBot) return 0;
    
    let wantLevel = 0;
    
    // 1. 관찰된 패턴 분석
    const recentActions = this.playerRelations[player.id]?.observedPatterns || [];
    const recentTakes = recentActions.filter(action => action.type === 'take').slice(-5);
    
    if (recentTakes.length > 0) {
      const takenCards = recentTakes.map(action => action.card);
      
      // 직접 연결 가능성 체크
      const hasDirectConnection = takenCards.some(card => Math.abs(card - currentCard) === 1);
      if (hasDirectConnection) {
        return 3; // 직접 연결은 최고 우선순위
      }
      
      // 간접 연결 가능성 체크
      const hasIndirectConnection = takenCards.some(card => Math.abs(card - currentCard) === 2);
      if (hasIndirectConnection) {
        wantLevel = Math.max(wantLevel, 2);
      }
      
      // 유사한 범위의 카드를 자주 가져가는 패턴
      const similarRangeCards = takenCards.filter(card => Math.abs(card - currentCard) <= 4);
      if (similarRangeCards.length >= 2) {
        wantLevel = Math.max(wantLevel, 1);
      }
    }
    
    // 2. 카드 가치 기반 일반적 선호도
    if (wantLevel === 0) {
      if (currentCard <= 10) {
        wantLevel = 1; // 낮은 카드는 누구나 원함
      } else if (currentCard <= 20) {
        wantLevel = CryptoRandom.enhancedRandom() < 0.3 ? 1 : 0; // 중간 카드는 30% 확률
      } else {
        wantLevel = CryptoRandom.enhancedRandom() < 0.1 ? 1 : 0; // 높은 카드는 10% 확률
      }
    }
    
    return wantLevel;
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
      if (hasIndirectConnection) return CryptoRandom.enhancedRandom() < 0.6;
      
      // 낮은 가치 카드는 일반적으로 원함
      if (currentCard <= 12) return CryptoRandom.enhancedRandom() < 0.4;
      return CryptoRandom.enhancedRandom() < 0.2;
    }
    
    // 인간 플레이어는 새로운 추정 함수 사용
    return this.estimateHumanPlayerWant(player, currentCard) > 0;
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
    
  }
  
  spendToken() {
    if (this.tokens > 0) {
      this.tokens--;
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
      mood: CryptoRandom.enhancedRandom() * 0.4 + 0.3,
      confidence: CryptoRandom.enhancedRandom() * 0.4 + 0.3,
      competitiveness: CryptoRandom.enhancedRandom() * 0.6 + 0.2,
      frustration: 0,
      greed: CryptoRandom.enhancedRandom() * 0.4 + 0.3,
      vengeful: 0
    };
    
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

  /**
   * 히든 카드에 대한 특별한 의사결정 로직
   * 불확실성 하에서의 확률적 판단
   */
  makeHiddenCardDecision(currentCard, pileTokens, gameState) {
    
    // 토큰 부족시 강제 취득
    if (this.tokens <= 0) {
      return 'take';
    }
    
    // 히든 카드 예상 가치 계산
    const expectedValue = this.calculateHiddenCardValue(gameState);
    const tokensGained = pileTokens;
    const riskTolerance = this.calculateHiddenRiskTolerance(gameState);
    
    
    // 기본 판단: 칩이 예상 손실보다 많으면 가져가기
    const netValue = tokensGained - expectedValue;
    
    // 감정적 요소 적용
    const emotionalBonus = this.getHiddenCardEmotionalBonus(gameState);
    const finalValue = netValue + emotionalBonus;
    
    
    // 의사결정 임계값 (난이도별)
    let threshold = 0;
    switch(this.difficulty) {
      case 'expert': threshold = -1; break;   // 더 적극적
      case 'hard': threshold = 0; break;      // 균형잡힌
      case 'medium': threshold = 1; break;    // 조금 보수적
    }
    
    const decision = finalValue >= threshold ? 'take' : 'pass';
    
    return decision;
  }

  /**
   * 히든 카드의 예상 가치 계산
   */
  calculateHiddenCardValue(gameState) {
    const { removedCards = [], deckSize = 24 } = gameState;
    
    // 제거되지 않은 카드들의 범위에서 평균값 계산
    const allCards = [];
    for (let i = 3; i <= 35; i++) {
      if (!removedCards.includes(i)) {
        allCards.push(i);
      }
    }
    
    // 이미 플레이어들이 가진 카드 제외
    const playersCards = gameState.players.flatMap(p => p.cards || []);
    const availableCards = allCards.filter(card => !playersCards.includes(card));
    
    if (availableCards.length === 0) return 15; // 기본값
    
    // 가중 평균 계산 (높은 카드에 약간 더 가중치)
    const weightedSum = availableCards.reduce((sum, card) => {
      const weight = card > 20 ? 1.2 : 1.0; // 20 이상 카드에 20% 가중치
      return sum + (card * weight);
    }, 0);
    
    const totalWeight = availableCards.reduce((sum, card) => {
      return sum + (card > 20 ? 1.2 : 1.0);
    }, 0);
    
    return weightedSum / totalWeight;
  }

  /**
   * 히든 카드에 대한 위험 허용도 계산
   */
  calculateHiddenRiskTolerance(gameState) {
    let tolerance = 0.5; // 기본 50%
    
    // 감정 상태 영향
    tolerance += this.emotionalState.confidence * 0.3;
    tolerance += this.emotionalState.greed * 0.2;
    tolerance -= this.emotionalState.frustration * 0.3;
    
    // 게임 상황 영향
    const situation = this.analyzeGameSituation(gameState);
    if (situation.isLastPlace) tolerance += 0.2; // 꼴찌면 더 위험 감수
    if (situation.isLeading) tolerance -= 0.1;   // 선두면 조금 보수적
    
    // 토큰 상황 영향
    if (this.tokens > 8) tolerance += 0.1;      // 토큰 많으면 여유
    if (this.tokens < 3) tolerance -= 0.2;      // 토큰 적으면 신중
    
    return Math.max(0.1, Math.min(0.9, tolerance));
  }

  /**
   * 히든 카드에 대한 감정적 보너스/패널티
   */
  getHiddenCardEmotionalBonus(gameState) {
    let bonus = 0;
    
    // 도박꾼 성향
    if (this.emotionalState.greed > 0.7) bonus += 1;
    
    // 자신감 영향
    bonus += (this.emotionalState.confidence - 0.5) * 2;
    
    // 좌절감이 높으면 무모한 선택
    if (this.emotionalState.frustration > 0.6) bonus += 1.5;
    
    // 게임 후반부에는 더 적극적
    const gameProgress = (35 - gameState.deckSize) / 24;
    if (gameProgress > 0.7) bonus += 1;
    
    return bonus;
  }
}

export default Bot;