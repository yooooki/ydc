import { $, Argv, Context, Dict, Random, Schema, h, Computed} from 'koishi'

import { create_dc_tables, DCTable, DCKingTable } from './database'

import sharp from 'sharp';

import fs from 'node:fs';

export const name = 'ydc'
export const inject = ['database', 'console']

//todo: review: support range expressions, e.g. 2240-2245

declare module 'koishi' {
namespace Command {
    interface Config {
        /** hide all options by default */
        hideOptions?: boolean
        /** hide command */
        hidden?: Computed<boolean>
        /** localization params */
        params?: object
    }
}

namespace Argv {
    interface OptionConfig {
        /** hide option */
        hidden?: Computed<boolean>
        /** localization params */
        params?: object
    }
}
}

export interface Config {
    master: string
    self: string
    readers: string[]
    dataDir: string
    smallReply: boolean
}

export const Config: Schema<Config> = Schema.object({
    master: Schema.string().default("").comment("主人"),
    self: Schema.string().default("").comment("机器人账号"),
    readers: Schema.array(Schema.string().required().role("link")).description("其他审核人"),
    dataDir: Schema.string().default("ydc_files").comment("本地储存路径"),
    smallReply: Schema.boolean().default(false).comment("是否启用小图回复模式")
})

export function apply(ctx: Context, cfg: Config) {
    const path = './' + cfg.dataDir+'/';
    const temp_path = path + '/tmp/';
    ctx.on('ready', () => {
        create_dc_tables(ctx);
        if(!fs.existsSync(path)){
            fs.mkdirSync(path, {recursive:true});
        }
        if(!fs.existsSync(temp_path)){
            fs.mkdirSync(temp_path, {recursive:true});
        }
    });

    var dcking_gen_lock = false;
    // commands are designed to be called by the bot itself
    ctx.command('dcw', '查看上一赛季的大餐王')
    .option('new', '评选新的大餐王',{hidden: true})
    .action(async (argv)=>{
        if(argv.options.new){
            if(argv.session.userId!=cfg.master && !cfg.readers.includes(argv.session.userId))
                return h.at(argv.session.userId)+" 你不能那么做";
            // todo: generate dcw
            const day = 1000*60*60*24;
            const stamp = argv.session.event.timestamp;
            const last_week = new Date(stamp - day*7);
            const last_month = new Date(stamp - day*30);
            const now = new Date(stamp);
            var dc_map:{[gid:string]:{weekly:{[uid:string]:number}, monthly:{[uid:string]:number}}} = {};
            if(dcking_gen_lock)
                return "大餐王正在统计中...";
            dcking_gen_lock = true;
            ctx.database.get('dc_table', {
                stamp: {$gt: last_month}
            }).then((dc_records) => {
                for(let record of dc_records){
                    if(!dc_map[record.channelId]){
                        dc_map[record.channelId]={
                            weekly: {},
                            monthly: {}
                        };
                    }
                    var monthly:object = dc_map[record.channelId].monthly;
                    if(!monthly[record.user]){
                        monthly[record.user] = 0;
                    }
                    monthly[record.user] += 1;

                    if(record.stamp < last_week)
                        continue;
                    var weekly:object = dc_map[record.channelId].weekly;
                    if(!weekly[record.user]){
                        weekly[record.user] = 0;
                    }
                    weekly[record.user] += 1;
                }
                var dc_king_tables: DCKingTable[] = [];
                for(const [guild_id, guild_map] of Object.entries(dc_map)){
                    var dcw_num_weekly = 0;
                    var dcw_id_weekly = "";
                    var dcw_num_monthly = 0;
                    var dcw_id_monthly = "";
                    for(const [uid, times] of Object.entries(guild_map.weekly)){
                        if(times>dcw_num_weekly){
                            dcw_id_weekly = uid;
                            dcw_num_weekly = times;
                        }
                    }
                    for(const [uid, times] of Object.entries(guild_map.monthly)){
                        if(times>dcw_num_monthly){
                            dcw_id_monthly = uid;
                            dcw_num_monthly = times;
                        }
                    }
                    if(dcw_id_weekly.length > 0 && dcw_id_monthly.length>0){
                        dc_king_tables.push({
                            guild_id: guild_id,
                            content: {
                                weekly_king: {
                                    start: last_week,
                                    end: now,
                                    id: dcw_id_weekly,
                                    times: dcw_num_weekly
                                },
                                monthly_king:{
                                    start: last_month,
                                    end: now,
                                    id: dcw_id_monthly,
                                    times: dcw_num_monthly
                                }
                            }
                        })
                    }
                }
                return ctx.database.upsert('dc_king', dc_king_tables);
            }).finally(()=>{
                dcking_gen_lock = false;
                argv.session.send("新的大餐王已诞生");
            })

            return "生成本月大餐王...";
        }
        else{
            const guild_id = argv.session.guildId;
            if(guild_id == null){
                return "只能在群聊中使用";
            }
            var r = await ctx.database.get('dc_king', {guild_id: guild_id});
            if(r.length == 0)
                return "大餐王待统计...";
            var w = r[0].content.weekly_king;
            var m = r[0].content.monthly_king;
            const options:Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
            const locale = "zh-CN";
            return `<>
一周大餐王(${new Date(w.start).toLocaleDateString(locale, options)}~${new Date(w.end).toLocaleDateString(locale, options)}):<br/>
<at id="${w.id}"/> 大餐${w.times}次<br/><br/>
一月大餐王(${new Date(m.start).toLocaleDateString(locale, options)}~${new Date(m.end).toLocaleDateString(locale, options)}):<br/>
<at id="${m.id}"/> 大餐${m.times}次
</>`;
        }
    });

    ctx.command('dcstatistics', '大餐统计')
    .alias('dcstat')
    .action(async (argv) => {
        var stats = await ctx.database.stats();
        return `共有${stats.tables['dc_table'].count}条已保存大餐记录和${stats.tables['pending_dc_table'].count}条待审核大餐记录`;
    });

    ctx.command('csm', '吃什么')
    .action(async (argv) => {
        const guild_id = argv.session.guildId;
        const caller_id = argv.session.userId;
        const msg_id = argv.session.messageId;
        if(guild_id == null){
            return "只能在群聊中使用";
        }
        var cnt = await ctx.database.select('dc_table')
                                    .where(row => $.eq(row.channelId, guild_id))
                                    .execute(row => $.count(row.id));
        
        var result = await ctx.database.select('dc_table')
                                       .where(row => $.eq(row.channelId, guild_id))
                                       .orderBy('id')
                                       .offset(Random.int(0, cnt-1))
                                       .limit(1)
                                       .execute()
        if(result.length != 1){
            return `<>
            <at id="${caller_id}"/> 发生了一些事，只能摸了
            </>`
        }
        var record = result[0];
        const options:Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const locale = "zh-CN";
        
        var isUserinGroup = true;
        try {
            await argv.session.bot.getGuildMember(guild_id, record.user);
        } catch(e) {
            isUserinGroup = false;
        }
        
        const imagePath = path + guild_id + '/' + record.user + '/' + record.path;
        var img_buf;
        if (isUserinGroup) {
            img_buf = await sharp(imagePath).jpeg().toBuffer();
        } else {
            img_buf = await sharp(imagePath).grayscale().jpeg().toBuffer();
        }

        var tail;
        if (isUserinGroup) {   
            tail = caller_id == record.user ?
            "你还想再吃一次吗?":
            "不来一份吗?";
        } else {
            tail = "他的大餐仍然陪伴着我们";
        }

        argv.session.send(h('p',h.quote(msg_id),h.at(record.user), 
                            `在${new Date(record.stamp).toLocaleDateString(locale, options)}吃了如下大餐`,h('br'), 
                            h.image(img_buf, "image/jpeg"), tail));
    });

    ctx.command('review ',{ hidden: true })
    .option('num', '-n <val:number>', { fallback: 10 })
    .action(async (argv)=>{
        if(argv.session.userId!=cfg.master && !cfg.readers.includes(argv.session.userId))
            return h.at(argv.session.userId)+" 你不能那么做";
        let idx = 0;
        var pending_dcs = await ctx.database.get('pending_dc_table', {});
        console.log(pending_dcs);
        argv.session.send(`共有${pending_dcs.length}条大餐待审核`);
        await ctx.sleep(1000);
        for(let pending_dc of pending_dcs){
            if(++idx > argv.options.num){
                argv.session.send(`显示${argv.options.num}条`);
                break;
            }
            await argv.session.send(`
id: ${pending_dc.id}
guild: ${pending_dc.channelId}
user: ${pending_dc.user}
image:
`+h.image(await sharp(temp_path + pending_dc.path).resize(200).jpeg().toBuffer(), "image/jpeg"));
            await ctx.sleep(1000);
        }
        await ctx.sleep(500);
        argv.session.send(`以上`);
        return;
    });

    // ctx.command('accept [...args:number]', { hidden: true })
    // .alias('ac')
    // .action(async (argv, ...args)=>{
    //     if(argv.session.userId!=cfg.master && !cfg.readers.includes(argv.session.userId))
    //         return h.at(argv.session.userId)+" 你不能那么做";
    //     if(args.length == 0)
    //         return;
    //     await ctx.database.get('pending_dc_table', {id: args})
    //     .then(async (items) => {
    //         var tasks = [];
    //         for(let item of items){
    //             if(!fs.existsSync(path + item.channelId + '/' +item.user)){
    //                 fs.mkdirSync(path + item.channelId + '/' +item.user, {recursive:true});
    //             }
    //             fs.copyFileSync(temp_path + item.path, path + item.channelId + '/' + item.user+ '/' + item.path);
    //         }
    //         await Promise.all(tasks);
    //         return ctx.database.upsert('dc_table', items);
    //     }).then((result)=>{
    //         return argv.session.send(`${result.inserted + result.modified}/${args.length}条大餐记录已加入`);
    //     }).then(()=>{
    //         return ctx.database.remove('pending_dc_table', {id: args});
    //     });
    //     return;
    // });

    ctx.command('accept [..._args:string]', { hidden: true })
    .alias('ac')
    .action(async (argv, ..._args)=>{
        if(argv.session.userId!=cfg.master && !cfg.readers.includes(argv.session.userId))
            return h.at(argv.session.userId)+" 你不能那么做";
        if(_args.length == 0)
            return;

        // expand args
        let err_msg = "";
        let args:Array<number> = [];
        for(let _arg of _args){
            if(Number.isInteger(Number(_arg))){
                args.push(Number(_arg));
            }
            else if(_arg.split('-').length == 2){
                let [start, end] = _arg.split('-').map(val => Number(val));
                if(Number.isInteger(start) && Number.isInteger(end)){
                    args.push(...[...Array(end - start + 1).keys()].map(i => i + start))
                }
            }
            else{
                err_msg += `\n错误序号: ${_arg}，已忽略`
            }
        }

        let inserted = 0;
        await ctx.database.get('pending_dc_table', {id: args})
        .then(async (items) => {
            for(let item of items){
                if(!fs.existsSync(path + item.channelId + '/' +item.user)){
                    fs.mkdirSync(path + item.channelId + '/' +item.user, {recursive:true});
                }
                fs.copyFileSync(temp_path + item.path, path + item.channelId + '/' + item.user+ '/' + item.path);
            }
            return ctx.database.upsert('dc_table', items);
        }).then((result)=>{
            inserted = result.inserted + result.modified;
            return ctx.database.remove('pending_dc_table', {id: args});
        }).then(()=>{
            return argv.session.send(`${inserted}/${args.length}条大餐记录已加入${err_msg}`);
        });
        return;
    });

    ctx.command('deny [...args:number]',{ hidden: true })
    .alias('dn')
    .action(async (argv, ...args)=>{
        if(argv.session.userId!=cfg.master && !cfg.readers.includes(argv.session.userId))
            return h.at(argv.session.userId)+" 你不能那么做";
        if(args.length == 0)
            return;
        await ctx.database.remove('pending_dc_table', {id: args})
        .then((result)=>{
            return argv.session.send(`${result.removed}/${args.length}条大餐记录已拒绝`);
        });
        return;
    });

    ctx.command('ydb',{ hidden: true })
    .action((_)=>{
        return Math.random() > 0.5 ? "太傻逼了，别恶心我":"太恶心了，别傻逼我";
    });

    ctx.command('ysm',{ hidden: true })
    .action((_)=>{
        return Math.random() > 0.5 ? "太晒妹了，别恶心我":"太恶心了，别晒妹我";
    });

    var ydc_lock = false;
    ctx.command('ydc [arg0:string]', '记录群友大餐瞬间')
    .alias('ydc?')
    .usage('回复一个包含大餐图片的发言，ydc \n如果这张图不是大餐人发的，可以在后面加上对大餐人的at')
    .action(async (argv, arg0)=>{
        const guild_id = argv.session.guildId;
        if(guild_id == null){
            return "只能在群聊中使用";
        }
        const target = argv.session.quote;
        if(target == null){
            return "你必须引用一条大餐";
        }
        var dcer = target.user.id;
        if(arg0){
            var e = h.parse(arg0);
            if(e.length == 1 && e[0].type == 'at' && e[0].attrs.id){
                dcer = e[0].attrs.id;
            }
        }

        const stamp = argv.session.event.timestamp;
        var url:string = "";
        var file:string = "";
        var elements = h.parse(target.content)
        for(let elem of elements){
            if(elem.type == 'img'){
                url = elem.attrs.src;
                file = elem.attrs.file;
                // fix metadata added in newer version of napcat
                let tmp = file.match(/\.(.+?\..+?)$/);
                if(tmp){
                    file = tmp[1];
                }
            }
        }
        if(url.length == 0){
            return "引用的大餐消息必须包含一张大餐图片";
        }
        if(ydc_lock){
            return "正在添加大餐记录...";
        }
        var om:[data: string, attrs?: Dict] | [data: ArrayBuffer | Buffer | ArrayBufferView, type: string, attrs?: Dict];
        om = [url];
        var result = await ctx.database.get('dc_table', {
            url: url,
            user: dcer,
            path: file
        });
        if(result.length > 0){
            if(cfg.smallReply){
                om = [await sharp(path + guild_id + '/'  + dcer+ '/' + file).resize(200).jpeg().toBuffer(), "image/jpeg"]
            }
            return h('p',h.at(dcer),'的大餐',h.image(...om),'早就被记录了！')
        }
        ydc_lock = true;
        ctx.database.get('pending_dc_table', {
            url: url,
            user: dcer,
            path: file
        }).then(async (result)=>{
            if(result.length>0){
                if(cfg.smallReply){
                    om = [await sharp(temp_path + file).resize(200).jpeg().toBuffer(), "image/jpeg"]
                }
                argv.session.send(h('p',h.at(dcer),'的大餐',h.image(...om),'早就被记录到待审核了！'));
                return;
            }
            var im = await fetch(url).then(res => res.arrayBuffer());
            fs.writeFileSync(temp_path+file, Buffer.from(im));
            return ctx.database.create('pending_dc_table', {
                channelId: guild_id,
                user: dcer,
                url: url,
                stamp: new Date(stamp),
                path: file
            }).then(async (_)=>{
                if(cfg.smallReply){
                    om = [await sharp(temp_path + file).resize(200).jpeg().toBuffer(), "image/jpeg"]
                }
                argv.session.send(h('p',h.at(dcer),'的大餐',h.image(...om),'已经被添加到待审核'));
            })
        }).finally(()=>{
            ydc_lock = false;
        });
    });


    function qq_img_mime(filename:string){
        if(filename.endsWith('png'))
            return "image/png";
        else if(filename.endsWith('bmp'))
            return "image/bmp";
        else 
            return "image/jpeg";
    }

    function parse_date(datastr: string){
        if(datastr.trim().length == 0)
            return null;
        
        let date_pair = datastr.trim().split('~');
        let start_stamp = Date.parse(date_pair[0]);
        if(isNaN(start_stamp)){
            return null;
        }
        let end_stamp = start_stamp + 86400 * 1000; // a day
        if(date_pair.length > 1){
            let tmp = Date.parse(date_pair[1]);
            if(!isNaN(tmp) && tmp > start_stamp){
                end_stamp = tmp;
            }
        }
        return [new Date(start_stamp), new Date(end_stamp)];
    }

    ctx.command("dccr <arg0:string>", "大餐criminal record")
    .option('noramdom', '-z')
    .option('norandom', '--nr', {value: true})
    .option('date', '-d <:string>')
    .usage("dccr @罪人 [--nr] [-d date_start[~date_end]]")
    .action(async (argv, arg0)=>{
        if(!arg0){
            return "错误用法";
        }
        const rand = !argv.options.noramdom;
        const guild_id = argv.session.guildId;
        var elements = h.parse(arg0);
        if(elements.length != 1 || elements[0].type!='at'){
            return "错误用法";
        }
        const user_id = elements[0].attrs.id;(/\.(.+?\..+?)$/)

        let start_date: Date = null, end_date: Date = null;
        if(argv.options.date){
            let dates = parse_date(argv.options.date);
            if(!dates){
                return "日期格式不合法，正确格式为\"起始日期[~结束日期]\""
            }
            [start_date, end_date] = dates;
        }
        
        var records = await ctx.database.select('dc_table')
        .where(row => $.and($.eq(row.user, user_id), $.eq(row.channelId, guild_id)))
        .orderBy(row => row.stamp, 'desc')
        .execute();
        
        if(records.length == 0){
            return h('p', h.at(user_id), "无罪");
        }

        var random_pick_range = records;
        var record = records[0];
        var guilt_range_prefix = "";
        if(start_date){
            let min_diff = Math.abs(start_date.getTime() - record.stamp.getTime());
            let tmp = records.filter(function(r){
                // set record as the nearest record to start_date by default
                if(Math.abs(start_date.getTime() - r.stamp.getTime()) < min_diff){
                    min_diff = Math.abs(start_date.getTime() - r.stamp.getTime());
                    record = r;
                }
                return r.stamp > start_date && r.stamp < end_date;
            });
            if(tmp.length > 0){
                random_pick_range = tmp;
                record = tmp[tmp.length - 1];
            }
            else{
                guilt_range_prefix = "尽管那几天无罪，";
            }
        }
        if(rand){
            record = Random.pick(random_pick_range);
        }
        const buffer = fs.readFileSync(path + guild_id + '/' +user_id+'/'+record.path);
        const options:Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const locale = "zh-CN";
        var other_guilt = `除此之外还有${records.length-1}条罪证`;
        if(records.length == 1)
            other_guilt = "除此之外是清白的，暂时";
        return h('p', guilt_range_prefix, h.at(user_id), `于${new Date(record.stamp).toLocaleDateString(locale,options)}`,"的罪证在此:", h.image(buffer,qq_img_mime(record.path)),other_guilt);
    })

    

    ctx.command("dummy [...args:string]",{ hidden: true })
    .action((_, ...args)=>{
        console.log(args);
        return;
    });

    // ctx.command("morphtheass",{ hidden: true })
    // .action(async (argv,_)=>{
    //     if(argv.session.userId != cfg.master)
    //         return "nope";

    //     var pp=path+'morph/';
    //     fs.mkdirSync(pp);
    //     var records = await ctx.database.get('dc_table', {});
    //     argv.session.send(records.length + " records to be move");
    //     let cnt = 0;
    //     for(let record of records){
    //         if(!fs.existsSync(pp+record.channelId+'/'+record.user)){
    //             fs.mkdirSync(pp+record.channelId+'/'+record.user, {recursive:true});
    //         }
    //         fs.copyFileSync(path+record.user+'/'+record.path, pp+record.channelId+'/'+record.user+'/'+record.path);
    //         cnt+=1;
    //     }
    //     return cnt+" records processed";
    // });

    ctx.command('test <arg0:string>', "大餐criminal record")
    .option('noramdom', '-z')
    .option('norandom', '--nr', {value: true})
    .option('date', '-d <:text>')
    .action(({ options }) => JSON.stringify(options))

    // "command" parsing are resolved here
    ctx.on('message', (session) => {
        const stamp = session.event.timestamp;
        const msg_elements = h.parse(session.content);
        if(msg_elements.length == 0 || msg_elements[0].type!='at')
            return;
        if(msg_elements[0].attrs.id != cfg.self)
            return;
        
        var cmd_line = [];
        for(let i = 0;i<msg_elements.length;++i){
            cmd_line.push(msg_elements[i].toString().trim())
        }
        console.log(cmd_line);
        session.execute(cmd_line.join(' '));
    });
}
