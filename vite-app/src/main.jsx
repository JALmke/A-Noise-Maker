// App entry point. Picks the right UI for the device:
//   • Computers (fine pointer, wide screens) → the full desktop App.
//   • Phones & touch devices → Concept A "Split Studio" (MobileApp), which
//     carries the adaptive control tray, share-to-Photos export, and the
//     mobile video fix.
// The choice is live: rotating or resizing re-evaluates and swaps UIs.
import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import App from './App.jsx';
import MobileApp from './MobileApp.jsx';
import './styles.css';
import './halftone-mobile.css';

// Touch-primary devices (phones, tablets) OR any narrow viewport get the
// mobile UI. Desktops keep the desktop UI until the window is quite narrow.
const MOBILE_QUERY = '(max-width: 768px), (pointer: coarse)';

function Root() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile ? <MobileApp layout="a" /> : <App />;
}

createRoot(document.getElementById('root')).render(<Root />);
