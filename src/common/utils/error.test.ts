import { getErrorMessage } from './error'

describe('getErrorMessage', () => {
  it('should extract message from Error instance', () => {
    const error = new Error('Something went wrong')
    expect(getErrorMessage(error)).toBe('Something went wrong')
  })

  it('should handle Error with empty message', () => {
    const error = new Error('')
    expect(getErrorMessage(error)).toBe('')
  })

  it('should convert string to string', () => {
    expect(getErrorMessage('Error string')).toBe('Error string')
  })

  it('should convert empty string to string', () => {
    expect(getErrorMessage('')).toBe('')
  })

  it('should convert null to string', () => {
    expect(getErrorMessage(null)).toBe('null')
  })

  it('should convert undefined to string', () => {
    expect(getErrorMessage(undefined)).toBe('undefined')
  })

  it('should convert number to string', () => {
    expect(getErrorMessage(404)).toBe('404')
    expect(getErrorMessage(0)).toBe('0')
    expect(getErrorMessage(-1)).toBe('-1')
  })

  it('should convert boolean to string', () => {
    expect(getErrorMessage(true)).toBe('true')
    expect(getErrorMessage(false)).toBe('false')
  })

  it('should convert object to string', () => {
    const obj = { code: 'ERR_NETWORK', message: 'Network error' }
    expect(getErrorMessage(obj)).toBe('[object Object]')
  })

  it('should convert array to string', () => {
    const arr = ['error1', 'error2']
    expect(getErrorMessage(arr)).toBe('error1,error2')
  })

  it('should handle object with custom toString', () => {
    const obj = {
      toString() {
        return 'Custom error message'
      },
    }
    expect(getErrorMessage(obj)).toBe('Custom error message')
  })

  it('should handle TypeError', () => {
    const error = new TypeError('Cannot read property of undefined')
    expect(getErrorMessage(error)).toBe('Cannot read property of undefined')
  })

  it('should handle RangeError', () => {
    const error = new RangeError('Value out of range')
    expect(getErrorMessage(error)).toBe('Value out of range')
  })

  it('should handle SyntaxError', () => {
    const error = new SyntaxError('Unexpected token')
    expect(getErrorMessage(error)).toBe('Unexpected token')
  })
})
