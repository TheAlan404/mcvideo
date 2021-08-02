const fs = require('fs')
const createServer = require('./src/mcServer.js')
const Msg = require('./src/inGameUtils/Msg.js')
const BossBar = require('./src/inGameUtils/bossbar.js')
const { server, emitter } = createServer()

if (!fs.existsSync('./chunk') && fs.existsSync('./example')) process.chdir('./example')

server.debug_bossbar = new BossBar(server, {
  writeAll: server.writeAll,
  title: 'Loading...'
})

server.stats_bossbar = new BossBar(server, {
  writeAll: server.writeAll,
  title: 'Loading...'
})

setInterval(() => {
  server.debug_bossbar.setTitle([
    new Msg('status=', 'dark_gray'),
    new Msg(server.mplayer.status, 'white'),
    new Msg(' | frames=', 'dark_gray'),
    new Msg(server.mplayer.frames.length || '0', 'blue'),
    new Msg(' | fps=', 'dark_gray'),
    new Msg(server.mplayer.FPS, 'green')
  ])
  server.stats_bossbar.setTitle([
    new Msg('mem=', 'dark_gray'),
    new Msg(Math.round((process.memoryUsage().rss / 1024) / 1024), 'gold'),
    new Msg('MB', 'gray')
  ])
}, 500)

emitter.on('client', (client) => {
  client.chat(new Msg().text('Welcome to the test server').color('dark_aqua').hover('urmom'))
})

process.stdin.on('data', function (buf) {
  const str = buf.toString().trim()
  if (str.length == 0 || str == '') return
  server.chat(new Msg(`[Server] ${str}`, 'white'))
})

//
