var R_VAR = /^\w+$/;


// TODO suppport { default as main } from 'path'
exports.support = function (str) {
    str = String(str).trim();

    // syntax: support main from 'path'
    if (/^\w+$/.test(str)) {
        return {
            '': str
        };
    }

    // { foo } => foo
    str = str.replace(/^{|}$/g, '');

    // { }
    if (!str) return null;

    // support relation map
    var map = {};

    // enhance attrs to array
    var enhances = str.split(/\s*,\s*/).filter(s => s).map(s => s.trim().split(/\s*as\s*/));

    for (var i = 0; i < enhances.length; i++) {
        var key = enhances[i][0];
        var value = enhances[i][1] || key; // { foo } same as { foo as foo }

        // error syntax: support { foo, * as main } from 'path'
        if (key === '*' && enhances.length > 1) {
            return null;
        }

        // error syntax: variable must be \w
        if (!((key === '*' || R_VAR.test(key)) && R_VAR.test(value))) {
            return null;
        }

        map[key === 'default' ? '' : key] = value;
    }

    return map;
};
