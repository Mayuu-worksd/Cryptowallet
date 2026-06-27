console.log("Environment Keys:");
for (let key in process.env) {
  console.log(`  ${key}: ${process.env[key] ? process.env[key].substring(0, 5) + '...' : 'empty'}`);
}
