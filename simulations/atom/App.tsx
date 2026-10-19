import React, { useState, useEffect, useCallback } from 'react';
import Atom from './components/Atom';
import InfoPanel from './components/InfoPanel';
import Controls from './components/Controls';
import PeriodicTableMap from './components/PeriodicTableMap';
import { ELEMENTS } from './constants';

const App: React.FC = () => {
  // Default to Carbon (6)
  const [z, setZ] = useState<number>(6);
  const [showSpin, setShowSpin] = useState<boolean>(false);

  // Z is 1-based, array is 0-based
  const currentElement = ELEMENTS[z - 1] || ELEMENTS[0];

  const handleSelectZ = useCallback((newZ: number) => {
    setZ(Math.max(1, Math.min(118, newZ)));
  }, []);

  // Keyboard navigation: ArrowLeft/ArrowRight to switch elements
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setZ(prev => Math.max(1, prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setZ(prev => Math.min(118, prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-[100dvh] bg-slate-900 text-white flex flex-col overflow-hidden">
      
      {/* Header: Fixed at the top */}
      <header className="flex-none h-14 border-b border-slate-800 flex items-center justify-between px-4 lg:px-6 bg-slate-900/95 backdrop-blur z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-300">
              Atomic<span className="font-light text-slate-100">Orbit</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700">
            {currentElement.chineseName} {currentElement.symbol} (Z = {currentElement.z})
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-y-auto sm:overflow-hidden relative scroll-smooth group">
        
        {/* Visualization Canvas */}
        <div className="
          sticky top-0 h-[45vh] min-h-[320px] w-full z-20 shrink-0
          border-b border-slate-800 bg-slate-900 
          sm:static sm:h-full sm:flex-1 sm:border-b-0 sm:border-r sm:order-1
          relative flex items-center justify-center overflow-hidden
        ">
          {/* Background Decorations */}
          <div 
            className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
            style={{ 
              backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 0%, #0f172a 70%)',
            }}
          />
          <div 
            className="absolute inset-0 z-0 opacity-5 pointer-events-none" 
            style={{ 
              backgroundImage: 'linear-gradient(#475569 1px, transparent 1px), linear-gradient(90deg, #475569 1px, transparent 1px)', 
              backgroundSize: '40px 40px' 
            }}
          />
          
          {/* Interactive Periodic Table Map */}
          <PeriodicTableMap z={z} onSelectZ={handleSelectZ} />
          
          {/* Atom Component */}
          <div className="z-10 w-full h-full backdrop-blur-[2px] flex flex-col items-center justify-center p-2 sm:p-4">
            <Atom element={currentElement} showSpin={showSpin} />
          </div>
        </div>

        {/* Sidebar Info Panel */}
        <div className="
          w-full shrink-0 relative z-10 bg-slate-900
          sm:w-80 lg:w-96 sm:h-full sm:overflow-y-auto sm:order-2 sm:border-l sm:border-slate-800
        ">
          <InfoPanel element={currentElement} />
        </div>

      </main>

      {/* Footer Controls */}
      <footer className="flex-none bg-slate-800 border-t border-slate-700 z-40 relative shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.3)]">
        <Controls 
          z={z} 
          setZ={handleSelectZ} 
          showSpin={showSpin}
          setShowSpin={setShowSpin}
        />
      </footer>
    </div>
  );
};

export default App;