define(function (require, exports) {
    "use strict";

    var _                       = brackets.getModule("thirdparty/lodash"),
        CommandManager          = brackets.getModule("command/CommandManager"),
        Dialogs                 = brackets.getModule("widgets/Dialogs"),
        EditorManager           = brackets.getModule("editor/EditorManager"),
        Menus                   = brackets.getModule("command/Menus"),
        PopUpManager            = brackets.getModule("widgets/PopUpManager"),
        StringUtils             = brackets.getModule("utils/StringUtils"),
        SidebarView             = brackets.getModule("project/SidebarView"),
        DocumentManager         = brackets.getModule("document/DocumentManager");

    var Git                     = require("src/git/Git"),
        Events                  = require("src/Events"),
        EventEmitter            = require("src/EventEmitter"),
        ErrorHandler            = require("./ErrorHandler"),
        Panel                   = require("./Panel"),
        ProgressDialog          = require("src/dialogs/Progress"),
        Strings                 = require("../strings"),
        Utils                   = require("./Utils"),
        branchesMenuTemplate    = require("text!templates/git-branches-menu.html"),
        newBranchTemplate       = require("text!templates/branch-new-dialog.html"),
        mergeBranchTemplate     = require("text!templates/branch-merge-dialog.html");

    var $gitBranchName          = $(null),
        currentEditor,
        $dropdown;

    function renderList(branches) {
        branches = branches.map(function (name) {
            return {
                name: name,
                currentBranch: name.indexOf("* ") === 0,
                canDelete: name !== "master"
            };
        });
        var templateVars  = {
            branchList: _.filter(branches, function (o) { return !o.currentBranch; }),
            Strings:    Strings
        };
        return Mustache.render(branchesMenuTemplate, templateVars);
    }

    function closeDropdown() {
        if ($dropdown) {
            PopUpManager.removePopUp($dropdown);
        }
        detachCloseEvents();
    }

    function doMerge(fromBranch) {
        Git.getBranches().then(function (branches) {

            var compiledTemplate = Mustache.render(mergeBranchTemplate, {
                fromBranch: fromBranch,
                branches: branches,
                Strings: Strings
            });

            var dialog  = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
            var $dialog = dialog.getElement();
            $dialog.find("input").focus();

            var $toBranch = $dialog.find("[name='branch-target']");
            var $useRebase = $dialog.find("[name='use-rebase']");
            if (fromBranch === "master") {
                $useRebase.prop("checked", true);
            }
            if ($toBranch.val() === "master") {
                $useRebase.prop("checked", false).prop("disabled", true);
            }

            var $mergeMessage = $dialog.find("[name='merge-message']");
            $mergeMessage.attr("placeholder", "Merge branch '" + fromBranch + "'");
            $dialog.find(".fill-pr").on("click", function () {
                var prMsg = "Merge pull request #??? from " + fromBranch;
                $mergeMessage.val(prMsg);
                $mergeMessage[0].setSelectionRange(prMsg.indexOf("???"), prMsg.indexOf("???") + 3);
            });

            dialog.done(function (buttonId) {
                if (buttonId === "ok") {
                    // right now only merge to current branch without any configuration
                    // later delete merge branch and so ...
                    var useRebase = $useRebase.prop("checked");
                    var mergeMsg = $mergeMessage.val();

                    if (useRebase) {

                        Git.rebaseInit(fromBranch).catch(function (err) {
                            throw ErrorHandler.showError(err, "Rebase failed");
                        }).then(function (stdout) {
                            Utils.showOutput(stdout, Strings.REBASE_RESULT);
                            EventEmitter.emit(Events.REFRESH_ALL);
                        });

                    } else {

                        Git.mergeBranch(fromBranch, mergeMsg).catch(function (err) {
                            throw ErrorHandler.showError(err, "Merge failed");
                        }).then(function (stdout) {
                            Utils.showOutput(stdout, Strings.MERGE_RESULT);
                            EventEmitter.emit(Events.REFRESH_ALL);
                        });

                    }
                }
            });
        });
    }

    function _reloadBranchSelect($el, branches) {
        var template = "{{#branches}}<option value='{{name}}' remote='{{remote}}' " +
            "{{#currentBranch}}selected{{/currentBranch}}>{{name}}</option>{{/branches}}";
        var html = Mustache.render(template, { branches: branches });
        $el.html(html);
    }

    function closeNotExistingFiles(oldBranchName, newBranchName) {
        return Git.getDeletedFiles(oldBranchName, newBranchName).then(function (deletedFiles) {
            var projectRoot = Utils.getProjectRoot(),
                openedFiles = DocumentManager.getWorkingSet();
            // Close files that does not exists anymore in the new selected branch
            deletedFiles.forEach(function (dFile) {
                var oFile = _.find(openedFiles, function (oFile) {
                    return oFile.fullPath == projectRoot + dFile;
                });
                if (oFile) {
                    DocumentManager.closeFullEditor(oFile);
                }
            });
            EventEmitter.emit(Events.REFRESH_ALL);
        }).catch(function (err) {
            ErrorHandler.showError(err, "Getting list of deleted files failed.");
        });
    }

    function handleEvents() {
        $dropdown.on("click", "a.git-branch-new", function (e) {
            e.stopPropagation();

            Git.getAllBranches().catch(function (err) {
                ErrorHandler.showError(err);
            }).then(function (branches) {

                var compiledTemplate = Mustache.render(newBranchTemplate, {
                    branches: branches,
                    Strings: Strings
                });

                var dialog  = Dialogs.showModalDialogUsingTemplate(compiledTemplate);

                var $input  = dialog.getElement().find("[name='branch-name']"),
                    $select = dialog.getElement().find(".branchSelect");

                $select.on("change", function () {
                    if (!$input.val()) {
                        var $opt = $select.find(":selected"),
                            remote = $opt.attr("remote"),
                            newVal = $opt.val();
                        if (remote) {
                            newVal = newVal.substring(remote.length + 1);
                            if (remote !== "origin") {
                                newVal = remote + "#" + newVal;
                            }
                        }
                        $input.val(newVal);
                    }
                });

                _reloadBranchSelect($select, branches);
                dialog.getElement().find(".fetchBranches").on("click", function () {
                    var $this = $(this);
                    ProgressDialog.show(Git.fetchAllRemotes())
                        .then(function () {
                            return Git.getAllBranches().then(function (branches) {
                                $this.prop("disabled", true).attr("title", "Already fetched");
                                _reloadBranchSelect($select, branches);
                            });
                        }).catch(function (err) {
                            throw ErrorHandler.showError(err, "Fetching remote information failed");
                        });
                });

                dialog.getElement().find("input").focus();
                dialog.done(function (buttonId) {
                    if (buttonId === "ok") {

                        var $dialog     = dialog.getElement(),
                            branchName  = $dialog.find("input[name='branch-name']").val().trim(),
                            $option     = $dialog.find("select[name='branch-origin']").children("option:selected"),
                            originName  = $option.val(),
                            isRemote    = $option.attr("remote"),
                            track       = !!isRemote;

                        Git.createBranch(branchName, originName, track).catch(function (err) {
                            ErrorHandler.showError(err, "Creating new branch failed");
                        }).then(function () {
                            closeDropdown();
                            EventEmitter.emit(Events.REFRESH_ALL);
                        });
                    }
                });
            });

        }).on("click", "a.git-branch-link .switch-branch", function (e) {
            e.stopPropagation();
            var newBranchName = $(this).parent().data("branch");
            return Git.getCurrentBranchName().then(function (oldBranchName) {
                Git.checkout(newBranchName).then(function () {
                    closeDropdown();
                    return closeNotExistingFiles(oldBranchName, newBranchName);

                }).catch(function (err) { ErrorHandler.showError(err, "Switching branches failed."); });
            }).catch(function (err) { ErrorHandler.showError(err, "Getting current branch name failed."); });

        }).on("mouseenter", "a", function () {
            $(this).addClass("selected");
        }).on("mouseleave", "a", function () {
            $(this).removeClass("selected");
        }).on("click", "a.git-branch-link .trash-icon", function () {

            var branchName = $(this).parent().data("branch");
            Utils.askQuestion(Strings.DELETE_LOCAL_BRANCH,
                              StringUtils.format(Strings.DELETE_LOCAL_BRANCH_NAME, branchName),
                              { booleanResponse: true })
                .then(function (response) {
                    if (response === true) {
                        return Git.branchDelete(branchName).catch(function (err) {

                            return Utils.showOutput(err, "Branch deletion failed", {
                                question: "Do you wish to force branch deletion?"
                            }).then(function (response) {
                                if (response === true) {
                                    return Git.forceBranchDelete(branchName).then(function (output) {
                                        return Utils.showOutput(output);
                                    }).catch(function (err) {
                                        ErrorHandler.showError(err, "Forced branch deletion failed");
                                    });
                                }
                            });

                        });
                    }
                })
                .catch(function (err) {
                    ErrorHandler.showError(err);
                });

        }).on("click", ".merge-branch", function () {
            var fromBranch = $(this).parent().data("branch");
            doMerge(fromBranch);
        });
    }

    function attachCloseEvents() {
        $("html").on("click", closeDropdown);
        $("#project-files-container").on("scroll", closeDropdown);
        $(SidebarView).on("hide", closeDropdown);
        $("#titlebar .nav").on("click", closeDropdown);

        currentEditor = EditorManager.getCurrentFullEditor();
        if (currentEditor) {
            currentEditor._codeMirror.on("focus", closeDropdown);
        }

        // $(window).on("keydown", keydownHook);
    }

    function detachCloseEvents() {
        $("html").off("click", closeDropdown);
        $("#project-files-container").off("scroll", closeDropdown);
        $(SidebarView).off("hide", closeDropdown);
        $("#titlebar .nav").off("click", closeDropdown);

        if (currentEditor) {
            currentEditor._codeMirror.off("focus", closeDropdown);
        }

        // $(window).off("keydown", keydownHook);

        $dropdown = null;
        EditorManager.focusEditor();
    }

    function toggleDropdown(e) {
        e.stopPropagation();

        // If the dropdown is already visible, close it
        if ($dropdown) {
            closeDropdown();
            return;
        }

        Menus.closeAll();

        Git.getBranches().catch(function (err) {
            ErrorHandler.showError(err, "Getting branch list failed");
        }).then(function (branches) {
            branches = branches.reduce(function (arr, branch) {
                if (!branch.currentBranch && !branch.remote) {
                    arr.push(branch.name);
                }
                return arr;
            }, []);

            $dropdown = $(renderList(branches));

            var toggleOffset = $gitBranchName.offset();
            $dropdown
                .css({
                    left: toggleOffset.left,
                    top: toggleOffset.top + $gitBranchName.outerHeight()
                })
                .appendTo($("body"));

            PopUpManager.addPopUp($dropdown, detachCloseEvents, true);
            attachCloseEvents();
            handleEvents();
        });
    }

    function refresh() {
        if ($gitBranchName.length === 0) { return; }

        // show info that branch is refreshing currently
        $gitBranchName
            .text("\u2026")
            .parent()
                .show();

        return Git.isProjectRepositoryRoot().then(function (isRepositoryRoot) {
            $gitBranchName.parent().toggle(isRepositoryRoot);

            if (!isRepositoryRoot) {
                $gitBranchName
                    .off("click")
                    .text("not a git repo");
                Panel.disable("not-repo");
                return;
            }

            return Git.getCurrentBranchName().then(function (branchName) {

                Git.getMergeInfo().then(function (mergeInfo) {

                    if (mergeInfo.mergeMode) {
                        branchName += "|MERGING";
                    }

                    if (mergeInfo.rebaseMode) {
                        if (mergeInfo.rebaseHead) {
                            branchName = mergeInfo.rebaseHead;
                        }
                        branchName += "|REBASE";
                        if (mergeInfo.rebaseNext && mergeInfo.rebaseLast) {
                            branchName += "(" + mergeInfo.rebaseNext + "/" + mergeInfo.rebaseLast + ")";
                        }
                    }

                    EventEmitter.emit(Events.REBASE_MERGE_MODE, mergeInfo.rebaseMode, mergeInfo.mergeMode);

                    $gitBranchName
                        .text(branchName)
                        .attr("title", branchName.length > 15 ? branchName : null)
                        .off("click")
                        .on("click", toggleDropdown)
                        .append($("<span class='dropdown-arrow' />"));
                    Panel.enable();

                }).catch(function (err) {
                    ErrorHandler.showError(err, "Reading .git state failed");
                });

            }).catch(function (ex) {
                if (ErrorHandler.contains(ex, "unknown revision")) {
                    $gitBranchName
                        .off("click")
                        .text("no branch");
                    Panel.enable();
                } else {
                    throw ex;
                }
            });
        }).catch(function (err) {
            throw ErrorHandler.showError(err);
        });
    }

    function init() {
        // Add branch name to project tree
        $gitBranchName = $("<span id='git-branch'></span>");
        $("<div id='git-branch-dropdown-toggle' class='btn-alt-quiet'></div>")
            .append("[ ")
            .append($gitBranchName)
            .append(" ]")
            .on("click", function () {
                $gitBranchName.click();
                return false;
            })
            .appendTo("#project-files-header");
        refresh();
    }

    EventEmitter.on(Events.REFRESH_ALL, function () {
        CommandManager.execute("file.refresh");
        refresh();
    });

    EventEmitter.on(Events.BRACKETS_PROJECT_CHANGE, function () {
        refresh();
    });

    EventEmitter.on(Events.BRACKETS_PROJECT_REFRESH, function () {
        refresh();
    });

    exports.init    = init;
    exports.refresh = refresh;

});
