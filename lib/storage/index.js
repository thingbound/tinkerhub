'use strict';

const debug = require('debug')('th.storage');

const path = require('path');
const mkdirp = require('mkdirp');

const AppDirectory = require('appdirectory');
const lmdb = require('node-lmdb');

const id = require('../utils/id');

/**
 * Simple key/value storage system that supports multi-process access.
 */
class Storage {
	constructor(path) {
		debug('Opening storage at ' + path);

		mkdirp.sync(path);

		this._env = new lmdb.Env();
		this._env.open({
			path: path,
		});

		this._db = this._env.openDbi({
			name: 'shared',
			create: true
		});
	}

	put(path, data) {
		data = JSON.stringify(data);
		var tx = this._env.beginTxn();

		tx.putString(this._db, path, data);

		tx.commit();
	}

	get(path) {
		var tx = this._env.beginTxn();
		var data = tx.getString(this._db, path);
		tx.commit();

		try {
			return data ? JSON.parse(data) : null;
		} catch(ex) {
			return null;
		}
	}

	sub(path) {
		return new SubStorage(this, path);
	}
}

class SubStorage {
	constructor(storage, path) {
		this._storage = storage;
		this._path = path;
	}

	put(path, data) {
		return this._storage.put(this._path + '/' + path, data);
	}

	get(path) {
		return this._storage.get(this._path + '/' + path);
	}
}

const dirs = new AppDirectory('tinkerhub');
const dbPath = path.join(dirs.userData(), 'db');

const storage = new Storage(dbPath);
storage.machineId = storage.get('th:machine');
if(! storage.machineId) {
	storage.machineId = id();
	storage.put('th:machine', storage.machineId);
}

module.exports = storage;
module.exports.appdata = dirs.userData();
module.exports.configdir = dirs.userConfig();
