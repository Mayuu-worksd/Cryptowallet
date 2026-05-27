import './utils/getRandomValuesShim';
import { Buffer } from 'buffer';
import { registerRootComponent } from 'expo';

global.Buffer = global.Buffer || Buffer;

import React from 'react';
import { View, Text } from 'react-native';

function SafeApp() {
  const [error, setError] = React.useState<string | null>(null);
  const [AppComponent, setAppComponent] = React.useState<React.ComponentType | null>(null);

  React.useEffect(() => {
    try {
      const App = require('./App').default;
      setAppComponent(() => App);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#101114', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#FF3B3B', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Boot Error</Text>
        <Text style={{ color: '#FFF', fontSize: 13, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  if (!AppComponent) {
    return (
      <View style={{ flex: 1, backgroundColor: '#101114', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#FFF', fontSize: 16 }}>Loading...</Text>
      </View>
    );
  }

  return <AppComponent />;
}

registerRootComponent(SafeApp);
