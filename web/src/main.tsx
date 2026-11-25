import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@fontsource/dm-serif-display/latin-400.css';
import './ui/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';

performance.mark('app-start');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
