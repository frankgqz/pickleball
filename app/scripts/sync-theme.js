const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const BASE = 'https://raw.githubusercontent.com/frankgqz/theme/main'

try {
  const css = execSync(`curl -sL "${BASE}/theme.css"`, { encoding: 'utf8' })
  fs.writeFileSync(path.join(__dirname, '../theme.css'), css)

  const data = execSync(`curl -sL "${BASE}/src/theme.ts"`, { encoding: 'utf8' })
  fs.writeFileSync(path.join(__dirname, '../theme.ts'), data)

  console.log('Theme synced from gqz/theme')
} catch {
  console.warn('Theme sync failed, using existing files')
}
