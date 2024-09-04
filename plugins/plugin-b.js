
class PluginB {
    constructor(){}
    appaly(compiler) {
        compiler.hooks.run.tap('Plugin B', () => {
            // callback
            console.log('Plugin B')
        })
    }
}


module.exports = PluginB