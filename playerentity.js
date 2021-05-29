let playerListStorage = {};
let entityStorage = {};

function conv(f) {
	let b = Math.floor((f % 360) * 256 / 360)
	if (b < -128) b += 256
	else if (b > 127) b -= 256
	return b
}

module.exports = class PlayerEntity {
	constructor(client, writeAll, writeAllExcept) {
		if (!client.pos) client.pos = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }
		this.client = client;
		this.writeAll = writeAll;
		this.writeAllExcept = writeAllExcept;

		this.sendStuff();
		this.spawnClient();
		this.spawnEntity();

		client.on('look', (packet) => {
			this.lookTo(packet.yaw, packet.pitch);
		})

		client.on('position', (packet) => {
			this.moveTo(packet.x, packet.y, packet.z);
		})

		client.on('position_look', (packet) => {
			this.moveTo(packet.x, packet.y, packet.z);
			this.lookTo(packet.yaw, packet.pitch);
		})

		client.on('entity_action', (packet) => {
			if (packet.actionId === 0) this.sneak();
			if (packet.actionId === 1) this.stopSneak(); // :P
		})

		this.client.on('arm_animation', (packet) => {
			this.punch(packet.hand);
		})

		client.on('end', () => {
			this.despawnClient();
			this.despawnEntity();
			this.client = null;
		});
	};

	sendStuff() {
		Object.values(playerListStorage).forEach((player) => {
			if (player.UUID === this.client.uuid) return;
			this.client.write("player_info", {
				action: 0,
				data: [player]
			});
		});

		Object.values(entityStorage).forEach((player) => {
			if (player.playerUUID === this.client.uuid) return;
			this.client.write("named_entity_spawn", player);
		});
	};

	spawnEntity() {
		let data = {
			playerUUID: this.client.uuid,
			entityId: this.client.entityId,
			x: this.client.pos.x,
			y: this.client.pos.y,
			z: this.client.pos.z,
			yaw: this.client.pos.yaw,
			pitch: this.client.pos.pitch,
			metadata: []
		}
		entityStorage[this.client.uuid] = data;
		this.writeAllExcept(this.client, "named_entity_spawn", data);
	};
	spawnClient() {
		let data = {
			UUID: this.client.uuid,
			name: this.client.username,
			properties: [], // todo: implement skins
			gamemode: 1,
			ping: 1,
			displayName: null
		}

		playerListStorage[this.client.uuid] = data;
		this.writeAll("player_info", {
			action: 0,
			data: [data]
		});
	};

	despawnEntity() {
		delete entityStorage[this.client.uuid];
		this.writeAllExcept(this.client, "entity_destroy", {
			entityIds: [this.client.entityId]
		});
	};


	despawnClient() {
		delete playerListStorage[this.client.uuid];
		this.writeAll("player_info", {
			action: 4,
			data: [{
				UUID: this.client.uuid
			}]
		});
	};

	lookTo(rawyaw, rawpitch) {
		let convertedYaw = conv(rawyaw);
		let convertedPitch = conv(rawpitch);

		this.client.pos.yaw = entityStorage[this.client.uuid].yaw = convertedYaw;
		this.client.pos.pitch = entityStorage[this.client.uuid].pitch = convertedPitch;
		this.writeAllExcept(this.client, "entity_look", {
			entityId: this.client.entityId,
			yaw: convertedYaw,
			pitch: convertedPitch,
			onGround: false
		})
		this.writeAllExcept(this.client, "entity_head_rotation", {
			entityId: this.client.entityId,
			headYaw: convertedYaw
		})
	}

	moveTo(x = this.client.pos.x, y = this.client.pos.y, z = this.client.pos.z, yaw = this.client.pos.yaw, pitch = this.client.pos.pitch) {
		let convertedYaw = conv(yaw);
		let convertedPitch = conv(pitch);

		this.client.pos = { x, y, z, yaw: convertedYaw, pitch: convertedPitch }
		entityStorage[this.client.uuid] = { playerUUID: this.client.uuid, entityId: this.client.entityId, x, y, z, yaw: convertedYaw, pitch: convertedPitch, metadata: [] }

		this.writeAllExcept(this.client, "entity_teleport", {
			entityId: this.client.entityId,
			x,
			y,
			z,
			yaw: convertedYaw,
			pitch: convertedPitch,
			onGround: false,
		});
	}

	sneak() {
		let metadata = [{
			key: 0,
			type: 0,
			value: 0x02
		}]
		entityStorage[this.client.uuid].metadata = metadata
		this.writeAllExcept(this.client, "entity_metadata", {
			entityId: this.client.entityId,
			metadata
		})
	}

	stopSneak() {
		let metadata = [{
			key: 0,
			type: 0,
			value: 0x00
		}]
		entityStorage[this.client.uuid].metadata = metadata
		this.writeAllExcept(this.client, "entity_metadata", {
			entityId: this.client.entityId,
			metadata
		})
	}

	punch(isOffhand) {
		this.writeAllExcept(this.client, "animation", {
			entityId: this.client.entityId,
			animation: isOffhand ? 3 : 0
		});
	}

};