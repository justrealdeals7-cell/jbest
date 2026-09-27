import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.youthparty.cbm',
  appName: 'Youth Party CBM',
  webDir: 'public',
  server: {
    url: 'https://jbest-sigma.vercel.app',
    cleartext: false,
  },
};

export default config;
