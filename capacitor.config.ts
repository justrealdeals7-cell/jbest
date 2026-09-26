import { CapacitorConfig } from '@capacitor/cli';

// Fill in appId/appName, then point server.url at your live Vercel deployment
// once it's up. See CAPACITOR_SETUP.md for the full build steps.
const config: CapacitorConfig = {
  appId: 'org.youthparty.cbm',
  appName: 'Youth Party CBM',
  webDir: 'public',
  server: {
    url: 'https://REPLACE-WITH-YOUR-VERCEL-URL.vercel.app',
    cleartext: false,
  },
};

export default config;
