var path = require('path');

var R_DEFINE_SYNTAX = /\bdefine\s*\(\s*\[([^\]]*)\]\s*,\s*(function\s*\((?:[^\)]*)\)|\((?:[^\)]*)\)\s*=>)\s*{\s*|"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|`(?:[^\\`]|\\[\s\S])*`|\/\/[^\r\n\f]+|\/\*[\s\S]+?(?:\*\/|$)/g
var R_INSPIRE_SYNTAX = /\b(inspire|inspire\.\w+)(?:\s|\/\/[^\r\n\f]+|\/\*[\s\S]+?\*\/)*\(|"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|`(?:[^\\`]|\\[\s\S])*`|\/\/[^\r\n\f]+|\/\*[\s\S]+?(?:\*\/|$)/g
var R_COMMENT_SYNTAX = /\/\/[^\r\n\f]+|\/\*[\s\S]+?(?:\*\/|$)/g;

function parseArray(str) {
    str = str.replace(R_COMMENT_SYNTAX, '').replace(/(^\s*|\s*,?\s*$)/g, '');
    return str ? str.split(/\s*,\s*/) : [];
}

exports = module.exports = function(file, map) {
    var filePath = file.subpath;
    var fileDeps = map[filePath] || {};
    var fileContent = file.getContent();

    var inspires = [];
    // collect inspire call
    fileContent.replace(R_INSPIRE_SYNTAX, function(match, inspireStr) {
        if (inspireStr) {
            inspires.push(inspireStr);
        }

        return match;
    });

    // skip wrap
    if (inspires.length === 0 && Object.keys(fileDeps).length === 0) {
        return fileContent;
    }

    // has `define` syntax
    // inject inspire functions
    var hasDefine = false;

    // support inspire syntax
    fileContent = fileContent.replace(R_DEFINE_SYNTAX, function(match, depsStr, funStr) {
        if (typeof depsStr === 'undefined') return match;

        // skip multiple defines: define([], function(){define([], function(){})})
        if (hasDefine) return match;
        hasDefine = true;

        var isArrowFunction = !/^function/.test(funStr);
        var argsStr = funStr.match(/\(([^)]*)\)/)[1];

        var deps = parseArray(depsStr);
        var args = parseArray(argsStr);

        // error syntax: define(['foo'], (foo, bar) => {})
        if (args.length > deps.length) {
            fis.log.error(`amd require large then args in ${filePath}`);
        }

        // define(['foo', 'bar'], (foo) => {})
        while (args.length < deps.length) {
            args.push(`__enhance$$${args.length}`);
        }

        var enhanceMap = {};
        Object.keys(fileDeps).forEach(key => {
            var argName = `__enhance$$${args.length}`;
            deps.push(JSON.stringify(path.relative(filePath, key).replace(/^(\/|\.\.\/)/, './')));
            args.push(argName);
            enhanceMap[argName] = fileDeps[key];
        });

        inspires = inspires.filter((item, idx, arr) => arr.indexOf(item) === idx);

        var functionArgsStr = args.join(',');
        var enhanceArgsStr = Object.keys(enhanceMap).join(',');

        return `
        define(
            [${deps.join(',')}],
            ${(isArrowFunction ? `(${functionArgsStr}) =>` : `function(${functionArgsStr})`)} {
            var inspire = (function(${enhanceArgsStr}) {
                var def = function() {${generateInspire(enhanceMap)}};
                ${inspires.map(inspire => {
                    var name = inspire.split('.')[1];
                    return name ? `def.${name} = function() {${generateInspire(enhanceMap, name)}};` : '';
                }).join('\n')}
                return def;
        }(${enhanceArgsStr}));
        `;
    });

    if (!hasDefine) {
        fis.log.error(`error amd syntax in ${filePath}`);
    }

    return fileContent;
};

function generateInspire(map, name) {
    name = name || '';

    // map{ '' , '*' , 'name'}
    var enhanceSinMap = {}; // '' , 'name'
    var enhanceAllMap = {}; // '*'

    Object.keys(map).forEach(argName => {
        var enhanceRelation = map[argName];
        enhanceAllMap[argName] = enhanceRelation['*'] || [];
        enhanceSinMap[argName] = enhanceRelation[name] || [];
    });

    var args = [];
    Object.keys(enhanceSinMap).forEach(argName => enhanceSinMap[argName].forEach(attr => {
        args.push(`${argName} && ${argName}.enhance && ${argName}.enhance.${attr}`);
    }));
    Object.keys(enhanceAllMap).forEach(argName => enhanceAllMap[argName].forEach(attr => {
        args.push(`${argName} && ${argName}.enhance && ${argName}.enhance.${attr} ${
            name ? `&& ${argName}.enhance.${attr}.${name}` : ''
        }`);
    }));

    return `
    var funs = [${args.join(', ')}];
    for (var i = 0; i < funs.length; i++) {
        typeof funs[i] === 'function' && funs[i].apply(funs[i], arguments);
    }
    `;
}
