import { Context, h } from 'koishi'

import type { RuntimeContext } from '../runtime'

import { ensureSession } from '../utils/argv'
import { buildTempImagePath, removeFileOrDirectory } from '../utils/files'

// 批量拒绝待审核记录。
export function registerDenyCommand(ctx: Context, runtime: RuntimeContext) {
    const cfg = runtime.config
    const tempPath = runtime.state.paths.temp

    ctx.command('deny [...args:number]', { hidden: true })
        .alias('dn')
        .usage('拒绝待审核记录，例如：deny 1 2 3')
        .action(async (argv, ...args) => {
            const session = ensureSession(argv)
            const userId = session.userId!
            if (userId !== cfg.master && !cfg.readers.includes(userId)) {
                return h.at(userId) + ' 你不能那么做'
            }
            if (args.length === 0) {
                return
            }
            const items = await ctx.database.get('pending_dc_table', { id: args })
            const result = await ctx.database.remove('pending_dc_table', { id: args })
            for (const item of items) {
                // 拒绝后同步清理临时图片/文件夹；清理失败不应影响拒绝结果
                try {
                    removeFileOrDirectory(buildTempImagePath(tempPath, item.path))
                } catch {
                    // ignore
                }
            }
            await session.send(`${result.removed}/${args.length}条大餐记录已拒绝`)
        })
}
