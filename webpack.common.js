const path = require('path');
const fs = require('node:fs');
const { BannerPlugin } = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: {
        main: './src/js/main.js'
    }, 
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].[contenthash].js',
        clean: true
    },
    // loaders
    module: {
        rules: [
            {test: /\.css$/, use: ['style-loader', 'css-loader']}
        ]
    },
    // plugins
    plugins: [
        new BannerPlugin({
            banner: fs.readFileSync(path.resolve(path.dirname(require.resolve('fflate')), '../LICENSE'), 'utf8')
        }),
        new HtmlWebpackPlugin({
            title: 'Global Event Timer',
            favicon: path.resolve(__dirname, 'src/event-timer.svg'),
            filename: 'index.html',
            template: path.resolve(__dirname, "src/index.html")
        })
    ]
}
