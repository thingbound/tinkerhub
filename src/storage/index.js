var debug = require('debug')('th.storage');

var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');

var AppDirectory = require('appdirectory');
var lmdb = require('node-lmdb');


function Storage(path) {
    debug('Opening storage at ' + path);

    mkdirp.sync(path);
    this._open(path);
}

Storage.prototype._open = function(path) {
    this._env = new lmdb.Env();
    this._env.open({
        path: path,
    });

    this._db = this._env.openDbi({
        name: 'shared',
        create: true
    });
};

Storage.prototype.put = function(path, data) {
    data = JSON.stringify(data);
    var tx = this._env.beginTxn();

    tx.putString(this._db, path, data);

    tx.commit();
};

Storage.prototype.get = function(path) {
    var tx = this._env.beginTxn();
    var data = tx.getString(this._db, path);
    tx.commit();

    return data ? JSON.parse(data) : null;
};

var dirs = new AppDirectory('tinkerhub');
var dbPath = path.join(dirs.userData(), 'db');

module.exports = new Storage(dbPath);
