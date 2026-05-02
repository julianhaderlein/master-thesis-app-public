const { getDefaultConfig } = require('expo/metro-config')
const { spawn } = require('child_process')
const path = require('path')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

// Add .sql to source extensions
config.resolver.sourceExts.push('sql');

// Hook to run bare-pack before bundling
const originalProcessModuleFilter = config.serializer.processModuleFilter

config.serializer.processModuleFilter = function (module) {
  // Run bare-pack on first bundle request
  if (!global.__barePackRan) {
    global.__barePackRan = true
    console.log('Running bare-pack...')

    const barePack = spawn('npm', [
      'run',
      'pack:backend'
    ], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    })

    // Note: This runs async, but Metro will wait for the bundle to exist
  }

  return originalProcessModuleFilter ? originalProcessModuleFilter(module) : true
}

module.exports = config