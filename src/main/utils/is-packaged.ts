declare const __NODE_ENV__: string | undefined;

export const isPackaged = (): boolean => {
  return __NODE_ENV__ !== 'development';
};
