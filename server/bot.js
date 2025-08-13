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
    
    // 기본적으로 현재 카드의 가치를 평가
    const cardValue = this.evaluateCardValue(currentCard, gameSettings, players);
    const tokenCost = this.evaluateTokenCost(pileTokens);
    
    // 난이도별 의사결정
    switch (this.difficulty) {
      case 'medium':
        return this.mediumDecision(cardValue, tokenCost, gameSettings, players);
      case 'hard':
        return this.hardDecision(cardValue, tokenCost, gameSettings, players, currentCard);
      case 'expert':
        return this.expertDecision(cardValue, tokenCost, gameSettings, players, currentCard);
      default:
        return this.mediumDecision(cardValue, tokenCost, gameSettings, players);
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
   * 중급 봇의 의사결정 (일반 유저 수준)
   */
  mediumDecision(cardValue, tokenCost, gameSettings, players) {
    // 토큰이 없으면 무조건 가져감
    if (this.tokens === 0) return 'take';

    const totalValue = cardValue + tokenCost;
    const randomFactor = (Math.random() - 0.5) * 6; // ±3 높은 랜덤성

    // 단순한 토큰 관리
    const tokenPenalty = this.tokens <= 2 ? -3 : 0;
    
    // 기본적인 카드 가치만 고려
    return (totalValue + randomFactor + tokenPenalty) > -1 ? 'take' : 'pass';
  }

  /**
   * 상급 봇의 의사결정 (잘하는 유저 수준)
   */
  hardDecision(cardValue, tokenCost, gameSettings, players, currentCard) {
    if (this.tokens === 0) return 'take';

    let totalValue = cardValue + tokenCost;
    const randomFactor = (Math.random() - 0.5) * 2; // ±1 랜덤성

    // 카드 기반 공격/방어 전략 (항상 가능)
    const cardInterference = this.evaluateCardInterference(players, currentCard);
    const defensiveValue = this.evaluateDefensiveStrategy(players, currentCard);
    totalValue += cardInterference + defensiveValue;

    // 토큰 기반 방해 전략 (공개 모드에서만)
    if (gameSettings.showOpponentTokens) {
      const tokenPressure = this.evaluateTokenPressure(players);
      const psychologicalFactor = this.evaluatePsychologicalWarfare(players, gameSettings, currentCard);
      totalValue += tokenPressure + psychologicalFactor;
    }

    // 게임 후반부에서 더 공격적
    const remainingCards = this.estimateRemainingCards(players);
    const lateGameBonus = remainingCards < 10 ? 2 : 0;

    // 개선된 토큰 관리
    const tokenRatio = this.tokens / gameSettings.initialTokens;
    const tokenStrategy = tokenRatio < 0.2 ? -4 : tokenRatio > 0.8 ? 2 : 0;

    return (totalValue + randomFactor + lateGameBonus + tokenStrategy) > 0 ? 'take' : 'pass';
  }

  /**
   * 최상급 봇의 의사결정 (전문가 수준 - 매우 어려움)
   */
  expertDecision(cardValue, tokenCost, gameSettings, players, currentCard) {
    if (this.tokens === 0) return 'take';

    let totalValue = cardValue + tokenCost;
    const randomFactor = (Math.random() - 0.5) * 0.8; // ±0.4 낮은 랜덤성

    // 고급 카드 전략
    const advancedCardStrategy = this.evaluateAdvancedCardStrategy(players, currentCard);
    const opponentBlockingValue = this.evaluateOpponentBlocking(players, currentCard);
    const masterDefensiveStrategy = this.evaluateMasterDefensiveStrategy(players, currentCard);
    totalValue += advancedCardStrategy + opponentBlockingValue + masterDefensiveStrategy;

    // 토큰 기반 고급 전략 (공개 모드에서만)
    if (gameSettings.showOpponentTokens) {
      const advancedTokenStrategy = this.evaluateAdvancedTokenStrategy(players, gameSettings);
      const masterPsychology = this.evaluateMasterPsychology(players, gameSettings, currentCard);
      totalValue += advancedTokenStrategy + masterPsychology;
    }

    // 확률적 미래 가치 계산
    const probabilisticValue = this.estimateFutureValue(players);
    const gamePhaseStrategy = this.evaluateGamePhaseStrategy(players, gameSettings, currentCard);
    const adaptiveStrategy = this.evaluateAdaptiveStrategy(players, currentCard);
    totalValue += probabilisticValue + gamePhaseStrategy + adaptiveStrategy;

    // 최적화된 토큰 관리
    const tokenOptimalRatio = this.calculateOptimalTokenRatio(players, gameSettings);
    const currentRatio = this.tokens / gameSettings.initialTokens;
    const tokenAdjustment = (tokenOptimalRatio - currentRatio) * 4;

    return (totalValue + randomFactor + tokenAdjustment) > 1.5 ? 'take' : 'pass';
  }

  /**
   * 카드 기반 방해 전략 평가 (항상 사용 가능)
   */
  evaluateCardInterference(players, currentCard) {
    if (!currentCard) return 0;
    
    let interference = 0;
    
    for (const player of players) {
      if (player.id === this.id || player.isBot) continue;
      
      // 상대방의 카드와 연속성 확인
      for (const card of player.cards) {
        if (Math.abs(currentCard - card) === 1) {
          interference += 2; // 상대방이 연속카드를 원할 것
        }
      }
    }
    
    return Math.min(interference, 5); // 최대 5점까지
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
   * 적응적 전략 (최상급용)
   */
  evaluateAdaptiveStrategy(players, currentCard) {
    if (!currentCard) return 0;
    
    let adaptive = 0;
    
    // 상대방들의 플레이 패턴 분석
    const humanPlayers = players.filter(p => !p.isBot && p.id !== this.id);
    
    for (const player of humanPlayers) {
      const avgCardValue = player.cards.length > 0 ? 
        player.cards.reduce((sum, card) => sum + card, 0) / player.cards.length : 20;
      
      // 상대방이 낮은 카드를 선호하는 패턴
      if (avgCardValue < 18) {
        if (currentCard <= 15) adaptive += 2; // 경쟁 예상
      }
      
      // 상대방이 높은 카드를 많이 가진 경우
      if (avgCardValue > 25) {
        if (currentCard <= 12) adaptive += 3; // 낮은 카드의 가치 상승
      }
    }
    
    return Math.min(adaptive, 4);
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