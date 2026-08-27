const { exec } = require('child_process');

exec('powershell -Command "Get-Process -Name *node*, *expo* -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, Path, CommandLine | Format-List"', (err, stdout, stderr) => {
  if (err) {
    console.error('Failed to run powershell:', err);
    return;
  }
  console.log(stdout);
});
