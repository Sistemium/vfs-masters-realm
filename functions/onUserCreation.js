exports = function(authEvent) {
    const user = authEvent.user || authEvent;
    const collection = context.services.get("mongodb-atlas").db("Masters").collection("User");
    const newDoc = {
      _id: user.id,
      name: user.data.name,
      data: user.data,
      authEvent: authEvent,
      isAdmin: false, 
      masterId: null,
      identities: authEvent.identities.id,
      cts: new Date(),
    };
    return collection.insertOne(newDoc);
};