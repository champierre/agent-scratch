const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const scratchGuiDist = path.dirname(
    require.resolve('@scratch/scratch-gui')
);

module.exports = (env, argv) => ({
    entry: './src/index.jsx',
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: 'agent-scratch.js',
        publicPath: ''
    },
    devtool: argv.mode === 'production' ? false : 'cheap-module-source-map',
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {targets: 'defaults'}],
                            ['@babel/preset-react', {runtime: 'automatic'}]
                        ]
                    }
                }
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
    resolve: {
        extensions: ['.js', '.jsx']
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: 'src/index.html',
            title: 'Agent Scratch'
        }),
        // scratch-gui の prebuilt dist が実行時に読み込むチャンク・静的アセットを
        // 出力ディレクトリへコピーする(publicPath 相対で解決される)
        new CopyWebpackPlugin({
            patterns: [
                {from: path.join(scratchGuiDist, 'chunks'), to: 'chunks'},
                {from: path.join(scratchGuiDist, 'static'), to: 'static'},
                {from: path.join(scratchGuiDist, 'libraries'), to: 'libraries'},
                {from: path.join(scratchGuiDist, 'extension-worker.js'), to: ''},
                {from: path.join(scratchGuiDist, '*.hex'), to: '[name][ext]'}
            ]
        })
    ],
    devServer: {
        static: false,
        port: 8602,
        hot: false,
        liveReload: true,
        client: {overlay: {errors: true, warnings: false}}
    },
    performance: {hints: false}
});
