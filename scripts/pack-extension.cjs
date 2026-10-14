const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const extDir = path.join(rootDir, 'browser-extension', 'anfeta-hotkey');
const outDir = path.join(rootDir, 'public', 'downloads');
const zipFile = path.join(outDir, 'anfeta-hotkey.zip');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
}

try {
  // Use tar which is available natively on modern Windows, Linux and macOS
  execSync(`tar -a -c -f "${zipFile}" -C "${extDir}" .`, { stdio: 'inherit' });
} catch (e) {
  // Fallback to PowerShell Compress-Archive on Windows if tar fails
  if (process.platform === 'win32') {
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${extDir}\\*' -DestinationPath '${zipFile}' -Force"`, { stdio: 'inherit' });
  } else {
    throw e;
  }
}

if (!fs.existsSync(zipFile)) {
  console.error('Error: No se pudo generar anfeta-hotkey.zip');
  process.exit(1);
}

const stats = fs.statSync(zipFile);
console.log(`OK: anfeta-hotkey.zip generado correctamente (${stats.size} bytes).`);
