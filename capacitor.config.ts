import type { CapacitorConfig } from '@capacitor/cli';

// Set CAPACITOR_DEV=true when running locally: npx cap run android
const isDev = process.env.CAPACITOR_DEV === 'true';

const config: CapacitorConfig = {
  appId: 'com.laptoprent.app',
  appName: 'LaptopRent',
  webDir: 'out',
  server: {
    // In dev: load from local Next.js dev server (run `npm run dev` first)
    // In prod: load from live Vercel deployment
    url: isDev
      ? 'http://10.0.2.2:3000'   // Android emulator → host machine localhost
      : 'https://laptop-rental-frontend-wueg.vercel.app/',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0B1628',
  },
};

export default config;
