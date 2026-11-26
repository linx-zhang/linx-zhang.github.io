import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  MBTI_DIMENSIONS,
  MBTI_POLE_DETAILS,
  MBTI_QUESTIONS,
  MBTI_TYPES,
  ZODIAC_SIGNS,
  daysInMonth,
  scoreMbti,
  zodiacFor,
} from './personality'
import type { MbtiAnswers } from './personality'
import PersonalityTool from './PersonalityTool'

function answersFor(side: 'left' | 'right'): MbtiAnswers {
  const result: MbtiAnswers = {}
  for (const question of MBTI_QUESTIONS) {
    const dimension = MBTI_DIMENSIONS.find((item) => item.key === question.dimension)
    if (!dimension) throw new Error(`缺少维度 ${question.dimension}`)
    result[question.id] = side === 'left' ? dimension.left : dimension.right
  }
  return result
}

describe('MBTI 精简版评分', () => {
  it('12 道题，每维 3 道', () => {
    expect(MBTI_QUESTIONS).toHaveLength(12)
    for (const dimension of MBTI_DIMENSIONS) {
      expect(MBTI_QUESTIONS.filter((question) => question.dimension === dimension.key)).toHaveLength(3)
    }
  })

  it('16 种类型都有结果文案', () => {
    expect(Object.keys(MBTI_TYPES)).toHaveLength(16)
  })

  it('全部选左边得到 ESTJ，全部选右边得到 INFP', () => {
    expect(scoreMbti(answersFor('left')).type).toBe('ESTJ')
    expect(scoreMbti(answersFor('right')).type).toBe('INFP')
  })

  it('同一维 3 票只出现 0 / 33 / 67 / 100，不会平局', () => {
    const result = scoreMbti(answersFor('left'))
    for (const dimension of result.dimensions) {
      expect(dimension.letter).toBe(dimension.left)
      expect(dimension.leftScore).toBe(3)
      expect(dimension.leftPct).toBe(100)
      expect(dimension.rightPct).toBe(0)
    }
  })

  it('改掉两票后换边，另一侧是 67%', () => {
    const answers = answersFor('left')
    answers.ei1 = 'I'
    answers.ei2 = 'I'
    const ei = scoreMbti(answers).dimensions[0]
    expect(ei.letter).toBe('I')
    expect(ei.leftPct).toBe(33)
    expect(ei.rightPct).toBe(67)
  })

  it('缺题或选项不属于当前维度会直接报错', () => {
    const missing = answersFor('left')
    delete missing.tf1
    expect(() => scoreMbti(missing)).toThrow()

    const invalid = answersFor('left')
    invalid.ei1 = 'S'
    expect(() => scoreMbti(invalid)).toThrow()
  })

  it('八个倾向都有详细解释和场景例子', () => {
    expect(Object.keys(MBTI_POLE_DETAILS)).toHaveLength(8)
    for (const dimension of MBTI_DIMENSIONS) {
      const left = MBTI_POLE_DETAILS[dimension.left]
      const right = MBTI_POLE_DETAILS[dimension.right]
      expect(left.dimension).toBe(dimension.key)
      expect(right.dimension).toBe(dimension.key)
      expect(left.signs.length).toBeGreaterThanOrEqual(2)
      expect(right.signs.length).toBeGreaterThanOrEqual(2)
      expect(left.example.length).toBeGreaterThan(0)
      expect(right.example.length).toBeGreaterThan(0)
    }
  })
})

describe('星座速查', () => {
  it('12 个星座，顺序按白羊到双鱼', () => {
    expect(ZODIAC_SIGNS).toHaveLength(12)
    expect(ZODIAC_SIGNS[0].name).toBe('白羊座')
    expect(ZODIAC_SIGNS[11].name).toBe('双鱼座')
  })

  it.each([
    [1, 19, '摩羯座'],
    [1, 20, '水瓶座'],
    [2, 18, '水瓶座'],
    [2, 19, '双鱼座'],
    [3, 20, '双鱼座'],
    [3, 21, '白羊座'],
    [4, 19, '白羊座'],
    [4, 20, '金牛座'],
    [5, 20, '金牛座'],
    [5, 21, '双子座'],
    [6, 21, '双子座'],
    [6, 22, '巨蟹座'],
    [7, 22, '巨蟹座'],
    [7, 23, '狮子座'],
    [8, 22, '狮子座'],
    [8, 23, '处女座'],
    [9, 22, '处女座'],
    [9, 23, '天秤座'],
    [10, 23, '天秤座'],
    [10, 24, '天蝎座'],
    [11, 22, '天蝎座'],
    [11, 23, '射手座'],
    [12, 21, '射手座'],
    [12, 22, '摩羯座'],
  ] as Array<[number, number, string]>)('%i 月 %i 日是 %s', (month, day, name) => {
    expect(zodiacFor(month, day).name).toBe(name)
  })

  it('每月天数按闰年 2 月处理，生日可以选 2 月 29 日', () => {
    expect(daysInMonth(2)).toBe(29)
    expect(daysInMonth(4)).toBe(30)
    expect(daysInMonth(12)).toBe(31)
  })
})

describe('PersonalityTool', () => {
  it('点「E/I」一组按钮，左右同时展开解释，再点收起', () => {
    render(<PersonalityTool />)

    fireEvent.click(screen.getByRole('button', { name: /E\/I/ }))
    expect(screen.getByRole('region', { name: 'E/I 外向与内向 对比解释' })).toBeTruthy()
    expect(screen.getByText(/临时被拉进一桌不熟的人/)).toBeTruthy()
    expect(screen.getByText(/同一桌不熟的人/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '收起' }))
    expect(screen.queryByRole('region', { name: /对比解释/ })).toBeNull()
  })

  it('12 次选择后出结果，并能切到星座页', () => {
    const { container } = render(<PersonalityTool />)

    fireEvent.click(screen.getByRole('button', { name: '开始 12 道题' }))
    for (let index = 0; index < 12; index += 1) {
      const choices = container.querySelectorAll<HTMLButtonElement>('.persona-choice')
      expect(choices).toHaveLength(2)
      fireEvent.click(choices[0])
    }

    expect(screen.getByText('ESTJ')).toBeTruthy()
    expect(screen.getByText('目标推进型')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '去看星座速查' }))
    expect(screen.getByText(/你出生那天/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '出生月份' })).toBeTruthy()
  })

  it('生日用数字下拉，点底部星座卡能看详情并回到生日结果', () => {
    const { container } = render(<PersonalityTool />)
    fireEvent.click(screen.getByRole('tab', { name: '星座速查' }))

    fireEvent.click(screen.getByRole('button', { name: '出生月份' }))
    const monthOptions = screen.getAllByRole('option')
    expect(monthOptions).toHaveLength(12)
    expect(monthOptions[0].textContent).toBe('1')
    fireEvent.click(screen.getByRole('option', { name: '4' }))

    fireEvent.click(screen.getByRole('button', { name: '出生日期' }))
    expect(screen.getAllByRole('option').length).toBe(30)
    fireEvent.click(screen.getByRole('option', { name: '20' }))

    expect(container.querySelector('.persona-zodiac-title strong')?.textContent).toBe('金牛座')

    fireEvent.click(screen.getByRole('button', { name: /狮子座/ }))
    expect(container.querySelector('.persona-zodiac-title strong')?.textContent).toBe('狮子座')
    expect(screen.getByRole('button', { name: '回到生日结果' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '回到生日结果' }))
    expect(container.querySelector('.persona-zodiac-title strong')?.textContent).toBe('金牛座')
  })
})
