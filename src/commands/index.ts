import type { Context } from 'koishi'
import type { RuntimeContext } from '../runtime'

import { registerDcwCommand } from './dcw'
import { registerDcStatisticsCommand } from './dcstatistics'
import { registerCsmCommand } from './csm'
import { registerReviewCommand } from './review'
import { registerAcceptCommand } from './accept'
import { registerDenyCommand } from './deny'
import { registerYdbCommand } from './ydb'
import { registerYsmCommand } from './ysm'
import { registerYdcCommand } from './ydc'
import { registerDccrCommand } from './dccr'

// 注册全部命令。
export function registerCommands(ctx: Context, runtime: RuntimeContext) {
    registerDcwCommand(ctx, runtime)
    registerDcStatisticsCommand(ctx, runtime)
    registerCsmCommand(ctx, runtime)
    registerReviewCommand(ctx, runtime)
    registerAcceptCommand(ctx, runtime)
    registerDenyCommand(ctx, runtime)
    registerYdbCommand(ctx, runtime)
    registerYsmCommand(ctx, runtime)
    registerYdcCommand(ctx, runtime)
    registerDccrCommand(ctx, runtime)
}

export {
    registerDcwCommand,
    registerDcStatisticsCommand,
    registerCsmCommand,
    registerReviewCommand,
    registerAcceptCommand,
    registerDenyCommand,
    registerYdbCommand,
    registerYsmCommand,
    registerYdcCommand,
    registerDccrCommand,
}
