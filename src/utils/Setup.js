define(function (require, exports) {
    "use strict";

    // Brackets modules
    var _ = brackets.getModule("thirdparty/lodash");

    // Local modules
    var Cli = require("src/Cli");
    var Svn = require("src/svn/Svn");
    var Preferences = require("src/Preferences");
    var Promise = require("bluebird");

    // Templates

    // Module variables
    var standardSvnPathsWin = [
    ];

    var standardSvnPathsNonWin = [
        "/usr/bin/svn"
    ];

    // Implementation
    function findSvn() {
        return new Promise(function (resolve, reject) {

            // TODO: do this in two steps - first check user config and then check all
            var pathsToLook = ["Svn", Preferences.get("SvnPath")].concat(brackets.platform === "win" ? standardSvnPathsWin : standardSvnPathsNonWin);
            pathsToLook = _.unique(_.compact(pathsToLook));

            var results = [],
                errors = [];
            var finish = _.after(pathsToLook.length, function () {

                var searchedPaths = "\n\nSearched paths:\n" + pathsToLook.join("\n");

                if (results.length === 0) {
                    // no Svn found
                    reject("No Svn has been found on this computer" + searchedPaths);
                } else {
                    // at least one Svn is found
                    var Svns = _.sortBy(results, "version").reverse(),
                        latestSvn = Svns[0],
                        m = latestSvn.version.match(/([0-9]+)\.([0-9]+)/),
                        major = parseInt(m[1], 10),
                        minor = parseInt(m[2], 10);

                    if (major === 1 && minor < 7) {
                        return reject("Brackets-svn requires svn 1.7 or later - latest version found was " + latestSvn.version + searchedPaths);
                    }

                    // prefer the first defined so it doesn't change all the time and confuse people
                    latestSvn = _.sortBy(_.filter(Svns, function (Svn) { return Svn.version === latestSvn.version; }), "index")[0];

                    // this will save the settings also
                    Svn.setSvnPath(latestSvn.path);
                    resolve(latestSvn.version);
                }

            });

            pathsToLook.forEach(function (path, index) {
                Cli.spawnCommand(path, ["--version"]).then(function (stdout) {
					console.log(path, stdout);
                    var m = stdout.match(/^svn,  version\s+(.*)$/);
                    if (m) {
                        results.push({
                            path: path,
                            version: m[1],
                            index: index
                        });
                    }
                }).catch(function (err) {
                    errors.push({
                        path: path,
                        err: err
                    });
                }).finally(function () {
                    finish();
                });
            });

        });
    }

    // Public API
    exports.findSvn = findSvn;

});
