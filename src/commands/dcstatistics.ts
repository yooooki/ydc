import { $, Context } from 'koishi'

import type { RuntimeContext } from '../runtime'

import { ensureSession } from '../utils/argv'

// 输出当前群在数据库里的记录总数。
export function registerDcStatisticsCommand(ctx: Context, runtime: RuntimeContext) {
    ctx.command('dcstatistics', '大餐统计')
        .alias('dcstat')
        .action(async (argv) => {
            const session = ensureSession(argv)
            const guildId = session.guildId
            if (guildId == null) {
                return '只能在群聊中使用'
            }

            const savedCount = await ctx.database.select('dc_table')
                .where(row => $.eq(row.channelId, guildId))
                .execute(row => $.count(row.id))
            const pendingCount = await ctx.database.select('pending_dc_table')
                .where(row => $.eq(row.channelId, guildId))
                .execute(row => $.count(row.id))

            return `本群共有${savedCount}条已保存大餐记录和${pendingCount}条待审核大餐记录`
        })
}
