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

  // Extract user's name from the auth payload or external response
  const userName = auth.account.name; // Adjust this according to your actual payload structure

  // Include the user's name in the return object
  return {
    userId: auth.account.authId,
    userDisplayName: name
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
