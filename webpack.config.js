const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: {
        main: path.resolve(__dirname, 'src/js/main.js')
    }, 
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].[contenthash].js',
        clean: true,  // empty the dist folder
    },
    devtool: 'inline-source-map',
    devServer: {
        port: 8080,
        open: true,
        hot: true,
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
            title: 'Tz Event Timer',
            filename: 'index.html',
            template: path.resolve(__dirname, "src/index.html")
        })
    ]
}