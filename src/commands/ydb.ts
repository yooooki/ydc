import { Context } from 'koishi'

import type { RuntimeContext } from '../runtime'

// 返回 ydb 的随机吐槽。
export function registerYdbCommand(ctx: Context, _runtime: RuntimeContext) {
    ctx.command('ydb', { hidden: true })
        .action(() => {
            return Math.random() > 0.5 ? '太傻逼了，别恶心我' : '太恶心了，别傻逼我'
        })
}
