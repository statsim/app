const path = require('path')
const { VueLoaderPlugin } = require('vue-loader') // Support Vue's SFCs
const TerserPlugin = require('terser-webpack-plugin') // Minimize code
const webpack = require('webpack')
const package = require('./package.json')

/*
// Throws: Module Error (from ./node_modules/vue-loader/dist/index.js):
// vue-loader was used without the corresponding plugin. Make sure
// to include VueLoaderPlugin in your webpack config.
// https://github.com/stephencookdev/speed-measure-webpack-plugin/issues/184

const SpeedMeasurePlugin = require('speed-measure-webpack-plugin')
const smp = new SpeedMeasurePlugin()
*/

module.exports = (env) => {
  const config = {
    entry: './src/main.js',
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, 'dist'),
    },
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader'
        },
        {
          test: /(index|404)\.html/,
          type: 'asset/source'
        },
        {
          test: /\.css$/,
          use: [
            'vue-style-loader',
            'css-loader',
          ]
        },
        {
          test: /worker\.js$/,
          loader: "worker-loader",
          options: {
            inline: 'no-fallback'
          },
        },
        {
          test: /\.scss$/,
          use: [
            'vue-style-loader',
            'css-loader',
            'sass-loader'
          ]
        },
        // If broad, webpack will throw an error:
        // Can't import the named export 'render' (imported as 'render') from default-exporting module (only default export is available)
        ...(env.DEVELOPMENT ? [] : [
          {
            test: /\.js$/,
            loader: 'babel-loader',
            // exclude: /node_modules/,
            // options: {
            //   presets: [
            //     [
            //       '@babel/preset-env',
            //       {
            //         targets: {
            //           esmodules: true,
            //         },
            //       },
            //     ],
            //   ],
            // },
          },
        ]),
      ]
    },
    plugins: [
      new VueLoaderPlugin(),
      // Replace those values in the code
      new webpack.DefinePlugin({
        'VERSION': JSON.stringify(package.version),
      }),
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
      new webpack.ProvidePlugin({
        process: 'process/browser',
      }),
    ],
    // Load different versions of vue based on RUNTIME value
    resolve: {
      fallback: {
        'buffer': require.resolve('buffer'),
        // 'crypto': require.resolve('crypto-browserify'),
        'http': require.resolve('stream-http'),
        'https': require.resolve('https-browserify'),
        'path': require.resolve('path-browserify'),
        'stream': require.resolve('stream-browserify'), // Needed for csv-parse
        'timers': require.resolve('timers-browserify'),
        'url': require.resolve('url'),
        'util': require.resolve('util'),
      },
      alias: {
        vue$: 'vue/dist/vue.runtime.esm-bundler.js'
      },
    },
    // Update recommended size limit
    performance: {
      hints: false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000
    },
    // Remove comments
    optimization: {
      minimize: !env.DEVELOPMENT,
      minimizer: [new TerserPlugin({
        extractComments: !env.DEVELOPMENT,
        terserOptions: {
          keep_classnames: true, // class names are used in blocks' subtitles
          format: {
            comments: !env.DEVELOPMENT,
          },
        }
      })],
    },
    // Source map
    devtool: env.DEVELOPMENT
      ? 'eval-source-map'
      : false
  }

  return config
}
