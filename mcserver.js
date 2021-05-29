const mc = require("minecraft-protocol");
const fs = require("fs")
const CreateHandler = require("./commands.js");
const emitter = new (require("events").EventEmitter)();
const UUID = require("uuid");
const Msg = require("./Msg.js");
const Item = require('prismarine-item')("1.12.2");
//const CreateParser = require("./parser.js").load;
const Vec3 = require("vec3");
const PlayerEntity = require('./playerentity.js');
const { MediaPlayer } = require("./newParser");

const db = require("./usermanager.js");

const itemFrame = (x, y, z, id) => {
	return {
		entityId: id,
		objectUUID: UUID.v4(),
		type: 71,
		x: x,
		y: y,
		z: z,
		pitch: 0,
		yaw: -64,
		objectData: id,
		velocityX: 0,
		velocityY: 0,
		velocityZ: 0
	};
};

function spawnDisplay(client, x, y, z, mapID = 1, frameEID) {
	if (!frameEID) frameEID = Math.floor(Math.random() * 32767) + 32767;
	client.write("spawn_entity", itemFrame(x, y, z, frameEID));
	let item = Item.toNotch(new Item(358, 1));
	item.itemDamage = mapID;
	client.write("entity_metadata", {
		entityId: frameEID,
		metadata: [
			{
				key: 6,
				type: 5, //ty
				value: item
			}
		]
	});
};

function loadStuff(client) {
	client.write('map_chunk', {
		x: 0, z: 0, groundUp: true, bitMap: 24,
		chunkData: Buffer.from(fs.readFileSync("./chunkData", 'utf-8'), 'hex'), //gimme
		blockEntities: []
	});
	let mapId = 0;
	for (let y = 66; y >= 65; y--) {
		for (let z = 9; z >= 6; z--) {
			spawnDisplay(client, 4, y, z, (++mapId))
		}
	}

}

const CachedMapData = new Map(); // dep
const MapCache = new Map();

module.exports = function () {
	const serv = mc.createServer({
		host: '0.0.0.0',
		port: 25565,
		"online-mode": false, // oh
		version: "1.12.2",
		maxPlayers: 255 /* more than 255 and it starts going ooh ahh monkey mode */ // KEKW
	});



	serv.writeAll = (n, d) => {
		for (let i in serv.clients) {
			serv.clients[i].write(n, d);
		};
	};

	serv.sendMapData = (mapID, data) => {
		if (!data) return console.log("sendMapData mapData is not defined, aborted.");
		data = Buffer.isBuffer(data) ? data : Buffer.from(data, "hex");
		if (data.length !== 128 * 128) console.log("sendMapData data length is not 128*128, it is ", data.length); // it isn't
		if (data.equals((MapCache.get(mapID) || Buffer.alloc(1)))) return; // same data, return to save perf/stuff
		serv.writeAll("map", {
			itemDamage: mapID,
			scale: 4,
			trackingPosition: false,
			icons: [],
			columns: -128,
			rows: -128,
			x: 0,
			y: 0,
			data: (data),
		});
		MapCache.set(mapID, data);
		//CachedMapData.set(mapID, data);
	};

	serv.chat = (d) => serv.writeAll("chat", { message: JSON.stringify(d), });

	//const Parser = CreateParser(serv);
	let handler = CreateHandler(serv);
	serv.mplayer = new MediaPlayer(serv);

	serv.on("login", (client) => {
		const entityId = Object.keys(serv.clients).length || 0;
		client.entityId = entityId;

		client.db = db.get(client.username);


		client.chat = (d) => {
			client.write("chat", { message: JSON.stringify(d), });
		};

		client.write('login', { entityId, levelType: 'default', gameMode: 1, dimension: 0, difficulty: 2, maxPlayers: serv.maxPlayers, reducedDebugInfo: false });
		client.write('position', { x: 10, y: 65, z: 8, yaw: 90, pitch: 0, flags: 0x00, teleportId: 1 });
		if (client.db.banned) return "never gonna load you up";
		loadStuff(client);
		client.pos = { x: 10, y: 65, z: 8, yaw: 90, pitch: 0 }
		client.playerEntity = new PlayerEntity(client, serv.writeAll, (c, n, d) => {
			for (let i in serv.clients) {
				if (serv.clients[i] != c) serv.clients[i].write(n, d);
			};
		})

		serv.chat([new Msg(client.username, "gold"), new Msg(" joined.", "yellow")]);
		console.log(`${client.username} joined.`);

		client.on("chat", ({ message }) => {
			if (message.startsWith("/")) {
				handler.run(message, client, client); // TODO: fix this bug in string commands (dennis)
			} else {
				serv.chat([new Msg(client.username, "gold"), new Msg(": ", "reset"), new Msg(message, "yellow")]);
				console.log(`${client.username}: ${message}`);
			};
		});
		client.on('block_dig', () => loadStuff(client));
		client.on('block_place', () => loadStuff(client));

		//TODO: broadcast arm_animation packets (Luna)
		//TODO: broadcast position packets (Luna)

		client.on("end", () => {
			serv.chat([new Msg(client.username, "gold"), new Msg(" left.", "yellow")]);
			console.log(`${client.username} left.`);
		});


		emitter.emit("client", client);
	});

	// serv.player = { interval, stop() }

	console.log("Server started");

	return { server: serv, emitter, };
};