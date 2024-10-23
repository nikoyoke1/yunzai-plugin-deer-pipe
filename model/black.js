import Base from './base.js'

export default class blackModel extends Base {
    constructor (e) {
        super(e)
        this.model = 'black'
    }

    /** 生成版本信息图片 */
    async getData (blackData) {
        return {
            ...this.screenData,
            saveId: 'black',
            blackData: blackData
        }
    }
}
