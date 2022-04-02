const path = require('path');
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
        new HtmlWebpackPlugin({
            title: 'Tz Global Event Timer',
            filename: 'index.html',
            template: path.resolve(__dirname, "src/index.html")
        })
    ]
}