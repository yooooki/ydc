import './koishi-augment'
import { Context, h } from 'koishi'
import { createDcTables } from './database'
import { registerCommands } from './commands'
import { Config } from './config'
import { createRuntime, prepareRuntimeDirectories } from './runtime'

export const name = 'ydc'
export const inject = ['database', 'console']

export { Config }

// 装配插件依赖、命令注册和消息钩子。
export function apply(ctx: Context, cfg: Config) {
    const runtime = createRuntime(cfg)
    // 启动时注册数据库模型。
    ctx.on('ready', () => {
        createDcTables(ctx)
    })
    prepareRuntimeDirectories(ctx, runtime)

    // 这些命令按设计是给机器人自身调用的
    registerCommands(ctx, runtime)

    // 在这里解析“代执行命令”消息
    ctx.on('message', (session) => {
        const messageElements = h.parse(session.content ?? '')
        if (messageElements.length === 0 || messageElements[0].type !== 'at') {
            return
        }
        const targetId = messageElements[0].attrs?.id
        if (typeof targetId !== 'string' || targetId !== cfg.self) {
            return
        }

        const commandParts = messageElements.map(element => element.toString().trim())
        session.execute(commandParts.join(' '))
    })
}
