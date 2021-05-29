const ffPath = require("ffmpeg-static");
const ytdl = require("ytdl-core");
const { Writable, Readable, Transform } = require("stream"); // aka stupid api i have to use
const fs = require("fs");
const { spawn } = require("child_process");
const StreamSplitter = require("stream-split");
const { createCanvas, loadImage } = require('canvas');
const sharp = require("sharp");
const { convertFrame } = require("./convert");
const fetch = require("node-fetch");
const Msg = require("./Msg");
const { getHeapStatistics } = require("v8");
const { log } = console;

const PNGHEADER = Buffer.from("89 50 4E 47 0D 0A 1A 0A".split(" ").join(""), "hex");
/*




											 [[ NEW MESSAGE ]]
								im refactoring this, dennis.

*/

let FPS = 30;

function load(serv) {
	let Qinterval = null;
	let Qstart = () => {
		serv.chat(new Msg("> Started VideoPlayer", "gray"));
		let i = 0;
		Qinterval = setInterval(() => {
			if (Qlist.length === 0 || !Qlist[0] || Qlist[0] === undefined) {
				serv.chat(new Msg("> Stopped VideoPlayer", "gray"));
				return Qstop();
			}
			let a = Date.now();
			renderImage(Qlist[0]);
			let b = Date.now();
			serv.statBB.setTitle("Frame " + i + " took " + (b - a) + "ms to render");
			Qlist[0] = null;
			Qlist.shift();
			i++;
		}, 1000 / FPS);
	};
	let Qstop = () => {
		if (serv.ffProc) {
			let p = serv.ffProc;
			serv.ffProc = null;
			p.kill();

		};
		Qlist = null;
		Qlist = [];
		if (!Qinterval) return;
		clearInterval(Qinterval);
		// null out every value to free memory
		Qinterval = null;
	};
	let Qlist = [];
	function addToQueue(buf) {
		Qlist.push(buf);
	};
	serv.mediaHistory = [];
	serv.ffProc = null;


	function createVideoStream(srcStr) {

		if (serv.ffProc) return serv.chat(new Msg("> FFMPEG is currently processing. Abort using /stop or wait.", "red"));
		Qstop();

		console.log('[ytdl] selecting video format...')
		let sourceStream = fs.existsSync(srcStr) ? fs.createReadStream(srcStr) : ytdl(srcStr, {
			filter: format => {
				if (!format.qualityLabel) return false;
				process.stdout.write(`[ytdl] ${format.qualityLabel} (${format.fps}fps) -> `)
				if (FPS === 60 && format.fps === 60) {
					console.log('true')
					return true;
				} else if (FPS === 60) {
					console.log('false');
					return false;
				}
				if ((format.qualityLabel === '480p' || format.qualityLabel === '360p') && !format.hasAudio) {
					console.log('true');
					return true;
				}

				console.log('false');

			}
		});

		let ffmpegProcess = spawn(ffPath, [
			"-i", "-",
			"-c:v", "png",
			"-r", FPS, // 10 fps
			"-hide_banner",
			"-f", "image2pipe",
			"-"
		]);
		serv.ffProc = ffmpegProcess;
		let splittedStream = new StreamSplitter(PNGHEADER);

		splittedStream.on("data", (pngFile) => {
			addToQueue(Buffer.from(PNGHEADER.toString("hex") + pngFile.toString("hex"), "hex"));
		});

		sourceStream.on("data", (chunk) => {
			if (serv.ffProc) ffmpegProcess.stdin.write(chunk);
		});
		ffmpegProcess.stdout.on("data", (chunk) => {
			splittedStream.write(chunk);
		});

		let resolved = false;
		function waitForFinishOrTimeout() {
			return new Promise((res) => {
				let listener = () => {
					resolved = true;
					res();
					clearTimeout(timeout);
				};
				ffmpegProcess.on("exit", listener);
				let timeout = setTimeout(() => {
					ffmpegProcess.removeListener("exit", listener);
					resolved = true;
					res();
				}, 30 * 1000);
			});
		};

		ffmpegProcess.on("exit", (code, sig) => {
			if (resolved) return;
			serv.ffProc = null;
			Qstart();
			console.log("ffmpeg exited with code", code, "signal", sig);
		})
		ffmpegProcess.on("error", (e) => serv.chat(new Msg("> FFMPEG: Error: " + e.toString(), "red")));
		serv.mediaHistory.push({ type: "yt", data: srcStr, });
		waitForFinishOrTimeout().then(() => {
			serv.ffProc = null;
			Qstart()
		});

	};

	async function renderImage(src) {
		if (!Buffer.isBuffer(src)) {
			if (fs.existsSync(src)) {
				src = fs.readFileSync(src);
			} else {
				try {
					let req = await fetch(src); //TODO: fix TypeError: Only absolute URLs are supported (Luna)
					src = await req.buffer();
				} catch (e) {
					throw e;
				}
			};
		};
		pngFile = src;
		let displays = await divideToScreens(pngFile);
		for (let n in displays) {
			displays[n] = await convertFrame(displays[n]);
		};

		renderDisplays(displays);
	};

	function renderDisplays(displays) {
		for (let mapID in displays) {
			serv.sendMapData(mapID, displays[mapID]); // displays[mapID=1] === undefined what
		};
	};






	async function divideToScreens(pngFile) {
		// resize
		if (!Buffer.isBuffer(pngFile) || pngFile.length == 0) return serv.chat(new Msg("Error: divideToScreens buffer is null, aborted", "red"));
		pngFile = await sharp(pngFile).resize({ width: 128 * 4, height: 128 * 2, fit: 'contain' }).png().toBuffer(); // HERE

		// get stuff
		const canvas = createCanvas();
		const ctx = canvas.getContext('2d')
		const image = await loadImage(pngFile);
		canvas.width = image.width;
		canvas.height = image.height;
		ctx.drawImage(image, 0, 0);
		let displays = {};

		let i = 0;
		for (let y = 0; y < 2; y++) {
			for (let x = 0; x < 4; x++) {
				i++;
				let data_RGBA = ctx.getImageData(x * 128, y * 128, 128, 128).data;
				let data = new Uint8ClampedArray((128 * 128) * 3);
				let j = 0;
				for (let k = 0; k < data_RGBA.length; k += 4) {
					data[j++] = data_RGBA[k];
					data[j++] = data_RGBA[k + 1];
					data[j++] = data_RGBA[k + 2];

				}
				displays[i] = data;
			}
		}

		return displays;
	};


	const Parser = {
		createVideoStream,
		renderDisplays,
		divideToScreens,
		renderImage,
		Qstart,
		Qstop,
		setFPS(n) { FPS = n; },
	};

	return Parser;
};



module.exports = {
	load,
};