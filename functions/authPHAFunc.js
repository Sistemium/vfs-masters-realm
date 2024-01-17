exports = async (loginPayload) => {
  const { accessToken, name } = loginPayload;
  const options = {
    url: 'https://oauth.it/pha/roles',
    headers: { authorization: [accessToken] },
  };
  const response = await context.http.get(options);
  if (response.statusCode !== 200) {
    throw new Error(`HTTP error, status = ${response.status}`);
  }
  const auth = JSON.parse(response.body.text());
  return {
    id: auth.account.authId,
    name: name,
    test: 'testt1'
  };
};

  // exports = async (loginPayload) => {
  //   const { accessToken } = loginPayload;
  //   const options = {
  //     url: 'https://oauth.it/pha/roles',
  //     headers: { authorization: [accessToken] },
  //   };
  //   const response = await context.http.get(options);
  //   if (response.statusCode !== 200) {
  //     throw new Error(`HTTP error, status = ${response.status}`);
  //   }
  //   const auth = JSON.parse(response.body.text());
  //   return auth.account.authId;
  // };
