import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'ey1ylwzy',
    dataset: 'production'
  },
  deployment: {
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    autoUpdates: true,
    // Pins deploys to the existing damirbuilds.sanity.studio hostname so
    // `npm run deploy` stops prompting to pick/create a hostname each time.
    appId: 'qky0newzst7c5qss7k0fb3ts',
  },
})
