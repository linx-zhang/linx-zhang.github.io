/** MBTI 精简版与星座速查的纯数据 / 纯计算，组件只负责交互。 */

export type MbtiDimensionKey = 'EI' | 'SN' | 'TF' | 'JP'
export type MbtiPole = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P'

export interface MbtiDimension {
  key: MbtiDimensionKey
  left: MbtiPole
  right: MbtiPole
  leftName: string
  rightName: string
  leftHint: string
  rightHint: string
}

export interface MbtiQuestion {
  id: string
  dimension: MbtiDimensionKey
  /** 这道题问的情境，下面两个选项分别对应左侧 / 右侧倾向。 */
  prompt: string
  left: string
  right: string
}

export const MBTI_DIMENSIONS: readonly MbtiDimension[] = [
  {
    key: 'EI',
    left: 'E',
    right: 'I',
    leftName: '外向',
    rightName: '内向',
    leftHint: '从外部互动获得能量',
    rightHint: '从独处和内部世界恢复',
  },
  {
    key: 'SN',
    left: 'S',
    right: 'N',
    leftName: '实感',
    rightName: '直觉',
    leftHint: '先看事实、细节和已验证经验',
    rightHint: '先看可能性、模式和长期方向',
  },
  {
    key: 'TF',
    left: 'T',
    right: 'F',
    leftName: '逻辑',
    rightName: '共情',
    leftHint: '先按逻辑、一致性和效率判断',
    rightHint: '先看人的感受、关系和影响',
  },
  {
    key: 'JP',
    left: 'J',
    right: 'P',
    leftName: '计划',
    rightName: '灵活',
    leftHint: '先定计划、边界和完成标准',
    rightHint: '先保留空间、边做边调整',
  },
]

/**
 * 每维 3 组二选一，共 12 题。每组只回答「哪句更像你」，不设中性档。
 * 单维固定 3 票，结果只会是 3:0、2:1、1:2、0:3，不会出现 50/50 的平局。
 */
export const MBTI_QUESTIONS: readonly MbtiQuestion[] = [
  {
    id: 'ei1',
    dimension: 'EI',
    prompt: '一个空闲的周末，你更想怎么过？',
    left: '约朋友出去，边走边聊',
    right: '一个人待着，慢慢恢复',
  },
  {
    id: 'ei2',
    dimension: 'EI',
    prompt: '到了一个新环境，你通常先做什么？',
    left: '主动认识几个人',
    right: '先观察，等别人开口',
  },
  {
    id: 'ei3',
    dimension: 'EI',
    prompt: '一场长聊结束后，你更常见的感觉是？',
    left: '越聊越有精神',
    right: '信息量太大，想安静一下',
  },
  {
    id: 'sn1',
    dimension: 'SN',
    prompt: '接到一个新任务，你会先看什么？',
    left: '现有资料、步骤和先例',
    right: '这件事还能怎么做、会走向哪',
  },
  {
    id: 'sn2',
    dimension: 'SN',
    prompt: '哪类信息更容易让你投入？',
    left: '具体、可验证的细节',
    right: '背后的模式、关联和可能性',
  },
  {
    id: 'sn3',
    dimension: 'SN',
    prompt: '给别人讲一件事，你更习惯怎么讲？',
    left: '按时间顺序把经过讲清楚',
    right: '先讲它意味着什么、有什么启发',
  },
  {
    id: 'tf1',
    dimension: 'TF',
    prompt: '朋友做错了一件事，你更可能先？',
    left: '直接指出问题在哪',
    right: '先接住对方的情绪',
  },
  {
    id: 'tf2',
    dimension: 'TF',
    prompt: '两个方案差不多时，你更看重？',
    left: '逻辑、效率和一致性',
    right: '对相关的人有什么影响',
  },
  {
    id: 'tf3',
    dimension: 'TF',
    prompt: '发生冲突时，你更想先？',
    left: '把事实和责任摆清楚',
    right: '确认彼此的感受和关系',
  },
  {
    id: 'jp1',
    dimension: 'JP',
    prompt: '出门旅行前，你更倾向？',
    left: '先把行程和备选定好',
    right: '留出空间，到了再改',
  },
  {
    id: 'jp2',
    dimension: 'JP',
    prompt: '面对一个截止日期，你通常？',
    left: '提前拆计划，按节点推进',
    right: '临近时集中火力完成',
  },
  {
    id: 'jp3',
    dimension: 'JP',
    prompt: '你的桌面或文件，更接近哪种？',
    left: '有固定位置，按类归好',
    right: '用着顺手就行，能找到就好',
  },
]

export interface MbtiDimensionResult extends MbtiDimension {
  leftScore: number
  rightScore: number
  leftPct: number
  rightPct: number
  letter: MbtiPole
}

export interface MbtiResult {
  type: string
  name: string
  summary: string
  dimensions: MbtiDimensionResult[]
}

/** 每种结果给一个不做诊断的轻量画像，避免把四个字母说成固定人格。 */
export const MBTI_TYPES: Record<string, { name: string; summary: string }> = {
  ISTJ: {
    name: '稳健执行型',
    summary: '重视事实、秩序和承诺，习惯把事情按可靠的方式做完。变化多时容易先收紧流程。',
  },
  ISFJ: {
    name: '细致守护型',
    summary: '记得别人的需要和细节，愿意用稳定、不张扬的方式照顾身边的人。拒绝别人时容易有负担。',
  },
  INFJ: {
    name: '安静洞察型',
    summary: '对人和事背后的动机敏感，想找到一致的方向再行动。长期消耗后需要独处恢复。',
  },
  INTJ: {
    name: '长远规划型',
    summary: '习惯先搭框架、看长期，再把复杂问题拆成可执行路径。别人跟不上节奏时容易显得冷。',
  },
  ISTP: {
    name: '冷静解决型',
    summary: '面对问题先看结构和手感，喜欢用最直接的办法把它修好。情绪表达通常不多。',
  },
  ISFP: {
    name: '感受当下型',
    summary: '重视真实感受和审美，更愿意按自己的节奏体验生活。冲突来了容易先退开。',
  },
  INFP: {
    name: '温和理想型',
    summary: '对人保持善意和想象，想做的事往往和价值观绑在一起。现实压力大时容易内耗。',
  },
  INTP: {
    name: '好奇分析型',
    summary: '喜欢拆概念、找漏洞、推演可能性，享受把问题想透的过程。落地和收尾容易拖。',
  },
  ESTP: {
    name: '行动试探型',
    summary: '对现场变化反应快，愿意先做再调整，擅长抓住眼前机会。耐心等长期回报较难。',
  },
  ESFP: {
    name: '热情体验型',
    summary: '容易被新鲜的人和体验点亮，擅长把气氛带起来。重复和约束会消耗你。',
  },
  ENFP: {
    name: '开放连接型',
    summary: '对人充满好奇，能快速建立连接，也总在寻找新的可能性。注意力容易被下一件事带走。',
  },
  ENTP: {
    name: '灵活思辨型',
    summary: '喜欢挑战既有说法，在讨论中把新点子越辩越清楚。收尾和细节容易失去兴趣。',
  },
  ESTJ: {
    name: '目标推进型',
    summary: '擅长定目标、分任务、推动事情落地，对效率敏感。容易把标准直接压给别人。',
  },
  ESFJ: {
    name: '关系协调型',
    summary: '会主动照顾氛围和关系，愿意让团队更顺畅地合作。容易把别人的评价放在心上。',
  },
  ENFJ: {
    name: '带动共识型',
    summary: '擅长看见人的潜力，把大家往一个方向带。过度承担责任时容易忽略自己。',
  },
  ENTJ: {
    name: '果断统筹型',
    summary: '习惯快速判断、整合资源、把复杂局面推向结果。节奏太快时别人可能跟不上。',
  },
}

export type MbtiAnswers = Record<string, MbtiPole>

/** 每组二选一都是 1 票；界面只在 12 题答完后调用，缺题或选项不属于该维视为编程错误。 */
export function scoreMbti(answers: MbtiAnswers): MbtiResult {
  const dimensions = MBTI_DIMENSIONS.map((dimension) => {
    let leftScore = 0
    let rightScore = 0

    for (const question of MBTI_QUESTIONS) {
      if (question.dimension !== dimension.key) continue
      const choice = answers[question.id]
      if (choice !== dimension.left && choice !== dimension.right) {
        throw new Error(`MBTI 第 ${question.id} 题缺少有效答案`)
      }

      if (choice === dimension.left) leftScore += 1
      else rightScore += 1
    }

    const leftPct = Math.round((leftScore / 3) * 100)
    const rightPct = 100 - leftPct

    return {
      ...dimension,
      leftScore,
      rightScore,
      leftPct,
      rightPct,
      letter: leftScore > rightScore ? dimension.left : dimension.right,
    }
  })

  const type = dimensions.map((dimension) => dimension.letter).join('')
  const info = MBTI_TYPES[type]
  if (!info) throw new Error(`没有 ${type} 的结果说明`)

  return { type, ...info, dimensions }
}

export interface ZodiacSign {
  id: string
  name: string
  en: string
  symbol: string
  startMonth: number
  startDay: number
  endMonth: number
  endDay: number
  dateText: string
  element: '火' | '土' | '风' | '水'
  mode: '开创' | '固定' | '变动'
  keywords: string[]
  summary: string
  tip: string
}

export const ZODIAC_SIGNS: readonly ZodiacSign[] = [
  {
    id: 'aries',
    name: '白羊座',
    en: 'Aries',
    symbol: '♈︎',
    startMonth: 3,
    startDay: 21,
    endMonth: 4,
    endDay: 19,
    dateText: '3.21 – 4.19',
    element: '火',
    mode: '开创',
    keywords: ['行动', '直接', '热度'],
    summary: '行动先于犹豫，喜欢直接开局；热度来得快，也需要有人陪你收尾。',
    tip: '先听完再决定，能少一半返工。',
  },
  {
    id: 'taurus',
    name: '金牛座',
    en: 'Taurus',
    symbol: '♉︎',
    startMonth: 4,
    startDay: 20,
    endMonth: 5,
    endDay: 20,
    dateText: '4.20 – 5.20',
    element: '土',
    mode: '固定',
    keywords: ['稳定', '质感', '耐心'],
    summary: '用稳定和耐心把事情做扎实，对质感、节奏和安全感敏感。',
    tip: '变化来临时，先给自己一点适应时间，不必立刻对抗。',
  },
  {
    id: 'gemini',
    name: '双子座',
    en: 'Gemini',
    symbol: '♊︎',
    startMonth: 5,
    startDay: 21,
    endMonth: 6,
    endDay: 21,
    dateText: '5.21 – 6.21',
    element: '风',
    mode: '变动',
    keywords: ['好奇', '表达', '切换'],
    summary: '好奇心和表达欲强，靠信息和交流理解世界，话题切换很快。',
    tip: '同时开太多线时，留一件真正要收尾的事。',
  },
  {
    id: 'cancer',
    name: '巨蟹座',
    en: 'Cancer',
    symbol: '♋︎',
    startMonth: 6,
    startDay: 22,
    endMonth: 7,
    endDay: 22,
    dateText: '6.22 – 7.22',
    element: '水',
    mode: '开创',
    keywords: ['照顾', '记忆', '归属'],
    summary: '重视情感连接和归属感，记得很多别人忽略的小事。',
    tip: '不舒服时直接说需求，别让对方猜。',
  },
  {
    id: 'leo',
    name: '狮子座',
    en: 'Leo',
    symbol: '♌︎',
    startMonth: 7,
    startDay: 23,
    endMonth: 8,
    endDay: 22,
    dateText: '7.23 – 8.22',
    element: '火',
    mode: '固定',
    keywords: ['表达', '慷慨', '被看见'],
    summary: '需要被看见，也愿意把热度和资源分给身边的人。',
    tip: '把认可先给自己一份，不必全靠外界回应。',
  },
  {
    id: 'virgo',
    name: '处女座',
    en: 'Virgo',
    symbol: '♍︎',
    startMonth: 8,
    startDay: 23,
    endMonth: 9,
    endDay: 22,
    dateText: '8.23 – 9.22',
    element: '土',
    mode: '变动',
    keywords: ['细节', '秩序', '改进'],
    summary: '擅长发现细节和改进空间，习惯把标准落实到步骤里。',
    tip: '完成比完美更重要，先交一版再修。',
  },
  {
    id: 'libra',
    name: '天秤座',
    en: 'Libra',
    symbol: '♎︎',
    startMonth: 9,
    startDay: 23,
    endMonth: 10,
    endDay: 23,
    dateText: '9.23 – 10.23',
    element: '风',
    mode: '开创',
    keywords: ['平衡', '审美', '关系'],
    summary: '在意关系和分寸，习惯先找平衡点，再做取舍。',
    tip: '该拒绝时明确一次，关系反而更轻松。',
  },
  {
    id: 'scorpio',
    name: '天蝎座',
    en: 'Scorpio',
    symbol: '♏︎',
    startMonth: 10,
    startDay: 24,
    endMonth: 11,
    endDay: 22,
    dateText: '10.24 – 11.22',
    element: '水',
    mode: '固定',
    keywords: ['深度', '专注', '边界'],
    summary: '投入时很深，重视信任和边界，对隐瞒和敷衍敏感。',
    tip: '把在意说出来，别用试探代替沟通。',
  },
  {
    id: 'sagittarius',
    name: '射手座',
    en: 'Sagittarius',
    symbol: '♐︎',
    startMonth: 11,
    startDay: 23,
    endMonth: 12,
    endDay: 21,
    dateText: '11.23 – 12.21',
    element: '火',
    mode: '变动',
    keywords: ['探索', '自由', '意义'],
    summary: '向往自由和更大的世界，喜欢从经历里找意义。',
    tip: '远方很好，也别把眼前的人当成背景。',
  },
  {
    id: 'capricorn',
    name: '摩羯座',
    en: 'Capricorn',
    symbol: '♑︎',
    startMonth: 12,
    startDay: 22,
    endMonth: 1,
    endDay: 19,
    dateText: '12.22 – 1.19',
    element: '土',
    mode: '开创',
    keywords: ['目标', '责任', '长期'],
    summary: '目标感强，愿意为长期结果承担当下的辛苦。',
    tip: '休息不是偷懒，长期主义也需要续航。',
  },
  {
    id: 'aquarius',
    name: '水瓶座',
    en: 'Aquarius',
    symbol: '♒︎',
    startMonth: 1,
    startDay: 20,
    endMonth: 2,
    endDay: 18,
    dateText: '1.20 – 2.18',
    element: '风',
    mode: '固定',
    keywords: ['独立', '观点', '未来'],
    summary: '习惯站在局外看问题，重视独立和新鲜观点。',
    tip: '想法很前卫，落地时多解释一步。',
  },
  {
    id: 'pisces',
    name: '双鱼座',
    en: 'Pisces',
    symbol: '♓︎',
    startMonth: 2,
    startDay: 19,
    endMonth: 3,
    endDay: 20,
    dateText: '2.19 – 3.20',
    element: '水',
    mode: '变动',
    keywords: ['共情', '想象', '边界'],
    summary: '共情和想象力强，容易接住别人的情绪。',
    tip: '帮别人之前，先确认自己的边界。',
  },
]

/** 按公历月日找太阳星座；交界日按固定的常见分界，不处理年份与出生时间。 */
export function zodiacFor(month: number, day: number): ZodiacSign {
  const md = month * 100 + day

  if (md >= 321 && md <= 419) return ZODIAC_SIGNS[0]
  if (md >= 420 && md <= 520) return ZODIAC_SIGNS[1]
  if (md >= 521 && md <= 621) return ZODIAC_SIGNS[2]
  if (md >= 622 && md <= 722) return ZODIAC_SIGNS[3]
  if (md >= 723 && md <= 822) return ZODIAC_SIGNS[4]
  if (md >= 823 && md <= 922) return ZODIAC_SIGNS[5]
  if (md >= 923 && md <= 1023) return ZODIAC_SIGNS[6]
  if (md >= 1024 && md <= 1122) return ZODIAC_SIGNS[7]
  if (md >= 1123 && md <= 1221) return ZODIAC_SIGNS[8]
  if (md >= 1222 || md <= 119) return ZODIAC_SIGNS[9]
  if (md >= 120 && md <= 218) return ZODIAC_SIGNS[10]
  return ZODIAC_SIGNS[11]
}

/** 2 月按 29 天算，生日输入里允许 2 月 29 日。 */
export function daysInMonth(month: number): number {
  return new Date(2024, month, 0).getDate()
}
