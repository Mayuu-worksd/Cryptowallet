import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface AedSymbolProps {
  color?: string;
  size?: number;
  style?: any;
}

export default function AedSymbol({ color = '#000', size = 20, style }: AedSymbolProps) {
  return (
    <Svg width={size * 0.75} height={size * 1.1} viewBox="0 0 100 120" style={style}>
      {/* 
        This path manually draws the proposed "Emirati dirham sign" (a serif D with two horizontal strokes).
        We use raw paths so it's guaranteed to look identical across all Android/iOS devices without font reliance.
      */}
      <Path
        d="
          M 25 10 
          L 45 10 
          C 75 10 95 30 95 55 
          C 95 80 75 100 45 100 
          L 25 100 
          Z 
          
          M 40 25 
          L 40 85 
          C 60 85 75 70 75 55 
          C 75 40 60 25 40 25 
          Z
        "
        fill={color}
        fillRule="evenodd"
      />
      
      {/* Top Left Serif */}
      <Path d="M 15 10 L 40 10 L 40 25 L 15 25 Z" fill={color} />
      {/* Bottom Left Serif */}
      <Path d="M 15 85 L 40 85 L 40 100 L 15 100 Z" fill={color} />

      {/* Top Horizontal Stroke */}
      <Path d="M 5 45 C 5 40 10 40 15 40 L 95 40 C 100 40 100 45 95 45 C 95 50 100 50 95 50 L 15 50 C 10 50 5 50 5 45 Z" fill={color} />
      
      {/* Bottom Horizontal Stroke */}
      <Path d="M 5 65 C 5 60 10 60 15 60 L 95 60 C 100 60 100 65 95 65 C 95 70 100 70 95 70 L 15 70 C 10 70 5 70 5 65 Z" fill={color} />
    </Svg>
  );
}
