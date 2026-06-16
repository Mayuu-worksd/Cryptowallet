import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface AedSymbolProps {
  color?: string;
  width?: number;
  height?: number;
  style?: any;
}

export default function AedSymbol({ color = 'currentColor', width = 16, height = 16, style }: AedSymbolProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      {/* The D shape */}
      <Path d="M6 4h6a6 6 0 0 1 6 6v4a6 6 0 0 1-6 6H6z" />
      {/* The two horizontal strokes */}
      <Path d="M2 10h20" />
      <Path d="M2 14h20" />
    </Svg>
  );
}
