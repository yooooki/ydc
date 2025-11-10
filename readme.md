# koishi-plugin-ydc

[![npm](https://img.shields.io/npm/v/koishi-plugin-ydc?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-ydc)

记录群友「大餐」瞬间，支持审核、去重、随机推荐（吃什么）、罪证回放（个人大餐记录），以及每周/每月「大餐王」统计。

适用于 Koishi v4（>= 4.17.9），需要启用数据库服务；图片处理依赖 sharp。

## 功能概览

- 引用图片消息一键上报大餐：`ydc [@大餐人]`
- 待审核机制：防止误报，管理员审核后入库
- 去重：同一图片（按 url/文件名/用户）不会重复录入
- 随机推荐「吃什么」：从当前群历史大餐中随机一张
- 个人「罪证」回放：`dccr @用户`（可随机或最新）
- 「大餐王」统计：一周王/月度王，支持生成与查看
- 简洁小图回复模式（可选），减少刷屏
- 按机器人 @ 指令运行：在群里 @机器人 + 指令 也可执行

## 安装

在 Koishi 插件市场搜索并安装「koishi-plugin-ydc」。或使用包管理器安装：

```bash
npm i koishi-plugin-ydc sharp
# 或者使用 pnpm / yarn
```

注意：sharp 为 peer 依赖，Linux 环境若安装失败，请确保具备构建依赖或系统库。详见「常见问题」。

## 启用与基础配置

在 Koishi 中启用插件后，至少需要配置以下项：

- master：可执行审核/统计生成等隐蔽指令的账号 ID
- self：机器人账号 ID（用于识别 @机器人 触发的命令）

其他可选项见下文「配置项说明」。

## 配置项说明

插件配置（Config）如下：

- master：string，默认 ""。只有 master 可使用审核和统计生成等管理指令。
- self：string，默认 ""。机器人账号 ID，用于解析群里以 @机器人 开头的指令。
- readers：string[]，默认 []。其他审核人账号 ID。
- dataDir：string，默认 "ydc_files"。本地图片存储目录（相对 Koishi 工作目录）。
- smallReply：boolean，默认 false。开启后在提示去重/待审核等场景使用 200px 的小图回复，减少刷屏。

## 使用方法与工作流

1) 上报大餐（群聊）

- 在群里引用一条「包含图片」的消息，然后发送：
	- `ydc`（默认判定为被引用消息的发送者是大餐人）
	- 或 `ydc @某人`（若图片不是发图人本人的大餐，可显式指定大餐人）
- 插件会将图片保存到临时目录并加入「待审核队列」。
- 自动去重：如果同一张图（按 url/user/path）已在本群存在，会提示已记录；若已在待审核，也会提示。

2) 审核流程（仅 master）

- 查看待审核列表：`review -n 10`（默认显示前 10 条，n 可调）
- 通过：`accept 1 2 3`（以待审核记录 id 为参数，可批量）
	- 通过后图片会被拷贝到正式目录并写入 dc_table，随后从待审核表删除
- 拒绝：`deny 4 5`（从待审核表删除，不入库）

3) 日常查询（群聊）

- 随机吃什么：`csm`，从当前群历史大餐中随机返回一条并展示图片
- 个人罪证回放：`dccr @用户` 返回该用户一条大餐记录，默认随机；
	- 传 `-nr`（no-random）时返回最新一条：`dccr -nr @用户`
- 大餐王：
	- 生成（仅 master）：`dcw --new`，统计过去一周/一月各自次数最多的用户
	- 查看（群聊）：`dcw`，显示当前群最近一次统计结果（周王、月王）
- 数据统计概览：`dcstatistics` 或 `dcstat`，显示「已入库/待审核」的总条数

4) @机器人执行命令（群聊）

- 也可以在消息里以 `@机器人` 开头，然后接任意支持的指令，插件会自动解析并执行。

## 命令一览

- ydc [@用户] / ydc?：记录大餐（需引用包含图片的消息）
- csm：随机推荐吃什么（群内历史记录）
- dccr @用户 [-nr]：查看该用户的一条大餐记录（默认随机，-nr 取最新）
- dcw [--new]：查看/生成大餐王（--new 仅 master 和 readers 可用）
- dcstatistics | dcstat：数据库统计
- review [-n 数量]：查看待审核（仅 master 和 readers）
- accept [id ...] | ac：通过待审核（仅 master 和 readers）
- deny [id ...] | dn：拒绝待审核（仅 master 和 readers）

提示：部分命令只支持群聊（例如 `ydc`、`csm`、`dcw`），私聊会提示「只能在群聊中使用」。

## 数据与存储

数据库表（需启用 Koishi 数据库服务）：

- dc_table：正式大餐记录
	- 字段：id, user, channelId, stamp, url, path
- pending_dc_table：待审核大餐记录（字段同上）
- dc_king：每群最近一次周王/月王统计结果
	- 字段：guild_id（主键）, content（json，包含 weekly_king 与 monthly_king）

本地文件存储（相对 `dataDir`，默认 `ydc_files/`）：

- 临时目录：`ydc_files/tmp/`
- 正式目录：`ydc_files/<guild_id>/<user_id>/<filename>`

## 示例

- 引用图片并上报：
	- A 发送一张午餐图片 → B 引用该条消息并发送 `ydc @A` → 进入待审核
- 管理员审核通过：
	- 主人发送 `review -n 5` 查看 → `accept 12 13` 通过 → 图片入库
- 今日吃什么：
	- 群里发送 `csm` → 随机返回历史大餐并附图
- 查罪证：
	- `dccr @A` → 随机返回 A 的一张大餐图与日期说明

## 依赖与环境

- Koishi：^4.17.9
- 已启用的数据库服务（如 @koishijs/plugin-database-sqlite、mysql 等）
- sharp：^0.33.4（peer 依赖）

如果 sharp 安装失败（特别是 Linux）：

- 优先使用官方预编译二进制（默认会下载）
- 若需要从源码构建，请确保系统具备构建工具与依赖（如 Python3、g++/make 等）
- 某些发行版可能需要安装 libvips 相关库

## 常见问题

- 为何提示「只能在群聊中使用」？
	- 该命令仅在群聊上下文可用，请在群内执行。

- 图片去重的依据是什么？
	- 以 url + user + path 组合判定是否重复。

- 如何减少刷屏？
	- 打开 `smallReply`，插件在提示去重/待审核时会发送 200px 小图。

## 许可证

WTFPL

