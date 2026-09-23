const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const BASE = 'https://raw.githubusercontent.com/frankgqz/theme/main'

try {
  const css = execSync(`curl -sL "${BASE}/theme.css"`, { encoding: 'utf8' })
  fs.writeFileSync(path.join(__dirname, '../theme.css'), css)

  const theme = execSync(`curl -sL "${BASE}/theme.ts"`, { encoding: 'utf8' })
  fs.writeFileSync(path.join(__dirname, '../theme.ts'), theme)

  const useTheme = execSync(`curl -sL "${BASE}/useTheme.ts"`, { encoding: 'utf8' })
  fs.writeFileSync(path.join(__dirname, '../useTheme.tsx'), useTheme)

  const provider = execSync(`curl -sL "${BASE}/themeProvider.tsx"`, { encoding: 'utf8' })
  fs.writeFileSync(path.join(__dirname, '../ThemeProvider.tsx'), provider)

  const toggle = execSync(`curl -sL "${BASE}/themeToggle.tsx"`, { encoding: 'utf8' })
  fs.writeFileSync(path.join(__dirname, '../ThemeToggle.tsx'), toggle)

  const storage = execSync(`curl -sL "${BASE}/storage.ts"`, { encoding: 'utf8' })
  fs.writeFileSync(path.join(__dirname, '../storage.ts'), storage)

  console.log('Theme synced from gqz/theme')
} catch {
  console.warn('Theme sync failed, using existing files')
}
