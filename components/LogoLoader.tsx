import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image } from 'react-native';
import { Theme, Fonts } from '../constants';

interface LogoLoaderProps {
  visible?: boolean;
  message?: string;
}

export default function LogoLoader({ visible = true, message = 'LOADING' }: LogoLoaderProps) {
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const bounceValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Spinning ring animation
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Pulsing effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.15,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Bouncing dots effect (using a single animated value for stagger logic)
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceValue, {
            toValue: 1,
            duration: 600,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(bounceValue, {
            toValue: 0,
            duration: 600,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      spinValue.setValue(0);
      pulseValue.setValue(1);
      bounceValue.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.loaderContainer}>
        {/* Outer glowing spinning ring */}
        <Animated.View 
          style={[
            styles.ring, 
            { transform: [{ rotate: spin }] }
          ]} 
        />
        
        {/* Inner pulsing logo container */}
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseValue }] }]}>
          <Image 
            source={require('../assets/logo.png')} 
            style={styles.logo} 
            resizeMode="contain" 
          />
        </Animated.View>
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.text}>{message}</Text>
        <View style={styles.dotsContainer}>
          {[0, 1, 2].map((i) => {
             const translateY = bounceValue.interpolate({
               inputRange: [0, 0.5, 1],
               outputRange: [0, i === 1 ? -6 : -3, 0] // Quick stagger simulation
             });
             return (
               <Animated.View 
                 key={i} 
                 style={[
                   styles.dot, 
                   { 
                     transform: [{ translateY }],
                     opacity: bounceValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1]
                     })
                   }
                 ]} 
               />
             );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
  },
  loaderContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: Theme.colors.primary,
    borderRightColor: Theme.colors.primary,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  logo: {
    width: 45,
    height: 45,
  },
  textContainer: {
    marginTop: 60,
    alignItems: 'center',
  },
  text: {
    color: Theme.colors.primary,
    fontSize: 16,
    fontFamily: Fonts.bold,
    letterSpacing: 4,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.colors.primary,
  }
});
