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

  /** 法定节假日与调休（数据内置在库里，国务院公布新一年安排后靠升级包更新） */
  export interface Holiday {
    /** 假期名，如「国庆节」；补班日也带这个名 */
    getName(): string
    /** true = 调休上班（补班），false = 放假 */
    isWork(): boolean
    /** 这段假期所属的正日子，YYYY-MM-DD；补班日指向被补的那一天 */
    getTarget(): string
    /** 当前这一天的 YYYY-MM-DD */
    getDay(): string
  }

  export const HolidayUtil: {
    /** 支持 'YYYY-MM-DD' 字符串或 (year, month, day)；没有安排时返回 null */
    getHoliday(date: string): Holiday | null
    getHoliday(year: number, month: number, day: number): Holiday | null
  }
}
