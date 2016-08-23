'use strict';

const debug = require('debug')('th.autoload');
const path = require('path');
const fs = require('fs');

function fileExistsSync(path) {
    try {
        fs.accessSync(path, fs.F_OK);
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = function() {
    const mainPath = module.parent.parent.paths[0];

    debug('Looking for modules in ' + mainPath);
    if(fileExistsSync(mainPath) === fs.constants.R_OK) return;

    fs.readdirSync(mainPath).forEach(dir => {
        if(! dir.match(/^(tinkerhub|th)-/)) return;

        const module = path.join(mainPath, dir);
        if(! fileExistsSync(path.join(module, 'package.json'))) return;

        debug('Loading ' + dir);
        require(module);
    });
};
