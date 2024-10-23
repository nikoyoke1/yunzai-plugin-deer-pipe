import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import { REDIS_YUNZAI_DEER_PIPE_DISABLE } from "../constants/core.js";
import blackModel from "../model/black.js";
import { isNumeric } from "../utils/common.js";
import { redisExistAndGetKey, redisSetKey } from "../utils/redis-util.js";

export class Friends extends plugin {
    constructor() {
        super({
            name: "贞操锁",
            dsc: "给某个用户添加赛博贞操锁，不能🦌🦌",
            event: "message",
            priority: 5000,
            rule: [
                {
                    reg: "^上(🔒|锁)(.*)",
                    fnc: "addDeerFriend",
                    permission: 'master',
                },
                {
                    reg: "^解(🔒|锁)(.*)",
                    fnc: "delDeerFriend",
                    permission: 'master',
                },
                {
                    reg: "^贞操锁名单$",
                    fnc: "myDeerFriend",
                    permission: 'master',
                }
            ]
        })
    }

    /**
     * 获取群内的昵称
     * @param e
     * @param user_id
     * @returns {Promise<*>}
     */
    async getGroupUserInfo(e) {
        const curGroup = e.group || Bot?.pickGroup(e.group_id);
        return curGroup?.getMemberMap();
    }

    /**
     * 获取群信息
     * @param blackList
     * @param user_id
     * @param membersMap
     * @returns {*}
     */
    generateDeerData(blackList, user_id, membersMap) {
        return blackList[user_id].filter(item => {
            const groupInfo = membersMap.get(parseInt(item));
            return groupInfo !== undefined;
        }).map(item => {
            const groupInfo = membersMap.get(parseInt(item));
            return {
                user_id: item,
                nickname: groupInfo?.card || groupInfo?.nickname
            }
        });
    }

    /**
     * 从群信息中提取某个用户的昵称
     * @param membersMap
     * @param deerTrustUserId
     * @returns {*}
     */
    extractDeerNickname(membersMap, deerTrustUserId) {
        const trustDeerInfo = membersMap.get(parseInt(deerTrustUserId));
        return trustDeerInfo?.nickname || trustDeerInfo?.card || deerTrustUserId;
    }


    async addDeerFriend(e) {
        // 获取用户
        const user = e.sender;
        const { user_id } = user;
        let deerTrustUserId = null;
        // 获取🔒
        if (e.at) {
            // 通过 at 添加
            deerTrustUserId = e.at;
        } else {
            deerTrustUserId = e?.reply_id !== undefined ?
                (await e.getReply()).user_id :
                e.msg.replace(/上(🔒|锁)/g, "").trim();
        }
        // 判断是否存在
        if (!deerTrustUserId || !isNumeric(deerTrustUserId)) {
            e.reply("无法获取到🦌友信息，或者这是一个无效的🔒信息，请重试", true);
            return;
        }
        let blackList = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE_DISABLE) || {};
        // 第一次初始化
        if (blackList[user_id] === undefined) {
            blackList[user_id] = [];
        }
        // 重复检测
        if (blackList[user_id].includes(deerTrustUserId)) {
            e.reply("🦌友已上🔒，无须上🔒!");
            return;
        }
        blackList[user_id].push(deerTrustUserId);
        // 放置到Redis里
        await redisSetKey(REDIS_YUNZAI_DEER_PIPE_DISABLE, blackList);
        // 获取🦌友🔒信息
        const membersMap = await this.getGroupUserInfo(e);
        // 生成我的🦌友图片
        const deerData = this.generateDeerData(blackList, user_id, membersMap);
        if (deerData.length === 0) {
            e.reply("暂时没有🦌友上🔒！", true);
            return;
        }
        const data = await new blackModel(e).getData(deerData);
        let img = await puppeteer.screenshot("black", data);
        // 获取🦌友上🔒信息
        const trustDeer = this.extractDeerNickname(membersMap, deerTrustUserId);
        e.reply([`成功🦌友上🔒：${ trustDeer }`, img], true);
    }

    async delDeerFriend(e) {
        // 获取用户
        const user = e.sender;
        const { user_id } = user;
        let deerTrustUserId = null;
        // 获取🦌友
        if (e.at) {
            // 通过 at 添加
            deerTrustUserId = e.at;
        } else {
            deerTrustUserId = e?.reply_id !== undefined ?
                (await e.getReply()).user_id :
                e.msg.replace(/解(🔒|锁)/g, "").trim();
        }
        if (!deerTrustUserId || !isNumeric(deerTrustUserId)) {
            e.reply("无法获取到🦌友信息，或者这是一个无效的🔒信息，请重试", true);
            return;
        }
        let blackList = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE_DISABLE) || {};
        // 第一次初始化
        if (blackList[user_id] === undefined) {
            blackList[user_id] = [];
        }
        // 重复检测
        if (!blackList[user_id].includes(deerTrustUserId)) {
            e.reply("🦌友并未上🔒，无须解锁!");
            return;
        }
        // 删除🦌友
        blackList[user_id] = blackList[user_id].filter(item => item !== deerTrustUserId);
        // 放置到Redis里
        await redisSetKey(REDIS_YUNZAI_DEER_PIPE_DISABLE, blackList);
        // 获取🦌友信息
        const membersMap = await this.getGroupUserInfo(e);
        // 生成我的🦌友图片
        const deerData = this.generateDeerData(blackList, user_id, membersMap);
        if (deerData.length === 0) {
            e.reply("暂时没有🦌友上🔒！", true);
            return;
        }
        const data = await new blackModel(e).getData(deerData);
        let img = await puppeteer.screenshot("black", data);
        // 获取🦌友信息
        const trustDeer = this.extractDeerNickname(membersMap, deerTrustUserId);
        e.reply([`成功解🔒🦌友：${ trustDeer }`, img], true);
    }

    async myDeerFriend(e) {
        // 获取用户
        const user = e.sender;
        const { user_id } = user;
        // 获取🦌友
        let blackList = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE_DISABLE) || {};
        if (blackList[user_id] === undefined || blackList[user_id].length === 0) {
            e.reply("还没有人上🔒！", true);
            return;
        }
        const curGroup = e.group || Bot?.pickGroup(e.group_id);
        const membersMap = await curGroup?.getMemberMap();
        const deerData = this.generateDeerData(blackList, user_id, membersMap);
        if (deerData.length === 0) {
            e.reply("还没有人上🔒！", true);
            return;
        }
        const data = await new blackModel(e).getData(deerData);
        let img = await puppeteer.screenshot("black", data);
        e.reply(img);
    }
}
