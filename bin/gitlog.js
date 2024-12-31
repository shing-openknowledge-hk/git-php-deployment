"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var node_child_process_1 = require("node:child_process");
var node_util_1 = require("node:util");
var fs_1 = require("fs");
var debug_1 = tslib_1.__importDefault(require("debug"));
var debug = (0, debug_1.default)("gitlog");
var execFilePromise = (0, node_util_1.promisify)(node_child_process_1.execFile);
var delimiter = "\x1E";
var fieldMap = {
    hash: "%H",
    abbrevHash: "%h",
    treeHash: "%T",
    abbrevTreeHash: "%t",
    parentHashes: "%P",
    abbrevParentHashes: "%P",
    authorName: "%an",
    authorEmail: "%ae",
    authorDate: "%ai",
    authorDateRel: "%ar",
    committerName: "%cn",
    committerEmail: "%ce",
    committerDate: "%cd",
    committerDateRel: "%cr",
    subject: "%s",
    body: "%b",
    rawBody: "%B",
    tag: "%D",
};
var notOptFields = ["status", "files"];
var defaultFields = [
    "abbrevHash",
    "hash",
    "subject",
    "authorName",
    "authorDate",
];
var defaultOptions = {
    number: 10,
    fields: defaultFields,
    nameStatus: true,
    includeMergeCommitFiles: false,
    follow: false,
    findCopiesHarder: false,
    all: false,
};
/** Add optional parameter to command */
function addOptionalArguments(command, options) {
    var commandWithOptions = command;
    var cmdOptional = [
        "author",
        "since",
        "after",
        "until",
        "before",
        "committer",
    ];
    for (var i = cmdOptional.length; i--;) {
        if (options[cmdOptional[i]]) {
            commandWithOptions.push("--".concat(cmdOptional[i], "=").concat(options[cmdOptional[i]]));
        }
    }
    return commandWithOptions;
}
/** Parse the output of "git log" for commit information */
var parseCommits = function (commits, fields, nameStatus) {
    return commits.map(function (rawCommit) {
        var parts = rawCommit.split("@end@");
        var commit = parts[0].split(delimiter);
        if (parts[1]) {
            var parseNameStatus = parts[1].trimLeft().split("\n");
            // Removes last empty char if exists
            if (parseNameStatus[parseNameStatus.length - 1] === "") {
                parseNameStatus.pop();
            }
            // Split each line into it's own delimited array
            // Using tab character here because the name status output is always tab separated
            var nameAndStatusDelimited = parseNameStatus.map(function (d) { return d.split("\t"); });
            // 0 will always be status, last will be the filename as it is in the commit,
            // anything in between could be the old name if renamed or copied
            nameAndStatusDelimited.forEach(function (item) {
                var status = item[0];
                var tempArr = [status, item[item.length - 1]];
                // If any files in between loop through them
                for (var i = 1, len = item.length - 1; i < len; i++) {
                    // If status R then add the old filename as a deleted file + status
                    // Other potentials are C for copied but this wouldn't require the original deleting
                    if (status.slice(0, 1) === "R") {
                        tempArr.push("D", item[i]);
                    }
                }
                commit.push.apply(commit, tempArr);
            });
        }
        debug("commit", commit);
        // Remove the first empty char from the array
        commit.shift();
        var parsed = {};
        if (nameStatus) {
            // Create arrays for non optional fields if turned on
            notOptFields.forEach(function (d) {
                parsed[d] = [];
            });
        }
        commit.forEach(function (commitField, index) {
            if (fields[index]) {
                parsed[fields[index]] = commitField;
            }
            else if (nameStatus) {
                var pos = (index - fields.length) % notOptFields.length;
                debug("nameStatus", index - fields.length, notOptFields.length, pos, commitField);
                var arr = parsed[notOptFields[pos]];
                if (Array.isArray(arr)) {
                    arr.push(commitField);
                }
            }
        });
        return parsed;
    });
};
/** Run "git log" and return the result as JSON */
function createCommandArguments(options) {
    // Start constructing command
    var command = ["log", "-l0"];
    if (options.findCopiesHarder) {
        command.push("--find-copies-harder");
    }
    if (options.all) {
        command.push("--all");
    }
    if (options.includeMergeCommitFiles) {
        command.push("-m");
    }
    if (options.follow) {
        command.push("--follow");
    }
    command.push("-n ".concat(options.number));
    command = addOptionalArguments(command, options);
    // Start of custom format
    var prettyArgument = "--pretty=@begin@";
    // Iterating through the fields and adding them to the custom format
    if (options.fields) {
        options.fields.forEach(function (field) {
            if (!fieldMap[field] && !notOptFields.includes(field)) {
                throw new Error("Unknown field: ".concat(field));
            }
            prettyArgument += delimiter + fieldMap[field];
        });
    }
    // Close custom format
    prettyArgument += "@end@";
    command.push(prettyArgument);
    // Append branch (revision range) if specified
    if (options.branch) {
        command.push(options.branch);
    }
    // File and file status
    if (options.nameStatus && !options.fileLineRange) {
        command.push("--name-status");
    }
    if (options.fileLineRange) {
        command.push("-L ".concat(options.fileLineRange.startLine, ",").concat(options.fileLineRange.endLine, ":").concat(options.fileLineRange.file));
    }
    if (options.file) {
        command.push("--");
        command.push(options.file);
    }
    debug("command", options.execOptions, command);
    return command;
}
function gitlog(userOptions) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var options, execOptions, commandArguments, stdout, commits;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!userOptions.repo) {
                        throw new Error("Repo required!");
                    }
                    if (!(0, fs_1.existsSync)(userOptions.repo)) {
                        throw new Error("Repo location does not exist");
                    }
                    options = tslib_1.__assign(tslib_1.__assign({}, defaultOptions), userOptions);
                    execOptions = tslib_1.__assign({ cwd: userOptions.repo }, userOptions.execOptions);
                    commandArguments = createCommandArguments(options);
                    return [4 /*yield*/, execFilePromise("git", commandArguments, execOptions)];
                case 1:
                    stdout = (_a.sent()).stdout;
                    commits = stdout.split("@begin@");
                    if (commits[0] === "") {
                        commits.shift();
                    }
                    debug("commits", commits);
                    return [2 /*return*/, parseCommits(commits, options.fields, options.nameStatus)];
            }
        });
    });
}
exports.default = gitlog;
//# sourceMappingURL=index2.js.map