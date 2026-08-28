import { execSync } from 'child_process'

process.env.ELECTRON_BUILD = '1'

try {
  execSync('npm run build', { stdio: 'inherit' })
} catch (error) {
  console.error('Electron web build failed:', error)
  process.exit(1)
}
