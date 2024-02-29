exports = function(authEvent) {
  const user = authEvent.user || authEvent;
  const collection = context.services.get("mongodb-atlas").db("Masters").collection("User");
  const userId = authEvent.identities[0].id;

  const filter = { _id: userId };

  const update = {
    $set: {
      id: user.id,
    },
    $setOnInsert: {
      name: user.data.name,
      data: user.data,
      authEvent: authEvent,
      isAdmin: false,
      masterId: null,
      cts: new Date(),
    }
  };

  const options = { upsert: true };

  return collection.updateOne(filter, update, options);
};