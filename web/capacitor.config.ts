import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourteam.lostmate',
  appName: 'LostMate AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#0B0B1E',
      launchShowDuration: 1500,
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
      splashImmersive: true
    },
    StatusBar: {
      backgroundColor: '#0B0B1E',
      style: 'DARK'
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true
    }
  }
};

export default config;
