/*
    This file acts as an entry point to SvnCli.js and other possible
    implementations of Git communication besides Cli. Application
    should not access SvnCli directly.
*/
define(function (require, exports) {

    // Local modules
    var Promise = require("bluebird"),
        Cli     = require("src/Cli"),
        SvnCli  = require("src/svn/SvnCli"),
        Utils   = require("src/Utils");

    // Implementation
    function pushToNewUpstream(remoteName, remoteBranch) {
        return SvnCli.push(remoteName, remoteBranch, ["--set-upstream"]);
    }

    function sortBranches(branches) {
        return branches.sort(function (a, b) {
            var ar = a.remote || "",
                br = b.remote || "";
            // origin remote first
            if (br && ar === "origin" && br !== "origin") {
                return -1;
            } else if (ar && ar !== "origin" && br === "origin") {
                return 1;
            }
            // sort by remotes
            if (ar < br) {
                return -1;
            } else if (ar > br) {
                return 1;
            }
            // sort by sortPrefix (# character)
            if (a.sortPrefix < b.sortPrefix) {
                return -1;
            } else if (a.sortPrefix > b.sortPrefix) {
                return 1;
            }
            // master branch first
            if (a.sortName === "master" && b.sortName !== "master") {
                return -1;
            } else if (a.sortName !== "master" && b.sortName === "master") {
                return 1;
            }
            // sort by sortName (lowercased branch name)
            return a.sortName < b.sortName ? -1 : a.sortName > b.sortName ? 1 : 0;
        });
    }

    function getHistory(skip) {
        return SvnCli.getHistory(skip);
    }

    function getFileHistory(file, skip) {
        return SvnCli.getHistory(skip, file);
    }
	
	function updateRepo(){
		return SvnCli.updateRepo();
	}

	function updateFile(file){
		return SvnCli.updateFile(file);
	}

    function resetIndex() {
        return SvnCli.reset();
    }

    function discardAllChanges() {
        return SvnCli.reset("--hard").then(function () {
            return SvnCli.clean();
        });
    }

    function isProjectRepositoryRoot() {
        return Cli.pathExists(Utils.getProjectRoot() + ".git");
    }


    function discardFileChanges(file) {
        return SvnCli.revert(file);
    }

    function undoLastLocalCommit() {
        return SvnCli.reset("--soft", "HEAD~1");
    }

    // Public API
    exports.pushToNewUpstream       = pushToNewUpstream;
    exports.getHistory              = getHistory;
    exports.getFileHistory          = getFileHistory;
    exports.resetIndex              = resetIndex;
    exports.discardAllChanges       = discardAllChanges;
    exports.isProjectRepositoryRoot = isProjectRepositoryRoot;
    exports.discardFileChanges      = discardFileChanges;
    exports.undoLastLocalCommit     = undoLastLocalCommit;
	exports.updateRepo				= updateRepo;
	exports.updateFile				= updateFile;

    Object.keys(SvnCli).forEach(function (method) {
        if (!exports[method]) {
            exports[method] = SvnCli[method];
        }
    });
});
