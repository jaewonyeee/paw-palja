import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pawpalja.app',
  appName: 'Paw-Palja',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // For local dev, uncomment and set your machine's IP:
    // url: 'http://192.168.1.100:3000',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      showSpinner: false,
      backgroundColor: '#FF6B6B',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#FF6B6B',
    },
  },
};

export default config;
