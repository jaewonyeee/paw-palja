import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.burti.app',
  appName: 'Burti',
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
      backgroundColor: '#6C5CE7',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#6C5CE7',
    },
  },
};

export default config;
