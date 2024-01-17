exports = function(authEvent) {
    const user = authEvent.user || authEvent;
    const collection = context.services.get("mongodb-atlas").db("Masters").collection("User");
    const newDoc = {
      _id: user.id,
      data: user.data,
      authEvent: authEvent,
      isAdmin: false, 
      masterId: null,
      cts: new Date(),
    };
    return collection.insertOne(newDoc);
};