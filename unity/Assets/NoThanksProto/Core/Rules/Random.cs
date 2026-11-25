using System;

namespace NoThanks.Core
{
    /// <summary>
    /// 난수 소스. master 는 crypto.randomBytes 기반 CryptoRandom.enhancedRandom() (0 이상 1 미만 균등 분포)을 사용.
    /// 프로토타입은 분포가 같은 System.Random 을 기본으로 쓰고, 테스트에서는 시드를 고정한다.
    /// </summary>
    public interface IRandom
    {
        /// <summary>0 이상 1 미만의 균등 난수.</summary>
        double NextDouble();
    }

    public sealed class SystemRandom : IRandom
    {
        private readonly Random _r;

        public SystemRandom()
        {
            _r = new Random(Guid.NewGuid().GetHashCode());
        }

        public SystemRandom(int seed)
        {
            _r = new Random(seed);
        }

        public double NextDouble()
        {
            return _r.NextDouble();
        }
    }

    /// <summary>테스트용: 미리 정한 값을 순서대로 반환(끝나면 반복).</summary>
    public sealed class SequenceRandom : IRandom
    {
        private readonly double[] _values;
        private int _i;

        public SequenceRandom(params double[] values)
        {
            _values = values == null || values.Length == 0 ? new[] { 0.5 } : values;
        }

        public double NextDouble()
        {
            var v = _values[_i % _values.Length];
            _i++;
            return v;
        }
    }
}
