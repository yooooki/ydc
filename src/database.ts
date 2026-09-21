import { Context, Field } from 'koishi'

declare module 'koishi' {
    // 为 Koishi 数据库扩展插件表定义。
    interface Tables {
        dc_table: DCTable,
        pending_dc_table: DCTable,
    }
}

// 单条大餐记录的数据结构。
export interface DCTable {
    id: number
    user: string
    channelId: string
    stamp: Date
    url?: string
    path: string
    // all 模式记录时保存被引用消息 ID；旧数据可能没有该字段。
    messageId?: string
}

// 注册插件依赖的两张数据表。
export function createDcTables(ctx: Context){
    const dc_model:Field.MapField = {
        id: {
            type: 'unsigned',
            length: 8,
        },
        user: {
            type: 'string',
            length: 128
        },
        channelId: {
            type: 'string',
            length: 128,
        },
        stamp: {
            type: "timestamp"
        },
        url: {
            type: "string",
            length: 2048
        },
        path: {
            type: "string",
            length: 512
        },
        messageId: {
            type: "string",
            length: 128
        },
    };
    const dc_config = {
        autoInc: true,
    };
    ctx.model.extend('dc_table',dc_model, dc_config);
    ctx.model.extend('pending_dc_table',dc_model, dc_config);

}
