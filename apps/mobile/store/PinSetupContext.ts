import React from 'react';

// Shared context so any screen can trigger PIN setup
// regardless of whether it was opened via tab or stack navigator
export const PinSetupContext = React.createContext<() => void>(() => {});
export const usePinSetup = () => React.useContext(PinSetupContext);
