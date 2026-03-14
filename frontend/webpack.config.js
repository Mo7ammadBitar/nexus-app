const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const dotenv = require('dotenv');

// Load .env file
const env = dotenv.config().parsed || {};

// Build DefinePlugin replacements for REACT_APP_* vars
const envKeys = Object.keys(env).reduce((prev, next) => {
  if (next.startsWith('REACT_APP_')) {
    prev[`process.env.${next}`] = JSON.stringify(env[next]);
  }
  return prev;
}, {});

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/'
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|jpg|gif|svg|woff|woff2|eot|ttf)$/,
        type: 'asset/resource'
      },
      // Fix for ESM modules requiring fully specified paths
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false
        }
      }
    ]
  },
  resolve: {
    extensions: ['.web.js', '.js', '.jsx'],
    alias: {
      'react-native$': 'react-native-web',
      'process/browser': require.resolve('process/browser.js'),
    },
    fallback: {
      "buffer": require.resolve("buffer/"),
      "stream": require.resolve("stream-browserify"),
      "crypto": require.resolve("crypto-browserify"),
      "process": require.resolve("process/browser.js"),
    }
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      favicon: './public/favicon.ico'
    }),
    new (require('webpack').ProvidePlugin)({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.DefinePlugin(envKeys),
  ],
  devServer: {
    port: 3000,
    historyApiFallback: true,
    hot: true
  }
};
