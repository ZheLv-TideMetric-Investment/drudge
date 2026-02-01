import axios from 'axios';

export type MockedAxios = jest.Mocked<typeof axios>;

export const getMockedAxios = () => axios as MockedAxios;

export const mockAxiosResponse = (data: any, status = 200) => {
  const mocked = getMockedAxios();
  const response = {
    data,
    status,
    statusText: status >= 400 ? 'Error' : 'OK',
    headers: {},
    config: {}
  };
  mocked.get.mockResolvedValue(response);
  mocked.post.mockResolvedValue(response);
  mocked.request.mockResolvedValue(response);
  return response;
};
