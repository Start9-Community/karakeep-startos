import { utils } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { adminEmail, dataMount } from '../utils'

// Mirrors upstream's User.createRaw and setUserPassword (packages/trpc), using
// the bcryptjs and better-sqlite3 the image ships for them, and signs the admin
// out everywhere as upstream's admin password reset does.
const setPasswordScript = `
const fs = require('fs')
const { createRequire } = require('module')
const from = (pkg) =>
  createRequire(fs.realpathSync('/app/apps/workers/node_modules/@karakeep/' + pkg) + '/')
const Database = from('db')('better-sqlite3')
const { createId } = from('db')('@paralleldrive/cuid2')
const bcrypt = from('trpc')('bcryptjs')
const db = new Database(process.env.DATA_DIR + '/db.db')
db.pragma('busy_timeout = 30000')
const hash = bcrypt.hashSync(process.env.PASSWORD, 10)
const now = Date.now()
const email = db
  .transaction(() => {
    let user = db
      .prepare("SELECT id, email FROM user WHERE role = 'admin' ORDER BY createdAt LIMIT 1")
      .get()
    if (!user) {
      user = { id: createId(), email: process.env.EMAIL }
      db.prepare(
        "INSERT INTO user (id, name, email, emailVerified, role, createdAt, updatedAt) VALUES (?, 'Admin', ?, 0, 'admin', ?, ?)",
      ).run(user.id, user.email, now, now)
    }
    db.prepare(
      "INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (?, ?, 'credential', ?, ?, ?, ?) ON CONFLICT (providerId, accountId) DO UPDATE SET password = excluded.password, updatedAt = excluded.updatedAt",
    ).run(createId(), user.id, user.id, hash, now, now)
    db.prepare('DELETE FROM session WHERE userId = ?').run(user.id)
    return user.email
  })
  .immediate()
console.log(email)
`

export const setAdminPassword = sdk.Action.withoutInput(
  'set-admin-password',

  async ({ effects }) => ({
    name: i18n('Set Admin Password'),
    description: i18n(
      'Generate a new random password for the Karakeep administrator account. Replaces any existing password.',
    ),
    warning: (await storeJson.read((s) => s.adminPassword).const(effects))
      ? i18n(
          'Replaces the current admin password and signs the administrator out of every device.',
        )
      : null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  async ({ effects }) => {
    const password = utils.getDefaultString({
      charset: 'a-z,A-Z,0-9',
      len: 22,
    })
    // Without DB_WAL_MODE the migrator switches journal mode and fails on a live database.
    const env = {
      DATA_DIR: '/data',
      DB_WAL_MODE: 'true',
      PASSWORD: password,
      EMAIL: adminEmail,
    }

    const email = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'karakeep' },
      dataMount,
      'set-admin-password',
      async (sub) => {
        await sub.execFail(['node', 'index.js'], {
          cwd: '/db_migrations',
          env,
          timeout: null,
        })
        const { stdout } = await sub.execFail(
          ['node', '-e', setPasswordScript],
          { env, timeout: 60_000 },
        )
        return String(stdout).trim()
      },
    )

    await storeJson.merge(effects, { adminPassword: password })

    return {
      version: '1',
      title: i18n('Admin Credentials'),
      message: i18n('Sign in to Karakeep with this email and password.'),
      result: {
        type: 'group',
        value: [
          {
            type: 'single',
            name: i18n('Email'),
            description: null,
            value: email,
            masked: false,
            copyable: true,
            qr: false,
            launchable: false,
          },
          {
            type: 'single',
            name: i18n('Password'),
            description: null,
            value: password,
            masked: true,
            copyable: true,
            qr: false,
            launchable: false,
          },
        ],
      },
    }
  },
)
