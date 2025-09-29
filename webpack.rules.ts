import type { RuleSetRule } from 'webpack';

export const rules: RuleSetRule[] = [
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|\.webpack)/,
    use: {
      loader: 'ts-loader',
      options: {
        transpileOnly: true,
      },
    },
  },
  {
    test: /\.svg$/i,
    type: 'asset/resource',
    generator: {
      filename: 'assets/[name].[contenthash][ext]',
    },
  },
];
