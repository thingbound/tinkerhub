const debug = require('debug')('th.autoload');
const path = require('path');
const fs = require('fs');

module.exports = function() {
    const mainPath = module.parent.parent.paths[0];

    debug('Looking for modules in ' + mainPath);
    if(! fs.existsSync(mainPath)) return;

    fs.readdirSync(mainPath).forEach(dir => {
        if(! dir.match(/^(tinkerhub|th)-/)) return;

        const module = path.join(mainPath, dir);
        if(! fs.existsSync(path.join(module, 'package.json'))) return;

        debug('Loading ' + dir);
        require(module);
    });
};
