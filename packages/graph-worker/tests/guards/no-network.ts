const networkGuardError = new Error('Network disabled in tests. Mock axios in test.');
const rejectNetwork = () => Promise.reject(networkGuardError);

type AxiosMock = jest.Mock & {
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
  delete: jest.Mock;
  patch: jest.Mock;
  request: jest.Mock;
  create: jest.Mock;
  isAxiosError: (error: any) => boolean;
};

const axiosMock = jest.fn(rejectNetwork) as AxiosMock;
axiosMock.get = jest.fn(rejectNetwork);
axiosMock.post = jest.fn(rejectNetwork);
axiosMock.put = jest.fn(rejectNetwork);
axiosMock.delete = jest.fn(rejectNetwork);
axiosMock.patch = jest.fn(rejectNetwork);
axiosMock.request = jest.fn(rejectNetwork);
axiosMock.create = jest.fn(() => axiosMock);
axiosMock.isAxiosError = (error: any) => Boolean(error && (error as any).isAxiosError);

jest.mock('axios', () => axiosMock);

export const installNoNetworkGuard = () => {
  axiosMock.mockImplementation(rejectNetwork);
  axiosMock.get.mockImplementation(rejectNetwork);
  axiosMock.post.mockImplementation(rejectNetwork);
  axiosMock.put.mockImplementation(rejectNetwork);
  axiosMock.delete.mockImplementation(rejectNetwork);
  axiosMock.patch.mockImplementation(rejectNetwork);
  axiosMock.request.mockImplementation(rejectNetwork);
  axiosMock.create.mockImplementation(() => axiosMock);
};

export { networkGuardError };
