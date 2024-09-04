function loader1(sourceCode) {
    console.log('join loader1');
    return sourceCode + `\n const loader1 = 'xeq loader1'`
}

module.exports = loader1