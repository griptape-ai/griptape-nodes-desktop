import type IForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import { Configuration, DefinePlugin } from 'webpack';
import { getBuildInfo } from './build-info';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const buildInfo = getBuildInfo();

export const plugins: NonNullable<Configuration["plugins"]> = [
  new ForkTsCheckerWebpackPlugin({
    logger: 'webpack-infrastructure',
  }),
  new DefinePlugin({
    __BUILD_INFO__: JSON.stringify(buildInfo),
    __VELOPACK_CHANNEL__: JSON.stringify(process.env.VELOPACK_CHANNEL),
  }),
];

