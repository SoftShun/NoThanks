import React, { useState } from 'react';

interface JoinPageProps {
  onJoin: (nickname: string) => void;
}

/**
 * JoinPage displays a simple form for entering a nickname. Once
 * submitted, it calls onJoin to transition into the game. No
 * validation beyond checking for non‑empty input is performed.
 */
const JoinPage: React.FC<JoinPageProps> = ({ onJoin }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      onJoin(trimmed);
    }
  };

  return (
    <div className="container">
      <div className="panel">
        <div className="header">
          <div className="title" aria-level={1} role="heading">No Thanks! 온라인</div>
        </div>
        <form onSubmit={handleSubmit} className="row" aria-label="닉네임 입력">
          <label className="sr-only" htmlFor="nickname">닉네임</label>
          <input
            id="nickname"
            type="text"
            placeholder="닉네임을 입력하세요"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            aria-required
            className="input"
          />
          <button type="submit" className="btn primary" aria-label="입장">입장</button>
        </form>
        <div className="meta" style={{ marginTop: 8 }}>
          <span>닉네임만으로 빠르게 시작하세요.</span>
        </div>
      </div>
    </div>
  );
};

export default JoinPage;