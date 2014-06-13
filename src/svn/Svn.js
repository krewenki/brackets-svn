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

    function getMergeInfo() {
        var baseCheck  = ["MERGE_MODE", "rebase-apply"],
            mergeCheck = ["MERGE_HEAD", "MERGE_MSG"],
            rebaseCheck = ["rebase-apply/next", "rebase-apply/last", "rebase-apply/head-name"],
            gitFolder  = Utils.getProjectRoot() + "/.git/";

        return Promise.all(baseCheck.map(function (fileName) {
            return Utils.loadPathContent(gitFolder + fileName);
        })).spread(function (mergeMode, rebaseMode) {
            var obj = {
                mergeMode: mergeMode !== null,
                rebaseMode: rebaseMode !== null
            };
            if (obj.mergeMode) {

                return Promise.all(mergeCheck.map(function (fileName) {
                    return Utils.loadPathContent(gitFolder + fileName);
                })).spread(function (head, msg) {

                    if (head) {
                        obj.mergeHead = head.trim();
                    }
                    var msgSplit = msg ? msg.trim().split(/conflicts:/i) : [];
                    if (msgSplit[0]) {
                        obj.mergeMessage = msgSplit[0].trim();
                    }
                    if (msgSplit[1]) {
                        obj.mergeConflicts = msgSplit[1].trim().split("\n").map(function (line) { return line.trim(); });
                    }
                    return obj;

                });

            }
            if (obj.rebaseMode) {

                return Promise.all(rebaseCheck.map(function (fileName) {
                    return Utils.loadPathContent(gitFolder + fileName);
                })).spread(function (next, last, head) {

                    if (next) { obj.rebaseNext = next.trim(); }
                    if (last) { obj.rebaseLast = last.trim(); }
                    if (head) { obj.rebaseHead = head.trim().substring("refs/heads/".length); }
                    return obj;

                });

            }
            return obj;
        });
    }

    function discardFileChanges(file) {
        return SvnCli.revert(file);
    }

    function pushForced(remote, branch) {
        return SvnCli.push(remote, branch, ["--force"]);
    }

    function deleteRemoteBranch(remote, branch) {
        return SvnCli.push(remote, branch, ["--delete"]);
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
    exports.getMergeInfo            = getMergeInfo;
    exports.discardFileChanges      = discardFileChanges;
    exports.pushForced              = pushForced;
    exports.deleteRemoteBranch      = deleteRemoteBranch;
    exports.undoLastLocalCommit     = undoLastLocalCommit;
	exports.updateRepo				= updateRepo;
	exports.updateFile				= updateFile;

    Object.keys(SvnCli).forEach(function (method) {
        if (!exports[method]) {
            exports[method] = SvnCli[method];
        }
    });
});
