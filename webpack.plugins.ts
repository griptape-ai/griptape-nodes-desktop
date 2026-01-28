import type IForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'
import { Configuration, DefinePlugin } from 'webpack'
import { getBuildInfo, getReleaseNotes } from './build-info'

const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')

const buildInfo = getBuildInfo()
const releaseNotes = getReleaseNotes()

export const plugins: NonNullable<Configuration['plugins']> = [
  new ForkTsCheckerWebpackPlugin({
    logger: 'webpack-infrastructure',
  }),
  new DefinePlugin({
    __BUILD_INFO__: JSON.stringify(buildInfo),
    __RELEASE_NOTES__: JSON.stringify(releaseNotes),
    __VELOPACK_CHANNEL__: JSON.stringify(process.env.VELOPACK_CHANNEL),
    __NODE_ENV__: JSON.stringify(process.env.NODE_ENV || 'development'),
  }),
]
