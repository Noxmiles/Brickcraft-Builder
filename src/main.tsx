import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/**
 * Entry point for the React application.
 * Initializes the root React tree and attaches it to the DOM.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The main application shell container */}
    <App />
  </StrictMode>,
);
