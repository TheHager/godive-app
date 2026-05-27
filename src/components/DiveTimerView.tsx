import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DiveStateMachine } from '../lib/DiveStateMachine';
import { DiveState } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';

// --- Custom Long Press Hook for Stress-Resistant UI ---
function useLongPress(onLongPress: () => void, ms = 2000) {
  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const start = useCallback(() => {
    setIsPressing(true);
    setProgress(0);
    const startTime = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min(100, (elapsed / ms) * 100));
    }, 50);

    timerRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsPressing(false);
      setProgress(100);
      onLongPress();
      // Reset after a brief delay
      setTimeout(() => setProgress(0), 500);
    }, ms);
  }, [onLongPress, ms]);

  const stop = useCallback(() => {
    setIsPressing(false);
    setProgress(0);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  return {
    handlers: {
      onMouseDown: start,
      onMouseUp: stop,
      onMouseLeave: stop,
      onTouchStart: start,
      onTouchEnd: stop,
      onTouchCancel: stop,
    },
    isPressing,
    progress,
  };
}

export function DiveTimerView() {
  const { user } = useAuth();
  const stateMachine = DiveStateMachine.getInstance();
  
  const [currentState, setCurrentState] = useState<DiveState>(stateMachine.getState());
  const [plannedMinutes, setPlannedMinutes] = useState(120);
  const [remainingTimeStr, setRemainingTimeStr] = useState('00:00:00');
  
  useEffect(() => {
    const handleStateChange = (newState: DiveState) => {
      setCurrentState(newState);
    };
    
    stateMachine.addListener(handleStateChange);
    return () => stateMachine.removeListener(handleStateChange);
  }, [stateMachine]);

  // Fallback visual countdown for the UI
  // Note: The actual source of truth is expectedEndTimeMs inside the state machine.
  // For the UI, we just need a visual representation.
  useEffect(() => {
    if (currentState === DiveState.INACTIVE) {
      setRemainingTimeStr(`${String(Math.floor(plannedMinutes / 60)).padStart(2, '0')}:${String(plannedMinutes % 60).padStart(2, '0')}:00`);
      return;
    }

    // A hacky way to access expectedEndTimeMs since it's private.
    // In a full prod version we'd expose a getter. For now we use standard JS Date manipulation.
    // Assuming expectedEndTimeMs is approximately Date.now() + something...
    // To make this fully exact we'd add `getExpectedEndTimeMs()` to the state machine.
    const interval = setInterval(() => {
       const sm = stateMachine as any;
       let targetTime = null;
       
       if (currentState === DiveState.DIVING) {
         targetTime = sm.expectedEndTimeMs;
       } else if (currentState === DiveState.WARNING_LEVEL_1 || currentState === DiveState.WARNING_LEVEL_2) {
         targetTime = sm.phaseEndTimeMs;
       }

       if (targetTime) {
         const remaining = Math.max(0, targetTime - Date.now());
         const hrs = Math.floor(remaining / 3600000);
         const mins = Math.floor((remaining % 3600000) / 60000);
         const secs = Math.floor((remaining % 60000) / 1000);
         setRemainingTimeStr(`${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
       } else {
         setRemainingTimeStr('00:00:00');
       }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [currentState, plannedMinutes, stateMachine]);

  const handleStartDive = async () => {
    if (!user) return alert("Must be logged in");
    try {
      await stateMachine.registerDive({
        durationMinutes: plannedMinutes,
        bufferMinutes: 15,
        lat: 0, // Should use real Geolocation
        lng: 0,
        privateInfo: {
          emergencyContactName: "Ice Contact",
          emergencyContactPhone: "+1234567890",
        }
      });
    } catch (e: any) {
      alert("Failed to start dive: " + e.message);
    }
  };

  // Stress-resistant actions
  const endDiveControls = useLongPress(() => stateMachine.endDive(), 2500);
  const extendDiveControls = useLongPress(() => stateMachine.extendDive(5), 2000);
  const cancelDistressControls = useLongPress(() => stateMachine.endDive(), 3000);

  // Colors based on state
  const bgColors = {
    [DiveState.INACTIVE]: 'bg-background text-[#0b2240]',
    [DiveState.DIVING]: 'bg-[#0f2027] text-white',
    [DiveState.WARNING_LEVEL_1]: 'bg-orange-600 animate-pulse text-white',
    [DiveState.WARNING_LEVEL_2]: 'bg-red-600 animate-pulse text-white',
    [DiveState.ALARM_TRIGGERED]: 'bg-red-900 text-white',
  };

  return (
    <div className={`flex flex-col h-full w-full px-6 pt-3 pb-4 transition-colors duration-500 ${bgColors[currentState]}`}>
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-wider">DEAD MAN'S SWITCH</h2>
        <div className={`text-xs md:text-sm font-mono px-3 py-1 rounded-full border ${currentState === DiveState.INACTIVE ? 'premium-glass text-[#475569] ' : 'bg-black/30 text-white '}`}>
          {currentState.replace(/_/g, ' ')}
        </div>
      </div>

      {currentState === DiveState.INACTIVE && (
        <div className="flex-1 flex flex-col justify-between pt-3 pb-0 overflow-y-auto no-scrollbar">
          
          {/* Top Section: Duration Selector */}
          <div className="flex flex-col items-center justify-center">
            <p className="text-[#475569] mb-2 font-medium uppercase tracking-wider text-sm">Planned Dive Duration</p>
            <div className="flex items-center justify-center gap-6 text-5xl font-mono font-light">
              <style>{`input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }`}</style>
              <button 
                onClick={() => setPlannedMinutes(Math.max(1, plannedMinutes - 5))}
                className="w-14 h-14 rounded-full premium-glass active:premium-glass flex items-center justify-center text-[#0b2240] border  transition-transform active:scale-95 shadow-sm text-2xl"
              >-</button>
              <input className="premium-input premium-input" type="number" value={plannedMinutes} onChange={(e) => setPlannedMinutes(parseInt(e.target.value) || 0)}
                onBlur={(e) => setPlannedMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-32 text-center bg-transparent -b-2 -[#0055ff] focus: focus:-secondary font-mono font-bold text-6xl p-2 text-[#0b2240]"
              />
              <button 
                onClick={() => setPlannedMinutes(plannedMinutes + 5)}
                className="w-14 h-14 rounded-full premium-glass active:premium-glass flex items-center justify-center text-[#0b2240] border  transition-transform active:scale-95 shadow-sm text-2xl"
              >+</button>
            </div>
          </div>
            
          {/* Middle Section: Safety Net Info Card */}
          <div className="w-full max-w-md mx-auto premium-glass p-5 md:p-6 rounded-[2rem] border  shadow-lg text-[#0b2240] flex flex-col gap-4 my-3">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-full bg-[#0055ff]/10 flex items-center justify-center shadow-inner border border-[#0055ff]/20">
                <span className="material-symbols-outlined text-[24px] text-[#0055ff]">security</span>
              </div>
              <p className="font-extrabold text-base md:text-lg leading-snug">
                How the safety net works if you go over time:
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center gap-2 py-4 px-4 rounded-2xl premium-glass-low border  shadow-sm transition-all hover:premium-glass hover:scale-[1.01]">
                <span className="inline-block px-4 py-1.5 rounded-full bg-[#0055ff]/10 text-[#0055ff] font-black text-xs uppercase tracking-widest border border-[#0055ff]/20">
                  0–10 min
                </span>
                <span className="text-sm font-medium leading-relaxed text-[#475569]">
                  Loud alerts sound on your phone to get your attention.
                </span>
              </div>
              
              {/* Step 2 */}
              <div className="flex flex-col items-center text-center gap-2 py-4 px-4 rounded-2xl premium-glass-low border  shadow-sm transition-all hover:premium-glass hover:scale-[1.01]">
                <span className="inline-block px-4 py-1.5 rounded-full bg-orange-500/10 text-orange-400 font-black text-xs uppercase tracking-widest border border-orange-500/20">
                  After 10 min
                </span>
                <span className="text-sm font-medium leading-relaxed text-[#475569]">
                  An automatic distress signal is sent to nearby divers.
                </span>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center gap-2 py-4 px-4 rounded-2xl premium-glass-low border  shadow-sm transition-all hover:premium-glass hover:scale-[1.01]">
                <span className="inline-block px-4 py-1.5 rounded-full bg-red-500/10 text-red-400 font-black text-xs uppercase tracking-widest border border-red-500/20">
                  After 15 min
                </span>
                <span className="text-sm font-medium leading-relaxed text-[#475569]">
                  An emergency text with your location is sent to your contacts.
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Section: Start Button */}
          <button 
            onClick={handleStartDive}
            className="w-full py-5 rounded-2xl font-black tracking-widest text-lg bg-[#0055ff] text-on-primary shadow-[0_0_20px_rgba(76,214,251,0.4)] hover:shadow-[0_0_25px_rgba(76,214,251,0.6)] active:scale-95 transition-all flex-shrink-0"
          >
            START DIVE
          </button>
        </div>
      )}

      {currentState !== DiveState.INACTIVE && (
        <div className="flex-1 flex flex-col justify-between items-center py-8">
          
          <div className="text-center">
            <p className="text-xl text-white/70 mb-2 tracking-widest uppercase">
              {currentState === DiveState.DIVING ? 'Time Remaining' : 'OVERDUE'}
            </p>
            <div className="text-7xl font-mono font-bold tabular-nums drop-shadow-lg">
              {remainingTimeStr}
            </div>
          </div>

          {(currentState === DiveState.WARNING_LEVEL_1) && (
            <div className="text-center bg-orange-900/40 p-4 rounded-xl border border-orange-500/20 mb-8 ">
              <p className="font-bold text-xl mb-2 text-orange-400">LOCAL WARNING</p>
              <p className="text-sm text-white/80">Your dive is overdue. Please extend or end your dive.<br/><span className="font-bold text-orange-200">Distress signal is NOT active yet.</span></p>
            </div>
          )}

          {(currentState === DiveState.WARNING_LEVEL_2) && (
            <div className="text-center bg-red-900/40 p-4 rounded-xl border border-red-500/20 mb-8 ">
              <p className="font-bold text-xl mb-2 text-red-400">CRITICAL ALERT</p>
              <p className="text-sm text-white/80">Final local warning before distress broadcast.</p>
            </div>
          )}

          {(currentState === DiveState.ALARM_TRIGGERED) && (
            <div className="text-center bg-black/40 p-4 rounded-xl border border-red-500 mb-8  animate-pulse">
              <p className="font-bold text-xl mb-2 text-red-500">DISTRESS BROADCASTING</p>
              <p className="text-sm text-white/80">Local BLE mesh network and cloud alerts are fully active.</p>
            </div>
          )}

          <div className="w-full flex flex-col gap-6">
            {currentState === DiveState.DIVING && (
              <LongPressButton 
                label="HOLD TO EXTEND 5 MIN" 
                controls={extendDiveControls} 
                progress={extendDiveControls.progress}
                colorClass="bg-blue-600"
              />
            )}
            
            <LongPressButton 
              label={currentState === DiveState.DIVING ? "HOLD TO END DIVE" : "HOLD TO CANCEL DISTRESS"}
              controls={currentState === DiveState.DIVING ? endDiveControls : cancelDistressControls}
              progress={currentState === DiveState.DIVING ? endDiveControls.progress : cancelDistressControls.progress}
              colorClass={currentState === DiveState.DIVING ? "premium-glass/20" : "bg-red-500"}
              borderClass={currentState === DiveState.DIVING ? "" : "border-red-400"}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface LongPressButtonProps {
  label: string;
  controls: { handlers: any; isPressing: boolean; progress: number };
  progress: number;
  colorClass?: string;
  borderClass?: string;
}

function LongPressButton({ label, controls, progress, colorClass = "premium-glass/20", borderClass = "border-transparent" }: LongPressButtonProps) {
  return (
    <button
      onMouseDown={controls.handlers.onMouseDown}
      onMouseUp={controls.handlers.onMouseUp}
      onMouseLeave={controls.handlers.onMouseLeave}
      onTouchStart={controls.handlers.onTouchStart}
      onTouchEnd={controls.handlers.onTouchEnd}
      onTouchCancel={controls.handlers.onTouchCancel}
      className={`relative w-full py-5 rounded-2xl font-bold tracking-widest text-lg overflow-hidden transition-transform border-2 ${borderClass} ${controls.isPressing ? 'scale-[0.98]' : ''}`}
      style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
    >
      {/* Background track */}
      <div className={`absolute inset-0 ${colorClass} opacity-30 pointer-events-none`} />
      
      {/* Fill progress */}
      <div 
        className={`absolute left-0 top-0 bottom-0 ${colorClass} transition-all duration-75 pointer-events-none`} 
        style={{ width: `${progress}%` }}
      />
      
      {/* Text */}
      <span className="relative z-10 drop-shadow-md pointer-events-none">{label}</span>
    </button>
  );
}
