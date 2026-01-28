import { mergeNestedArray } from './gtn-service'

describe('mergeNestedArray', () => {
  it('should merge items into an empty object', () => {
    const obj: Record<string, any> = {}

    mergeNestedArray({
      obj,
      path: ['level1', 'level2', 'items'],
      items: ['a', 'b'],
      unique: false,
    })

    expect(obj).toEqual({
      level1: {
        level2: {
          items: ['a', 'b'],
        },
      },
    })
  })

  it('should merge items into an existing array', () => {
    const obj = {
      level1: {
        level2: {
          items: ['existing'],
        },
      },
    }

    mergeNestedArray({
      obj,
      path: ['level1', 'level2', 'items'],
      items: ['new1', 'new2'],
      unique: false,
    })

    expect(obj.level1.level2.items).toEqual(['existing', 'new1', 'new2'])
  })

  it('should deduplicate items when unique is true', () => {
    const obj = {
      level1: {
        items: ['a', 'b'],
      },
    }

    mergeNestedArray({
      obj,
      path: ['level1', 'items'],
      items: ['b', 'c', 'a'],
      unique: true,
    })

    expect(obj.level1.items).toEqual(['a', 'b', 'c'])
  })

  it('should not deduplicate when unique is false', () => {
    const obj = {
      items: ['a', 'b'],
    }

    mergeNestedArray({
      obj,
      path: ['items'],
      items: ['b', 'c'],
      unique: false,
    })

    expect(obj.items).toEqual(['a', 'b', 'b', 'c'])
  })

  it('should handle deeply nested paths', () => {
    const obj: Record<string, any> = {}

    mergeNestedArray({
      obj,
      path: ['a', 'b', 'c', 'd', 'e'],
      items: [1, 2, 3],
      unique: false,
    })

    expect(obj).toEqual({
      a: {
        b: {
          c: {
            d: {
              e: [1, 2, 3],
            },
          },
        },
      },
    })
  })

  it('should convert non-array existing value to array', () => {
    const obj = {
      config: {
        value: 'single',
      },
    }

    mergeNestedArray({
      obj,
      path: ['config', 'value'],
      items: ['new'],
      unique: false,
    })

    expect(obj.config.value).toEqual(['single', 'new'])
  })

  it('should handle single-level path', () => {
    const obj: Record<string, any> = {}

    mergeNestedArray({
      obj,
      path: ['items'],
      items: ['a', 'b'],
      unique: false,
    })

    expect(obj).toEqual({ items: ['a', 'b'] })
  })

  it('should preserve other properties in the object', () => {
    const obj = {
      level1: {
        otherProp: 'preserved',
        level2: {
          anotherProp: 123,
          items: ['existing'],
        },
      },
    }

    mergeNestedArray({
      obj,
      path: ['level1', 'level2', 'items'],
      items: ['new'],
      unique: false,
    })

    expect(obj).toEqual({
      level1: {
        otherProp: 'preserved',
        level2: {
          anotherProp: 123,
          items: ['existing', 'new'],
        },
      },
    })
  })

  it('should handle empty items array', () => {
    const obj = {
      items: ['a', 'b'],
    }

    mergeNestedArray({
      obj,
      path: ['items'],
      items: [],
      unique: false,
    })

    expect(obj.items).toEqual(['a', 'b'])
  })

  it('should create array from undefined value', () => {
    const obj = {
      level1: {},
    }

    mergeNestedArray({
      obj,
      path: ['level1', 'items'],
      items: ['a'],
      unique: false,
    })

    expect(obj.level1).toEqual({ items: ['a'] })
  })
})
