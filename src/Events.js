define(function (require, exports) {
    "use strict";

    /**
     * List of Events to be used in the extension.
     * Events should be structured by file who emits them.
     */

    // Brackets events
    exports.BRACKETS_CURRENT_DOCUMENT_CHANGE = "brackets.current.document.change";
    exports.BRACKETS_PROJECT_CHANGE = "brackets.project.change";
    exports.BRACKETS_PROJECT_REFRESH = "brackets.project.refresh";
    exports.BRACKETS_DOCUMENT_SAVED = "brackets.document.saved";
    exports.HANDLE_PROJECT_REFRESH = "handle.project.refresh";
    exports.BRACKETS_FILE_CHANGED = "brackets.file.changed";

    // Git events
    exports.GIT_EMAIL_CHANGED = "git.email.changed";
    exports.GIT_COMMITED = "git.commited";

    // Startup events
    exports.REFRESH_ALL = "git.refresh.all";
    exports.GIT_ENABLED = "git.enabled";
    exports.GIT_DISABLED = "git.disabled";
    exports.REBASE_MERGE_MODE = "rebase.merge.mode";

    // Panel.js
    exports.HANDLE_GIT_INIT = "handle.git.init";
    exports.HANDLE_GIT_CLONE = "handle.git.clone";
    exports.HANDLE_GIT_COMMIT = "handle.git.commit";
    exports.HANDLE_PUSH = "handle.push";
    exports.HANDLE_PULL = "handle.pull";
    exports.HANDLE_REMOTE_PICK = "handle.remote.pick";
    exports.HANDLE_REMOTE_DELETE = "handle.remote.delete";
    exports.HANDLE_REMOTE_CREATE = "handle.remote.create";
    exports.HISTORY_SHOW = "history.show";

    // Git results
    exports.GIT_STATUS_RESULTS = "git.status.results";

    // utils/Terminal.js
    exports.TERMINAL_OPEN = "terminal.open";
});
