
class PluginA {
    constructor(){}

    appaly(compiler) {
        compiler.hooks.run.tap('Plugin A', () => {
            // callback
            console.log('Plugin A')
        })
    }
}

module.exports = PluginA