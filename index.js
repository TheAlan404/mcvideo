const mc = require("minecraft-protocol");
const fs = require("fs")
const Item = require('prismarine-item')("1.12.2");
const createServer = require("./mcserver.js");
const Msg = require("./Msg.js");
const BossBar = require('./bossbar.js')
let { server, emitter, } = createServer();

server.statBB = new BossBar(server, {
	write: server.writeAll,
	title: "Stats will be shown here",
});
emitter.on("client", (client) => {
	client.chat(new Msg().text("Welcome to the test server").color("dark_aqua").hover("urmom"));
});

process.stdin.on('data', function(buf) {
	let str = buf.toString().trim();
	if(str.length == 0 || str == "") return;
	server.chat(new Msg(`[Server] ${str}`, 'white'));
});


//