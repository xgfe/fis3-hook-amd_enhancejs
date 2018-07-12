# fis3-hook-amd_enhancejs
> AMD模块增强的fis3实现

- 自动引用模块
- 增强模块功能

## 使用
```js
fis.hook('amd_enhancejs', {
    // js文件名后缀，默认：['.js', '.coffee', '.jsx', '.es6']
    extList: [],

    // ...
    // 其他属性参照：fis3-hook-amd
});
```

## 语法
### support
模块自动依赖，被支持模块自动引用当前模块
```js
// 语法规则等同es6模块import
// support ... from 'path'

// 扩展 inspire()
// 增强 enhance.main
support main from './main'

// 扩展 inspire(), inspire.x(), ...
// 增强 enhance.all, enhance.all.x
support * as all from "./main"

// 扩展 inspire.foo(), inspire.bar()
// 增强 enhance.foo, enhance.mainBar
support {
    foo,
    bar as mainBar
} from './main'
```

### inspire
模块接口扩展，可在对应运行时机传递相关参数进行功能扩展（用于被支持模块）
```js
// 调用时扩展接口
// inspire(arg1, [...arg]);

define([], function() {
    var opt = {};
    var fun = () => {}

    inspire(opt, fun);

    setTimeout(function () {
        inspire.time(fun);
    }, 0);
});
```

**注意：不支持`inspire[name]()`, `inspire['name']()`调用**

### enhance
模块接口增强，扩展`support`引入的属性
```js
// 仅可增强声明过的属性
support api from 'api'

// 在api模块，inspire调用时运行
enhance.api = function(arg1, arg2) {};
```

**注意：`enhance.x`的赋值必须为函数**

## 注意
- 每一个文件为一个模块，即`define`一次
- 每个模块必须严格参照amd规范：`define([], function() {})`
