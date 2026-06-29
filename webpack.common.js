const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    app: path.resolve(__dirname, 'src/scripts/index.js'),
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
  },
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif|ico|webmanifest)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
    parser: {
      javascript: {
        importMeta: true,
      },
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/index.html'),
      scriptLoading: 'module',
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src/public'),
          to: path.resolve(__dirname, 'dist'),
          noErrorOnMissing: true,
        },
        {
          from: path.resolve(__dirname, 'src/model'),
          to: path.resolve(__dirname, 'dist/model'),
        },
        {
          from: path.resolve(__dirname, 'STUDENT.txt'),
          to: path.resolve(__dirname, 'dist/STUDENT.txt'),
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  stats: {
    warningsFilter: /import\.meta/,
  },
};
