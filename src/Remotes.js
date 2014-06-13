define(function (require) {
    "use strict";

    // Brackets modules
    var DefaultDialogs  = brackets.getModule("widgets/DefaultDialogs"),
        Dialogs         = brackets.getModule("widgets/Dialogs"),
        StringUtils     = brackets.getModule("utils/StringUtils");

    // Local modules
    var ErrorHandler    = require("src/ErrorHandler"),
        Events          = require("src/Events"),
        EventEmitter    = require("src/EventEmitter"),
        Git             = require("src/svn/Svn"),
        Preferences     = require("src/Preferences"),
        ProgressDialog  = require("src/dialogs/Progress"),
        Promise         = require("bluebird"),
        PullDialog      = require("src/dialogs/Pull"),
        PushDialog      = require("src/dialogs/Push"),
        Strings         = require("strings"),
        Utils           = require("src/Utils");

    // Templates
    var gitRemotesPickerTemplate = require("text!templates/git-remotes-picker.html");

    // Module variables
    var $selectedRemote  = null,
        $remotesDropdown = null,
        $gitPanel = null;

    function initVariables() {
        $gitPanel = $("#git-panel");
        $selectedRemote = $gitPanel.find(".git-selected-remote");
        $remotesDropdown = $gitPanel.find(".git-remotes-dropdown");
    }

    // Implementation

    function getDefaultRemote() {
        var defaultRemotes = Preferences.get("defaultRemotes") || {};
        return defaultRemotes[Utils.getProjectRoot()] || "origin";
    }

    function setDefaultRemote(remoteName) {
        var defaultRemotes = Preferences.get("defaultRemotes") || {};
        defaultRemotes[Utils.getProjectRoot()] = remoteName;
        Preferences.persist("defaultRemotes", defaultRemotes);
    }

    function clearRemotePicker() {
        $selectedRemote
            .html("&mdash;")
            .data("remote", null);
    }

    function selectRemote(remoteName, type) {
        if (!remoteName) {
            return clearRemotePicker();
        }
        // Set as default remote only if is a normal git remote
        if (type === "git") { setDefaultRemote(remoteName); }

        // Disable pull if it is not a normal git remote
        $gitPanel.find("git-pull").prop("disabled", type !== "git");

        // Update remote name of $selectedRemote
        $selectedRemote
            .text(remoteName)
            .attr("data-type", type) // use attr to apply CSS styles
            .data("remote", remoteName);
    }

    function refreshRemotesPicker() {
        Git.getRemotes().then(function (remotes) {
            // Set default remote name and cache the remotes dropdown menu
            var defaultRemoteName    = getDefaultRemote();

            // Disable Git-push and Git-pull if there are not remotes defined
            $gitPanel
                .find(".git-pull, .git-push")
                .prop("disabled", remotes.length === 0);

            // Add options to change remote
            remotes.forEach(function (remote) {
                remote.deletable = remote.name !== "origin";
            });

            // Pass to Mustache the needed data
            var compiledTemplate = Mustache.render(gitRemotesPickerTemplate, {
                Strings: Strings,
                remotes: remotes
            });

            // Inject the rendered template inside the $remotesDropdown
            $remotesDropdown.html(compiledTemplate);

            // Notify others that they may add more stuff to this dropdown
            EventEmitter.emit(Events.REMOTES_REFRESH_PICKER);
            // TODO: is it possible to wait for listeners to finish?

            // TODO: if there're no remotes but there are some ftp remotes
            // we need to adjust that something other may be put as default
            // low priority
            if (remotes.length > 0) {
                selectRemote(defaultRemoteName, "git");
            } else {
                clearRemotePicker();
            }
        }).catch(function (err) {
            ErrorHandler.showError(err, "Getting remotes failed!");
        });
    }

    function handleRemoteCreation() {
        return Utils.askQuestion(Strings.CREATE_NEW_REMOTE, Strings.ENTER_REMOTE_NAME)
            .then(function (name) {
                return Utils.askQuestion(Strings.CREATE_NEW_REMOTE, Strings.ENTER_REMOTE_URL).then(function (url) {
                    return [name, url];
                });
            })
            .spread(function (name, url) {
                return Git.createRemote(name, url).then(function () {
                    return refreshRemotesPicker();
                });
            })
            .catch(function (err) {
                if (!ErrorHandler.equals(err, Strings.USER_ABORTED)) {
                    ErrorHandler.showError(err, "Remote creation failed");
                }
            });
    }

    function deleteRemote(remoteName) {
        return Utils.askQuestion(Strings.DELETE_REMOTE, StringUtils.format(Strings.DELETE_REMOTE_NAME, remoteName), { booleanResponse: true })
            .then(function (response) {
                if (response === true) {
                    return Git.deleteRemote(remoteName).then(function () {
                        return refreshRemotesPicker();
                    });
                }
            })
            .catch(function (err) {
                ErrorHandler.logError(err);
            });
    }

    function showPushResult(result) {
        var template = [
            "<h3>{{flagDescription}}</h3>",
            "Info:",
            "Remote url - {{remoteUrl}}",
            "Local branch - {{from}}",
            "Remote branch - {{to}}",
            "Summary - {{summary}}",
            "<h4>Status - {{status}}</h4>"
        ].join("<br>");

        Dialogs.showModalDialog(
            DefaultDialogs.DIALOG_ID_INFO,
            Strings.GIT_PUSH_RESPONSE, // title
            Mustache.render(template, result) // message
        );
    }

    // Event subscriptions
    EventEmitter.on(Events.SVN_ENABLED, function () {
        initVariables();
    });

});
