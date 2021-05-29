const { CommandHandler, Command } = require("string-commands");
const Msg = require("./Msg");



module.exports = function (serv, Parser) {
	const handler = new CommandHandler({ prefix: "/" });
	handler.setIncorrectUsage((cmd, usage, _full, client) => {
		client.chat(new Msg("Error: Incorrect usage: " + cmd + " " + usage, "red"));
	});
	handler.addCommand(new Command({
		name: "image",
		aliases: ["i"],
		usage: [":link"],
		run: (args, client) => {
			serv.chat(new Msg("> Displaying image sent by " + client.username, "dark_gray", args[0]));
			let link = args[0];
			try {
				console.time('frame speed');
				serv.mplayer.renderImage(link);
				console.timeEnd('frame speed');
			} catch (e) {
				serv.chat(new Msg(e.toString(), "red"));
			};
		},
	}))
	handler.addCommand(new Command({
		name: "imagetest",
		aliases: ["it"],
		run: (args, client) => {
			serv.chat(new Msg("> Displaying test image sent by " + client.username, "dark_gray"));
			try {
				serv.mplayer.renderImage("https://luna.cat.casa/test_image.png");
			} catch (e) {
				serv.chat(new Msg(e.toString(), "red"));
			};
		},
	}));
	handler.addCommand(new Command({
		name: "play",
		aliases: ["p"],
		usage: [":src (yt link)"],
		run: (args, client) => {
			let src = args[0];
			serv.chat(new Msg("> Processing video...", "gray", src));
			try {
				serv.mplayer.play(src);
			} catch (e) {
				serv.chat(new Msg(e.toString(), "red"));
			};
		},
	}));
	handler.addCommand(new Command({
		name: "playtest",
		aliases: ["pt"],
		usage: [],
		run: (args, client) => {
			let src = "https://www.youtube.com/watch?v=FtutLA63Cp8";

			serv.chat(new Msg("> Processing video (playtest)...", "gray", src));
			try {
				serv.mplayer.play(src);
			} catch (e) {
				serv.chat(new Msg(e.toString(), "red"));
			};
		},
	}));
	handler.addCommand({
		name: "setfps",
		usage: [":fps"],
		run: (args) => {
			serv.mplayer.FPS = args[0];
			serv.chat(new Msg("> FPS set to " +args[0], "gray"))
		},
	});
	handler.addCommand({
		name: "stop",
		run: () => {
			serv.mplayer.stop();
		},
	});
	handler.addCommand(new Command({
		name: "color",
		aliases: ["c"],
		usage: [":color number"],
		run: (args, client) => {
			let h = Buffer.alloc(128 * 128).fill(Buffer.from(args[0], "hex"));
			serv.mplayer.renderDisplays({
				1: h, 2: h, 3: h, 4: h, 5: h, 6: h, 7: h, 8: h
			});
		},
	}));
	handler.addCommand({
		name: "ping",
		run: (args, client) => {
			client.chat(new Msg("> "+client._socket.latency, "gray"));
		},
	});
	serv.commandhandler = handler;
	return handler;
};






