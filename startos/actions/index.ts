import { sdk } from '../sdk'
import { primaryUrl } from '../utils'
import { configureAi } from './configureAi'
import { setAdminPassword } from './setAdminPassword'
import { setPerformance } from './setPerformance'
import { toggleSignups } from './toggleSignups'

export const actions = sdk.Actions.of()
  .addAction(setAdminPassword)
  .addAction(toggleSignups)
  .addAction(primaryUrl.action)
  .addAction(configureAi)
  .addAction(setPerformance)
