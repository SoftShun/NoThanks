/*
 * AI 봇 시스템 for No Thanks! 게임
 * 
 * 3단계 난이도를 제공하며, 각 봇은 사람과 동일한 정보만 사용합니다.
 * 비공개 모드에서는 상대방의 토큰 정보를 사용하지 않습니다.
 */

class Bot {
  constructor(id, nickname, difficulty = 'medium') {
    this.id = id;
    this.nickname = nickname;
    this.difficulty = difficulty; // 'medium', 'hard', 'expert'
    this.tokens = 0;
    this.cards = [];
    this.isBot = true;
    
    // 플레이어별 분석 데이터
    this.playerProfiles = new Map(); // 각 플레이어의 행동 패턴 저장
    this.gameHistory = []; // 게임 내 행동 기록
    
    // === No Thanks! 전략 스타일 시스템 ===
    this.playStyle = this.selectPlayStyle(difficulty); // 플레이 스타일 선택
    this.personality = this.generatePersonality(); // 성격 특성
    this.adaptiveMode = Math.random() > 0.5; // 적응형 모드 여부
    this.currentStrategy = null; // 현재 사용 중인 전략
    this.strategyHistory = []; // 전략 변경 이력
    
    console.log(`${this.nickname} - 스타일: ${this.playStyle}, 성격: ${JSON.stringify(this.personality)}, 적응형: ${this.adaptiveMode}`);
  }

  /**
   * 플레이 스타일을 선택합니다.
   */
  selectPlayStyle(difficulty) {
    const styles = {
      medium: ['conservative', 'greedy', 'sequence_focused', 'random'],
      hard: ['balanced', 'aggressive', 'defensive', 'psychological', 'adaptive', 'token_farmer'],
      expert: ['masterful', 'manipulative', 'game_theory', 'perfect_information', 'meta_adaptive', 'hybrid']
    };
    
    const availableStyles = styles[difficulty] || styles.medium;
    return availableStyles[Math.floor(Math.random() * availableStyles.length)];
  }

  /**
   * 성격 특성을 생성합니다.
   */
  generatePersonality() {
    return {
      riskTolerance: Math.random(), // 0: 매우 보수적, 1: 매우 공격적
      greediness: Math.random(), // 토큰에 대한 욕심
      patience: Math.random(), // 인내심 (긴 게임 플레이)
      bluffing: Math.random(), // 블러핑 성향
      vindictiveness: Math.random(), // 복수심 (견제 성향)
      adaptability: Math.random(), // 적응력
      socialAwareness: Math.random(), // 다른 플레이어 인식도
      sequenceObsession: Math.random() // 연속성에 대한 집착도
    };
  }

  /**
   * 현재 상황에서 최선의 액션을 결정합니다.
   * @param {Object} gameState 게임 상태
   * @returns {string} 'pass' 또는 'take'
   */
  makeDecision(gameState) {
    const { currentCard, pileTokens, gameSettings, players, deckSize, removedCount } = gameState;
    
    // 게임 상태 정보를 봇 내부에 저장
    this.gameInfo = {
      deckSize,
      removedCount,
      totalRemovedCards: removedCount || 9, // 기본값 9개
      originalDeckSize: 33 // 3-35 카드
    };
    
    // 모든 상대방(AI 봇 포함) 프로파일 업데이트
    this.updateAllPlayerProfiles(players, gameState);
    
    // === 스타일 기반 전략 적응 ===
    if (this.adaptiveMode) {
      this.adaptStrategyToSituation(gameState, players);
    }
    
    // 현재 스타일에 따른 의사결정 가중치 적용
    const styleModifiers = this.getStyleModifiers();
    const personalityModifiers = this.getPersonalityModifiers(gameState);
    
    // 기본적으로 현재 카드의 가치를 평가
    const cardValue = this.evaluateCardValue(currentCard, gameSettings, players);
    const tokenCost = this.evaluateTokenCost(pileTokens);
    
    // 동적 토큰 가치 시스템 적용
    const dynamicTokenValue = this.evaluateDynamicTokenValue(gameState, players);
    const tokenROI = this.calculateTokenROI(currentCard, pileTokens, gameState, players);
    
    // 플레이어별 맞춤 전략 계산 (모든 플레이어 대상)
    let competitiveStrategy = 0;
    for (const player of players) {
      if (player.id !== this.id) {
        competitiveStrategy += this.calculatePlayerSpecificStrategy(
          player.id, currentCard, pileTokens, gameState
        );
      }
    }
    
    // 스타일별 특수 전략 적용
    const styleStrategy = this.applyPlayStyleStrategy(currentCard, pileTokens, players, gameState);
    
    // 확장된 메트릭스
    const enhancedMetrics = {
      dynamicTokenValue,
      tokenROI,
      competitiveStrategy: competitiveStrategy * (this.difficulty === 'expert' ? 1.0 : this.difficulty === 'hard' ? 0.7 : 0.3),
      pileTokens,
      styleModifiers,
      personalityModifiers,
      styleStrategy
    };
    
    // 난이도별 의사결정
    switch (this.difficulty) {
      case 'medium':
        return this.mediumDecision(cardValue, tokenCost, gameSettings, players, enhancedMetrics, currentCard);
      case 'hard':
        return this.hardDecision(cardValue, tokenCost, gameSettings, players, currentCard, enhancedMetrics);
      case 'expert':
        return this.expertDecision(cardValue, tokenCost, gameSettings, players, currentCard, enhancedMetrics);
      default:
        return this.mediumDecision(cardValue, tokenCost, gameSettings, players, enhancedMetrics, currentCard);
    }
  }

  /**
   * 상황에 따라 전략을 적응시킵니다.
   */
  adaptStrategyToSituation(gameState, players) {
    const gameProgress = this.estimateGameProgress(players);
    const myPosition = this.evaluateMyPosition(players);
    const opponentStrengths = this.analyzeOpponentStrengths(players);
    
    let newStrategy = this.playStyle;
    
    // 게임 후반부 전략 변경
    if (gameProgress > 0.7) {
      if (myPosition === 'leading') {
        newStrategy = 'defensive';
      } else if (myPosition === 'behind') {
        newStrategy = 'aggressive';
      }
    }
    
    // 상대가 너무 강하면 심리전 모드
    if (opponentStrengths.some(strength => strength > 0.8)) {
      newStrategy = 'psychological';
    }
    
    // 전략 변경 기록
    if (newStrategy !== this.currentStrategy) {
      this.strategyHistory.push({
        oldStrategy: this.currentStrategy,
        newStrategy,
        gameProgress,
        reason: '상황 적응'
      });
      this.currentStrategy = newStrategy;
    }
  }

  /**
   * 스타일별 modifier 반환
   */
  getStyleModifiers() {
    const modifiers = {
      // 보수성 (낮을수록 보수적)
      conservatism: 0.5,
      // 토큰 욕심 (높을수록 토큰을 더 중요하게 여김)
      tokenGreed: 0.5,
      // 연속성 중시도 (높을수록 시퀀스를 더 중요하게 여김)
      sequenceFocus: 0.5,
      // 심리전 성향 (높을수록 상대방을 더 의식함)
      psychologicalTendency: 0.5,
      // 위험 감수도 (높을수록 위험한 선택을 함)
      riskTaking: 0.5
    };

    switch (this.playStyle) {
      case 'conservative':
        modifiers.conservatism = 0.2;
        modifiers.riskTaking = 0.1;
        break;
      case 'aggressive':
        modifiers.conservatism = 0.8;
        modifiers.riskTaking = 0.9;
        modifiers.psychologicalTendency = 0.7;
        break;
      case 'greedy':
        modifiers.tokenGreed = 0.9;
        modifiers.conservatism = 0.7;
        break;
      case 'sequence_focused':
        modifiers.sequenceFocus = 0.9;
        modifiers.tokenGreed = 0.3;
        break;
      case 'psychological':
        modifiers.psychologicalTendency = 0.9;
        modifiers.riskTaking = 0.6;
        break;
      case 'token_farmer':
        modifiers.tokenGreed = 0.95;
        modifiers.conservatism = 0.3;
        break;
      case 'defensive':
        modifiers.conservatism = 0.15;
        modifiers.psychologicalTendency = 0.8;
        break;
      case 'masterful':
        modifiers.conservatism = 0.4;
        modifiers.psychologicalTendency = 0.8;
        modifiers.sequenceFocus = 0.7;
        break;
      case 'manipulative':
        modifiers.psychologicalTendency = 0.95;
        modifiers.riskTaking = 0.7;
        break;
    }

    return modifiers;
  }

  /**
   * 성격 기반 modifier 반환
   */
  getPersonalityModifiers(gameState) {
    return {
      riskBonus: this.personality.riskTolerance * 2 - 1, // -1 to 1
      greedBonus: this.personality.greediness * 3 - 1.5, // -1.5 to 1.5
      patienceBonus: this.personality.patience * 2 - 1,
      bluffBonus: this.personality.bluffing * 4 - 2, // -2 to 2
      vindictiveBonus: this.personality.vindictiveness * 2 - 1,
      adaptBonus: this.personality.adaptability * 1.5 - 0.75,
      socialBonus: this.personality.socialAwareness * 2 - 1,
      sequenceBonus: this.personality.sequenceObsession * 3 - 1.5
    };
  }

  /**
   * 플레이 스타일별 특수 전략 적용
   */
  applyPlayStyleStrategy(currentCard, pileTokens, players, gameState) {
    let strategyValue = 0;

    switch (this.playStyle) {
      case 'conservative':
        // 매우 보수적: 높은 카드는 무조건 피하고, 낮은 카드만 선별적으로
        if (currentCard >= 20) strategyValue -= 5;
        if (pileTokens < 3) strategyValue -= 2;
        break;

      case 'greedy':
        // 탐욕적: 토큰이 쌓이면 적극적으로 가져가기
        strategyValue += pileTokens * 1.5;
        if (pileTokens >= 4) strategyValue += 3;
        break;

      case 'sequence_focused':
        // 연속성 중심: 시퀀스 완성에 매우 집중 (하지만 토큰 파밍도 고려)
        const sequenceValue = this.evaluateSequencePotential(currentCard);
        const tokenFarmingValue = this.evaluateTokenFarmingOpportunity(currentCard, pileTokens, players);
        
        // 연속성과 토큰 파밍 중 더 유리한 것 선택
        if (tokenFarmingValue > sequenceValue * 1.5) {
          strategyValue += tokenFarmingValue * 2; // 토큰 파밍이 더 유리하면 패스 경향
        } else {
          strategyValue += sequenceValue * 2; // 기존 3에서 2로 조정
        }
        
        // 연속성이 없으면 더 보수적
        if (sequenceValue === 0 && currentCard >= 15) strategyValue -= 3;
        break;

      case 'aggressive':
        // 공격적: 상대방 견제와 위험 감수 (하지만 토큰 파밍 기회도 고려)
        const blockValue = this.evaluateOpponentBlocking(players, currentCard);
        const aggressiveFarmingValue = this.evaluateTokenFarmingOpportunity(currentCard, pileTokens, players);
        
        // 공격적이지만 합리적인 판단
        if (aggressiveFarmingValue > 3 && pileTokens < 2) {
          strategyValue -= aggressiveFarmingValue * 0.8; // 토큰 파밍이 유리하면 패스 고려
        }
        
        strategyValue += blockValue * 1.5;
        strategyValue += this.personality.riskTolerance * 2;
        break;

      case 'psychological':
        // 심리전: 상대방의 패턴을 이용한 플레이
        const psychValue = this.evaluatePsychologicalAdvantage(players, currentCard);
        const psychFarmingValue = this.evaluateTokenFarmingOpportunity(currentCard, pileTokens, players);
        
        // 심리전에서 토큰 파밍을 무기로 활용
        if (psychFarmingValue > 2) {
          strategyValue -= psychFarmingValue * 1.2; // 더 적극적으로 토큰 파밍 활용
        }
        
        strategyValue += psychValue * 2;
        break;

      case 'token_farmer':
        // 토큰 파머: 토큰 축적에 최적화
        const farmingValue = this.evaluateTokenFarmingOpportunity(currentCard, pileTokens, players);
        
        if (farmingValue > 2) {
          strategyValue -= farmingValue * 2.5; // 토큰 파밍 기회가 있으면 강하게 패스
        } else if (pileTokens >= 3) {
          strategyValue += pileTokens * 2; // 충분히 쌓였으면 가져가기
        }
        
        if (this.tokens < 5) strategyValue -= 2; // 토큰이 적으면 더 보수적
        break;

      case 'defensive':
        // 수비적: 실수하지 않는 것이 최우선
        if (currentCard >= 25) strategyValue -= 6;
        const leadingPlayer = this.findLeadingPlayer(players);
        if (leadingPlayer && leadingPlayer.id !== this.id) {
          strategyValue -= 2; // 더 보수적으로
        }
        break;

      case 'masterful':
        // 대가급: 모든 요소를 종합적으로 고려
        const gamePhase = this.estimateGameProgress(players);
        if (gamePhase < 0.3) { // 초반
          strategyValue += this.evaluateEarlyGameStrategy(currentCard, pileTokens);
        } else if (gamePhase > 0.7) { // 후반
          strategyValue += this.evaluateEndGameStrategy(currentCard, players, gameState);
        }
        break;

      case 'manipulative':
        // 조작적: 상대방의 행동을 유도
        const manipValue = this.evaluateManipulationOpportunity(players, currentCard, gameState);
        strategyValue += manipValue * 1.8;
        break;

      case 'adaptive':
        // 적응형: 상황에 따라 유연하게 대응
        const adaptValue = this.evaluateAdaptiveStrategy(players, currentCard);
        strategyValue += adaptValue * this.personality.adaptability;
        break;
    }

    return strategyValue;
  }

  /**
   * 모든 플레이어의 프로파일을 실시간으로 업데이트
   */
  updateAllPlayerProfiles(players, gameState) {
    for (const player of players) {
      if (player.id === this.id) continue; // 자신 제외
      
      // 모든 플레이어(AI 봇 포함) 프로파일 초기화
      this.initializePlayerProfile(player.id);
      
      // 현재 상황 기반으로 행동 패턴 추정
      const hasSequence = this.checkPlayerSequences(player);
      const gameProgress = this.estimateGameProgress(players);
      
      // 가상의 컨텍스트로 프로파일 업데이트
      const context = {
        card: gameState.currentCard,
        tokens: player.tokens,
        pileTokens: gameState.pileTokens,
        gameProgress,
        hasSequence
      };
      
      // 플레이어의 카드 보유 패턴으로부터 성향 분석
      this.analyzePlayerTendencies(player.id, player, context);
    }
  }

  /**
   * 플레이어의 연속 카드 보유 상황 확인
   */
  checkPlayerSequences(player) {
    if (player.cards.length < 2) return false;
    
    const sortedCards = player.cards.slice().sort((a, b) => a - b);
    for (let i = 0; i < sortedCards.length - 1; i++) {
      if (sortedCards[i + 1] - sortedCards[i] === 1) {
        return true;
      }
    }
    return false;
  }

  /**
   * 플레이어의 카드 보유 패턴으로부터 성향 분석
   */
  analyzePlayerTendencies(playerId, player, context) {
    const profile = this.playerProfiles.get(playerId);
    
    // 카드 평균값으로 리스크 성향 분석
    if (player.cards.length > 0) {
      const avgCard = player.cards.reduce((sum, card) => sum + card, 0) / player.cards.length;
      
      if (avgCard < 18) {
        profile.cardPreferences.lowCardTendency += 0.05;
        profile.cardPreferences.riskTolerance += 0.03;
      } else if (avgCard > 25) {
        profile.cardPreferences.riskTolerance -= 0.05;
      }
    }
    
    // 토큰 보유량으로 보수성 분석
    const tokenRatio = player.tokens / 11; // 초기 토큰 기준
    if (tokenRatio > 0.7) {
      profile.tokenBehavior.conservation += 0.03;
    } else if (tokenRatio < 0.3) {
      profile.tokenBehavior.aggressiveness += 0.05;
    }
    
    // AI 봇이면 성격 부여
    if (player.isBot && playerId !== this.id) {
      this.assignBotPersonality(profile, player);
    }
  }

  /**
   * 다른 AI 봇에게 개성 부여
   */
  assignBotPersonality(profile, botPlayer) {
    // 봇의 난이도에 따라 다른 성격 특성 부여
    const botDifficulty = botPlayer.difficulty || 'medium';
    
    switch (botDifficulty) {
      case 'medium':
        // 중급 봇은 예측 가능한 패턴
        profile.psychology.stubborn = 0.7;
        profile.tokenBehavior.conservation = 0.6;
        break;
      case 'hard':
        // 상급 봇은 적당히 공격적
        profile.tokenBehavior.aggressiveness = 0.7;
        profile.cardPreferences.riskTolerance = 0.6;
        break;
      case 'expert':
        // 최상급 봇은 매우 계산적
        profile.psychology.reactive = 0.8;
        profile.cardPreferences.sequenceHunter = 0.8;
        break;
    }
  }

  /**
   * 카드의 가치를 평가합니다.
   */
  evaluateCardValue(card, gameSettings, players) {
    if (!card) return 0;

    let value = -card; // 기본적으로 카드 번호가 클수록 나쁨
    
    // 내 카드와의 연속성 보너스 계산
    const myCards = this.cards.slice().sort((a, b) => a - b);
    for (const myCard of myCards) {
      if (Math.abs(card - myCard) === 1) {
        value += 5; // 연속성 보너스
      }
    }

    // 낮은 카드일수록 더 가치 있음
    if (card <= 10) value += 3;
    else if (card <= 20) value += 1;

    return value;
  }

  /**
   * 토큰 비용을 평가합니다.
   */
  evaluateTokenCost(pileTokens) {
    return pileTokens * 2; // 토큰은 2배 가치로 평가
  }

  /**
   * 동적 토큰 가치 평가 시스템
   * 게임 상황에 따라 토큰의 실질적 가치를 계산
   */
  evaluateDynamicTokenValue(gameState, players) {
    const { gameSettings, deckSize } = gameState;
    const gameProgress = this.estimateGameProgress(players);
    
    // 기본 토큰 가치
    let baseValue = 1.0;
    
    // 1. 게임 진행도에 따른 가치 변화
    if (gameProgress < 0.3) {
      baseValue *= 0.8; // 초반: 토큰 가치 낮음
    } else if (gameProgress < 0.7) {
      baseValue *= 1.2; // 중반: 토큰 가치 상승
    } else {
      baseValue *= 1.5; // 후반: 토큰 매우 중요
    }
    
    // 2. 토큰 희소성 지수
    const myTokenRatio = this.tokens / gameSettings.initialTokens;
    const scarcityMultiplier = myTokenRatio < 0.3 ? 2.0 : 
                               myTokenRatio < 0.6 ? 1.3 : 1.0;
    baseValue *= scarcityMultiplier;
    
    // 3. 상대방 대비 토큰 우위
    const opponents = players.filter(p => p.id !== this.id);
    if (opponents.length > 0) {
      const avgOpponentTokens = opponents.reduce((sum, p) => sum + p.tokens, 0) / opponents.length;
      const relativeAdvantage = this.tokens / (avgOpponentTokens + 1);
      
      if (relativeAdvantage < 0.5) {
        baseValue *= 1.8; // 상대적으로 토큰 부족시 가치 급상승
      } else if (relativeAdvantage > 2.0) {
        baseValue *= 0.7; // 상대적으로 토큰 풍부시 가치 하락
      }
    }
    
    // 4. 남은 카드 수 고려
    const cardsPerToken = deckSize / (this.tokens + 1);
    if (cardsPerToken > 5) {
      baseValue *= 1.2; // 카드 대비 토큰 부족
    }
    
    return baseValue;
  }

  /**
   * 토큰 투자 ROI (Return on Investment) 계산
   */
  calculateTokenROI(currentCard, pileTokens, gameState, players) {
    const tokenValue = this.evaluateDynamicTokenValue(gameState, players);
    const cardValue = this.evaluateCardValue(currentCard, gameState, players);
    
    // 투자 비용: 1 토큰
    const investmentCost = tokenValue;
    
    // 기대 수익: 카드를 피함으로써 얻는 이득 + 다른 플레이어가 가져가야 하는 부담
    const avoidanceBenefit = Math.max(0, -cardValue); // 나쁜 카드를 피하는 이득
    const opponentBurden = this.calculateOpponentBurden(currentCard, pileTokens + 1, players);
    
    const expectedReturn = avoidanceBenefit + opponentBurden * 0.3; // 상대방 부담의 30% 가치
    
    return expectedReturn / investmentCost; // ROI 비율
  }

  /**
   * 상대방이 카드를 가져갈 때의 부담 계산
   */
  calculateOpponentBurden(card, totalPileTokens, players) {
    let maxBurden = 0;
    
    for (const player of players) {
      if (player.id === this.id) continue;
      
      // 상대방에게 이 카드가 얼마나 부담스러운지 계산
      let burden = card; // 기본 카드 점수
      
      // 상대방의 연속성 보너스 차감
      for (const oppCard of player.cards) {
        if (Math.abs(card - oppCard) === 1) {
          burden -= 5; // 연속성으로 인한 부담 감소
        }
      }
      
      // 토큰 획득 혜택 차감
      burden -= totalPileTokens;
      
      // 상대방의 토큰 상황 고려
      const tokenRatio = player.tokens / 11; // 초기 토큰 11개 기준
      if (tokenRatio < 0.3) {
        burden *= 1.5; // 토큰 부족한 상대에게 더 큰 부담
      }
      
      maxBurden = Math.max(maxBurden, burden);
    }
    
    return maxBurden;
  }

  /**
   * 플레이어별 개별 분석 시스템
   */
  
  /**
   * 플레이어 프로파일 초기화 또는 업데이트
   */
  initializePlayerProfile(playerId) {
    if (!this.playerProfiles.has(playerId)) {
      this.playerProfiles.set(playerId, {
        // 카드 선호도 분석
        cardPreferences: {
          lowCardTendency: 0.5,    // 낮은 카드 선호도 (0-1)
          riskTolerance: 0.5,      // 위험 감수성 (0-1)
          sequenceHunter: 0.5,     // 연속 카드 추구 성향 (0-1)
        },
        
        // 토큰 관리 패턴
        tokenBehavior: {
          conservation: 0.5,       // 토큰 보수성 (0-1)
          aggressiveness: 0.5,     // 공격성 (0-1)
          panicThreshold: 3,       // 토큰 부족시 패닉 임계점
        },
        
        // 심리적 특성
        psychology: {
          bluffable: 0.5,          // 블러프에 넘어가기 쉬운 정도
          stubborn: 0.5,           // 고집 세기 (한 번 결정하면 바꾸지 않음)
          reactive: 0.5,           // 상대방 행동에 반응하는 정도
        },
        
        // 게임 통계
        stats: {
          totalDecisions: 0,
          passCount: 0,
          takeCount: 0,
          averageCardValue: 0,
          averageTokensUsed: 0,
        },
        
        // 취약점
        weaknesses: [],
        
        // 마지막 업데이트
        lastUpdate: Date.now(),
      });
    }
  }

  /**
   * 플레이어의 행동을 관찰하고 프로파일 업데이트
   */
  updatePlayerProfile(playerId, action, context) {
    this.initializePlayerProfile(playerId);
    const profile = this.playerProfiles.get(playerId);
    
    profile.stats.totalDecisions++;
    profile.lastUpdate = Date.now();
    
    if (action === 'pass') {
      profile.stats.passCount++;
      this.analyzePassBehavior(profile, context);
    } else if (action === 'take') {
      profile.stats.takeCount++;
      this.analyzeTakeBehavior(profile, context);
    }
    
    // 취약점 분석 업데이트
    this.updateWeaknesses(profile, context);
  }

  /**
   * 패스 행동 분석
   */
  analyzePassBehavior(profile, context) {
    const { card, tokens, pileTokens, gameProgress } = context;
    
    // 토큰 보수성 분석
    if (tokens <= 3 && pileTokens <= 2) {
      profile.tokenBehavior.conservation += 0.1;
    }
    
    // 위험 회피 성향 분석
    if (card > 25) {
      profile.cardPreferences.riskTolerance -= 0.05;
    } else if (card < 15) {
      // 좋은 카드도 패스했다면 매우 보수적
      profile.cardPreferences.riskTolerance -= 0.1;
    }
    
    // 게임 후반에 토큰을 아끼는 성향
    if (gameProgress > 0.7 && tokens > 5) {
      profile.tokenBehavior.aggressiveness -= 0.05;
    }
  }

  /**
   * 가져가기 행동 분석
   */
  analyzeTakeBehavior(profile, context) {
    const { card, tokens, pileTokens, hasSequence } = context;
    
    profile.stats.averageCardValue = 
      (profile.stats.averageCardValue * (profile.stats.takeCount - 1) + card) / profile.stats.takeCount;
    
    // 연속 카드 추구 성향
    if (hasSequence) {
      profile.cardPreferences.sequenceHunter += 0.1;
    }
    
    // 낮은 카드 선호도
    if (card <= 15) {
      profile.cardPreferences.lowCardTendency += 0.1;
    } else if (card > 25) {
      profile.cardPreferences.lowCardTendency -= 0.05;
    }
    
    // 토큰 많을 때도 가져갔다면 적극적
    if (tokens > 7 && pileTokens <= 3) {
      profile.tokenBehavior.aggressiveness += 0.1;
    }
  }

  /**
   * 플레이어의 취약점 분석 및 업데이트
   */
  updateWeaknesses(profile, context) {
    profile.weaknesses = [];
    
    // 토큰 관리 취약점
    if (profile.tokenBehavior.conservation > 0.8) {
      profile.weaknesses.push('TOKEN_HOARDER'); // 토큰을 너무 아끼는 성향
    }
    if (profile.tokenBehavior.aggressiveness < 0.3) {
      profile.weaknesses.push('TOO_PASSIVE'); // 너무 소극적
    }
    
    // 카드 선택 취약점
    if (profile.cardPreferences.riskTolerance < 0.3) {
      profile.weaknesses.push('RISK_AVERSE'); // 위험 회피 성향
    }
    if (profile.cardPreferences.sequenceHunter > 0.8) {
      profile.weaknesses.push('SEQUENCE_OBSESSED'); // 연속 카드에 집착
    }
    
    // 심리적 취약점
    if (profile.psychology.bluffable > 0.7) {
      profile.weaknesses.push('EASILY_MANIPULATED'); // 조작당하기 쉬움
    }
    if (profile.psychology.stubborn > 0.8) {
      profile.weaknesses.push('INFLEXIBLE'); // 융통성 부족
    }
  }

  /**
   * 특정 플레이어에 대한 맞춤 전략 계산
   */
  calculatePlayerSpecificStrategy(playerId, currentCard, pileTokens, gameState) {
    if (!this.playerProfiles.has(playerId)) {
      return 0; // 프로파일이 없으면 기본 전략 사용
    }
    
    const profile = this.playerProfiles.get(playerId);
    let strategyValue = 0;
    
    // 취약점 기반 공격 전략
    for (const weakness of profile.weaknesses) {
      switch (weakness) {
        case 'TOKEN_HOARDER':
          // 토큰을 아끼는 플레이어에게 계속 압박
          if (currentCard <= 20) strategyValue += 3;
          break;
          
        case 'TOO_PASSIVE':
          // 소극적인 플레이어는 좋은 카드도 포기할 가능성
          if (currentCard <= 15) strategyValue += 2;
          break;
          
        case 'RISK_AVERSE':
          // 위험 회피 성향이면 중간 카드도 부담스러워함
          if (currentCard > 20) strategyValue += 4;
          break;
          
        case 'SEQUENCE_OBSESSED':
          // 연속 카드 집착자는 관련 카드에 과도하게 반응
          if (this.isSequenceCard(currentCard, profile)) {
            strategyValue += 5; // 연속 카드면 강하게 견제
          }
          break;
      }
    }
    
    // 토큰 상황 기반 전략
    const tokenRatio = this.estimatePlayerTokens(playerId, gameState) / gameState.gameSettings.initialTokens;
    if (tokenRatio < profile.tokenBehavior.panicThreshold / 11) {
      strategyValue += 3; // 패닉 상태의 플레이어 압박
    }
    
    return Math.min(strategyValue, 8); // 최대값 제한
  }

  /**
   * 플레이어의 현재 토큰 수 추정 (공개 모드가 아닐 때)
   */
  estimatePlayerTokens(playerId, gameState) {
    // 공개 모드라면 실제 값 사용
    if (gameState.gameSettings.showOpponentTokens) {
      const player = gameState.players.find(p => p.id === playerId);
      return player ? player.tokens : 5; // 기본값
    }
    
    // 비공개 모드라면 프로파일 기반 추정
    if (this.playerProfiles.has(playerId)) {
      const profile = this.playerProfiles.get(playerId);
      const gameProgress = this.estimateGameProgress(gameState.players);
      
      // 플레이어 성향 기반 토큰 사용 패턴 추정
      const conservationRate = profile.tokenBehavior.conservation;
      const expectedUsage = gameProgress * gameState.gameSettings.initialTokens * (1 - conservationRate);
      
      return Math.max(0, gameState.gameSettings.initialTokens - expectedUsage);
    }
    
    return 5; // 기본 추정값
  }

  /**
   * 연속 카드 여부 확인
   */
  isSequenceCard(card, profile) {
    // 이 부분은 실제 게임 상태에서 더 정확히 계산해야 함
    // 여기서는 단순화된 버전
    return profile.stats.averageCardValue && Math.abs(card - profile.stats.averageCardValue) <= 2;
  }

  /**
   * === 극한 난이도 차별화 시스템 ===
   */

  /**
   * 중급 봇의 의사결정 (일반 유저 수준) - 단순하고 예측 가능
   */
  mediumDecision(cardValue, tokenCost, gameSettings, players, advancedMetrics = {}, currentCard = null) {
    // 토큰이 없으면 무조건 가져감
    if (this.tokens === 0) return 'take';

    let totalValue = cardValue + tokenCost;
    
    // 스타일과 성격 기반 랜덤성 조정
    const styleModifiers = advancedMetrics.styleModifiers || {};
    const personalityModifiers = advancedMetrics.personalityModifiers || {};
    
    // 랜덤성을 성격에 따라 조정 (보수적일수록 낮은 랜덤성)
    const randomRange = 8 * (0.5 + styleModifiers.riskTaking * 0.5);
    const randomFactor = (Math.random() - 0.5) * randomRange;

    // === 중급 봇 특징: 기본적이고 직관적인 판단 ===
    
    // 1. No Thanks! 전략적 카드 평가 (중급 수준: 기본적이지만 토큰 고려)
    const card = currentCard || this.estimateCardFromValue(cardValue);
    if (card <= 10) totalValue += 4; // 매우 좋은 카드
    else if (card <= 15) totalValue += 2; // 좋은 카드
    else if (card >= 25) {
      // 높은 카드이지만 토큰이 많으면 가져올 수 있음
      let highCardPenalty = -6;
      const tokenReward = (advancedMetrics.pileTokens || 0) * 0.4; // 중급은 토큰 가치를 40%만 고려
      const sequenceBonus = this.evaluateBasicSequence ? this.evaluateBasicSequence(card) * 0.8 : 0;
      
      highCardPenalty += tokenReward + sequenceBonus;
      totalValue += highCardPenalty;
    }
    else if (card >= 20) {
      let mediumCardPenalty = -3;
      const tokenReward = (advancedMetrics.pileTokens || 0) * 0.3;
      const sequenceBonus = this.evaluateBasicSequence ? this.evaluateBasicSequence(card) * 0.6 : 0;
      
      mediumCardPenalty += tokenReward + sequenceBonus;
      totalValue += mediumCardPenalty;
    }
    else if (card > 15) totalValue -= 1; // 16~19 카드 약간 회피

    // 2. 기본적인 토큰 관리 (보수적)
    const tokenRatio = this.tokens / gameSettings.initialTokens;
    if (tokenRatio < 0.2) {
      totalValue -= 4; // 토큰 부족시 매우 보수적
    } else if (tokenRatio < 0.4) {
      totalValue -= 2; // 토큰 적을 때 보수적
    }
    
    // 3. 연속성만 간단히 고려
    const sequenceBonus = this.evaluateBasicSequence(card);
    totalValue += sequenceBonus;

    // 4. 상대방 토큰 상태 간단히 고려 (공개 모드에서만)
    if (gameSettings.showOpponentTokens) {
      const opponentPressure = this.evaluateBasicOpponentPressure(players);
      totalValue += opponentPressure;
    }

    // 5. 고급 메트릭스 매우 제한적 사용 (30% 수준)
    const dynamicAdjustment = advancedMetrics.dynamicTokenValue ? 
      (advancedMetrics.dynamicTokenValue - 1.0) * 1.5 : 0; // 절반 효과
    const competitiveBonus = (advancedMetrics.competitiveStrategy || 0) * 0.3; // 30% 활용
    
    // === 스타일별 전략 적용 ===
    const styleStrategy = advancedMetrics.styleStrategy || 0;
    
    // 성격 기반 조정
    const personalityAdjustment = (personalityModifiers.greedBonus || 0) * 1.5 + 
                                  (personalityModifiers.riskBonus || 0) * 2 +
                                  (personalityModifiers.sequenceBonus || 0) * 0.8;

    // === 최종 결정 (스타일과 성격을 반영한 기준) ===
    const finalThreshold = -4 + (styleModifiers.conservatism - 0.5) * 4; // -6 to -2 범위
    const finalValue = totalValue + randomFactor + dynamicAdjustment + competitiveBonus + styleStrategy + personalityAdjustment;
    
    return finalValue > finalThreshold ? 'take' : 'pass';
  }

  /**
   * 기본 연속성 평가 (중급용)
   */
  evaluateBasicSequence(currentCard) {
    let bonus = 0;
    for (const myCard of this.cards) {
      if (Math.abs(currentCard - myCard) === 1) {
        bonus += 3; // 단순한 연속성 보너스
        break; // 하나만 확인
      }
    }
    return bonus;
  }

  /**
   * 기본 상대방 압박 평가 (중급용)
   */
  evaluateBasicOpponentPressure(players) {
    let pressure = 0;
    for (const player of players) {
      if (player.id === this.id || player.isBot) continue;
      if (player.tokens <= 1) {
        pressure += 2; // 토큰 부족한 상대에게 압박
      }
    }
    return Math.min(pressure, 3);
  }

  /**
   * 카드 값에서 실제 카드 번호 추정 (중급봇용)
   */
  estimateCardFromValue(cardValue) {
    // cardValue는 음수 (카드 번호의 반대)이므로 절댓값 사용
    return Math.abs(cardValue) || 20; // 기본값 20
  }

  /**
   * 상급 봇의 의사결정 (잘하는 유저 수준) - 전술적이고 계산적
   */
  hardDecision(cardValue, tokenCost, gameSettings, players, currentCard, advancedMetrics = {}) {
    if (this.tokens === 0) return 'take';

    let totalValue = cardValue + tokenCost;
    
    // 스타일과 성격 기반 조정
    const styleModifiers = advancedMetrics.styleModifiers || {};
    const personalityModifiers = advancedMetrics.personalityModifiers || {};
    
    // 상급 봇의 랜덤성 (스타일에 따라 조정)
    const randomRange = 3 * (0.7 + styleModifiers.riskTaking * 0.6);
    const randomFactor = (Math.random() - 0.5) * randomRange;

    // No Thanks! 전략적 카드 평가 (상급 수준)
    if (currentCard >= 25) {
      // 높은 카드 전략적 평가
      let highCardPenalty = -7;
      const tokenReward = (advancedMetrics.pileTokens || 0) * 0.7;
      const sequenceBonus = this.evaluateSequencePotential ? this.evaluateSequencePotential(currentCard) * 1.8 : 0;
      const gameEndBonus = this.evaluateGameEndStrategy ? this.evaluateGameEndStrategy(currentCard, players, gameSettings) * 0.8 : 0;
      
      highCardPenalty += tokenReward + sequenceBonus + gameEndBonus;
      totalValue += highCardPenalty;
    } else if (currentCard >= 20) {
      let mediumCardPenalty = -3.5;
      const tokenReward = (advancedMetrics.pileTokens || 0) * 0.5;
      const sequenceBonus = this.evaluateSequencePotential ? this.evaluateSequencePotential(currentCard) * 1.3 : 0;
      
      mediumCardPenalty += tokenReward + sequenceBonus;
      totalValue += mediumCardPenalty;
    }

    // === 상급 봇 특징: 전술적 사고와 상황 판단 ===

    // 1. 고급 카드 가치 분석 (가중치 조정)
    const advancedCardValue = this.evaluateAdvancedCardAnalysis(currentCard, players);
    totalValue += advancedCardValue * 0.8; // 20% 감소

    // 2. 전술적 토큰 관리
    const tacticalTokenValue = this.evaluateTacticalTokenManagement(players, gameSettings);
    totalValue += tacticalTokenValue;

    // 3. 상대방 분석 및 견제 (중간 수준)
    const opponentAnalysis = this.evaluateOpponentAnalysisHard(players, currentCard, gameSettings);
    totalValue += opponentAnalysis;

    // 4. 게임 진행도별 전략 적용
    const gamePhaseValue = this.evaluateGamePhaseStrategyHard(players, currentCard, gameSettings);
    totalValue += gamePhaseValue;

    // 5. 리스크-리워드 계산
    const riskRewardValue = this.evaluateRiskRewardHard(currentCard, players, gameSettings);
    totalValue += riskRewardValue;

    // 6. 고급 시스템 적극 활용 (70% 수준)
    const dynamicTokenValue = advancedMetrics.dynamicTokenValue || 1.0;
    const tokenROI = advancedMetrics.tokenROI || 1.0;
    const competitiveStrategy = (advancedMetrics.competitiveStrategy || 0) * 0.7;

    // ROI 기반 의사결정 강화
    if (tokenROI > 1.5) {
      totalValue -= 3; // ROI 좋으면 패스 선호
    } else if (tokenROI < 0.8) {
      totalValue += 2; // ROI 나쁘면 가져가기 선호
    }

    // 동적 토큰 가치 반영
    const dynamicAdjustment = (dynamicTokenValue - 1.0) * 4;

    // 7. 확률 기반 보정 (제한적)
    const probabilisticBonus = this.calculateProbabilisticRisk(currentCard, players, gameSettings) * -0.15; // 15% 활용

    // === 스타일 및 성격 기반 조정 ===
    const styleStrategy = advancedMetrics.styleStrategy || 0;
    
    const personalityAdjustment = (personalityModifiers.greedBonus || 0) * 2 + 
                                  (personalityModifiers.riskBonus || 0) * 2.5 +
                                  (personalityModifiers.sequenceBonus || 0) * 1.5 +
                                  (personalityModifiers.psychologicalBonus || 0) * 1.2;

    // === 최종 결정 (스타일과 성격을 반영한 상급 기준) ===
    const baseThreshold = -1.5;
    const styleThreshold = baseThreshold + (styleModifiers.conservatism - 0.5) * 3; // -3 to 0 범위
    const finalValue = totalValue + randomFactor + dynamicAdjustment + competitiveStrategy + 
                       probabilisticBonus + styleStrategy + personalityAdjustment;
    
    return finalValue > styleThreshold ? 'take' : 'pass';
  }

  /**
   * 고급 카드 가치 분석 (상급용)
   */
  evaluateAdvancedCardAnalysis(currentCard, players) {
    let value = 0;

    // 복잡한 연속성 분석
    const sequenceAnalysis = this.analyzeSequencePotential(currentCard);
    value += sequenceAnalysis;

    // 게임 진행도 기반 카드 가치
    const gameProgress = this.estimateGameProgress(players);
    if (gameProgress > 0.7) {
      // 후반부에서는 낮은 카드 가치 급상승
      if (currentCard <= 15) value += 5;
      else if (currentCard > 25) value -= 3;
    }

    // 상대방 카드와의 관계 분석
    const relationshipValue = this.analyzeCardRelationships(currentCard, players);
    value += relationshipValue;

    return Math.min(value, 6);
  }

  /**
   * 전술적 토큰 관리 (상급용)
   */
  evaluateTacticalTokenManagement(players, gameSettings) {
    let value = 0;
    const tokenRatio = this.tokens / gameSettings.initialTokens;
    const gameProgress = this.estimateGameProgress(players);

    // 토큰 상황별 전술적 판단
    if (tokenRatio < 0.2) {
      // 토큰 부족: 매우 신중하게
      value -= 5;
    } else if (tokenRatio < 0.4) {
      // 토큰 적음: 좋은 기회만 선별
      value -= 2;
    } else if (tokenRatio > 0.7 && gameProgress < 0.5) {
      // 토큰 풍부한 초중반: 적극적으로
      value += 3;
    }

    // 상대적 토큰 우위 활용
    const tokenAdvantage = this.calculateTokenAdvantage(players);
    if (tokenAdvantage > 0.3) {
      value += 2; // 토큰 우위 활용
    } else if (tokenAdvantage < -0.3) {
      value -= 2; // 토큰 열세 고려
    }

    return value;
  }

  /**
   * 상대방 분석 (상급용)
   */
  evaluateOpponentAnalysisHard(players, currentCard, gameSettings) {
    let value = 0;

    // 상대방 토큰 상황 분석 (공개 모드에서만)
    if (gameSettings.showOpponentTokens) {
      const tokenPressure = this.evaluateTokenPressure(players);
      value += tokenPressure;

      // 심리전 요소
      const psychWarfare = this.evaluatePsychologicalWarfare(players, gameSettings, currentCard);
      value += psychWarfare * 0.7; // 70% 활용
    }

    // 카드 기반 견제 (항상 활용 가능)
    const cardInterference = this.evaluateCardInterference(players, currentCard);
    value += cardInterference;

    // 방어적 전략
    const defensiveValue = this.evaluateDefensiveStrategy(players, currentCard);
    value += defensiveValue;

    return value;
  }

  /**
   * 게임 단계별 전략 (상급용)
   */
  evaluateGamePhaseStrategyHard(players, currentCard, gameSettings) {
    const gameProgress = this.estimateGameProgress(players);
    
    if (gameProgress < 0.3) {
      // 초반: 포지셔닝 중심
      return this.evaluateEarlyPositioning(currentCard, players);
    } else if (gameProgress < 0.7) {
      // 중반: 경쟁 전략
      return this.evaluateMidGameCompetition(currentCard, players);
    } else {
      // 후반: 최적화 전략
      return this.evaluateLateGameOptimization(currentCard, players);
    }
  }

  /**
   * 리스크-리워드 계산 (상급용)
   */
  evaluateRiskRewardHard(currentCard, players, gameSettings) {
    let riskReward = 0;

    // 카드별 리스크 평가
    const cardRisk = currentCard > 25 ? 2 : currentCard < 15 ? -1 : 0;
    
    // 토큰 투자 리스크
    const tokenInvestmentRisk = this.tokens <= 2 ? 3 : 0;
    
    // 상대방 경쟁 리스크
    const competitionRisk = this.calculateCompetitionIntensity(currentCard, players) * 0.5;

    riskReward = -cardRisk - tokenInvestmentRisk - competitionRisk;

    // 리워드 평가
    const potentialReward = this.calculatePotentialReward(currentCard, players);
    riskReward += potentialReward;

    return riskReward;
  }

  /**
   * 연속성 잠재력 분석
   */
  analyzeSequencePotential(currentCard) {
    let potential = 0;
    
    // 내 카드와의 직접 연결
    for (const myCard of this.cards) {
      if (Math.abs(currentCard - myCard) === 1) {
        potential += 3;
        
        // 더 긴 연속 가능성 체크
        const extendedSequence = this.checkExtendedSequence(currentCard, myCard);
        potential += extendedSequence;
      }
    }

    return Math.min(potential, 8);
  }

  /**
   * 확장 연속성 체크
   */
  checkExtendedSequence(newCard, existingCard) {
    const testCards = [...this.cards, newCard].sort((a, b) => a - b);
    let maxSequence = 1;
    let currentSequence = 1;

    for (let i = 1; i < testCards.length; i++) {
      if (testCards[i] === testCards[i-1] + 1) {
        currentSequence++;
      } else {
        maxSequence = Math.max(maxSequence, currentSequence);
        currentSequence = 1;
      }
    }
    maxSequence = Math.max(maxSequence, currentSequence);

    return maxSequence >= 3 ? 2 : 0; // 3개 이상 연결시 보너스
  }

  /**
   * 초반 포지셔닝 평가
   */
  evaluateEarlyPositioning(currentCard, players) {
    // 낮은 카드 우선, 연속성 기반 구축
    let value = 0;
    
    if (currentCard <= 12) value += 4;
    else if (currentCard <= 18) value += 2;
    else if (currentCard > 28) value -= 2;

    return value;
  }

  /**
   * 중반 경쟁 전략
   */
  evaluateMidGameCompetition(currentCard, players) {
    // 상대방과의 경쟁 고려, 균형잡힌 플레이
    let value = 0;

    const competition = this.calculateCompetitionIntensity(currentCard, players);
    if (competition > 4) {
      value -= 1; // 경쟁이 치열하면 신중
    } else if (competition < 2) {
      value += 2; // 경쟁이 적으면 적극적
    }

    return value;
  }

  /**
   * 후반 최적화 전략  
   */
  evaluateLateGameOptimization(currentCard, players) {
    // 점수 최적화 중심
    let value = 0;

    if (currentCard <= 10) value += 6; // 매우 좋은 카드는 필수
    else if (currentCard <= 15) value += 3;
    else if (currentCard > 25) value -= 4; // 나쁜 카드 적극 회피

    return value;
  }

  /**
   * 잠재 리워드 계산
   */
  calculatePotentialReward(currentCard, players) {
    let reward = 0;
    
    // 연속성 보너스
    const sequenceReward = this.calculateSequenceReward(currentCard);
    reward += sequenceReward;
    
    // 상대방 방해 보너스
    const interferenceReward = this.calculateInterferenceReward(currentCard, players);
    reward += interferenceReward;

    return Math.min(reward, 5);
  }

  /**
   * 연속성 리워드 계산
   */
  calculateSequenceReward(currentCard) {
    let reward = 0;
    for (const myCard of this.cards) {
      if (Math.abs(currentCard - myCard) === 1) {
        reward += 2; // 기본 연속 보너스
        break;
      }
    }
    return reward;
  }

  /**
   * 방해 리워드 계산
   */
  calculateInterferenceReward(currentCard, players) {
    let reward = 0;
    for (const player of players) {
      if (player.id === this.id) continue;
      
      for (const card of player.cards) {
        if (Math.abs(currentCard - card) === 1) {
          reward += 1; // 상대방 방해 보너스
        }
      }
    }
    return Math.min(reward, 3);
  }

  /**
   * 카드 관계 분석 (상급용)
   */
  analyzeCardRelationships(currentCard, players) {
    let value = 0;
    
    // 다른 플레이어들과의 잠재적 갈등 분석
    for (const player of players) {
      if (player.id === this.id) continue;
      
      for (const card of player.cards) {
        if (Math.abs(currentCard - card) === 1) {
          value += 2; // 경쟁 상황 발견
        }
        if (Math.abs(currentCard - card) === 2) {
          value += 1; // 잠재적 경쟁
        }
      }
    }

    return Math.min(value, 4);
  }

  /**
   * === 최상급 전용 시스템 ===
   */

  /**
   * 최종 검증 시스템 (최상급 전용)
   */
  performUltimateValidation(finalValue, currentCard, players, gameSettings) {
    let validation = 0;

    // 1. 멀티 시나리오 검증
    const scenarioAnalysis = this.analyzeMultipleScenarios(currentCard, players, gameSettings);
    validation += scenarioAnalysis;

    // 2. 심층 경쟁 분석
    const deepCompetition = this.performDeepCompetitionAnalysis(currentCard, players);
    validation += deepCompetition;

    // 3. 최적성 검증
    const optimalityCheck = this.verifyOptimality(finalValue, currentCard, players, gameSettings);
    validation += optimalityCheck;

    // 4. 리스크 시뮬레이션
    const riskSimulation = this.runRiskSimulation(currentCard, players, gameSettings);
    validation += riskSimulation;

    return Math.min(validation, 3); // 최대 3점까지 추가 보정
  }

  /**
   * 멀티 시나리오 분석
   */
  analyzeMultipleScenarios(currentCard, players, gameSettings) {
    let scenarioValue = 0;
    const scenarios = ['optimistic', 'realistic', 'pessimistic'];

    for (const scenario of scenarios) {
      const scenarioResult = this.evaluateScenario(scenario, currentCard, players, gameSettings);
      scenarioValue += scenarioResult;
    }

    return scenarioValue / scenarios.length; // 평균값 사용
  }

  /**
   * 시나리오별 평가
   */
  evaluateScenario(scenario, currentCard, players, gameSettings) {
    switch (scenario) {
      case 'optimistic':
        // 최상의 경우: 상대방이 모두 협조적
        return currentCard <= 20 ? 2 : -1;
      case 'realistic':
        // 현실적 경우: 일반적인 경쟁
        return this.calculateRealisticOutcome(currentCard, players);
      case 'pessimistic':
        // 최악의 경우: 상대방이 모두 적대적
        return this.calculatePessimisticOutcome(currentCard, players);
      default:
        return 0;
    }
  }

  /**
   * 현실적 결과 계산
   */
  calculateRealisticOutcome(currentCard, players) {
    const competition = this.calculateCompetitionIntensity(currentCard, players);
    return competition > 5 ? -1 : (currentCard <= 18 ? 1 : 0);
  }

  /**
   * 비관적 결과 계산
   */
  calculatePessimisticOutcome(currentCard, players) {
    // 모든 상대방이 적극적으로 방해한다고 가정
    let interference = 0;
    for (const player of players) {
      if (player.id !== this.id && player.tokens > 0) {
        interference += 1;
      }
    }
    return currentCard <= 15 ? Math.max(0, 2 - interference) : -1;
  }

  /**
   * 심층 경쟁 분석
   */
  performDeepCompetitionAnalysis(currentCard, players) {
    let competitionValue = 0;

    // 각 플레이어별 세밀한 경쟁 분석
    for (const player of players) {
      if (player.id === this.id) continue;

      const playerCompetition = this.analyzePlayerCompetition(player, currentCard);
      competitionValue += playerCompetition;
    }

    // 전체 경쟁 강도 평가
    const overallCompetition = this.assessOverallCompetition(players, currentCard);
    competitionValue += overallCompetition;

    return Math.min(competitionValue, 2);
  }

  /**
   * 플레이어별 경쟁 분석
   */
  analyzePlayerCompetition(player, currentCard) {
    let competition = 0;

    // 연속성 기반 경쟁
    for (const card of player.cards) {
      if (Math.abs(currentCard - card) === 1) {
        competition += player.isBot ? 2 : 1; // 봇은 더 강한 경쟁자
      }
    }

    // 토큰 상황 기반 경쟁 가능성
    if (player.tokens > 3) {
      competition += 1; // 토큰 여유가 있으면 경쟁 가능성 높음
    }

    return Math.min(competition, 3);
  }

  /**
   * 전체 경쟁 강도 평가
   */
  assessOverallCompetition(players, currentCard) {
    const totalPlayers = players.filter(p => p.id !== this.id).length;
    const activeCompetitors = players.filter(p => p.id !== this.id && p.tokens > 0).length;
    
    const competitionRatio = activeCompetitors / Math.max(totalPlayers, 1);
    
    if (currentCard <= 15) {
      // 좋은 카드는 경쟁이 치열
      return competitionRatio > 0.7 ? -1 : 0;
    } else {
      // 나쁜 카드는 경쟁이 덜함
      return 0;
    }
  }

  /**
   * 최적성 검증
   */
  verifyOptimality(finalValue, currentCard, players, gameSettings) {
    // 현재 결정이 수학적으로 최적인지 검증
    let optimality = 0;

    // 기댓값 계산
    const expectedValue = this.calculateExpectedValue(currentCard, players, gameSettings);
    
    // 기댓값과 결정의 일관성 검사
    if (finalValue > 4 && expectedValue > 0) {
      optimality += 1; // 일관된 긍정적 결정
    } else if (finalValue <= 4 && expectedValue <= 0) {
      optimality += 1; // 일관된 부정적 결정
    } else {
      optimality -= 0.5; // 비일관성 페널티
    }

    return optimality;
  }

  /**
   * 기댓값 계산 (최상급용)
   */
  calculateExpectedValue(currentCard, players, gameSettings) {
    // 카드를 가져갔을 때의 기댓값
    const takeValue = this.calculateTakeExpectedValue(currentCard, players);
    
    // 패스했을 때의 기댓값
    const passValue = this.calculatePassExpectedValue(currentCard, players, gameSettings);
    
    return takeValue - passValue; // 차이값이 양수면 take 선호
  }

  /**
   * 가져가기 기댓값
   */
  calculateTakeExpectedValue(currentCard, players) {
    let value = -currentCard; // 기본 카드 점수

    // 연속성 보너스
    for (const myCard of this.cards) {
      if (Math.abs(currentCard - myCard) === 1) {
        value += 5;
        break;
      }
    }

    // 토큰 획득 (현재 파일에서 pileTokens 접근 불가하므로 평균값 사용)
    value += 2; // 평균 토큰 획득 예상

    return value;
  }

  /**
   * 패스 기댓값
   */
  calculatePassExpectedValue(currentCard, players, gameSettings) {
    const tokenCost = 1; // 토큰 1개 소모
    const opponentBurden = this.calculateOpponentBurden(currentCard, 1, players);
    
    return -tokenCost + (opponentBurden * 0.2); // 상대방 부담의 20% 이익
  }

  /**
   * 리스크 시뮬레이션
   */
  runRiskSimulation(currentCard, players, gameSettings) {
    let riskValue = 0;
    const simulations = 5; // 가벼운 시뮬레이션

    for (let i = 0; i < simulations; i++) {
      const simulationResult = this.simulateRiskScenario(currentCard, players, gameSettings);
      riskValue += simulationResult;
    }

    return riskValue / simulations;
  }

  /**
   * 리스크 시나리오 시뮬레이션
   */
  simulateRiskScenario(currentCard, players, gameSettings) {
    // 단순화된 리스크 시뮬레이션
    const tokenRisk = this.tokens <= 2 ? -1 : 0;
    const cardRisk = currentCard > 28 ? -2 : 0;
    const competitionRisk = players.length > 4 ? -0.5 : 0;

    return tokenRisk + cardRisk + competitionRisk;
  }

  /**
   * === 누락된 적응형 전략 메서드들 ===
   */

  /**
   * 특수 상황 적응
   */
  adaptToSpecialSituations(players, currentCard) {
    let value = 0;

    // 1대1 상황
    if (players.length === 2) {
      value += this.adaptToHeadToHead(players, currentCard);
    }

    // 다인전 상황
    if (players.length >= 5) {
      value += this.adaptToMultiPlayer(players, currentCard);
    }

    // 토큰 고갈 위기 상황
    const lowTokenPlayers = players.filter(p => p.tokens <= 2).length;
    if (lowTokenPlayers >= players.length * 0.5) {
      value += this.adaptToTokenCrisis(currentCard);
    }

    return Math.min(value, 3);
  }

  /**
   * 1대1 상황 적응
   */
  adaptToHeadToHead(players, currentCard) {
    // 1대1에서는 상대방의 토큰과 카드 상태가 매우 중요
    const opponent = players.find(p => p.id !== this.id);
    if (!opponent) return 0;

    if (this.tokens > opponent.tokens + 2) {
      // 토큰 우위시 공격적
      return currentCard <= 22 ? 2 : 0;
    } else if (this.tokens < opponent.tokens - 2) {
      // 토큰 열세시 보수적
      return currentCard <= 12 ? 1 : -2;
    }

    return 0;
  }

  /**
   * 다인전 적응
   */
  adaptToMultiPlayer(players, currentCard) {
    // 다인전에서는 중간 정도의 전략이 안전
    const myRank = this.calculateRelativePosition(players);
    
    if (myRank > 0.7) {
      // 상위권: 안전 플레이
      return currentCard <= 15 ? 1 : -1;
    } else if (myRank < 0.3) {
      // 하위권: 적극적 플레이 필요
      return currentCard <= 20 ? 2 : 0;
    }

    return 0; // 중위권: 현상 유지
  }

  /**
   * 토큰 위기 적응
   */
  adaptToTokenCrisis(currentCard) {
    // 전체적으로 토큰이 부족한 상황
    return currentCard <= 18 ? 3 : -2; // 기회를 적극적으로 포착
  }

  /**
   * 기타 누락된 메서드들
   */
  
  calculateSequencePosition(currentCard) {
    // 연속성 기반 포지션 값 계산
    let position = 0;
    for (const myCard of this.cards) {
      if (Math.abs(currentCard - myCard) === 1) {
        position += 2;
      }
    }
    return Math.min(position, 4);
  }

  calculateEfficiencyPosition(players, currentCard) {
    // 토큰 효율성 기반 포지션
    const tokenRatio = this.tokens / 11;
    const cardValue = currentCard <= 15 ? 2 : currentCard > 25 ? -1 : 0;
    
    return tokenRatio > 0.6 ? cardValue : Math.min(cardValue, 0);
  }

  blockSequenceStrategy(currentCard, playerId) {
    // 특정 플레이어의 연속성 전략 차단
    const player = this.playerProfiles.get(playerId);
    return player && player.cardPreferences.sequenceHunter > 0.7 ? 2 : 0;
  }

  // 다른 누락된 메서드들도 기본 구현
  findStrategicBalance() { return 0; }
  optimizeForEndgame() { return 1; }
  seizeFinalOpportunity() { return 1; }
  minimizeEndgameRisk() { return -1; }
  generateSpecificCounter() { return 1; }
  analyzePlayerRelationships() { return 0; }
  learnGameFlowPattern() { return {}; }
  adaptToFlowPattern() { return 0; }
  analyzePlayerInteractions() { return {}; }
  adaptToInteractionPattern() { return 0; }
  predictGameOutcome() { return {}; }
  adaptToOutcomePrediction() { return 0; }
  analyzeBehaviorSequence() { return {}; }
  generatePatternResponse() { return 0; }

  /**
   * 최상급 봇의 의사결정 (전문가 수준 - 매우 어려움)
   */
  expertDecision(cardValue, tokenCost, gameSettings, players, currentCard, advancedMetrics = {}) {
    if (this.tokens === 0) return 'take';

    let totalValue = cardValue + tokenCost;
    
    // 최상급 봇은 스타일과 성격을 완전히 활용
    const styleModifiers = advancedMetrics.styleModifiers || {};
    const personalityModifiers = advancedMetrics.personalityModifiers || {};
    
    // 최상급 봇의 낮은 랜덤성 (하지만 스타일에 따라 약간 조정)
    const randomRange = 0.8 * (0.8 + styleModifiers.riskTaking * 0.4);
    const randomFactor = (Math.random() - 0.5) * randomRange;

    // No Thanks! 전략적 카드 평가: 높은 카드도 상황에 따라 취득
    if (currentCard >= 25) {
      // 기본적으로는 회피하되, 전략적 상황에서는 취득 고려
      let highCardPenalty = -8;
      
      // 전략적 취득 보너스들
      const tokenReward = (advancedMetrics.pileTokens || 0) * 0.8; // 쌓인 토큰의 80% 가치
      const sequenceBonus = this.evaluateSequencePotential(currentCard) * 2; // 연속성 2배 가중
      const gameEndBonus = this.evaluateGameEndStrategy(currentCard, players, gameSettings);
      const blockingBonus = this.evaluateOpponentBlocking(players, currentCard) * 0.5;
      
      // 토큰 파밍 vs 즉시 취득 전략적 판단 (Expert 레벨)
      const farmingOpportunity = this.evaluateTokenFarmingOpportunity(currentCard, advancedMetrics.pileTokens || 0, players);
      const farmingPenalty = farmingOpportunity > sequenceBonus ? -farmingOpportunity * 1.5 : 0;
      
      highCardPenalty += tokenReward + sequenceBonus + gameEndBonus + blockingBonus + farmingPenalty;
      totalValue += highCardPenalty;
      
    } else if (currentCard >= 20) {
      // 중간 높은 카드: 더 유연한 전략
      let mediumCardPenalty = -4;
      const tokenReward = (advancedMetrics.pileTokens || 0) * 0.6;
      const sequenceBonus = this.evaluateSequencePotential(currentCard) * 1.5;
      
      mediumCardPenalty += tokenReward + sequenceBonus;
      totalValue += mediumCardPenalty;
    }

    // === 1단계: 고급 카드 전략 (가중치 조정) ===
    const advancedCardStrategy = this.evaluateAdvancedCardStrategy(players, currentCard);
    const opponentBlockingValue = this.evaluateOpponentBlocking(players, currentCard);
    const masterDefensiveStrategy = this.evaluateMasterDefensiveStrategy(players, currentCard);
    // 보너스 시스템 가중치 30% 감소
    totalValue += (advancedCardStrategy + opponentBlockingValue + masterDefensiveStrategy) * 0.7;

    // === 2단계: 최고급 토큰 전략 ===
    const dynamicTokenValue = advancedMetrics.dynamicTokenValue || 1.0;
    const tokenROI = advancedMetrics.tokenROI || 1.0;
    
    // 베이지안 추론 기반 토큰 투자 결정
    const bayesianROI = this.calculateBayesianROI(currentCard, gameSettings, players);
    if (bayesianROI > 2.0) {
      totalValue -= 4; // 매우 좋은 투자면 강하게 패스
    } else if (bayesianROI < 0.5) {
      totalValue += 3; // 나쁜 투자면 가져가기
    }

    // 토큰 기반 고급 전략 (공개 모드에서만, 가중치 조정)
    if (gameSettings.showOpponentTokens) {
      const advancedTokenStrategy = this.evaluateAdvancedTokenStrategy(players, gameSettings);
      const masterPsychology = this.evaluateMasterPsychology(players, gameSettings, currentCard);
      // 심리전 보너스 가중치 50% 감소
      totalValue += (advancedTokenStrategy + masterPsychology) * 0.5;
    }

    // === 3단계: 예측 및 확률 기반 시스템 (대폭 강화) ===
    
    // 동적 위험도 평가
    const probabilisticRisk = this.calculateProbabilisticRisk(currentCard, players, gameSettings);
    totalValue += probabilisticRisk * -0.3; // 위험도가 높으면 패스 성향

    // 상대방 행동 예측 시스템
    const behaviorPredictions = this.predictOpponentBehavior(players, currentCard, gameSettings);
    let predictionValue = 0;
    for (const [playerId, prediction] of behaviorPredictions) {
      if (prediction.confidence > 0.7) {
        // 높은 신뢰도의 예측만 활용
        if (prediction.takeProb > 0.7) {
          predictionValue -= 1; // 누군가 가져갈 확률이 높으면 패스 고려
        } else if (prediction.passProb > 0.8) {
          predictionValue += 2; // 모두 패스할 확률이 높으면 가져가기 고려
        }
      }
    }
    totalValue += predictionValue;

    // 게임 이론적 최적화 
    const gameTheoryValue = this.evaluateGameTheory(currentCard, players, gameSettings);
    totalValue += gameTheoryValue;

    // 기존 확률 시스템들 (가중치 조정)
    const probabilisticValue = this.estimateFutureValue(players);
    const gamePhaseStrategy = this.evaluateGamePhaseStrategy(players, gameSettings, currentCard);
    const adaptiveStrategy = this.evaluateAdaptiveStrategy(players, currentCard);
    
    // 몬테카를로 시뮬레이션 기반 기댓값 계산
    const monteCarloExpectation = this.calculateMonteCarloExpectation(
      currentCard, players, gameSettings
    );
    
    // 확률 기반 시스템들의 가중치 40% 감소
    totalValue += (probabilisticValue + gamePhaseStrategy + adaptiveStrategy + monteCarloExpectation) * 0.6;

    // === 4단계: 마스터급 심리전 및 견제 (가중치 조정) ===
    const competitiveStrategy = advancedMetrics.competitiveStrategy || 0;
    const psychologicalManipulation = this.evaluatePsychologicalManipulation(
      players, currentCard, gameSettings
    );
    const strategicBluffing = this.evaluateStrategicBluffing(
      players, currentCard, gameSettings
    );
    
    // 심리전 및 견제 보너스 가중치 60% 감소
    totalValue += (competitiveStrategy + psychologicalManipulation + strategicBluffing) * 0.4;

    // === 5단계: 게임 트리 탐색 (3수 앞까지, 가중치 조정) ===
    const gameTreeValue = this.evaluateGameTree(currentCard, players, gameSettings, 3);
    totalValue += gameTreeValue * 0.3; // 가중치 40% 감소

    // === 6단계: 최적화된 토큰 관리 ===
    const tokenOptimalRatio = this.calculateOptimalTokenRatio(players, gameSettings);
    const currentRatio = this.tokens / gameSettings.initialTokens;
    const tokenAdjustment = (tokenOptimalRatio - currentRatio) * 4;
    
    // 동적 토큰 가치 강력 반영
    const dynamicAdjustment = (dynamicTokenValue - 1.0) * 5;

    // === 스타일과 성격의 완전한 통합 (최상급) ===
    const styleStrategy = advancedMetrics.styleStrategy || 0;
    
    // 최상급 봇은 모든 성격 요소를 정밀하게 활용
    const personalityAdjustment = (personalityModifiers.greedBonus || 0) * 2.5 + 
                                  (personalityModifiers.riskBonus || 0) * 3 +
                                  (personalityModifiers.sequenceBonus || 0) * 2 +
                                  (personalityModifiers.bluffBonus || 0) * 1.5 +
                                  (personalityModifiers.vindictiveBonus || 0) * 1.8 +
                                  (personalityModifiers.socialBonus || 0) * 2.2;

    // === 최종 결정 (최상급: 스타일과 성격이 완전히 반영된 극한 정밀도) ===
    const finalValue = totalValue + randomFactor + tokenAdjustment + dynamicAdjustment + 
                       styleStrategy + personalityAdjustment;
    
    // 최상급 봇만의 특별한 최종 검증
    const ultimateValidation = this.performUltimateValidation(finalValue, currentCard, players, gameSettings);
    
    // 스타일에 따른 동적 임계값 조정
    const baseThreshold = -2.0;
    const styleThreshold = baseThreshold + (styleModifiers.conservatism - 0.5) * 4; // -4 to 0 범위
    const personalityThreshold = styleThreshold + (personalityModifiers.riskBonus) * 1.5;
    
    return (finalValue + ultimateValidation) > personalityThreshold ? 'take' : 'pass';
  }

  /**
   * 내 포지션 평가
   */
  evaluateMyPosition(players) {
    const scores = players.map(p => this.calculateEstimatedScore(p)).sort((a, b) => a - b);
    const myScore = this.calculateEstimatedScore(this);
    const position = scores.indexOf(myScore);
    
    if (position === 0) return 'leading';
    if (position >= players.length - 2) return 'behind';
    return 'middle';
  }

  /**
   * 상대방들의 실력 분석
   */
  analyzeOpponentStrengths(players) {
    return players
      .filter(p => p.id !== this.id)
      .map(p => {
        const profile = this.playerProfiles.get(p.id) || {};
        return profile.skillLevel || Math.random(); // 임시로 랜덤값
      });
  }

  /**
   * 추정 점수 계산
   */
  calculateEstimatedScore(player) {
    let score = 0;
    const sortedCards = player.cards.slice().sort((a, b) => a - b);
    let prev = null;
    
    for (const card of sortedCards) {
      if (prev === null || card !== prev + 1) {
        score += card;
      }
      prev = card;
    }
    
    return score - player.tokens;
  }

  /**
   * 선두 플레이어 찾기
   */
  findLeadingPlayer(players) {
    let bestPlayer = players[0];
    let bestScore = this.calculateEstimatedScore(bestPlayer);
    
    for (const player of players) {
      const score = this.calculateEstimatedScore(player);
      if (score < bestScore) {
        bestScore = score;
        bestPlayer = player;
      }
    }
    
    return bestPlayer;
  }

  /**
   * 심리적 이점 평가
   */
  evaluatePsychologicalAdvantage(players, currentCard) {
    let advantage = 0;
    
    for (const player of players) {
      if (player.id === this.id) continue;
      
      const profile = this.playerProfiles.get(player.id) || {};
      
      // 상대방이 이 카드를 원할 것 같으면 방해
      if (profile.preferredCards && profile.preferredCards.includes(currentCard)) {
        advantage += 2;
      }
      
      // 상대방이 토큰이 부족하면 압박
      if (player.tokens < 3) {
        advantage += 1;
      }
    }
    
    return advantage;
  }

  /**
   * 조작 기회 평가
   */
  evaluateManipulationOpportunity(players, currentCard, gameState) {
    let opportunity = 0;
    
    // 다른 플레이어들이 원하는 카드를 일부러 가져가서 방해
    const opponentNeeds = this.analyzeOpponentNeeds(players);
    if (opponentNeeds.some(need => Math.abs(need - currentCard) <= 2)) {
      opportunity += 3;
    }
    
    // 게임 후반이면 더 중요
    if (this.estimateGameProgress(players) > 0.6) {
      opportunity *= 1.5;
    }
    
    return opportunity;
  }

  /**
   * 상대방 니즈 분석
   */
  analyzeOpponentNeeds(players) {
    const needs = [];
    
    for (const player of players) {
      if (player.id === this.id) continue;
      
      // 상대방이 가진 카드에서 연속성을 위해 필요한 카드들 추정
      for (const card of player.cards) {
        needs.push(card - 1, card + 1);
      }
    }
    
    return needs;
  }

  /**
   * 토큰 파밍 기회 평가
   */
  evaluateTokenFarmingOpportunity(currentCard, pileTokens, players) {
    let farmingValue = 0;
    
    // 높은 카드일수록 다른 플레이어들도 피할 가능성 높음
    if (currentCard >= 25) {
      farmingValue += 4; // 매우 높은 카드는 토큰 파밍 기회 높음
    } else if (currentCard >= 20) {
      farmingValue += 2; // 높은 카드도 어느 정도 기회 있음
    }
    
    // 현재 쌓인 토큰이 적을 때 더 기다릴 가치 있음
    if (pileTokens === 0) {
      farmingValue += 3; // 토큰이 하나도 없으면 기다릴 가치 높음
    } else if (pileTokens === 1) {
      farmingValue += 2;
    } else if (pileTokens >= 4) {
      farmingValue -= 1; // 이미 충분히 쌓였으면 가져가기
    }
    
    // 다른 플레이어들의 토큰 상황 고려
    let playersWithLowTokens = 0;
    for (const player of players) {
      if (player.id !== this.id && player.tokens < 3) {
        playersWithLowTokens++;
      }
    }
    
    // 토큰이 부족한 플레이어가 많으면 토큰 파밍 기회 증가
    farmingValue += playersWithLowTokens * 1.5;
    
    // 내 토큰이 충분하면 굳이 기다릴 필요 없음
    if (this.tokens > 8) {
      farmingValue *= 0.5;
    } else if (this.tokens < 3) {
      farmingValue *= 1.5; // 내 토큰이 부족하면 더 적극적으로 파밍
    }
    
    return farmingValue;
  }

  /**
   * 초반 게임 전략
   */
  evaluateEarlyGameStrategy(currentCard, pileTokens) {
    // 초반에는 연속성보다 토큰 확보가 중요
    if (pileTokens >= 3) return 2;
    if (currentCard <= 10) return 1;
    return -1;
  }

  /**
   * 연속성 잠재력 평가
   */
  evaluateSequencePotential(currentCard) {
    let potential = 0;
    
    for (const myCard of this.cards) {
      const distance = Math.abs(currentCard - myCard);
      
      if (distance === 1) {
        // 바로 인접한 카드면 높은 보너스
        potential += 5;
      } else if (distance === 2) {
        // 한 칸 떨어진 카드면 중간 보너스 (사이 카드를 나중에 얻을 수 있음)
        potential += 2;
      } else if (distance === 3) {
        // 두 칸 떨어진 카드면 낮은 보너스
        potential += 0.5;
      }
    }
    
    // 이미 가진 카드들 사이에 현재 카드가 들어갈 수 있는지 확인
    const sortedCards = this.cards.slice().sort((a, b) => a - b);
    for (let i = 0; i < sortedCards.length - 1; i++) {
      if (currentCard > sortedCards[i] && currentCard < sortedCards[i + 1]) {
        const gap = sortedCards[i + 1] - sortedCards[i];
        if (gap <= 4) { // 갭이 4 이하면 연결 가능성 있음
          potential += (5 - gap); // 갭이 작을수록 높은 점수
        }
      }
    }
    
    return potential;
  }

  /**
   * 게임 종료 전략 평가
   */
  evaluateGameEndStrategy(currentCard, players, gameSettings) {
    let strategy = 0;
    
    if (!this.gameInfo) return 0;
    
    const remainingCards = this.gameInfo.deckSize;
    const gameProgress = 1 - (remainingCards / (this.gameInfo.originalDeckSize - this.gameInfo.totalRemovedCards));
    
    if (gameProgress > 0.7) {
      // 게임 후반: 더 신중하게
      strategy -= 2;
      
      // 내가 선두라면 더 보수적으로
      const myScore = this.calculateEstimatedScore(this);
      const leadingPlayer = this.findLeadingPlayer(players);
      
      if (leadingPlayer && leadingPlayer.id === this.id) {
        strategy -= 3; // 선두일 때 더 보수적
      } else {
        strategy += 1; // 뒤처질 때 약간 공격적
      }
      
      // 남은 카드가 적으면 더 신중
      if (remainingCards < 5) {
        strategy -= 4;
      }
    }
    
    return strategy;
  }

  /**
   * 베이지안 추론 기반 ROI 계산
   */
  calculateBayesianROI(currentCard, gameSettings, players) {
    // 사전 확률: 일반적인 카드 가치
    let priorValue = currentCard <= 15 ? 0.8 : currentCard <= 25 ? 0.5 : 0.2;
    
    // 우도: 현재 게임 상황에서의 증거
    let likelihood = 1.0;
    
    // 증거 1: 남은 카드와의 관계
    const remainingCards = this.estimateRemainingCards(players);
    if (remainingCards < 10) {
      likelihood *= currentCard > 20 ? 0.6 : 1.4; // 후반에 높은 카드는 더 나쁨
    }
    
    // 증거 2: 다른 플레이어들의 연속성
    for (const player of players) {
      if (player.id === this.id) continue;
      for (const card of player.cards) {
        if (Math.abs(currentCard - card) === 1) {
          likelihood *= 0.7; // 다른 사람이 원할 가능성
        }
      }
    }
    
    // 증거 3: 토큰 상황
    const gameProgress = this.estimateGameProgress(players);
    if (gameProgress > 0.7 && this.tokens <= 3) {
      likelihood *= 0.5; // 후반에 토큰 부족하면 더 신중
    }
    
    // 베이지안 업데이트
    const posteriorValue = (priorValue * likelihood) / 
      (priorValue * likelihood + (1 - priorValue) * (1 - likelihood));
    
    return posteriorValue * 4; // ROI로 변환
  }

  /**
   * 몬테카를로 시뮬레이션 기반 기댓값 계산
   */
  calculateMonteCarloExpectation(currentCard, players, gameSettings) {
    let totalExpectation = 0;
    const simulations = 10; // 계산량 제한
    
    for (let i = 0; i < simulations; i++) {
      // 시뮬레이션: 만약 패스한다면?
      let passValue = this.simulatePassOutcome(currentCard, players, gameSettings);
      // 시뮬레이션: 만약 가져간다면?
      let takeValue = this.simulateTakeOutcome(currentCard, players, gameSettings);
      
      totalExpectation += (passValue - takeValue);
    }
    
    return totalExpectation / simulations;
  }

  /**
   * 패스 결과 시뮬레이션
   */
  simulatePassOutcome(currentCard, players, gameSettings) {
    // 단순화된 시뮬레이션
    const tokenCost = 1;
    const expectedBenefit = this.calculateOpponentBurden(currentCard, 1, players) * 0.2;
    return expectedBenefit - tokenCost;
  }

  /**
   * 가져가기 결과 시뮬레이션
   */
  simulateTakeOutcome(currentCard, players, gameSettings) {
    // 카드 점수 - 연속성 보너스 - 토큰 획득
    let value = -currentCard;
    
    // 연속성 보너스
    for (const myCard of this.cards) {
      if (Math.abs(currentCard - myCard) === 1) {
        value += 5;
      }
    }
    
    // 예상 토큰 획득 (현재 카드 위의 토큰)
    value += gameSettings.pileTokens || 0;
    
    return value;
  }

  /**
   * 심리적 조작 전략 평가
   */
  evaluatePsychologicalManipulation(players, currentCard, gameSettings) {
    let manipulationValue = 0;
    
    for (const player of players) {
      if (player.id === this.id) continue;
      
      const profile = this.playerProfiles.get(player.id);
      if (!profile) continue;
      
      // 취약점 기반 조작
      for (const weakness of profile.weaknesses) {
        switch (weakness) {
          case 'EASILY_MANIPULATED':
            // 좋은 카드를 일부러 한 턴 더 돌려서 토큰 올리기
            if (currentCard <= 15 && this.tokens >= 5) {
              manipulationValue += 3;
            }
            break;
          case 'SEQUENCE_OBSESSED':
            // 연속 카드 집착자에게 미끼 던지기
            if (this.isSequenceCard(currentCard, profile)) {
              manipulationValue += 4;
            }
            break;
          case 'TOKEN_HOARDER':
            // 토큰 아끼는 사람에게 지속적 압박
            manipulationValue += 2;
            break;
        }
      }
    }
    
    return Math.min(manipulationValue, 6);
  }

  /**
   * 전략적 블러핑 평가
   */
  evaluateStrategicBluffing(players, currentCard, gameSettings) {
    const gameProgress = this.estimateGameProgress(players);
    let bluffValue = 0;
    
    // 후반부에서의 블러핑 효과 증대
    if (gameProgress > 0.6) {
      // 좋은 카드를 일부러 포기하는 척하기
      if (currentCard <= 12 && this.tokens >= 7) {
        for (const player of players) {
          if (player.id === this.id) continue;
          if (player.tokens <= 2) {
            bluffValue += 3; // 토큰 부족한 상대에게 좋은 카드 떠넘기기
          }
        }
      }
    }
    
    return Math.min(bluffValue, 4);
  }

  /**
   * 게임 트리 탐색 (N수 앞까지 분석)
   */
  evaluateGameTree(currentCard, players, gameSettings, depth) {
    if (depth <= 0) return 0;
    
    // 단순화된 게임 트리 - 실제로는 더 복잡한 구현 필요
    let bestValue = -Infinity;
    
    // 패스 경로 평가
    const passValue = this.evaluatePassPath(currentCard, players, gameSettings, depth - 1);
    bestValue = Math.max(bestValue, passValue);
    
    // 가져가기 경로 평가  
    const takeValue = this.evaluateTakePath(currentCard, players, gameSettings, depth - 1);
    bestValue = Math.max(bestValue, takeValue);
    
    return bestValue * 0.1; // 깊이에 따른 가중치 감소
  }

  /**
   * 패스 경로 평가
   */
  evaluatePassPath(currentCard, players, gameSettings, depth) {
    // 재귀적으로 다음 상황 평가
    // 여기서는 단순화된 버전
    return this.calculateOpponentBurden(currentCard, 1, players) - 1;
  }

  /**
   * 가져가기 경로 평가
   */
  evaluateTakePath(currentCard, players, gameSettings, depth) {
    // 재귀적으로 다음 상황 평가
    // 여기서는 단순화된 버전
    return -currentCard + (gameSettings.pileTokens || 0);
  }

  /**
   * === 고급 확률 기반 의사결정 시스템 ===
   */

  /**
   * 동적 위험도 평가 시스템
   */
  calculateProbabilisticRisk(currentCard, players, gameSettings) {
    let riskFactor = 0;
    
    // 1. 카드 가치 기반 위험도
    const cardRisk = currentCard > 25 ? 3 : currentCard > 20 ? 1 : -1;
    riskFactor += cardRisk;
    
    // 2. 토큰 희소성 기반 위험도
    const tokenRatio = this.tokens / gameSettings.initialTokens;
    const tokenRisk = tokenRatio < 0.2 ? 4 : tokenRatio < 0.5 ? 2 : 0;
    riskFactor += tokenRisk;
    
    // 3. 게임 진행도 기반 위험도
    const gameProgress = this.estimateGameProgress(players);
    const progressRisk = gameProgress > 0.8 ? 3 : gameProgress > 0.6 ? 1 : 0;
    riskFactor += progressRisk;
    
    // 4. 상대방 경쟁 강도 기반 위험도
    const competitionRisk = this.calculateCompetitionIntensity(currentCard, players);
    riskFactor += competitionRisk;
    
    // 5. 확률적 분포 기반 위험도
    const distributionRisk = this.analyzeCardDistribution(currentCard, players);
    riskFactor += distributionRisk;
    
    return Math.min(riskFactor, 12); // 최대 위험도 제한
  }

  /**
   * 경쟁 강도 계산
   */
  calculateCompetitionIntensity(currentCard, players) {
    let intensity = 0;
    
    for (const player of players) {
      if (player.id === this.id) continue;
      
      // 각 플레이어가 이 카드를 원할 확률 계산
      const desirability = this.calculateCardDesirability(currentCard, player);
      intensity += desirability;
      
      // AI 봇의 경우 더 정확한 경쟁 예측
      if (player.isBot) {
        const botStrategy = this.predictBotStrategy(player, currentCard);
        intensity += botStrategy;
      }
    }
    
    return Math.min(intensity, 8);
  }

  /**
   * 플레이어별 카드 선호도 계산
   */
  calculateCardDesirability(card, player) {
    let desirability = 0;
    
    // 연속성 보너스
    for (const playerCard of player.cards) {
      if (Math.abs(card - playerCard) === 1) {
        desirability += 3;
      }
    }
    
    // 카드 가치 기반 선호도
    if (card <= 15) desirability += 2;
    else if (card <= 25) desirability += 1;
    else desirability -= 1;
    
    return desirability;
  }

  /**
   * 상대방 행동 예측 시스템
   */
  predictOpponentBehavior(players, currentCard, gameSettings) {
    const predictions = new Map();
    
    for (const player of players) {
      if (player.id === this.id) continue;
      
      let prediction = {
        passProb: 0.5,
        takeProb: 0.5,
        reasoning: [],
        confidence: 0.5
      };
      
      // 프로파일 기반 예측 (인간 플레이어)
      if (this.playerProfiles.has(player.id)) {
        const profile = this.playerProfiles.get(player.id);
        prediction = this.predictFromProfile(profile, currentCard, player, gameSettings);
      }
      
      // AI 봇 행동 예측
      if (player.isBot) {
        prediction = this.predictBotBehavior(player, currentCard, gameSettings);
      }
      
      // 토큰 상황 기반 조정
      this.adjustPredictionByTokens(prediction, player, gameSettings);
      
      predictions.set(player.id, prediction);
    }
    
    return predictions;
  }

  /**
   * 프로파일 기반 행동 예측
   */
  predictFromProfile(profile, currentCard, player, gameSettings) {
    let passProb = 0.5;
    let takeProb = 0.5;
    const reasoning = [];
    
    // 위험 감수성 기반 예측
    if (profile.cardPreferences.riskTolerance < 0.4) {
      if (currentCard > 20) {
        passProb += 0.3;
        reasoning.push('HIGH_RISK_AVERSION');
      }
    }
    
    // 토큰 보수성 기반 예측
    if (profile.tokenBehavior.conservation > 0.7) {
      passProb -= 0.2;
      reasoning.push('TOKEN_CONSERVATION');
    }
    
    // 연속성 추구 성향
    if (profile.cardPreferences.sequenceHunter > 0.6) {
      const hasSequence = this.checkPlayerSequences(player);
      if (hasSequence) {
        takeProb += 0.3;
        reasoning.push('SEQUENCE_HUNTER');
      }
    }
    
    // 정규화
    const total = passProb + takeProb;
    passProb /= total;
    takeProb /= total;
    
    return {
      passProb,
      takeProb,
      reasoning,
      confidence: 0.7 // 프로파일 기반은 높은 신뢰도
    };
  }

  /**
   * AI 봇 행동 예측
   */
  predictBotBehavior(botPlayer, currentCard, gameSettings) {
    let passProb = 0.5;
    let takeProb = 0.5;
    
    // 난이도별 예측 패턴
    switch (botPlayer.difficulty) {
      case 'medium':
        // 중급 봇은 단순한 패턴
        if (currentCard <= 15) takeProb = 0.7;
        else if (currentCard > 25) takeProb = 0.3;
        break;
        
      case 'hard':
        // 상급 봇은 더 복잡한 판단
        const cardValue = this.evaluateCardValue(currentCard, gameSettings, []);
        if (cardValue > 0) takeProb = 0.6;
        else passProb = 0.6;
        break;
        
      case 'expert':
        // 최상급 봇은 매우 계산적
        const advancedValue = this.evaluateAdvancedCardStrategy([], currentCard);
        if (advancedValue > 2) takeProb = 0.8;
        else if (advancedValue < -2) passProb = 0.8;
        break;
    }
    
    return {
      passProb,
      takeProb,
      reasoning: ['BOT_DIFFICULTY_PATTERN'],
      confidence: 0.8 // 봇 행동은 예측 가능성 높음
    };
  }

  /**
   * 토큰 상황별 예측 조정
   */
  adjustPredictionByTokens(prediction, player, gameSettings) {
    const tokenRatio = player.tokens / gameSettings.initialTokens;
    
    if (tokenRatio < 0.1) {
      // 토큰 거의 없으면 강제 가져가기 가능성 높음
      prediction.takeProb += 0.3;
      prediction.passProb -= 0.3;
      prediction.reasoning.push('FORCED_TAKE_LOW_TOKENS');
    } else if (tokenRatio > 0.8) {
      // 토큰 많으면 패스 가능성 높음
      prediction.passProb += 0.2;
      prediction.takeProb -= 0.2;
      prediction.reasoning.push('HIGH_TOKEN_FLEXIBILITY');
    }
    
    // 정규화
    const total = prediction.passProb + prediction.takeProb;
    prediction.passProb /= total;
    prediction.takeProb /= total;
  }

  /**
   * 카드 분포 확률 분석
   */
  analyzeCardDistribution(currentCard, players) {
    let distributionValue = 0;
    
    // 1. 남은 카드들의 예상 분포
    const remainingCards = this.estimateRemainingCards(players);
    const gameProgress = this.estimateGameProgress(players);
    
    // 2. 현재 카드가 남은 카드들 중에서의 상대적 위치
    const expectedLowCards = remainingCards * 0.3; // 낮은 카드 30% 예상
    const expectedMidCards = remainingCards * 0.4; // 중간 카드 40% 예상
    const expectedHighCards = remainingCards * 0.3; // 높은 카드 30% 예상
    
    if (currentCard <= 15) {
      // 낮은 카드일 경우
      distributionValue = expectedLowCards < 3 ? 3 : 1; // 희소하면 더 가치있음
    } else if (currentCard <= 25) {
      // 중간 카드일 경우  
      distributionValue = gameProgress > 0.7 ? 2 : 0;
    } else {
      // 높은 카드일 경우
      distributionValue = remainingCards < 5 ? -1 : -2; // 선택의 여지가 없을 때만 어쩔 수 없이
    }
    
    // 3. 다른 플레이어들의 카드 분포와 비교
    const avgOpponentCard = this.calculateAverageOpponentCardValue(players);
    if (currentCard < avgOpponentCard - 5) {
      distributionValue += 2; // 상대보다 훨씬 좋은 카드
    }
    
    return distributionValue;
  }

  /**
   * 상대방 평균 카드 가치 계산
   */
  calculateAverageOpponentCardValue(players) {
    let totalValue = 0;
    let totalCards = 0;
    
    for (const player of players) {
      if (player.id === this.id) continue;
      
      for (const card of player.cards) {
        totalValue += card;
        totalCards++;
      }
    }
    
    return totalCards > 0 ? totalValue / totalCards : 20; // 기본값
  }

  /**
   * 게임 이론적 최적화
   */
  evaluateGameTheory(currentCard, players, gameSettings) {
    let gameTheoryValue = 0;
    
    // 1. 내쉬 균형 분석 (단순화된 버전)
    const nashValue = this.calculateNashEquilibrium(currentCard, players, gameSettings);
    gameTheoryValue += nashValue;
    
    // 2. 미니맥스 전략
    const minimaxValue = this.calculateMinimax(currentCard, players);
    gameTheoryValue += minimaxValue;
    
    // 3. 지배 전략 분석
    const dominanceValue = this.analyzeDominantStrategy(currentCard, players, gameSettings);
    gameTheoryValue += dominanceValue;
    
    return Math.min(gameTheoryValue, 6);
  }

  /**
   * 내쉬 균형 계산 (단순화)
   */
  calculateNashEquilibrium(currentCard, players, gameSettings) {
    // 모든 플레이어가 최적으로 행동한다고 가정
    let equilibriumValue = 0;
    
    const predictions = this.predictOpponentBehavior(players, currentCard, gameSettings);
    
    // 상대방들이 패스할 확률이 높으면 내가 가져갈 가치 증가
    let avgPassProb = 0;
    let playerCount = 0;
    
    for (const [playerId, prediction] of predictions) {
      avgPassProb += prediction.passProb;
      playerCount++;
    }
    
    if (playerCount > 0) {
      avgPassProb /= playerCount;
      
      // 모두가 패스할 확률이 높으면 좋은 기회
      if (avgPassProb > 0.7) {
        equilibriumValue += 2;
      }
      // 모두가 가져갈 확률이 높으면 경쟁 치열
      else if (avgPassProb < 0.3) {
        equilibriumValue -= 1;
      }
    }
    
    return equilibriumValue;
  }

  /**
   * 미니맥스 계산
   */
  calculateMinimax(currentCard, players) {
    // 최악의 경우를 가정한 최선의 선택
    let minimaxValue = 0;
    
    // 최악의 시나리오: 나쁜 카드를 가져가야 하는 상황
    if (currentCard > 25) {
      // 상대방들의 토큰 상황 고려
      const minOpponentTokens = Math.min(...players
        .filter(p => p.id !== this.id)
        .map(p => p.tokens));
      
      if (minOpponentTokens === 0) {
        // 누군가는 반드시 가져가야 함
        minimaxValue = currentCard <= 30 ? -1 : -3;
      }
    }
    
    // 최선의 시나리오: 좋은 카드를 독점할 수 있는 상황
    if (currentCard <= 15) {
      const maxOpponentTokens = Math.max(...players
        .filter(p => p.id !== this.id)
        .map(p => p.tokens));
      
      if (this.tokens > maxOpponentTokens + 3) {
        // 토큰 우위로 경쟁에서 이길 수 있음
        minimaxValue = 2;
      }
    }
    
    return minimaxValue;
  }

  /**
   * 지배 전략 분석
   */
  analyzeDominantStrategy(currentCard, players, gameSettings) {
    let dominanceValue = 0;
    
    // 강지배 전략 확인
    if (this.tokens === 0) {
      // 토큰이 없으면 무조건 가져가기 (강지배)
      dominanceValue += 5;
    }
    
    // 약지배 전략 확인
    const gameProgress = this.estimateGameProgress(players);
    
    // 후반부에서 토큰이 많고 카드가 나쁠 때
    if (gameProgress > 0.8 && this.tokens > 5 && currentCard > 25) {
      // 패스가 약지배 전략
      dominanceValue -= 2;
    }
    
    // 초반에서 좋은 카드일 때
    if (gameProgress < 0.3 && currentCard <= 12) {
      // 가져가기가 약지배 전략
      dominanceValue += 3;
    }
    
    return dominanceValue;
  }

  /**
   * 봇 전략 예측
   */
  predictBotStrategy(botPlayer, currentCard) {
    // 봇의 난이도별 전략 패턴을 분석하여 경쟁 강도 예측
    switch (botPlayer.difficulty) {
      case 'medium':
        return currentCard <= 20 ? 1 : 0;
      case 'hard':
        return currentCard <= 25 ? 2 : 1;
      case 'expert':
        return 3; // 전문가 봇은 항상 강력한 경쟁자
      default:
        return 1;
    }
  }

  /**
   * 카드 기반 방해 전략 평가 (모든 플레이어 대상)
   */
  evaluateCardInterference(players, currentCard) {
    if (!currentCard) return 0;
    
    let interference = 0;
    
    for (const player of players) {
      if (player.id === this.id) continue; // 자신만 제외, AI 봇도 경쟁 대상
      
      // 상대방의 카드와 연속성 확인
      for (const card of player.cards) {
        if (Math.abs(currentCard - card) === 1) {
          interference += 2; // 상대방이 연속카드를 원할 것
          
          // AI 봇 간 경쟁에서는 추가 보너스
          if (player.isBot) {
            interference += 1; // AI 봇도 똑똑하므로 더 적극적으로 견제
          }
        }
      }
    }
    
    return Math.min(interference, 8); // 최대값 증가 (더 많은 플레이어 대상)
  }

  /**
   * 토큰 압박 전략 (공개 모드에서만)
   */
  evaluateTokenPressure(players) {
    let pressure = 0;
    
    for (const player of players) {
      if (player.id === this.id || player.isBot) continue;
      
      if (player.tokens <= 1) {
        pressure += 3; // 상대가 토큰 부족하면 더 적극적으로
      } else if (player.tokens <= 3) {
        pressure += 1;
      }
    }
    
    return Math.min(pressure, 4);
  }

  /**
   * 고급 카드 전략 (최상급용) - 제거된 카드 정보 활용
   */
  evaluateAdvancedCardStrategy(players, currentCard) {
    if (!currentCard) return 0;
    
    let value = 0;
    
    // 내 카드와의 시너지 계산
    const myCards = this.cards.slice().sort((a, b) => a - b);
    let maxSynergy = 0;
    
    // 현재 카드를 추가했을 때의 연속성 계산
    let tempCards = [...myCards, currentCard].sort((a, b) => a - b);
    let consecutive = 1;
    
    for (let j = 0; j < tempCards.length - 1; j++) {
      if (tempCards[j + 1] === tempCards[j] + 1) {
        consecutive++;
      } else {
        maxSynergy = Math.max(maxSynergy, consecutive);
        consecutive = 1;
      }
    }
    maxSynergy = Math.max(maxSynergy, consecutive);
    
    value += maxSynergy * 2; // 연속성 보너스
    
    // 제거된 카드 정보를 활용한 확률 계산
    if (this.gameInfo && this.gameInfo.totalRemovedCards > 0) {
      const cardRarity = this.evaluateCardRarity(currentCard);
      value += cardRarity;
    }
    
    // 게임 진행도 기반 카드 가치 조정
    const gameProgress = this.estimateGameProgress(players);
    if (gameProgress > 0.7) {
      // 후반부에서는 낮은 카드가 더욱 중요
      if (currentCard <= 15) value += 4;
      else if (currentCard <= 25) value += 2;
      else value -= 1; // 높은 카드 페널티 증가
    } else if (gameProgress > 0.3) {
      // 중반부 기본 전략
      if (currentCard <= 15) value += 3;
      else if (currentCard <= 25) value += 1;
    }
    
    return value;
  }

  /**
   * 카드 희귀도 평가 (제거된 카드 정보 활용)
   */
  evaluateCardRarity(card) {
    if (!this.gameInfo) return 0;
    
    // 현재 카드가 낮은 범위인지 확인
    if (card <= 10) {
      // 낮은 카드는 항상 가치가 높음
      return 2;
    } else if (card <= 20) {
      // 중간 카드는 게임 후반에 가치 상승
      const remainingCards = this.gameInfo.deckSize;
      return remainingCards < 10 ? 2 : 1;
    } else {
      // 높은 카드는 가치가 낮지만, 매우 적게 남았을 때는 어쩔 수 없이 가져감
      const remainingCards = this.gameInfo.deckSize;
      return remainingCards < 5 ? 0 : -1;
    }
  }

  /**
   * 상대방 차단 전략
   */
  evaluateOpponentBlocking(players, currentCard) {
    if (!currentCard) return 0;
    
    let blockingValue = 0;
    
    for (const player of players) {
      if (player.id === this.id || player.isBot) continue;
      
      // 상대방이 이 카드로 큰 연속을 만들 수 있는지 확인
      for (const card of player.cards) {
        if (Math.abs(currentCard - card) === 1) {
          // 연속성 확인
          let runLength = this.calculateRunLength(player.cards, currentCard);
          if (runLength >= 3) {
            blockingValue += 4; // 큰 연속을 방해
          }
        }
      }
    }
    
    return Math.min(blockingValue, 6);
  }

  /**
   * 고급 토큰 전략 (최상급용)
   */
  evaluateAdvancedTokenStrategy(players, gameSettings) {
    let strategy = 0;
    
    // 상대방들의 평균 토큰 대비 내 위치
    const opponentTokens = players
      .filter(p => p.id !== this.id && !p.isBot)
      .map(p => p.tokens);
    
    if (opponentTokens.length > 0) {
      const avgOpponentTokens = opponentTokens.reduce((sum, t) => sum + t, 0) / opponentTokens.length;
      const myRatio = this.tokens / gameSettings.initialTokens;
      const avgRatio = avgOpponentTokens / gameSettings.initialTokens;
      
      if (myRatio > avgRatio + 0.3) {
        strategy += 2; // 내가 토큰이 많으면 더 적극적
      } else if (myRatio < avgRatio - 0.3) {
        strategy -= 3; // 내가 토큰이 적으면 보수적
      }
    }
    
    return strategy;
  }

  /**
   * 게임 단계별 전략
   */
  evaluateGamePhaseStrategy(players, gameSettings, currentCard) {
    const gameProgress = this.estimateGameProgress(players);
    
    if (!currentCard) return 0;
    
    if (gameProgress < 0.3) {
      // 초반: 낮은 카드 우선, 토큰 보존
      return currentCard <= 12 ? 2 : -1;
    } else if (gameProgress < 0.7) {
      // 중반: 공격적 플레이
      return currentCard <= 20 ? 1 : 0;
    } else {
      // 후반: 매우 신중하게
      return currentCard <= 10 ? 3 : -2;
    }
  }

  /**
   * 연속 카드 길이 계산
   */
  calculateRunLength(cards, additionalCard) {
    const allCards = [...cards, additionalCard].sort((a, b) => a - b);
    let maxRun = 1;
    let currentRun = 1;
    
    for (let i = 1; i < allCards.length; i++) {
      if (allCards[i] === allCards[i-1] + 1) {
        currentRun++;
      } else {
        maxRun = Math.max(maxRun, currentRun);
        currentRun = 1;
      }
    }
    
    return Math.max(maxRun, currentRun);
  }


  /**
   * 방어적 전략 평가 - 내 카드를 보호
   */
  evaluateDefensiveStrategy(players, currentCard) {
    if (!currentCard) return 0;
    
    let defensiveValue = 0;
    
    // 상대방이 내 카드와 연속성을 만들 수 있는 카드를 가져가려 하는지 확인
    for (const player of players) {
      if (player.id === this.id || player.isBot) continue;
      
      for (const myCard of this.cards) {
        // 현재 카드가 내 카드와 연속성을 이루면 방어적으로 접근
        if (Math.abs(currentCard - myCard) === 1) {
          // 상대방이 이 카드로 내 연속을 방해할 수 있는지 확인
          for (const oppCard of player.cards) {
            if (Math.abs(currentCard - oppCard) === 1 && oppCard !== myCard) {
              defensiveValue += 3; // 내 연속 보호를 위해 더 적극적으로
            }
          }
        }
      }
    }
    
    return Math.min(defensiveValue, 5);
  }

  /**
   * 심리전 평가 (상급용)
   */
  evaluatePsychologicalWarfare(players, gameSettings, currentCard) {
    if (!currentCard) return 0;
    
    let psychValue = 0;
    
    // 상대방의 토큰 상황을 보고 압박 가하기
    const humanPlayers = players.filter(p => !p.isBot && p.id !== this.id);
    
    for (const player of humanPlayers) {
      const tokenRatio = player.tokens / gameSettings.initialTokens;
      
      // 상대가 토큰이 부족할 때 좋은 카드를 놓고 고민하게 만들기
      if (tokenRatio < 0.3 && currentCard <= 15) {
        psychValue += 2; // 압박 상황에서 좋은 카드를 두고 고민하게 만들기
      }
      
      // 상대가 토큰이 많을 때는 빠르게 카드를 가져가기
      if (tokenRatio > 0.7 && currentCard > 25) {
        psychValue -= 1; // 나쁜 카드는 빨리 떠넘기기
      }
    }
    
    return psychValue;
  }

  /**
   * 마스터급 방어 전략 (최상급용)
   */
  evaluateMasterDefensiveStrategy(players, currentCard) {
    if (!currentCard) return 0;
    
    let masterDefense = 0;
    
    // 복잡한 연속성 시나리오 분석
    const myCardsSorted = this.cards.slice().sort((a, b) => a - b);
    
    // 내 카드 그룹들 분석
    const myGroups = this.analyzeCardGroups(myCardsSorted);
    
    for (const group of myGroups) {
      // 각 그룹의 끝점에서 연속성을 확장할 수 있는 카드인지 확인
      const minCard = Math.min(...group);
      const maxCard = Math.max(...group);
      
      if (currentCard === minCard - 1 || currentCard === maxCard + 1) {
        // 내 그룹을 확장할 수 있는 카드
        masterDefense += 4;
        
        // 상대방도 이 카드를 원하는지 확인
        for (const player of players) {
          if (player.id === this.id || player.isBot) continue;
          
          for (const oppCard of player.cards) {
            if (Math.abs(currentCard - oppCard) === 1) {
              masterDefense += 2; // 경쟁이 있으면 더 적극적
            }
          }
        }
      }
    }
    
    return Math.min(masterDefense, 8);
  }

  /**
   * 마스터급 심리전 (최상급용)
   */
  evaluateMasterPsychology(players, gameSettings, currentCard) {
    if (!currentCard) return 0;
    
    let masterPsych = 0;
    const humanPlayers = players.filter(p => !p.isBot && p.id !== this.id);
    
    // 게임 상황에 따른 심리적 압박
    const gameProgress = this.estimateGameProgress(players);
    
    for (const player of humanPlayers) {
      const tokenRatio = player.tokens / gameSettings.initialTokens;
      const cardCount = player.cards.length;
      
      // 후반부에서 상대방의 약점 파악
      if (gameProgress > 0.7) {
        if (tokenRatio < 0.2 && cardCount > 3) {
          // 토큰 부족하고 카드 많은 상대에게 압박
          masterPsych += currentCard <= 20 ? 3 : -1;
        }
        
        if (tokenRatio > 0.8 && cardCount < 2) {
          // 토큰 많고 카드 적은 상대는 공격적으로 나올 것
          masterPsych += currentCard > 20 ? 2 : 0;
        }
      }
      
      // 중반부에서의 견제
      if (gameProgress > 0.3 && gameProgress < 0.7) {
        const playerScore = this.calculatePlayerCurrentScore(player);
        const myScore = this.calculatePlayerCurrentScore(this);
        
        if (playerScore < myScore) {
          // 점수가 앞선 상대 견제
          masterPsych += 1;
        }
      }
    }
    
    return Math.min(masterPsych, 6);
  }

  /**
   * === 실시간 적응형 전략 시스템 ===
   */

  /**
   * 적응적 전략 (최상급용) - 대폭 강화
   */
  evaluateAdaptiveStrategy(players, currentCard) {
    if (!currentCard) return 0;
    
    let adaptive = 0;
    
    // 1. 게임 상황별 적응형 전략
    const situationalValue = this.evaluateSituationalAdaptation(players, currentCard);
    adaptive += situationalValue;
    
    // 2. 플레이어별 맞춤형 카운터 전략
    const counterValue = this.evaluateCounterStrategy(players, currentCard);
    adaptive += counterValue;
    
    // 3. 메타 게임 학습 기반 적응
    const metaValue = this.evaluateMetaGameAdaptation(players, currentCard);
    adaptive += metaValue;
    
    // 4. 동적 전략 변경 시스템
    const dynamicValue = this.evaluateDynamicStrategyShift(players, currentCard);
    adaptive += dynamicValue;
    
    // 5. 실시간 패턴 인식 및 대응
    const patternValue = this.evaluateRealTimePatternResponse(players, currentCard);
    adaptive += patternValue;
    
    return Math.min(adaptive, 8); // 최대값 증가
  }

  /**
   * 게임 상황별 적응형 전략
   */
  evaluateSituationalAdaptation(players, currentCard) {
    let situational = 0;
    const gameProgress = this.estimateGameProgress(players);
    
    // 초반 상황 적응
    if (gameProgress < 0.3) {
      situational += this.adaptToEarlyGame(players, currentCard);
    }
    // 중반 상황 적응
    else if (gameProgress < 0.7) {
      situational += this.adaptToMidGame(players, currentCard);
    }
    // 후반 상황 적응
    else {
      situational += this.adaptToLateGame(players, currentCard);
    }
    
    // 특수 상황별 적응
    situational += this.adaptToSpecialSituations(players, currentCard);
    
    return situational;
  }

  /**
   * 초반 게임 적응 전략
   */
  adaptToEarlyGame(players, currentCard) {
    let value = 0;
    
    // 토큰 우위 선점 전략
    const tokenAdvantage = this.calculateTokenAdvantage(players);
    if (tokenAdvantage > 0.2) {
      // 토큰이 많으면 공격적 플레이
      if (currentCard <= 20) value += 2;
    } else if (tokenAdvantage < -0.2) {
      // 토큰이 적으면 보수적 플레이
      if (currentCard <= 12) value += 3; // 좋은 카드만 선별
    }
    
    // 포지션 설정 전략
    const positionValue = this.establishPosition(players, currentCard);
    value += positionValue;
    
    return Math.min(value, 4);
  }

  /**
   * 중반 게임 적응 전략
   */
  adaptToMidGame(players, currentCard) {
    let value = 0;
    
    // 상대방 전략 분석 및 대응
    const opponentStrategies = this.analyzeOpponentStrategies(players);
    for (const [playerId, strategy] of opponentStrategies) {
      const counterValue = this.generateCounterPlay(strategy, currentCard, playerId);
      value += counterValue;
    }
    
    // 균형점 찾기 전략
    const balanceValue = this.findStrategicBalance(players, currentCard);
    value += balanceValue;
    
    return Math.min(value, 3);
  }

  /**
   * 후반 게임 적응 전략
   */
  adaptToLateGame(players, currentCard) {
    let value = 0;
    
    // 엔드게임 최적화
    const endgameValue = this.optimizeForEndgame(players, currentCard);
    value += endgameValue;
    
    // 마지막 기회 포착
    const opportunityValue = this.seizeFinalOpportunity(players, currentCard);
    value += opportunityValue;
    
    // 위험 최소화 전략
    const riskMinimization = this.minimizeEndgameRisk(players, currentCard);
    value += riskMinimization;
    
    return Math.min(value, 5);
  }

  /**
   * 플레이어별 맞춤형 카운터 전략
   */
  evaluateCounterStrategy(players, currentCard) {
    let counterValue = 0;
    
    for (const player of players) {
      if (player.id === this.id) continue;
      
      const profile = this.playerProfiles.get(player.id);
      if (!profile) continue;
      
      // 각 플레이어의 약점에 맞는 카운터 전략
      const specificCounter = this.generateSpecificCounter(profile, player, currentCard);
      counterValue += specificCounter;
      
      // 플레이어 간 관계 분석 기반 전략
      const relationshipValue = this.analyzePlayerRelationships(player, players, currentCard);
      counterValue += relationshipValue;
    }
    
    return Math.min(counterValue, 6);
  }

  /**
   * 메타 게임 학습 기반 적응
   */
  evaluateMetaGameAdaptation(players, currentCard) {
    let metaValue = 0;
    
    // 게임 전체 흐름 패턴 학습
    const flowPattern = this.learnGameFlowPattern(players);
    metaValue += this.adaptToFlowPattern(flowPattern, currentCard);
    
    // 플레이어 상호작용 패턴 분석
    const interactionPattern = this.analyzePlayerInteractions(players);
    metaValue += this.adaptToInteractionPattern(interactionPattern, currentCard);
    
    // 게임 결과 예측 기반 전략 조정
    const outcomePredicton = this.predictGameOutcome(players);
    metaValue += this.adaptToOutcomePrediction(outcomePredicton, currentCard);
    
    return Math.min(metaValue, 4);
  }

  /**
   * 동적 전략 변경 시스템
   */
  evaluateDynamicStrategyShift(players, currentCard) {
    let shiftValue = 0;
    
    // 현재 전략의 효과 측정
    const currentEffectiveness = this.measureStrategyEffectiveness();
    
    // 효과가 떨어지면 전략 변경
    if (currentEffectiveness < 0.6) {
      shiftValue += this.executeStrategyShift(players, currentCard);
    }
    
    // 상황 변화 감지 및 대응
    const situationChange = this.detectSituationChange(players);
    if (situationChange) {
      shiftValue += this.respondToSituationChange(situationChange, currentCard);
    }
    
    return Math.min(shiftValue, 3);
  }

  /**
   * 실시간 패턴 인식 및 대응
   */
  evaluateRealTimePatternResponse(players, currentCard) {
    let patternValue = 0;
    
    // 최근 3턴 패턴 분석
    const recentPattern = this.analyzeRecentPattern(players, 3);
    patternValue += this.respondToPattern(recentPattern, currentCard);
    
    // 플레이어별 행동 시퀀스 분석
    for (const player of players) {
      if (player.id === this.id) continue;
      
      const behaviorSequence = this.analyzeBehaviorSequence(player);
      const responseValue = this.generatePatternResponse(behaviorSequence, currentCard);
      patternValue += responseValue;
    }
    
    return Math.min(patternValue, 4);
  }

  /**
   * 토큰 우위 계산
   */
  calculateTokenAdvantage(players) {
    const myRatio = this.tokens / 11; // 초기 토큰 11개 기준
    const opponentRatios = players
      .filter(p => p.id !== this.id)
      .map(p => p.tokens / 11);
    
    if (opponentRatios.length === 0) return 0;
    
    const avgOpponentRatio = opponentRatios.reduce((sum, ratio) => sum + ratio, 0) / opponentRatios.length;
    return myRatio - avgOpponentRatio;
  }

  /**
   * 포지션 설정 전략
   */
  establishPosition(players, currentCard) {
    let positionValue = 0;
    
    // 연속성 기반 포지션
    const sequenceValue = this.calculateSequencePosition(currentCard);
    positionValue += sequenceValue;
    
    // 토큰 효율성 기반 포지션
    const efficiencyValue = this.calculateEfficiencyPosition(players, currentCard);
    positionValue += efficiencyValue;
    
    return positionValue;
  }

  /**
   * 상대방 전략 분석
   */
  analyzeOpponentStrategies(players) {
    const strategies = new Map();
    
    for (const player of players) {
      if (player.id === this.id) continue;
      
      const profile = this.playerProfiles.get(player.id);
      if (profile) {
        const strategy = this.identifyPlayerStrategy(profile, player);
        strategies.set(player.id, strategy);
      }
    }
    
    return strategies;
  }

  /**
   * 플레이어 전략 식별
   */
  identifyPlayerStrategy(profile, player) {
    const strategy = {
      type: 'unknown',
      tendency: 'neutral',
      strength: 0.5,
      weakness: []
    };
    
    // 카드 선호도 기반 전략 분류
    if (profile.cardPreferences.lowCardTendency > 0.7) {
      strategy.type = 'conservative';
      strategy.tendency = 'defensive';
    } else if (profile.tokenBehavior.aggressiveness > 0.7) {
      strategy.type = 'aggressive';
      strategy.tendency = 'offensive';
    } else if (profile.cardPreferences.sequenceHunter > 0.7) {
      strategy.type = 'sequence_focused';
      strategy.tendency = 'opportunistic';
    }
    
    // 약점 식별
    strategy.weakness = [...profile.weaknesses];
    
    return strategy;
  }

  /**
   * 카운터 플레이 생성
   */
  generateCounterPlay(strategy, currentCard, playerId) {
    let counterValue = 0;
    
    switch (strategy.type) {
      case 'conservative':
        // 보수적 플레이어에게는 압박 전략
        if (currentCard <= 20) counterValue += 2;
        break;
        
      case 'aggressive':
        // 공격적 플레이어에게는 방어 전략
        if (currentCard > 25) counterValue -= 1; // 나쁜 카드는 빨리 떠넘김
        break;
        
      case 'sequence_focused':
        // 연속성 추구 플레이어 견제
        counterValue += this.blockSequenceStrategy(currentCard, playerId);
        break;
    }
    
    return counterValue;
  }

  /**
   * 전략 효과 측정
   */
  measureStrategyEffectiveness() {
    // 단순화된 효과 측정 - 실제로는 더 복잡한 분석 필요
    const myScore = this.calculatePlayerCurrentScore(this);
    const avgOpponentScore = this.calculateAverageOpponentScore();
    
    return myScore < avgOpponentScore ? 0.8 : 0.4; // 점수가 낮을수록 효과적
  }

  /**
   * 평균 상대방 점수 계산
   */
  calculateAverageOpponentScore() {
    // 이 메서드는 players 정보가 필요하므로 실제 구현 시 수정 필요
    return 15; // 임시 기본값
  }

  /**
   * 전략 변경 실행
   */
  executeStrategyShift(players, currentCard) {
    // 현재 상황에 맞는 새로운 전략으로 변경
    const gameProgress = this.estimateGameProgress(players);
    
    if (gameProgress < 0.5) {
      // 초중반: 더 공격적으로 변경
      return currentCard <= 18 ? 2 : 0;
    } else {
      // 후반: 더 보수적으로 변경
      return currentCard <= 12 ? 3 : -1;
    }
  }

  /**
   * 상황 변화 감지
   */
  detectSituationChange(players) {
    // 게임 상황의 급격한 변화 감지
    const currentBalance = this.assessCurrentBalance(players);
    
    // 이전 상태와 비교 (실제로는 과거 상태 저장 필요)
    return Math.abs(currentBalance) > 0.3; // 임계값 초과시 변화 감지
  }

  /**
   * 현재 균형 상태 평가
   */
  assessCurrentBalance(players) {
    const myPosition = this.calculateRelativePosition(players);
    return myPosition - 0.5; // 0.5가 중간 위치
  }

  /**
   * 상대적 위치 계산
   */
  calculateRelativePosition(players) {
    const myScore = this.calculatePlayerCurrentScore(this);
    const scores = players.map(p => this.calculatePlayerCurrentScore(p)).sort((a, b) => a - b);
    const myRank = scores.indexOf(myScore) + 1;
    return 1 - (myRank / players.length); // 1위면 1, 꼴찌면 0
  }

  /**
   * 상황 변화 대응
   */
  respondToSituationChange(situationChange, currentCard) {
    // 상황 변화에 따른 즉각적인 전략 조정
    return situationChange ? (currentCard <= 15 ? 2 : -1) : 0;
  }

  /**
   * 최근 패턴 분석
   */
  analyzeRecentPattern(players, turnCount) {
    // 최근 N턴의 패턴 분석 - 실제로는 턴 기록 저장 필요
    return {
      trend: 'stable', // 'aggressive', 'defensive', 'stable'
      volatility: 0.3,
      predictability: 0.6
    };
  }

  /**
   * 패턴 대응 전략
   */
  respondToPattern(pattern, currentCard) {
    let response = 0;
    
    switch (pattern.trend) {
      case 'aggressive':
        // 공격적 트렌드에는 방어적 대응
        response = currentCard > 20 ? -1 : 1;
        break;
      case 'defensive':
        // 방어적 트렌드에는 기회 포착
        response = currentCard <= 18 ? 2 : 0;
        break;
    }
    
    // 예측 가능성이 높으면 더 적극적으로 활용
    response *= pattern.predictability;
    
    return Math.round(response);
  }

  /**
   * 카드 그룹 분석
   */
  analyzeCardGroups(sortedCards) {
    const groups = [];
    let currentGroup = [];
    
    for (let i = 0; i < sortedCards.length; i++) {
      if (currentGroup.length === 0 || sortedCards[i] === currentGroup[currentGroup.length - 1] + 1) {
        currentGroup.push(sortedCards[i]);
      } else {
        if (currentGroup.length > 0) groups.push([...currentGroup]);
        currentGroup = [sortedCards[i]];
      }
    }
    
    if (currentGroup.length > 0) groups.push(currentGroup);
    return groups;
  }

  /**
   * 플레이어의 현재 점수 계산
   */
  calculatePlayerCurrentScore(player) {
    const sorted = player.cards.slice().sort((a, b) => a - b);
    let sum = 0;
    let prev = null;
    
    for (const card of sorted) {
      if (prev == null || card !== prev + 1) {
        sum += card;
      }
      prev = card;
    }
    
    return sum - player.tokens;
  }

  /**
   * 미래 가치 추정 (정확한 게임 정보 활용)
   */
  estimateFutureValue(players) {
    const remainingCards = this.estimateRemainingCards(players);
    
    // 제거된 카드 정보를 활용한 확률 계산
    if (this.gameInfo) {
      const totalOriginalCards = this.gameInfo.originalDeckSize; // 33장
      const removedCards = this.gameInfo.totalRemovedCards;
      const gameProgress = (totalOriginalCards - removedCards - remainingCards) / (totalOriginalCards - removedCards);
      
      // 게임 후반부일수록 현재 카드의 가치 상승
      if (gameProgress > 0.8) return 4; // 매우 후반
      if (gameProgress > 0.6) return 3; // 후반  
      if (gameProgress > 0.4) return 2; // 중반
      return 1; // 초반
    }

    // 기존 백업 계산
    return remainingCards < 8 ? 3 : remainingCards < 15 ? 2 : 1;
  }

  /**
   * 최적 토큰 비율 계산
   */
  calculateOptimalTokenRatio(players, gameSettings) {
    const gameProgress = this.estimateGameProgress(players);
    
    // 게임 진행도에 따른 최적 토큰 비율
    if (gameProgress < 0.3) return 0.8; // 초반에는 토큰 보존
    else if (gameProgress < 0.7) return 0.5; // 중반에는 적극 사용
    else return 0.3; // 후반에는 신중하게
  }

  /**
   * 게임 진행도 정확한 계산 (제거된 카드 정보 활용)
   */
  estimateGameProgress(players) {
    if (this.gameInfo) {
      const totalOriginalCards = this.gameInfo.originalDeckSize; // 33장
      const removedCards = this.gameInfo.totalRemovedCards;
      const remainingCards = this.gameInfo.deckSize;
      const actualPlayableCards = totalOriginalCards - removedCards;
      const cardsPlayed = actualPlayableCards - remainingCards;
      
      return Math.min(1, cardsPlayed / actualPlayableCards);
    }
    
    // 백업: 기존 추정 방식
    const totalCardsInPlay = players.reduce((sum, p) => sum + p.cards.length, 0);
    const maxPossibleCards = 33;
    return Math.min(1, totalCardsInPlay / maxPossibleCards);
  }

  /**
   * 남은 카드 수 정확한 계산 (게임 정보 활용)
   */
  estimateRemainingCards(players) {
    if (this.gameInfo) {
      // 정확한 덱 사이즈 정보 사용
      return this.gameInfo.deckSize;
    }
    
    // 백업: 기존 추정 방식
    const totalCardsInPlay = players.reduce((sum, p) => sum + p.cards.length, 0);
    return Math.max(0, 33 - totalCardsInPlay);
  }
}

module.exports = Bot;