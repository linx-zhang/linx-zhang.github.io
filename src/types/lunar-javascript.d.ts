/**
 * lunar-javascript 没有自带类型声明，这里只声明本站用到的部分。
 * 需要别的能力时按官方 API 继续补，不要用 any 兜底。
 */
declare module 'lunar-javascript' {
  export interface Lunar {
    /** 农历月份中文（如「十月」，闰月带「闰」） */
    getMonthInChinese(): string
    /** 农历日中文（如「廿九」） */
    getDayInChinese(): string
    /** 当天是节气时返回节气名，否则空字符串 */
    getJieQi(): string
    /** 农历节日，如「春节」「中秋节」；没有则为空数组 */
    getFestivals(): string[]
    /** 干支纪年，如「丙午」 */
    getYearInGanZhi(): string
    /** 生肖，如「马」 */
    getYearShengXiao(): string
  }

  export interface Solar {
    getLunar(): Lunar
    /** 公历节日，如「元旦节」；没有则为空数组 */
    getFestivals(): string[]
    /** 星期数字，0 为星期日 */
    getWeek(): number
  }

  export interface SolarStatic {
    fromYmd(year: number, month: number, day: number): Solar
    fromDate(date: Date): Solar
  }

  export const Solar: SolarStatic
}
