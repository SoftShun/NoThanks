const crypto = require('crypto');

/**
 * crypto 모듈을 사용한 고품질 랜덤 함수
 * Math.random() 대신 사용할 수 있는 더 강력한 랜덤성 제공
 */
class CryptoRandom {
  /**
   * 0 이상 1 미만의 랜덤 float 반환 (Math.random() 대체)
   */
  static random() {
    const bytes = crypto.randomBytes(4);
    const value = bytes.readUInt32BE(0);
    return value / 0x100000000; // 2^32로 나누어 0-1 범위로 변환
  }

  /**
   * min 이상 max 미만의 랜덤 정수 반환
   */
  static randomInt(min, max) {
    return Math.floor(this.random() * (max - min)) + min;
  }

  /**
   * 배열을 crypto 기반 랜덤으로 셔플 (피셔-예이츠 알고리즘)
   */
  static shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * 시간 기반 추가 엔트로피와 함께 강화된 랜덤 함수
   */
  static enhancedRandom() {
    const timeBytes = Buffer.alloc(8);
    const hrtime = process.hrtime.bigint();
    const timeValue = BigInt(Date.now() * 1000) + hrtime;
    timeBytes.writeBigUInt64BE(timeValue);
    
    const cryptoBytes = crypto.randomBytes(4);
    const combined = Buffer.concat([timeBytes, cryptoBytes]);
    
    // SHA-256으로 해시한 후 첫 4바이트 사용
    const hash = crypto.createHash('sha256').update(combined).digest();
    const value = hash.readUInt32BE(0);
    return value / 0x100000000;
  }
}

module.exports = CryptoRandom;