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
const BossBar = require("./bossbar");
const EventEmitter = require("events");
const { createGzip, createGunzip } = require('zlib');
const ByteBuffer = require("bytebuffer");
const PNGHEADER = Buffer.from("89 50 4E 47 0D 0A 1A 0A".split(" ").join(""), "hex");
const FPS = 30;

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
	get pixelCount(){
		return (this.width * 128) * (this.height * 128);
	};
};


class MediaPlayer extends EventEmitter {
	constructor(serv, opts = {}){
		super();
		this.serv = serv;
		this.interval = null;
		this.ffmpegProcess = null;
		this.status = "stall"; // [stall, proc, play]
		this.FPS = opts.FPS || FPS;
		this.displays = new DisplayList(4, 2, [1, 2, 3, 4, 5, 6, 7, 8]);
		this.frames = [];
		this.mediaHistory = [];
	};
	start(){
		if(this.status == "proc") return this.serv.chat(new Msg("> Error: the video is still processing", "red"));
		if(this.videoID && !this.hasInCache(this.videoID)) {
			this.saveToCache();
			delete this.videoID;
		};
		serv.chat(new Msg("> Started MediaPlayer", "gray"));
		this.interval = setInterval(() => {
			if (this.frames.length === 0 || !this.frames[0]) return this.stop();
			this.renderImage(this.frames[0]);
			this.frames.shift();
		}, 1000 / FPS);
	};
	stop(){
		if (this.ffmpegProcess) {
			this.ffmpegProcess.removeAllListeners("exit");
			this.ffmpegProcess.kill();
			this.ffmpegProcess = null;
			this.serv.chat(new Msg("> FFMPEG process killed.", "gray"));
		};
		clearInterval(this.interval);
		this.frames = [];
		this.serv.chat(new Msg("> MediaPlayer stopped", "gray"));
	};
	saveToCache(){
		if(this.frames.length === 0) return console.log("nothing to save");
		let fpath = "./cached/" + this.videoID + "_data";
		let gzip = createGzip();
		let file = fs.createWriteStream(fpath);
		gzip.pipe(file);
		gzip.write(ByteBuffer.allocate(64).writeInt64(this.frames.length));
		this.serv.chat(new Msg("[i] Saving " + this.frames.length + " frames..."));
		console.log("[i] Saving " + this.frames.length + " frames...");
		this.frames.forEach((data) => {
			gzip.write(Buffer.concat([ ByteBuffer.allocate(32).writeInt32(data.length), data]));
		});
		gzip.end();
		console.log("[i] Saving complete!");
		this.serv.chat(new Msg("[i] Saving completed."));
	};
	loadFromCache(videoID){ // yes this is better lul
		/*let metadata = JSON.parse(fs.readFileSync("./cached/" + videoID + "_meta"));
		let fpath = "./cached/" + videoID + "_data";
		let file = fs.createReadStream(fpath);
		let buf = ByteBuffer.fromUTF8();*/
		// can you gıve me a sec ıll try to fıx your pıng ok
		
		let fpath = "./cached/" + videoID + "_data";
		let gzip = createGunzip();
		let file = fs.createReadStream(fpath);
		file.pipe(gzip);
		this.frames = [];
		let framesLength = ByteBuffer.fromHex(gzip.read(64).toString("hex")).readInt64();
		this.serv.chat(new Msg("[i] Loading " + framesLength + " frames..."));
		console.log("[i] Loading " + framesLength + " frames...");
		for(let i = 0; i < framesLength; i++){
			let frameSize = ByteBuffer.fromHex(gzip.read(32).toString("hex")).readInt32();
			this.frames.push(gzip.read(frameSize));
		};
		gzip.end();
		this.serv.chat(new Msg("[i] Loading completed."));
		console.log("[i] Loading complete");
		this.start();
	};
	hasInCache(videoID){
		let _ = "./cached/"+videoID;
		return fs.existsSync(_ + "_data");
	};
	addFrame(buf){
		this.frames.push(buf);
	};
	play(src){
		if(this.hasInCache(src)) {
			this.loadFromCache(src);
			return;
		};
		this.createVideoStream(src);
	};
	getSource(str){
		if(fs.existsSync(str)) return fs.createReadStream(str);
		this.videoID = ytdl.getVideoID(str);
		return ytdl(str, {
			filter: format => {
				if(this.FPS === 60 && format.fps === 60) {
					return true;
				} else if(this.FPS === 60) {
					return false;
				}
				if ((format.qualityLabel === '480p' || format.qualityLabel === '360p') && !format.hasAudio) return true;
			}
		});
	};
	createVideoStream(src){
		if (this.ffmpegProcess) return this.serv.chat(new Msg("> FFMPEG is currently processing. Abort using /stop or wait.", "red"));
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
			this.addFrame(Buffer.from(PNGHEADER.toString("hex") + pngFile.toString("hex"), "hex"));
		});
		sourceStream.on("data", (chunk) => {
			if (this.ffmpegProcess) this.ffmpegProcess.stdin.write(chunk);
		});
		this.ffmpegProcess.stdout.pipe(splittedStream);
		this.ffmpegProcess.on("exit", (code, sig) => {
			this.ffmpegProcess = null;
			this.start();
			console.log("ffmpeg exited with code", code, "signal", sig);
		})
		this.ffmpegProcess.on("error", (e) => serv.chat(new Msg("> FFMPEG: Error: " + e.toString(), "red")));
		/*this.once("stop", () => {
			splittedStream.destroy();
			sourceStream.destroy();
		});*/
	};
	async renderImage(src){
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
		let displays = await this.divideToScreens(pngFile);
		for (let n in displays) {
			displays[n] = await this.convertFrame(displays[n]);
		};

		renderDisplays(displays);
	};
	renderDisplays(displays) {
		for (let mapID in displays) {
			serv.sendMapData(mapID, displays[mapID]);
		};
	};
	async resizeImageToFit(data){
		return await sharp(data).resize({ width: 128 * 4, height: 128 * 2, fit: 'contain' }).png().toBuffer();
	};
	async divideToScreens(pngFile) {
		// resize
		if (!Buffer.isBuffer(pngFile) || pngFile.length == 0) return this.serv.chat(new Msg("Error: divideToScreens buffer is null, aborted", "red"));
		pngFile = await resizeImageToFit(pngFile);

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