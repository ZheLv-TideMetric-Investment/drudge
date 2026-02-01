export const freezeTime = (value: string | number | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  jest.useFakeTimers();
  jest.setSystemTime(date);
  return () => {
    jest.useRealTimers();
  };
};
