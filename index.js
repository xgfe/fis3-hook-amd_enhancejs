// TODO
// add require for packger
// watch support
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
    opts = opts || {};
    opts.baseUrl = opts.baseUrl || '/';

    fis.on('process:start', function(file) {
        if (!file.isJsLike) return;
        var filePath = file.subpath;
        COMPILE_FILE_MAP[file.subpath] = file;

        // injected enchance variable
        var supportInited = false;
        var supportFiles = {};

        var content = wrap(
            // add import relation
            file,
            SUPPORT_FILE_MAP,
            { baseUrl: opts.baseUrl }
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

            // support file relation
            var relation = supportFiles[supportFilePath] = supportFiles[supportFilePath] || {};
            Object.keys(supportEnhance).forEach(key => {
                var value = supportEnhance[key];

                // same key support multiple enhance
                relation[key] = relation[key] || [];
                if (relation[key].indexOf(value) < 0) {
                    relation[key].push(value);
                }
            });

            match = supportInited ? '' : '\nvar enhance = {};\n';

            // support * as all from 'path'
            // enhance.all = function() {};
            match += '\n' + (relation['*'] || []).map(attr => `enhance.${attr} = function() {};`).join('\n') + '\n';
            supportInited = true;
            return match;
        });

        var lastSupportRelation = SUPPORT_RELATION[filePath] || [];
        var currSupportRelation = SUPPORT_RELATION[filePath] = Object.keys(supportFiles);

        // check circular support
        var circularSupport = isCircularSupport(filePath, SUPPORT_RELATION);
        if (circularSupport) {
            return fis.log.error(`circular support in ${filePath}: ${[''].concat(circularSupport).join('\n--> ')}`);
        }

        // recompile support file
        lastSupportRelation.concat(currSupportRelation)
            .filter((item, idx, arr) => arr.indexOf(item) === idx)
            .forEach(supportFilePath => {
                // update relations for old/new support file
                var relations = SUPPORT_FILE_MAP[supportFilePath] = SUPPORT_FILE_MAP[supportFilePath] || {};
                relations[filePath] = supportFiles[supportFilePath];

                var file = COMPILE_FILE_MAP[supportFilePath];
                COMPILE_FILE_MAP[supportFilePath] = null;

                // file uncompile
                if (!file) return;

                file.useCache = false;
                fis.emit('compile:add', file);
            });

        // __amd('./uri')
        file.setContent(content.replace(/\b__amd\(([^)]+)\)/, function(match, uri) {
            return JSON.stringify(
                path.relative(
                    opts.baseUrl,
                    path.join(file.subdirname, fis.util.stringQuote(uri).rest)
                ).replace(/\.js$/, '')
            );
        }));
    });
};

exports.defaultOptions = {
    extList: ['.js', '.coffee', '.jsx', '.es6']
};


function isCircularSupport(supportPath, supportMap) {
  var stacks = [[supportPath]];
  var deps;
  while (deps = stacks.pop()) {
    var supports = supportMap[deps[0]] || [];
    for (var i = 0; i < supports.length; i++) {
      var dep = supports[i];
      if (deps.indexOf(dep) > -1) {
        return deps;
      } else {
        stacks.push([dep].concat(deps));
      }
    }
  }
  return false;
}

function isCircularSupportRecursive(supportPath, supportMap, stacks) {
  stacks = [supportPath].concat(stacks || []);
  var deps = supportMap[supportPath] || [];
  for (var i = 0; i < deps.length; i++) {
    if (stacks.indexOf(deps[i]) > -1) {
      return true;
    } else if (isCircularSupportRecursive(deps[i], supportMap, stacks)) {
      return true;
    }
  }
  return false;
}
