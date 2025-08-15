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
    
    // 인간다운 성격 시스템 - 동적 변화 가능
    this.basePersonality = Math.random(); // 기본 성격 (변하지 않음)
    this.playVariation = this.basePersonality; // 현재 성격 (게임 중 변화)
    this.gameMemory = []; // 게임 기록 및 학습
    this.personalityShifts = []; // 성격 변화 기록
    this.recentExperiences = []; // 최근 경험들 (성격 변화의 원인)
    
    // 성격 분석
    const personality = this.analyzePersonality();
    console.log(`🤖 ${this.nickname} [${this.difficulty}] 생성됨:`);
    console.log(`   성격: ${personality.type} (${personality.description})`);
    console.log(`   특징: ${personality.traits.join(', ')}`);
    console.log(`   플레이 스타일: ${personality.playStyle}`);
  }
  
  /**
   * AI의 성격 분석 (인간적 개성 부여)
   */
  analyzePersonality() {
    const variation = this.playVariation;
    
    let type = "";
    let description = "";
    let traits = [];
    let playStyle = "";
    
    if (variation < 0.2) {
      type = "초보수형";
      description = "안전을 최우선으로 하는 신중한 플레이어";
      traits = ["신중함", "위험회피", "계산적"];
      playStyle = "확실한 것만 가져가고, 리스크를 최소화";
    } else if (variation < 0.4) {
      type = "분석형";
      description = "모든 것을 꼼꼼히 계산하는 논리적 플레이어";
      traits = ["논리적", "체계적", "합리적"];
      playStyle = "데이터와 확률에 기반한 최적화된 판단";
    } else if (variation < 0.6) {
      type = "균형형";
      description = "상황에 맞게 유연하게 대응하는 플레이어";
      traits = ["유연함", "적응력", "균형감"];
      playStyle = "상황에 따라 공격적/보수적 전환";
    } else if (variation < 0.8) {
      type = "공격형";
      description = "위험을 감수하며 큰 이익을 노리는 플레이어";
      traits = ["대담함", "욕심", "모험적"];
      playStyle = "높은 리스크, 높은 리턴을 추구";
    } else {
      type = "변덕형";
      description = "예측 불가능한 창의적 플레이어";
      traits = ["창의적", "예측불가", "직관적"];
      playStyle = "상식을 뛰어넘는 기상천외한 판단";
    }
    
    return { type, description, traits, playStyle };
  }

  /**
   * 현재 상황에서 최선의 액션을 결정합니다.
   * 고급 전략 기반 정교한 의사결정 시스템
   */
  makeDecision(gameState) {
    const { currentCard, pileTokens, players, deckSize, removedCount } = gameState;
    
    // === 게임 컨텍스트 구성 ===
    const gameContext = {
      currentCard,
      pileTokens,
      players,
      gamePhase: this.determineGamePhase(players),
      resourceSituation: this.analyzeResourceSituation(),
      deckSize,
      removedCount
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
      players,
      gameContext
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
   * 중급 전략: 유연하고 사람다운 판단 - 플레이어 수 동적 적응
   */
  advancedMediumStrategy(analysis) {
    const { 
      currentCard, pileTokens, chainValue, resourceSituation, gamePhase, players, gameContext
    } = analysis;
    
    // 플레이어 수에 따른 동적 임계값 계산 (게임 상태 포함)
    const dynamicThresholds = this.calculateDynamicThresholds(currentCard, players, gamePhase, gameContext);
    
    console.log(`${this.nickname} [중급]: 카드 ${currentCard}, 칩 ${pileTokens}, 연결성 ${chainValue.type}, 플레이어 ${players.length}명`);
    console.log(`${this.nickname} [중급]: 동적 임계값 - 좋음: ${dynamicThresholds.good}칩, 수용: ${dynamicThresholds.acceptable}칩`);
    
    // 1. 직접 연결 - 하지만 상황에 따라 유연하게
    if (chainValue.type === 'direct') {
      // 플레이어 수 고려한 전략적 지연 판단
      const shouldTryDelay = this.shouldDelayDirectConnection_Dynamic(
        currentCard, pileTokens, players, resourceSituation, gamePhase
      );
      
      if (shouldTryDelay && Math.random() > 0.3) {
        console.log(`${this.nickname} [중급]: ⭐ 직접 연결이지만 칩 모으기 시도 (${currentCard})`);
        return 'pass';
      }
      
      console.log(`${this.nickname} [중급]: 직접 연결 ${currentCard} 안전하게 취득`);
      return 'take';
    }
    
    // 2. 간접 연결 - 플레이어 수 고려
    if (chainValue.type === 'gap1' && pileTokens >= dynamicThresholds.minimal) {
      console.log(`${this.nickname} [중급]: 간접 연결 + 충분한 칩 ${currentCard} 취득`);
      return 'take';
    }
    
    // 3. 동적 비용-이익 분석
    if (pileTokens >= dynamicThresholds.excellent) {
      console.log(`${this.nickname} [중급]: 🎯 환상적 거래! ${currentCard} 취득 (${pileTokens}칩 vs ${dynamicThresholds.excellent}칩 임계값)`);
      return 'take';
    } else if (pileTokens >= dynamicThresholds.good) {
      console.log(`${this.nickname} [중급]: ✅ 좋은 거래 - ${currentCard} 취득 (${pileTokens}칩)`);
      return 'take';
    } else if (pileTokens >= dynamicThresholds.acceptable && 
               (resourceSituation.tokenCount <= 3 || gamePhase === 'late')) {
      console.log(`${this.nickname} [중급]: 🤔 수용 가능한 거래 - ${currentCard} 취득 (${pileTokens}칩)`);
      return 'take';
    }
    
    // 4. 토큰 관리 (정말 위급할 때만)
    if (resourceSituation.tokenCount <= 0) {
      console.log(`${this.nickname} [중급]: 😫 토큰 없음! ${currentCard} 어쩔 수 없이 취득`);
      // 강제 취득으로 인한 성격 변화
      this.adaptPersonalityFromExperience({ 
        type: 'forced_take', 
        details: { card: currentCard, reason: 'no_tokens' } 
      });
      return 'take';
    }
    
    console.log(`${this.nickname} [중급]: ${currentCard} 패스 (칩 ${pileTokens} < 임계값 ${dynamicThresholds.acceptable})`);
    return 'pass';
  }
  
  /**
   * 상급 전략: 상대방 읽기 + 심리전 - 플레이어 수 동적 적응 
   */
  advancedHardStrategy(analysis) {
    const { 
      currentCard, pileTokens, chainValue, resourceSituation,
      opponentThreats, gamePhase, players, gameContext
    } = analysis;
    
    // 동적 임계값 계산
    const dynamicThresholds = this.calculateDynamicThresholds(currentCard, players, gamePhase, gameContext);
    
    console.log(`${this.nickname} [상급]: 카드 ${currentCard}, 칩 ${pileTokens}, 연결성 ${chainValue.type}, 플레이어 ${players.length}명`);
    console.log(`${this.nickname} [상급]: 동적 임계값 - 좋음: ${dynamicThresholds.good}칩, 환상: ${dynamicThresholds.excellent}칩`);
    
    // 1. 직접 연결 - 더 똑똑한 동적 판단
    if (chainValue.type === 'direct') {
      const shouldTryDelay = this.shouldDelayDirectConnection_Dynamic(
        currentCard, pileTokens, players, resourceSituation, gamePhase
      );
      
      // 60% 확률로 지연 (상급이므로 더 공격적)
      if (shouldTryDelay && Math.random() > 0.4) {
        console.log(`${this.nickname} [상급]: ⭐ 직접 연결 ${currentCard} 전략적 지연 (${players.length}명 고려)`);
        return 'pass';
      }
      
      console.log(`${this.nickname} [상급]: 직접 연결 ${currentCard} 취득`);
      return 'take';
    }
    
    // 2. 간접 연결 - 동적 판단
    if (chainValue.type === 'gap1' && pileTokens >= dynamicThresholds.minimal) {
      console.log(`${this.nickname} [상급]: 간접 연결 + 충분한 칩 ${currentCard} 취득`);
      return 'take';
    }
    
    // 3. 상대방 위협 고려 (동적 조정)
    const threatThreshold = players.length >= 5 ? 40 : 50; // 인원 많으면 더 민감
    if (opponentThreats.maxThreat >= threatThreshold) {
      console.log(`${this.nickname} [상급]: 상대방 위협 높음 - ${currentCard} 선점`);
      return 'take';
    }
    
    // 4. 동적 거래 품질 평가
    if (pileTokens >= dynamicThresholds.excellent) {
      console.log(`${this.nickname} [상급]: 🎯 환상적 거래! ${currentCard} 취득 (${pileTokens}칩)`);
      return 'take';
    } else if (pileTokens >= dynamicThresholds.good) {
      console.log(`${this.nickname} [상급]: ✅ 좋은 거래 - ${currentCard} 취득 (${pileTokens}칩)`);
      return 'take';
    } else if (pileTokens >= dynamicThresholds.acceptable && 
               (resourceSituation.tokenCount <= 2 || gamePhase === 'late')) {
      console.log(`${this.nickname} [상급]: 🤔 수용 가능 - ${currentCard} 취득 (토큰압박 또는 후반)`);
      return 'take';
    }
    
    // 5. 게임 단계별 동적 전략
    if (gamePhase === 'early') {
      // 초반: 플레이어 수 고려한 칩 파밍
      const farmingThreshold = players.length >= 5 ? 3 : 2;
      if (currentCard >= 25 && pileTokens <= farmingThreshold && resourceSituation.tokenCount >= 3) {
        console.log(`${this.nickname} [상급]: 초반 칩 파밍 - ${currentCard} 패스 (${players.length}명)`);
        return 'pass';
      }
    }
    
    // 6. 토큰 관리 (완화)
    if (resourceSituation.tokenCount <= 0) {
      console.log(`${this.nickname} [상급]: 😫 토큰 없음! ${currentCard} 어쩔 수 없이 취득`);
      this.adaptPersonalityFromExperience({ 
        type: 'forced_take', 
        details: { card: currentCard, reason: 'no_tokens' } 
      });
      return 'take';
    }
    
    console.log(`${this.nickname} [상급]: ${currentCard} 패스`);
    return 'pass';
  }
  
  /**
   * 최상급 전략: 실제 인간 고수처럼 플레이 - 완전 동적 적응
   * 직관 + 논리 + 심리전 + 경험 + 플레이어 수 고려
   */
  advancedExpertStrategy(analysis) {
    const { 
      currentCard, pileTokens, chainValue, resourceSituation,
      opponentThreats, gamePhase, players, gameContext
    } = analysis;
    
    // 최고급 동적 임계값 계산
    const dynamicThresholds = this.calculateDynamicThresholds(currentCard, players, gamePhase, gameContext);
    
    console.log(`${this.nickname} [최상급]: 🧠 카드 ${currentCard}, 칩 ${pileTokens}, 연결성 ${chainValue.type}, 플레이어 ${players.length}명, 토큰 ${resourceSituation.tokenCount}`);
    console.log(`${this.nickname} [최상급]: 고급 동적 임계값 - 최소:${dynamicThresholds.minimal}, 수용:${dynamicThresholds.acceptable}, 좋음:${dynamicThresholds.good}, 환상:${dynamicThresholds.excellent}`);
    
    // 내 성격과 플레이 스타일 반영 (개성 있는 AI)
    const myPersonality = this.playVariation; // 0-1 사이
    const isAggressive = myPersonality > 0.7;  // 공격적
    const isConservative = myPersonality < 0.3; // 보수적
    const isUnpredictable = myPersonality > 0.8 || myPersonality < 0.2; // 예측 불가
    
    // === 1. 직접 연결 - 인간 고수의 고급 동적 판단력 ===
    if (chainValue.type === 'direct') {
      console.log(`${this.nickname} [최상급]: 🎯 직접 연결 발견 - 고민 시작... (${players.length}명 상황)`);
      
      // 인간적 사고 과정들 (플레이어 수 고려)
      const thoughts = [];
      let shouldConsiderDelay = false;
      
      // 생각 1: 플레이어 수별 칩 기대값 분석
      const expectedChipsPerPlayer = players.length <= 3 ? 0.8 : players.length <= 5 ? 1.2 : 1.8;
      if (pileTokens < expectedChipsPerPlayer) {
        thoughts.push(`${players.length}명이면 보통 ${expectedChipsPerPlayer.toFixed(1)}칩 정도는 모이는데...`);
        shouldConsiderDelay = true;
      }
      
      // 생각 2: 카드 가치 vs 동적 기대값
      if (currentCard >= 25 && pileTokens < dynamicThresholds.minimal) {
        thoughts.push(`${currentCard}카드인데 칩이 ${pileTokens}개? 좀 더 기다려볼까?`);
        if (resourceSituation.tokenCount >= 3) shouldConsiderDelay = true;
      }
      
      // 생각 3: 게임 단계와 플레이어 수 종합 판단
      if (gamePhase === 'early' && players.length >= 4) {
        thoughts.push(`초반이고 ${players.length}명이니까 칩 파밍할 여지가 있어`);
        shouldConsiderDelay = true;
      } else if (gamePhase === 'late') {
        thoughts.push("후반이니 안전하게 가져가자");
        shouldConsiderDelay = false;
      }
      
      // 생각 4: 성격 + 상황 종합
      if (isAggressive && players.length >= 5) {
        thoughts.push(`${players.length}명이면 칩 많이 모일 텐데... 욕심내보자!`);
        shouldConsiderDelay = shouldConsiderDelay && Math.random() > 0.2;
      } else if (isConservative) {
        thoughts.push("안전하게 확실한 걸로 가져가자");
        shouldConsiderDelay = false;
      }
      
      console.log(`${this.nickname} [최상급]: 💭 "${thoughts[Math.floor(Math.random() * thoughts.length)]}"`);
      
      // 최종 결정 (고급 확률 계산)
      if (shouldConsiderDelay) {
        let delayProbability = isAggressive ? 0.7 : isConservative ? 0.1 : 0.5;
        // 플레이어 수별 추가 조정
        if (players.length >= 5) delayProbability += 0.2;
        delayProbability = Math.min(0.8, delayProbability); // 최대 80%
        
        if (Math.random() < delayProbability) {
          console.log(`${this.nickname} [최상급]: ⭐ 직접 연결 ${currentCard}... 하지만 더 노려본다! 🎲 (확률:${Math.round(delayProbability*100)}%)`);
          return 'pass';
        }
      }
      
      console.log(`${this.nickname} [최상급]: ✅ 직접 연결 ${currentCard} 확실하게 취득!`);
      return 'take';
    }
    
    // === 2. 간접 연결 - 동적 기회 포착 ===
    if (chainValue.type === 'gap1') {
      if (pileTokens >= dynamicThresholds.minimal) {
        console.log(`${this.nickname} [최상급]: 🎯 간접 연결 기회! ${currentCard} 취득`);
        return 'take';
      }
    }
    
    // === 3. 상대방 읽기 (심리전) - 동적 조정 ===
    let opponentAnalysis = "상대방 분석 중...";
    const adaptiveThreatThreshold = players.length >= 5 ? 35 : players.length >= 4 ? 40 : 50;
    
    if (opponentThreats.maxThreat >= adaptiveThreatThreshold) {
      opponentAnalysis = `누군가 이 카드를 노리고 있다! (${players.length}명 중)`;
      if (chainValue.value >= 30 || pileTokens >= dynamicThresholds.minimal) {
        console.log(`${this.nickname} [최상급]: 🔥 ${opponentAnalysis} 선점한다! ${currentCard}`);
        return 'take';
      }
    } else {
      opponentAnalysis = "다들 관심 없어 보인다";
    }
    
    console.log(`${this.nickname} [최상급]: 👁️ ${opponentAnalysis}`);
    
    // === 4. 동적 거래 품질 평가 (최고급) ===
    if (pileTokens >= dynamicThresholds.excellent) {
      console.log(`${this.nickname} [최상급]: 🎯 환상적 거래! ${currentCard} 취득 (${pileTokens}칩 vs ${dynamicThresholds.excellent}칩 임계값)`);
      return 'take';
    } else if (pileTokens >= dynamicThresholds.good) {
      console.log(`${this.nickname} [최상급]: ✅ 좋은 거래! ${currentCard} 취득 (${pileTokens}칩)`);
      return 'take';
    } else if (pileTokens >= dynamicThresholds.acceptable && resourceSituation.tokenCount <= 2) {
      console.log(`${this.nickname} [최상급]: 🤔 수용 가능 + 토큰 압박으로 ${currentCard} 취득`);
      return 'take';
    }
    
    // === 5. 고급 플레이어 수 기반 칩 파밍 ===
    if (gamePhase === 'early') {
      const farmingThreshold = Math.max(2, Math.round(players.length * 0.6)); // 플레이어 수 기반
      const greedFactor = isAggressive ? 0.7 : isConservative ? 0.2 : 0.4;
      
      if (currentCard >= 25 && pileTokens <= farmingThreshold && 
          resourceSituation.tokenCount >= 3 && Math.random() < greedFactor) {
        console.log(`${this.nickname} [최상급]: 💰 ${players.length}명 상황에서 칩 파밍 시도! ${currentCard} 패스`);
        return 'pass';
      }
    }
    
    // === 6. 예측 불가능성 (인간다운 변덕) ===
    if (isUnpredictable && Math.random() < 0.15) {
      const randomDecision = Math.random() > 0.5 ? 'take' : 'pass';
      console.log(`${this.nickname} [최상급]: 🎲 예측불가 모드! ${currentCard} ${randomDecision === 'take' ? '취득' : '패스'}!`);
      return randomDecision;
    }
    
    // === 7. 마지막 토큰 체크 (완화됨) ===
    if (resourceSituation.tokenCount <= 0) {
      console.log(`${this.nickname} [최상급]: 😫 토큰 없음... ${currentCard} 어쩔 수 없이 취득`);
      // 강제 취득으로 인한 성격 변화
      this.adaptPersonalityFromExperience({ 
        type: 'forced_take', 
        details: { card: currentCard, reason: 'no_tokens' } 
      });
      return 'take';
    }
    
    console.log(`${this.nickname} [최상급]: 🤔 ${currentCard} 별로네... 패스! (칩 ${pileTokens} < 임계값 ${dynamicThresholds.acceptable})`);
    return 'pass';
  }
  
  // === 고급 전략 시스템 ===
  
  /**
   * 직접 연결 카드도 전략적으로 지연할지 결정 (실용적 버전)
   * 핵심: 칩이 적을 때는 연결 카드라도 돌려서 더 모으기
   */
  shouldDelayDirectConnection(currentCard, connectedCards, gameContext) {
    const { pileTokens, players, gamePhase, resourceSituation } = gameContext;
    
    console.log(`${this.nickname}: 직접 연결 ${currentCard} 지연 검토 - 칩:${pileTokens}, 토큰:${resourceSituation.tokenCount}, 단계:${gamePhase}`);
    
    // 기본 조건: 토큰이 부족하면 지연 불가
    if (resourceSituation.tokenCount < 2) {
      console.log(`${this.nickname}: 토큰 부족 (${resourceSituation.tokenCount}) - 지연 불가`);
      return false;
    }
    
    // 게임 후반이면 안전하게 가져가기
    if (gamePhase === 'late') {
      console.log(`${this.nickname}: 게임 후반 - 안전하게 가져가기`);
      return false;
    }
    
    // 실용적 지연 조건들 (OR 연산자로 유연성 증가)
    let shouldDelay = false;
    let reason = "";
    
    // 조건 1: 칩이 매우 적고 토큰이 충분할 때
    if (pileTokens <= 1 && resourceSituation.tokenCount >= 4) {
      shouldDelay = true;
      reason = `칩 적음(${pileTokens}) + 토큰 충분(${resourceSituation.tokenCount})`;
    }
    
    // 조건 2: 초반이고 칩이 적을 때
    if (gamePhase === 'early' && pileTokens <= 2 && resourceSituation.tokenCount >= 3) {
      shouldDelay = true;
      reason = `초반 + 칩 적음(${pileTokens}) + 토큰 있음(${resourceSituation.tokenCount})`;
    }
    
    // 조건 3: 높은 카드이고 칩이 적을 때 (웹 검색 전략)
    if (currentCard >= 25 && pileTokens <= 1 && resourceSituation.tokenCount >= 3) {
      shouldDelay = true;
      reason = `높은 카드(${currentCard}) + 칩 없음 + 토큰 있음`;
    }
    
    if (shouldDelay) {
      console.log(`${this.nickname}: ⭐ 직접 연결 ${currentCard} 전략적 지연! 이유: ${reason}`);
    } else {
      console.log(`${this.nickname}: 직접 연결 ${currentCard} 즉시 취득`);
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
  
  // === 새로운 동적 임계값 시스템 ===
  
  /**
   * 개인 성향 + 게임 상태를 모두 고려한 동적 임계값 계산
   * 핵심: 플레이어마다 다른 리스크 성향 + 남은 카드/제거 카드 상황 고려
   */
  calculateDynamicThresholds(currentCard, players, gamePhase, gameState = null) {
    const playerCount = players.length;
    const myPersonality = this.playVariation;
    
    // === 1. 개인 성향 다양성 (핵심 개선) ===
    let personalityType = "";
    let riskTolerance = 1.0; // 기본 리스크 허용도
    
    if (myPersonality < 0.15) {
      personalityType = "초극보수형";
      riskTolerance = 0.4; // 2칩도 아까워하는 타입
    } else if (myPersonality < 0.3) {
      personalityType = "보수형";
      riskTolerance = 0.6; // 2-3칩까지만
    } else if (myPersonality < 0.5) {
      personalityType = "신중형";
      riskTolerance = 0.8; // 적당히
    } else if (myPersonality < 0.7) {
      personalityType = "균형형";
      riskTolerance = 1.0; // 표준
    } else if (myPersonality < 0.85) {
      personalityType = "적극형";
      riskTolerance = 1.3; // 4-5칩까지 가능
    } else {
      personalityType = "대담형";
      riskTolerance = 1.6; // 5칩 이상도 가능
    }
    
    // === 2. 게임 상태 인지 (남은 카드/제거 카드) ===
    let gameStateMultiplier = 1.0;
    let gameStateReason = "";
    
    if (gameState && typeof gameState.deckSize !== 'undefined') {
      const deckSize = gameState.deckSize;
      const removedCount = gameState.removedCount || 9;
      
      // 남은 카드가 매우 적을 때 (연결성 확률 낮아짐)
      if (deckSize <= 3) {
        gameStateMultiplier = 1.4; // 더 신중하게 (연결 어려움)
        gameStateReason = `덱 ${deckSize}장 남음 - 연결 어려움`;
      } else if (deckSize <= 8) {
        gameStateMultiplier = 1.2; // 약간 신중
        gameStateReason = `덱 ${deckSize}장 - 연결 제한적`;
      } else if (deckSize >= 20) {
        gameStateMultiplier = 0.9; // 연결 기회 많음
        gameStateReason = `덱 ${deckSize}장 - 연결 기회 풍부`;
      }
    }
    
    // === 3. 플레이어 수 기반 배율 ===
    let playerMultiplier;
    if (playerCount <= 3) {
      playerMultiplier = 0.7; // 적은 인원: 칩 적게 쌓임
    } else if (playerCount <= 4) {
      playerMultiplier = 0.85;
    } else if (playerCount <= 5) {
      playerMultiplier = 1.0; // 표준
    } else if (playerCount <= 6) {
      playerMultiplier = 1.15;
    } else {
      playerMultiplier = 1.3; // 많은 인원: 칩 많이 쌓임
    }
    
    // === 4. 게임 단계별 조정 ===
    let phaseMultiplier = 1.0;
    if (gamePhase === 'early') {
      phaseMultiplier = 0.8; // 초반 더 관대
    } else if (gamePhase === 'late') {
      phaseMultiplier = 1.2; // 후반 더 신중
    }
    
    // === 5. 카드별 기본값 계산 ===
    const baseThreshold = Math.max(1, currentCard * 0.06); // 6% 기준
    
    // === 6. 최종 배율 적용 ===
    const finalMultiplier = playerMultiplier * phaseMultiplier * riskTolerance * gameStateMultiplier;
    
    const thresholds = {
      minimal: Math.max(1, Math.round(baseThreshold * 0.4 * finalMultiplier)), // 최소한 (더 낮춤)
      acceptable: Math.max(1, Math.round(baseThreshold * finalMultiplier)), // 수용 가능
      good: Math.max(1, Math.round(baseThreshold * 1.5 * finalMultiplier)), // 좋은 거래  
      excellent: Math.max(2, Math.round(baseThreshold * 2.5 * finalMultiplier)), // 환상적
      playerCount,
      finalMultiplier,
      personalityType,
      riskTolerance,
      gameStateReason
    };
    
    console.log(`${this.nickname}: 🎭 성향: ${personalityType} (위험성향: ${riskTolerance.toFixed(1)}x)`);
    console.log(`${this.nickname}: 📊 게임상태: ${gameStateReason || "정상"}`);
    console.log(`${this.nickname}: 💰 동적임계값 [${playerCount}명] - 최소:${thresholds.minimal}, 수용:${thresholds.acceptable}, 좋음:${thresholds.good}, 환상:${thresholds.excellent}`);
    
    return thresholds;
  }
  
  /**
   * 플레이어 수 고려한 직접 연결 지연 판단
   */
  shouldDelayDirectConnection_Dynamic(currentCard, pileTokens, players, resourceSituation, gamePhase) {
    const playerCount = players.length;
    
    // 기본 조건: 토큰이 부족하면 지연 불가
    if (resourceSituation.tokenCount < 2) return false;
    
    // 게임 후반이면 안전하게 가져가기  
    if (gamePhase === 'late') return false;
    
    // 플레이어 수별 칩 기대값
    let expectedChipsPerRound;
    if (playerCount <= 3) {
      expectedChipsPerRound = 0.8; // 적은 인원
    } else if (playerCount <= 5) {
      expectedChipsPerRound = 1.2; // 보통
    } else {
      expectedChipsPerRound = 1.8; // 많은 인원
    }
    
    // 현재 칩 vs 기대 칩 비교
    const potentialGain = expectedChipsPerRound - 1; // 토큰 1개 소모 고려
    const currentValue = pileTokens;
    
    // 지연할 가치가 있는지 판단
    const shouldDelay = (currentValue === 0 && potentialGain > 0.5) || // 칩 없을 때 기대값 있으면
                        (currentValue <= 1 && potentialGain > 1) || // 칩 적을 때 큰 기대값
                        (gamePhase === 'early' && currentCard >= 25 && currentValue <= 2); // 초반 큰 카드
    
    if (shouldDelay) {
      console.log(`${this.nickname}: 직접연결 지연 고려 - 현재칩:${pileTokens}, 기대칩/라운드:${expectedChipsPerRound}, 플레이어:${playerCount}명`);
    }
    
    return shouldDelay;
  }

  // === 동적 성격 변화 시스템 ===
  
  /**
   * 게임 경험에 따른 성격 동적 변화
   */
  adaptPersonalityFromExperience(experience) {
    this.recentExperiences.push({
      ...experience,
      timestamp: Date.now()
    });
    
    // 최근 5개 경험만 유지
    if (this.recentExperiences.length > 5) {
      this.recentExperiences.shift();
    }
    
    const oldPersonality = this.playVariation;
    let personalityShift = 0;
    
    // 경험 유형별 성격 변화
    switch (experience.type) {
      case 'successful_farm':
        // 칩 파밍 성공 → 더 공격적으로
        personalityShift = +0.05;
        console.log(`${this.nickname}: 💰 칩 파밍 성공! 더 공격적으로 변화 (+0.05)`);
        break;
        
      case 'failed_farm':
        // 칩 파밍 실패 → 더 보수적으로  
        personalityShift = -0.03;
        console.log(`${this.nickname}: 😞 칩 파밍 실패... 더 신중해짐 (-0.03)`);
        break;
        
      case 'good_deal':
        // 좋은 거래 → 약간 더 관대하게
        personalityShift = +0.02;
        console.log(`${this.nickname}: ✅ 좋은 거래! 약간 더 관대해짐 (+0.02)`);
        break;
        
      case 'bad_deal':
        // 나쁜 거래 → 더 까다롭게
        personalityShift = -0.04;
        console.log(`${this.nickname}: 😤 나쁜 거래... 더 까다로워짐 (-0.04)`);
        break;
        
      case 'forced_take':
        // 토큰 부족으로 강제 취득 → 더 계획적으로
        personalityShift = -0.06;
        console.log(`${this.nickname}: 😫 강제 취득... 더 계획적으로 변화 (-0.06)`);
        break;
        
      case 'won_auction':
        // 경매에서 승리 → 약간 더 자신감
        personalityShift = +0.03;
        console.log(`${this.nickname}: 🎯 경매 승리! 자신감 상승 (+0.03)`);
        break;
    }
    
    // 성격 변화 적용 (기본 성격에서 너무 멀어지지 않도록 제한)
    this.playVariation = Math.max(0.05, Math.min(0.95, 
      this.playVariation + personalityShift
    ));
    
    // 기본 성격에서 0.3 이상 벗어나지 않도록 제한
    const maxDeviation = 0.3;
    if (Math.abs(this.playVariation - this.basePersonality) > maxDeviation) {
      if (this.playVariation > this.basePersonality) {
        this.playVariation = this.basePersonality + maxDeviation;
      } else {
        this.playVariation = this.basePersonality - maxDeviation;
      }
    }
    
    // 변화 기록
    if (Math.abs(personalityShift) > 0.01) {
      this.personalityShifts.push({
        from: oldPersonality.toFixed(3),
        to: this.playVariation.toFixed(3),
        shift: personalityShift.toFixed(3),
        reason: experience.type,
        timestamp: Date.now()
      });
      
      console.log(`${this.nickname}: 🎭 성격 변화: ${oldPersonality.toFixed(2)} → ${this.playVariation.toFixed(2)} (${experience.type})`);
    }
  }
  
  /**
   * 현재 성격 상태 분석 (실시간)
   */
  getCurrentPersonalityState() {
    const current = this.playVariation;
    const base = this.basePersonality;
    const deviation = current - base;
    
    let state = "";
    if (Math.abs(deviation) < 0.05) {
      state = "안정적";
    } else if (deviation > 0.15) {
      state = "매우 공격적";
    } else if (deviation > 0.05) {
      state = "공격적";
    } else if (deviation < -0.15) {
      state = "매우 보수적";
    } else {
      state = "보수적";
    }
    
    return {
      current: current.toFixed(3),
      base: base.toFixed(3),
      deviation: deviation.toFixed(3),
      state,
      recentShifts: this.personalityShifts.slice(-3)
    };
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
    
    // 거래 품질 분석 후 성격 변화
    const dealQuality = this.analyzeDealQuality(cardNumber, tokens);
    if (dealQuality === 'excellent') {
      this.adaptPersonalityFromExperience({ type: 'good_deal', details: { card: cardNumber, tokens } });
    } else if (dealQuality === 'poor') {
      this.adaptPersonalityFromExperience({ type: 'bad_deal', details: { card: cardNumber, tokens } });
    }
  }
  
  /**
   * 거래 품질 분석 (성격 변화 트리거용)
   */
  analyzeDealQuality(cardNumber, tokens) {
    // 카드 점수 대비 얻은 토큰 비율로 거래 품질 평가
    const cardValue = cardNumber; // 카드 자체가 점수
    const tokenValue = tokens; // 얻은 토큰 수
    
    // 연결성 보너스 계산
    let connectionBonus = 0;
    for (const ownCard of this.cards) {
      const distance = Math.abs(ownCard - cardNumber);
      if (distance === 1) {
        connectionBonus += 10; // 직접 연결 큰 보너스
      } else if (distance === 2) {
        connectionBonus += 5; // 간접 연결 보너스
      }
    }
    
    // 실제 손해/이익 계산 (토큰 + 연결 보너스 - 카드 점수)
    const netValue = tokenValue + connectionBonus - cardValue;
    
    // 거래 품질 판정
    if (netValue >= 5) {
      return 'excellent';
    } else if (netValue >= 0) {
      return 'good';
    } else if (netValue >= -10) {
      return 'acceptable';
    } else {
      return 'poor';
    }
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
  
  /**
   * 칩 파밍 결과에 따른 성격 변화 (외부에서 호출)
   */
  recordFarmingResult(successful, details = {}) {
    if (successful) {
      this.adaptPersonalityFromExperience({ 
        type: 'successful_farm', 
        details 
      });
    } else {
      this.adaptPersonalityFromExperience({ 
        type: 'failed_farm', 
        details 
      });
    }
  }
  
  /**
   * 경매 승리 기록 (외부에서 호출)
   */
  recordAuctionWin(cardNumber, finalTokens) {
    this.adaptPersonalityFromExperience({ 
      type: 'won_auction', 
      details: { card: cardNumber, tokens: finalTokens } 
    });
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