import { utils } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'
import { sdk } from '../sdk'

export const seedFiles = sdk.setupOnInit(async (effects, kind) => {
  if (kind !== 'install') return

  await storeJson.merge(effects, {
    nextAuthSecret: utils.getDefaultString({ charset: 'a-z,A-Z,0-9', len: 32 }),
    meiliMasterKey: utils.getDefaultString({ charset: 'a-z,A-Z,0-9', len: 32 }),
    signupsDisabled: true,
  })
})
