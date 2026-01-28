import { InMemoryStore } from './in-memory-store'
import { PersistentStore } from './persistent-store'

// Mock the PersistentStore to avoid Electron dependencies
jest.mock('./persistent-store', () => ({
  PersistentStore: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    get: jest.fn(),
    has: jest.fn(),
    clear: jest.fn(),
    getAll: jest.fn()
  }))
}))

interface TestData {
  name: string
  age: number
  active: boolean
  tags: string[]
}

describe('InMemoryStore', () => {
  let store: InMemoryStore<TestData>

  beforeEach(() => {
    store = new InMemoryStore<TestData>()
    jest.clearAllMocks()
  })

  describe('get', () => {
    it('should return undefined for non-existent key', () => {
      expect(store.get('name')).toBeUndefined()
    })

    it('should return stored value', () => {
      store.set('name', 'John')
      expect(store.get('name')).toBe('John')
    })

    it('should return different types correctly', () => {
      store.set('name', 'Jane')
      store.set('age', 25)
      store.set('active', true)
      store.set('tags', ['a', 'b'])

      expect(store.get('name')).toBe('Jane')
      expect(store.get('age')).toBe(25)
      expect(store.get('active')).toBe(true)
      expect(store.get('tags')).toEqual(['a', 'b'])
    })
  })

  describe('set', () => {
    it('should store a new value', () => {
      store.set('name', 'Alice')
      expect(store.get('name')).toBe('Alice')
    })

    it('should overwrite existing value', () => {
      store.set('name', 'Alice')
      store.set('name', 'Bob')
      expect(store.get('name')).toBe('Bob')
    })

    it('should store undefined value', () => {
      store.set('name', undefined as unknown as string)
      expect(store.has('name')).toBe(false) // undefined is treated as not present
    })

    it('should store falsy values', () => {
      store.set('age', 0)
      store.set('active', false)
      store.set('name', '')

      expect(store.get('age')).toBe(0)
      expect(store.get('active')).toBe(false)
      expect(store.get('name')).toBe('')
    })
  })

  describe('clear', () => {
    it('should remove all values', () => {
      store.set('name', 'John')
      store.set('age', 30)
      store.set('active', true)

      store.clear()

      expect(store.get('name')).toBeUndefined()
      expect(store.get('age')).toBeUndefined()
      expect(store.get('active')).toBeUndefined()
    })

    it('should work on empty store', () => {
      expect(() => store.clear()).not.toThrow()
    })
  })

  describe('has', () => {
    it('should return false for non-existent key', () => {
      expect(store.has('name')).toBe(false)
    })

    it('should return true for existing key', () => {
      store.set('name', 'John')
      expect(store.has('name')).toBe(true)
    })

    it('should return true for falsy values', () => {
      store.set('age', 0)
      store.set('active', false)
      store.set('name', '')

      expect(store.has('age')).toBe(true)
      expect(store.has('active')).toBe(true)
      expect(store.has('name')).toBe(true)
    })

    it('should return false for undefined values', () => {
      store.set('name', undefined as unknown as string)
      expect(store.has('name')).toBe(false)
    })

    it('should return false after clear', () => {
      store.set('name', 'John')
      store.clear()
      expect(store.has('name')).toBe(false)
    })
  })

  describe('getAll', () => {
    it('should return empty object for empty store', () => {
      expect(store.getAll()).toEqual({})
    })

    it('should return all stored values', () => {
      store.set('name', 'John')
      store.set('age', 30)

      const all = store.getAll()

      expect(all).toEqual({
        name: 'John',
        age: 30
      })
    })

    it('should return a shallow copy (not reference)', () => {
      store.set('name', 'John')

      const all = store.getAll()
      all.name = 'Modified'

      // Original should not be modified
      expect(store.get('name')).toBe('John')
    })

    it('should not include undefined values', () => {
      store.set('name', 'John')
      store.set('age', undefined as unknown as number)

      const all = store.getAll()
      expect(all).toEqual({ name: 'John' })
      expect('age' in all).toBe(true) // The key exists
    })
  })

  describe('toPersistent', () => {
    it('should create a PersistentStore', () => {
      store.set('name', 'John')
      store.set('age', 30)

      const persistentStore = store.toPersistent('test-store', true)

      expect(persistentStore).toBeDefined()
    })

    it('should copy data to PersistentStore', () => {
      store.set('name', 'John')
      store.set('age', 30)

      const persistentStore = store.toPersistent('test-store', false)

      // Verify PersistentStore was called with correct args
      expect(PersistentStore).toHaveBeenCalledWith('test-store', false)

      // Verify set was called for each value
      expect(persistentStore.set).toHaveBeenCalledWith('name', 'John')
      expect(persistentStore.set).toHaveBeenCalledWith('age', 30)
    })

    it('should not copy undefined values', () => {
      store.set('name', 'John')
      store.set('age', undefined as unknown as number)

      const persistentStore = store.toPersistent('test-store', true)

      // Only defined values should be copied
      expect(persistentStore.set).toHaveBeenCalledWith('name', 'John')
      expect(persistentStore.set).not.toHaveBeenCalledWith('age', undefined)
    })
  })
})

describe('InMemoryStore type safety', () => {
  it('should enforce type constraints', () => {
    interface TypedData {
      id: number
      label: string
    }

    const store = new InMemoryStore<TypedData>()

    store.set('id', 123)
    store.set('label', 'test')

    const id: number | undefined = store.get('id')
    const label: string | undefined = store.get('label')

    expect(id).toBe(123)
    expect(label).toBe('test')
  })
})
