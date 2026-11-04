import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

export const toggleSignups = sdk.Action.withoutInput(
  // id
  'toggle-signups',

  // metadata
  async ({ effects }) => {
    const disabled = await storeJson
      .read((s) => s.signupsDisabled)
      .const(effects)

    return {
      name: disabled ? i18n('Enable Signups') : i18n('Disable Signups'),
      description: disabled
        ? i18n(
            'Signups are currently disabled. Run this action to permit new account creation.',
          )
        : i18n(
            'Signups are currently enabled. Run this action to prohibit new account creation.',
          ),
      warning: disabled
        ? i18n(
            'Anyone who can reach your Karakeep address will be able to create an account on your server.',
          )
        : null,
      allowedStatuses: 'any',
      group: null,
      visibility: 'enabled',
    }
  },

  // handler
  async ({ effects }) => {
    await storeJson.merge(effects, {
      signupsDisabled: !(await storeJson.read((s) => s.signupsDisabled).once()),
    })
  },
)
