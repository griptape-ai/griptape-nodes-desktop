/**
 * Utility functions for cleaning ANSI escape codes from terminal output
 */

/**
 * Removes ANSI cursor control codes and spinner characters from a string.
 * Use this for display purposes where ANSI styling will be converted to HTML.
 */
export function cleanAnsiForDisplay(message: string): string {
  return (
    message
      // Remove cursor show/hide codes
      .replace(/\x1b\[\?25[lh]/g, '')
      // Remove cursor position codes
      .replace(/\x1b\[\d*[A-G]/g, '')
      // Remove Windows-specific cursor positioning
      .replace(/\x1b\[\d+;\d+[HfRr]/g, '')
      // Handle Windows CRLF line endings
      .replace(/\r\n/g, '\n')
      // Remove carriage returns that cause overwriting
      .replace(/\r(?!\n)/g, '')
      // Replace spinner characters with a simple indicator
      .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, '•')
  )
}

/**
 * Removes all ANSI escape codes from a string, producing plain text.
 * Use this for clipboard operations or plain text export.
 */
export function stripAnsiCodes(message: string): string {
  return (
    message
      // Remove all ANSI color/style codes
      .replace(/\x1b\[[0-9;]*m/g, '')
      // Remove cursor show/hide codes
      .replace(/\x1b\[\?25[lh]/g, '')
      // Remove cursor position codes
      .replace(/\x1b\[\d*[A-G]/g, '')
      // Remove Windows-specific cursor positioning
      .replace(/\x1b\[\d+;\d+[HfRr]/g, '')
      // Handle Windows CRLF line endings
      .replace(/\r\n/g, '\n')
      // Remove carriage returns that cause overwriting
      .replace(/\r(?!\n)/g, '')
      // Replace spinner characters with a simple indicator
      .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, '•')
      // Convert OSC 8 hyperlinks to just the link text
      .replace(/\]8;[^;]*;[^\\]+\\([^\]]+?)\]8;;\\?/g, '$1')
      // Remove any remaining control characters
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim()
  )
}
