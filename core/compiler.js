const { SyncHook } = require('tapable')
const path = require('path')
const fs = require('fs')
const { toUnixPath, tryExtensions, getSourceCode } = require('./utils')
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const t = require('@babel/types');

// compiler.js
// Compiler类进行核心编译实现
class Compiler {
    constructor(options) {
        this.options = options

        // 相对路径跟路径 Context参数
        this.rootPath = this.options.context || toUnixPath(process.cwd());
        // create plugin hooks
        this.hooks = {
            // run compiler hook
            run: new SyncHook(),
            // 输出 asset 到 output 目录之前执行 (写入文件之前)
            emit: new SyncHook(),
            // 在 compilation 完成时执行 全部完成编译执行
            done: new SyncHook()
        }


        // 保存所有入口模块对象
        this.entries = new Set();
        // 保存所有依赖模块对象
        this.modules = new Set();
        // 所有的代码块对象
        this.chunks = new Set();
        // 存放本次产出的文件对象
        this.assets = new Set();
        // 存放本次编译所有产出的文件名
        this.files = new Set();
    }

    // run方法启动编译 
    // 同时run方法接受外部传递的callback
    run(callback) {
        // 当调用run方式时 触发开始编译的plugin
        this.hooks.run.call()
        // get entry config obj
        const entry = this.getEntry()
        // 编译入口文件
        this.buildEntryModule(entry);
        // 导出列表;之后将每个chunk转化称为单独的文件加入到输出列表assets中
        this.exportFile(callback);
    }
    // 将chunk加入输出列表中去
    exportFile(callback) {
        const output = this.options.output
        // 根据chunks生成assets内容
        this.chunks.forEach(chunk => {
            const parseFileName = output.fileName.replace('[name]', chunk.name)
            // assets中 { 'main.js': '生成的字符串代码...' }
            this.assets[parseFileName] = getSourceCode(chunk);
        })

        this.hooks.emit.call()
        // 先判断目录是否存在 存在直接fs.write 不存在则首先创建
        if (!fs.existsSync(output.path)) {
            fs.mkdirSync(output.path)
        }
        // files中保存所有的生成文件名
        this.files = Object.keys(this.assets)
        // 将assets中的内容生成打包文件 写入文件系统中
        Object.keys(this.assets).forEach(fileName => {
            const filePath = path.join(output.path, fileName)
            fs.writeFileSync(filePath, this.assets[fileName])
        })
        // 结束之后触发钩子
        this.hooks.done.call()
        callback(null, {
            toJson: () => {
                return {
                    entries: this.entries,
                    modules: this.modules,
                    files: this.files,
                    chunks: this.chunks,
                    assets: this.assets,
                }
            }
        })
    }

    buildEntryModule(entry) {
        for (const [entryName, entryPath] of Object.entries(entry)) {
            const entryObj = this.buildModule(entryName, entryPath)
            this.entries.add(entryObj)
            // 根据当前入口文件和模块的相互依赖关系，组装成为一个个包含当前入口所有依赖模块的chunk
            this.buildUpChunk(entryName, entryObj);
        }
        // console.log('this.entries', this.entries);
        // console.log('this.modules', this.modules);
        // console.log('this.chunks', this.chunks);
    }


    // 根据入口文件和依赖模块组装chunks
    buildUpChunk(entryName, entryObj) {
        const chunks = {
            // 每一个入口文件作为一个chunk
            name: entryName,
            // entry编译后的对象
            entryModule: entryObj,
            // 寻找与当前entry有关的所有module
            modules: Array.from(this.modules).filter(i => i.name.includes(entryName)),
        }
        // 将chunk添加到this.chunks中去
        this.chunks.add(chunks)

    }


    // 模块编译方法
    buildModule(moduleName, modulePath) {
        // 1.read file source code
        const originSourceCode = this.originSourceCode = fs.readFileSync(modulePath, 'utf-8')

        // moduleCode edit after code 
        this.moduleCode = originSourceCode


        //  2. 调用loader进行处理
        this.handleLoader(modulePath);
        // 3. 调用webpack 进行模块编译 获得最终的module对象
        const module = this.handleWebpackCompiler(moduleName, modulePath);
        // 4. 返回对应module
        return module

    }
    // 调用webpack进行模块编译
    handleWebpackCompiler(moduleName, modulePath) {
        // 将当前模块相对于项目启动根目录计算出相对路径 作为模块ID
        // ./example/src/entry2.js
        const moduleId = './' + path.posix.relative(this.rootPath, modulePath)

        // 创建模块对象
        const module = {
            id: moduleId,
            dependencies: new Set(),  // 该模块所依赖模块绝对路径地址
            name: [moduleName], // 该模块所属的入口文件
        }
        // 调用babel分析我们的代码
        const ast = parser.parse(this.moduleCode, {
            sourceType: "module"
        })

        // 深度优先 遍历语法Tree
        traverse(ast, {
            // 当遇到require语句时
            CallExpression: (nodePath) => {
                const node = nodePath.node
                if (node.callee.name === 'require') {
                    // get 源代码中引入模块相对路径
                    const requirePath = node.arguments[0].value;
                    // 寻找模块绝对路径 当前模块路径+require()对应相对路径
                    const moduleDirName = path.posix.dirname(modulePath)
                    const absolutePath = tryExtensions(
                        path.posix.join(moduleDirName, requirePath),
                        this.options.resolve.extensions,
                        requirePath,
                        moduleDirName
                    )
                    // 生成moduleId - 针对于跟路径的模块ID 添加进入新的依赖模块路径
                    const moduleId =
                        './' + path.posix.relative(this.rootPath, absolutePath)
                    // 通过babel修改源代码中的require变成__webpack_require__语句
                    node.callee = t.identifier('__webpack_require__');
                    // 修改源代码中require语句引入的模块 全部修改变为相对于跟路径来处理
                    node.arguments = [t.stringLiteral(moduleId)];
                    // 转化为ids的数组 好处理
                    const alreadyModules = Array.from(this.modules).map(i => i.id)
                    if (!alreadyModules.includes(moduleId)) {
                        // 为当前模块添加require语句造成的依赖(内容为相对于根路径的模块ID)
                        module.dependencies.add(moduleId);
                    } else {
                        this.modules.forEach(value => {
                            if (value.id === moduleId) {
                                value.name.push(moduleName)
                            }
                        })
                    }
                }
            }
        })
        // 遍历结束根据AST生成新的代码
        const { code } = generator(ast);
        // 为当前模块挂载新的生成的代码
        module._source = code;
        // 递归依赖深度遍历 存在依赖模块则加入
        module.dependencies.forEach((dependency) => {
            const depModule = this.buildModule(moduleName, dependency);
            // 将编译后的任何依赖模块对象加入到modules对象中去
            this.modules.add(depModule);
        });
        // 返回当前模块对象
        return module
    }

    // 匹配loader处理
    handleLoader(modulePath) {
        const matchLoaders = []
        // 1. get all loader rules
        const rules = this.options.module.rules
        rules.forEach(loader => {
            const testRule = loader.test
            if (testRule.test(modulePath)) {
                if (loader.loader) {
                    // 仅考虑loader { test:/\.js$/g, use:['babel-loader'] }, { test:/\.js$/, loader:'babel-loader' }
                    matchLoaders.push(loader.loader)
                } else {
                    matchLoaders.push(...loader.use)
                }
            }
        })
        // for 
        for (let len = matchLoaders.length, i = len - 1; i >= 0; i--) {
            // 目前我们外部仅支持传入绝对路径的loader模式
            // require引入对应loader
            const loaderFn = require(matchLoaders[i])
            // 通过loader同步处理我的每一次编译的moduleCode
            this.moduleCode = loaderFn(this.moduleCode)
        }
    }

    getEntry() {
        let entry = Object.create(null)
        const { entry: optionsEntry } = this.options
        if (typeof optionsEntry === 'string') {
            entry['main'] = optionsEntry
        } else {
            entry = optionsEntry
        }


        // entry to absolute
        for (const [key, value] of Object.entries(entry)) {
            if (!path.isAbsolute(value)) {
                // 转化为绝对路径的同时统一路径分隔符为 /
                entry[key] = toUnixPath(path.join(this.rootPath, value))
            }
        }

        return entry
    }

}

module.exports = Compiler