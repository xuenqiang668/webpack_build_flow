// index.js
const webpack = require('./webpack');
const config = require('../example/webpack.config');
// 步骤1: 初始化参数 根据配置文件和shell参数合成参数
const compiler = webpack(config);


// action run func
compiler.run((err, stats) => {
    if(err) {
        console.log('err', err);
    }
})