// PM2 ecosystem — reads .env directly so corrupt PM2 state can't override correct values
const fs = require("fs")

function parseEnvFile(path) {
  const env = {}
  try {
    const lines = fs.readFileSync(path, "utf8").split("\n")
    for (const line of lines) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (!m) continue
      let v = m[2].replace(/^['"]|['"]$/g, "") // strip surrounding quotes
      v = v.replace(/\\\$/g, "$")               // unescape \$ → $
      env[m[1]] = v
    }
  } catch (_) {}
  return env
}

const appEnv = parseEnvFile("/var/www/botsales/.env")

module.exports = {
  apps: [
    {
      name: "nextjs",
      script: "node_modules/.bin/next",
      args: "start --hostname 0.0.0.0",
      cwd: "/var/www/botsales",
      env: appEnv,
    },
  ],
}
