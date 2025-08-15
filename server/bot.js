/*
 * AI 봇 시스템 for No Thanks! 게임 - 완전히 재설계된 버전
 * 
 * 핵심 전략에 집중하여 실제로 승리할 수 있는 AI 구현
 * 복잡한 수학적 모델 대신 실증적 전략 활용
 */

class Bot {
  constructor(id, nickname, difficulty = 'medium') {
    this.id = id;
    this.nickname = nickname;
    this.difficulty = difficulty; // 'medium', 'hard', 'expert'
    this.tokens = 0;
    this.cards = [];
    this.isBot = true;
    
    // 간단한 플레이 패턴 다양화
    this.playVariation = Math.random(); // 0-1 사이 값으로 플레이 패턴 변화
    this.gameMemory = []; // 간단한 게임 기록
    
    console.log(`${this.nickname} - 난이도: ${this.difficulty}, 플레이 변화: ${this.playVariation.toFixed(2)}`);
  }

  /**
   * 현재 상황에서 최선의 액션을 결정합니다.
   * 고급 전략 기반 정교한 의사결정 시스템
   */
  makeDecision(gameState) {
    const { currentCard, pileTokens, players } = gameState;
    
    // === 게임 컨텍스트 구성 ===
    const gameContext = {
      currentCard,
      pileTokens,
      players,
      gamePhase: this.determineGamePhase(players),
      resourceSituation: this.analyzeResourceSituation()
    };
    
    // === 핵심 전략 분석 ===
    // 1. 연속 카드 우선순위 분석 (고급 버전 - 전략적 지연 포함)
    const chainValue = this.evaluateChainOpportunity(currentCard, gameContext);
    
    // 2. 자원 상황 인지 (Resource Awareness)  
    const resourceSituation = gameContext.resourceSituation;
    
    // 3. 지능적 칩 파밍 분석 (Smart Chip Farming)
    const farmingOpportunity = this.evaluateChipFarmingOpportunity(currentCard, pileTokens, players);
    
    // 4. 상대방 전략 분석 (Opponent Analysis)
    const opponentThreats = this.analyzeOpponentThreats(currentCard, players);
    
    // 5. 상대방 행동 예측 (Opponent Behavior Prediction)
    const opponentPrediction = this.predictOpponentBehavior(currentCard, players, gameContext);
    
    // 6. 지연 만족 vs 즉시 만족 분석 (Delayed Gratification Analysis)
    const delayedGratification = this.evaluateDelayedGratification(currentCard, pileTokens, opponentPrediction, chainValue);
    
    // 7. 다턴 기대값 분석 (Multi-turn Expected Value)
    const multiTurnValue = this.calculateMultiTurnExpectedValue(currentCard, gameContext, opponentPrediction);
    
    // 난이도별 고급 의사결정
    return this.makeAdvancedStrategicDecision({
      currentCard,
      pileTokens,
      chainValue,
      resourceSituation,
      farmingOpportunity,
      opponentThreats,
      opponentPrediction,
      delayedGratification,
      multiTurnValue,
      gamePhase: gameContext.gamePhase,
      players
    });
  }

  /**
   * 1. 연속 카드 우선순위 평가 (Chain Priority System) - 고급 버전
   * 기존 카드와 연결되는 카드에 최고 우선순위를 부여하지만, 전략적 지연도 고려
   */
  evaluateChainOpportunity(currentCard, gameContext = null) {
    if (!this.cards || this.cards.length === 0) return { value: 0, type: 'none', strategicDelay: false };
    
    let chainValue = 0;
    let bestChainType = 'none';
    let connectedCards = [];
    
    // 기존 카드와의 인접성 체크 및 연결된 카드 추적
    for (const ownCard of this.cards) {
      const distance = Math.abs(ownCard - currentCard);
      
      // 직접 인접 (가장 가치 높음)
      if (distance === 1) {
        chainValue += 100;
        bestChainType = 'direct';
        connectedCards.push(ownCard);
      }
      // 1칸 간격 (높은 가치)
      else if (distance === 2) {
        chainValue += 60;
        if (bestChainType === 'none') bestChainType = 'gap1';
        connectedCards.push(ownCard);
      }
      // 2칸 간격 (중간 가치)
      else if (distance === 3) {
        chainValue += 30;
        if (bestChainType === 'none') bestChainType = 'gap2';
      }
    }
    
    // 전략적 지연 가능성 평가 (직접 연결이어도 기다릴 가치가 있는지)
    let strategicDelay = false;
    if (bestChainType === 'direct' && gameContext) {
      strategicDelay = this.shouldDelayDirectConnection(currentCard, connectedCards, gameContext);
    }
    
    return { 
      value: chainValue, 
      type: bestChainType, 
      connectedCards,
      strategicDelay
    };
  }
  
  /**
   * 2. 자원 상황 인지 (Resource Awareness)
   * 내 토큰과 점수 상황을 정확히 파악
   */
  analyzeResourceSituation() {
    const myTokens = this.tokens;
    const myScore = this.calculateCurrentScore();
    
    return {
      hasTokens: myTokens > 0,
      tokenCount: myTokens,
      isTokenPoor: myTokens <= 2, // 토큰 부족 상태
      isTokenRich: myTokens >= 8,  // 토큰 풍부 상태
      currentScore: myScore,
      riskCapacity: myTokens >= 5 ? 'high' : myTokens >= 3 ? 'medium' : 'low'
    };
  }
  
  /**
   * 3. 지능적 칩 파밍 평가 (Smart Chip Farming)
   * 다른 플레이어가 싫어하는 카드를 돌려서 칩 축적
   */
  evaluateChipFarmingOpportunity(currentCard, pileTokens, players) {
    let farmingValue = 0;
    
    // 높은 카드일수록 다른 플레이어가 가져가기 싫어함
    if (currentCard >= 30) farmingValue += 40;
    else if (currentCard >= 25) farmingValue += 25;
    else if (currentCard >= 20) farmingValue += 10;
    
    // 이미 쌓인 토큰이 많을수록 파밍 가치 상승
    farmingValue += pileTokens * 5;
    
    // 다른 플레이어들의 필요도 분석
    const opponentNeedLevel = this.analyzeOpponentNeedForCard(currentCard, players);
    if (opponentNeedLevel === 'none') farmingValue += 30; // 아무도 원하지 않으면 파밍 기회
    
    return farmingValue;
  }
  
  /**
   * 4. 상대방 위협 분석 (Opponent Threat Analysis)
   */
  analyzeOpponentThreats(currentCard, players) {
    let maxThreat = 0;
    let threats = [];
    
    for (const player of players) {
      if (player.id === this.id) continue;
      
      const playerCards = player.cards || [];
      let threatLevel = 0;
      
      // 상대방이 이 카드로 연속성을 만들 수 있는지 확인
      for (const opponentCard of playerCards) {
        if (Math.abs(opponentCard - currentCard) === 1) {
          threatLevel += 50; // 직접 연결 가능
        } else if (Math.abs(opponentCard - currentCard) === 2) {
          threatLevel += 25; // 간접 연결 가능
        }
      }
      
      if (threatLevel > maxThreat) maxThreat = threatLevel;
      threats.push({ playerId: player.id, level: threatLevel });
    }
    
    return { maxThreat, threats };
  }
  
  /**
   * 5. 게임 단계 결정 (Game Phase Determination)
   */
  determineGamePhase(players) {
    const totalCards = players.reduce((sum, p) => sum + (p.cards ? p.cards.length : 0), 0);
    
    if (totalCards < 8) return 'early';      // 초반: 칩 축적
    else if (totalCards < 18) return 'mid';   // 중반: 전략적 취득
    else return 'late';                      // 후반: 점수 최소화
  }

  /**
   * 6. 고급 전략적 의사결정 (Advanced Strategic Decision Making)
   * 모든 요소를 종합하여 최종 결정 - 직접 연결도 전략적 패스 가능
   */
  makeAdvancedStrategicDecision(analysis) {
    // 난이도별 고급 전략
    switch (this.difficulty) {
      case 'medium':
        return this.advancedMediumStrategy(analysis);
      case 'hard':
        return this.advancedHardStrategy(analysis);
      case 'expert':
        return this.advancedExpertStrategy(analysis);
      default:
        return this.advancedMediumStrategy(analysis);
    }
  }
  
  /**
   * 고급 중급 전략: 기본 지연 만족 포함
   */
  advancedMediumStrategy(analysis) {
    const { 
      currentCard, pileTokens, chainValue, resourceSituation, 
      delayedGratification, multiTurnValue 
    } = analysis;
    
    // 1. 직접 연결 - 하지만 전략적 지연 고려
    if (chainValue.type === 'direct') {
      // 전략적 지연이 권장되고 지연 만족 가치가 높다면 패스
      if (chainValue.strategicDelay && delayedGratification.shouldDelay) {
        console.log(`${this.nickname} [중급]: 직접 연결 ${currentCard} 전략적 패스 (지연 이익: ${delayedGratification.delayBenefit.toFixed(1)})`);
        return 'pass';
      }
      return 'take';
    }
    
    // 2. 다턴 기대값 기반 결정
    if (multiTurnValue.bestTurn > 0 && resourceSituation.tokenCount >= multiTurnValue.bestTurn) {
      return 'pass'; // 기다리는 것이 더 유리
    }
    
    // 3. 기본적인 비용-이익 분석
    const cardCost = currentCard + (resourceSituation.isTokenPoor ? 10 : 0);
    const benefit = pileTokens + (chainValue.value * 0.2);
    
    return cardCost <= benefit + 20 ? 'take' : 'pass';
  }
  
  /**
   * 고급 상급 전략: 상대방 예측 + 지연 만족 분석
   */
  advancedHardStrategy(analysis) {
    const { 
      currentCard, pileTokens, chainValue, resourceSituation,
      farmingOpportunity, opponentThreats, opponentPrediction, 
      delayedGratification, multiTurnValue, gamePhase 
    } = analysis;
    
    // 1. 직접 연결 - 고급 지연 전략 적용
    if (chainValue.type === 'direct') {
      // 더 정교한 지연 결정
      if (chainValue.strategicDelay && 
          delayedGratification.shouldDelay &&
          multiTurnValue.bestTurn > 0) {
        console.log(`${this.nickname} [상급]: 직접 연결 ${currentCard} 고급 전략적 패스 (예상 이익: ${delayedGratification.delayBenefit.toFixed(1)}, 최적 턴: ${multiTurnValue.bestTurn})`);
        return 'pass';
      }
      return 'take';
    }
    
    // 2. 상대방 행동 예측 기반 결정
    const likelyTakers = opponentPrediction.filter(p => p.likelyAction === 'take');
    const likelyPassers = opponentPrediction.filter(p => p.likelyAction === 'pass');
    
    // 누군가 확실히 가져갈 것 같으면 경쟁
    if (likelyTakers.length > 0 && chainValue.value >= 60) {
      return 'take'; // 경쟁 상황에서 연결 가치 있으면 선점
    }
    
    // 대부분 패스할 것 같으면 칩 파밍
    if (likelyPassers.length >= 2 && pileTokens <= 3 && resourceSituation.tokenCount >= 3) {
      return 'pass'; // 칩 축적 기회
    }
    
    // 3. 게임 단계별 고급 전략
    if (gamePhase === 'early') {
      // 초반: 지연 만족 우선
      if (delayedGratification.delayBenefit > 2 && resourceSituation.tokenCount >= 4) {
        return 'pass';
      }
    } else if (gamePhase === 'late') {
      // 후반: 위험 회피 + 확실한 이익만
      if (currentCard >= 25 && pileTokens < currentCard * 0.3) {
        return 'pass';
      }
    }
    
    // 4. 다턴 기대값 최적화
    const bestTurn = multiTurnValue.bestTurn;
    if (bestTurn > 0 && resourceSituation.tokenCount >= bestTurn) {
      const currentValue = multiTurnValue.turn0;
      const futureValue = bestTurn === 1 ? multiTurnValue.turn1 : multiTurnValue.turn2;
      
      if (futureValue > currentValue + 1.5) {
        return 'pass'; // 미래가 더 유리
      }
    }
    
    // 5. 최종 비용-이익 분석
    const cardCost = currentCard + (resourceSituation.isTokenPoor ? 12 : 0);
    const benefit = pileTokens + (chainValue.value * 0.25) + (delayedGratification.immediateValue * 0.1);
    
    return cardCost <= benefit + 18 ? 'take' : 'pass';
  }
  
  /**
   * 최상급 전략: 완벽한 전략적 지연 + 다차원 분석
   */
  advancedExpertStrategy(analysis) {
    const { 
      currentCard, pileTokens, chainValue, resourceSituation,
      farmingOpportunity, opponentThreats, opponentPrediction,
      delayedGratification, multiTurnValue, gamePhase, players 
    } = analysis;
    
    // 1. 직접 연결 - 최고 수준의 전략적 판단
    if (chainValue.type === 'direct') {
      // 복합적 지연 결정 로직
      const shouldDelayStrategic = chainValue.strategicDelay;
      const shouldDelayGratification = delayedGratification.shouldDelay;
      const shouldDelayMultiTurn = multiTurnValue.bestTurn > 0;
      const hasTokensForDelay = resourceSituation.tokenCount >= 4;
      
      // 모든 지연 조건이 만족되고 충분한 이익이 예상된다면 지연
      if (shouldDelayStrategic && shouldDelayGratification && shouldDelayMultiTurn && hasTokensForDelay) {
        const totalBenefit = delayedGratification.delayBenefit + 
                           (multiTurnValue.bestTurn === 1 ? multiTurnValue.turn1 - multiTurnValue.turn0 : 
                            multiTurnValue.turn2 - multiTurnValue.turn0);
        
        if (totalBenefit > 3) { // 최소 3점 이상의 이익이 있어야 직접 연결을 포기
          console.log(`${this.nickname} [최상급]: 직접 연결 ${currentCard} 완벽한 전략적 패스 (총 예상 이익: ${totalBenefit.toFixed(1)})`);
          return 'pass';
        }
      }
      
      // 리더 견제를 위한 직접 연결 포기 (극한 상황)
      const competitorAnalysis = this.analyzeCompetitorPositions(players);
      if (competitorAnalysis.leader && 
          competitorAnalysis.leader.id !== this.id && 
          gamePhase === 'late' &&
          this.wouldSignificantlyHelpLeader(currentCard, competitorAnalysis.leader)) {
        console.log(`${this.nickname} [최상급]: 리더 견제를 위한 직접 연결 ${currentCard} 포기`);
        return 'pass';
      }
      
      return 'take';
    }
    
    // 2. 상대방 심리 분석 및 메타게임
    const psychAnalysis = this.analyzeOpponentPsychology(opponentPrediction, gamePhase);
    
    // 3. 완벽한 칩 파밍 vs 즉시 취득 계산
    const perfectFarmingAnalysis = this.calculatePerfectFarmingStrategy({
      currentCard, pileTokens, players, chainValue, 
      opponentPrediction, resourceSituation, gamePhase
    });
    
    if (perfectFarmingAnalysis.shouldFarm && resourceSituation.tokenCount >= perfectFarmingAnalysis.requiredTokens) {
      console.log(`${this.nickname} [최상급]: 완벽한 칩 파밍 - 예상 수익: ${perfectFarmingAnalysis.expectedProfit}`);
      return 'pass';
    }
    
    // 4. 동적 게임 이론 적용
    const gameTheoryDecision = this.applyGameTheory(analysis);
    if (gameTheoryDecision.confidence >= 0.8) {
      console.log(`${this.nickname} [최상급]: 게임 이론 결정 - ${gameTheoryDecision.action} (신뢰도: ${(gameTheoryDecision.confidence * 100).toFixed(0)}%)`);
      return gameTheoryDecision.action;
    }
    
    // 5. 다차원 위험-보상 최적화
    const riskRewardOptimal = this.calculateOptimalRiskReward({
      currentCard, pileTokens, chainValue, resourceSituation,
      delayedGratification, multiTurnValue, opponentPrediction
    });
    
    // 6. 플레이 변화 + 예측 불가능성 (고급)
    const adaptiveVariation = this.calculateAdaptiveVariation(gamePhase, players.length);
    
    return riskRewardOptimal.score + adaptiveVariation <= 22 ? 'take' : 'pass';
  }
  
  // === 고급 전략 시스템 ===
  
  /**
   * 직접 연결 카드도 전략적으로 지연할지 결정
   * 핵심: 더 많은 칩을 얻기 위해 직접 연결도 포기할 수 있음
   */
  shouldDelayDirectConnection(currentCard, connectedCards, gameContext) {
    const { pileTokens, players, gamePhase, resourceSituation } = gameContext;
    
    // 기본 조건: 토큰이 부족하면 지연 불가
    if (resourceSituation.tokenCount < 3) return false;
    
    // 게임 후반이면 안전하게 가져가기
    if (gamePhase === 'late') return false;
    
    // 상대방들이 모두 패스할 확률이 높고, 더 많은 칩을 기대할 수 있다면 지연
    const opponentPassProbability = this.calculateAllOpponentsPassProbability(currentCard, players);
    const expectedAdditionalChips = this.estimateAdditionalChips(currentCard, players, opponentPassProbability);
    
    // 현재 칩 수가 적고, 상대방들이 대부분 패스할 것 같고, 충분한 토큰이 있다면 지연
    const shouldDelay = (
      pileTokens <= 2 && // 현재 칩이 적고
      expectedAdditionalChips >= 3 && // 최소 3개 이상의 추가 칩 기대하고
      opponentPassProbability >= 0.7 && // 상대방 70% 이상 패스할 것 같고
      resourceSituation.tokenCount >= 5 && // 토큰이 충분하고
      gamePhase === 'early' // 게임 초반이면
    );
    
    if (shouldDelay) {
      console.log(`${this.nickname}: 직접 연결 카드 ${currentCard} 전략적 지연 - 예상 추가 칩: ${expectedAdditionalChips}`);
    }
    
    return shouldDelay;
  }
  
  /**
   * 모든 상대방이 패스할 확률 계산
   */
  calculateAllOpponentsPassProbability(currentCard, players) {
    let totalPassProb = 1.0;
    
    for (const player of players) {
      if (player.id === this.id) continue;
      
      const individualPassProb = this.calculateIndividualPassProbability(currentCard, player);
      totalPassProb *= individualPassProb;
    }
    
    return totalPassProb;
  }
  
  /**
   * 개별 플레이어가 패스할 확률 계산
   */
  calculateIndividualPassProbability(currentCard, player) {
    const playerCards = player.cards || [];
    const playerTokens = player.tokens || 0;
    
    // 연결성 체크
    let connectionStrength = 0;
    for (const card of playerCards) {
      const distance = Math.abs(card - currentCard);
      if (distance === 1) connectionStrength += 3;
      else if (distance === 2) connectionStrength += 2;
      else if (distance === 3) connectionStrength += 1;
    }
    
    // 기본 패스 확률 (카드 가치 기반)
    let passProb = Math.min(0.9, currentCard / 40); // 높은 카드일수록 패스 확률 증가
    
    // 연결성이 있으면 패스 확률 감소
    passProb = Math.max(0.1, passProb - (connectionStrength * 0.2));
    
    // 토큰이 적으면 패스 확률 증가
    if (playerTokens <= 2) passProb = Math.min(0.9, passProb + 0.3);
    
    return passProb;
  }
  
  /**
   * 추가로 얻을 수 있는 칩 수 추정
   */
  estimateAdditionalChips(currentCard, players, passProb) {
    const remainingPlayers = players.length - 1;
    
    // 모든 플레이어가 패스할 경우 추가 칩 = 남은 플레이어 수
    // 확률을 곱해서 기대값 계산
    return Math.floor(remainingPlayers * passProb);
  }
  
  /**
   * 상대방 행동 예측 시스템
   */
  predictOpponentBehavior(currentCard, players, gameContext) {
    const predictions = [];
    
    for (const player of players) {
      if (player.id === this.id) continue;
      
      const prediction = {
        playerId: player.id,
        nickname: player.nickname,
        passProb: this.calculateIndividualPassProbability(currentCard, player),
        connectionStrength: this.analyzePlayerConnectionStrength(currentCard, player),
        tokenSituation: this.analyzePlayerTokenSituation(player, gameContext),
        likelyAction: null
      };
      
      // 예상 행동 결정
      if (prediction.passProb >= 0.7) prediction.likelyAction = 'pass';
      else if (prediction.passProb <= 0.3) prediction.likelyAction = 'take';
      else prediction.likelyAction = 'uncertain';
      
      predictions.push(prediction);
    }
    
    return predictions;
  }
  
  /**
   * 플레이어와 현재 카드의 연결 강도 분석
   */
  analyzePlayerConnectionStrength(currentCard, player) {
    const playerCards = player.cards || [];
    let connectionStrength = 0;
    let directConnections = 0;
    
    for (const card of playerCards) {
      const distance = Math.abs(card - currentCard);
      if (distance === 1) {
        connectionStrength += 5;
        directConnections++;
      } else if (distance === 2) {
        connectionStrength += 3;
      } else if (distance === 3) {
        connectionStrength += 1;
      }
    }
    
    return {
      strength: connectionStrength,
      directConnections,
      level: connectionStrength >= 5 ? 'high' : connectionStrength >= 3 ? 'medium' : 'low'
    };
  }
  
  /**
   * 플레이어 토큰 상황 분석
   */
  analyzePlayerTokenSituation(player, gameContext) {
    const tokens = player.tokens || 0;
    const cards = (player.cards || []).length;
    
    return {
      tokenCount: tokens,
      cardCount: cards,
      riskCapacity: tokens >= 5 ? 'high' : tokens >= 3 ? 'medium' : 'low',
      isTokenPoor: tokens <= 2,
      isTokenRich: tokens >= 8
    };
  }
  
  /**
   * 지연 만족 vs 즉시 만족 분석
   */
  evaluateDelayedGratification(currentCard, pileTokens, opponentPredictions, chainValue) {
    // 현재 즉시 얻을 수 있는 가치
    const immediateValue = pileTokens + (chainValue.value * 0.01); // 연결 보너스
    
    // 지연했을 때 기대되는 가치
    const passCount = opponentPredictions.filter(p => p.likelyAction === 'pass').length;
    const expectedDelayedValue = immediateValue + passCount;
    
    // 지연의 위험도 (누군가 가져갈 확률)
    const riskOfLoss = opponentPredictions.some(p => p.connectionStrength.level === 'high') ? 0.5 : 0.2;
    
    // 위험 조정된 지연 가치
    const riskAdjustedDelayedValue = expectedDelayedValue * (1 - riskOfLoss);
    
    return {
      immediateValue,
      expectedDelayedValue,
      riskAdjustedDelayedValue,
      shouldDelay: riskAdjustedDelayedValue > immediateValue + 2, // 최소 2 이상의 이익이 있어야 지연
      delayBenefit: riskAdjustedDelayedValue - immediateValue
    };
  }
  
  /**
   * 다턴 기대값 계산
   */
  calculateMultiTurnExpectedValue(currentCard, gameContext, opponentPredictions) {
    const { pileTokens, resourceSituation } = gameContext;
    
    // 1턴 후 기대값
    const turn1PassCount = opponentPredictions.filter(p => p.likelyAction === 'pass').length;
    const turn1ExpectedValue = pileTokens + turn1PassCount - 1; // 내 토큰 1개 소모
    
    // 2턴 후 기대값 (더 불확실)
    const turn2PassCount = Math.floor(turn1PassCount * 0.7); // 불확실성 증가
    const turn2ExpectedValue = turn1ExpectedValue + turn2PassCount - 1; // 추가 토큰 1개 소모
    
    // 토큰 부족 시 지연 불가능
    if (resourceSituation.tokenCount < 2) {
      return {
        turn0: pileTokens,
        turn1: -999, // 불가능
        turn2: -999, // 불가능
        bestTurn: 0
      };
    }
    
    const values = [pileTokens, turn1ExpectedValue, turn2ExpectedValue];
    const bestTurn = values.indexOf(Math.max(...values));
    
    return {
      turn0: pileTokens,
      turn1: resourceSituation.tokenCount >= 1 ? turn1ExpectedValue : -999,
      turn2: resourceSituation.tokenCount >= 2 ? turn2ExpectedValue : -999,
      bestTurn
    };
  }

  // === 최상급 전용 고급 메서드들 ===
  
  /**
   * 리더에게 큰 도움이 되는지 분석 (직접 연결 포기 결정용)
   */
  wouldSignificantlyHelpLeader(currentCard, leader) {
    if (!leader.cards) return false;
    
    let helpValue = 0;
    for (const card of leader.cards) {
      const distance = Math.abs(card - currentCard);
      if (distance === 1) helpValue += 5; // 직접 연결
      else if (distance === 2) helpValue += 3; // 간접 연결
    }
    
    // 리더에게 5점 이상의 도움이 된다면 포기 고려
    return helpValue >= 5;
  }
  
  /**
   * 상대방 심리 분석 (메타게임)
   */
  analyzeOpponentPsychology(opponentPredictions, gamePhase) {
    const psychology = {
      aggressiveCount: 0,
      conservativeCount: 0,
      unpredictableCount: 0,
      collectiveRisk: 'low'
    };
    
    for (const pred of opponentPredictions) {
      if (pred.likelyAction === 'take') psychology.aggressiveCount++;
      else if (pred.likelyAction === 'pass') psychology.conservativeCount++;
      else psychology.unpredictableCount++;
    }
    
    // 전체적 위험도 평가
    const totalPlayers = opponentPredictions.length;
    if (psychology.aggressiveCount > totalPlayers * 0.6) {
      psychology.collectiveRisk = 'high';
    } else if (psychology.aggressiveCount > totalPlayers * 0.3) {
      psychology.collectiveRisk = 'medium';
    }
    
    return psychology;
  }
  
  /**
   * 완벽한 칩 파밍 전략 계산
   */
  calculatePerfectFarmingStrategy(params) {
    const { currentCard, pileTokens, players, chainValue, opponentPrediction, resourceSituation, gamePhase } = params;
    
    // 파밍 기본 조건
    const isHighCard = currentCard >= 25;
    const hasLowInitialChips = pileTokens <= 2;
    const isEarlyOrMid = gamePhase === 'early' || gamePhase === 'mid';
    
    if (!isHighCard || !hasLowInitialChips || !isEarlyOrMid) {
      return { shouldFarm: false, expectedProfit: 0, requiredTokens: 0 };
    }
    
    // 상대방들의 패스 확률 기반 예상 수익 계산
    const passCount = opponentPrediction.filter(p => p.likelyAction === 'pass').length;
    const uncertainCount = opponentPrediction.filter(p => p.likelyAction === 'uncertain').length;
    
    // 예상 추가 칩 (보수적 계산)
    const expectedAdditionalChips = passCount + (uncertainCount * 0.5);
    const expectedProfit = expectedAdditionalChips - 1; // 토큰 1개 소모
    
    // 파밍 조건: 최소 2칩 이상의 순이익 기대
    const shouldFarm = expectedProfit >= 2 && resourceSituation.tokenCount >= 3;
    
    return {
      shouldFarm,
      expectedProfit,
      requiredTokens: 3,
      expectedAdditionalChips
    };
  }
  
  /**
   * 게임 이론 적용
   */
  applyGameTheory(analysis) {
    const { currentCard, chainValue, opponentPrediction, resourceSituation, gamePhase } = analysis;
    
    // 내시 균형 계산: 모든 플레이어가 합리적일 때의 최적 전략
    let nashScore = 0;
    let confidence = 0.5;
    
    // 1. 나의 최적 전략 계산
    const myOptimalAction = this.calculateMyOptimalAction(analysis);
    
    // 2. 상대방의 예상 반응 고려
    const opponentOptimalActions = this.predictOpponentOptimalActions(opponentPrediction, currentCard);
    
    // 3. 상호작용 결과 예측
    if (myOptimalAction === 'pass') {
      // 내가 패스할 때 다른 플레이어들도 패스할 확률
      const otherPassProb = opponentOptimalActions.filter(a => a.action === 'pass').length / opponentOptimalActions.length;
      
      if (otherPassProb >= 0.7) {
        nashScore = currentCard * 0.5; // 높은 점수 = 패스 권장
        confidence = 0.85;
      }
    } else {
      // 내가 가져갈 때의 기대 이익
      nashScore = -currentCard + chainValue.value * 0.1;
      confidence = chainValue.type === 'direct' ? 0.9 : 0.6;
    }
    
    return {
      action: nashScore > 15 ? 'pass' : 'take',
      confidence,
      nashScore,
      reasoning: `내시균형 점수: ${nashScore.toFixed(1)}`
    };
  }
  
  /**
   * 내 최적 행동 계산
   */
  calculateMyOptimalAction(analysis) {
    const { currentCard, pileTokens, chainValue } = analysis;
    
    // 간단한 기대값 계산
    const takeValue = pileTokens + (chainValue.value * 0.1) - currentCard;
    
    return takeValue > 0 ? 'take' : 'pass';
  }
  
  /**
   * 상대방들의 최적 행동 예측
   */
  predictOpponentOptimalActions(opponentPredictions, currentCard) {
    return opponentPredictions.map(pred => ({
      playerId: pred.playerId,
      action: pred.likelyAction,
      confidence: pred.passProb > 0.7 ? 0.8 : pred.passProb < 0.3 ? 0.8 : 0.4
    }));
  }
  
  /**
   * 최적 위험-보상 계산
   */
  calculateOptimalRiskReward(params) {
    const { currentCard, pileTokens, chainValue, resourceSituation, delayedGratification, multiTurnValue } = params;
    
    // 위험도 계산
    const cardRisk = currentCard; // 기본 위험 = 카드 점수
    const tokenRisk = resourceSituation.isTokenPoor ? 10 : 0; // 토큰 부족 리스크
    const totalRisk = cardRisk + tokenRisk;
    
    // 보상 계산
    const immediateReward = pileTokens + (chainValue.value * 0.05);
    const delayedReward = delayedGratification.riskAdjustedDelayedValue;
    const multiTurnReward = multiTurnValue.bestTurn > 0 ? 
      (multiTurnValue.bestTurn === 1 ? multiTurnValue.turn1 : multiTurnValue.turn2) : 0;
    
    const maxReward = Math.max(immediateReward, delayedReward, multiTurnReward);
    
    // 위험-보상 점수 (높을수록 위험)
    const score = totalRisk - maxReward;
    
    return {
      score,
      risk: totalRisk,
      reward: maxReward,
      riskRewardRatio: maxReward > 0 ? totalRisk / maxReward : 999
    };
  }
  
  /**
   * 적응형 변화 계산 (예측 불가능성)
   */
  calculateAdaptiveVariation(gamePhase, playerCount) {
    let baseVariation = (this.playVariation - 0.5) * 3; // -1.5 ~ +1.5
    
    // 게임 단계별 변화
    if (gamePhase === 'early') baseVariation *= 1.5; // 초반에 더 변화
    else if (gamePhase === 'late') baseVariation *= 0.5; // 후반에 안정적
    
    // 플레이어 수에 따른 변화
    const playerFactor = (playerCount - 3) * 0.5; // 플레이어 많을수록 변화
    
    return baseVariation + playerFactor;
  }

  // === 도우미 메서드들 ===
  
  analyzeOpponentNeedForCard(currentCard, players) {
    let needCount = 0;
    for (const player of players) {
      if (player.id === this.id) continue;
      const cards = player.cards || [];
      for (const card of cards) {
        if (Math.abs(card - currentCard) <= 2) {
          needCount++;
          break;
        }
      }
    }
    
    if (needCount === 0) return 'none';
    if (needCount === 1) return 'low';
    return 'high';
  }
  
  calculateCurrentScore() {
    if (!this.cards || this.cards.length === 0) return 0;
    
    const sortedCards = [...this.cards].sort((a, b) => a - b);
    let score = 0;
    let i = 0;
    
    while (i < sortedCards.length) {
      const sequenceStart = sortedCards[i];
      score += sequenceStart;
      
      // 연속된 카드들 건너뛰기
      while (i + 1 < sortedCards.length && sortedCards[i + 1] === sortedCards[i] + 1) {
        i++;
      }
      i++;
    }
    
    return score - this.tokens; // 토큰은 -1점
  }
  
  analyzeCompetitorPositions(players) {
    let leader = null;
    let minScore = Infinity;
    
    for (const player of players) {
      const score = this.calculatePlayerScore(player);
      if (score < minScore) {
        minScore = score;
        leader = player;
      }
    }
    
    return { leader, minScore };
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
  
  wouldHurtLeader(currentCard, leader) {
    const leaderCards = leader.cards || [];
    for (const card of leaderCards) {
      if (Math.abs(card - currentCard) <= 2) {
        return false; // 리더에게 좋은 카드라면 주지 않기
      }
    }
    return true;
  }
  
  evaluateAdvancedFarmingStrategy(currentCard, pileTokens, players, chainValue) {
    let shouldFarm = false;
    let farmingValue = 0;
    
    // 파밍 조건들
    if (currentCard >= 25) farmingValue += 20;
    if (pileTokens >= 3) farmingValue += 15;
    if (chainValue.value < 30) farmingValue += 10; // 연속성이 그리 좋지 않으면
    
    shouldFarm = farmingValue >= 30;
    return { shouldFarm, farmingValue };
  }
  
  calculateDynamicRisk(params) {
    const { currentCard, pileTokens, gamePhase, resourceSituation, chainValue } = params;
    
    let riskScore = currentCard; // 기본 위험도 = 카드 번호
    
    // 토큰 상황 고려
    if (resourceSituation.isTokenPoor) riskScore += 10;
    
    // 게임 단계 고려
    if (gamePhase === 'late') riskScore += 5;
    
    // 연속성 보정
    riskScore -= chainValue.value * 0.2;
    
    // 칩 보정
    riskScore -= pileTokens * 2;
    
    return { riskScore };
  }
  
  // === 게임 상태 관리 메서드들 ===
  
  addCard(cardNumber, tokens) {
    this.cards.push(cardNumber);
    this.tokens += tokens;
    
    // 게임 기록에 간단한 정보 저장
    this.gameMemory.push({
      action: 'take',
      card: cardNumber,
      tokens: tokens,
      timestamp: Date.now()
    });
  }
  
  spendToken() {
    if (this.tokens > 0) {
      this.tokens--;
      
      this.gameMemory.push({
        action: 'pass',
        timestamp: Date.now()
      });
      
      return true;
    }
    return false;
  }
  
  reset() {
    this.tokens = 11; // 기본 토큰 수
    this.cards = [];
    this.gameMemory = [];
    this.playVariation = Math.random(); // 새로운 플레이 패턴
  }
  
  getState() {
    return {
      id: this.id,
      nickname: this.nickname,
      tokens: this.tokens,
      cards: this.cards,
      isBot: this.isBot,
      difficulty: this.difficulty,
      score: this.calculateCurrentScore()
    };
  }
}

module.exports = Bot;