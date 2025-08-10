import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container">
          <div className="panel">
            <div className="title" style={{ marginBottom: 8 }}>문제가 발생했어요</div>
            <div className="meta">페이지를 새로고침하면 해결될 수 있습니다.</div>
            <div className="controls" style={{ marginTop: 8 }}>
              <button className="btn primary" onClick={() => window.location.reload()}>새로고침</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


