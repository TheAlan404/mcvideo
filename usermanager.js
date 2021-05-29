const fs = require("fs");

const defaults = {
	banned: false,
	fpsMode: 30,
};

const db = {
	_db: JSON.parse(fs.readFileSync("./db.json")),
	get(nick){
		return this._db[nick] || JSON.parse(JSON.stringify(defaults));
	},
	save(nick, data){
		this._db[nick] = data;
		fs.writeFileSync("./db.json", JSON.stringify(this._db));
	},
};





module.exports = db;