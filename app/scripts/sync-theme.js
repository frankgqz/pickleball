const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const BASE = 'https://raw.githubusercontent.com/frankgqz/theme/main'

try {
  const css = execSync(`curl -sL "${BASE}/theme.css"`, { encoding: 'utf8' })
  fs.writeFileSync(path.join(__dirname, '../theme.css'), css)

  const theme = execSync(`curl -sL "${BASE}/src/theme.ts"`, { encoding: 'utf8' })
  fs.writeFileSync(path.join(__dirname, '../theme.ts'), theme)

  const useTheme = execSync(`curl -sL "${BASE}/src/useTheme.tsx"`, { encoding: 'utf8' })
  fs.writeFileSync(path.join(__dirname, '../useTheme.tsx'), useTheme)

  const toggle = execSync(`curl -sL "${BASE}/src/ThemeToggle.tsx"`, { encoding: 'utf8' })
  fs.writeFileSync(path.join(__dirname, '../ThemeToggle.tsx'), toggle)

  console.log('Theme synced from gqz/theme')
} catch {
  console.warn('Theme sync failed, using existing files')
}
