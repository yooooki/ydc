import { Context, h } from 'koishi'

import type { RuntimeContext } from '../runtime'

import { ensureSession, parseAcceptArgs } from '../utils/argv'
import {
    buildGuildUserImagePath,
    buildTempImagePath,
    copyFileOrDirectory,
    removeFileOrDirectory,
} from '../utils/files'

// 批量通过待审核记录。
export function registerAcceptCommand(ctx: Context, runtime: RuntimeContext) {
    const cfg = runtime.config
    const rootPath = runtime.state.paths.root
    const tempPath = runtime.state.paths.temp

    ctx.command('accept [...rawArgs:string]', { hidden: true })
        .alias('ac')
        .usage('通过待审核记录，支持编号或区间，例如：accept 1 3-5')
        .action(async (argv, ...rawArgs) => {
            const session = ensureSession(argv)
            const userId = session.userId!
            if (userId !== cfg.master && !cfg.readers.includes(userId)) {
                return h.at(userId) + ' 你不能那么做'
            }
            if (rawArgs.length === 0) {
                return
            }

            const { values: ids, errorMessage } = parseAcceptArgs(rawArgs)
            if (ids.length === 0) {
                return errorMessage.trimStart() || '没有有效序号'
            }

            const items = await ctx.database.get('pending_dc_table', { id: ids })
            // 先把临时文件/文件夹复制到正式目录
            for (const item of items) {
                const source = buildTempImagePath(tempPath, item.path)
                const destination = buildGuildUserImagePath(rootPath, item.channelId, item.user, item.path)
                copyFileOrDirectory(source, destination)
            }

            // 数据库迁移成功后，再清理临时文件，避免数据库失败导致图片丢失。
            const result = await ctx.database.upsert('dc_table', items)
            const inserted = (result.inserted ?? 0) + (result.modified ?? 0)
            await ctx.database.remove('pending_dc_table', { id: ids })
            for (const item of items) {
                try {
                    removeFileOrDirectory(buildTempImagePath(tempPath, item.path))
                } catch {
                    // 临时文件清理失败不应影响审核通过的主流程
                }
            }
            await session.send(`${inserted}/${ids.length}条大餐记录已加入${errorMessage}`)
        })
}
