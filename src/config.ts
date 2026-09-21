import { Schema } from 'koishi'

export type CsmScope = 'guild' | 'global'

// ydc 记录图片的方式：只取第一张、只取最后一张、或保存全部图片。
export type RecordImageMode = 'first' | 'last' | 'all'

// 插件的用户可配置项。
export interface Config {
    master: string
    self: string
    readers: string[]
    dataDir: string
    smallReply: boolean
    csmScopeDefault: CsmScope
    recordImageMode: RecordImageMode
}

export const ConfigSchema: Schema<Config> = Schema.object({
    master: Schema.string().default("").comment("主人"),
    self: Schema.string().default("").comment("机器人账号"),
    readers: Schema.array(Schema.string().required().role("link")).description("其他审核人"),
    dataDir: Schema.string().default("ydc_files").comment("本地储存路径"),
    smallReply: Schema.boolean().default(false).comment("是否启用小图回复模式"),
    csmScopeDefault: Schema.union(['guild', 'global']).default('guild').description('csm 默认查找范围'),
    recordImageMode: Schema.union(['first', 'last', 'all'])
        .default('last')
        .description('ydc 记录图片方式：first 只记录第一张，last 只记录最后一张，all 记录全部图片'),
})

export const Config = ConfigSchema
