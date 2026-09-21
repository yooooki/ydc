import type { Computed } from 'koishi'

declare module 'koishi' {
    namespace Command {
        /** 扩展命令配置的显示控制字段。 */
        interface Config {
            /** 默认隐藏所有选项 */
            hideOptions?: boolean
            /** 隐藏命令 */
            hidden?: Computed<boolean>
            /** 本地化参数 */
            params?: object
        }
    }

    namespace Argv {
        /** 扩展命令选项配置的显示控制字段。 */
        interface OptionConfig {
            /** 隐藏选项 */
            hidden?: Computed<boolean>
            /** 本地化参数 */
            params?: object
        }
    }
}
