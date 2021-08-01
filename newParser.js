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
const EventEmitter = require("events");
const { createGzip, createGunzip } = require('zlib');
const ByteBuffer = require("bytebuffer");
const Cacher = require("./cacher");
const { SongPlayer } = require("nmp-player");

const PNGHEADER = Buffer.from("89 50 4E 47 0D 0A 1A 0A".split(" ").join(""), "hex");
const FPS = 20;

/*
class VideoPlayer {
	constructor(){

	};
};

class VideoProcessor {};

class SubtitlePlayer {};

class AudioPlayer {};

class AudioProcessor {};*/

class DisplayList {
	constructor(width, height, ids) {
		this.width = width || 1;
		this.height = height || 1;
		this.ids = Array.isArray(ids) ? ids : new Array(this.width * this.height);
	};
	get pixelCount() {
		return (this.width * 128) * (this.height * 128);
	};
};

let startTime


class MediaPlayer extends EventEmitter {
	constructor(serv, opts = {}) {
		super();
		this.serv = serv;
		this.interval = -1;
		this.ffmpegProcess = null;
		this.status = "stall"; // [stall, proc, play]
		this.FPS = opts.FPS || FPS;
		this.displays = new DisplayList(4, 2, [1, 2, 3, 4, 5, 6, 7, 8]);
		this.cacher = new Cacher(this);
		this.frames = [];
		this.mediaHistory = [];
		this.queue = [];
	};
	async start() {
		this.serv.chat(new Msg(`> Processing complete. Took ${Date.now() - startTime}ms`, "gray"));
		console.debug('checking status')
		if (this.status == "proc") return this.serv.chat(new Msg("> Error: the video is still processing", "red"));
		if (this.status == "play") return this.serv.chat(new Msg("> Error: the video is still playing", "red"));
		console.debug('setting status')
		this.status = "play";
		console.debug('saving to cache and stuff')
		if (this.videoID && !this.hasInCache(this.videoID)) {
			await this.saveToCache();
			delete this.videoID;
		};
		console.debug('writing msg to chat')
		this.serv.chat(new Msg("> Started MediaPlayer", "gray"));
		console.debug('starting interval')
		this.interval = setInterval(() => {
			if (this.frames.length === 0 || !this.frames[0]) return this.stop();
			this.renderImage(this.frames[0]);
			this.frames[0] = null;
			this.frames.shift();
		}, 1000 / FPS);
		if(globalThis.$lagtrain) {
			let songplayer = new SongPlayer()

			songplayer._note = (packet) => {
				packet.x = 10 * 8
				packet.y = 65 * 8
				packet.z = 8 * 8
				this.serv.writeAll('sound_effect', packet)
			}

			songplayer.play('./Lagtrain.nbs')
		};
	};
	stop() {
		if (this.ffmpegProcess) {
			this.ffmpegProcess.removeAllListeners("exit");
			this.ffmpegProcess.kill();
			this.ffmpegProcess = null;
			this.serv.chat(new Msg("> FFMPEG process killed.", "gray"));
		};
		clearInterval(this.interval);
		for (let i = 0; i < this.frames.length; i++) this.frames[i] = null;
		this.frames = [];
		this.serv.chat(new Msg("> MediaPlayer stopped", "gray"));
		this.status = "stall";
		//this.queue.shift();
		//if(this.queue[0]) this.play();
	};
	async saveToCache() {
		return await this.cacher.saveToCache();
		/*
		if (this.frames.length === 0) return console.log("nothing to save");
		let fpath = "./cached/" + this.videoID + "_data";
		let file = fs.createWriteStream(fpath);
		let tmpbuf = Buffer.alloc(32);
		tmpbuf.writeInt32BE(this.frames.length);
		file.write(tmpbuf);
		this.serv.chat(new Msg("[i] Saving " + this.frames.length + " frames..."));
		console.log("[i] Saving " + this.frames.length + " frames...");
		for(let data of this.frames) {
			let _tmpbuf = Buffer.alloc(32);
			_tmpbuf.writeInt32BE(data.length);
			file.write(Buffer.concat([_tmpbuf, data]));
		};
		file.end();
		console.log("[i] Saving complete!");
		this.serv.chat(new Msg("[i] Saving completed."));
		return true;*/
	};
	async loadFromCache(videoID) {
		return await this.cacher.loadFromCache(videoID);
		/*
		let fpath = "./cached/" + videoID + "_data";
		console.log(fpath);
		let file = fs.createReadStream(fpath);
		this.frames = [];
		file.once("readable", async () => { // like this?
			let framesLength = file.read(32).readInt32BE();
			this.serv.chat(new Msg("[i] Loading " + framesLength + " frames..."));
			console.log("[i] Loading " + framesLength + " frames...");
			for (let i = 0; i < framesLength; i++) {
				console.log('reading a fUNNY Fart', i)
				let buf = file.read(32);
				if (buf === null) {
					break;
				}
				let frameSize = buf.readInt32BE();
				this.frames.push(file.read(frameSize));
			};
			file.close();
			let warn = "";
			if(this.frames.length !== framesLength) warn = ", but "+(framesLength - this.frames.length)+" frames were not found.";
			this.serv.chat(new Msg("[i] Loading completed"+warn));
			console.log("[i] Loading complete"+warn);
			this.start();
		});*/
	};
	hasInCache(videoID) {
		return false; // disabled
		let _ = "./cached/" + videoID;
		return fs.existsSync(_ + "_data");
	};
	addFrame(buf) {
		this.frames.push(buf);
	};
	play(src = this.queue[0]) {
		if(this.status !== "stall") return;
		if (this.ffmpegProcess) return this.serv.chat(new Msg("> FFMPEG is currently processing. Abort using /stop or wait.", "red"));
		//let videoID = ytdl.getVideoID(src);
		//if (this.hasInCache(videoID)) {
		//	this.loadFromCache(videoID);
		//	return;
		//};
		this.createVideoStream(src);
	};
	addToQueue(str){
		return;
		this.queue.push(str);
		if(this.status === "stall" && this.queue.length === 1) this.play();
	};
	getSource(str) {
		if (fs.existsSync(str)) return fs.createReadStream(str);
		this.videoID = ytdl.getVideoID(str);
		return ytdl(str, {
			filter: format => {
				if (this.FPS === 60 && format.fps === 60) {
					return true;
				} else if (this.FPS === 60) {
					return false;
				}
				if ((format.qualityLabel === '480p' || format.qualityLabel === '360p') && !format.hasAudio) return true;
			}
		});
	};
	createVideoStream(src) {
		startTime = Date.now();
		let sourceStream = this.getSource(src);
		this.ffmpegProcess = spawn(ffPath, [
			"-i", "-",
			"-c:v", "png",
			"-r", this.FPS, // 10 fps
			"-preset", "ultrafast",
			"-hide_banner",
			"-f", "image2pipe",
			"-"
		]);
		let splittedStream = new StreamSplitter(PNGHEADER);
		splittedStream.on("data", (pngFile) => {
			this.addFrame(Buffer.concat([PNGHEADER, pngFile]));
		});
		sourceStream.pipe(this.ffmpegProcess.stdin);
		this.ffmpegProcess.stdout.pipe(splittedStream);
		this.ffmpegProcess.on("close", (code, sig) => {
			this.ffmpegProcess = null;
			console.debug('calling start fuction')
			this.status = "stall";
			this.start();
			console.log("ffmpeg exited with code", code, "signal", sig);
		})
		this.ffmpegProcess.on("error", (e) => serv.chat(new Msg("> FFMPEG: Error: " + e.toString(), "red")));
		this.status = "proc";
		/*this.once("stop", () => {
			splittedStream.destroy();
			sourceStream.destroy();
		});*/
	};
	async renderImage(src) {
		if (src === undefined) return console.log("renderImage called on undefined!");
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
		let displays = await this.divideToScreens(src);
		for (let n in displays) {
			displays[n] = await convertFrame(displays[n]);
		};

		this.renderDisplays(displays);
	};
	renderDisplays(displays) {
		for (let mapID in displays) {
			this.serv.sendMapData(mapID, displays[mapID]);
		};
	};
	async resizeImageToFit(data) {
		return await sharp(data).resize({ width: 128 * this.displays.width, height: 128 * this.displays.height, fit: 'contain' }).png().toBuffer();
	};
	async divideToScreens(pngFile) {
		// resize
		if (!Buffer.isBuffer(pngFile) || pngFile.length == 0) return this.serv.chat(new Msg("Error: divideToScreens buffer is null, aborted", "red"));
		pngFile = await this.resizeImageToFit(pngFile);

		// get stuff
		const canvas = createCanvas();
		const ctx = canvas.getContext('2d')
		const image = await loadImage(pngFile);
		canvas.width = image.width;
		canvas.height = image.height;
		ctx.drawImage(image, 0, 0);
		let displays = {};

		let i = 0;
		for (let y = 0; y < this.displays.height; y++) {
			for (let x = 0; x < this.displays.width; x++) {
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
};




module.exports = {
	MediaPlayer,
};