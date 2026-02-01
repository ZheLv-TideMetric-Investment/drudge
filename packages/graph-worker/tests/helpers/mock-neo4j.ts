export const createMockNeo4jSession = () => {
  const tx = {
    run: jest.fn()
  };
  const session = {
    run: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    writeTransaction: jest.fn(async (fn: (tx: any) => any) => fn(tx)),
    readTransaction: jest.fn(async (fn: (tx: any) => any) => fn(tx))
  };
  return { session, tx };
};

export const createMockNeo4jDriver = (session: any) => ({
  session: jest.fn(() => session)
});
