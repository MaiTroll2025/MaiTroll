import { defineConfig } from '@capawesome/cli/config'

export default defineConfig({
  app: {
    name: 'Maitroll',
    identifier: 'com.maitroll.app',
    type: 'capacitor',
  },
  ios: {
    teamId: process.env.CAPAWESOME_IOS_TEAM_ID ?? '',
    appStoreConnectApiKey: {
      keyId: process.env.CAPAWESOME_IOS_APP_STORE_CONNECT_API_KEY_ID ?? '',
      issuerId: process.env.CAPAWESOME_IOS_APP_STORE_CONNECT_API_KEY_ISSUER_ID ?? '',
      privateKey: process.env.CAPAWESOME_IOS_APP_STORE_CONNECT_API_KEY_PRIVATE_KEY ?? '',
    },
  },
})
