class Store<T extends Record<string, unknown> = Record<string, unknown>> {
  private data: Partial<T> = {}
  private changeListeners: ((newValue: Partial<T>, oldValue: Partial<T>) => void)[] = []

  constructor(_options?: { name?: string }) {
    // Options ignored in mock
  }

  get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K] | undefined {
    const value = this.data[key]
    return value !== undefined ? value : defaultValue
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    const oldValue = { ...this.data }
    this.data[key] = value
    this.changeListeners.forEach((listener) => listener({ ...this.data }, oldValue))
  }

  delete<K extends keyof T>(key: K): void {
    const oldValue = { ...this.data }
    delete this.data[key]
    this.changeListeners.forEach((listener) => listener({ ...this.data }, oldValue))
  }

  clear(): void {
    const oldValue = { ...this.data }
    this.data = {}
    this.changeListeners.forEach((listener) => listener({}, oldValue))
  }

  onDidAnyChange(callback: (newValue: Partial<T>, oldValue: Partial<T>) => void): () => void {
    this.changeListeners.push(callback)
    return () => {
      const index = this.changeListeners.indexOf(callback)
      if (index > -1) {
        this.changeListeners.splice(index, 1)
      }
    }
  }
}

export default Store
