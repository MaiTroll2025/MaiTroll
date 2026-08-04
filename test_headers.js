
const requestHeaders = {
  'Content-Type': 'application/json',
  'x-client-info': 'Mai Troll-web',
  'apikey': 'some-anon-key'
};

const optionsHeaders = {
  'Authorization': 'Bearer my-token'
};

Object.assign(requestHeaders, optionsHeaders);

console.log(requestHeaders);
