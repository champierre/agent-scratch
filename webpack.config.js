const path = require('path');
const webpack = require('webpack');
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
            },
            {
                // fetch-worker の publicPath ハードコード("/")をサブパス対応に修正
                test: /@scratch[\/\\]scratch-gui[\/\\]dist[\/\\]scratch-gui\.js$/,
                use: [path.resolve(__dirname, 'tools/fix-nested-publicpath-loader.js')]
            }
        ]
    },
    resolve: {
        extensions: ['.js', '.jsx'],
        // @anthropic-ai/sdk が条件付きで参照する Node ビルトインを無効化
        // (ブラウザ実行時には使われないコードパス)
        alias: {
            readline: false,
            worker_threads: false
        },
        fallback: {
            fs: false,
            'fs/promises': false,
            path: false,
            crypto: false,
            child_process: false,
            os: false,
            events: false,
            util: false,
            stream: false,
            tty: false,
            net: false
        }
    },
    plugins: [
        // "node:fs" 形式の参照を "fs" に正規化して fallback に乗せる
        new webpack.NormalModuleReplacementPlugin(/^node:/, resource => {
            resource.request = resource.request.replace(/^node:/, '');
        }),
        // 試用モード用プロキシURL(未設定なら試用モード無効)
        new webpack.DefinePlugin({
            'process.env.TRIAL_PROXY_URL': JSON.stringify(process.env.TRIAL_PROXY_URL || '')
        }),
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
