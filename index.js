// TODO watch support
var path = require('path');
var lookup = require('./lib/lookup');
var parse = require('./lib/parse');
var wrap = require('./lib/wrap');

/*
 * syntax
 *   support - like import module
 *     support main from 'path'
 *     support * as all from "path"
 *     support { foo, bar as mainBar } from `path`
 *
 *   enhance
 *
 *   inspire
 */
var R_SUPPORT_SYNTAX = /\bsupport\s+(\w+|\*\s+as\s+\w+|{[^}]+})\s+from\s+("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|`(?:[^\\`\n\r\f]|\\[\s\S])*`)\s*|"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|`(?:[^\\`]|\\[\s\S])*`|\/\/[^\r\n\f]+|\/\*[\s\S]+?(?:\*\/|$)/g;


var COMPILE_FILE_MAP = {}; // files of compiled
var SUPPORT_FILE_MAP = {}; // enhance names of support file
var SUPPORT_RELATION = {}; // relations of support file

exports = module.exports = function (fis, opts) {
    fis.on('process:start', function(file) {
        if (!file.isJsLike) return;
        var filePath = file.subpath;
        COMPILE_FILE_MAP[file.subpath] = file;

        // injected enchance variable
        var supportInited = false;
        var supportFiles = [];

        var content = wrap(
            // add import relation
            file,
            SUPPORT_FILE_MAP
        ).replace(R_SUPPORT_SYNTAX, function(match, supportEnhance, supportPath) {
            if (!supportEnhance) return match;

            supportEnhance = parse.support(supportEnhance);
            if (!supportEnhance) {
                fis.log.error(`error support syntax: ${match}`);
                return match;
            }

            supportPath = fis.util.stringQuote(supportPath, '\'`"').rest;
            supportInfo = lookup.init(fis, opts)(fis.util.pathinfo(supportPath), file);
            if (!supportInfo.file || !supportInfo.file.subpath) {
                fis.log.error(`unable to find ${supportInfo.rest} in ${filePath}.`);
                return match;
            }

            var supportFile = supportInfo.file;
            var supportFilePath = supportFile.subpath;

            // recompile support file
            supportFiles.push(supportFilePath);

            // all relations of support file
            var relations = SUPPORT_FILE_MAP[supportFilePath] = SUPPORT_FILE_MAP[supportFilePath] || {};
            // current file relation of supportFile
            var relation = relations[filePath] = relations[filePath] || {};

            Object.keys(supportEnhance).forEach(key => {
                var value = supportEnhance[key];

                // same key support multiple enhance
                relation[key] = relation[key] || [];
                if (relation[key].indexOf(value) < 0) {
                    relation[key].push(value);
                }
            });

            // TODO support * as all from 'path'
            // enhance.all = function() {};
            match = supportInited ? '' : '\nvar enhance = {};\n';
            supportInited = true;
            return match;
        });

        // remove duplicate
        SUPPORT_RELATION[filePath] = supportFiles.filter((item, idx, arr) => arr.indexOf(item) === idx);

        // check circular support
        var circularSupport = isCircularSupport(filePath, SUPPORT_RELATION);
        if (circularSupport) {
            return fis.log.error(`circular support in ${circularSupport}`);
        }

        // recompile support file
        SUPPORT_RELATION[filePath].forEach(supportFilePath => {
            var file = COMPILE_FILE_MAP[supportFilePath];
            COMPILE_FILE_MAP[supportFilePath] = null;

            // file uncompile
            if (!file) return;

            file.useCache = false;
            fis.emit('compile:add', file);
        });

        file.setContent(content);
    });
};

exports.defaultOptions = {
    extList: ['.js', '.coffee', '.jsx', '.es6']
};

// TODO cycle
function isCircularSupport(supportPath, supportMap) {
    return false;
}
